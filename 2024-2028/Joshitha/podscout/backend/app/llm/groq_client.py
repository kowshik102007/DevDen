"""Groq LLM client for fast inference."""
from typing import Optional, Dict, Any, List
from ..config import settings

try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False


class GroqClient:
    """Groq LLM client singleton."""
    
    _instance: Optional[Any] = None
    
    @classmethod
    def get_client(cls):
        """Get or create Groq client instance."""
        if not GROQ_AVAILABLE:
            raise RuntimeError("Groq SDK not installed. Install with: pip install groq")
        
        if not settings.GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY not configured in .env")
        
        if cls._instance is None:
            cls._instance = Groq(api_key=settings.GROQ_API_KEY)
        return cls._instance
    
    @classmethod
    def chat_completion(
        cls,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs
    ) -> str:
        """Generate chat completion."""
        client = cls.get_client()
        
        response = client.chat.completions.create(
            model=model or settings.GROQ_MODEL,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs
        )
        
        return response.choices[0].message.content
    
    @classmethod
    def analyze_hotspot(cls, site_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze pollution hotspot using Groq."""
        prompt = f"""You are an environmental data analyst. Analyze this pollution hotspot:

Site ID: {site_data.get('id')}
Coordinates: {site_data.get('lat')}, {site_data.get('lon')}
PM2.5: {site_data.get('pm25')} µg/m³
Temperature: {site_data.get('temperature')}°C
Population Density: {site_data.get('population_density')} people/km²

Provide a concise analysis in JSON format with:
1. severity_level (low/medium/high/critical)
2. health_impact (brief description)
3. recommended_pods (number of climate pods needed)
4. priority_score (0-100)

Respond ONLY with valid JSON, no markdown."""

        messages = [
            {"role": "system", "content": "You are an environmental data analyst."},
            {"role": "user", "content": prompt}
        ]
        
        response = cls.chat_completion(messages, temperature=0.3)
        
        # Parse JSON response
        import json
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            # Fallback parsing
            return {
                "severity_level": "medium",
                "health_impact": response[:200],
                "recommended_pods": 3,
                "priority_score": 65
            }


# Convenience function
def get_groq_client():
    """Get Groq client instance."""
    return GroqClient.get_client()
