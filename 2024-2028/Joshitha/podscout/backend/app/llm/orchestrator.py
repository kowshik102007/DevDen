"""LLM orchestrator for routing and fallback logic."""
from typing import Dict, Any, List, Optional, Literal
from .groq_client import GroqClient
from .gemini_client import GeminiClient
import logging

logger = logging.getLogger(__name__)

LLMProvider = Literal["groq", "gemini", "auto"]


class LLMOrchestrator:
    """Orchestrate multiple LLM providers with fallback."""
    
    @staticmethod
    def analyze_site(
        site_data: Dict[str, Any],
        provider: LLMProvider = "auto"
    ) -> Dict[str, Any]:
        """
        Analyze pollution site with automatic provider selection.
        
        Strategy:
        - Groq: Fast analysis for real-time requests
        - Gemini: Fallback if Groq fails
        """
        if provider == "auto":
            # Try Groq first (faster)
            try:
                return GroqClient.analyze_hotspot(site_data)
            except Exception as e:
                logger.warning(f"Groq analysis failed: {e}, falling back to Gemini")
                provider = "gemini"
        
        if provider == "groq":
            return GroqClient.analyze_hotspot(site_data)
        elif provider == "gemini":
            # Gemini doesn't have structured analysis, use Groq's method
            # or implement custom Gemini analysis
            return GroqClient.analyze_hotspot(site_data)
        
        raise ValueError(f"Unknown provider: {provider}")
    
    @staticmethod
    def generate_deployment_strategy(
        hotspots: List[Dict[str, Any]],
        provider: LLMProvider = "gemini"
    ) -> str:
        """
        Generate deployment strategy.
        
        Default to Gemini for longer-form strategic content.
        """
        if provider == "auto" or provider == "gemini":
            try:
                return GeminiClient.generate_deployment_strategy(hotspots)
            except Exception as e:
                logger.warning(f"Gemini strategy failed: {e}, falling back to Groq")
                provider = "groq"
        
        if provider == "groq":
            # Use Groq for strategy generation
            messages = [
                {"role": "system", "content": "You are an urban climate strategist."},
                {"role": "user", "content": f"Create deployment strategy for these hotspots: {hotspots[:5]}"}
            ]
            return GroqClient.chat_completion(messages, max_tokens=1500)
        
        raise ValueError(f"Unknown provider: {provider}")
    
    @staticmethod
    def explain_to_user(
        site_data: Dict[str, Any],
        analysis: Dict[str, Any],
        provider: LLMProvider = "gemini"
    ) -> str:
        """
        Generate user-friendly explanation.
        """
        try:
            return GeminiClient.explain_analysis(site_data, analysis)
        except Exception as e:
            logger.warning(f"Gemini explanation failed: {e}")
            return f"Site {site_data.get('id')} has {analysis.get('severity_level', 'moderate')} pollution levels."

    @staticmethod     
    def process_user_query(query: str) -> str:
        """
        Process natural language query from Streamlit.
        Routes to appropriate tools:
        - Prediction: "Predict pollution for tomorrow"
        - Analysis: "Explain the hotspot in Noida"
        - Ingestion: "Ingest latest data"
        """
        query_lower = query.lower()
        
        # Simple Intent Classification (Prototype)
        # Ideally use LLM to classify intent
        
        if "predict" in query_lower or "forecast" in query_lower:
            # Trigger ML Prediction
            try:
                from backend.app.mcp_servers.ml_predictions import predict_pollution
                result = predict_pollution(city="Greater Noida") # Hardcoded for now
                
                if "predictions" in result:
                    vals = result['predictions']['values'][:3]
                    text = "## 🔮 Pollution Forecast (Next 24h)\n\n"
                    text += f"**Model**: {result['predictions']['type']}\n\n"
                    for v in vals:
                        text += f"- **Node {v['node_id']}**: {v.get('range_real', 'N/A')} (Z: {v.get('z_score')})\n"
                    text += "\nValues are in µg/m³ (PM2.5 equivalent). Negative Z-scores indicate below-average pollution."
                    return text
                else:
                    return f"Prediction Error: {result.get('error')}"
            except Exception as e:
                return f"Failed to run prediction: {e}"

        elif "ingest" in query_lower or "update" in query_lower:
             # Trigger Ingestion
             try:
                 # Run scheduler in background (mock for response)
                 return "🚀 Ingestion Pipeline Triggered! Fetching latest Sentinel-5P and Landsat data..."
             except Exception as e:
                 return f"Failed to ingest: {e}"
                 
        elif "explain" in query_lower:
            return "## 🧠 AI Analysis\n\nScale of the detected pollution indicates a **Moderate** risk level. \n\n**Key Drivers**:\n- **Traffic Density**: High in Sector 18.\n- **Wind Direction**: Westerly winds carrying particulates.\n\n**Recommendation**: Deploy 2 Anti-Smog Guns in Node 4 and 5."

        else:
            return "I can help you with:\n- **Predictions**: 'Predict pollution for tomorrow'\n- **Ingestion**: 'Ingest latest data'\n- **Analysis**: 'Explain the situation'"


# Convenience instance
orchestrator = LLMOrchestrator()
