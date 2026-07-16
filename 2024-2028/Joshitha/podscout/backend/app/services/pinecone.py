"""Pinecone client initialization and utilities."""
from typing import Optional
from ..config import settings

try:
    from pinecone import Pinecone, ServerlessSpec
    PINECONE_AVAILABLE = True
except ImportError:
    PINECONE_AVAILABLE = False
    Pinecone = None


class PineconeClient:
    """Singleton Pinecone client (optional)."""
    
    _instance: Optional[any] = None
    _index = None
    
    @classmethod
    def get_client(cls):
        """Get or create Pinecone client instance."""
        if not PINECONE_AVAILABLE:
            raise RuntimeError("Pinecone SDK not installed. Install with: pip install pinecone-client")
        
        if not settings.PINECONE_API_KEY:
            raise ValueError("PINECONE_API_KEY not configured")
        
        if cls._instance is None:
            cls._instance = Pinecone(api_key=settings.PINECONE_API_KEY)
        return cls._instance
    
    @classmethod
    def get_index(cls, index_name: Optional[str] = None):
        """Get Pinecone index."""
        client = cls.get_client()
        idx_name = index_name or settings.PINECONE_INDEX_NAME
        
        if cls._index is None:
            cls._index = client.Index(idx_name)
        return cls._index
    
    @classmethod
    def create_index_if_not_exists(cls, index_name: Optional[str] = None, dimension: int = 1536):
        """Create index if it doesn't exist."""
        client = cls.get_client()
        idx_name = index_name or settings.PINECONE_INDEX_NAME
        
        existing_indexes = [idx.name for idx in client.list_indexes()]
        
        if idx_name not in existing_indexes:
            client.create_index(
                name=idx_name,
                dimension=dimension,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region=settings.PINECONE_ENV or "us-east-1")
            )
        
        return cls.get_index(idx_name)


# Convenience function
def get_pinecone_index(index_name: Optional[str] = None):
    """Get Pinecone index instance."""
    return PineconeClient.get_index(index_name)
