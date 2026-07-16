"""Configuration management for PodScout Pro."""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # Application
    APP_NAME: str = "PodScout Pro"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    
    # Supabase
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None
    SUPABASE_SERVICE_KEY: Optional[str] = None
    SUPABASE_DB_PASSWORD: Optional[str] = None
    
    # Pinecone (optional for now)
    PINECONE_API_KEY: Optional[str] = None
    PINECONE_ENV: Optional[str] = None
    PINECONE_INDEX_NAME: str = "podscout-embeddings"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # LLM APIs
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "mixtral-8x7b-32768"
    
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.0-flash-exp"
    
    # MCP Settings
    MCP_SERVER_HOST: str = "0.0.0.0"
    MCP_SERVER_PORT: int = 8001
    MCP_LOG_LEVEL: str = "INFO"
    
    # Google Earth Engine (for satellite data)
    GEE_SERVICE_ACCOUNT: Optional[str] = None
    GEE_PRIVATE_KEY_PATH: Optional[str] = None
    
    # Google OAuth (for authentication/authorization)
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    
    # Auth Settings
    AUTH_REDIRECT_URL: str = "http://localhost:8501"  # Streamlit frontend URL
    
    # API Keys for external services
    CPCB_API_KEY: Optional[str] = None
    OPENAQ_API_KEY: Optional[str] = None

    # Alert delivery channels
    ALERT_WEBHOOK_URL: Optional[str] = None          # existing webhook target
    SENDGRID_API_KEY: Optional[str] = None
    SENDGRID_FROM_EMAIL: str = "alerts@podscout.in"
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_FROM_PHONE: Optional[str] = None           # E.164, e.g. +917XXXXXXXXX
    TWILIO_WHATSAPP_FROM: Optional[str] = None        # e.g. +14155238886
    
    # Spatial Grid Configuration
    DEFAULT_GRID_SIZE_METERS: int = 500  # 500m x 500m cells
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Ignore extra fields in .env


settings = Settings()
