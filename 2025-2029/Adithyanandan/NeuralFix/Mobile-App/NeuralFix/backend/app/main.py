import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.db.database import create_tables
from app.services.rag_service import load_or_create_vector_store, get_rag_status
from app.api.routers import sessions_router, chat_router, images_router, reports_router, rag_router
from app.api import visionagent

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s")
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 55)
    logger.info(f"  {settings.app_name} — AI Tech Support Backend")
    logger.info("=" * 55)
    create_tables()
    logger.info("✅ Database ready (SQLite)")
    load_or_create_vector_store()
    status = get_rag_status()
    logger.info("✅ RAG ready" if status["vector_store_loaded"] else "⚠️  RAG not loaded — add docs to ./docs")
    logger.info(f"✅ Ready on port {settings.port}")
    logger.info("=" * 55)
    yield
    logger.info("NeuralFix shutting down.")


app = FastAPI(title="NeuralFix API", description="AI-powered tech support for everyone", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(sessions_router)
app.include_router(chat_router)
app.include_router(images_router)
app.include_router(reports_router)
app.include_router(rag_router)
app.include_router(visionagent.router)


@app.get("/health")
def health():
    return {"status": "ok", "app": "NeuralFix", "model": "llama-3.1-8b-instant (Groq)", "database": "SQLite", "rag_ready": get_rag_status()["vector_store_loaded"]}
