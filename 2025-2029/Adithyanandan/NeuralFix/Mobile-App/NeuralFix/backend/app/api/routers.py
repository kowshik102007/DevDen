from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime
import uuid
from pathlib import Path

from app.db.database import get_db, TroubleshootingSession
from app.models.schemas import *
from app.services.groq_service import get_chat_response, generate_diagnostic_report
from app.services.vision_service import analyze_equipment_image
from app.services.rag_service import get_rag_status, build_vector_store_from_docs, add_document_to_store
from app.core.config import get_settings

settings = get_settings()

# ── Sessions ──────────────────────────────────────────────────────────────────
sessions_router = APIRouter(prefix="/api/sessions", tags=["Sessions"])

@sessions_router.post("/", response_model=SessionOut)
def create_session(body: SessionCreate, db: Session = Depends(get_db)):
    s = TroubleshootingSession(id=str(uuid.uuid4()), title=body.title or "New Session", category=body.category or "general", messages=[], image_paths=[])
    db.add(s); db.commit(); db.refresh(s)
    return s

@sessions_router.get("/", response_model=SessionList)
def list_sessions(db: Session = Depends(get_db)):
    sessions = db.query(TroubleshootingSession).order_by(TroubleshootingSession.updated_at.desc()).all()
    return SessionList(sessions=sessions, total=len(sessions))

@sessions_router.get("/{session_id}", response_model=SessionOut)
def get_session(session_id: str, db: Session = Depends(get_db)):
    s = db.query(TroubleshootingSession).filter(TroubleshootingSession.id == session_id).first()
    if not s: raise HTTPException(404, "Session not found")
    return s

@sessions_router.patch("/{session_id}/status")
def update_status(session_id: str, status: str, db: Session = Depends(get_db)):
    s = db.query(TroubleshootingSession).filter(TroubleshootingSession.id == session_id).first()
    if not s: raise HTTPException(404, "Session not found")
    if status not in {"active", "resolved", "escalated"}: raise HTTPException(400, "Invalid status")
    s.status = status; s.updated_at = datetime.utcnow(); db.commit()
    return {"session_id": session_id, "status": status}

@sessions_router.delete("/{session_id}")
def delete_session(session_id: str, db: Session = Depends(get_db)):
    s = db.query(TroubleshootingSession).filter(TroubleshootingSession.id == session_id).first()
    if not s: raise HTTPException(404, "Session not found")
    db.delete(s); db.commit()
    return {"deleted": session_id}


# ── Chat ──────────────────────────────────────────────────────────────────────
chat_router = APIRouter(prefix="/api/chat", tags=["Chat"])

@chat_router.post("/", response_model=ChatResponse)
async def chat(body: ChatRequest, db: Session = Depends(get_db)):
    s = db.query(TroubleshootingSession).filter(TroubleshootingSession.id == body.session_id).first()
    if not s: raise HTTPException(404, "Session not found")
    messages = list(s.messages or [])
    messages.append({"role": "user", "content": body.message, "timestamp": datetime.utcnow().isoformat()})
    if len(messages) == 1:
        s.title = body.message[:50] + ("..." if len(body.message) > 50 else "")
    vision_context = ""
    if s.device_info and "images" in s.device_info and len(s.device_info["images"]) > 0:
        # Get the analysis of the most recently uploaded image
        latest_img = s.device_info["images"][-1]
        vision_context = latest_img.get("analysis", "")
    try:
        reply, expert = await get_chat_response(messages=messages, latest_user_message=body.message, vision_context=vision_context)
    except Exception as e:
        raise HTTPException(500, f"AI error: {str(e)}")
    messages.append({"role": "assistant", "content": reply, "expert_used": expert, "timestamp": datetime.utcnow().isoformat()})
    s.messages = messages; s.updated_at = datetime.utcnow(); db.commit()
    return ChatResponse(session_id=body.session_id, reply=reply, expert_used=expert, rag_used=(expert == "rag"))


# ── Images ────────────────────────────────────────────────────────────────────
images_router = APIRouter(prefix="/api/images", tags=["Images"])
UPLOAD_DIR = Path("./uploads"); UPLOAD_DIR.mkdir(exist_ok=True)

