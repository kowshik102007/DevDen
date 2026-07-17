import time
import google.generativeai as genai
from config.settings import GEMINI_API_KEY, GEMINI_MODEL_NAME


def retrieve_factual_context(user_input, api_key=None, model_name=None):
    """
    Query Google's Gemini API to retrieve raw factual details to augment local model context
    """
    active_key = api_key if api_key else GEMINI_API_KEY
    active_model = model_name if model_name else GEMINI_MODEL_NAME

    if not active_key:
        return "Error: Gemini API Key is missing.", 0

    prompt = f"""You are a factual knowledge retriever. Retrieve a brief list of facts, figures, and historical data necessary to answer this question:
Question: {user_input}

Instructions:
- Provide only the verified facts as a concise bullet-point list.
- Keep the response short (under 150 words).
- Do not answer the question directly or add greetings/conclusions."""

    start_time = time.time()
    try:
        # Configure Gemini API
        genai.configure(api_key=active_key)
        model = genai.GenerativeModel(active_model)

        # Call API
        response = model.generate_content(prompt)
        facts = response.text.strip()
    except Exception as e:
        facts = f"Error retrieving context from Gemini: {str(e)}"

    latency = (time.time() - start_time) * 1000
    return facts, latency

