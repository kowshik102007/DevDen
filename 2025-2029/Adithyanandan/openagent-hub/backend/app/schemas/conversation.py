from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class ConversationCreate(BaseModel):
    title: Optional[str] = "New Conversation"
    model: Optional[str] = None


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    project_id: Optional[UUID] = None


class AttachmentResponse(BaseModel):
    id: UUID
    filename: str
    content_type: str
    size: int

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    id: UUID
    role: str
    content: str
    created_at: datetime
    attachments: List["AttachmentResponse"] = []

    model_config = {"from_attributes": True}


class ConversationResponse(BaseModel):
    id: UUID
    title: str
    model: Optional[str]
    project_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConversationDetailResponse(ConversationResponse):
    messages: List[MessageResponse] = []


class TruncateRequest(BaseModel):
    from_message_id: UUID
