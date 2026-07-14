"""
Pydantic models for request/response validation
"""
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime


# User Models
class UserRegister(BaseModel):
    name: str = Field(..., min_length=1)
    username: str = Field(..., min_length=5, max_length=20)
    password: str = Field(..., min_length=8)
    confirm_password: str

    @validator('confirm_password')
    def passwords_match(cls, v, values):
        if 'password' in values and v != values['password']:
            raise ValueError('Passwords do not match')
        return v


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    username: str
    last_login: Optional[str] = None
    is_active: bool = True


class ChangePassword(BaseModel):
    password: str
    new_password: str = Field(..., min_length=8)
    confirm_new_password: str

    @validator('confirm_new_password')
    def passwords_match(cls, v, values):
        if 'new_password' in values and v != values['new_password']:
            raise ValueError('Passwords do not match')
        return v


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


# Document Models
class DocumentResponse(BaseModel):
    filename: str
    doc_type: str
    upload_time: str
    batch_id: str
    username: str


# Chat Models
class ChatMessage(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    intent: str = Field(default="chat")


class ChatResponse(BaseModel):
    message: str


class ChatHistoryItem(BaseModel):
    timestamp: str
    user_message: str
    bot_response: Optional[Dict[str, Any]] = None


# Schedule Models
class ScheduleRequest(BaseModel):
    input: str = Field(..., min_length=1)
    title: Optional[str] = Field(default="AI Generated Schedule")
    description: Optional[str] = Field(default="")


class ScheduleGenerateFromChat(BaseModel):
    title: Optional[str] = Field(default="AI Generated Schedule")
    description: Optional[str] = Field(default="")


class ScheduleResponse(BaseModel):
    id: str
    title: str
    description: str
    created_at: str
    status: str
    # Additional fields will be dynamic based on LLM response
    class Config:
        extra = "allow"


# Generic Response Models
class MessageResponse(BaseModel):
    message: str


class ErrorResponse(BaseModel):
    error: str
