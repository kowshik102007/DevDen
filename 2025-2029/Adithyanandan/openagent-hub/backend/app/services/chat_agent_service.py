"""
Agentic chat: a streaming chat turn that can call tools (built-ins + MCP) and
apply a skill, inline, while still streaming assistant text to the user.

Used by /api/chat/stream when `use_tools` is on. It reuses the agent tool
registry so anything installed for agents (incl. MCP servers) is available in
chat too. The loop is:

    [stream assistant text] → if the model requested tools, run them, feed
    results back, and stream the next turn → repeat until a plain text answer.

Tool activity is surfaced to the client as SSE events (tool_call / tool_result)
interleaved with normal `chunk` events, so the UI can show what's happening.
"""
import json
import re
from uuid import UUID

import httpx

# Strips hallucinated OpenAI Assistants-style citation markers, e.g. 【3†L1-L3】
_CITATION_RE = re.compile(r'【\d+†[^\】]*】')

from app.core.database import SessionLocal
from app.core import crypto
from app.core.mcp_client import MCPSessionPool
from app.core.provider import stream_chat
from app.services import agent_tools
from app.services.provider_service import has_enabled_providers
from app.services.router_service import _ordered_providers, _is_circuit_open, _record_success, _record_failure, _resolve_attempts

MAX_TOOL_ROUNDS = 25


async def _stream_one_turn(provider, model, messages, tools, on_event, tool_choice="auto"):
    """Stream a single assistant turn from one provider.

    Yields nothing; calls on_event for chunks. Returns the assistant message dict
    reconstructed from the stream (content + any tool_calls). Raises on HTTP error
    so the caller can fail over.
    """
    headers = {"Content-Type": "application/json"}
    _key = crypto.decrypt(getattr(provider, "api_key", "") or "")
    if _key and _key.strip():
        headers["Authorization"] = f"Bearer {_key.strip()}"
    payload = {"model": model, "messages": messages, "stream": True, "temperature": 0.5}
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = tool_choice

    content_parts: list[str] = []
    # tool_calls accumulate across deltas keyed by index
    tool_calls: dict[int, dict] = {}

    async with httpx.AsyncClient(timeout=180.0) as client:
        async with client.stream("POST", f"{provider.base_url}/chat/completions",
                                 headers=headers, json=payload) as response:
            if response.status_code >= 400:
                error_body = ""
                async for chunk in response.aiter_bytes():
                    error_body += chunk.decode(errors="replace")
                    if len(error_body) > 500:
                        break
                raise httpx.HTTPStatusError(
                    f"HTTP {response.status_code}: {error_body[:500]}",
                    request=response.request,
                    response=response,
                )
            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:]
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                    delta = chunk["choices"][0].get("delta", {})
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue

                if content := delta.get("content"):
                    content = _CITATION_RE.sub("", content)
                    if content:
                        content_parts.append(content)
                        await on_event({"type": "chunk", "content": content})

                for tc in delta.get("tool_calls", []) or []:
                    idx = tc.get("index", 0)
                    slot = tool_calls.setdefault(idx, {"id": "", "type": "function", "function": {"name": "", "arguments": ""}})
                    if tc.get("id"):
                        slot["id"] = tc["id"]
                    fn = tc.get("function", {})
                    if fn.get("name"):
                        slot["function"]["name"] = fn["name"]
                    if fn.get("arguments"):
                        slot["function"]["arguments"] += fn["arguments"]

    message: dict = {"role": "assistant", "content": "".join(content_parts)}
    if tool_calls:
        message["tool_calls"] = [tool_calls[i] for i in sorted(tool_calls)]
    return message


async def _stream_turn_with_failover(db, user_id, model, messages, tools, preferred_provider_id, on_event, tool_choice="auto", model_order=None):
    """Stream one assistant turn, failing over across enabled providers.

    When `model_order` (intelligent-routing pinned (model, provider) pairs) is
    given, attempts follow that order; otherwise one model across priority-ordered
    providers."""
    attempts = _resolve_attempts(db, user_id, model, preferred_provider_id, model_order)
    if not attempts:
        raise RuntimeError("No enabled providers configured.")
    last_error = "All providers failed."
    buffered: list[dict] = []
    had_tool_error = False

    for attempt_model, provider in attempts:
        if _is_circuit_open(provider):
            continue
        buffered.clear()

        async def _buffer_event(evt):
            buffered.append(evt)

        try:
            result = await _stream_one_turn(provider, attempt_model, messages, tools, _buffer_event, tool_choice)
            _record_success(db, provider)
            for evt in buffered:
                await on_event(evt)
            return result
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            try:
                body_text = exc.response.text[:300] if exc.response.is_stream_consumed or not exc.response.is_closed else str(exc)[:300]
            except Exception:
                body_text = str(exc)[:300]
            error_msg = f"Provider '{provider.name}' HTTP {status}: {body_text}"
            _record_failure(db, provider, error_msg, status)
            last_error = error_msg
            if status == 400 and tools:
                bl = body_text.lower()
                if any(kw in bl for kw in ("tool", "function", "not support", "unsupported")):
                    had_tool_error = True
        except Exception as exc:  # noqa: BLE001
            error_msg = f"Provider '{provider.name}' error: {exc}"
            _record_failure(db, provider, error_msg)
            last_error = error_msg

    if had_tool_error and tools:
        for attempt_model, provider in attempts:
            if _is_circuit_open(provider):
                continue
            buffered.clear()

            async def _buffer_retry(evt):
                buffered.append(evt)

            try:
                result = await _stream_one_turn(provider, attempt_model, messages, None, _buffer_retry, "auto")
                _record_success(db, provider)
                for evt in buffered:
                    await on_event(evt)
                return result
            except Exception:
                continue

    raise RuntimeError(last_error)


