"""Live test: does auto tool_mode trigger a tool call when a scenario demands it?
Uses an existing healthy OpenRouter provider key from the DB.
"""
import asyncio
from app.core.database import SessionLocal
from app.models.provider import Provider
from app.services.chat_agent_service import stream_chat_with_tools


async def main():
    with SessionLocal() as db:
        prov = (
            db.query(Provider)
            .filter(Provider.enabled == True, Provider.status == "healthy")  # noqa: E712
            .first()
        )
        if not prov:
            print("NO healthy provider; skipping live test")
            return
        user_id = prov.user_id
        print(f"Using provider {prov.name} for user {user_id}")

    # A prompt that clearly calls for the calculator tool.
    messages = [
        {"role": "system", "content": "You are a helpful assistant. Use tools when helpful."},
        {"role": "user", "content": "What is 4567 multiplied by 8901? Use a tool to compute it exactly."},
    ]

    tool_calls = []
    chunks = []
    async for evt in stream_chat_with_tools(
        user_id=user_id,
        base_url="", api_key="", model="openai/gpt-4o-mini",
        messages=messages,
        preferred_provider_id=str(prov.id),
        tool_mode="auto",
    ):
        t = evt.get("type")
        if t == "tool_call":
            tool_calls.append(evt["tool"])
            print(f"  TOOL_CALL: {evt['tool']}({evt.get('input')})")
        elif t == "tool_result":
            print(f"  TOOL_RESULT: {str(evt.get('output'))[:80]}")
        elif t == "chunk":
            chunks.append(evt["content"])

    answer = "".join(chunks)
    print(f"\nANSWER: {answer[:200]}")
    expected = 4567 * 8901
    print(f"\ntool_calls made: {tool_calls}")
    assert tool_calls, "AUTO mode did NOT call any tool for a clear math scenario!"
    print(f"expected product = {expected}; in answer: {str(expected) in answer}")
    print("\nLIVE AUTO-TOOL TEST PASSED ✅")


if __name__ == "__main__":
    asyncio.run(main())
