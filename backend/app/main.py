from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import mimetypes
import dotenv
import shutil
import os

# Load environment variables from parent directory
dotenv.load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

from .models import (
    UploadResponse,
    SummarizeRequest,
    SummaryResponse,
    ApprovalRequest,
    EditRequest,
    AudioResponse,
)
from .core.config import settings, Base, engine
from .storage import save_upload
from .core.config import SessionLocal
from .services.summarization import SummarizationService
from .services.audio import AudioService
from .models.database import Audio  # Ensure Audio model is imported for table creation
from sqlalchemy import text
from fastapi import APIRouter

# app = FastAPI(title="Summarizer Backend", version="0.1.0")
app = FastAPI(title="Summarizer Backend", version=settings.APP_VERSION)


# Create database tables automatically on startup
@app.on_event("startup")
async def create_tables():
    """Create database tables automatically on startup"""
    try:
        Base.metadata.create_all(bind=engine)
        print("Database tables created/verified successfully")
        # Add approval_status column if it doesn't exist
        try:
            with engine.connect() as conn:
                conn.execute(
                    text(
                        "ALTER TABLE summaries ADD COLUMN approval_status VARCHAR DEFAULT 'pending'"
                    )
                )
                conn.commit()
            print("Approval status column added/verified")
        except Exception as e:
            print(f"Approval status column already exists or error: {e}")

        # Add custom_name column if it doesn't exist
        try:
            with engine.connect() as conn:
                conn.execute(
                    text("ALTER TABLE summaries ADD COLUMN custom_name VARCHAR")
                )
                conn.commit()
            print("Custom name column added/verified")
        except Exception as e:
            print(f"Custom name column already exists or error: {e}")
    except Exception as e:
        print(f"Error creating database tables: {e}")
        # Don't crash the app, just log the error


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXT = {".pdf", ".docx", ".txt"}


def _ext_ok(name: str) -> bool:
    return any(name.lower().endswith(ext) for ext in ALLOWED_EXT)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def delete_audio_record(db: Session, audio: Audio) -> None:
    """Delete an audio row and its generated file without committing."""
    if audio.audio_file_path and os.path.exists(audio.audio_file_path):
        try:
            os.remove(audio.audio_file_path)
        except Exception as e:
            print(f"Warning: Could not delete audio file {audio.audio_file_path}: {e}")

    db.delete(audio)


def serialize_audio(audio: Audio, summary=None, document=None):
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


@app.get("/v1/models")
async def get_models():
    model_id = {
        "ollama": settings.OLLAMA_MODEL,
        "openai": settings.OPENAI_MODEL,
        "huggingface": settings.HF_MODEL_ID,
    }.get(settings.AI_PROVIDER, settings.OLLAMA_MODEL)

    return {"data": [{"id": model_id, "provider": settings.AI_PROVIDER}]}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if request.url.path.startswith("/v1/"):
        # Return empty response for unimplemented API endpoints
        return {"data": {}, "error": None}
    raise exc


