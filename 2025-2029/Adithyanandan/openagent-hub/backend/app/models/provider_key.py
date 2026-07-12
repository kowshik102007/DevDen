import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Integer, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class ProviderKey(Base):
    __tablename__ = "provider_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("providers.id", ondelete="CASCADE"), nullable=False, index=True)
    label = Column(String, nullable=False, default="default")
    api_key = Column(String, nullable=False, default="")
    is_active = Column(Boolean, default=True)

    # Rate-limit metadata (populated from upstream x-ratelimit-* headers)
    rpm_limit = Column(Integer, nullable=True)
    tpm_limit = Column(Integer, nullable=True)
    daily_limit = Column(Integer, nullable=True)
    rpm_remaining = Column(Integer, nullable=True)
    tpm_remaining = Column(Integer, nullable=True)
    daily_remaining = Column(Integer, nullable=True)
    limit_reset_at = Column(DateTime, nullable=True)
    cooldown_until = Column(DateTime, nullable=True)

    # Usage counters (rolling window)
    requests_used = Column(Integer, default=0)
    tokens_used = Column(Integer, default=0)
    window_start = Column(DateTime, nullable=True)

    last_used_at = Column(DateTime, nullable=True)
    last_error = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    provider = relationship("Provider", back_populates="keys")
