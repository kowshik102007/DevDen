import os
from dotenv import load_dotenv

# Load local .env variables
load_dotenv()

MODEL_NAME = "Qwen/Qwen2.5-0.5B-Instruct"
DRAFT_MODEL_NAME = "Qwen/Qwen2.5-0.5B-Instruct"

MAX_NEW_TOKENS = 300

DEFAULT_MEMORY_LIMIT = 800

# Gemini Settings
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL_NAME = "gemini-1.5-flash"