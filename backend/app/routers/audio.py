import logging
import mimetypes
import os
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..core.config import get_db, settings
from ..dependencies import get_audio_service, get_summarization_service
from ..models import AudioResponse
from ..models.database import Audio, Document, Summary
from ..services.audio import AudioService
from ..services.summarization import SummarizationService
from .common import (
    Pagination,
    delete_audio_record,
    get_summarizable_document,
    paginated,
    pagination_params,
    serialize_audio,
    validate_format_type,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Audio"])


def _audio_query(db: Session):
    return db.query(Audio, Summary, Document).join(
        Summary, Audio.summary_id == Summary.id
    ).join(Document, Summary.document_id == Document.id)


@router.get("/audio-list")
def get_all_audios(
    db: Session = Depends(get_db), page: Pagination = Depends(pagination_params)
):
    """Get audios for the audio tab (paginated, newest first)"""
    query = _audio_query(db)
    total = query.count()
    audios = (
        query.order_by(Audio.created_at.desc(), Audio.id)
        .offset(page.offset)
        .limit(page.limit)
        .all()
    )

    return paginated(
        [serialize_audio(audio, summary, document) for audio, summary, document in audios],
        total,
        page,
    )


@router.get("/audios")
def get_audios(summary_id: str | None = None, db: Session = Depends(get_db)):
    """Get audios, optionally filtered by summary_id."""
    query = _audio_query(db).order_by(Audio.created_at.desc())

    if summary_id:
        query = query.filter(Audio.summary_id == summary_id)

    return {
        "data": [
            serialize_audio(audio, summary, document)
            for audio, summary, document in query.all()
        ]
    }


@router.post("/summaries/{summary_id}/generate-audio", response_model=AudioResponse)
async def generate_audio(
    summary_id: str,
    db: Session = Depends(get_db),
    audio_service: AudioService = Depends(get_audio_service),
):
    """Generate audio for a summary"""
    summary = db.query(Summary).filter(Summary.id == summary_id).first()
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    try:
        file_path, duration, chars, processing_time = await run_in_threadpool(
            audio_service.generate_audio_for_summary,
            summary.summary_text,
            settings.AUDIO_DIR,
        )

        audio_id = str(uuid.uuid4())
        audio = Audio(
            id=audio_id,
            summary_id=summary_id,
            audio_file_path=file_path,
            audio_length_seconds=duration,
            audio_format=audio_service.audio_format,
            tts_model=audio_service.tts_model,
            processing_time_seconds=processing_time,
            characters_processed=chars,
        )

        db.add(audio)
        db.commit()

        return AudioResponse(
            id=audio_id,
            summary_id=summary_id,
            audio_length_seconds=duration,
            audio_format=audio_service.audio_format,
            tts_model=audio_service.tts_model,
            processing_time_seconds=processing_time,
            characters_processed=chars,
            created_at=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        db.rollback()
        logger.exception("Audio generation failed for summary %s", summary_id)
        raise HTTPException(
            status_code=500, detail=f"Audio generation failed: {str(e)}"
        )


@router.get("/audios/{audio_id}/download")
def download_audio(audio_id: str, db: Session = Depends(get_db)):
    """Download audio file"""
    audio = db.query(Audio).filter(Audio.id == audio_id).first()
    if not audio:
        raise HTTPException(status_code=404, detail="Audio not found")

    if not audio.audio_file_path or not os.path.exists(audio.audio_file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")

    return FileResponse(
        path=audio.audio_file_path,
        media_type=mimetypes.guess_type(audio.audio_file_path)[0]
        or "application/octet-stream",
        filename=f"summary_audio_{audio_id}.{audio.audio_format}",
    )


@router.delete("/audios/{audio_id}")
def delete_audio(audio_id: str, db: Session = Depends(get_db)):
    """Delete an audio"""
    audio = db.query(Audio).filter(Audio.id == audio_id).first()
    if not audio:
        raise HTTPException(status_code=404, detail="Audio not found")

    delete_audio_record(db, audio)
    db.commit()

    return {"message": "Audio deleted successfully"}


@router.post("/documents/{document_id}/generate-audio")
async def generate_audio_from_document(
    document_id: str,
    request: dict | None = None,
    db: Session = Depends(get_db),
    summarizer: SummarizationService = Depends(get_summarization_service),
    audio_service: AudioService = Depends(get_audio_service),
):
    """Generate audio directly from a document with specified format"""
    doc = get_summarizable_document(db, document_id)

    format_type = request.get("format_type", "short_text") if request else "short_text"
    validate_format_type(format_type)

    try:
        summary_text, processing_time, tokens_used = await run_in_threadpool(
            summarizer.summarize_text, doc.extracted_text, format_type
        )
        model_name = summarizer.get_model_name()

        summary_id = str(uuid.uuid4())
        summary = Summary(
            id=summary_id,
            document_id=document_id,
            summary_text=summary_text,
            summary_word_count=len(summary_text.split()),
            summary_type=format_type,
            llm_model=model_name,
            processing_time_seconds=processing_time,
            tokens_used=tokens_used,
            approval_status="approved",  # Auto-approve since it's for audio
        )
        db.add(summary)
        db.commit()

        file_path, duration, chars, audio_processing_time = await run_in_threadpool(
            audio_service.generate_audio_for_summary, summary_text, settings.AUDIO_DIR
        )

        audio_id = str(uuid.uuid4())
        audio = Audio(
            id=audio_id,
            summary_id=summary_id,
            audio_file_path=file_path,
            audio_length_seconds=duration,
            audio_format=audio_service.audio_format,
            tts_model=audio_service.tts_model,
            processing_time_seconds=audio_processing_time,
            characters_processed=chars,
        )

        db.add(audio)
        db.commit()

        return {
            "audio_id": audio_id,
            "summary_id": summary_id,
            "summary_text": summary_text,
            "summary_word_count": len(summary_text.split()),
            "summary_type": format_type,
            "llm_model": model_name,
            "audio_length_seconds": duration,
            "audio_format": audio_service.audio_format,
            "tts_model": audio_service.tts_model,
            "processing_time_seconds": audio_processing_time,
            "characters_processed": chars,
            "created_at": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        db.rollback()
        logger.exception("Audio generation from document %s failed", document_id)
        raise HTTPException(
            status_code=500, detail=f"Audio generation failed: {str(e)}"
        )
