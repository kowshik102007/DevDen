import json
from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.auth_service import get_current_user
from app.services import agent_service, agent_tools
from app.models.agent import Agent
from app.models.agent_run import AgentRun
from app.schemas.agent import (
    AgentCreate, AgentUpdate, AgentResponse,
    AgentRunCreate, AgentRunResponse, AgentRunDetailResponse, AgentRunContinue,
)

router = APIRouter(prefix="/agents", tags=["agents"])
security = HTTPBearer()


def _current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    return get_current_user(db, credentials.credentials)


# ── Tool catalog ────────────────────────────────────────────────────────────────

@router.get("/tools")
def list_tools(user=Depends(_current_user), db: Session = Depends(get_db)):
    """Return the tools currently available to this user's agents (built-ins + MCP)."""
    registry = agent_tools.build_registry(db, user.id, allow_subagents=True)
    return [
        {"name": t.name, "description": t.description, "parameters": t.parameters}
        for t in registry.values()
    ]


# ── Agent definitions (CRUD) ─────────────────────────────────────────────────────

@router.get("", response_model=List[AgentResponse])
def list_agents(user=Depends(_current_user), db: Session = Depends(get_db)):
    # Ensure the built-in Orchestrator exists (lazy, idempotent) so the Agents tab
    # always has a sensible default agent.
    agent_service.seed_builtin_agents(db, user.id)
    return (
        db.query(Agent)
        .filter(Agent.user_id == user.id)
        .order_by(Agent.is_builtin.desc(), Agent.created_at)
        .all()
    )


@router.post("", response_model=AgentResponse, status_code=201)
def create_agent(data: AgentCreate, user=Depends(_current_user), db: Session = Depends(get_db)):
    agent = Agent(user_id=user.id, **data.model_dump())
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


@router.patch("/{agent_id}", response_model=AgentResponse)
def update_agent(agent_id: UUID, data: AgentUpdate, user=Depends(_current_user), db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id, Agent.user_id == user.id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(agent, field, value)
    db.commit()
    db.refresh(agent)
    return agent


@router.delete("/runs", status_code=204)
def clear_runs(user=Depends(_current_user), db: Session = Depends(get_db)):
    """Delete all of the user's run history (steps + child runs cascade).

    Defined before DELETE /{agent_id} so the literal '/runs' path isn't captured
    by the agent_id path parameter.
    """
    runs = db.query(AgentRun).filter(AgentRun.user_id == user.id).all()
    for run in runs:
        db.delete(run)
    db.commit()


@router.delete("/runs/{run_id}", status_code=204)
def delete_run(run_id: UUID, user=Depends(_current_user), db: Session = Depends(get_db)):
    """Delete a single run (its steps and child runs cascade)."""
    run = db.query(AgentRun).filter(AgentRun.id == run_id, AgentRun.user_id == user.id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    db.delete(run)
    db.commit()


@router.delete("/{agent_id}", status_code=204)
def delete_agent(agent_id: UUID, user=Depends(_current_user), db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id, Agent.user_id == user.id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    db.delete(agent)
    db.commit()


# ── Runs ──────────────────────────────────────────────────────────────────────

@router.get("/runs", response_model=List[AgentRunResponse])
def list_runs(user=Depends(_current_user), db: Session = Depends(get_db)):
    return (
        db.query(AgentRun)
        .filter(AgentRun.user_id == user.id, AgentRun.parent_run_id.is_(None))
        .order_by(AgentRun.created_at.desc())
        .limit(100)
        .all()
    )


@router.get("/runs/{run_id}", response_model=AgentRunDetailResponse)
def get_run(run_id: UUID, user=Depends(_current_user), db: Session = Depends(get_db)):
    run = db.query(AgentRun).filter(AgentRun.id == run_id, AgentRun.user_id == user.id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.get("/runs/{run_id}/children", response_model=List[AgentRunDetailResponse])
def get_run_children(run_id: UUID, user=Depends(_current_user), db: Session = Depends(get_db)):
    return (
        db.query(AgentRun)
        .filter(AgentRun.parent_run_id == run_id, AgentRun.user_id == user.id)
        .order_by(AgentRun.created_at)
        .all()
    )


@router.post("/run")
async def run_agent_stream(
    data: AgentRunCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """Create a run and stream its execution as Server-Sent Events."""
    user = get_current_user(db, credentials.credentials)

    allow_override = data.allow_subagents

    # Normalize execution mode.
    run_mode = (data.mode or "auto").lower()
    if run_mode not in ("auto", "goal", "plan"):
        run_mode = "auto"

    run = agent_service.create_run(
        db,
        user_id=user.id,
        goal=data.goal,
        agent_id=data.agent_id,
        skill_id=data.skill_id,
        model=data.model,
        provider_id=data.provider_id,
        conversation_id=data.conversation_id,
        mode=run_mode,
    )
    run_id = run.id
    user_id = user.id

    # Normalize tool behaviour.
    tool_mode = (data.tool_mode or "auto").lower()
    if tool_mode not in ("off", "auto", "always"):
        tool_mode = "auto"
    tool_names = [t for t in (data.tool_names or []) if t] or None
    skill_auto = bool(data.skill_auto) and not data.skill_id
    team_agent_ids = [a for a in (data.team_agent_ids or []) if a] or None

    # If the request explicitly enables sub-agents (ad-hoc, no agent template), set it
    # on a transient agent definition by attaching an inline coordinator agent.
    if allow_override and not data.agent_id:
        coordinator = Agent(
            user_id=user_id,
            name="Coordinator (ad-hoc)",
            allow_subagents=True,
        )
        db.add(coordinator)
        db.commit()
        db.refresh(coordinator)
        run.agent_id = coordinator.id
        db.commit()

    async def generate():
        try:
            async for evt in agent_service.run_agent(
                run_id, user_id,
                tool_mode=tool_mode, tool_names=tool_names, skill_auto=skill_auto,
                mode=run_mode, team_agent_ids=team_agent_ids,
            ):
                yield f"data: {json.dumps(evt)}\n\n"
        except Exception as exc:  # noqa: BLE001
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/runs/{run_id}/continue")
async def continue_run_stream(
    run_id: UUID,
    data: AgentRunContinue,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """Continue an existing run with a follow-up message; streams new steps as SSE."""
    user = get_current_user(db, credentials.credentials)

    run = db.query(AgentRun).filter(AgentRun.id == run_id, AgentRun.user_id == user.id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if not (data.message or "").strip():
        raise HTTPException(status_code=400, detail="A message is required to continue a run")

    user_id = user.id

    # Mode: keep the run's existing mode unless the follow-up overrides it.
    run_mode = (data.mode or run.mode or "auto").lower()
    if run_mode not in ("auto", "goal", "plan"):
        run_mode = "auto"

    tool_mode = (data.tool_mode or "auto").lower()
    if tool_mode not in ("off", "auto", "always"):
        tool_mode = "auto"
    tool_names = [t for t in (data.tool_names or []) if t] or None
    team_agent_ids = [a for a in (data.team_agent_ids or []) if a] or None
    message = data.message

    async def generate():
        try:
            async for evt in agent_service.run_agent(
                run_id, user_id,
                tool_mode=tool_mode, tool_names=tool_names,
                mode=run_mode, team_agent_ids=team_agent_ids,
                continue_message=message,
            ):
                yield f"data: {json.dumps(evt)}\n\n"
        except Exception as exc:  # noqa: BLE001
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
