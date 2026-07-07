#!/usr/bin/env python3
"""
Example MCP server for OpenAgent Hub.

A dependency-free reference MCP server speaking JSON-RPC 2.0 over stdio
(newline-delimited). It exposes a few safe, self-contained tools so the MCP
integration can be tested end-to-end without any external server.

Tools:
    echo            — return the text you send it
    word_count      — count words and characters in a string
    current_time    — return the current UTC time (ISO-8601)
    random_number   — a deterministic-free pseudo-random int in [min, max]

Run:  python example_server.py
"""
import json
import random
import sys
from datetime import datetime, timezone

PROTOCOL_VERSION = "2024-11-05"

TOOLS = [
    {
        "name": "echo",
        "description": "Echo back the provided text. Useful for testing connectivity.",
        "inputSchema": {
            "type": "object",
            "properties": {"text": {"type": "string", "description": "Text to echo"}},
            "required": ["text"],
        },
    },
    {
        "name": "word_count",
        "description": "Count the number of words and characters in a piece of text.",
        "inputSchema": {
            "type": "object",
            "properties": {"text": {"type": "string", "description": "Text to analyze"}},
            "required": ["text"],
        },
    },
    {
        "name": "current_time",
        "description": "Get the current date and time in UTC (ISO-8601).",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "random_number",
        "description": "Return a random integer between min and max (inclusive).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "min": {"type": "integer", "description": "Lower bound", "default": 0},
                "max": {"type": "integer", "description": "Upper bound", "default": 100},
            },
        },
    },
]


def _call_tool(name: str, args: dict) -> str:
    if name == "echo":
        return str(args.get("text", ""))
    if name == "word_count":
        text = str(args.get("text", ""))
        return json.dumps({"words": len(text.split()), "characters": len(text)})
    if name == "current_time":
        return datetime.now(timezone.utc).isoformat()
    if name == "random_number":
        lo = int(args.get("min", 0))
        hi = int(args.get("max", 100))
        if lo > hi:
            lo, hi = hi, lo
        return str(random.randint(lo, hi))
    raise ValueError(f"Unknown tool: {name}")


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

        # Notifications have no id and require no response.
        if req_id is None:
            continue

        if method == "initialize":
            _result(req_id, {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "openagent-example", "version": "0.1.0"},
            })
        elif method == "tools/list":
            _result(req_id, {"tools": TOOLS})
        elif method == "tools/call":
            params = msg.get("params", {})
            name = params.get("name", "")
            args = params.get("arguments", {}) or {}
            try:
                output = _call_tool(name, args)
                _result(req_id, {"content": [{"type": "text", "text": output}], "isError": False})
            except Exception as exc:  # noqa: BLE001
                _result(req_id, {"content": [{"type": "text", "text": str(exc)}], "isError": True})
        elif method == "ping":
            _result(req_id, {})
        else:
            _error(req_id, -32601, f"Method not found: {method}")


if __name__ == "__main__":
    main()
