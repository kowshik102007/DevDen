"""
Supabase Authentication Service

Provides authentication functionality using Supabase Auth:
- Email/password authentication
- OAuth (Google) authentication
- Session management
- Token validation
"""
import os
import logging
from typing import Optional, Dict, Any
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class SupabaseAuth:
    """Handle authentication operations with Supabase Auth."""
    
    def __init__(self):
        self.url = os.getenv("SUPABASE_URL")
        self.key = os.getenv("SUPABASE_KEY")
        self._client: Optional[Client] = None
        
    @property
    def client(self) -> Optional[Client]:
        """Lazy initialization of Supabase client."""
        if self._client is None and self.url and self.key:
            try:
                self._client = create_client(self.url, self.key)
                logger.info("✅ Supabase Auth client initialized")
            except Exception as e:
                logger.error(f"❌ Failed to initialize Supabase Auth: {e}")
        return self._client
    
    def signup_with_email(self, email: str, password: str, metadata: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Register a new user with email and password.
        
        Args:
            email: User's email address
            password: User's password (min 6 characters)
            metadata: Optional user metadata (name, etc.)
            
        Returns:
            Dict with user data or error
        """
        if not self.client:
            return {"error": "Supabase not configured", "status": "error"}
        
        try:
            options = {}
            if metadata:
                options["data"] = metadata
                
            response = self.client.auth.sign_up({
                "email": email,
                "password": password,
                "options": options if options else None
            })
            
            if response.user:
                logger.info(f"✅ User registered: {email}")
                return {
                    "status": "success",
                    "user": {
                        "id": response.user.id,
                        "email": response.user.email,
                        "created_at": str(response.user.created_at),
                        "email_confirmed": response.user.email_confirmed_at is not None
                    },
                    "session": {
                        "access_token": response.session.access_token if response.session else None,
                        "refresh_token": response.session.refresh_token if response.session else None,
                        "expires_at": response.session.expires_at if response.session else None
                    } if response.session else None,
                    "message": "Signup successful. Check email for confirmation if required."
                }
            else:
                return {"error": "Signup failed", "status": "error"}
                
        except Exception as e:
            error_msg = str(e)
            logger.error(f"❌ Signup error: {error_msg}")
            return {"error": error_msg, "status": "error"}
    
    def login_with_email(self, email: str, password: str) -> Dict[str, Any]:
        """
        Authenticate user with email and password.
        
        Args:
            email: User's email address
            password: User's password
            
        Returns:
            Dict with session data or error
        """
        if not self.client:
            return {"error": "Supabase not configured", "status": "error"}
        
        try:
            response = self.client.auth.sign_in_with_password({
                "email": email,
                "password": password
            })
            
            if response.user and response.session:
                logger.info(f"✅ User logged in: {email}")
                return {
                    "status": "success",
                    "user": {
                        "id": response.user.id,
                        "email": response.user.email,
                        "created_at": str(response.user.created_at),
                        "last_sign_in": str(response.user.last_sign_in_at) if response.user.last_sign_in_at else None
                    },
                    "session": {
                        "access_token": response.session.access_token,
                        "refresh_token": response.session.refresh_token,
                        "expires_at": response.session.expires_at,
                        "token_type": response.session.token_type
                    }
                }
            else:
                return {"error": "Invalid credentials", "status": "error"}
                
        except Exception as e:
            error_msg = str(e)
            logger.error(f"❌ Login error: {error_msg}")
            return {"error": error_msg, "status": "error"}
    
    def login_with_oauth(self, provider: str = "google") -> Dict[str, Any]:
        """
        Get OAuth login URL for the specified provider.
        
        Args:
            provider: OAuth provider (google, github, etc.)
            
        Returns:
            Dict with OAuth URL or error
        """
        if not self.client:
            return {"error": "Supabase not configured", "status": "error"}
        
        try:
            redirect_url = os.getenv("AUTH_REDIRECT_URL", "http://localhost:8501")
            
            response = self.client.auth.sign_in_with_oauth({
                "provider": provider,
                "options": {
                    "redirect_to": redirect_url
                }
            })
            
            return {
                "status": "success",
                "provider": provider,
                "url": response.url,
                "message": f"Redirect user to URL for {provider} authentication"
            }
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"❌ OAuth error: {error_msg}")
            return {"error": error_msg, "status": "error"}
    
    def logout(self) -> Dict[str, Any]:
        """
        Sign out the current user.
        
        Returns:
            Dict with status
        """
        if not self.client:
            return {"error": "Supabase not configured", "status": "error"}
        
        try:
            self.client.auth.sign_out()
            logger.info("✅ User logged out")
            return {"status": "success", "message": "Logged out successfully"}
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"❌ Logout error: {error_msg}")
            return {"error": error_msg, "status": "error"}
    
    def get_user(self, access_token: str) -> Dict[str, Any]:
        """
        Get user details from access token.
        
        Args:
            access_token: JWT access token
            
        Returns:
            Dict with user data or error
        """
        if not self.client:
            return {"error": "Supabase not configured", "status": "error"}
        
        try:
            # Get user from token
            response = self.client.auth.get_user(access_token)
            
            if response.user:
                return {
                    "status": "success",
                    "user": {
                        "id": response.user.id,
                        "email": response.user.email,
                        "created_at": str(response.user.created_at),
                        "last_sign_in": str(response.user.last_sign_in_at) if response.user.last_sign_in_at else None,
                        "app_metadata": response.user.app_metadata,
                        "user_metadata": response.user.user_metadata
                    }
                }
            else:
                return {"error": "Invalid token", "status": "error"}
                
        except Exception as e:
            error_msg = str(e)
            logger.error(f"❌ Get user error: {error_msg}")
            return {"error": error_msg, "status": "error"}
    
    def refresh_session(self, refresh_token: str) -> Dict[str, Any]:
        """
        Refresh the session using a refresh token.
        
        Args:
            refresh_token: Refresh token from login
            
        Returns:
            Dict with new session data or error
        """
        if not self.client:
            return {"error": "Supabase not configured", "status": "error"}
        
        try:
            response = self.client.auth.refresh_session(refresh_token)
            
            if response.session:
                logger.info("✅ Session refreshed")
                return {
                    "status": "success",
                    "session": {
                        "access_token": response.session.access_token,
                        "refresh_token": response.session.refresh_token,
                        "expires_at": response.session.expires_at
                    }
                }
            else:
                return {"error": "Failed to refresh session", "status": "error"}
                
        except Exception as e:
            error_msg = str(e)
            logger.error(f"❌ Refresh error: {error_msg}")
            return {"error": error_msg, "status": "error"}
    
    def reset_password(self, email: str) -> Dict[str, Any]:
        """
        Send password reset email.
        
        Args:
            email: User's email address
            
        Returns:
            Dict with status
        """
        if not self.client:
            return {"error": "Supabase not configured", "status": "error"}
        
        try:
            redirect_url = os.getenv("AUTH_REDIRECT_URL", "http://localhost:8501")
            
            self.client.auth.reset_password_email(
                email,
                options={"redirect_to": f"{redirect_url}/reset-password"}
            )
            
            logger.info(f"✅ Password reset email sent to: {email}")
            return {
                "status": "success",
                "message": "Password reset email sent. Check your inbox."
            }
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"❌ Password reset error: {error_msg}")
            return {"error": error_msg, "status": "error"}


# Global auth instance
auth = SupabaseAuth()
