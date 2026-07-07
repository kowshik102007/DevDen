from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate
from typing import List
from uuid import UUID
from fastapi import HTTPException


def get_projects(db: Session, user_id: UUID) -> List[Project]:
    return db.query(Project).filter(Project.user_id == user_id).order_by(desc(Project.updated_at)).all()


def get_project(db: Session, project_id: UUID, user_id: UUID) -> Project:
    p = db.query(Project).filter(Project.id == project_id, Project.user_id == user_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


def create_project(db: Session, user_id: UUID, data: ProjectCreate) -> Project:
    p = Project(user_id=user_id, name=data.name, description=data.description)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def update_project(db: Session, project_id: UUID, user_id: UUID, data: ProjectUpdate) -> Project:
    p = get_project(db, project_id, user_id)
    if data.name is not None:
        p.name = data.name
    if data.description is not None:
        p.description = data.description
    db.commit()
    db.refresh(p)
    return p


def delete_project(db: Session, project_id: UUID, user_id: UUID) -> None:
    p = get_project(db, project_id, user_id)
    db.delete(p)
    db.commit()
