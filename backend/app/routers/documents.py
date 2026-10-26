import logging
import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from ..core.config import get_db, settings
from ..dependencies import (
    get_embedding_service,
    get_summarization_service,
    get_text_extraction_service,
)
from ..models import UploadResponse
from ..models.database import Audio, Document, DocumentChunk, Summary
from ..services.embeddings import EmbeddingService
from ..services.search import embed_document_chunks, replace_document_chunks
from ..services.summarization import SummarizationService
from ..services.text_extraction import TextExtractionService
from ..storage import save_upload
from .common import (
    Pagination,
    delete_audio_record,
    paginated,
    pagination_params,
    validate_format_type,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Documents"])

ALLOWED_EXT = {".pdf", ".docx", ".txt"}


def _ext_ok(name: str) -> bool:
    return any(name.lower().endswith(ext) for ext in ALLOWED_EXT)


async def _index_document(
    db: Session,
    document_id: str,
    text: str,
    embedder: EmbeddingService,
    summarizer: SummarizationService,
) -> None:
    """Store search embeddings; failures are logged so the upload still succeeds."""
    try:
        embedded = await run_in_threadpool(
            embed_document_chunks, text, embedder, summarizer
        )
        replace_document_chunks(db, document_id, embedded, embedder.model_name)
        db.commit()
        logger.info("Indexed %d chunks for document %s", len(embedded), document_id)
    except Exception:
        db.rollback()
        logger.warning(
            "Embedding failed for document %s; it will not appear in search",
            document_id,
            exc_info=True,
        )


@router.post("/documents/upload", response_model=UploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    format_type: str = Form("short_text"),
    db: Session = Depends(get_db),
    text_extractor: TextExtractionService = Depends(get_text_extraction_service),
    embedder: EmbeddingService = Depends(get_embedding_service),
    summarizer: SummarizationService = Depends(get_summarization_service),
):
    validate_format_type(format_type)

    if not _ext_ok(file.filename):
        raise HTTPException(
            status_code=400, detail="Unsupported file type. Allowed: PDF, DOCX, TXT."
        )

    content = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE
    if len(content) > max_bytes:
        max_mb = max_bytes // (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"File too large. Max {max_mb} MB.")

    doc_id, path = await run_in_threadpool(save_upload, file.filename, content)

    try:
        text, word_count, success, error = await run_in_threadpool(
            text_extractor.extract_text_sync, str(path), doc_id
        )

        db_doc = Document(
            id=doc_id,
            filename=file.filename,
            file_path=str(path),
            file_size=len(content),
            extracted_text=text if success else "",
            word_count=word_count if success else 0,
            extraction_status="extracted" if success else "extraction_failed",
        )
        db.add(db_doc)
        db.commit()

        if success:
            await _index_document(db, doc_id, text, embedder, summarizer)
            return UploadResponse(
                id=doc_id,
                filename=file.filename,
                status="text_ready",
                message=f"Successfully extracted {word_count} words",
            )

        logger.warning("Text extraction failed for document %s: %s", doc_id, error)
        return UploadResponse(
            id=doc_id,
            filename=file.filename,
            status="extraction_failed",
            message=f"Text extraction failed: {error}",
        )

    except Exception as e:
        db.rollback()
        logger.exception("Upload processing failed for document %s", doc_id)
        return UploadResponse(
            id=doc_id,
            filename=file.filename,
            status="uploaded",
            message=f"File uploaded but text extraction failed: {str(e)}",
        )


@router.get("/documents")
def get_all_documents(
    db: Session = Depends(get_db), page: Pagination = Depends(pagination_params)
):
    """Get documents with their latest status (paginated, newest first)"""
    query = db.query(Document)
    total = query.count()
    documents = (
        query.order_by(Document.created_at.desc(), Document.id)
        .offset(page.offset)
        .limit(page.limit)
        .all()
    )

    return paginated(
        [
            {
                "id": doc.id,
                "filename": doc.filename,
                "file_size": doc.file_size,
                "extraction_status": doc.extraction_status,
                "word_count": doc.word_count,
                "created_at": doc.created_at.isoformat() if doc.created_at else None,
            }
            for doc in documents
        ],
        total,
        page,
    )


@router.delete("/documents/{document_id}")
def delete_document(document_id: str, db: Session = Depends(get_db)):
    """Delete a document and all its summaries"""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    summaries = db.query(Summary).filter(Summary.document_id == document_id).all()
    for summary in summaries:
        audios = db.query(Audio).filter(Audio.summary_id == summary.id).all()
        for audio in audios:
            delete_audio_record(db, audio)
        db.delete(summary)

    db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).delete()
    db.delete(doc)

    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception:
            logger.warning("Could not delete file %s", doc.file_path, exc_info=True)

    db.commit()

    return {
        "message": f"Document '{doc.filename}' and all its summaries deleted successfully"
    }
