"""
Authentication router for FastAPI
Handles user registration, login, logout, and password management
"""
from fastapi import APIRouter, Depends, HTTPException, status
from werkzeug.security import generate_password_hash, check_password_hash
from jose import jwt
from datetime import datetime, timedelta
from typing import Dict
import re
import logging

from models import UserRegister, UserLogin, UserResponse, ChangePassword, Token, MessageResponse
from dependencies import get_current_user, get_user_collection, JWT_SECRET_KEY, JWT_ALGORITHM
import os

router = APIRouter(prefix="/api/auth", tags=["authentication"])
logger = logging.getLogger(__name__)

# Token expiration
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))


def validate_username(username: str) -> tuple[bool, str]:
    """Validate username format"""
    if not username:
        return False, "Username is required"
    if len(username) < 5 or len(username) > 20:
        return False, "Username must be between 5 and 20 characters"
    if not username.isidentifier():
        return False, "Username must contain only letters, numbers and underscores"
    return True, "valid username"


def validate_password(password: str) -> tuple[bool, str]:
    """Validate password strength"""
    if not password:
        return False, "Password is required"
    if len(password) < 8:
        return False, "Password should be atleast 8 characters"
    if not any(c.islower() for c in password):
        return False, "Password must contain atleast 1 lowercase character"
    if not any(c.isupper() for c in password):
        return False, "Password must contain atleast 1 uppercase character"
    if not any(c.isdigit() for c in password):
        return False, "Password must contain atleast 1 digit"
    
    special_chars = r"!@#$%^&*()-_+=<>?/{}~|"
    if not any(c in special_chars for c in password):
        return False, "Password must contain atleast 1 special character"
    return True, "Password accepted"


def create_access_token(data: dict, expires_delta: timedelta = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister, user_col=Depends(get_user_collection)):
    """Register a new user"""
    # Validate username
    valid_name, user_issue = validate_username(user_data.username)
    if not valid_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=user_issue)
    
    # Validate password
    valid_pass, pass_issue = validate_password(user_data.password)
    if not valid_pass:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=pass_issue)
    
    # Check if username already exists
    existing_user = user_col.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists. Please choose a different username."
        )
    
    try:
        # Hash password
        hashed_pass = generate_password_hash(password=user_data.password)
        
        # Create user document
        user_doc = {
            "username": user_data.username,
            "name": user_data.name,
            "password": hashed_pass,
            "last_login": None,
            "is_active": True,
            "created_at": datetime.utcnow().isoformat()
        }
        
        result = user_col.insert_one(user_doc)
        
        if result.inserted_id:
            logger.info(f'New user registered: {user_data.username}')
            return MessageResponse(message="Registration successful. You can login now!")
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Registration failed"
            )
    except Exception as e:
        logger.error(f'Registration error for user {user_data.username}: {str(e)}')
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error occurred during registration"
        )


@router.post("/login", response_model=Token)
async def login(user_data: UserLogin, user_col=Depends(get_user_collection)):
    """Login user and return JWT token"""
    # Find user
    user = user_col.find_one({"username": user_data.username})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    # Check password
    if not check_password_hash(user['password'], password=user_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    try:
        # Update last login
        user_col.update_one(
            {'_id': user['_id']},
            {'$set': {'last_login': datetime.utcnow().isoformat()}}
        )
        
        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user_data.username}, expires_delta=access_token_expires
        )
        
        logger.info(f'User logged in: {user_data.username}')
        
        return Token(
            access_token=access_token,
            token_type="bearer",
            username=user_data.username
        )
        
    except Exception as e:
        logger.error(f'Login error for user {user_data.username}: {str(e)}')
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error while logging in"
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    return UserResponse(
        username=current_user['username'],
        last_login=current_user.get('last_login'),
        is_active=current_user.get('is_active', True)
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout user (client should remove token)"""
    logger.info(f'User logged out: {current_user["username"]}')
    return MessageResponse(message="Successfully logged out")


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    password_data: ChangePassword,
    current_user: dict = Depends(get_current_user),
    user_col=Depends(get_user_collection)
):
    """Change user password"""
    # Verify old password
    if not check_password_hash(current_user['password'], password=password_data.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is invalid"
        )
    
    # Validate new password
    valid_pass, pass_issue = validate_password(password_data.new_password)
    if not valid_pass:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=pass_issue)
    
    try:
        # Hash new password
        hashed_pass = generate_password_hash(password=password_data.new_password)
        
        # Update password
        user_col.update_one(
            {'_id': current_user['_id']},
            {'$set': {
                'password': hashed_pass,
                'last_login': datetime.utcnow().isoformat()
            }}
        )
        
        logger.info(f'Password changed for user: {current_user["username"]}')
        return MessageResponse(message="Password updated successfully")
        
    except Exception as e:
        logger.error(f'Error changing password: {str(e)}')
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error while changing password"
        )
