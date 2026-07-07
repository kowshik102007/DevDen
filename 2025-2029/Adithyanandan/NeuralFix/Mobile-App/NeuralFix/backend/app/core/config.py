from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    groq_api_key: str = ""
    database_url: str = "sqlite:///./neuralfix.db"
    host: str = "0.0.0.0"
    port: int = 8000
    docs_path: str = "./docs"
    vector_store_path: str = "./vector_store"
    app_name: str = "NeuralFix"
    debug: bool = True

    class Config:
        env_file = ".env"
        extra = "ignore"

@lru_cache()
def get_settings() -> Settings:
    return Settings()
