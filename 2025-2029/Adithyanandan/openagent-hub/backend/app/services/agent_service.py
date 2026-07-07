"""
Agent runtime.

Executes an agent run as a ReAct-style tool-calling loop:

    system prompt (+ memory + skill)
        ↓
    LLM completion (with tools)
        ↓  tool_calls?
        ├─ yes → run each tool, append results, loop
        └─ no  → final answer, done

Every step is persisted to `agent_steps` and emitted as an SSE event so the
frontend can render a live timeline. Sub-agents (multi-agent) are spawned via
the `spawn_agent` tool and executed concurrently, sharing the same memory.
"""
import asyncio
import json
from datetime import datetime
from uuid import UUID

from app.core.database import SessionLocal
from app.core import crypto
from app.models.agent import Agent
from app.models.agent_run import AgentRun
from app.models.agent_step import AgentStep
from app.services import agent_tools, memory_service
from app.services.provider_service import has_enabled_providers
from app.services.router_service import route_completion
from app.services.llm_service import get_provider_config
from app.core.provider import chat_completion

MAX_ITERATIONS = 8
MAX_GOAL_ITERATIONS = 20  # autonomous "goal" mode runs longer before giving up
MAX_SUBAGENT_DEPTH = 1  # coordinator (0) may spawn workers (1); workers cannot spawn further

DONE_TOKEN = "[[DONE]]"

# Appended to the system prompt in autonomous "goal" mode (Claude-Code-style):
# keep working across many steps until the goal is verifiably achieved.
GOAL_MODE_PROMPT = (
    "## Autonomous Goal Mode\n"
    "You are operating like an autonomous coding/work agent. Persistently drive the goal to completion "
    "across MULTIPLE steps: plan, act with tools, observe the results, and self-correct. Do NOT stop after "
    "a single step or a partial result. Keep going until the goal is fully and verifiably achieved.\n"
    f"When — and only when — the goal is completely done, reply with a message that STARTS with the token "
    f"{DONE_TOKEN} followed by the complete final deliverable in Markdown. If the goal is not yet done, take "
    "the next concrete action instead of writing a summary."
)

# Nudge sent when, in goal mode, the model produces prose without finishing or acting.
GOAL_CONTINUE_PROMPT = (
    f"If the goal is now FULLY achieved, reply starting with the token {DONE_TOKEN} followed by the complete "
    "final deliverable. Otherwise keep going: take the next concrete step or call the tools you need. "
    "Do not just summarize progress."
)

# Replaces the base prompt in "plan" mode: produce a plan, do not execute.
PLAN_MODE_PROMPT = (
    "You are a planning assistant in OpenAgent Hub. Do NOT execute the task and do NOT call any tools. "
    "Produce a clear, numbered, step-by-step plan to achieve the goal. For each step, note which tools or "
    "sub-agents you would use and what 'done' looks like. End with a short list of success criteria. "
    "Respond only with the plan, in Markdown."
)


# Built-in "Orchestrator" agent. Seeded per-user (lazily, like skills) and used as
# the default agent on the Agents tab. It decomposes goals and delegates to team
# members (multi-agent) or generic sub-agents.
ORCHESTRATOR_NAME = "Orchestrator"
ORCHESTRATOR_PROMPT = (
    "You are the Orchestrator — a senior coordinator agent in OpenAgent Hub. Your job is to achieve "
    "the user's goal by planning and, when useful, delegating to specialised agents.\n\n"
    "How to work:\n"
    "1. Briefly decompose the goal into concrete subtasks.\n"
    "2. For each subtask that benefits from a specialist, delegate it: use the `delegate` tool to hand it "
    "to a specific team agent (preferred when a matching team member exists), or `spawn_agent` for a "
    "generic worker. Delegate INDEPENDENT subtasks so they can run in parallel.\n"
    "3. Do simple subtasks yourself with the other tools rather than delegating everything.\n"
    "4. Integrate the results into a single, coherent final answer — don't just paste sub-agent outputs; "
    "synthesise them. Resolve conflicts and fill gaps.\n"
    "Be decisive and avoid unnecessary delegation when you can answer directly."
)


