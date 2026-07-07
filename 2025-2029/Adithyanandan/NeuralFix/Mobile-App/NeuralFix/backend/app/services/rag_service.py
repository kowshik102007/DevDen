import logging
from pathlib import Path
from typing import Optional
from langchain_community.document_loaders import PyPDFLoader, TextLoader, DirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
_vector_store: Optional[FAISS] = None
_embeddings: Optional[HuggingFaceEmbeddings] = None


def _get_embeddings():
    global _embeddings
    if _embeddings is None:
        logger.info("Loading embedding model...")
        _embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2", model_kwargs={"device": "cpu"})
    return _embeddings


def load_or_create_vector_store():
    global _vector_store
    store_path = Path(settings.vector_store_path)
    docs_path = Path(settings.docs_path)
    embeddings = _get_embeddings()
    if (store_path / "index.faiss").exists():
        try:
            _vector_store = FAISS.load_local(str(store_path), embeddings, allow_dangerous_deserialization=True)
            logger.info("Vector store loaded.")
            return _vector_store
        except Exception as e:
            logger.warning(f"Failed to load vector store: {e}")
    if docs_path.exists() and any(docs_path.iterdir()):
        _vector_store = build_vector_store_from_docs(str(docs_path))
    else:
        logger.warning("No docs found. RAG disabled until docs are added.")
        _vector_store = None
    return _vector_store


def build_vector_store_from_docs(docs_path: str):
    global _vector_store
    embeddings = _get_embeddings()
    store_path = Path(settings.vector_store_path)
    store_path.mkdir(parents=True, exist_ok=True)
    documents = []
    try:
        documents.extend(DirectoryLoader(docs_path, glob="**/*.pdf", loader_cls=PyPDFLoader, silent_errors=True).load())
        documents.extend(DirectoryLoader(docs_path, glob="**/*.txt", loader_cls=TextLoader, silent_errors=True).load())
    except Exception as e:
        logger.error(f"Error loading documents: {e}")
    if not documents:
        return None
    chunks = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150).split_documents(documents)
    vs = FAISS.from_documents(chunks, embeddings)
    vs.save_local(str(store_path))
    _vector_store = vs
    return vs


def retrieve_context(query: str, k: int = 3) -> str:
    global _vector_store
    if _vector_store is None:
        return ""
    try:
        docs = _vector_store.similarity_search(query, k=k)
        if not docs:
            return ""
        return "\n\n".join([f"[Ref {i+1}]\n{d.page_content.strip()}" for i, d in enumerate(docs)])
    except Exception as e:
        logger.error(f"RAG error: {e}")
        return ""


def add_document_to_store(file_path: str) -> int:
    global _vector_store
    embeddings = _get_embeddings()
    store_path = Path(settings.vector_store_path)
    store_path.mkdir(parents=True, exist_ok=True)
    ext = Path(file_path).suffix.lower()
    loader = PyPDFLoader(file_path) if ext == ".pdf" else TextLoader(file_path)
    chunks = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150).split_documents(loader.load())
    if _vector_store is None:
        _vector_store = FAISS.from_documents(chunks, embeddings)
    else:
        _vector_store.add_documents(chunks)
    _vector_store.save_local(str(store_path))
    return len(chunks)


def get_rag_status() -> dict:
    return {
        "vector_store_loaded": _vector_store is not None,
        "docs_path": settings.docs_path,
        "vector_store_path": settings.vector_store_path,
        "docs_exist": Path(settings.docs_path).exists(),
        "index_exists": (Path(settings.vector_store_path) / "index.faiss").exists(),
    }
