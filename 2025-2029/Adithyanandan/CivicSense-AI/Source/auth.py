from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import declarative_base
from datetime import datetime
from db import engine, SessionLocal
import bcrypt

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True)
    username   = Column(String, unique=True, nullable=False)
    email      = Column(String, unique=True, nullable=False)
    password   = Column(String, nullable=False)  # bcrypt hash
    created_at = Column(DateTime, default=datetime.utcnow)


def init_auth():
    Base.metadata.create_all(bind=engine)


def create_user(username, email, password):
    db = SessionLocal()
    try:
        existing = db.query(User).filter(
            (User.username == username) | (User.email == email)
        ).first()

        if existing:
            if existing.username == username:
                return False, "Username already taken"
            return False, "Email already registered"

        hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        db.add(User(username=username, email=email, password=hashed))
        db.commit()
        return True, "Account created"
    finally:
        db.close()


def login_user(username, password):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            return False, "User not found"
        if not bcrypt.checkpw(password.encode(), user.password.encode()):
            return False, "Incorrect password"
        return True, user.id
    finally:
        db.close()