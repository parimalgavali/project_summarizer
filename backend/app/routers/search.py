import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core.config import get_db
from ..dependencies import get_embedding_service
from ..models import SearchResponse, SearchResult
from ..models.database import Document, Summary
from ..services.embeddings import EmbeddingService
from ..services.search import best_chunk_per_document, snippet

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Search"])


@router.get("/search", response_model=SearchResponse)
async def search_documents(
    q: str = Query(..., min_length=1, max_length=1000),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    embedder: EmbeddingService = Depends(get_embedding_service),
):
    """Rank documents by cosine similarity between the query and their chunks."""
    query = q.strip()
    if not query:
        raise HTTPException(status_code=422, detail="Query must not be blank")

    try:
        query_embedding = await run_in_threadpool(embedder.embed_text, query)
    except Exception:
        logger.exception("Embedding the search query failed")
        raise HTTPException(status_code=503, detail="Embedding service unavailable")

    ranked = best_chunk_per_document(db, query_embedding, embedder.model_name)[:limit]
    document_ids = [chunk.document_id for chunk, _ in ranked]
    documents = {
        doc.id: doc
        for doc in db.query(Document).filter(Document.id.in_(document_ids))
    }
    summary_counts = dict(
        db.query(Summary.document_id, func.count(Summary.id))
        .filter(Summary.document_id.in_(document_ids))
        .group_by(Summary.document_id)
    )
    latest_summaries: dict[str, str] = {}
    for summary_id, document_id in (
        db.query(Summary.id, Summary.document_id)
        .filter(Summary.document_id.in_(document_ids))
        .order_by(Summary.created_at.desc(), Summary.id)
    ):
        latest_summaries.setdefault(document_id, summary_id)

    results = [
        SearchResult(
            document_id=chunk.document_id,
            document_filename=documents[chunk.document_id].filename,
            score=round(score, 4),
            chunk_index=chunk.chunk_index,
            snippet=snippet(chunk.text),
            summary_count=summary_counts.get(chunk.document_id, 0),
            latest_summary_id=latest_summaries.get(chunk.document_id),
        )
        for chunk, score in ranked
        if chunk.document_id in documents
    ]
    return SearchResponse(query=query, data=results)
