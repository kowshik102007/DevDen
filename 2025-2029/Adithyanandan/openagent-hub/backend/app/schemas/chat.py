from pydantic import BaseModel, field_serializer
from typing import Optional, List
from uuid import UUID

from app.core import crypto


class ChatRequest(BaseModel):
    conversation_id: Optional[UUID] = None
    message: str
    model: Optional[str] = None
    provider_id: Optional[UUID] = None
    attachment_ids: Optional[List[UUID]] = None
    use_tools: bool = False
    tool_mode: Optional[str] = None  # "off" | "auto" | "always"; falls back to use_tools
    tool_names: Optional[List[str]] = None  # restrict to these tools; None/[] = all available
    skill_id: Optional[UUID] = None
    skill_auto: bool = False  # when true (and no explicit skill_id), let the model adopt the most relevant skill
    routing_mode: Optional[str] = "balanced"  # "speed" | "quality" | "reliability" | "balanced"


class ProviderConfigRequest(BaseModel):
    name: Optional[str] = "Default"
    base_url: str
    api_key: str
    model: str


class ProviderConfigResponse(BaseModel):
    id: UUID
    name: str
    base_url: str
    api_key: str
    model: str
    is_default: bool

    model_config = {"from_attributes": True}

    @field_serializer("api_key")
    def _mask_api_key(self, value: str) -> str:
        return crypto.mask(value)
