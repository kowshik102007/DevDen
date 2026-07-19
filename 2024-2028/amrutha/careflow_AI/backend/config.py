"""Configuration / settings"""
from pydantic import BaseSettings

class Settings(BaseSettings):
    MONGO_URI: str = "mongodb://localhost:27017"
    FAISS_INDEX_PATH: str = "faiss.index"
    OPENAI_API_KEY: str = ""

settings = Settings()
