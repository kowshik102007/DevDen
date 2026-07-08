from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    # Anthropic
    anthropic_api_key: str = ""

    # Groq
    groq_api_key: str = "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"

    # Database — defaults to local SQLite so the app works out of the box
    database_url: str = "sqlite:///./netfix.db"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # RAG
    docs_path: str = "./docs"
    vector_store_path: str = "./vector_store"

    # App
    app_name: str = "NetFixAI"
    debug: bool = True

    class Config:
        env_file = ".env"
        extra = "ignore"


def get_settings() -> Settings:
    return Settings()
