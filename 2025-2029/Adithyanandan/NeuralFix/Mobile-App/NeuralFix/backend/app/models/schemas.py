from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime


class ChatRequest(BaseModel):
    session_id: str
    message: str


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    expert_used: Optional[str] = None
    rag_used: bool = False


class SessionCreate(BaseModel):
    title: Optional[str] = "New Session"
    category: Optional[str] = "general"


class SessionOut(BaseModel):
    id: str
    title: str
    category: str = "general"
    status: str
    messages: List[dict] = []
    image_paths: List[str] = []
    diagnostic_report: Optional[str] = None
    device_info: Optional[Any] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SessionList(BaseModel):
    sessions: List[SessionOut]
    total: int


class ReportRequest(BaseModel):
    session_id: str


class ReportResponse(BaseModel):
    session_id: str
    report: str


class UploadResponse(BaseModel):
    session_id: str
    image_path: str
    vision_analysis: Optional[str] = None
    success: bool


class RAGStatusResponse(BaseModel):
    vector_store_loaded: bool
    docs_path: str
    vector_store_path: str
    docs_exist: bool
    index_exists: bool
