import logging
import os
from contextlib import asynccontextmanager

import dotenv
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Load environment variables from the backend directory before reading settings
dotenv.load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

from .core.config import Base, engine, settings  # noqa: E402
from .core.logging import configure_logging  # noqa: E402
from .dependencies import get_audio_service, get_embedding_service  # noqa: E402
from .models import database  # noqa: E402,F401  (registers ORM tables on Base)
from .routers import audio, documents, search, summaries, testing  # noqa: E402
from .services.audio import AudioService  # noqa: E402
from .services.embeddings import EmbeddingService  # noqa: E402

configure_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.DB_AUTO_CREATE:
        # Test/dev convenience only; schema is managed by Alembic migrations.
        Base.metadata.create_all(bind=engine)
        logger.info("DB_AUTO_CREATE enabled: database tables created/verified")
    yield


app = FastAPI(
    title="Summarizer Backend",
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/v1/models")
async def get_models(
    audio_service: AudioService = Depends(get_audio_service),
    embedder: EmbeddingService = Depends(get_embedding_service),
):
    model_id = {
        "ollama": settings.OLLAMA_MODEL,
        "openai": settings.OPENAI_MODEL,
        "huggingface": settings.HF_MODEL_ID,
    }.get(settings.AI_PROVIDER, settings.OLLAMA_MODEL)

    return {
        "data": [{"id": model_id, "provider": settings.AI_PROVIDER}],
        "tts": {"provider": settings.TTS_PROVIDER, "model": audio_service.tts_model},
        "embedding": {"model": embedder.model_name},
    }


app.include_router(documents.router)
app.include_router(summaries.router)
app.include_router(audio.router)
app.include_router(search.router)
app.include_router(testing.router, prefix="/api")
