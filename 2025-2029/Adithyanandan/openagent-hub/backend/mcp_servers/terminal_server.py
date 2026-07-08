#!/usr/bin/env python3
"""
Terminal MCP server — runs shell commands and returns output.

Lets the model self-heal (e.g. install missing browser binaries) and perform
general system operations inside the container it's running in.
"""
import json
import subprocess
import sys

PROTOCOL_VERSION = "2024-11-05"

TOOLS = [
    {
        "name": "run_command",
        "description": (
            "Run a shell command and return its stdout/stderr output. "
            "Use to install missing binaries (e.g. 'npx playwright install chromium'), "
            "check system state, run scripts, or perform any terminal operation."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "Shell command to execute"},
                "timeout": {"type": "integer", "description": "Optional timeout in seconds. Omit to run until the command finishes."},
            },
            "required": ["command"],
        },
    },
]


def _call_tool(name: str, args: dict) -> tuple[str, bool]:
    if name != "run_command":
        return f"Unknown tool: {name}", True
    command = str(args.get("command", "")).strip()
    if not command:
        return "Error: command is required.", True
    raw_timeout = args.get("timeout")
    timeout = int(raw_timeout) if raw_timeout is not None else None
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,  # None = wait forever
        )
        out = (result.stdout or "") + (result.stderr or "")
        if not out.strip():
            out = f"(exit code {result.returncode})"
        return out.strip(), result.returncode != 0
    except subprocess.TimeoutExpired:
        return f"Command timed out after {timeout}s.", True
    except Exception as exc:
        return f"Error: {exc}", True


def _send(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def _result(req_id, result) -> None:
    _send({"jsonrpc": "2.0", "id": req_id, "result": result})


def _error(req_id, code: int, message: str) -> None:
    _send({"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}})


def main() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue

        method = msg.get("method")
        req_id = msg.get("id")

        if req_id is None:
            continue

        if method == "initialize":
            _result(req_id, {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "terminal", "version": "1.0.0"},
            })
        elif method == "tools/list":
            _result(req_id, {"tools": TOOLS})
        elif method == "tools/call":
            params = msg.get("params", {})
            name = params.get("name", "")
            args = params.get("arguments", {}) or {}
            text, is_error = _call_tool(name, args)
            _result(req_id, {"content": [{"type": "text", "text": text}], "isError": is_error})
        elif method == "ping":
            _result(req_id, {})
        else:
            _error(req_id, -32601, f"Method not found: {method}")


if __name__ == "__main__":
    main()
