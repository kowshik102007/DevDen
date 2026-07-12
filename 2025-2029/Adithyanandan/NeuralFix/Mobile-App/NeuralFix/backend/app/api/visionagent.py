import ollama
import base64, json, re
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from groq import Groq
from app.core.config import get_settings

router = APIRouter(prefix="/vision", tags=["Vision Agent"])


def get_groq_client():
    """Always read fresh settings so API key changes are picked up without restart."""
    s = get_settings()
    return Groq(api_key=s.groq_api_key)


PROMPT = """You are an accurate IT and networking vision model. Look at the image and identify the primary object. 

CRITICAL RULES:
1. You must be completely unbiased. If the device is a router, switch, or modem, identify it as such.
2. If the object is clearly a HOUSEHOLD ITEM (cup, shoe) or a COMPUTER PERIPHERAL (mouse, keyboard, monitor), you MUST NOT call it a router. Call it "other" or "peripheral".
3. Look for antennas, network ports, or status LEDs to confirm if it is networking equipment.

Respond with ONLY a raw JSON object (no markdown). Fill in real values based on what you see:

{
  "device_type": "router", 
  "brand_model": "Unknown",
  "led_states": [],
  "unplugged_ports": [],
  "visible_damage": null,
  "overall_assessment": "This appears to be a standard home router.",
  "confidence": 0.95
}

Rules for JSON:
- device_type MUST strictly be one of: router, switch, modem, access_point, computer, mobile, peripheral, unknown, other.
- led_states MUST be a list of colors like: ["green", "blinking red", "off"]. (Leave empty list if no LEDs exist).
- Return ONLY the JSON. Nothing before or after it."""


def extract_json(raw: str) -> dict:
    """Robustly extract JSON from LLaVA output which may include extra text."""
    cleaned = re.sub(r"```(?:json)?", "", raw).replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    match = re.search(r'\{[\s\S]*\}', cleaned)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
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


def analyse_image_bytes(image_bytes: bytes) -> dict:
    img_b64 = base64.b64encode(image_bytes).decode("utf-8")

    response = ollama.generate(
        model="llava-llama3",
        prompt=PROMPT,
        images=[img_b64],
        stream=False
    )

    raw = response["response"].strip()
    print(f"[LLaVA raw output]\n{raw}\n{'─'*60}")
    parsed_json = extract_json(raw)

    device_type = parsed_json.get("device_type", "unknown")
    is_network_device = device_type in ["router", "switch", "modem", "access_point"]

    if is_network_device:
        summary_prompt = f"""You are an expert network technician.
A physical inspection of the user's network equipment yielded the following findings:
{json.dumps(parsed_json, indent=2)}

Provide a highly detailed, step-by-step markdown response explaining exactly how the user can troubleshoot and fix the issues found.
Structure it with headings, bullet points, and relevant warnings.
"""
        system_role = "You are a helpful expert network support assistant."
    else:
        summary_prompt = f"""An AI vision model analyzed a photo uploaded by the user and reached this conclusion:
{json.dumps(parsed_json, indent=2)}

Politely inform the user that this appears to be a {device_type} (or non-networking item) rather than a router or modem.
Keep it brief, friendly, and do NOT provide a 10-step troubleshooting guide for a random object.
"""
        system_role = "You are a friendly technical assistant."

    try:
        client = get_groq_client()
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_role},
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


class ChatMessage(BaseModel):
    role: str
    content: str


class VisionChatRequest(BaseModel):
    messages: List[ChatMessage]
    vision_context: Dict[str, Any]


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
    has_context = bool(payload.vision_context)
    if has_context:
        system_msg = f"""You are an expert network technician assisting a user with their equipment.
An AI vision model analyzed a photo of their equipment and found:
{json.dumps(payload.vision_context, indent=2)}

Answer the user's questions based on this context and your general networking knowledge. Be concise and helpful.
"""
    else:
        system_msg = """You are an expert network technician and friendly assistant for NeuralFix Vision.
The user has not yet uploaded a photo for analysis.
Help guide them — explain what kinds of devices you can diagnose (routers, switches, modems, access points),
what to look for in a photo, and answer any general networking questions they have.
Be friendly, concise, and proactive in offering help.
"""
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
