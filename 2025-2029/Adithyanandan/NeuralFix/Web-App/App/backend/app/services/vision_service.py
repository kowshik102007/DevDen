"""
Vision Service
==============
Analyzes uploaded images of networking equipment using Claude's vision capabilities.
Detects device types, LED indicator states, cable connections, and visible hardware issues.
"""

import base64
import logging
from pathlib import Path
import anthropic

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

VISION_SYSTEM_PROMPT = """You are a network equipment vision analyst. When shown an image of networking equipment, analyze it and return a structured assessment covering:

1. DEVICE TYPE — What equipment is visible (router, switch, modem, access point, patch panel, cables, etc.)
2. BRAND/MODEL — Brand name and model if visible on labels
3. LED STATUS — List each visible LED indicator with its color and state (solid/blinking/off)
4. CABLE CONNECTIONS — Which ports have cables connected, any visibly loose or disconnected cables
5. PHYSICAL ISSUES — Any visible damage, overheating signs, improper placement
6. OVERALL ASSESSMENT — One sentence summary of what you see

Be concise and factual. If something is not visible or unclear, say so. Focus on information useful for network troubleshooting."""


async def analyze_equipment_image(image_path: str) -> dict:
    """
    Sends an equipment image to Claude vision for analysis.
    Returns structured dict with device info and observations.
    """
    try:
        # Read and encode image
        with open(image_path, "rb") as f:
            image_data = base64.standard_b64encode(f.read()).decode("utf-8")

        # Detect media type
        ext = Path(image_path).suffix.lower()
        media_type_map = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
        }
        media_type = media_type_map.get(ext, "image/jpeg")

        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=800,
            system=VISION_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_data,
                            },
                        },
                        {
                            "type": "text",
                            "text": "Please analyze this networking equipment image for troubleshooting purposes.",
                        },
                    ],
                }
            ],
        )

        analysis_text = response.content[0].text

        return {
            "success": True,
            "analysis": analysis_text,
            "image_path": image_path,
        }

    except FileNotFoundError:
        logger.error(f"Image not found: {image_path}")
        return {"success": False, "error": "Image file not found", "analysis": None}
    except Exception as e:
        logger.error(f"Vision analysis error: {e}")
        return {"success": False, "error": str(e), "analysis": None}


def get_image_summary_for_prompt(vision_result: dict) -> str:
    """
    Formats the vision analysis result for injection into the chat prompt context.
    """
    if not vision_result.get("success") or not vision_result.get("analysis"):
        return ""
    return f"\n[EQUIPMENT IMAGE ANALYSIS]\n{vision_result['analysis']}\n"