@app.post("/documents/upload", response_model=UploadResponse)
async def upload_document(
    file: UploadFile = File(...), format_type: str = Form("short_text")
):
    # Validate format_type
    valid_formats = ["short_text", "bullet_points", "academic_tone"]
    if format_type not in valid_formats:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid format_type. Must be one of: {', '.join(valid_formats)}",
        )
    # 1) Validate extension
    if not _ext_ok(file.filename):
        raise HTTPException(
            status_code=400, detail="Unsupported file type. Allowed: PDF, DOCX, TXT."
        )

    # 2) Validate size
    content = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE
    if len(content) > max_bytes:
        max_mb = max_bytes // (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"File too large. Max {max_mb} MB.")

    # 3) Persist file
    doc_id, path = save_upload(file.filename, content)

    # 4) Save file to database and start text extraction
    try:
        from .services.text_extraction import TextExtractionService
        from .core.config import SessionLocal
        from .models.database import Document

        db = SessionLocal()
        try:
            # Initialize text extraction service
            text_extractor = TextExtractionService()

            # Extract text from the uploaded file
            text, word_count, success, error = text_extractor.extract_text_sync(
                str(path), doc_id
            )

            if success:
                # Update database with extracted text
                from datetime import datetime

                db_doc = Document(
                    id=doc_id,
                    filename=file.filename,
                    file_path=str(path),
                    file_size=len(content),
                    extracted_text=text,
                    word_count=word_count,
                    extraction_status="extracted",
                )
                db.add(db_doc)
                db.commit()

                # # Immediately generate summary if text was successfully extracted
                # try:
                #     print(f"[UPLOAD] Starting automatic summarization for document {doc_id} with format: {format_type}")
                #     summarizer = SummarizationService()
                #     # Use the selected format for automatic summarization
                #     summary_text, processing_time, tokens_used = summarizer.summarize_text(text, format_type)
                #     print(f"[UPLOAD] Generated summary type: {format_type}, length: {len(summary_text)} chars")

                #     # Determine model name
                #     import os
                #     model_name = os.getenv("HF_MODEL_ID", "sshleifer/distilbart-cnn-12-6")

                #     # Create summary record
                #     from .models.database import Summary
                #     import uuid
                #     from datetime import datetime

                #     summary_id = str(uuid.uuid4())
                #     summary = Summary(
                #         id=summary_id,
                #         document_id=doc_id,
                #         summary_text=summary_text,
                #         summary_word_count=len(summary_text.split()),
                #         summary_type=format_type,
                #         llm_model=model_name,
                #         processing_time_seconds=processing_time,
                #         tokens_used=tokens_used,
                #         approval_status="pending"
                #     )

                #     db.add(summary)
                #     db.commit()

                #     print(f"[UPLOAD] Summary created successfully: {len(summary_text.split())} words")

                #     return UploadResponse(
                #         id=doc_id,
                #         filename=file.filename,
                #         status="summary_ready",
                #         message=f"Successfully processed document with {word_count} words and {len(summary_text.split())} word summary",
                #         summary_text=summary_text,
                #         summary_word_count=len(summary_text.split())
                #     )
                # except Exception as e:
                #     print(f"[UPLOAD] Automatic summarization failed: {e}")
                #     # Still return success for upload/text extraction, summarization failed silently for now
                return UploadResponse(
                    id=doc_id,
                    filename=file.filename,
                    status="text_ready",
                    message=f"Successfully extracted {word_count} words",
                )
            else:
                # Save with extraction failure
                db_doc = Document(
                    id=doc_id,
                    filename=file.filename,
                    file_path=str(path),
                    file_size=len(content),
                    extracted_text="",
                    word_count=0,
                    extraction_status="extraction_failed",
                )
                db.add(db_doc)
                db.commit()

                return UploadResponse(
                    id=doc_id,
                    filename=file.filename,
                    status="extraction_failed",
                    message=f"Text extraction failed: {error}",
                )
        finally:
            db.close()

    except Exception as e:
        # If text extraction fails, still return uploaded status
        return UploadResponse(
            id=doc_id,
            filename=file.filename,
            status="uploaded",
            message=f"File uploaded but text extraction failed: {str(e)}",
        )


@app.post("/documents/{document_id}/preview-summary")
async def preview_summary(
    document_id: str,
    request: SummarizeRequest = SummarizeRequest(),
    db: Session = Depends(get_db),
):
    """Generate a summary preview without saving to database"""
    from .models.database import Document

    # Get document from database
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.extracted_text:
        raise HTTPException(status_code=400, detail="Document text not extracted yet")

    if len(doc.extracted_text.strip()) < 100:
        raise HTTPException(
            status_code=400, detail="Document too short for summarization"
        )

    try:
        # Initialize summarization service
        summarizer = SummarizationService()

        # Generate summary with selected format
        summary_text, processing_time, tokens_used = summarizer.summarize_text(
            doc.extracted_text, request.summary_type
        )
        model_name = summarizer.get_model_name()

        # Return preview response (not saved)
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
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")


@app.post("/documents/{document_id}/summarize", response_model=SummaryResponse)
async def summarize_document(
    document_id: str,
    request: SummarizeRequest = SummarizeRequest(),
    db: Session = Depends(get_db),
):
    from .models.database import Document

    # Get document from database
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.extracted_text:
        raise HTTPException(status_code=400, detail="Document text not extracted yet")

    if len(doc.extracted_text.strip()) < 100:
        raise HTTPException(
            status_code=400, detail="Document too short for summarization"
        )

    try:
        # Check if custom text is provided (for edited summaries)
        if request.custom_text:
            # Use the provided custom text instead of generating
            summary_text = request.custom_text
            processing_time = 0.0
            tokens_used = 0
            model_name = "custom-text"
        else:
            # Generate summary with AI
            summarizer = SummarizationService()
            summary_text, processing_time, tokens_used = summarizer.summarize_text(
                doc.extracted_text, request.summary_type
            )
            model_name = summarizer.get_model_name()

        # Create summary record
        from .models.database import Summary
        import uuid
        from datetime import datetime

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
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")


