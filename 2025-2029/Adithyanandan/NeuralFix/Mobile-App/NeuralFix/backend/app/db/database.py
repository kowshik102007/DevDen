from sqlalchemy import create_engine, Column, String, Text, DateTime, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import uuid
from app.core.config import get_settings

settings = get_settings()
connect_args = {"check_same_thread": False} if "sqlite" in settings.database_url else {}
engine = create_engine(settings.database_url, connect_args=connect_args, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class TroubleshootingSession(Base):
    __tablename__ = "sessions"
    id                = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title             = Column(String(255), default="New Session")
    category          = Column(String(50), default="general")   # networking, computer, printer, etc.
    status            = Column(String(20), default="active")    # active | resolved | escalated
    messages          = Column(JSON, default=list)
    image_paths       = Column(JSON, default=list)
    diagnostic_report = Column(Text, nullable=True)
    device_info       = Column(JSON, nullable=True)
    created_at        = Column(DateTime, default=datetime.utcnow)
    updated_at        = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
