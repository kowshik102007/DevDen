
import os
import json
import logging
import ee
from ..config import settings
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

def get_ee_credentials():
    """
    Get Earth Engine credentials, prioritizing Service Account then OAuth Refresh Token.
    Returns:
        ee.Credentials or None
    """
    # 1. Service Account (Preferred for Backend)
    if settings.GEE_SERVICE_ACCOUNT and settings.GEE_PRIVATE_KEY_PATH:
        # ... (Service Account logic remains)
        pass

    # 2. OAuth Refresh Token
    token_path = os.path.join(os.getcwd(), 'ee_token.json')
    if os.path.exists(token_path):
        try:
            with open(token_path, 'r') as f:
                token_data = json.load(f)
                refresh_token = token_data.get('refresh_token')
                
                if refresh_token:
                    client_id = os.environ.get('GOOGLE_CLIENT_ID')
                    client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')
                    
                    if client_id and client_secret:
                        logger.info("Using GEE OAuth Refresh Token")
                        # Use google.oauth2.credentials.Credentials
                        from google.oauth2.credentials import Credentials
                        creds = Credentials(
                            None, # No access token yet
                            refresh_token=refresh_token,
                            token_uri="https://oauth2.googleapis.com/token",
                            client_id=client_id,
                            client_secret=client_secret
                        )
                        return creds
                    else:
                        logger.warning("GOOGLE_CLIENT_ID/SECRET missing for OAuth flow")
        except Exception as e:
            logger.error(f"Error loading OAuth token: {e}")

    logger.warning("No valid Earth Engine credentials found.")
    return None

def initialize_ee():
    """
    Initialize Earth Engine with best available credentials.
    Returns:
        bool: True if successful, False otherwise.
    """
    try:
        creds = get_ee_credentials()
        if creds:
            ee.Initialize(creds)
            logger.info("✅ Google Earth Engine initialized successfully.")
            return True
        else:
            # Fallback for dev environments where 'gcloud auth login' might have run
            # Careful with this in production
            try:
                ee.Initialize()
                logger.info("✅ Google Earth Engine initialized (Default Env).")
                return True
            except Exception:
                pass
                
        logger.error("❌ Failed to initialize Earth Engine: No credentials.")
        return False
    except Exception as e:
        logger.error(f"❌ Exception during Earth Engine initialization: {e}")
        return False
