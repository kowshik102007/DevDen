"""LLM wrapper placeholder"""

class LLMService:
    def __init__(self, api_key: str = None):
        self.api_key = api_key

    def generate(self, prompt: str) -> str:
        return "[LLM response placeholder]"