@app.get("/documents")
async def get_all_documents(db: Session = Depends(get_db)):
    """Get all documents with their latest status"""
    from .models.database import Document

    documents = db.query(Document).all()

    return {
        "data": [
            {
                "id": doc.id,
                "filename": doc.filename,
                "file_size": doc.file_size,
                "extraction_status": doc.extraction_status,
                "word_count": doc.word_count,
                "created_at": doc.created_at.isoformat() if doc.created_at else None,
            }
            for doc in documents
        ]
    }


@app.post("/summaries/{summary_id}/edit")
async def edit_summary(
    summary_id: str, request: EditRequest, db: Session = Depends(get_db)
):
    """Edit an existing summary (update in place)"""
    from .models.database import Summary

    print(
        f"[EDIT] Editing summary {summary_id} with text: {request.edited_text[:50]}..."
    )

    # Get the summary
    summary = db.query(Summary).filter(Summary.id == summary_id).first()
    if not summary:
        print(f"[EDIT] Summary {summary_id} not found")
        raise HTTPException(status_code=404, detail="Summary not found")

    # Update the summary with edited text
    summary.summary_text = request.edited_text
    summary.summary_word_count = len(request.edited_text.split())
    summary.summary_type = "edited"
    summary.llm_model = "human-edited"
    summary.processing_time_seconds = 0.0
    summary.tokens_used = 0

    db.commit()

    print(f"[EDIT] Summary {summary_id} updated successfully")

    return {"id": summary_id, "message": "Summary edited successfully"}


@app.post("/summaries/{summary_id}/approval")
async def update_approval(
    summary_id: str, request: ApprovalRequest, db: Session = Depends(get_db)
):
    """Update the approval status of a summary"""
    from .models.database import Summary, Document

    summary = db.query(Summary).filter(Summary.id == summary_id).first()
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    summary.approval_status = request.status

    # Save custom name if provided
    if request.custom_name and request.custom_name.strip():
        summary.custom_name = request.custom_name.strip()

    db.commit()

    # Get updated summary with document info for response
    updated_summary = (
        db.query(Summary, Document)
        .join(Document, Summary.document_id == Document.id)
        .filter(Summary.id == summary_id)
        .first()
    )
    if updated_summary:
        summary_obj, document_obj = updated_summary
        return {
            "id": summary_obj.id,
            "document_id": summary_obj.document_id,
            "document_filename": (
                summary_obj.custom_name
                if summary_obj.custom_name
                else document_obj.filename
            ),
            "summary_text": summary_obj.summary_text,
            "summary_word_count": summary_obj.summary_word_count,
            "summary_type": summary_obj.summary_type,
            "llm_model": summary_obj.llm_model,
            "processing_time_seconds": summary_obj.processing_time_seconds,
            "tokens_used": summary_obj.tokens_used,
            "approval_status": summary_obj.approval_status,
            "custom_name": summary_obj.custom_name,
            "created_at": (
                summary_obj.created_at.isoformat() if summary_obj.created_at else None
            ),
        }

    return {"message": f"Summary {request.status}"}


