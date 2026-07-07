from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.db.database import get_db, TroubleshootingSession
from app.models.schemas import ChatRequest, ChatResponse
from app.services.claude_service import get_chat_response

router = APIRouter(prefix="/api/chat", tags=["Chat"])


@router.post("/", response_model=ChatResponse)
async def chat(body: ChatRequest, db: Session = Depends(get_db)):
    # Load session
    session = db.query(TroubleshootingSession).filter(
        TroubleshootingSession.id == body.session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Append user message to history
    messages = list(session.messages or [])
    user_msg = {
        "role": "user",
        "content": body.message,
        "timestamp": datetime.utcnow().isoformat(),
    }
    messages.append(user_msg)

    # Auto-title from first message
    if len(messages) == 1:
        session.title = body.message[:50] + ("..." if len(body.message) > 50 else "")

    # Check if we have vision context from the last image
    vision_context = ""
    if session.device_info:
        vision_context = str(session.device_info.get("latest_analysis", ""))

    # Get AI response
    try:
        reply = await get_chat_response(
            messages=messages,
            latest_user_message=body.message,
            vision_context=vision_context,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

    # Append assistant message
    assistant_msg = {
        "role": "assistant",
        "content": reply,
        "timestamp": datetime.utcnow().isoformat(),
    }
    messages.append(assistant_msg)

    # Persist
    session.messages = messages
    session.updated_at = datetime.utcnow()
    db.commit()

    return ChatResponse(
        session_id=body.session_id,
        reply=reply,
        rag_used=True,
    )
