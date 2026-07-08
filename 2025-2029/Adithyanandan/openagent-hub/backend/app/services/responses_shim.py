"""Translate OpenAI Responses API requests into Chat Completions and back.

The Responses API (``POST /v1/responses``) is the newer interface used by the
OpenAI SDK, Codex CLI, and the Agents SDK.  This shim converts requests to/from
the underlying Chat Completions proxy so users don't need a real Responses-capable
backend.
"""
from __future__ import annotations

import json
import secrets
import time
from typing import AsyncIterator
from uuid import UUID

from sqlalchemy.orm import Session

from app.services import openai_proxy


def _resp_id() -> str:
    return f"resp_{secrets.token_hex(12)}"


def _msg_id() -> str:
    return f"msg_{secrets.token_hex(12)}"


# ---------------------------------------------------------------------------
# Input → messages translation
# ---------------------------------------------------------------------------

def _input_to_messages(body: dict) -> list[dict]:
    """Convert Responses API ``input`` + ``instructions`` to Chat messages."""
    messages: list[dict] = []

    instructions = body.get("instructions")
    if instructions:
        messages.append({"role": "system", "content": instructions})

    raw_input = body.get("input", "")

    if isinstance(raw_input, str):
        messages.append({"role": "user", "content": raw_input})
    elif isinstance(raw_input, list):
        for item in raw_input:
            if isinstance(item, str):
                messages.append({"role": "user", "content": item})
            elif isinstance(item, dict):
                role = item.get("role", "user")
                content = item.get("content", "")
                if isinstance(content, list):
                    messages.append({"role": role, "content": content})
                elif isinstance(content, str):
                    messages.append({"role": role, "content": content})
                else:
                    messages.append({"role": role, "content": str(content)})
    else:
        messages.append({"role": "user", "content": str(raw_input)})

    return messages


def _chat_body(body: dict) -> dict:
    """Build a Chat Completions request body from a Responses request."""
    messages = _input_to_messages(body)
    chat: dict = {"messages": messages, "model": body.get("model", "auto")}

    if body.get("max_output_tokens"):
        chat["max_tokens"] = body["max_output_tokens"]
    if body.get("temperature") is not None:
        chat["temperature"] = body["temperature"]
    if body.get("top_p") is not None:
        chat["top_p"] = body["top_p"]

    return chat


# ---------------------------------------------------------------------------
# Non-streaming
# ---------------------------------------------------------------------------

async def create_response(
    db: Session,
    user_id: UUID,
    body: dict,
    preferred_provider_id: str | None = None,
) -> dict:
    chat_req = _chat_body(body)
    data = await openai_proxy.completion(db, user_id, chat_req, preferred_provider_id=preferred_provider_id)

    now = int(time.time())
    resp_id = _resp_id()
    msg_id = _msg_id()

    choices = data.get("choices") or []
    text = ""
    if choices:
        msg = choices[0].get("message") or {}
        text = msg.get("content") or ""

    usage_raw = data.get("usage") or {}
    usage = {
        "input_tokens": usage_raw.get("prompt_tokens", 0),
        "output_tokens": usage_raw.get("completion_tokens", 0),
        "total_tokens": usage_raw.get("total_tokens", 0),
    }

    return {
        "id": resp_id,
        "object": "response",
        "status": "completed",
        "created_at": now,
        "model": data.get("model", body.get("model", "auto")),
        "output": [
            {
                "id": msg_id,
                "type": "message",
                "role": "assistant",
                "status": "completed",
                "content": [
                    {
                        "type": "output_text",
                        "text": text,
                        "annotations": [],
                    }
                ],
            }
        ],
        "usage": usage,
        "error": None,
        "incomplete_details": None,
    }


# ---------------------------------------------------------------------------
# Streaming
# ---------------------------------------------------------------------------

