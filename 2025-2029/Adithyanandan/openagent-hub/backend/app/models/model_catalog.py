import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Boolean, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class ModelCatalog(Base):
    __tablename__ = "model_catalog"
    __table_args__ = (
        UniqueConstraint("user_id", "provider_id", "model_id", name="uq_user_provider_model"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("providers.id", ondelete="CASCADE"), nullable=False)
    model_id = Column(String, nullable=False)
    provider_name = Column(String, nullable=False)
    context_window = Column(Integer, nullable=True)
    vision_support = Column(Boolean, default=False)
    reasoning_support = Column(Boolean, default=False)
    coding_score = Column(Integer, nullable=True)
    speed_score = Column(Integer, nullable=True)
    knowledge_score = Column(Integer, nullable=True)
    model_family = Column(String, nullable=True)
    param_billions = Column(Float, nullable=True)
    reliability_score = Column(Integer, nullable=True)
    avg_latency_ms = Column(Integer, nullable=True)
    error_rate = Column(Float, nullable=True)
    last_stats_at = Column(DateTime, nullable=True)
    is_free = Column(Boolean, default=False, nullable=False)
    is_enabled = Column(Boolean, default=True)
    last_seen_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    provider = relationship("Provider")
