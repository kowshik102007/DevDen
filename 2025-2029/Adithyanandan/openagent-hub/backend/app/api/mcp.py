from uuid import UUID
from typing import List, Optional

from fastapi import APIRouter, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.auth_service import get_current_user
from app.services import mcp_service
from app.services import mcp_catalog
from app.schemas.agent import MCPServerCreate, MCPServerUpdate, MCPServerResponse

router = APIRouter(prefix="/mcp", tags=["mcp"])
security = HTTPBearer()


class MCPInstallRequest(BaseModel):
    source: str
    name: Optional[str] = None
    env: Optional[dict] = None
    config: Optional[dict] = None
    auto_approve: bool = True


class MCPResolveRequest(BaseModel):
    source: str


def _current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    return get_current_user(db, credentials.credentials)


@router.get("/servers", response_model=List[MCPServerResponse])
def list_servers(user=Depends(_current_user), db: Session = Depends(get_db)):
    # Seed the bundled example server on first access so MCP works out of the box.
    mcp_service.ensure_example_server(db, user.id)
    return mcp_service.list_servers(db, user.id)


@router.get("/catalog")
def get_catalog(user=Depends(_current_user)):
    """Curated list of popular MCP servers for one-click install."""
    return mcp_catalog.get_catalog()


@router.post("/resolve")
def resolve(body: MCPResolveRequest, user=Depends(_current_user)):
    """Preview what a pasted source resolves to (command/args/required secrets)
    without installing it."""
    return mcp_catalog.resolve_source(body.source)


@router.post("/install", response_model=MCPServerResponse, status_code=201)
def install(body: MCPInstallRequest, user=Depends(_current_user), db: Session = Depends(get_db)):
    """Install an MCP server from a catalog id, GitHub URL, npm/PyPI package, or command."""
    return mcp_catalog.install_server(
        db, user.id, body.source,
        name=body.name, env=body.env, config=body.config, auto_approve=body.auto_approve,
    )


@router.post("/servers", response_model=MCPServerResponse, status_code=201)
def create_server(data: MCPServerCreate, user=Depends(_current_user), db: Session = Depends(get_db)):
    return mcp_service.create_server(db, user.id, data.model_dump())


@router.patch("/servers/{server_id}", response_model=MCPServerResponse)
def update_server(server_id: UUID, data: MCPServerUpdate, user=Depends(_current_user), db: Session = Depends(get_db)):
    return mcp_service.update_server(db, user.id, server_id, data.model_dump(exclude_none=True))


@router.delete("/servers/{server_id}", status_code=204)
def delete_server(server_id: UUID, user=Depends(_current_user), db: Session = Depends(get_db)):
    mcp_service.delete_server(db, user.id, server_id)


@router.post("/servers/{server_id}/sync", response_model=MCPServerResponse)
async def sync_server(server_id: UUID, user=Depends(_current_user), db: Session = Depends(get_db)):
    return await mcp_service.sync_server(db, user.id, server_id)
