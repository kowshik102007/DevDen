"""
Dependency injection functions for FastAPI
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

# JWT Configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-secret-key")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

# MongoDB Configuration
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
DATABASE_NAME = os.getenv("DATABASE_NAME", "Taskify")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "Users")

# Initialize MongoDB client
client = MongoClient(MONGODB_URI)
db = client[DATABASE_NAME]
user_collection = db[COLLECTION_NAME]

# Security
security = HTTPBearer()


def get_db():
    """Get database instance"""
    return db


def get_user_collection():
    """Get user collection"""
    return user_collection


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    user_col = Depends(get_user_collection)
):
    """
    Verify JWT token and return current user
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = user_col.find_one({"username": username})
    if user is None:
        raise credentials_exception
    
    return user


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    """
    Optional authentication - returns None if no token provided
    """
    if credentials is None:
        return None
    
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
            
        user = user_collection.find_one({"username": username})
        return user
    except:
        return None
