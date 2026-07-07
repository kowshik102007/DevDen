import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class ApiToken(Base):
    """A client-facing API token (``oah-…``) for the OpenAI-compatible ``/v1`` API.

    The plaintext token is shown to the user exactly once at creation. We persist
    only its SHA-256 hash (``token_hash``) for lookup plus a short ``prefix`` for
    display (e.g. ``oah-AbCd…``), so a DB leak never exposes a usable token.
    """

    __tablename__ = "api_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False, default="token")
    token_hash = Column(String, nullable=False, unique=True, index=True)
    prefix = Column(String, nullable=False, default="")  # display-only, e.g. "oah-AbCd…"
    revoked = Column(Boolean, nullable=False, default=False)
    last_used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="api_tokens")
