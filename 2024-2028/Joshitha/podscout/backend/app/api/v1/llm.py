"""LLM API endpoints."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Literal, Optional
from ...llm.groq_client import GroqClient
from ...llm.gemini_client import GeminiClient

router = APIRouter(prefix="/llm", tags=["llm"])


class ChatMessage(BaseModel):
    """Chat message model."""
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    """Chat request model."""
    messages: List[ChatMessage]
    provider: Literal["groq", "gemini"] = "groq"
    temperature: float = 0.7
    max_tokens: int = 1024


class ChatResponse(BaseModel):
    """Chat response model."""
    content: str
    provider: str
    model: str


@router.post("/chat", response_model=ChatResponse)
async def chat_completion(request: ChatRequest):
    """
    Direct LLM chat endpoint.
    
    Supports both Groq and Gemini.
    """
    try:
        if request.provider == "groq":
            messages = [msg.model_dump() for msg in request.messages]
            content = GroqClient.chat_completion(
                messages=messages,
                temperature=request.temperature,
                max_tokens=request.max_tokens
            )
            model = "mixtral-8x7b-32768"
        else:  # gemini
            # Combine messages into single prompt
            prompt = "\n".join([
                f"{msg.role}: {msg.content}"
                for msg in request.messages
            ])
            content = GeminiClient.generate_content(
                prompt=prompt,
                temperature=request.temperature,
                max_tokens=request.max_tokens
            )
            model = "gemini-2.0-flash-exp"
        
        return ChatResponse(
            content=content,
            provider=request.provider,
            model=model
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/providers")
async def list_providers():
    """List available LLM providers."""
    return {
        "providers": [
            {
                "name": "groq",
                "description": "Fast inference with Mixtral",
                "models": ["mixtral-8x7b-32768"]
            },
            {
                "name": "gemini",
                "description": "Google Gemini for strategic content",
                "models": ["gemini-2.0-flash-exp"]
            }
        ]
    }
