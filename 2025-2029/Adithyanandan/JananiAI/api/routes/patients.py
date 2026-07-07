from fastapi import APIRouter, HTTPException
from typing import List
from pydantic import BaseModel

router = APIRouter(prefix="/patients", tags=["patients"])

# Placeholder for patient routes (main.py handles them directly for simplicity)