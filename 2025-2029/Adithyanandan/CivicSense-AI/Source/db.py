from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine, Column, Integer, Text, String, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from pgvector.sqlalchemy import Vector
from datetime import datetime
import os

DATABASE_URL = os.getenv("database_url")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

EMBED_DIM = 384


class Conversation(Base):
    __tablename__ = "conversations"

    id         = Column(Integer, primary_key=True)
    session_id = Column(String, nullable=False)
    role       = Column(String, nullable=False)
    message    = Column(Text, nullable=False)
    embedding  = Column(Vector(EMBED_DIM))
    timestamp  = Column(DateTime, default=datetime.utcnow)


def init_db():
    with engine.connect() as conn:
        conn.execute(__import__("sqlalchemy").text("create extension if not exists vector"))
        conn.commit()
    Base.metadata.create_all(bind=engine)