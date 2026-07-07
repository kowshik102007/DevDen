import os
import uuid
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException
from app.models.schemas import RAGStatusResponse
from app.services.rag_service import (
    get_rag_status,
    build_vector_store_from_docs,
    add_document_to_store,
)
from app.core.config import get_settings

router = APIRouter(prefix="/api/rag", tags=["RAG"])
settings = get_settings()


@router.get("/status", response_model=RAGStatusResponse)
def rag_status():
    """Returns current state of the RAG pipeline."""
    return get_rag_status()


@router.post("/reindex")
def reindex():
    """
    Rebuilds the entire FAISS vector store from scratch using all files in DOCS_PATH.
    Call this after adding new documents to the /docs folder.
    """
    docs_path = Path(settings.docs_path)
    if not docs_path.exists() or not any(docs_path.iterdir()):
        raise HTTPException(
            status_code=400,
            detail=f"No documents found in {settings.docs_path}. Add PDF or TXT files first."
        )
    try:
        build_vector_store_from_docs(str(docs_path))
        return {"status": "success", "message": "Vector store rebuilt successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload-doc")
async def upload_document(file: UploadFile = File(...)):
    """
    Upload a single PDF or TXT document and add it to the vector store immediately.
    Your teammate can use this endpoint to add new manuals without restarting the server.
    """
    ext = Path(file.filename).suffix.lower()
    if ext not in {".pdf", ".txt"}:
        raise HTTPException(status_code=400, detail="Only PDF and TXT files are supported.")

    docs_path = Path(settings.docs_path)
    docs_path.mkdir(parents=True, exist_ok=True)

    save_path = docs_path / f"{uuid.uuid4().hex}_{file.filename}"
    contents = await file.read()
    with open(save_path, "wb") as f:
        f.write(contents)

    try:
        chunk_count = add_document_to_store(str(save_path))
        return {
            "status": "success",
            "filename": file.filename,
            "chunks_added": chunk_count,
            "message": f"Document indexed successfully with {chunk_count} chunks.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
