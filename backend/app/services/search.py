"""
Chunk embedding storage and cosine-similarity ranking for semantic search.

Vectors are stored as JSON in `document_chunks` and ranked in Python, which
keeps plain PostgreSQL (no pgvector) working. Every stored chunk for the
current embedding model is scored per query, so this suits small/medium
libraries; move to pgvector + an ANN index if the corpus grows large.
"""

import math
import uuid

from sqlalchemy.orm import Session

from ..models.database import DocumentChunk
from .embeddings import EmbeddingService
from .summarization import SummarizationService

CHUNK_TOKENS = 400
CHUNK_OVERLAP_TOKENS = 50
SNIPPET_CHARS = 300


def embed_document_chunks(
    text: str, embedder: EmbeddingService, summarizer: SummarizationService
) -> list[tuple[str, list[float]]]:
    """Split text with the summarizer's chunking helper and embed each chunk."""
    chunks = [
        chunk.strip()
        for chunk in summarizer.chunk_text_by_tokens(
            text, max_tokens=CHUNK_TOKENS, overlap_tokens=CHUNK_OVERLAP_TOKENS
        )
        if chunk.strip()
    ]
    return [(chunk, embedder.embed_text(chunk)) for chunk in chunks]


def replace_document_chunks(
    db: Session,
    document_id: str,
    embedded_chunks: list[tuple[str, list[float]]],
    model_name: str,
) -> None:
    """Replace a document's stored chunks without committing."""
    db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).delete()
    db.add_all(
        DocumentChunk(
            id=str(uuid.uuid4()),
            document_id=document_id,
            chunk_index=index,
            text=chunk,
            embedding=embedding,
            embedding_model=model_name,
        )
        for index, (chunk, embedding) in enumerate(embedded_chunks)
    )


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return dot / norm if norm else 0.0


def best_chunk_per_document(
    db: Session, query_embedding: list[float], model_name: str
) -> list[tuple[DocumentChunk, float]]:
    """Highest-scoring chunk of each document, best first (score > 0 only)."""
    best: dict[str, tuple[DocumentChunk, float]] = {}
    chunks = db.query(DocumentChunk).filter(
        DocumentChunk.embedding_model == model_name
    )
    for chunk in chunks:
        score = cosine_similarity(query_embedding, chunk.embedding or [])
        current = best.get(chunk.document_id)
        if score > 0 and (current is None or score > current[1]):
            best[chunk.document_id] = (chunk, score)
    return sorted(best.values(), key=lambda item: item[1], reverse=True)


def snippet(text: str) -> str:
    text = " ".join(text.split())
    if len(text) <= SNIPPET_CHARS:
        return text
    return text[:SNIPPET_CHARS].rsplit(" ", 1)[0] + "…"
