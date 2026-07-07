from pydantic import BaseModel, field_serializer
from typing import Optional
from uuid import UUID
from datetime import datetime

from app.core import crypto


class ProviderKeyCreate(BaseModel):
    label: str = "default"
    api_key: str = ""


class ProviderKeyUpdate(BaseModel):
    label: Optional[str] = None
    api_key: Optional[str] = None
    is_active: Optional[bool] = None


class ProviderKeyResponse(BaseModel):
    id: UUID
    provider_id: UUID
    label: str
    api_key: str
    is_active: bool
    rpm_limit: Optional[int] = None
    tpm_limit: Optional[int] = None
    daily_limit: Optional[int] = None
    rpm_remaining: Optional[int] = None
    tpm_remaining: Optional[int] = None
    daily_remaining: Optional[int] = None
    cooldown_until: Optional[datetime] = None
    requests_used: int = 0
    tokens_used: int = 0
    last_used_at: Optional[datetime] = None
    last_error: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

    @field_serializer("api_key")
    def _mask(self, value: str) -> str:
        return crypto.mask(value)
