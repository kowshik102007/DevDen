from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.db.database import get_db, TroubleshootingSession
from app.models.schemas import ReportRequest, ReportResponse
from app.services.claude_service import generate_diagnostic_report

router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.post("/generate", response_model=ReportResponse)
async def generate_report(body: ReportRequest, db: Session = Depends(get_db)):
    session = db.query(TroubleshootingSession).filter(
        TroubleshootingSession.id == body.session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if len(session.messages or []) < 2:
        raise HTTPException(
            status_code=400,
            detail="Not enough conversation history to generate a report. Complete some troubleshooting first."
        )

    # Generate via Claude
    try:
        report = await generate_diagnostic_report({
            "title": session.title,
            "messages": session.messages,
            "device_info": session.device_info,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")

    # Persist report and escalate status
    session.diagnostic_report = report
    session.status = "escalated"
    session.updated_at = datetime.utcnow()
    db.commit()

    return ReportResponse(session_id=body.session_id, report=report)


@router.get("/{session_id}", response_model=ReportResponse)
def get_report(session_id: str, db: Session = Depends(get_db)):
    session = db.query(TroubleshootingSession).filter(
        TroubleshootingSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not session.diagnostic_report:
        raise HTTPException(status_code=404, detail="No report generated yet for this session")
    return ReportResponse(session_id=session_id, report=session.diagnostic_report)
