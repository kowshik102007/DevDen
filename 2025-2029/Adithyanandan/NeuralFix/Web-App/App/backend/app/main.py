import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.db.database import create_tables
from app.services.rag_service import load_or_create_vector_store, get_rag_status
from app.api import sessions, chat, images, reports, rag, visionagent

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────────
    logger.info("=" * 60)
    logger.info(f"  {settings.app_name} Backend Starting")
    logger.info("=" * 60)

    # Create DB tables
    logger.info("Initialising database tables...")
    create_tables()

    # Load RAG vector store
    logger.info("Loading RAG vector store...")
    load_or_create_vector_store()
    status = get_rag_status()
    if status["vector_store_loaded"]:
        logger.info("✅ RAG vector store ready.")
    else:
        logger.warning(
            "⚠️  RAG vector store NOT loaded. "
            "Add documents to ./docs and call POST /api/rag/reindex"
        )

    logger.info(f"Server ready — http://{settings.host}:{settings.port}")
    logger.info("=" * 60)
    yield
    # ── Shutdown ─────────────────────────────────────────────────────────────
    logger.info("NetFixAI Backend shutting down.")


app = FastAPI(
    title="NetFixAI Backend",
    description="AI-powered network troubleshooting API — RAG + Vision + Claude",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS: allow all origins on local network ──────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(sessions.router)
app.include_router(chat.router)
app.include_router(images.router)
app.include_router(reports.router)
app.include_router(rag.router)
app.include_router(visionagent.router)


@app.get("/health")
def health():
    from app.services.rag_service import get_rag_status
    rag = get_rag_status()
    try:
        from app.db.database import SessionLocal
        db = SessionLocal()
        db.execute(__import__("sqlalchemy").text("SELECT 1"))
        db.close()
        db_ok = True
    except Exception:
        db_ok = False

    return {
        "status": "ok",
        "app": settings.app_name,
        "version": "1.0.0",
        "rag_ready": rag["vector_store_loaded"],
        "db_connected": db_ok,
    }
