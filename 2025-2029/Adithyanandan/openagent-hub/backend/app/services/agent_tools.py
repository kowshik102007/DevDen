"""
Tool registry for the agent runtime.

A *tool* is an OpenAI-compatible function schema plus an async handler. Tools come
from three sources:

  1. Built-ins        — safe, self-contained (calculate, current_time, memory R/W)
  2. MCP servers      — discovered dynamically from the user's enabled MCP servers
  3. spawn_agent      — only for coordinator agents (multi-agent), injected by the runtime

Handlers are async `(ctx: ToolContext, args: dict) -> str`. DB-touching handlers open
their own session via `ctx.session_factory` so a turn's tool calls can run concurrently.
"""
import ast
import json
import operator
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Optional
from uuid import UUID

from app.core.mcp_client import mcp_call_tool, MCPError, MCPSessionPool
from app.models.mcp_server import MCPServer
from app.services import memory_service

ToolHandler = Callable[["ToolContext", dict], Awaitable[str]]


@dataclass
class ToolContext:
    session_factory: Any
    user_id: UUID
    conversation_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    allow_subagents: bool = False
    depth: int = 0
    # spawn_fn(role, goal, agent_id=None) -> result text. agent_id selects a saved
    # agent template for the sub-agent; None spawns a generic worker.
    spawn_fn: Optional[Callable[..., Awaitable[str]]] = None
    # Roster of saved agents the coordinator may delegate to (multi-agent teams).
    team: list[dict] = field(default_factory=list)
    # Persistent MCP session pool — reuses processes across tool calls in one turn.
    session_pool: Optional[MCPSessionPool] = None


@dataclass
class ToolDef:
    name: str
    description: str
    parameters: dict
    handler: ToolHandler

    def to_openai(self) -> dict:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


# --------------------------------------------------------------------------- #
# Safe arithmetic evaluator (for `calculate`)                                  #
# --------------------------------------------------------------------------- #

_ALLOWED_OPS = {
    ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
    ast.Div: operator.truediv, ast.FloorDiv: operator.floordiv, ast.Mod: operator.mod,
    ast.Pow: operator.pow, ast.USub: operator.neg, ast.UAdd: operator.pos,
}


def _safe_eval(node: ast.AST) -> float:
    if isinstance(node, ast.Expression):
        return _safe_eval(node.body)
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)):
            return node.value
        raise ValueError("only numeric constants allowed")
    if isinstance(node, ast.BinOp) and type(node.op) in _ALLOWED_OPS:
        return _ALLOWED_OPS[type(node.op)](_safe_eval(node.left), _safe_eval(node.right))
    if isinstance(node, ast.UnaryOp) and type(node.op) in _ALLOWED_OPS:
        return _ALLOWED_OPS[type(node.op)](_safe_eval(node.operand))
    raise ValueError("unsupported expression")


# --------------------------------------------------------------------------- #
# Built-in tool handlers                                                       #
# --------------------------------------------------------------------------- #

async def _h_calculate(ctx: ToolContext, args: dict) -> str:
    expr = str(args.get("expression", "")).strip()
    if not expr:
        return "Error: expression is required."
    try:
        result = _safe_eval(ast.parse(expr, mode="eval"))
        return f"{expr} = {result}"
    except Exception as exc:  # noqa: BLE001
        return f"Error evaluating '{expr}': {exc}"


async def _h_current_time(ctx: ToolContext, args: dict) -> str:
    return datetime.now(timezone.utc).isoformat()


async def _h_web_search(ctx: ToolContext, args: dict) -> str:
    import re
    from urllib.parse import parse_qs, urlparse, unquote
    import httpx as _httpx
    query = str(args.get("query", "")).strip()
    if not query:
        return "Error: query is required."
    max_results = min(int(args.get("max_results", 5)), 10)
    try:
        async with _httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            resp = await client.get(
                "https://lite.duckduckgo.com/lite/",
                params={"q": query},
                headers={"User-Agent": "Mozilla/5.0 (compatible; OpenAgentHub/1.0)"},
            )
            html = resp.text

        def _strip(t: str) -> str:
            t = re.sub(r"<[^>]+>", "", t)
            for ent, ch in [("&amp;", "&"), ("&quot;", '"'), ("&#x27;", "'"), ("&lt;", "<"), ("&gt;", ">")]:
                t = t.replace(ent, ch)
            return t.strip()

        def _extract_url(href: str) -> str:
            href = href.replace("&amp;", "&")
            qs = parse_qs(urlparse(href).query)
            if "uddg" in qs:
                return unquote(qs["uddg"][0])
            return href

        # DDG lite: href uses double quotes, class uses single quotes
        link_matches = re.findall(r'href="([^"]+)"[^>]*class=\'result-link\'[^>]*>([^<]+)<', html)
        snippets_raw = re.findall(r"class='result-snippet'[^>]*>(.*?)</td>", html, re.DOTALL)

        results = []
        for i, (href, title) in enumerate(link_matches[:max_results]):
            url = _extract_url(href)
            snippet = _strip(snippets_raw[i]) if i < len(snippets_raw) else ""
            results.append(f"{i+1}. **{_strip(title)}**\n   {url}\n   {snippet}")

        if not results:
            return f"No results found for '{query}'."
        return (
            f"[LIVE WEB SEARCH — {datetime.now(timezone.utc).strftime('%Y-%m-%d')}] "
            f"These results are current and authoritative. Base your answer on them, not on training data.\n\n"
            f"Query: {query}\n\n" + "\n\n".join(results)
        )
    except Exception as exc:
        return f"Search error: {exc}"


