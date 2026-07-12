from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
from datetime import datetime

from app.db.database import get_db, TroubleshootingSession
from app.models.schemas import SessionCreate, SessionOut, SessionList

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])


@router.post("/", response_model=SessionOut)
def create_session(body: SessionCreate, db: Session = Depends(get_db)):
    session = TroubleshootingSession(
        id=str(uuid.uuid4()),
        title=body.title or "New Session",
        messages=[],
        image_paths=[],
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/", response_model=SessionList)
def list_sessions(db: Session = Depends(get_db)):
    sessions = db.query(TroubleshootingSession).order_by(
        TroubleshootingSession.updated_at.desc()
    ).all()
    return SessionList(sessions=sessions, total=len(sessions))


@router.get("/{session_id}", response_model=SessionOut)
def get_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(TroubleshootingSession).filter(
        TroubleshootingSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.patch("/{session_id}/status")
def update_status(session_id: str, status: str, db: Session = Depends(get_db)):
    session = db.query(TroubleshootingSession).filter(
        TroubleshootingSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    valid = {"active", "resolved", "escalated"}
    if status not in valid:
        raise HTTPException(status_code=400, detail=f"Status must be one of {valid}")
    session.status = status
    session.updated_at = datetime.utcnow()
    db.commit()
    return {"session_id": session_id, "status": status}


@router.delete("/{session_id}")
def delete_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(TroubleshootingSession).filter(
        TroubleshootingSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"deleted": session_id}