async def stream_response(
    db: Session,
    user_id: UUID,
    body: dict,
    preferred_provider_id: str | None = None,
) -> AsyncIterator[str]:
    """Yield Responses API SSE events by consuming a Chat Completions stream."""
    chat_req = _chat_body(body)
    chat_req["stream"] = True

    now = int(time.time())
    resp_id = _resp_id()
    msg_id = _msg_id()
    model = body.get("model", "auto")
    seq = 0

    def _sse(event: str, data: dict) -> str:
        return f"event: {event}\ndata: {json.dumps(data)}\n\n"

    # --- response.created
    resp_skeleton = {
        "id": resp_id,
        "object": "response",
        "status": "in_progress",
        "created_at": now,
        "model": model,
        "output": [],
        "usage": None,
        "error": None,
        "incomplete_details": None,
    }
    yield _sse("response.created", {"type": "response.created", "sequence_number": seq, "response": resp_skeleton})
    seq += 1

    # --- response.in_progress
    yield _sse("response.in_progress", {"type": "response.in_progress", "sequence_number": seq, "response": resp_skeleton})
    seq += 1

    # --- output_item.added
    item_skeleton = {"id": msg_id, "type": "message", "role": "assistant", "status": "in_progress", "content": []}
    yield _sse("response.output_item.added", {"type": "response.output_item.added", "sequence_number": seq, "output_index": 0, "item": item_skeleton})
    seq += 1

    # --- content_part.added
    part_skeleton = {"type": "output_text", "text": "", "annotations": []}
    yield _sse("response.content_part.added", {"type": "response.content_part.added", "sequence_number": seq, "item_id": msg_id, "output_index": 0, "content_index": 0, "part": part_skeleton})
    seq += 1

    accumulated_text = ""
    usage_data = None

    async for raw_line in openai_proxy.stream(db, user_id, chat_req, preferred_provider_id=preferred_provider_id):
        # Each raw_line is "data: {...}\n\n" or "data: [DONE]\n\n"
        for segment in raw_line.strip().split("\n"):
            segment = segment.strip()
            if not segment.startswith("data:"):
                continue
            payload = segment[5:].strip()
            if payload == "[DONE]":
                continue
            try:
                chunk = json.loads(payload)
            except json.JSONDecodeError:
                continue

            # Extract usage if present (some providers include it on the last chunk)
            if chunk.get("usage"):
                u = chunk["usage"]
                usage_data = {
                    "input_tokens": u.get("prompt_tokens", 0),
                    "output_tokens": u.get("completion_tokens", 0),
                    "total_tokens": u.get("total_tokens", 0),
                }

            choices = chunk.get("choices") or []
            if not choices:
                continue
            delta = choices[0].get("delta") or {}
            content = delta.get("content")
            if content:
                accumulated_text += content
                yield _sse("response.output_text.delta", {
                    "type": "response.output_text.delta",
                    "sequence_number": seq,
                    "item_id": msg_id,
                    "output_index": 0,
                    "content_index": 0,
                    "delta": content,
                })
                seq += 1

    # --- output_text.done
    yield _sse("response.output_text.done", {
        "type": "response.output_text.done",
        "sequence_number": seq,
        "item_id": msg_id,
        "output_index": 0,
        "content_index": 0,
        "text": accumulated_text,
    })
    seq += 1

    # --- content_part.done
    yield _sse("response.content_part.done", {
        "type": "response.content_part.done",
        "sequence_number": seq,
        "item_id": msg_id,
        "output_index": 0,
        "content_index": 0,
        "part": {"type": "output_text", "text": accumulated_text, "annotations": []},
    })
    seq += 1

    # --- output_item.done
    completed_item = {
        "id": msg_id,
        "type": "message",
        "role": "assistant",
        "status": "completed",
        "content": [{"type": "output_text", "text": accumulated_text, "annotations": []}],
    }
    yield _sse("response.output_item.done", {
        "type": "response.output_item.done",
        "sequence_number": seq,
        "output_index": 0,
        "item": completed_item,
    })
    seq += 1

    # --- response.completed
    completed_resp = {
        "id": resp_id,
        "object": "response",
        "status": "completed",
        "created_at": now,
        "completed_at": int(time.time()),
        "model": model,
        "output": [completed_item],
        "usage": usage_data or {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0},
        "error": None,
        "incomplete_details": None,
    }
    yield _sse("response.completed", {
        "type": "response.completed",
        "sequence_number": seq,
        "response": completed_resp,
    })
