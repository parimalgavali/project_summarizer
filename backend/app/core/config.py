"""
Application configuration
"""

from typing import List, Literal
from pydantic_settings import BaseSettings
from pydantic import field_validator
import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()


class Settings(BaseSettings):

    # E2E TESTING VARIABLE set Defaults to 'PRODUCTION' if not explicitly set in .env
    ENV: Literal["TEST", "PRODUCTION", "DEVELOPMENT"] = "PRODUCTION"

    # Application settings
    APP_NAME: str = "Document Summarizer API"
    APP_VERSION: str = os.getenv("APP_VERSION", "0.1.0")
    # APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # API settings
    API_V1_PREFIX: str = "/api/v1"
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS settings
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:6701",
    ]

    # File upload settings
    MAX_UPLOAD_SIZE: int = 10485760  # 10MB
    ALLOWED_EXTENSIONS: List[str] = [".pdf", ".docx", ".doc", ".txt"]
    UPLOAD_DIR: str = "uploads"
    AUDIO_DIR: str = "audio"

    # Summarization settings
    AI_PROVIDER: Literal["ollama", "openai", "huggingface"] = "ollama"
    HF_MODEL_ID: str = "sshleifer/distilbart-cnn-12-6"
    HF_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"
    OPENAI_API_KEY: str = ""
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"
    OLLAMA_EMBED_MODEL: str = "embeddinggemma"
    OLLAMA_NUM_CTX: int = 2048
    OLLAMA_KEEP_ALIVE: str = "0"
    OLLAMA_MAX_INPUT_CHARS: int = 12000

    # Text-to-speech settings
    TTS_PROVIDER: Literal["macos_say", "openai"] = "macos_say"
    MACOS_SAY_VOICE: str = "Samantha"

    # Text extraction settings
    EXTRACT_IMAGES_FROM_PDF: bool = False
    OCR_ENABLED: bool = False

    # Summary settings
    ENABLE_KEY_FINDINGS: bool = True
    MAX_KEY_FINDINGS: int = 10
    ENABLE_INLINE_EDITING: bool = True

    # Database
    DATABASE_URL: str = "postgresql://postgres:sql@localhost/summarizer"

    # Logging
    LOG_LEVEL: str = "INFO"

    @field_validator("ALLOWED_EXTENSIONS", mode="before")
    def parse_allowed_extensions(cls, v):
        if isinstance(v, str):
            return [ext.strip() for ext in v.split(",")]
        return v

    @field_validator("CORS_ORIGINS", mode="before")
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    class Config:
        env_file = ".env"
        case_sensitive = True


# Create settings instance
settings = Settings()

# Create upload directory if it doesn't exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.AUDIO_DIR, exist_ok=True)

# Database configuration - PostgreSQL for production-ready development
DATABASE_URL = settings.DATABASE_URL

# SQLAlchemy setup
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