async def _h_web_fetch(ctx: ToolContext, args: dict) -> str:
    import httpx as _httpx
    url = str(args.get("url", "")).strip()
    if not url:
        return "Error: url is required."
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    try:
        async with _httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(
                f"https://r.jina.ai/{url}",
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; OpenAgentHub/1.0)",
                    "Accept": "text/plain, text/markdown",
                    "X-Return-Format": "markdown",
                },
            )
            resp.raise_for_status()
            content = resp.text
        max_chars = int(args.get("max_chars", 8000))
        if len(content) > max_chars:
            content = content[:max_chars] + f"\n\n[...truncated at {max_chars} chars]"
        return content
    except Exception as exc:
        return f"Fetch error: {exc}"


async def _h_remember(ctx: ToolContext, args: dict) -> str:
    content = str(args.get("content", "")).strip()
    if not content:
        return "Error: content is required."
    scope = str(args.get("scope", "user"))
    if scope not in memory_service.VALID_SCOPES:
        scope = "user"
    with ctx.session_factory() as db:
        try:
            memory_service.create_memory(
                db,
                ctx.user_id,
                content,
                scope=scope if scope == "user" else ("conversation" if ctx.conversation_id else "user"),
                conversation_id=ctx.conversation_id,
                project_id=ctx.project_id,
                source="agent",
            )
        except Exception as exc:  # noqa: BLE001
            return f"Error saving memory: {exc}"
    return f"Saved to {scope} memory: {content}"


async def _h_recall(ctx: ToolContext, args: dict) -> str:
    query = str(args.get("query", "")).strip()
    with ctx.session_factory() as db:
        results = memory_service.search_memories(db, ctx.user_id, query, limit=10)
        if results:
            return "\n".join(f"- [{m.scope}] {m.content}" for m in results)
        # Fall back to recent memories so the agent still has context to reason over.
        recent = memory_service.list_memories(db, ctx.user_id)[:10]
    if not recent:
        return "No memories stored yet."
    listed = "\n".join(f"- [{m.scope}] {m.content}" for m in recent)
    return f"No direct keyword match for '{query}'. Most recent memories:\n{listed}"


BUILTIN_TOOLS: dict[str, ToolDef] = {
    "web_search": ToolDef(
        name="web_search",
        description="Search the web using DuckDuckGo. Returns titles, URLs, and snippets for the top results. Use for current events, facts, or any information that may not be in training data.",
        parameters={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "The search query"},
                "max_results": {"type": "integer", "description": "Number of results to return (1-10, default 5)", "default": 5},
            },
            "required": ["query"],
        },
        handler=_h_web_search,
    ),
    "web_fetch": ToolDef(
        name="web_fetch",
        description="Fetch a URL and return its content as clean markdown. Handles JavaScript-rendered pages. Use to read articles, docs, or any web page.",
        parameters={
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "The URL to fetch"},
                "max_chars": {"type": "integer", "description": "Max characters to return (default 8000)", "default": 8000},
            },
            "required": ["url"],
        },
        handler=_h_web_fetch,
    ),
    "calculate": ToolDef(
        name="calculate",
        description="Evaluate a basic arithmetic expression (e.g. '2 * (3 + 4)'). Use for any math.",
        parameters={
            "type": "object",
            "properties": {"expression": {"type": "string", "description": "Arithmetic expression"}},
            "required": ["expression"],
        },
        handler=_h_calculate,
    ),
    "current_time": ToolDef(
        name="current_time",
        description="Get the current date and time in UTC (ISO-8601).",
        parameters={"type": "object", "properties": {}},
        handler=_h_current_time,
    ),
    "remember": ToolDef(
        name="remember",
        description="Save an important fact to persistent memory so it is available in future conversations.",
        parameters={
            "type": "object",
            "properties": {
                "content": {"type": "string", "description": "The fact to remember"},
                "scope": {"type": "string", "enum": ["user", "conversation"], "default": "user"},
            },
            "required": ["content"],
        },
        handler=_h_remember,
    ),
    "recall": ToolDef(
        name="recall",
        description="Search the user's saved memories for relevant facts.",
        parameters={
            "type": "object",
            "properties": {"query": {"type": "string", "description": "What to search for"}},
            "required": ["query"],
        },
        handler=_h_recall,
    ),
}


