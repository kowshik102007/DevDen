"""
NeuralFix — Groq AI Service
Uses llama-3.1-8b-instant for fast IT troubleshooting across all categories.
"""
import logging
from typing import List
from groq import Groq
from app.core.config import get_settings
from app.services.rag_service import retrieve_context

logger = logging.getLogger(__name__)
settings = get_settings()
client = Groq(api_key=settings.groq_api_key)
MODEL = "llama-3.1-8b-instant"

ORCHESTRATOR_PROMPT = """You are the NeuralFix Orchestrator. 
Analyze the user's latest query and the conversation history to determine which Expert Agent should handle the request.
You MUST output ONLY a valid JSON object. 

Available Experts:
- "vision": Choose this if the user uploaded an image, mentions lights (LEDs), cables, physical ports, or asks about physical damage/hardware.
- "rag": Choose this if the user is asking how to setup a device, wants instructions from a manual, or mentions specific documentation/guides.
- "general": Choose this for everything else (software, generic slow internet, password resets, basic troubleshooting).

Output format:
{"expert": "vision"} or {"expert": "rag"} or {"expert": "general"}
"""

VISION_EXPERT_PROMPT = """You are the NeuralFix Hardware & Vision Expert.
You help users diagnose physical device issues based on AI image analysis.

CRITICAL RULES FOR VISION EXPERT:
1. You MUST read the [DEVICE IMAGE ANALYSIS] provided below. It contains the exact physical state of the user's device (LED colors, what the device is, etc).
2. DO NOT ask the user "What device is this?" or "What color are the lights?" if the [DEVICE IMAGE ANALYSIS] already tells you!
3. If the analysis says it is a non-networking item (like a mouse or cup), acknowledge that fact humorously but politely, and do not try to fix their internet using a computer mouse.
4. Use SIMPLE language — no jargon.
5. Ask ONE follow-up question at a time to narrow down the problem. Give SHORT numbered steps.
6. Use emoji for visual cues: ✅ ⚠️ 🔴 💡 🔌
"""

RAG_EXPERT_PROMPT = """You are the NeuralFix Documentation & Manuals Expert.
You rely strictly on official documents and manuals to answer user questions.

Your rules:
- Read the [RELEVANT DOCUMENTATION] carefully. Only suggest steps found in the documentation.
- If the documentation does not have the answer, politely state that you cannot find the specific instructions in the manual, and offer generic advice.
- Give SHORT numbered steps. Do NOT overwhelm the user with massive blocks of text.
- Use SIMPLE language.
- Use emoji for visual cues: 📄 ✅ ⚠️ 💡
"""

GENERAL_EXPERT_PROMPT = """You are NeuralFix, a friendly AI assistant for general tech support.
You help non-technical people fix technology problems (WiFi, slow PCs, printers, passwords).

Your rules:
- Use SIMPLE language — no jargon.
- Ask ONE question at a time to narrow down the problem. Give SHORT numbered steps.
- Start with the SIMPLEST fix first (restart, check power).
- Use emoji for visual cues: ✅ ⚠️ 🔴 💡 🔄
- Be encouraging — users are frustrated, be patient and calm.
"""


import json

def build_expert_prompt(expert_type: str, rag_context: str = "", vision_context: str = "") -> str:
    if expert_type == "vision":
        base = VISION_EXPERT_PROMPT
    elif expert_type == "rag":
        base = RAG_EXPERT_PROMPT
    else:
        base = GENERAL_EXPERT_PROMPT

    if vision_context:
        base += f"\n\n[DEVICE IMAGE ANALYSIS]\n{vision_context}"
    if rag_context:
        base += f"\n\n[RELEVANT DOCUMENTATION]\n{rag_context}\nUse this to inform your guidance but keep language simple."
    return base


async def get_chat_response(messages: List[dict], latest_user_message: str, vision_context: str = "") -> tuple[str, str]:
    # --- Agent 1: Orchestrator ---
    # Convert history into a string for the orchestrator to analyze
    history_str = "\n".join([f"{m['role']}: {m['content']}" for m in messages[-5:]])
    context_str = f"Image Context: {vision_context}\n" if vision_context else ""
    orchestrator_req = f"{context_str}History:\n{history_str}\n\nLatest User Message: {latest_user_message}\n\nAnalyze and output JSON."

    try:
        orch_res = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": ORCHESTRATOR_PROMPT},
                {"role": "user", "content": orchestrator_req}
            ],
            response_format={"type": "json_object"},
            max_tokens=64,
            temperature=0.1,
        )
        routing_decision = json.loads(orch_res.choices[0].message.content)
        expert = routing_decision.get("expert", "general")
    except Exception as e:
        logger.warning(f"Orchestrator failed to route: {str(e)}. Falling back to general.")
        expert = "general"

    logger.info(f"Orchestrator selected Expert Agent: [{expert.upper()}]")

    # --- Agent 2: Expert Execution ---
    # Only retrieve RAG context if it's the RAG expert or general (just in case). Avoids unnecessary vector DB hits.
    rag_context = ""
    if expert in ("rag", "general"):
        rag_context = retrieve_context(latest_user_message, k=3)

    system_prompt = build_expert_prompt(expert, rag_context=rag_context, vision_context=vision_context)

    api_messages = [
        {"role": m["role"], "content": m["content"]}
        for m in messages if m["role"] in ("user", "assistant")
    ]
    
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "system", "content": system_prompt}] + api_messages,
        max_tokens=1024,
        temperature=0.4,
    )
    return response.choices[0].message.content, expert


async def analyze_image_with_groq(image_description: str) -> str:
    prompt = f"""A user has uploaded an image of a device or tech equipment: "{image_description}"

Provide a brief analysis:
1. What type of device this likely is
2. What visible clues might indicate the problem (lights, screen, cables)
3. What to look for to troubleshoot it

Keep it simple and practical for a non-technical user."""
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=400,
        temperature=0.3,
    )
    return response.choices[0].message.content


async def generate_diagnostic_report(session_data: dict) -> str:
    messages_text = "\n".join([
        f"{'User' if m['role'] == 'user' else 'NeuralFix'}: {m['content']}"
        for m in session_data.get("messages", [])
    ])
    prompt = f"""Generate a structured IT diagnostic report from this troubleshooting session.

App: NeuralFix
Session: {session_data.get('title', 'Tech Issue')}
Category: {session_data.get('category', 'general')}

Conversation:
{messages_text}

Write the report with these exact section headers using **SECTION NAME** format:

**INCIDENT SUMMARY**
**DEVICE / SYSTEM INFORMATION**
**REPORTED SYMPTOMS**
**TROUBLESHOOTING STEPS ATTEMPTED**
**CURRENT STATUS**
**ROOT CAUSE ANALYSIS**
**RECOMMENDED NEXT STEPS**
**PRIORITY LEVEL**

Be factual and concise. This will be read by IT support technicians."""
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1500,
        temperature=0.2,
    )
    return response.choices[0].message.content
