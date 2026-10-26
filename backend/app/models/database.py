"""
Database models for documents and summaries
"""

from sqlalchemy import JSON, Column, Integer, String, DateTime, Text, ForeignKey, Float
from sqlalchemy.orm import relationship
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ..core.config import Base
from datetime import datetime, timezone


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    file_path = Column(String)
    file_size = Column(Integer)

    # Extraction fields
    extracted_text = Column(Text)
    word_count = Column(Integer)
    extraction_date = Column(DateTime, default=datetime.utcnow)
    extraction_status = Column(String, default="uploaded")

    # Relationships
    summaries = relationship("Summary", back_populates="document")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Summary(Base):
    __tablename__ = "summaries"

    id = Column(String, primary_key=True, index=True)
    document_id = Column(String, ForeignKey("documents.id"))

    # Summary content
    custom_name = Column(String)  # Custom name for approved summaries
    summary_text = Column(Text)
    summary_word_count = Column(Integer)
    summary_type = Column(String, default="general")

    # AI processing details
    llm_model = Column(String)
    processing_time_seconds = Column(Float)
    tokens_used = Column(Integer)

    # Human feedback (for later)
    human_rating = Column(Integer)  # 1-5
    human_feedback = Column(Text)
    approval_status = Column(
        String, default="pending"
    )  # pending, approved, rejected, final_approved

    # Relationships
    document = relationship("Document", back_populates="summaries")

    created_at = Column(DateTime, default=datetime.utcnow)


class Audio(Base):
    __tablename__ = "audios"

    id = Column(String, primary_key=True, index=True)
    summary_id = Column(String, ForeignKey("summaries.id"))

    # Audio details
    audio_file_path = Column(String)
    audio_length_seconds = Column(Float)  # Duration
    audio_format = Column(String, default="mp3")
    tts_model = Column(String, default="tts-1")

    # Processing details
    processing_time_seconds = Column(Float)
    characters_processed = Column(Integer)

    created_at = Column(DateTime, default=datetime.utcnow)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class DocumentChunk(Base):
    """A slice of a document's extracted text plus its embedding vector."""

    __tablename__ = "document_chunks"

    id = Column(String, primary_key=True)
    document_id = Column(
        String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    chunk_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    # JSON list of floats; similarity is computed in Python (no pgvector needed).
    embedding = Column(JSON, nullable=False)
    embedding_model = Column(String, nullable=False)

    created_at = Column(DateTime, default=_utcnow)
