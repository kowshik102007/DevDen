import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, backref
from app.core.database import Base


class AgentRun(Base):
    """A single execution of an agent against a goal."""

    __tablename__ = "agent_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)
    parent_run_id = Column(UUID(as_uuid=True), ForeignKey("agent_runs.id", ondelete="CASCADE"), nullable=True)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True)
    skill_id = Column(UUID(as_uuid=True), ForeignKey("skills.id", ondelete="SET NULL"), nullable=True)

    goal = Column(Text, nullable=False)
    role = Column(String, nullable=True)  # label for sub-agents (e.g. "Research Agent")
    mode = Column(String, default="auto")  # auto | goal (autonomous until done) | plan
    status = Column(String, default="pending")  # pending | running | completed | failed | stopped
    result = Column(Text, nullable=True)
    error = Column(Text, nullable=True)
    model = Column(String, nullable=True)
    provider_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    steps = relationship(
        "AgentStep",
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="AgentStep.step_index",
    )
    children = relationship(
        "AgentRun",
        backref=backref("parent", remote_side=[id]),
        passive_deletes=True,
    )
    user = relationship("User")
