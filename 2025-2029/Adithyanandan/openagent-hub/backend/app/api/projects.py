from fastapi import APIRouter, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from app.core.database import get_db
from app.services.auth_service import get_current_user
from app.services.project_service import get_projects, create_project, update_project, delete_project
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse

router = APIRouter(prefix="/projects", tags=["projects"])
security = HTTPBearer()


def _current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    return get_current_user(db, credentials.credentials)


@router.get("", response_model=List[ProjectResponse])
def list_projects(user=Depends(_current_user), db: Session = Depends(get_db)):
    return get_projects(db, user.id)


@router.post("", response_model=ProjectResponse)
def create(data: ProjectCreate, user=Depends(_current_user), db: Session = Depends(get_db)):
    return create_project(db, user.id, data)


@router.patch("/{project_id}", response_model=ProjectResponse)
def update(project_id: UUID, data: ProjectUpdate, user=Depends(_current_user), db: Session = Depends(get_db)):
    return update_project(db, project_id, user.id, data)


@router.delete("/{project_id}")
def delete(project_id: UUID, user=Depends(_current_user), db: Session = Depends(get_db)):
    delete_project(db, project_id, user.id)
    return {"ok": True}
