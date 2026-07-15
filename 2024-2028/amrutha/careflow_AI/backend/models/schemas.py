"""Pydantic models / schemas"""
from pydantic import BaseModel
from typing import Optional

class Patient(BaseModel):
    id: str
    name: str
    age: Optional[int]

class Doctor(BaseModel):
    id: str
    name: str
    specialty: Optional[str]
