
import ee
import os
import json
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

# Scopes required for Earth Engine
SCOPES = ['https://www.googleapis.com/auth/earthengine']

def authenticate_user():
    """
    Authenticate user via Google OAuth and save refresh token.
    """
    client_id = os.environ.get('GOOGLE_CLIENT_ID')
    client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')

    if not client_id or not client_secret:
        print("❌ Error: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not found in environment.")
        print("Please ensure .env is loaded or variables are set.")
        return

    print("Initiating Google Earth Engine Authentication...")
    
    # Create the flow using the client ID and secret
    client_config = {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost:8501"]
        }
    }

    flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
    
    # Run the flow with fixed port 8501 to match Redirect URI
    try:
        creds = flow.run_local_server(port=8501)
    except OSError:
        print("⚠️ Could not start local server. Switching to console flow.")
        creds = flow.run_console()

    # Save the refresh token
    token_data = {
        'refresh_token': creds.refresh_token,
        'scopes': creds.scopes
    }
    
    with open('ee_token.json', 'w') as f:
        json.dump(token_data, f)
        
    print("\n✅ Authentication successful!")
    print(f"Token saved to: {os.path.abspath('ee_token.json')}")
    print("You can now run the backend ingestion scripts.")

if __name__ == '__main__':
    from dotenv import load_dotenv
    load_dotenv()
    authenticate_user()
