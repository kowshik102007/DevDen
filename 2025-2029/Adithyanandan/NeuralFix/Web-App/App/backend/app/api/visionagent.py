import ollama
import base64, json, re
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from groq import Groq
from app.core.config import get_settings

router = APIRouter(prefix="/vision", tags=["Vision Agent"])

def get_groq_client():
    """Always read fresh settings so API key changes are picked up without restart."""
    s = get_settings()
    return Groq(api_key=s.groq_api_key)

PROMPT = """You are a network equipment technician. Look at the image and identify the networking device.

Respond with ONLY a raw JSON object (no markdown, no explanation, no code fences). Fill in real values based on what you see:

{
  "device_type": "router",
  "brand_model": "TP-Link Archer AX73",
  "led_states": [
    {"label": "Power", "color": "green", "blinking": false},
    {"label": "WAN", "color": "amber", "blinking": true}
  ],
  "unplugged_ports": [],
  "visible_damage": null,
  "overall_assessment": "WAN LED is amber indicating no internet connection.",
  "confidence": 0.82
}

Rules:
- device_type must be one of: router, switch, modem, access_point, unknown
- color must be one of: green, red, amber, off, blinking
- Use null for fields you cannot determine
- confidence is a decimal between 0.0 and 1.0
- Return ONLY the JSON. Nothing before or after it."""


def extract_json(raw: str) -> dict:
    """Robustly extract JSON from LLaVA output which may include extra text."""
    # Strip markdown fences
    cleaned = re.sub(r"```(?:json)?", "", raw).replace("```", "").strip()

    # Try direct parse first
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Find the first {...} block using regex (handles extra text around JSON)
    match = re.search(r'\{[\s\S]*\}', cleaned)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    # If all else fails return an error dict
    return {
        "device_type": "unknown",
        "brand_model": None,
        "led_states": [],
        "unplugged_ports": [],
        "visible_damage": None,
        "overall_assessment": cleaned[:500],
        "confidence": 0.0,
        "error": "JSON parse failed"
    }

class ChatMessage(BaseModel):
    role: str
    content: str

class VisionChatRequest(BaseModel):
    messages: List[ChatMessage]
    vision_context: Dict[str, Any]

def analyse_image_bytes(image_bytes: bytes) -> dict:
    img_b64 = base64.b64encode(image_bytes).decode("utf-8")
    
    response = ollama.generate(
        model="llava-llama3",
        prompt=PROMPT,
        images=[img_b64],
        stream=False
    )
    
    raw = response["response"].strip()
    print(f"[LLaVA raw output]\n{raw}\n{'─'*60}")  # debug log

    parsed_json = extract_json(raw)

    # ─── PART 2: Ask Groq for detailed fix steps
    summary_prompt = f"""You are an expert network technician. 
A physical inspection of the user's network equipment yielded the following findings:
{json.dumps(parsed_json, indent=2)}

Please provide a highly detailed, step-by-step markdown response explaining exactly how the user can troubleshoot and fix the issues identified. 
Structure it clearly with headings, bullet points, and any relevant warnings.
"""
    try:
        client = get_groq_client()
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": "You are a helpful and expert network support assistant."},
                {"role": "user", "content": summary_prompt}
            ],
            temperature=0.3,
            max_tokens=1024,
            top_p=1,
            stream=False,
            stop=None,
        )
        parsed_json["detailed_fix_summary"] = completion.choices[0].message.content
    except Exception as e:
        parsed_json["detailed_fix_summary"] = f"Failed to generate fix summary: {str(e)}"

    return parsed_json

@router.post("/analyse")
async def analyse_equipment_image(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    contents = await file.read()
    result = analyse_image_bytes(contents)
    return result

@router.post("/chat")
async def vision_chat(payload: VisionChatRequest):
    """Groq-powered chatbot with optional vision context."""
    base_prompt = """You are NeuralFix, a friendly AI assistant that helps non-technical people fix technology problems. You work in remote offices, schools, clinics, and field locations where no IT person is available.

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

    has_context = bool(payload.vision_context)
    if has_context:
        system_msg = base_prompt + f"\n\n[DEVICE IMAGE ANALYSIS]\nAn AI vision model analyzed a photo of their equipment and found:\n{json.dumps(payload.vision_context, indent=2)}\n\nAnswer the user's questions based on this context and your general knowledge."
    else:
        system_msg = base_prompt + "\n\nThe user has not yet uploaded a photo. Help guide them."
    api_messages = [{"role": "system", "content": system_msg}]
    for m in payload.messages:
        api_messages.append({"role": m.role, "content": m.content})
        
    try:
        client = get_groq_client()
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=api_messages,
            temperature=0.5,
            max_tokens=512,
            top_p=1,
            stream=False,
        )
        return {"reply": completion.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Groq API Error: {str(e)}")
