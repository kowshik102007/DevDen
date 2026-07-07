import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import (
    auth, conversations, chat, models, projects, attachments, providers, catalog,
    memory, skills, mcp, agents, tokens, openai_compat, provider_keys, analytics,
    system,
)
from app.services.health_probe import run_health_probes


def _patch_playwright_servers():
    """One-time migration: add --browser chromium to any Playwright MCP servers
    that were installed before that arg was added to the catalog."""
    from app.core.database import SessionLocal
    from app.models.mcp_server import MCPServer
    with SessionLocal() as db:
        servers = db.query(MCPServer).filter(
            MCPServer.command == "npx",
        ).all()
        changed = False
        for s in servers:
            args = list(s.args or [])
            if "@playwright/mcp" in " ".join(args) and "--browser" not in args:
                args += ["--browser", "chromium"]
                s.args = args
                changed = True
        if changed:
            db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _patch_playwright_servers()
    task = asyncio.create_task(run_health_probes())
    yield
    task.cancel()


app = FastAPI(title="OpenAgent Hub", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(conversations.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(models.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(attachments.router, prefix="/api")
app.include_router(providers.router, prefix="/api")
app.include_router(catalog.router, prefix="/api")
app.include_router(memory.router, prefix="/api")
app.include_router(skills.router, prefix="/api")
app.include_router(mcp.router, prefix="/api")
app.include_router(agents.router, prefix="/api")
app.include_router(tokens.router, prefix="/api")
app.include_router(provider_keys.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(system.router, prefix="/api")
# OpenAI-compatible public API — mounted at /v1 (no /api prefix), token-authed.
app.include_router(openai_compat.router)


@app.get("/health")
def health():
    return {"status": "ok"}