# --------------------------------------------------------------------------- #
# MCP tools                                                                    #
# --------------------------------------------------------------------------- #

def _make_mcp_handler(server: MCPServer, tool_name: str) -> ToolHandler:
    command = server.command
    args = list(server.args or [])
    env = dict(server.env or {})
    auto_approve = server.auto_approve

    async def handler(ctx: ToolContext, call_args: dict) -> str:
        if not auto_approve:
            return (
                f"[blocked] The MCP server '{server.name}' requires manual approval for its tools. "
                "Enable auto-approve in MCP settings to allow this call."
            )
        try:
            if ctx.session_pool is not None:
                return await ctx.session_pool.call_tool(command, tool_name, call_args, args=args, env=env)
            return await mcp_call_tool(command, tool_name, call_args, args=args, env=env)
        except MCPError as exc:
            return f"[mcp error] {exc}"
        except Exception as exc:  # noqa: BLE001
            return f"[mcp error] {exc}"

    return handler


def _mcp_tool_name(server_name: str, tool_name: str) -> str:
    """Namespace MCP tools to avoid collisions: mcp__<server>__<tool>."""
    safe_server = "".join(c if c.isalnum() else "_" for c in server_name)[:24]
    safe_tool = "".join(c if (c.isalnum() or c == "_") else "_" for c in tool_name)
    return f"mcp__{safe_server}__{safe_tool}"


def get_mcp_tools(db, user_id: UUID) -> dict[str, ToolDef]:
    """Build ToolDefs from the user's enabled MCP servers, using each server's cached tool list."""
    servers = (
        db.query(MCPServer)
        .filter(MCPServer.user_id == user_id, MCPServer.enabled == True)
        .all()
    )
    tools: dict[str, ToolDef] = {}
    for server in servers:
        for tool in server.tools_cache or []:
            raw_name = tool.get("name")
            if not raw_name:
                continue
            namespaced = _mcp_tool_name(server.name, raw_name)
            description = tool.get("description") or f"{raw_name} (via {server.name})"
            parameters = tool.get("inputSchema") or {"type": "object", "properties": {}}
            tools[namespaced] = ToolDef(
                name=namespaced,
                description=description[:1000],
                parameters=parameters,
                handler=_make_mcp_handler(server, raw_name),
            )
    return tools


# --------------------------------------------------------------------------- #
# spawn_agent (multi-agent)                                                    #
# --------------------------------------------------------------------------- #

def _spawn_tool() -> ToolDef:
    async def handler(ctx: ToolContext, args: dict) -> str:
        if not ctx.spawn_fn:
            return "Error: sub-agents are not enabled for this run."
        role = str(args.get("role", "Worker")).strip() or "Worker"
        goal = str(args.get("goal", "")).strip()
        if not goal:
            return "Error: goal is required to spawn a sub-agent."
        return await ctx.spawn_fn(role, goal)

    return ToolDef(
        name="spawn_agent",
        description=(
            "Delegate a focused subtask to a generic specialised sub-agent and get its result back. "
            "Use this to parallelise independent pieces of work (research, coding, analysis) when no "
            "saved team member fits. Provide a clear role and a self-contained goal."
        ),
        parameters={
            "type": "object",
            "properties": {
                "role": {"type": "string", "description": "Role/name for the sub-agent, e.g. 'Research Agent'"},
                "goal": {"type": "string", "description": "A self-contained task for the sub-agent to complete"},
            },
            "required": ["role", "goal"],
        },
        handler=handler,
    )


