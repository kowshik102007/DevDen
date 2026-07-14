import os
from fastapi import APIRouter, UploadFile, File, HTTPException
from models.models import ChatQuery
from services.chat_service import (
    upload_to_pageindex,
    check_document_status,
    get_registry,
    vectorless_rag_pipeline
)

router = APIRouter(prefix="/api/v1")

# Ensure uploads directory exists
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
async def upload(file: UploadFile = File(...)):
    """
    Upload a document, save it locally, and submit to PageIndex for indexing.
    """
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    
    try:
        # Save file locally
        with open(file_path, "wb") as f:
            f.write(await file.read())
            
        # Submit to PageIndex and register locally
        res = upload_to_pageindex(file_path=file_path, filename=file.filename)
        return res
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload document: {str(e)}")

@router.get("/documents")
async def get_documents():
    """
    Get all uploaded documents and their statuses.
    """
    registry = get_registry()
    # Strip tree data to keep list API lightweight
    lightweight_list = []
    for doc_id, doc in registry.items():
        lightweight_list.append({
            "doc_id": doc["doc_id"],
            "filename": doc["filename"],
            "status": doc["status"],
            "uploaded_at": doc.get("uploaded_at", 0),
            "has_tree": doc.get("tree") is not None
        })
    # Sort by upload time (newest first)
    lightweight_list.sort(key=lambda x: x["uploaded_at"], reverse=True)
    return lightweight_list

@router.get("/documents/{doc_id}")
async def get_document(doc_id: str):
    """
    Check the current indexing status of a document, updates registry if completed, and returns full metadata (including tree).
    """
    doc_info = check_document_status(doc_id)
    if "error" in doc_info:
        raise HTTPException(status_code=404, detail=doc_info["error"])
    return doc_info

@router.post("/documents/{doc_id}/chat")
async def chat_with_document(doc_id: str, chat_query: ChatQuery):
    """
    Query the document tree using Vectorless RAG.
    """
    registry = get_registry()
    if doc_id not in registry:
        raise HTTPException(status_code=404, detail="Document not found")
        
    doc_info = check_document_status(doc_id)
    
    if doc_info["status"] != "completed":
        raise HTTPException(
            status_code=400, 
            detail=f"Document is not ready for chat yet. Current status: {doc_info['status']}"
        )
        
    if not doc_info.get("tree"):
        raise HTTPException(status_code=500, detail="Document tree structure is missing.")
        
    try:
        res = vectorless_rag_pipeline(query=chat_query.query, tree=doc_info["tree"])
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG execution failed: {str(e)}")

@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    """
    Delete a document from registry and local filesystem.
    """
    registry = get_registry()
    if doc_id not in registry:
        raise HTTPException(status_code=404, detail="Document not found")
        
    doc_info = registry[doc_id]
    
    # Try deleting local file if it exists
    filename = doc_info.get("filename")
    if filename:
        file_path = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                print(f"Error removing file {file_path}: {str(e)}")
                
    # Remove from registry
    del registry[doc_id]
    save_registry(registry)
    
    return {"success": True, "message": "Document deleted successfully"}
