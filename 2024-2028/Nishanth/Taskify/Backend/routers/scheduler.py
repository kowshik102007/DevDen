"""
Scheduler and chat router for FastAPI
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any
from datetime import datetime
import logging
import json

from models import (
    ChatMessage, ChatResponse, ChatHistoryItem,
    ScheduleRequest, ScheduleGenerateFromChat, ScheduleResponse,
    MessageResponse
)
from dependencies import get_current_user
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)) + "/..")
from utils import get_context, process_schedule
from langchain_google_genai import ChatGoogleGenerativeAI

router = APIRouter(prefix="/api/scheduler", tags=["scheduler"])
logger = logging.getLogger(__name__)

# In-memory storage (consider using Redis for production)
chats: Dict[str, List[Dict]] = {}
schedules: List[Dict] = []

# Initialize LLM
llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash-exp", temperature=0.2)


@router.post("/chat", response_model=ChatResponse)
async def chat(
    message_data: ChatMessage,
    current_user: dict = Depends(get_current_user)
):
    """Chat with AI assistant"""
    message = message_data.message.strip()
    intent = message_data.intent
    
    try:
        # Get existing schedules for context
        schedule_context = ""
        if schedules:
            schedule_list = []
            for s in schedules[-5:]:  # Last 5 schedules
                tasks_summary = ", ".join([t.get('title', '') for t in s.get('tasks', [])[:3]])
                schedule_list.append(f"- {s.get('title', 'Untitled')}: {tasks_summary}")
            schedule_context = "\n\nYour recent schedules:\n" + "\n".join(schedule_list)
        
        # Create schedule-aware prompt based on intent
        if intent == 'schedule_prep':
            enhanced_message = f"""You are a helpful AI schedule assistant. The user has said: "{message}"

Provide a brief, encouraging acknowledgment (1-2 sentences) confirming you understand their request. Mention that you'll use this information when they generate their schedule."""
        else:
            enhanced_message = f"""You are a helpful AI schedule assistant. The user has asked: "{message}"
{schedule_context}

Provide a helpful, concise response. If they're asking about scheduling, remind them they can click 'Generate Schedule' to create a personalized schedule."""
        
        response = llm.invoke(enhanced_message).content or ""
        response_str = str(response).strip()
        
        llm_response = ChatResponse(message=response_str)
        
    except Exception as e:
        logger.error(f"Chat error: {e}")
        llm_response = ChatResponse(
            message="I'm your AI schedule assistant! I can help you create schedules, manage tasks, and provide productivity tips. Just tell me what you want to do!"
        )
    
    # Store in session
    session_id = current_user.get("username", "anon")
    if session_id not in chats:
        chats[session_id] = []
    
    chats[session_id].append({
        'timestamp': datetime.now().isoformat(),
        'user_message': message[:500],
        'bot_response': llm_response.dict()
    })
    
    # Keep only last 50 messages
    if len(chats[session_id]) > 50:
        chats[session_id] = chats[session_id][-50:]
    
    return llm_response


@router.get("/chat/history", response_model=List[ChatHistoryItem])
async def get_chat_history(current_user: dict = Depends(get_current_user)):
    """Get chat history for current user"""
    session_id = current_user.get("username", "anon")
    return chats.get(session_id, [])


@router.post("/chat/clear", response_model=MessageResponse)
async def clear_chat_history(current_user: dict = Depends(get_current_user)):
    """Clear chat history"""
    session_id = current_user.get("username", "anon")
    chats[session_id] = []
    return MessageResponse(message="Chat history cleared")


@router.post("/generate", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
async def generate_schedule(
    schedule_data: ScheduleRequest,
    current_user: dict = Depends(get_current_user)
):
    """Generate a schedule from user input"""
    user_input = schedule_data.input.strip()
    title = schedule_data.title or "AI Generated Schedule"
    description = schedule_data.description or ""
    
    try:
        username = current_user.get('username', 'unknown')
        context, _analysis = get_context(user_input)
        schedule = process_schedule(user_input, context)
        
        # Enrich for frontend
        schedule_obj = {
            **schedule,
            "id": f"sch-{len(schedules) + 1}",
            "title": title or schedule.get("title", "AI Generated Schedule"),
            "description": description or schedule.get("description", ""),
            "created_at": datetime.now().isoformat(),
            "status": "active"
        }
        
        schedules.append(schedule_obj)
        logger.info(f'Schedule generated for {username}: {title}')
        
        return schedule_obj
        
    except Exception as e:
        logger.error(f'Error generating schedule: {str(e)}')
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate schedule"
        )


@router.post("/generate-from-chat", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
async def generate_from_chat(
    schedule_data: ScheduleGenerateFromChat,
    current_user: dict = Depends(get_current_user)
):
    """Generate a schedule using the latest chat message"""
    session_id = current_user.get("username", "anon")
    history = chats.get(session_id, [])
    
    # Find latest user message
    latest_message = None
    for m in reversed(history):
        text = (m.get('user_message', '') or '').strip()
        if text:
            latest_message = text
            break
    
    if not latest_message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No recent chat message found. Send a message in the dashboard chat first."
        )
    
    title = schedule_data.title or "AI Generated Schedule"
    description = schedule_data.description or ""
    
    try:
        username = current_user.get('username', 'unknown')
        context, _analysis = get_context(latest_message)
        schedule = process_schedule(latest_message, context)
        
        schedule_obj = {
            **schedule,
            "id": f"sch-{len(schedules) + 1}",
            "title": title or schedule.get("title", "AI Generated Schedule"),
            "description": description or schedule.get("description", ""),
            "created_at": datetime.now().isoformat(),
            "status": "active"
        }
        
        schedules.append(schedule_obj)
        logger.info(f'Schedule generated from chat for {username}: {title}')
        
        return schedule_obj
        
    except Exception as e:
        logger.error(f'Error generating schedule from chat: {str(e)}')
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate schedule from chat"
        )


@router.get("/schedules", response_model=List[Dict[str, Any]])
async def list_schedules(current_user: dict = Depends(get_current_user)):
    """Get all schedules"""
    return schedules


@router.get("/schedules/{schedule_id}")
async def get_schedule(
    schedule_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific schedule"""
    for s in schedules:
        if s.get('id') == schedule_id:
            return s
    
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Schedule not found"
    )


@router.delete("/schedules/{schedule_id}", response_model=MessageResponse)
async def delete_schedule(
    schedule_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a schedule"""
    global schedules
    before = len(schedules)
    schedules = [s for s in schedules if s.get('id') != schedule_id]
    
    if len(schedules) == before:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found"
        )
    
    return MessageResponse(message="Schedule deleted successfully")
