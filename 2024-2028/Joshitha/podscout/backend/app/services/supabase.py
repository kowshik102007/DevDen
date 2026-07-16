"""Supabase client initialization."""
from supabase import create_client, Client
from typing import Optional
import logging
import os
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

supabase_client: Optional[Client] = None


def get_supabase() -> Optional[Client]:
    """
    Get initialized Supabase client.
    
    Returns None if Supabase is not configured.
    """
    global supabase_client
    
    if supabase_client is not None:
        return supabase_client
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    
    if not supabase_url or not supabase_key:
        logger.info("Supabase credentials not configured")
        return None
    
    try:
        supabase_client = create_client(supabase_url, supabase_key)
        logger.info(f"✓ Supabase client initialized: {supabase_url}")
        return supabase_client
    except Exception as e:
        logger.error(f"Failed to initialize Supabase: {e}")
        return None