@images_router.post("/upload", response_model=UploadResponse)
async def upload_image(session_id: str = Form(...), file: UploadFile = File(...), db: Session = Depends(get_db)):
    s = db.query(TroubleshootingSession).filter(TroubleshootingSession.id == session_id).first()
    if not s: raise HTTPException(404, "Session not found")
    ext = Path(file.filename).suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".gif", ".webp"}: raise HTTPException(400, "Invalid file type")
    filename = f"{uuid.uuid4()}{ext}"
    file_path = UPLOAD_DIR / filename
    with open(file_path, "wb") as f: f.write(await file.read())
    vision_result = await analyze_equipment_image(str(file_path))
    vision_text = vision_result.get("analysis", "") if vision_result.get("success") else ""
    image_paths = list(s.image_paths or []); image_paths.append(str(file_path)); s.image_paths = image_paths
    device_info = dict(s.device_info or {}); device_info["latest_analysis"] = vision_text
    device_info.setdefault("images", []).append({"path": str(file_path), "filename": file.filename, "analysis": vision_text, "uploaded_at": datetime.utcnow().isoformat()})
    s.device_info = device_info; s.updated_at = datetime.utcnow(); db.commit()
    return UploadResponse(session_id=session_id, image_path=f"/api/images/file/{filename}", vision_analysis=vision_text, success=True)

@images_router.get("/file/{filename}")
def serve_image(filename: str):
    fp = UPLOAD_DIR / filename
    if not fp.exists(): raise HTTPException(404, "Not found")
    return FileResponse(str(fp))


# ── Reports ───────────────────────────────────────────────────────────────────
reports_router = APIRouter(prefix="/api/reports", tags=["Reports"])

@reports_router.post("/generate", response_model=ReportResponse)
async def gen_report(body: ReportRequest, db: Session = Depends(get_db)):
    s = db.query(TroubleshootingSession).filter(TroubleshootingSession.id == body.session_id).first()
    if not s: raise HTTPException(404, "Session not found")
    if len(s.messages or []) < 2: raise HTTPException(400, "Not enough conversation.")
    try:
        report = await generate_diagnostic_report({"title": s.title, "category": s.category, "messages": s.messages, "device_info": s.device_info})
    except Exception as e:
        raise HTTPException(500, str(e))
    s.diagnostic_report = report; s.status = "escalated"; s.updated_at = datetime.utcnow(); db.commit()
    return ReportResponse(session_id=body.session_id, report=report)

@reports_router.get("/{session_id}", response_model=ReportResponse)
def get_report(session_id: str, db: Session = Depends(get_db)):
    s = db.query(TroubleshootingSession).filter(TroubleshootingSession.id == session_id).first()
    if not s: raise HTTPException(404, "Not found")
    if not s.diagnostic_report: raise HTTPException(404, "No report yet.")
    return ReportResponse(session_id=session_id, report=s.diagnostic_report)


# ── RAG ───────────────────────────────────────────────────────────────────────
rag_router = APIRouter(prefix="/api/rag", tags=["RAG"])

@rag_router.get("/status")
def rag_status(): return get_rag_status()

@rag_router.post("/reindex")
def reindex():
    docs_path = Path(settings.docs_path)
    if not docs_path.exists() or not any(docs_path.iterdir()): raise HTTPException(400, "No documents found.")
    build_vector_store_from_docs(str(docs_path))
    return {"status": "success"}

@rag_router.post("/upload-doc")
async def upload_doc(file: UploadFile = File(...)):
    ext = Path(file.filename).suffix.lower()
    if ext not in {".pdf", ".txt"}: raise HTTPException(400, "Only PDF/TXT supported.")
    docs_path = Path(settings.docs_path); docs_path.mkdir(parents=True, exist_ok=True)
    save_path = docs_path / f"{uuid.uuid4().hex}_{file.filename}"
    with open(save_path, "wb") as f: f.write(await file.read())
    chunks = add_document_to_store(str(save_path))
    return {"status": "success", "chunks_added": chunks}