@app.post("/summaries/{summary_id}/regenerate")
async def regenerate_summary(
    summary_id: str, request: dict = None, db: Session = Depends(get_db)
):
    """Regenerate a summary with the same or different format"""
    from .models.database import Summary, Document

    summary = db.query(Summary).filter(Summary.id == summary_id).first()
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    doc = db.query(Document).filter(Document.id == summary.document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.extracted_text:
        raise HTTPException(status_code=400, detail="Document text not extracted yet")

    try:
        # Initialize summarization service
        summarizer = SummarizationService()

        # Use provided format or default to the original format
        format_type = (
            request.get("format_type", summary.summary_type)
            if request
            else summary.summary_type
        )

        # Generate new summary with the specified format
        summary_text, processing_time, tokens_used = summarizer.summarize_text(
            doc.extracted_text, format_type
        )

        # Update the existing summary
        summary.summary_text = summary_text
        summary.summary_word_count = len(summary_text.split())
        summary.summary_type = format_type
        summary.processing_time_seconds = processing_time
        summary.tokens_used = tokens_used
        summary.approval_status = "pending"

        db.commit()

        return {"message": "Summary regenerated successfully"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Regeneration failed: {str(e)}")


@app.get("/summary-list")
async def get_all_summaries(db: Session = Depends(get_db)):
    """Get all summaries (for summaries tab)"""
    from .models.database import Summary, Document

    summaries = (
        db.query(Summary, Document)
        .join(Document, Summary.document_id == Document.id)
        .order_by(Summary.created_at.desc())
        .all()
    )

    return {
        "data": [
            {
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
                "created_at": (
                    summary.created_at.isoformat() if summary.created_at else None
                ),
            }
            for summary, document in summaries
        ]
    }


@app.get("/documents/{document_id}/summaries")
async def get_document_summaries(document_id: str, db: Session = Depends(get_db)):
    """Get all summaries for a document"""
    from .models.database import Document, Summary

    summaries = db.query(Summary).filter(Summary.document_id == document_id).all()

    if not summaries:
        return {"data": [], "message": "No summaries found for this document"}

    # Check if document exists
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


@app.delete("/summaries/{summary_id}")
async def delete_summary(summary_id: str, db: Session = Depends(get_db)):
    """Delete a single summary"""
    from .models.database import Audio, Summary

    # Check if summary exists
    summary = db.query(Summary).filter(Summary.id == summary_id).first()
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    audios = db.query(Audio).filter(Audio.summary_id == summary_id).all()
    for audio in audios:
        delete_audio_record(db, audio)

    # Delete the summary
    db.delete(summary)
    db.commit()

    return {"message": f"Summary deleted successfully"}


@app.delete("/documents/{document_id}")
async def delete_document(document_id: str, db: Session = Depends(get_db)):
    """Delete a document and all its summaries"""
    from .models.database import Audio, Document, Summary

    # Check if document exists
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete all summaries for this document
    summaries = db.query(Summary).filter(Summary.document_id == document_id).all()
    for summary in summaries:
        audios = db.query(Audio).filter(Audio.summary_id == summary.id).all()
        for audio in audios:
            delete_audio_record(db, audio)
        db.delete(summary)

    # Delete the document record
    db.delete(doc)

    # Delete the physical file if it exists
    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception as e:
            print(f"Warning: Could not delete file {doc.file_path}: {e}")

    db.commit()

    return {
        "message": f"Document '{doc.filename}' and all its summaries deleted successfully"
    }


@app.get("/audio-list")
async def get_all_audios(db: Session = Depends(get_db)):
    """Get all audios (for audio tab)"""
    from .models.database import Audio, Summary, Document

    audios = (
        db.query(Audio, Summary, Document)
        .join(Summary, Audio.summary_id == Summary.id)
        .join(Document, Summary.document_id == Document.id)
        .order_by(Audio.created_at.desc())
        .all()
    )

    return {
        "data": [
            serialize_audio(audio, summary, document)
            for audio, summary, document in audios
        ]
    }


@app.get("/audios")
async def get_audios(summary_id: str | None = None, db: Session = Depends(get_db)):
    """Get audios, optionally filtered by summary_id."""
    from .models.database import Audio, Summary, Document

    query = (
        db.query(Audio, Summary, Document)
        .join(Summary, Audio.summary_id == Summary.id)
        .join(Document, Summary.document_id == Document.id)
        .order_by(Audio.created_at.desc())
    )

    if summary_id:
        query = query.filter(Audio.summary_id == summary_id)

    audios = query.all()

    return {
        "data": [
            serialize_audio(audio, summary, document)
            for audio, summary, document in audios
        ]
    }


@app.post("/summaries/{summary_id}/generate-audio", response_model=AudioResponse)
async def generate_audio(summary_id: str, db: Session = Depends(get_db)):
    """Generate audio for a summary"""
    from .models.database import Summary
    import uuid
    from datetime import datetime

    # Check if summary exists
    summary = db.query(Summary).filter(Summary.id == summary_id).first()
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    try:
        # Initialize audio service
        audio_service = AudioService()

        # Generate audio
        file_path, duration, chars, processing_time = (
            audio_service.generate_audio_for_summary(
                summary.summary_text, settings.AUDIO_DIR
            )
        )

        # Create audio record
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
        print(f"[ERROR] Audio generation failed: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Audio generation failed: {str(e)}"
        )


@app.get("/audios/{audio_id}/download")
async def download_audio(audio_id: str, db: Session = Depends(get_db)):
    """Download audio file"""
    import os
    from .models.database import Audio
    from fastapi.responses import FileResponse

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


@app.delete("/audios/{audio_id}")
async def delete_audio(audio_id: str, db: Session = Depends(get_db)):
    """Delete an audio"""
    from .models.database import Audio

    audio = db.query(Audio).filter(Audio.id == audio_id).first()
    if not audio:
        raise HTTPException(status_code=404, detail="Audio not found")

    # Delete record
    delete_audio_record(db, audio)
    db.commit()

    return {"message": "Audio deleted successfully"}


@app.post("/documents/{document_id}/generate-audio")
async def generate_audio_from_document(
    document_id: str, request: dict = None, db: Session = Depends(get_db)
):
    """Generate audio directly from a document with specified format"""
    from .models.database import Document, Summary, Audio
    import uuid
    from datetime import datetime

    # Check if document exists and has extracted text
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.extracted_text:
        raise HTTPException(status_code=400, detail="Document text not extracted yet")

    if len(doc.extracted_text.strip()) < 100:
        raise HTTPException(
            status_code=400, detail="Document too short for summarization"
        )

    # Get format_type from request, default to "short_text"
    format_type = request.get("format_type", "short_text") if request else "short_text"
    valid_formats = ["short_text", "bullet_points", "academic_tone"]
    if format_type not in valid_formats:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid format_type. Must be one of: {', '.join(valid_formats)}",
        )

    try:
        # Initialize services
        from .services.summarization import SummarizationService
        from .services.audio import AudioService

        summarizer = SummarizationService()
        audio_service = AudioService()

        # Generate summary
        summary_text, processing_time, tokens_used = summarizer.summarize_text(
            doc.extracted_text, format_type
        )

        model_name = summarizer.get_model_name()

        # Create summary record
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

        # Generate audio from the summary
        file_path, duration, chars, audio_processing_time = (
            audio_service.generate_audio_for_summary(summary_text, settings.AUDIO_DIR)
        )

        # Create audio record
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
        print(f"[ERROR] Audio generation from document failed: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Audio generation failed: {str(e)}"
        )


# E2E Testing Endpoint to Reset Database
def ensure_testing_environment():
    """Dependency that blocks access unless settings.ENV is 'TEST'."""
    # This checks the value loaded into your application's settings object.
    if settings.ENV != "TEST":
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Reset endpoint is disabled in this environment.",
        )


