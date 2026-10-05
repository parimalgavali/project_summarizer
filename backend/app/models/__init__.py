# API and Database models package
from typing import Literal, Optional
from pydantic import BaseModel, Field

DocStatus = Literal[
    "uploaded", "processing", "text_ready", "extraction_failed", "summary_ready"
]
SummaryType = Literal["general", "short_text", "bullet_points", "academic_tone"]

# Import database models for easier access
from .database import Document, Summary, Audio


class UploadResponse(BaseModel):
    id: str
    filename: str
    status: DocStatus = Field(default="uploaded")
    message: str | None = None
    summary_text: str | None = None
    summary_word_count: int | None = None


class SummarizeRequest(BaseModel):
    summary_type: SummaryType = "general"
    max_length: Optional[int] = 150
    custom_text: Optional[str] = None


class SummaryResponse(BaseModel):
    id: str
    document_id: str
    document_filename: str
    custom_name: str | None = None
    summary_text: str
    summary_word_count: int
    summary_type: str
    llm_model: str
    processing_time_seconds: float
    tokens_used: int
    approval_status: str = "pending"
    created_at: str


ApprovalStatus = Literal["approved", "rejected", "final_approved"]


class ApprovalRequest(BaseModel):
    status: ApprovalStatus
    custom_name: Optional[str] = None


class EditRequest(BaseModel):
    edited_text: str


class AudioResponse(BaseModel):
    id: str
    summary_id: str
    audio_length_seconds: float
    audio_format: str
    tts_model: str
    processing_time_seconds: float
    characters_processed: int
    created_at: str