def seed_builtin_agents(db, user_id: UUID) -> None:
    """Ensure the built-in Orchestrator agent exists for this user (idempotent)."""
    existing = (
        db.query(Agent)
        .filter(Agent.user_id == user_id, Agent.is_builtin == True, Agent.name == ORCHESTRATOR_NAME)
        .first()
    )
    if existing:
        return
    db.add(Agent(
        user_id=user_id,
        name=ORCHESTRATOR_NAME,
        description="Coordinates the task and delegates to your specialised agents.",
        system_prompt=ORCHESTRATOR_PROMPT,
        allow_subagents=True,
        is_builtin=True,
    ))
    db.commit()


def _base_system_prompt() -> str:
    return (
        "You are an autonomous agent in OpenAgent Hub. You are given a goal and a set of tools. "
        "Work toward the goal step by step. Think about what to do, call tools when they help, and "
        "use their results. When you have enough information, give a complete final answer in Markdown. "
        "Only call tools that are actually useful — do not call a tool if you can already answer. "
        "Be concise in intermediate reasoning and thorough in your final answer."
    )


def create_run(
    db,
    user_id: UUID,
    goal: str,
    agent_id: UUID | None = None,
    skill_id: UUID | None = None,
    model: str | None = None,
    provider_id: UUID | None = None,
    conversation_id: UUID | None = None,
    parent_run_id: UUID | None = None,
    role: str | None = None,
    mode: str = "auto",
) -> AgentRun:
    run = AgentRun(
        user_id=user_id,
        agent_id=agent_id,
        skill_id=skill_id,
        goal=goal,
        model=model,
        provider_id=provider_id,
        conversation_id=conversation_id,
        parent_run_id=parent_run_id,
        role=role,
        mode=mode if mode in ("auto", "goal", "plan") else "auto",
        status="pending",
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def _record_step(
    db,
    run_id: UUID,
    index: int,
    step_type: str,
    content: str | None = None,
    tool_name: str | None = None,
    tool_input: dict | None = None,
    tool_output: str | None = None,
) -> AgentStep:
    step = AgentStep(
        run_id=run_id,
        step_index=index,
        type=step_type,
        content=content,
        tool_name=tool_name,
        tool_input=tool_input,
        tool_output=tool_output,
    )
    db.add(step)
    db.commit()
    db.refresh(step)
    return step


def _resolve_model(db, user_id: UUID, model: str | None) -> tuple[str, bool]:
    """Return (model, use_router). Falls back to the single provider config."""
    use_router = has_enabled_providers(db, user_id)
    if model:
        return model, use_router
    if use_router:
        # router will use whatever model string we pass; try catalog/config default
        cfg = _safe_config_model(db, user_id)
        return cfg or "", use_router
    cfg = _safe_config_model(db, user_id)
    return cfg or "", use_router


def _safe_config_model(db, user_id: UUID) -> str | None:
    try:
        cfg = get_provider_config(db, user_id)
        return cfg.model or None
    except Exception:  # noqa: BLE001
        return None


async def _complete_once(db, user_id, model, messages, tools, use_router, preferred_provider_id, tool_choice="auto", model_order=None):
    if use_router:
        message, _provider = await route_completion(
            db, user_id, model, messages, tools=tools,
            preferred_provider_id=preferred_provider_id, tool_choice=tool_choice,
            model_order=model_order,
        )
        return message
    cfg = get_provider_config(db, user_id)
    return await chat_completion(
        base_url=cfg.base_url,
        api_key=crypto.decrypt(cfg.api_key),
        model=model or cfg.model,
        messages=messages,
        tools=tools,
        tool_choice=tool_choice,
    )


async def _complete(db, user_id, model, messages, tools, use_router, preferred_provider_id, tool_choice="auto", model_order=None):
    """One LLM completion with a single retry on transient upstream failures.

    Providers occasionally return transient 4xx/5xx (e.g. upstream routing hiccups);
    a single retry meaningfully improves sub-agent reliability without masking real errors."""
    try:
        return await _complete_once(db, user_id, model, messages, tools, use_router, preferred_provider_id, tool_choice, model_order)
    except Exception:  # noqa: BLE001
        await asyncio.sleep(0.6)
        return await _complete_once(db, user_id, model, messages, tools, use_router, preferred_provider_id, tool_choice, model_order)


async def run_agent(
    run_id: UUID,
    user_id: UUID,
    tool_mode: str = "auto",
    tool_names: list[str] | None = None,
    skill_auto: bool = False,
    mode: str | None = None,
    team_agent_ids: list[UUID] | None = None,
    continue_message: str | None = None,
):
    """Execute a run to completion, yielding SSE event dicts. The caller serialises them.

    `tool_mode`       : "off" (no tools) | "auto" (default) | "always" (force a tool call first).
    `tool_names`      : optional whitelist; combined with any skill restriction (intersection).
    `skill_auto`      : when no skill is set, list available skills and let the agent adopt one.
    `mode`            : execution mode — "auto" (one ReAct pass), "goal" (autonomous until the
                        goal is verifiably done), or "plan" (produce a plan, no execution). If
                        None, the run's persisted mode is used.
    `team_agent_ids`  : saved agents the coordinator may delegate to (multi-agent). Enables the
                        `delegate` tool (requires the run's agent to allow sub-agents).
    `continue_message`: when set, the run is continued — the prior transcript is reconstructed
                        from its steps and this becomes the next user turn; new steps append.
    """
    with SessionLocal() as db:
        run = db.query(AgentRun).filter(AgentRun.id == run_id, AgentRun.user_id == user_id).first()
        if not run:
            yield {"type": "error", "message": "Run not found"}
            return

        goal = run.goal
        model_pref = run.model
        provider_pref = str(run.provider_id) if run.provider_id else None
        conversation_id = run.conversation_id
        skill_id = run.skill_id
        agent_id = run.agent_id
        run_mode = (mode or run.mode or "auto").lower()
        if run_mode not in ("auto", "goal", "plan"):
            run_mode = "auto"
        depth = 0
        # Determine depth from parent chain
        if run.parent_run_id:
            depth = 1

        try:
            # Resolve agent template + skill
            allow_subagents = False
            system_prompt = _base_system_prompt()
            allowed_tools = None
            project_id = None

            if agent_id:
                agent = db.query(Agent).filter(Agent.id == agent_id, Agent.user_id == user_id).first()
                if agent:
                    allow_subagents = agent.allow_subagents
                    if agent.system_prompt:
                        system_prompt = agent.system_prompt
                    if not skill_id and agent.skill_id:
                        skill_id = agent.skill_id
                    if not model_pref and agent.model:
                        model_pref = agent.model

            if skill_id:
                from app.services.skill_service import get_skill
                try:
                    skill = get_skill(db, user_id, skill_id)
                    system_prompt = f"{system_prompt}\n\n## Skill: {skill.name}\n{skill.instructions}"
                    allowed_tools = skill.tool_names or None
                except Exception:  # noqa: BLE001
                    pass
            elif skill_auto:
                # "Auto" skill: let the agent adopt the most relevant skill itself.
                from app.services.skill_service import build_auto_skill_prompt
                try:
                    auto_block = build_auto_skill_prompt(db, user_id)
                    if auto_block:
                        system_prompt = f"{system_prompt}\n\n{auto_block}"
                except Exception:  # noqa: BLE001
                    pass

            # Combine the user-picked tool whitelist with any skill restriction.
            # If both exist, intersect; None/empty means "all available tools".
            if tool_names:
                picked = [t for t in tool_names if t]
                if allowed_tools:
                    allowed_set = set(allowed_tools)
                    allowed_tools = [t for t in picked if t in allowed_set]
                else:
                    allowed_tools = picked

            if conversation_id:
                from app.models.conversation import Conversation
                conv = (
                    db.query(Conversation)
                    .filter(Conversation.id == conversation_id, Conversation.user_id == user_id)
                    .first()
                )
                if conv:
                    project_id = conv.project_id
                else:
                    # conversation_id doesn't belong to this user — ignore it (no cross-user leakage)
                    conversation_id = None

            # depth gating for sub-agents
            if depth >= MAX_SUBAGENT_DEPTH:
                allow_subagents = False

            # Memory context
            mem_context = memory_service.build_memory_context(
                db, user_id, conversation_id=conversation_id, project_id=project_id
            )
            if mem_context:
                system_prompt = f"{system_prompt}\n\n{mem_context}"

            # Multi-agent team roster: the coordinator can delegate to these saved agents.
            team: list[dict] = []
            if allow_subagents and team_agent_ids:
                members = (
                    db.query(Agent)
                    .filter(Agent.user_id == user_id, Agent.id.in_(team_agent_ids))
                    .all()
                )
                team = [
                    {"id": m.id, "name": m.name, "description": m.description}
                    for m in members if m.id != agent_id  # never let an agent delegate to itself
                ]
                if team:
                    roster = "\n".join(
                        f"- **{m['name']}**: {(m['description'] or 'specialised agent')}" for m in team
                    )
                    system_prompt = (
                        f"{system_prompt}\n\n## Your team\n"
                        f"You can delegate self-contained subtasks to these specialised agents using the "
                        f"`delegate` tool (give the agent name and a clear goal):\n{roster}"
                    )

            # Mode directives take precedence: appended last so they govern behaviour.
            if run_mode == "plan":
                system_prompt = f"{system_prompt}\n\n{PLAN_MODE_PROMPT}"
            elif run_mode == "goal":
                system_prompt = f"{system_prompt}\n\n{GOAL_MODE_PROMPT}"

            model, use_router = _resolve_model(db, user_id, model_pref)

            # Intelligent routing (Phase 10): if the agent's model is "auto", pick the
            # best concrete model + failover order from the catalog based on the goal.
            from app.services.routing_service import is_auto, choose_models
            model_order = None
            route_reason = None
            if is_auto(model_pref) or is_auto(model):
                if use_router:
                    profile_text = continue_message or goal
                    ranked = choose_models(
                        db, user_id,
                        [{"role": "user", "content": profile_text}],
                        has_image=False,
                        preferred_provider_id=provider_pref,
                    )
                    if ranked:
                        model_order = [(m, p) for (m, p, _r) in ranked]
                        model, _pid, route_reason = ranked[0]
                if is_auto(model):
                    # Couldn't resolve — fall back to the config default.
                    model = _safe_config_model(db, user_id) or ""

            registry = agent_tools.build_registry(
                db, user_id, allow_subagents=allow_subagents,
                allowed_tool_names=allowed_tools, team=team,
            )
            # tool_mode "off" (and plan mode, which only produces a plan) run with no tools.
            if tool_mode == "off" or run_mode == "plan":
                registry = {}
            openai_tools = agent_tools.to_openai_tools(registry) if registry else None

            ctx = agent_tools.ToolContext(
                session_factory=SessionLocal,
                user_id=user_id,
                conversation_id=conversation_id,
                project_id=project_id,
                allow_subagents=allow_subagents,
                depth=depth,
                team=team,
            )
            if allow_subagents:
                # Generic sub-agents inherit the *resolved* concrete model (not "auto"),
                # so routing happens once at the top level; delegated team agents still
                # use their own template model (handled inside the spawn fn).
                ctx.spawn_fn = _make_spawn_fn(user_id, run_id, model, provider_pref, conversation_id, depth)

            # Continuation: rebuild the prior transcript so the agent has context, and
            # resume the step index after the existing steps. Otherwise start fresh.
            seed_msgs: list[dict] = []
            start_index = 0
            if continue_message:
                existing = (
                    db.query(AgentStep)
                    .filter(AgentStep.run_id == run_id)
                    .order_by(AgentStep.step_index)
                    .all()
                )
                seed_msgs = _continuation_seed(goal, existing)
                start_index = (existing[-1].step_index + 1) if existing else 0
                # Record the user's follow-up as a step so the timeline shows the turn.
                _record_step(db, run_id, start_index, "thought", content=f"↳ Continue: {continue_message}")
                start_index += 1

            run.status = "running"
            run.error = None
            db.commit()
            yield {"type": "status", "status": "running", "run_id": str(run_id)}

            # Surface the routing decision in the timeline (auto mode only).
            if route_reason:
                _record_step(db, run_id, start_index, "thought",
                             content=f"↳ Routed to {model} ({route_reason})")
                start_index += 1
                yield {"type": "thought",
                       "content": f"↳ Routed to **{model}** ({route_reason})",
                       "index": start_index - 1}

            if continue_message:
                messages = (
                    [{"role": "system", "content": system_prompt}]
                    + seed_msgs
                    + [{"role": "user", "content": continue_message}]
                )
            else:
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": goal},
                ]

        except Exception as _setup_exc:  # noqa: BLE001
            _run = db.query(AgentRun).filter(AgentRun.id == run_id).first()
            if _run:
                _run.status = "failed"
                _run.error = str(_setup_exc)
                _run.updated_at = datetime.utcnow()
                db.commit()
            yield {"type": "error", "message": str(_setup_exc)}
            return

        step_index = start_index
        final_answer = None
        # Goal mode iterates longer and tolerates a couple of "stalled" turns before
        # accepting whatever the model last produced as the final answer.
        max_iter = MAX_GOAL_ITERATIONS if run_mode == "goal" else MAX_ITERATIONS
        no_progress = 0

        try:
            for iteration in range(max_iter):
                # "always" forces a tool call on the first iteration (when tools exist);
                # subsequent iterations use "auto" so the agent can produce a final answer.
                tool_choice = "required" if (tool_mode == "always" and iteration == 0 and openai_tools) else "auto"
                try:
                    message = await _complete(
                        db, user_id, model, messages, openai_tools, use_router, provider_pref, tool_choice, model_order
                    )
                except Exception as llm_exc:
                    error_text = str(llm_exc)
                    _record_step(db, run_id, step_index, "thought",
                                 content=f"⚠ LLM error: {error_text[:200]}. Retrying...")
                    yield {"type": "thought", "content": f"⚠ LLM error, retrying...", "index": step_index}
                    step_index += 1
                    await asyncio.sleep(1.0)
                    try:
                        message = await _complete(
                            db, user_id, model, messages, openai_tools, use_router, provider_pref, tool_choice, model_order
                        )
                    except Exception as retry_exc:
                        raise RuntimeError(f"All providers failed after retry: {retry_exc}") from retry_exc
                tool_calls = message.get("tool_calls") or []
                # Backfill missing/duplicate tool_call ids so the assistant message
                # and its tool results reference the same valid id (strict providers
                # 400 otherwise — common with the GitHub MCP's parallel calls).
                agent_tools.ensure_tool_call_ids(tool_calls)
                content = message.get("content")

                # Append assistant message to the running transcript
                assistant_msg = {"role": "assistant", "content": content or ""}
                if tool_calls:
                    assistant_msg["tool_calls"] = tool_calls
                messages.append(assistant_msg)

                if content and content.strip():
                    _record_step(db, run_id, step_index, "thought", content=content)
                    yield {"type": "thought", "content": content, "index": step_index}
                    step_index += 1

                if not tool_calls:
                    # No tool calls means the model produced prose.
                    if content and content.strip():
                        stripped = content.strip()
                        if run_mode == "goal":
                            # In autonomous goal mode, only finish on the explicit DONE
                            # token. Otherwise nudge the agent to keep working — but if it
                            # stalls (prose, no progress) twice in a row, accept it as final
                            # so we don't burn the whole iteration budget.
                            if stripped.startswith(DONE_TOKEN):
                                final_answer = stripped[len(DONE_TOKEN):].strip() or stripped
                                break
                            no_progress += 1
                            if no_progress >= 2 or iteration >= max_iter - 1:
                                final_answer = stripped
                                break
                            messages.append({"role": "user", "content": GOAL_CONTINUE_PROMPT})
                            continue
                        final_answer = stripped
                        break
                    # Empty content with no tool calls: nudge once for a real answer,
                    # then give up rather than recording a blank result.
                    if iteration < max_iter - 1:
                        messages.append({
                            "role": "user",
                            "content": "Please provide your final answer now.",
                        })
                        continue
                    final_answer = "(the model returned an empty response)"
                    break

                # Execute tool calls (concurrently when there is more than one)
                async def _run_one(call):
                    fn = call.get("function", {})
                    name = fn.get("name", "")
                    raw_args = fn.get("arguments")
                    args = agent_tools.parse_tool_arguments(raw_args)
                    tool = registry.get(name)
                    if not tool:
                        return call, name, args, f"Error: unknown tool '{name}'"
                    try:
                        output = await tool.handler(ctx, args)
                    except Exception as exc:  # noqa: BLE001
                        output = f"Error running tool '{name}': {exc}"
                    return call, name, args, output

                # The agent took a concrete action this turn — reset the stall counter.
                no_progress = 0
                for call in tool_calls:
                    fn = call.get("function", {})
                    name = fn.get("name", "")
                    args = agent_tools.parse_tool_arguments(fn.get("arguments"))
                    _record_step(db, run_id, step_index, "tool_call", tool_name=name, tool_input=args)
                    yield {"type": "tool_call", "tool": name, "input": args, "index": step_index}
                    step_index += 1

                results = await asyncio.gather(*[_run_one(c) for c in tool_calls])

                for call, name, args, output in results:
                    output_str = output if isinstance(output, str) else str(output)
                    _record_step(
                        db, run_id, step_index, "tool_result",
                        tool_name=name, tool_input=args, tool_output=output_str,
                    )
                    yield {"type": "tool_result", "tool": name, "output": output_str, "index": step_index}
                    step_index += 1
                    messages.append({
                        "role": "tool",
                        "tool_call_id": call.get("id", ""),
                        "name": name,
                        "content": output_str[:8000],
                    })
            else:
                # ran out of iterations without a final answer
                if final_answer is None:
                    final_answer = "(stopped: reached maximum number of steps)"

            run = db.query(AgentRun).filter(AgentRun.id == run_id).first()
            run.status = "completed"
            run.result = final_answer
            run.updated_at = datetime.utcnow()
            _record_step(db, run_id, step_index, "final", content=final_answer)
            db.commit()
            yield {"type": "final", "content": final_answer, "index": step_index}
            yield {"type": "done", "run_id": str(run_id)}

        except Exception as exc:  # noqa: BLE001
            run = db.query(AgentRun).filter(AgentRun.id == run_id).first()
            if run:
                run.status = "failed"
                run.error = str(exc)
                run.updated_at = datetime.utcnow()
                _record_step(db, run_id, step_index, "error", content=str(exc))
                db.commit()
            yield {"type": "error", "message": str(exc)}


