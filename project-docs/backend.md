# Backend Documentation

## Stack

- FastAPI
- SQLAlchemy
- PostgreSQL
- Pydantic Settings
- Ollama for local LLM summaries and embeddings
- macOS `say` for local text-to-speech

## Main Entry Points

- `backend/app/main.py` builds the FastAPI app: lifespan, CORS, logging, the global error handler, and router registration.
- `backend/app/routers/` holds the `APIRouter` modules: `documents.py`, `summaries.py`, `audio.py`, `search.py`, `testing.py` (mounted under `/api`), plus shared helpers in `common.py`.
- `backend/app/dependencies.py` provides cached (singleton) `SummarizationService`, `AudioService`, `TextExtractionService`, and `EmbeddingService` instances as FastAPI dependencies.
- `backend/app/core/config.py` defines settings, database engine, session creation, and the `get_db` dependency.
- `backend/app/core/logging.py` configures the standard `logging` module from `LOG_LEVEL`.
- `backend/app/models/__init__.py` defines API request/response schemas.
- `backend/app/models/database.py` defines database tables.
- `backend/app/storage.py` saves uploaded files.

## Services

| Service | File | Purpose |
| --- | --- | --- |
| Text extraction | `backend/app/services/text_extraction.py` | Extracts text from PDF, DOCX, and TXT files. |
| Summarization | `backend/app/services/summarization.py` | Provider-based summarization. Defaults to Ollama, with optional OpenAI/Hugging Face. |
| Embeddings | `backend/app/services/embeddings.py` | Calls Ollama `/api/embed` using `embeddinggemma`. In `ENV=TEST` returns a deterministic hashed bag-of-words vector instead. |
| Search | `backend/app/services/search.py` | Chunks and embeds documents, stores vectors in `document_chunks`, ranks chunks by cosine similarity. |
| Audio | `backend/app/services/audio.py` | Provider-based audio generation. Defaults to macOS `say`, with optional OpenAI TTS. |

## Local AI Configuration

Default `.env` values:

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
OLLAMA_EMBED_MODEL=embeddinggemma
TTS_PROVIDER=macos_say
MACOS_SAY_VOICE=Samantha
```

## Configuration

- `DATABASE_URL` is required; there is no default.
- `DEBUG` defaults to `False`.
- `LOG_LEVEL` (default `INFO`) controls application logging.
- `DB_AUTO_CREATE=true` runs `Base.metadata.create_all` on startup. Test/dev convenience only; it does not migrate existing tables.

## Migrations

The schema is managed by Alembic (`backend/alembic/`). From `backend/`:

```bash
alembic upgrade head                            # apply migrations
alembic revision --autogenerate -m "describe"   # after changing models/database.py
```

The Docker image runs `alembic upgrade head` before starting Uvicorn. The initial revision (`0001_initial_schema`) also adopts databases created by the old startup hook: existing tables are kept and missing `summaries.approval_status` / `summaries.custom_name` columns are added.

## Semantic Search

1. After a successful upload, `POST /documents/upload` splits the extracted text with `SummarizationService.chunk_text_by_tokens` (400 tokens, 50 overlap), embeds each chunk with `EmbeddingService.embed_text`, and stores the chunks in `document_chunks`. If embedding fails (e.g. Ollama is not running) the upload still succeeds; the document just isn't searchable and a warning is logged.
2. `GET /search?q=...&limit=10` embeds the query, scores every stored chunk produced by the current embedding model (`document_chunks.embedding_model`) with cosine similarity in Python, keeps the best chunk per document, and returns documents ranked by score with a snippet, summary count, and latest summary id. Returns `503` if the query cannot be embedded.
3. Deleting a document deletes its chunks (`ON DELETE CASCADE` as a backstop).

Vectors are stored as JSON, so plain PostgreSQL works without the pgvector extension. Every chunk is scored per query, which is fine for a personal/team-sized library; for large corpora switch the column to pgvector with an ANN index. Documents uploaded before this feature (or while Ollama was down) have no chunks and won't appear in results until re-uploaded.

## Concurrency

Text extraction, summarization and embedding (`requests` calls with long timeouts), and TTS are blocking, so routes run them with `fastapi.concurrency.run_in_threadpool` to keep the event loop free.

## Data Flow

1. `POST /documents/upload` validates and saves the uploaded file.
2. `TextExtractionService` extracts text and word count.
3. A `Document` row stores metadata and extracted text.
4. Extracted text is chunked and embedded into `document_chunks` for semantic search.
5. Summary endpoints call `SummarizationService`.
6. Audio endpoints call `AudioService` and store generated file metadata in `Audio`.
7. Delete endpoints clean dependent audio files/rows before deleting summaries or documents.

## Database Tables

| Table | Purpose |
| --- | --- |
| `documents` | Uploaded document metadata, file path, extracted text, word count, extraction status. |
| `summaries` | Generated or edited summaries, model metadata, approval status, optional custom name. |
| `document_chunks` | Text chunks of each document with their embedding vector (JSON) and the embedding model that produced it (migration `0002_document_chunks`). |
| `audios` | Generated audio file path, format, duration, TTS provider/model, processing metadata. |

## Tests

`backend/tests/` contains the pytest suite. It creates a throwaway database from `TEST_DATABASE_URL` (default `postgresql://postgres:sql@localhost:5432/summarizer_test`), migrates it with Alembic, and drops it afterwards.

```bash
pip install -r requirements-dev.txt
pytest
```

## Runtime Artifact Policy

Generated files are ignored by git:

- `backend/uploads/`
- `backend/audio/`
- `backend/data/uploads/`
- `uploads/`
- `*.db`

These files stay local or belong in object storage, not source control.
