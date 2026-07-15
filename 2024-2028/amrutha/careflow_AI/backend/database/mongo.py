"""MongoDB helper (placeholder)"""
from pymongo import MongoClient
from ..config import settings

def get_client():
    return MongoClient(settings.MONGO_URI)
