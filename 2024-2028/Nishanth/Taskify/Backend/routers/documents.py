"""
Document upload and management router for FastAPI
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from typing import List
import tempfile
import os
import logging

from models import DocumentResponse, MessageResponse
from dependencies import get_current_user
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)) + "/..")
from utils import process_doc, get_user_documents

router = APIRouter(prefix="/api/documents", tags=["documents"])
logger = logging.getLogger(__name__)


@router.post("/upload", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload and process a document"""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file name"
        )
    
    # Determine file type
    if file.filename.endswith(".pdf"):
        doc_type = "pdf"
    elif file.filename.endswith(".docx"):
        doc_type = "docx"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Please upload PDF or DOCX files."
        )
    
    try:
        username = current_user.get('username', 'unknown')
        
        # Save file to temporary directory
        with tempfile.TemporaryDirectory() as tmp_dir:
            save_path = os.path.join(tmp_dir, file.filename)
            
            # Write uploaded file
            with open(save_path, "wb") as buffer:
                content = await file.read()
                buffer.write(content)
            
            # Process document
            success, message = process_doc(save_path, doc_type, username)
        
        if not success:
            logger.warning(f'Document processing failed for {username}: {message}')
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Couldn't process document"
            )
        
        logger.info(f'Document uploaded successfully by {username}: {file.filename}')
        return MessageResponse(message="Successfully processed the document!")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error uploading document for {username}: {str(e)}')
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Upload failed"
        )


@router.get("/", response_model=List[DocumentResponse])
async def list_documents(current_user: dict = Depends(get_current_user)):
    """Get all documents uploaded by the current user"""
    username = current_user.get('username', '')
    documents = get_user_documents(username)
    return documents


@router.delete("/{batch_id}", response_model=MessageResponse)
async def delete_document(
    batch_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a document by batch ID"""
    # Note: Implement actual deletion logic with Pinecone if needed
    logger.info(f'Document deletion requested by {current_user["username"]}: {batch_id}')
    return MessageResponse(message="Document deletion requested (implement Pinecone deletion)")
