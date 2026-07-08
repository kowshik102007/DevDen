from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.conversation import Conversation
from app.models.message import Message
from app.schemas.conversation import ConversationCreate, ConversationUpdate
from typing import List
from uuid import UUID
from fastapi import HTTPException


def get_conversations(db: Session, user_id: UUID, project_id: UUID = None) -> List[Conversation]:
    q = db.query(Conversation).filter(Conversation.user_id == user_id)
    if project_id is not None:
        q = q.filter(Conversation.project_id == project_id)
    return q.order_by(desc(Conversation.updated_at)).all()


def get_conversation(db: Session, conversation_id: UUID, user_id: UUID) -> Conversation:
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == user_id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


def create_conversation(db: Session, user_id: UUID, data: ConversationCreate) -> Conversation:
    conv = Conversation(user_id=user_id, title=data.title or "New Conversation", model=data.model)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def update_conversation(db: Session, conversation_id: UUID, user_id: UUID, data: ConversationUpdate) -> Conversation:
    conv = get_conversation(db, conversation_id, user_id)
    if data.title is not None:
        conv.title = data.title
    if data.project_id is not None:
        conv.project_id = data.project_id
    db.commit()
    db.refresh(conv)
    return conv


def delete_conversation(db: Session, conversation_id: UUID, user_id: UUID) -> None:
    conv = get_conversation(db, conversation_id, user_id)
    db.delete(conv)
    db.commit()


def add_message(db: Session, conversation_id: UUID, role: str, content: str) -> Message:
    msg = Message(conversation_id=conversation_id, role=role, content=content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


def truncate_messages(db: Session, conversation_id: UUID, from_message_id: UUID) -> None:
    pivot = db.query(Message).filter(
        Message.id == from_message_id,
        Message.conversation_id == conversation_id,
    ).first()
    if not pivot:
        return
    db.query(Message).filter(
        Message.conversation_id == conversation_id,
        Message.created_at >= pivot.created_at,
    ).delete(synchronize_session=False)
    db.commit()


def auto_title_conversation(db: Session, conversation_id: UUID, first_message: str) -> None:
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conv and conv.title == "New Conversation":
        title = first_message[:60].strip()
        if len(first_message) > 60:
            title += "..."
        conv.title = title
        db.commit()
