import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from ..core.config import get_db
from ..dependencies import get_summarization_service
from ..models import ApprovalRequest, EditRequest, SummarizeRequest, SummaryResponse
from ..models.database import Audio, Document, Summary
from ..services.summarization import SummarizationService
from .common import (
    Pagination,
    delete_audio_record,
    get_summarizable_document,
    paginated,
    pagination_params,
    serialize_summary,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Summaries"])


@router.post("/documents/{document_id}/preview-summary")
async def preview_summary(
    document_id: str,
    request: SummarizeRequest = SummarizeRequest(),
    db: Session = Depends(get_db),
    summarizer: SummarizationService = Depends(get_summarization_service),
):
    """Generate a summary preview without saving to database"""
    doc = get_summarizable_document(db, document_id)

    try:
        summary_text, processing_time, tokens_used = await run_in_threadpool(
            summarizer.summarize_text, doc.extracted_text, request.summary_type
        )
        model_name = summarizer.get_model_name()

        return {
            "summary_text": summary_text,
            "summary_word_count": len(summary_text.split()),
            "summary_type": request.summary_type,
            "llm_model": model_name,
            "processing_time_seconds": processing_time,
            "tokens_used": tokens_used,
            "document_id": document_id,
            "document_filename": doc.filename,
        }

    except Exception as e:
        logger.exception("Summary preview failed for document %s", document_id)
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")


@router.post("/documents/{document_id}/summarize", response_model=SummaryResponse)
async def summarize_document(
    document_id: str,
    request: SummarizeRequest = SummarizeRequest(),
    db: Session = Depends(get_db),
    summarizer: SummarizationService = Depends(get_summarization_service),
):
    doc = get_summarizable_document(db, document_id)

    try:
        if request.custom_text:
            # Use the provided (possibly edited) text instead of generating
            summary_text = request.custom_text
            processing_time = 0.0
            tokens_used = 0
            model_name = "custom-text"
        else:
            summary_text, processing_time, tokens_used = await run_in_threadpool(
                summarizer.summarize_text, doc.extracted_text, request.summary_type
            )
            model_name = summarizer.get_model_name()

        summary_id = str(uuid.uuid4())
        summary = Summary(
            id=summary_id,
            document_id=document_id,
            summary_text=summary_text,
            summary_word_count=len(summary_text.split()),
            summary_type=request.summary_type,
            llm_model=model_name,
            processing_time_seconds=processing_time,
            tokens_used=tokens_used,
            approval_status="pending",
        )

        db.add(summary)
        db.commit()

        return SummaryResponse(
            id=summary_id,
            document_id=document_id,
            document_filename=doc.filename,
            summary_text=summary_text,
            summary_word_count=len(summary_text.split()),
            summary_type=request.summary_type,
            llm_model=model_name,
            processing_time_seconds=processing_time,
            tokens_used=tokens_used,
            created_at=datetime.utcnow().isoformat(),
            approval_status="pending",
        )

    except Exception as e:
        db.rollback()
        logger.exception("Summarization failed for document %s", document_id)
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")


@router.post("/summaries/{summary_id}/edit")
def edit_summary(summary_id: str, request: EditRequest, db: Session = Depends(get_db)):
    """Edit an existing summary (update in place)"""
    summary = db.query(Summary).filter(Summary.id == summary_id).first()
    if not summary:
        logger.info("Edit requested for missing summary %s", summary_id)
        raise HTTPException(status_code=404, detail="Summary not found")

    summary.summary_text = request.edited_text
    summary.summary_word_count = len(request.edited_text.split())
    summary.summary_type = "edited"
    summary.llm_model = "human-edited"
    summary.processing_time_seconds = 0.0
    summary.tokens_used = 0

    db.commit()
    logger.info("Summary %s edited", summary_id)

    return {"id": summary_id, "message": "Summary edited successfully"}


@router.post("/summaries/{summary_id}/approval")
def update_approval(
    summary_id: str, request: ApprovalRequest, db: Session = Depends(get_db)
):
    """Update the approval status of a summary"""
    summary = db.query(Summary).filter(Summary.id == summary_id).first()
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    summary.approval_status = request.status

    if request.custom_name and request.custom_name.strip():
        summary.custom_name = request.custom_name.strip()

    db.commit()

    updated_summary = (
        db.query(Summary, Document)
        .join(Document, Summary.document_id == Document.id)
        .filter(Summary.id == summary_id)
        .first()
    )
    if updated_summary:
        summary_obj, document_obj = updated_summary
        return serialize_summary(summary_obj, document_obj)

    return {"message": f"Summary {request.status}"}


@router.post("/summaries/{summary_id}/regenerate")
async def regenerate_summary(
    summary_id: str,
    request: dict | None = None,
    db: Session = Depends(get_db),
    summarizer: SummarizationService = Depends(get_summarization_service),
):
    """Regenerate a summary with the same or different format"""
    summary = db.query(Summary).filter(Summary.id == summary_id).first()
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    doc = db.query(Document).filter(Document.id == summary.document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.extracted_text:
        raise HTTPException(status_code=400, detail="Document text not extracted yet")

    try:
        format_type = (
            request.get("format_type", summary.summary_type)
            if request
            else summary.summary_type
        )

        summary_text, processing_time, tokens_used = await run_in_threadpool(
            summarizer.summarize_text, doc.extracted_text, format_type
        )

        summary.summary_text = summary_text
        summary.summary_word_count = len(summary_text.split())
        summary.summary_type = format_type
        summary.processing_time_seconds = processing_time
        summary.tokens_used = tokens_used
        summary.approval_status = "pending"

        db.commit()

        return {"message": "Summary regenerated successfully"}

    except Exception as e:
        db.rollback()
        logger.exception("Regeneration failed for summary %s", summary_id)
        raise HTTPException(status_code=500, detail=f"Regeneration failed: {str(e)}")


@router.get("/summary-list")
def get_all_summaries(
    db: Session = Depends(get_db), page: Pagination = Depends(pagination_params)
):
    """Get summaries for the summaries tab (paginated, newest first)"""
    query = db.query(Summary, Document).join(
        Document, Summary.document_id == Document.id
    )
    total = query.count()
    summaries = (
        query.order_by(Summary.created_at.desc(), Summary.id)
        .offset(page.offset)
        .limit(page.limit)
        .all()
    )

    return paginated(
        [serialize_summary(summary, document) for summary, document in summaries],
        total,
        page,
    )


@router.get("/documents/{document_id}/summaries")
def get_document_summaries(document_id: str, db: Session = Depends(get_db)):
    """Get all summaries for a document"""
    summaries = db.query(Summary).filter(Summary.document_id == document_id).all()

    if not summaries:
        return {"data": [], "message": "No summaries found for this document"}

    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return {
        "data": [
            {
                "id": summary.id,
                "summary_text": summary.summary_text,
                "summary_word_count": summary.summary_word_count,
                "summary_type": summary.summary_type,
                "llm_model": summary.llm_model,
                "processing_time_seconds": summary.processing_time_seconds,
                "tokens_used": summary.tokens_used,
                "approval_status": summary.approval_status,
                "created_at": (
                    summary.created_at.isoformat() if summary.created_at else None
                ),
            }
            for summary in summaries
        ],
        "document_filename": doc.filename,
    }


@router.delete("/summaries/{summary_id}")
def delete_summary(summary_id: str, db: Session = Depends(get_db)):
    """Delete a single summary"""
    summary = db.query(Summary).filter(Summary.id == summary_id).first()
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    audios = db.query(Audio).filter(Audio.summary_id == summary_id).all()
    for audio in audios:
        delete_audio_record(db, audio)

    db.delete(summary)
    db.commit()

    return {"message": "Summary deleted successfully"}
