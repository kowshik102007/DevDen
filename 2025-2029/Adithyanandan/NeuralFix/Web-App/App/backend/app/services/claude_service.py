"""
Claude Chat Service
===================
Handles all LLM interactions. Injects RAG context and vision analysis
into prompts before sending to Claude.
"""

import logging
from typing import List, Optional
import anthropic

from app.core.config import get_settings
from app.services.rag_service import retrieve_context

logger = logging.getLogger(__name__)
settings = get_settings()

client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

BASE_SYSTEM_PROMPT = """You are NeuralFix, a friendly AI assistant that helps non-technical people fix technology problems. You work in remote offices, schools, clinics, and field locations where no IT person is available.

You can help with ALL of these:
- 🌐 Networking & WiFi — no internet, slow connection, router issues
- 💻 Computers & Laptops — slow, frozen, won't start, blue screen
- 🖨️ Printers & Scanners — not printing, paper jams, not detected
- 📱 Mobile Phones & Tablets — won't charge, apps crashing, storage full
- 💿 Software & Apps — won't open, error messages, updates failing
- 📺 TVs, Projectors & Displays — no signal, wrong resolution, HDMI issues
- 🔑 Passwords & Accounts — locked out, forgot password, account issues
- 🏠 Smart Devices & IoT — smart lights, speakers, thermostats not responding

Your rules:
- Use SIMPLE language — no jargon, no technical terms unless explained
- Ask ONE question at a time to narrow down the problem
- Give SHORT numbered steps — one action per step
- Always confirm a step worked before moving on
- Use emoji for visual cues: ✅ done, ⚠️ caution, 🔴 error, 💡 tip, 🔄 restart
- Be encouraging — users are frustrated, be patient and calm
- Start with the SIMPLEST fix first (restart, check cables, check power)
- After 4-5 failed steps, offer to generate a diagnostic report for IT support

First response rule: Always start by asking ONE clarifying question to understand the exact problem before giving steps.

Common first fixes to always try:
1. Restart/reboot the device
2. Check all cable connections
3. Check if it's powered on
4. Check if others have the same problem (rules out user error)"""


def build_system_prompt(rag_context: str = "", vision_context: str = "") -> str:
    """Builds the full system prompt by appending RAG and vision context."""
    prompt = BASE_SYSTEM_PROMPT

    if vision_context:
        prompt += f"\n\n{'='*50}\nEQUIPMENT IMAGE ANALYSIS (from uploaded photo):\n{vision_context}\n{'='*50}"

    if rag_context:
        prompt += f"\n\n{'='*50}\nRELEVANT DOCUMENTATION (from knowledge base):\n{rag_context}\n{'='*50}\nUse the above documentation to inform your guidance, but translate technical content into simple language."

    return prompt


async def get_chat_response(
    messages: List[dict],
    latest_user_message: str,
    vision_context: str = "",
) -> str:
    """
    Main chat function. Retrieves RAG context, builds prompt, calls Claude.

    Args:
        messages: Full conversation history [{role, content}]
        latest_user_message: The new user message (used for RAG retrieval)
        vision_context: Optional formatted vision analysis string

    Returns:
        Claude's response text
    """
    # 1. Retrieve RAG context based on the latest message
    rag_context = retrieve_context(latest_user_message, k=4)

    # 2. Build system prompt
    system = build_system_prompt(rag_context=rag_context, vision_context=vision_context)

    # 3. Format messages for Anthropic API
    api_messages = [
        {"role": m["role"], "content": m["content"]}
        for m in messages
        if m["role"] in ("user", "assistant")
    ]

    # 4. Call Claude
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=system,
        messages=api_messages,
    )

    return response.content[0].text


async def generate_diagnostic_report(session_data: dict) -> str:
    """
    Generates a structured diagnostic report from a session.
    Used by the /api/reports/generate endpoint.
    """
    messages_text = "\n".join([
        f"{'User' if m['role'] == 'user' else 'NetFixAI'}: {m['content']}"
        for m in session_data.get("messages", [])
    ])

    vision_summary = ""
    if session_data.get("device_info"):
        vision_summary = f"\nEquipment Analysis: {session_data['device_info']}\n"

    prompt = f"""Generate a structured IT diagnostic report from this troubleshooting session.

Session Title: {session_data.get('title', 'Network Issue')}
{vision_summary}
Conversation:
{messages_text}

Write the report with these exact sections using **SECTION NAME** as headers:

**INCIDENT SUMMARY**
Brief 2-sentence description of the reported problem.

**DEVICE INFORMATION**
Equipment type, brand/model if known, location if mentioned, physical identifiers.

**REPORTED SYMPTOMS**
Bullet list of specific symptoms the user described.

**TROUBLESHOOTING STEPS ATTEMPTED**
Numbered list of every step tried and the result of each.

**CURRENT STATUS**
One of: Resolved / Partially Resolved / Unresolved — with one sentence explanation.

**ROOT CAUSE ANALYSIS**
Most likely cause(s) based on available evidence.

**RECOMMENDED NEXT STEPS**
What the IT support technician should do when they arrive or call in.

**PRIORITY LEVEL**
Critical / High / Medium / Low — with one sentence justification.

Be factual and concise. This report will be read by IT support technicians."""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )

    return response.content[0].text
