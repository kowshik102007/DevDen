import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class AgentStep(Base):
    """A single step in an agent run: a thought, tool call, tool result, spawn, or final answer."""

    __tablename__ = "agent_steps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("agent_runs.id", ondelete="CASCADE"), nullable=False)
    step_index = Column(Integer, nullable=False, default=0)
    type = Column(String, nullable=False)  # thought | tool_call | tool_result | spawn | final | error
    content = Column(Text, nullable=True)
    tool_name = Column(String, nullable=True)
    tool_input = Column(JSON, nullable=True)
    tool_output = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    run = relationship("AgentRun", back_populates="steps")