def _continuation_seed(goal: str, steps: list) -> list[dict]:
    """Rebuild a compact prior-transcript for continuing a run.

    We collapse the previous run into [user goal] + [assistant recap] rather than
    replaying raw tool_calls — this keeps the model fully in context while avoiding
    fragile tool_call/tool_result id pairing that strict providers reject."""
    parts: list[str] = []
    final: str | None = None
    for s in steps:
        if s.type == "final" and s.content:
            final = s.content
        elif s.type == "thought" and s.content:
            parts.append(s.content.strip())
        elif s.type == "tool_call":
            try:
                inp = json.dumps(s.tool_input)[:300]
            except Exception:  # noqa: BLE001
                inp = str(s.tool_input)[:300]
            parts.append(f"[used tool `{s.tool_name}` with input {inp}]")
        elif s.type == "tool_result" and s.tool_output:
            parts.append(f"[`{s.tool_name}` returned: {s.tool_output[:500]}]")
    recap = "\n".join(p for p in parts if p).strip()
    assistant_text = ""
    if recap:
        assistant_text += f"Earlier in this run:\n{recap}\n\n"
    if final:
        assistant_text += final
    return [
        {"role": "user", "content": goal},
        {"role": "assistant", "content": assistant_text or "(no prior output)"},
    ]


