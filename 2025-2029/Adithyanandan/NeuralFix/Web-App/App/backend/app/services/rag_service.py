"""
RAG Service — LangChain + FAISS
================================
This is the integration point for the RAG pipeline.
Your teammate can replace the internals of each method while keeping
the same interface used by the rest of the app.

Current state:
  - Document loading & chunking: implemented
  - FAISS vector store: implemented
  - Retrieval: implemented
  - Embeddings: HuggingFace sentence-transformers (runs locally, no API key needed)
"""

import os
import logging
from pathlib import Path
from typing import List, Optional

from langchain_community.document_loaders import PyPDFLoader, TextLoader, DirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ─── Singleton vector store (loaded once at startup) ──────────────────────────
_vector_store: Optional[FAISS] = None
_embeddings: Optional[HuggingFaceEmbeddings] = None


def _get_embeddings() -> HuggingFaceEmbeddings:
    global _embeddings
    if _embeddings is None:
        logger.info("Loading embedding model (all-MiniLM-L6-v2)...")
        _embeddings = HuggingFaceEmbeddings(
            model_name="all-MiniLM-L6-v2",
            model_kwargs={"device": "cpu"},
        )
    return _embeddings


def load_or_create_vector_store() -> Optional[FAISS]:
    """
    Called at startup. Loads FAISS index from disk if it exists,
    otherwise builds it from documents in DOCS_PATH.
    """
    global _vector_store
    store_path = Path(settings.vector_store_path)
    docs_path = Path(settings.docs_path)

    embeddings = _get_embeddings()

    # Try loading existing index
    if (store_path / "index.faiss").exists():
        logger.info(f"Loading existing vector store from {store_path}")
        try:
            _vector_store = FAISS.load_local(
                str(store_path),
                embeddings,
                allow_dangerous_deserialization=True,
            )
            logger.info("Vector store loaded successfully.")
            return _vector_store
        except Exception as e:
            logger.warning(f"Failed to load vector store: {e}. Rebuilding...")

    # Build from docs
    if docs_path.exists() and any(docs_path.iterdir()):
        logger.info(f"Building vector store from docs in {docs_path}")
        _vector_store = build_vector_store_from_docs(str(docs_path))
    else:
        logger.warning(
            f"No documents found in {docs_path}. "
            "RAG will return empty context until documents are added. "
            "Drop PDF or TXT files into the /docs folder and call POST /api/rag/reindex."
        )
        _vector_store = None

    return _vector_store


def build_vector_store_from_docs(docs_path: str) -> Optional[FAISS]:
    """
    Loads all PDFs and TXTs from docs_path, chunks them, embeds, and saves FAISS index.
    ── YOUR TEAMMATE CAN REPLACE THIS with their own loading/chunking logic ──
    """
    global _vector_store
    embeddings = _get_embeddings()
    store_path = Path(settings.vector_store_path)
    store_path.mkdir(parents=True, exist_ok=True)

    documents = []

    # Load PDFs
    pdf_loader = DirectoryLoader(
        docs_path,
        glob="**/*.pdf",
        loader_cls=PyPDFLoader,
        silent_errors=True,
    )
    # Load TXTs
    txt_loader = DirectoryLoader(
        docs_path,
        glob="**/*.txt",
        loader_cls=TextLoader,
        silent_errors=True,
    )

    try:
        documents.extend(pdf_loader.load())
        documents.extend(txt_loader.load())
    except Exception as e:
        logger.error(f"Error loading documents: {e}")

    if not documents:
        logger.warning("No documents loaded for RAG.")
        return None

    # Chunk
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=150,
        separators=["\n\n", "\n", ". ", " "],
    )
    chunks = splitter.split_documents(documents)
    logger.info(f"Created {len(chunks)} chunks from {len(documents)} documents.")

    # Embed & index
    vs = FAISS.from_documents(chunks, embeddings)
    vs.save_local(str(store_path))
    _vector_store = vs
    logger.info(f"Vector store saved to {store_path}")
    return vs


def retrieve_context(query: str, k: int = 4) -> str:
    """
    Retrieves the top-k most relevant chunks for a given query.
    Returns a formatted string to inject into the Claude prompt.

    ── YOUR TEAMMATE CAN REPLACE THIS with their own retrieval logic ──
    """
    global _vector_store

    if _vector_store is None:
        return ""  # No RAG context available — Claude will answer from base knowledge

    try:
        docs = _vector_store.similarity_search(query, k=k)
        if not docs:
            return ""

        context_parts = []
        for i, doc in enumerate(docs, 1):
            source = doc.metadata.get("source", "networking manual")
            source_name = Path(source).name if source else "manual"
            context_parts.append(
                f"[Reference {i} — {source_name}]\n{doc.page_content.strip()}"
            )

        return "\n\n".join(context_parts)

    except Exception as e:
        logger.error(f"RAG retrieval error: {e}")
        return ""


def add_document_to_store(file_path: str) -> int:
    """
    Adds a single new document to the existing vector store (incremental indexing).
    Returns number of chunks added.
    """
    global _vector_store
    embeddings = _get_embeddings()
    store_path = Path(settings.vector_store_path)
    store_path.mkdir(parents=True, exist_ok=True)

    ext = Path(file_path).suffix.lower()
    try:
        if ext == ".pdf":
            loader = PyPDFLoader(file_path)
        else:
            loader = TextLoader(file_path)
        documents = loader.load()
    except Exception as e:
        logger.error(f"Failed to load document {file_path}: {e}")
        raise

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
    chunks = splitter.split_documents(documents)

    if _vector_store is None:
        _vector_store = FAISS.from_documents(chunks, embeddings)
    else:
        _vector_store.add_documents(chunks)

    _vector_store.save_local(str(store_path))
    logger.info(f"Added {len(chunks)} chunks from {file_path}")
    return len(chunks)


def get_rag_status() -> dict:
    return {
        "vector_store_loaded": _vector_store is not None,
        "docs_path": settings.docs_path,
        "vector_store_path": settings.vector_store_path,
        "docs_exist": Path(settings.docs_path).exists(),
        "index_exists": (Path(settings.vector_store_path) / "index.faiss").exists(),
    }