async def stream_chat_with_tools(
    user_id: UUID,
    base_url: str,
    api_key: str,
    model: str,
    messages: list[dict],
    preferred_provider_id: str | None = None,
    allowed_tool_names: list[str] | None = None,
    tool_mode: str = "auto",
    model_order: list[tuple[str, str]] | None = None,
):
    """Async generator yielding SSE event dicts: chunk / tool_call / tool_result / error.

    `messages` should already include the system prompt and history. Tools are built
    from the user's registry (built-ins + MCP), optionally restricted by a skill's
    allowed_tool_names. Sub-agents are intentionally NOT enabled in chat.

    `tool_mode`:
      - "auto"   : tools offered; the model calls them when it judges fit (default).
      - "always" : force a tool call on the first turn, then auto.
    """
    pool = MCPSessionPool()
    try:
        with SessionLocal() as db:
            use_router = has_enabled_providers(db, user_id)
            registry = agent_tools.build_registry(
                db, user_id, allow_subagents=False, allowed_tool_names=allowed_tool_names
            )
            tools = agent_tools.to_openai_tools(registry) if registry else None

            ctx = agent_tools.ToolContext(
                session_factory=SessionLocal,
                user_id=user_id,
                conversation_id=None,
                project_id=None,
                allow_subagents=False,
                session_pool=pool,
            )

            # Buffer of events produced mid-turn (the streamer pushes here).
            pending: list[dict] = []

            async def on_event(evt):
                pending.append(evt)

            working = list(messages)

            for _round in range(MAX_TOOL_ROUNDS):
                pending.clear()
                # "always" forces a tool call on the very first round; subsequent rounds
                # use "auto" so the model can produce a final answer after tool results.
                tool_choice = "required" if (tool_mode == "always" and _round == 0 and tools) else "auto"
                if use_router:
                    message = await _stream_turn_with_failover(
                        db, user_id, model, working, tools, preferred_provider_id, on_event, tool_choice, model_order
                    )
                else:
                    # single-provider: wrap config into a faux provider object
                    class _P:
                        pass
                    p = _P()
                    p.base_url, p.api_key, p.name, p.id = base_url, api_key, "Default", "default"
                    message = await _stream_one_turn(p, model, working, tools, on_event, tool_choice)

                # Flush streamed chunks collected during the turn.
                for evt in pending:
                    yield evt

                tool_calls = message.get("tool_calls") or []
                # Backfill any missing/duplicate tool_call ids before they are sent back
                # to the provider, otherwise strict providers 400 on the next turn.
                agent_tools.ensure_tool_call_ids(tool_calls)
                working.append(message)

                if not tool_calls:
                    return  # plain text answer streamed; done

                # Execute tool calls and feed results back, then loop for the next turn.
                for call in tool_calls:
                    fn = call.get("function", {})
                    name = fn.get("name", "")
                    args = agent_tools.parse_tool_arguments(fn.get("arguments"))
                    yield {"type": "tool_call", "tool": name, "input": args}
                    tool = registry.get(name)
                    if not tool:
                        output = f"Error: unknown tool '{name}'"
                    else:
                        try:
                            output = await tool.handler(ctx, args)
                        except Exception as exc:  # noqa: BLE001
                            output = f"Error running tool '{name}': {exc}"
                    output_str = output if isinstance(output, str) else str(output)
                    yield {"type": "tool_result", "tool": name, "output": output_str}
                    working.append({
                        "role": "tool",
                        "tool_call_id": call.get("id", ""),
                        "name": name,
                        "content": output_str[:8000],
                    })

            # Hit the round cap; emit a gentle note.
            yield {"type": "chunk", "content": "\n\n_(stopped after using tools several times)_"}
    finally:
        await pool.close_all()
