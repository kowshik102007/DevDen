"""
MCP server management — register stdio MCP servers, discover their tools, and
cache the tool list so the agent runtime can build tool schemas without spawning
a process on every turn.
"""
from datetime import datetime
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.mcp_client import mcp_list_tools, MCPError
from app.models.mcp_server import MCPServer

# A safe default the example server ships with — lets the feature be tested out of the box.
EXAMPLE_SERVER = {
    "name": "Example Tools",
    "transport": "stdio",
    "command": "python",
    "args": ["/app/mcp_servers/example_server.py"],
}


def list_servers(db: Session, user_id: UUID) -> list[MCPServer]:
    return (
        db.query(MCPServer)
        .filter(MCPServer.user_id == user_id)
        .order_by(MCPServer.created_at)
        .all()
    )


def get_server(db: Session, user_id: UUID, server_id: UUID) -> MCPServer:
    s = db.query(MCPServer).filter(MCPServer.id == server_id, MCPServer.user_id == user_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="MCP server not found")
    return s


def create_server(db: Session, user_id: UUID, data: dict) -> MCPServer:
    transport = data.get("transport", "stdio")
    if transport != "stdio":
        raise HTTPException(status_code=400, detail="Only the stdio transport is supported currently")
    if not data.get("command"):
        raise HTTPException(status_code=400, detail="A command is required for stdio MCP servers")
    server = MCPServer(
        user_id=user_id,
        name=data["name"],
        transport=transport,
        command=data.get("command"),
        args=data.get("args") or [],
        url=data.get("url"),
        env=data.get("env") or {},
        enabled=data.get("enabled", True),
        auto_approve=data.get("auto_approve", True),
    )
    db.add(server)
    db.commit()
    db.refresh(server)
    return server


def update_server(db: Session, user_id: UUID, server_id: UUID, updates: dict) -> MCPServer:
    server = get_server(db, user_id, server_id)
    for field in ("name", "command", "args", "url", "env", "enabled", "auto_approve"):
        if field in updates and updates[field] is not None:
            setattr(server, field, updates[field])
    server.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(server)
    return server


def delete_server(db: Session, user_id: UUID, server_id: UUID) -> None:
    server = get_server(db, user_id, server_id)
    db.delete(server)
    db.commit()


async def sync_server(db: Session, user_id: UUID, server_id: UUID) -> MCPServer:
    """Connect to the server, list its tools, and cache them."""
    server = get_server(db, user_id, server_id)
    try:
        tools = await mcp_list_tools(server.command, list(server.args or []), dict(server.env or {}))
        server.tools_cache = tools
        server.status = "healthy"
        server.last_checked_at = datetime.utcnow()
        db.commit()
        db.refresh(server)
        return server
    except MCPError as exc:
        server.status = "error"
        server.last_checked_at = datetime.utcnow()
        db.commit()
        raise HTTPException(status_code=502, detail=f"MCP connection failed: {exc}")
    except Exception as exc:  # noqa: BLE001
        server.status = "error"
        server.last_checked_at = datetime.utcnow()
        db.commit()
        raise HTTPException(status_code=502, detail=f"MCP connection failed: {exc}")


def ensure_example_server(db: Session, user_id: UUID) -> MCPServer | None:
    """Create the bundled example MCP server for a user if they have none yet."""
    existing = db.query(MCPServer).filter(MCPServer.user_id == user_id).count()
    if existing:
        return None
    return create_server(db, user_id, EXAMPLE_SERVER)