CONTAINER_UPLOAD_DIR = "/code/uploads"
CONTAINER_AUDIO_DIR = "/code/audio"
testing_router = APIRouter()


@testing_router.post("/testing/reset-db", tags=["Testing"])
def reset_database(
    db: Session = Depends(get_db),
    # security check dependency
    is_test_env: None = Depends(ensure_testing_environment),
):
    """
    Resets the database and clears file directories for E2E testing.
    Access is strictly gated by the environment check dependency.
    """

    table_names = ["audios", "summaries", "documents"]

    try:
        db.execute(
            text(f'TRUNCATE TABLE {", ".join(table_names)} RESTART IDENTITY CASCADE;')
        )
        db.commit()

        # Clears file directories
        for dir_path in [CONTAINER_UPLOAD_DIR, CONTAINER_AUDIO_DIR]:
            if not os.path.exists(dir_path):
                print(f"Warning: Test reset directory not found: {dir_path}")
                continue

            for filename in os.listdir(dir_path):
                if filename == ".gitkeep":
                    continue
                file_path = os.path.join(dir_path, filename)
                try:
                    if os.path.isfile(file_path) or os.path.islink(file_path):
                        os.unlink(file_path)
                    elif os.path.isdir(file_path):
                        shutil.rmtree(file_path)
                except Exception as e:
                    print(f"Failed to delete {file_path}. Reason: {e}")

        return {"message": "Database and directories reset successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to reset database: {str(e)}"
        )


app.include_router(testing_router, prefix="/api")
