import logging
from pathlib import Path
from app.api.visionagent import analyse_image_bytes

logger = logging.getLogger(__name__)

async def analyze_equipment_image(image_path: str) -> dict:
    try:
        # Read the saved image bytes
        with open(image_path, "rb") as f:
            image_bytes = f.read()
            
        # Run through the LLaVA + Groq vision agent pipeline
        analysis = analyse_image_bytes(image_bytes)
        
        # Format for the chat context
        formatted_analysis = f"Vision Analysis Payload:\n{analysis}"
        
        return {"success": True, "analysis": formatted_analysis, "image_path": image_path}
    except Exception as e:
        logger.error(f"Vision error: {e}")
        return {"success": False, "error": str(e), "analysis": None}
