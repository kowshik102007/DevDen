from pydantic import BaseModel
from typing import Optional, List, Any
from uuid import UUID
from datetime import datetime


# ── Memory ────────────────────────────────────────────────────────────────────

class MemoryCreate(BaseModel):
    content: str
    scope: str = "user"
    project_id: Optional[UUID] = None
    conversation_id: Optional[UUID] = None


class MemoryUpdate(BaseModel):
    content: str


class MemoryResponse(BaseModel):
    id: UUID
    scope: str
    project_id: Optional[UUID]
    conversation_id: Optional[UUID]
    content: str
    source: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Skills ────────────────────────────────────────────────────────────────────

class SkillCreate(BaseModel):
    name: str
    description: Optional[str] = None
    instructions: str
    tool_names: Optional[List[str]] = None


class SkillUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[str] = None
    tool_names: Optional[List[str]] = None


class SkillResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    instructions: str
    tool_names: Optional[List[str]]
    is_builtin: bool

    model_config = {"from_attributes": True}


# ── Agents ────────────────────────────────────────────────────────────────────

class AgentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    model: Optional[str] = None
    provider_id: Optional[UUID] = None
    skill_id: Optional[UUID] = None
    allow_subagents: bool = False


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    model: Optional[str] = None
    provider_id: Optional[UUID] = None
    skill_id: Optional[UUID] = None
    allow_subagents: Optional[bool] = None


class AgentResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    system_prompt: Optional[str]
    model: Optional[str]
    provider_id: Optional[UUID]
    skill_id: Optional[UUID]
    allow_subagents: bool
    is_builtin: bool

    model_config = {"from_attributes": True}


# ── Agent runs ────────────────────────────────────────────────────────────────

class AgentRunCreate(BaseModel):
    goal: str
    agent_id: Optional[UUID] = None
    skill_id: Optional[UUID] = None
    skill_auto: bool = False  # let the agent adopt the most relevant skill itself
    mode: Optional[str] = None  # "auto" | "goal" (autonomous until done) | "plan"
    model: Optional[str] = None
    provider_id: Optional[UUID] = None
    conversation_id: Optional[UUID] = None
    allow_subagents: Optional[bool] = None
    team_agent_ids: Optional[List[UUID]] = None  # saved agents the coordinator may delegate to
    tool_mode: Optional[str] = None  # "off" | "auto" | "always"; default auto
    tool_names: Optional[List[str]] = None  # restrict to these tools; None/[] = all


class AgentRunContinue(BaseModel):
    message: str
    mode: Optional[str] = None
    tool_mode: Optional[str] = None
    tool_names: Optional[List[str]] = None
    team_agent_ids: Optional[List[UUID]] = None


class AgentStepResponse(BaseModel):
    id: UUID
    step_index: int
    type: str
    content: Optional[str]
    tool_name: Optional[str]
    tool_input: Optional[Any]
    tool_output: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class AgentRunResponse(BaseModel):
    id: UUID
    goal: str
    role: Optional[str]
    mode: Optional[str] = None
    status: str
    result: Optional[str]
    error: Optional[str]
    model: Optional[str]
    agent_id: Optional[UUID]
    parent_run_id: Optional[UUID]
    conversation_id: Optional[UUID]
    skill_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AgentRunDetailResponse(AgentRunResponse):
    steps: List[AgentStepResponse] = []


# ── MCP ───────────────────────────────────────────────────────────────────────

class MCPServerCreate(BaseModel):
    name: str
    transport: str = "stdio"
    command: Optional[str] = None
    args: Optional[List[str]] = None
    url: Optional[str] = None
    env: Optional[dict] = None
    enabled: bool = True
    auto_approve: bool = True


class MCPServerUpdate(BaseModel):
    name: Optional[str] = None
    command: Optional[str] = None
    args: Optional[List[str]] = None
    url: Optional[str] = None
    env: Optional[dict] = None
    enabled: Optional[bool] = None
    auto_approve: Optional[bool] = None


class MCPServerResponse(BaseModel):
    id: UUID
    name: str
    transport: str
    command: Optional[str]
    args: Optional[List[str]]
    url: Optional[str]
    enabled: bool
    auto_approve: bool
    status: str
    tools_cache: Optional[Any]
    last_checked_at: Optional[datetime]

    model_config = {"from_attributes": True}
