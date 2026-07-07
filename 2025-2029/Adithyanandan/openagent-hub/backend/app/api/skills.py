from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.auth_service import get_current_user
from app.services import skill_service
from app.schemas.agent import SkillCreate, SkillUpdate, SkillResponse

router = APIRouter(prefix="/skills", tags=["skills"])
security = HTTPBearer()


def _current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    return get_current_user(db, credentials.credentials)


@router.get("", response_model=List[SkillResponse])
def list_skills(user=Depends(_current_user), db: Session = Depends(get_db)):
    return skill_service.list_skills(db, user.id)


@router.post("", response_model=SkillResponse, status_code=201)
def create_skill(data: SkillCreate, user=Depends(_current_user), db: Session = Depends(get_db)):
    return skill_service.create_skill(db, user.id, data.model_dump())


@router.patch("/{skill_id}", response_model=SkillResponse)
def update_skill(skill_id: UUID, data: SkillUpdate, user=Depends(_current_user), db: Session = Depends(get_db)):
    return skill_service.update_skill(db, user.id, skill_id, data.model_dump(exclude_none=True))


@router.delete("/{skill_id}", status_code=204)
def delete_skill(skill_id: UUID, user=Depends(_current_user), db: Session = Depends(get_db)):
    skill_service.delete_skill(db, user.id, skill_id)
