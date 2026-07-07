from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@db:5432/openagent"
    SECRET_KEY: str = "change-me-in-production-use-a-long-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    # AES-256-GCM key for encrypting provider API keys at rest. 32 bytes,
    # base64-encoded. If unset, derived deterministically from SECRET_KEY via
    # HKDF so existing single-secret deploys keep working.
    ENCRYPTION_KEY: Optional[str] = None

    class Config:
        env_file = ".env"


settings = Settings()
