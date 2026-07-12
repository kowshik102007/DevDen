from sqlalchemy import create_engine, Column, String, Text, DateTime, Integer, JSON, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import enum
import uuid

from app.core.config import get_settings

settings = get_settings()

if settings.database_url.startswith("sqlite"):
    engine = create_engine(
        settings.database_url, connect_args={"check_same_thread": False}, echo=settings.debug
    )
else:
    engine = create_engine(settings.database_url, echo=settings.debug)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class SessionStatus(str, enum.Enum):
    active = "active"
    resolved = "resolved"
    escalated = "escalated"


class TroubleshootingSession(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), default="New Session")
    status = Column(Enum(SessionStatus), default=SessionStatus.active)
    messages = Column(JSON, default=list)          # [{role, content, timestamp, image_path}]
    image_paths = Column(JSON, default=list)       # local server paths to uploaded images
    diagnostic_report = Column(Text, nullable=True)
    device_info = Column(JSON, nullable=True)      # extracted device metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String(255))
    file_path = Column(String(500))
    chunk_count = Column(Integer, default=0)
    indexed = Column(String(10), default="pending")   # pending | done | failed
    created_at = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
