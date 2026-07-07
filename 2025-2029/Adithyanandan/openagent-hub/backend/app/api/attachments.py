import os
import uuid
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.auth_service import get_current_user
from app.models.attachment import Attachment

router = APIRouter(prefix="/attachments", tags=["attachments"])
security = HTTPBearer()
UPLOAD_DIR = "/app/uploads"

os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "text/plain", "text/markdown", "text/csv",
    "application/json",
}
MAX_SIZE = 20 * 1024 * 1024  # 20 MB


def _current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    return get_current_user(db, credentials.credentials)


@router.post("")
async def upload(
    file: UploadFile = File(...),
    user=Depends(_current_user),
    db: Session = Depends(get_db),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"File type {file.content_type} not allowed")

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 20 MB)")

    ext = os.path.splitext(file.filename or "")[1]
    stored_name = f"{uuid.uuid4()}{ext}"
    path = os.path.join(UPLOAD_DIR, stored_name)

    with open(path, "wb") as f:
        f.write(content)

    attachment = Attachment(
        user_id=user.id,
        filename=file.filename or stored_name,
        content_type=file.content_type,
        file_path=path,
        size=len(content),
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    return {
        "id": str(attachment.id),
        "filename": attachment.filename,
        "content_type": attachment.content_type,
        "size": attachment.size,
    }


@router.get("/{attachment_id}")
def download(attachment_id: str, user=Depends(_current_user), db: Session = Depends(get_db)):
    att = db.query(Attachment).filter(
        Attachment.id == attachment_id,
        Attachment.user_id == user.id,
    ).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    return FileResponse(att.file_path, filename=att.filename, media_type=att.content_type)