def _delegate_tool(team: list[dict]) -> ToolDef:
    """Tool that delegates a subtask to a SPECIFIC saved agent from the team.

    `team` is a list of {"id", "name", "description"}. The model picks an agent by
    name; we run that agent's template (its own system prompt, skill, model) as a
    sub-agent and return its result."""
    by_name = {str(a["name"]): a for a in team}

    async def handler(ctx: ToolContext, args: dict) -> str:
        if not ctx.spawn_fn:
            return "Error: sub-agents are not enabled for this run."
        name = str(args.get("agent", "")).strip()
        goal = str(args.get("goal", "")).strip()
        if not goal:
            return "Error: goal is required to delegate to an agent."
        member = by_name.get(name)
        if not member:
            # tolerate case / partial mismatches
            member = next((a for a in team if str(a["name"]).lower() == name.lower()), None)
        if not member:
            available = ", ".join(by_name.keys()) or "(none)"
            return f"Error: no team agent named '{name}'. Available agents: {available}."
        return await ctx.spawn_fn(member["name"], goal, agent_id=member["id"])

    roster = "\n".join(
        f"  - {a['name']}: {(a.get('description') or 'specialised agent').strip()}" for a in team
    )
    return ToolDef(
        name="delegate",
        description=(
            "Delegate a self-contained subtask to one of your specialised TEAM agents and get its "
            "result back. Each team agent has its own expertise — pick the best fit. Delegate "
            "independent subtasks so they can be combined into the final result.\n"
            f"Available team agents:\n{roster}"
        ),
        parameters={
            "type": "object",
            "properties": {
                "agent": {
                    "type": "string",
                    "description": "Name of the team agent to delegate to",
                    "enum": [str(a["name"]) for a in team] or None,
                },
                "goal": {"type": "string", "description": "A self-contained task for that agent to complete"},
            },
            "required": ["agent", "goal"],
        },
        handler=handler,
    )


# --------------------------------------------------------------------------- #
# Registry assembly                                                            #
# --------------------------------------------------------------------------- #

def build_registry(
    db,
    user_id: UUID,
    allow_subagents: bool = False,
    allowed_tool_names: list[str] | None = None,
    team: list[dict] | None = None,
) -> dict[str, ToolDef]:
    """Assemble the full tool registry for a run.

    `allowed_tool_names` (from a skill) optionally restricts the built-in/MCP tools;
    spawn_agent/delegate are governed solely by `allow_subagents`. When `team` is
    provided, a `delegate` tool is added so the coordinator can route subtasks to
    those specific saved agents."""
    registry: dict[str, ToolDef] = {}
    registry.update(BUILTIN_TOOLS)
    registry.update(get_mcp_tools(db, user_id))

    if allowed_tool_names:
        allowed = set(allowed_tool_names)
        registry = {k: v for k, v in registry.items() if k in allowed}

    if allow_subagents:
        spawn = _spawn_tool()
        registry[spawn.name] = spawn
        if team:
            delegate = _delegate_tool(team)
            registry[delegate.name] = delegate

    return registry


def to_openai_tools(registry: dict[str, ToolDef]) -> list[dict]:
    return [t.to_openai() for t in registry.values()]


def parse_tool_arguments(raw: Any) -> dict:
    if isinstance(raw, dict):
        return raw
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except (json.JSONDecodeError, TypeError):
        return {}


def ensure_tool_call_ids(tool_calls: list[dict]) -> list[dict]:
    """Normalize a model's tool_calls so the follow-up request can never be rejected.

    This guards against the ways flaky OpenAI-compatible providers (especially those
    serving open-source models) emit malformed tool_calls — for ANY tool, built-in or
    MCP, not just GitHub. On the next turn each `tool` result is paired with its
    `tool_call_id`; if ids are blank/duplicated, or the function shape is malformed,
    strict providers 400 on the whole request and the turn errors out. We make the
    list well-formed in place:

      * every call gets a unique, non-empty `id` (backfilled as call_<i>)
      * `type` defaults to "function"
      * `function.arguments` is coerced to a JSON string ("{}" when missing), since
        some providers send it as null/dict and others reject anything but a string
    """
    seen: set[str] = set()
    for i, call in enumerate(tool_calls or []):
        if not isinstance(call, dict):
            continue
        cid = (call.get("id") or "").strip()
        if not cid or cid in seen:
            cid = f"call_{i}"
            while cid in seen:
                cid = f"{cid}_"
            call["id"] = cid
        seen.add(call["id"])

        call.setdefault("type", "function")
        fn = call.get("function")
        if not isinstance(fn, dict):
            fn = {}
            call["function"] = fn
        args = fn.get("arguments")
        if args is None:
            fn["arguments"] = "{}"
        elif isinstance(args, dict):
            fn["arguments"] = json.dumps(args)
        elif not isinstance(args, str):
            fn["arguments"] = str(args)
    return tool_calls
