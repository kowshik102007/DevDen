from uuid import UUID
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.auth_service import get_current_user
from app.services import memory_service
from app.schemas.agent import MemoryCreate, MemoryUpdate, MemoryResponse

router = APIRouter(prefix="/memory", tags=["memory"])
security = HTTPBearer()


def _current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    return get_current_user(db, credentials.credentials)


@router.get("", response_model=List[MemoryResponse])
def list_memory(
    scope: Optional[str] = Query(None),
    project_id: Optional[UUID] = Query(None),
    conversation_id: Optional[UUID] = Query(None),
    user=Depends(_current_user),
    db: Session = Depends(get_db),
):
    return memory_service.list_memories(db, user.id, scope, project_id, conversation_id)


@router.post("", response_model=MemoryResponse, status_code=201)
def create_memory(data: MemoryCreate, user=Depends(_current_user), db: Session = Depends(get_db)):
    return memory_service.create_memory(
        db, user.id, data.content, data.scope, data.project_id, data.conversation_id
    )


@router.patch("/{memory_id}", response_model=MemoryResponse)
def update_memory(memory_id: UUID, data: MemoryUpdate, user=Depends(_current_user), db: Session = Depends(get_db)):
    return memory_service.update_memory(db, user.id, memory_id, data.content)


@router.delete("/{memory_id}", status_code=204)
def delete_memory(memory_id: UUID, user=Depends(_current_user), db: Session = Depends(get_db)):
    memory_service.delete_memory(db, user.id, memory_id)
