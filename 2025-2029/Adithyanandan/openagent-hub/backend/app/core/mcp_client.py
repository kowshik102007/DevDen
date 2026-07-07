"""
Minimal MCP (Model Context Protocol) client.

Speaks JSON-RPC 2.0 over a stdio transport (newline-delimited JSON), which is
the standard MCP stdio framing. No third-party dependencies — uses asyncio
subprocesses from the standard library.

Supports the handshake (`initialize` + `notifications/initialized`), `tools/list`,
and `tools/call`. A short-lived session is spawned per operation, which keeps the
implementation robust (no long-lived process state to manage) at the cost of a
process spawn per call — fine for the local, low-frequency tool calls agents make.
"""
import asyncio
import json
import os
from typing import Any

PROTOCOL_VERSION = "2024-11-05"
_CLIENT_INFO = {"name": "openagent-hub", "version": "0.1.0"}


class MCPError(Exception):
    pass


class MCPSession:
    """A single stdio MCP session: spawn → initialize → operate → close."""

    def __init__(self, command: str, args: list[str] | None = None, env: dict | None = None, cwd: str | None = None):
        self.command = command
        self.args = args or []
        self.env = env or {}
        self.cwd = cwd
        self._proc: asyncio.subprocess.Process | None = None
        self._id = 0

    async def __aenter__(self) -> "MCPSession":
        full_env = {**os.environ, **{str(k): str(v) for k, v in self.env.items()}}
        try:
            self._proc = await asyncio.create_subprocess_exec(
                self.command,
                *self.args,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=full_env,
                cwd=self.cwd,
                limit=16 * 1024 * 1024,  # 16 MB — default 64 KB overflows on large pages
            )
        except FileNotFoundError as exc:
            raise MCPError(f"MCP command not found: {self.command}") from exc
        await self._initialize()
        return self

    async def __aexit__(self, *exc) -> None:
        await self.close()

    def _next_id(self) -> int:
        self._id += 1
        return self._id

    async def _send(self, payload: dict) -> None:
        assert self._proc and self._proc.stdin
        line = json.dumps(payload) + "\n"
        self._proc.stdin.write(line.encode("utf-8"))
        await self._proc.stdin.drain()

    async def _read_message(self, timeout: float | None = 30.0) -> dict:
        assert self._proc and self._proc.stdout
        while True:
            try:
                if timeout is None:
                    raw = await self._proc.stdout.readline()
                else:
                    raw = await asyncio.wait_for(self._proc.stdout.readline(), timeout=timeout)
            except asyncio.TimeoutError:
                raise MCPError("Timed out waiting for MCP server response")
            if not raw:
                stderr = b""
                if self._proc.stderr:
                    try:
                        stderr = await asyncio.wait_for(self._proc.stderr.read(2000), timeout=1.0)
                    except asyncio.TimeoutError:
                        pass
                detail = stderr.decode("utf-8", "replace").strip()
                raise MCPError(f"MCP server closed the connection. {detail}".strip())
            line = raw.decode("utf-8", "replace").strip()
            if not line:
                continue
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                # Servers may emit non-protocol log lines on stdout; skip them.
                continue

    async def _request(self, method: str, params: dict | None = None, timeout: float = 30.0) -> Any:
        req_id = self._next_id()
        await self._send({"jsonrpc": "2.0", "id": req_id, "method": method, "params": params or {}})
        # Read until we see the response with our id (skip unrelated notifications).
        # Guard against a misbehaving server flooding notifications and never replying.
        skipped = 0
        while True:
            msg = await self._read_message(timeout=timeout)
            if msg.get("id") != req_id:
                skipped += 1
                if skipped > 200:
                    raise MCPError("MCP server sent too many messages without a matching response")
                continue
            if "error" in msg:
                err = msg["error"]
                raise MCPError(f"MCP error {err.get('code')}: {err.get('message')}")
            return msg.get("result")

    async def _notify(self, method: str, params: dict | None = None) -> None:
        await self._send({"jsonrpc": "2.0", "method": method, "params": params or {}})

    async def _initialize(self) -> dict:
        # First-run npx/uvx servers download their package before responding, so the
        # handshake can take a while. Give initialize a generous timeout.
        result = await self._request(
            "initialize",
            {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": _CLIENT_INFO,
            },
            timeout=120.0,
        )
        await self._notify("notifications/initialized")
        return result or {}

    async def list_tools(self) -> list[dict]:
        result = await self._request("tools/list")
        return (result or {}).get("tools", [])

    async def call_tool(self, name: str, arguments: dict, timeout: float | None = None) -> str:
        result = await self._request(
            "tools/call",
            {"name": name, "arguments": arguments or {}},
            timeout=timeout,
        )
        return _flatten_tool_result(result or {})

    async def close(self) -> None:
        if not self._proc:
            return
        try:
            if self._proc.stdin and not self._proc.stdin.is_closing():
                self._proc.stdin.close()
        except Exception:
            pass
        try:
            await asyncio.wait_for(self._proc.wait(), timeout=3.0)
        except asyncio.TimeoutError:
            try:
                self._proc.kill()
            except ProcessLookupError:
                pass
        self._proc = None


class MCPSessionPool:
    """Keeps MCP processes alive across multiple tool calls within one request.

    Without this, every tool call spawns a fresh process. For stateful servers
    like Playwright that is fatal — each call gets a brand-new browser with no
    navigation history, forcing the model to re-navigate before every action.
    """

    def __init__(self) -> None:
        self._sessions: dict[tuple, MCPSession] = {}

    async def call_tool(
        self,
        command: str,
        name: str,
        arguments: dict,
        args: list[str] | None = None,
        env: dict | None = None,
    ) -> str:
        key = (command, tuple(args or []))
        session = self._sessions.get(key)
        # Recreate if the process has already exited.
        if session is not None and (
            session._proc is None or session._proc.returncode is not None
        ):
            try:
                await session.close()
            except Exception:
                pass
            session = None
        if session is None:
            session = MCPSession(command, args, env)
            await session.__aenter__()
            self._sessions[key] = session
        return await session.call_tool(name, arguments)

    async def close_all(self) -> None:
        for session in self._sessions.values():
            try:
                await session.close()
            except Exception:
                pass
        self._sessions.clear()


def _flatten_tool_result(result: dict) -> str:
    """Convert an MCP tools/call result into a plain text string for the LLM."""
    content = result.get("content", [])
    parts: list[str] = []
    for block in content:
        btype = block.get("type")
        if btype == "text":
            parts.append(block.get("text", ""))
        elif btype == "resource":
            res = block.get("resource", {})
            parts.append(res.get("text") or res.get("uri", ""))
        else:
            parts.append(json.dumps(block))
    text = "\n".join(p for p in parts if p)
    if result.get("isError"):
        return f"[tool error] {text}"
    return text or "(no output)"


async def mcp_list_tools(command: str, args: list[str] | None = None, env: dict | None = None) -> list[dict]:
    async with MCPSession(command, args, env) as session:
        return await session.list_tools()


async def mcp_call_tool(
    command: str,
    name: str,
    arguments: dict,
    args: list[str] | None = None,
    env: dict | None = None,
) -> str:
    async with MCPSession(command, args, env) as session:
        return await session.call_tool(name, arguments)
