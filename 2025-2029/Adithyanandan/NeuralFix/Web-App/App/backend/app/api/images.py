import os
import uuid
from pathlib import Path
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.database import get_db, TroubleshootingSession
from app.models.schemas import UploadResponse
from app.services.vision_service import analyze_equipment_image

router = APIRouter(prefix="/api/images", tags=["Images"])

UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


@router.post("/upload", response_model=UploadResponse)
async def upload_image(
    session_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    # Validate session
    session = db.query(TroubleshootingSession).filter(
        TroubleshootingSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Validate file type
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type {ext} not allowed. Use: {ALLOWED_EXTENSIONS}")

    # Save file
    file_id = str(uuid.uuid4())
    filename = f"{file_id}{ext}"
    file_path = UPLOAD_DIR / filename

    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    # Run vision analysis
    vision_result = await analyze_equipment_image(str(file_path))
    vision_text = vision_result.get("analysis", "") if vision_result.get("success") else ""

    # Persist to session
    image_paths = list(session.image_paths or [])
    image_paths.append(str(file_path))
    session.image_paths = image_paths

    # Store latest vision analysis in device_info
    device_info = dict(session.device_info or {})
    device_info["latest_analysis"] = vision_text
    device_info["images"] = device_info.get("images", [])
    device_info["images"].append({
        "path": str(file_path),
        "filename": file.filename,
        "analysis": vision_text,
        "uploaded_at": datetime.utcnow().isoformat(),
    })
    session.device_info = device_info
    session.updated_at = datetime.utcnow()
    db.commit()

    return UploadResponse(
        session_id=session_id,
        image_path=f"/api/images/file/{filename}",
        vision_analysis=vision_text,
        success=True,
    )


@router.get("/file/{filename}")
def serve_image(filename: str):
    """Serves uploaded images back to the mobile app."""
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(str(file_path))