def _make_spawn_fn(parent_user_id, parent_run_id, model_pref, provider_pref, conversation_id, parent_depth):
    """Return an async spawn function that runs a sub-agent to completion and returns its result text.

    `agent_id` (optional) selects a saved agent template for the sub-agent so it runs with that
    agent's own system prompt / skill / model — this is how the Orchestrator delegates to team members."""
    async def spawn(role: str, goal: str, agent_id: UUID | None = None) -> str:
        # A delegated team agent should run with its OWN model/provider (resolved from its
        # template); a generic worker inherits the coordinator's model. So only pass the
        # parent's model/provider when no specific agent template is selected.
        sub_model = None if agent_id else model_pref
        sub_provider = None if agent_id else (UUID(provider_pref) if provider_pref else None)
        with SessionLocal() as db:
            sub = create_run(
                db,
                user_id=parent_user_id,
                goal=goal,
                agent_id=agent_id,
                model=sub_model,
                provider_id=sub_provider,
                conversation_id=conversation_id,
                parent_run_id=parent_run_id,
                role=role,
            )
            sub_id = sub.id
        # Drain the sub-agent run; we only need its final result. Sub-agents always run
        # in "auto" mode (a single focused pass) regardless of the parent's mode.
        final = ""
        async for evt in run_agent(sub_id, parent_user_id):
            if evt.get("type") == "final":
                final = evt.get("content", "")
            elif evt.get("type") == "error":
                final = f"[sub-agent error] {evt.get('message')}"
        return f"Sub-agent '{role}' result:\n{final}"

    return spawn


async def run_subagents_parallel(specs: list[tuple[str, str]], spawn_fn) -> list[str]:
    return await asyncio.gather(*[spawn_fn(role, goal) for role, goal in specs])
