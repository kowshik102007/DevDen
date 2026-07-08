import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Agent(Base):
    """A reusable agent definition (template)."""

    __tablename__ = "agents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    system_prompt = Column(Text, nullable=True)
    model = Column(String, nullable=True)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("providers.id", ondelete="SET NULL"), nullable=True)
    skill_id = Column(UUID(as_uuid=True), ForeignKey("skills.id", ondelete="SET NULL"), nullable=True)
    allow_subagents = Column(Boolean, default=False)
    is_builtin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")
