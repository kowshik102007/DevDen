from fastapi import APIRouter, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from app.core.database import get_db
from app.services.auth_service import get_current_user
from app.services.conversation_service import (
    get_conversations,
    get_conversation,
    create_conversation,
    update_conversation,
    delete_conversation,
    truncate_messages,
)
from app.schemas.conversation import (
    ConversationCreate,
    ConversationUpdate,
    ConversationResponse,
    ConversationDetailResponse,
    TruncateRequest,
)

router = APIRouter(prefix="/conversations", tags=["conversations"])
security = HTTPBearer()


def _current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    return get_current_user(db, credentials.credentials)


@router.get("", response_model=List[ConversationResponse])
def list_conversations(
    project_id: Optional[UUID] = Query(None),
    user=Depends(_current_user),
    db: Session = Depends(get_db),
):
    return get_conversations(db, user.id, project_id=project_id)


@router.post("", response_model=ConversationResponse)
def create(data: ConversationCreate, user=Depends(_current_user), db: Session = Depends(get_db)):
    return create_conversation(db, user.id, data)


@router.get("/{conversation_id}", response_model=ConversationDetailResponse)
def get(conversation_id: UUID, user=Depends(_current_user), db: Session = Depends(get_db)):
    return get_conversation(db, conversation_id, user.id)


@router.patch("/{conversation_id}", response_model=ConversationResponse)
def update(
    conversation_id: UUID,
    data: ConversationUpdate,
    user=Depends(_current_user),
    db: Session = Depends(get_db),
):
    return update_conversation(db, conversation_id, user.id, data)


@router.delete("/{conversation_id}")
def delete(conversation_id: UUID, user=Depends(_current_user), db: Session = Depends(get_db)):
    delete_conversation(db, conversation_id, user.id)
    return {"ok": True}


@router.post("/{conversation_id}/truncate")
def truncate(
    conversation_id: UUID,
    body: TruncateRequest,
    user=Depends(_current_user),
    db: Session = Depends(get_db),
):
    get_conversation(db, conversation_id, user.id)  # ownership check
    truncate_messages(db, conversation_id, body.from_message_id)
    return {"ok": True}
