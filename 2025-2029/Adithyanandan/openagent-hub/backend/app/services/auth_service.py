from sqlalchemy.orm import Session
from app.models.user import User
from app.models.provider_config import ProviderConfig
from app.schemas.auth import RegisterRequest
from app.core.security import hash_password, verify_password, create_access_token, decode_token
from fastapi import HTTPException, status


def register_user(db: Session, data: RegisterRequest) -> User:
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    user = User(
        email=data.email,
        username=data.username,
        hashed_password=hash_password(data.password),
    )
    db.add(user)
    db.flush()

    provider = ProviderConfig(
        user_id=user.id,
        name="Default",
        base_url="http://host.docker.internal:3001/v1",
        api_key="",
        model="",
        is_default=True,
    )
    db.add(provider)
    db.commit()
    db.refresh(user)
    return user


def login_user(db: Session, email: str, password: str) -> str:
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return create_access_token({"sub": str(user.id)})


def get_current_user(db: Session, token: str) -> User:
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
