import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Provider(Base):
    __tablename__ = "providers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    base_url = Column(String, nullable=False)
    api_key = Column(String, nullable=False, default="")
    enabled = Column(Boolean, default=True)
    priority = Column(Integer, default=0)
    status = Column(String, default="unknown")  # healthy / error / unknown / rate_limited
    last_checked_at = Column(DateTime, nullable=True)
    # Circuit breaker state
    consecutive_failures = Column(Integer, default=0)
    circuit_state = Column(String, default="closed")  # closed / open / half_open
    cooldown_until = Column(DateTime, nullable=True)
    last_error = Column(String, nullable=True)
    last_error_at = Column(DateTime, nullable=True)
    # Quota tracking (from upstream rate-limit headers)
    rpm_remaining = Column(Integer, nullable=True)
    tpm_remaining = Column(Integer, nullable=True)
    rpm_limit = Column(Integer, nullable=True)
    tpm_limit = Column(Integer, nullable=True)
    quota_reset_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="providers")
    keys = relationship("ProviderKey", back_populates="provider", cascade="all, delete-orphan")
