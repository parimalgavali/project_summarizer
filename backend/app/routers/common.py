import logging
import os
from dataclasses import dataclass

from fastapi import HTTPException, Query
from sqlalchemy.orm import Session

from ..models.database import Audio, Document, Summary

logger = logging.getLogger(__name__)

VALID_FORMATS = ["short_text", "bullet_points", "academic_tone"]
DEFAULT_PAGE_SIZE = 100
MAX_PAGE_SIZE = 500


@dataclass
class Pagination:
    limit: int
    offset: int


def pagination_params(
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    offset: int = Query(0, ge=0),
) -> Pagination:
    return Pagination(limit=limit, offset=offset)


def paginated(data: list, total: int, page: Pagination) -> dict:
    return {"data": data, "total": total, "limit": page.limit, "offset": page.offset}


def validate_format_type(format_type: str) -> None:
    if format_type not in VALID_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid format_type. Must be one of: {', '.join(VALID_FORMATS)}",
        )


def get_summarizable_document(db: Session, document_id: str) -> Document:
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.extracted_text:
        raise HTTPException(status_code=400, detail="Document text not extracted yet")

    if len(doc.extracted_text.strip()) < 100:
        raise HTTPException(
            status_code=400, detail="Document too short for summarization"
        )
    return doc


def delete_audio_record(db: Session, audio: Audio) -> None:
    """Delete an audio row and its generated file without committing."""
    if audio.audio_file_path and os.path.exists(audio.audio_file_path):
        try:
            os.remove(audio.audio_file_path)
        except Exception:
            logger.warning(
                "Could not delete audio file %s", audio.audio_file_path, exc_info=True
            )

    db.delete(audio)


def serialize_summary(summary: Summary, document: Document) -> dict:
    return {
        "id": summary.id,
        "document_id": summary.document_id,
        "document_filename": (
            summary.custom_name if summary.custom_name else document.filename
        ),
        "summary_text": summary.summary_text,
        "summary_word_count": summary.summary_word_count,
        "summary_type": summary.summary_type,
        "llm_model": summary.llm_model,
        "processing_time_seconds": summary.processing_time_seconds,
        "tokens_used": summary.tokens_used,
        "approval_status": summary.approval_status,
        "custom_name": summary.custom_name,
        "created_at": summary.created_at.isoformat() if summary.created_at else None,
    }


def serialize_audio(audio: Audio, summary=None, document=None) -> dict:
    return {
        "id": audio.id,
        "summary_id": audio.summary_id,
        "document_filename": document.filename if document else None,
        "summary_type": summary.summary_type if summary else None,
        "audio_length_seconds": audio.audio_length_seconds,
        "audio_format": audio.audio_format,
        "tts_model": audio.tts_model,
        "processing_time_seconds": audio.processing_time_seconds,
        "characters_processed": audio.characters_processed,
        "created_at": audio.created_at.isoformat() if audio.created_at else None,
    }
