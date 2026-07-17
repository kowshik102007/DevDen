"""Google Gemini LLM client (using google-genai SDK)."""
from typing import Optional, Dict, Any, List
from ..config import settings
import logging

logger = logging.getLogger(__name__)

try:
    from google import genai
    from google.genai import types
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


class GeminiClient:
    """Gemini LLM client singleton using Google GenAI SDK."""
    
    _instance: Optional[Any] = None
    _client = None
    
    @classmethod
    def get_client(cls):
        """Get or create Gemini client instance."""
        if not GEMINI_AVAILABLE:
            raise RuntimeError(
                "Google GenAI SDK not installed. Install with: pip install google-genai"
            )
        
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not configured in .env")
        
        if cls._client is None:
            cls._client = genai.Client(api_key=settings.GEMINI_API_KEY)
            cls._instance = cls._client
        
        return cls._client
    
    @classmethod
    def generate_content(
        cls,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs
    ) -> str:
        """Generate content using Gemini."""
        client = cls.get_client()
        
        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
            **kwargs
        )
        
        try:
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=config
            )
            return response.text
        except Exception as e:
            logger.error(f"Gemini generation error: {e}")
            raise
    
    @classmethod
    def generate_deployment_strategy(cls, hotspots: List[Dict[str, Any]]) -> str:
        """Generate climate pod deployment strategy."""
        hotspot_summary = "\n".join([
            f"- Site {h.get('id')}: PM2.5={h.get('pm25')} µg/m³, "
            f"Temp={h.get('temperature')}°C, "
            f"Pop={h.get('population_density')} people/km²"
            for h in hotspots[:10]  # Limit to top 10
        ])
        
        prompt = f"""As an urban climate expert, create a deployment strategy for Climate Pods based on these hotspots:

{hotspot_summary}

Provide:
1. Overall deployment priority (which sites first)
2. Estimated PM2.5 reduction per pod
3. Budget allocation suggestion
4. Timeline recommendations
5. Success metrics

Be concise and actionable."""

        return cls.generate_content(prompt, temperature=0.5)
    
    @classmethod
    def explain_analysis(cls, site_data: Dict[str, Any], analysis: Dict[str, Any]) -> str:
        """Generate human-readable explanation of analysis."""
        prompt = f"""Explain this pollution analysis in simple terms for city officials:

Site: {site_data.get('id')} ({site_data.get('lat')}, {site_data.get('lon')})
Current PM2.5: {site_data.get('pm25')} µg/m³
Analysis Result: {analysis}

Provide a 2-3 sentence explanation that:
1. Describes the pollution severity
2. Explains health implications
3. Justifies the recommended action

Use clear, non-technical language."""

        return cls.generate_content(prompt, temperature=0.4, max_tokens=200)


# Convenience function
def get_gemini_client():
    """Get Gemini client instance."""
    return GeminiClient.get_client()
