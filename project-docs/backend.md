# Backend Documentation

## Stack

- FastAPI
- SQLAlchemy
- PostgreSQL
- Pydantic Settings
- Ollama for local LLM summaries and embeddings
- macOS `say` for local text-to-speech

## Main Entry Points

- `backend/app/main.py` defines FastAPI routes.
- `backend/app/core/config.py` defines settings, database engine, and session creation.
- `backend/app/models/__init__.py` defines API request/response schemas.
- `backend/app/models/database.py` defines database tables.
- `backend/app/storage.py` saves uploaded files.

## Services

| Service | File | Purpose |
| --- | --- | --- |
| Text extraction | `backend/app/services/text_extraction.py` | Extracts text from PDF, DOCX, and TXT files. |
| Summarization | `backend/app/services/summarization.py` | Provider-based summarization. Defaults to Ollama, with optional OpenAI/Hugging Face. |
| Embeddings | `backend/app/services/embeddings.py` | Calls Ollama `/api/embed` using `embeddinggemma`. Ready for semantic search/RAG storage. |
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

## Data Flow

1. `POST /documents/upload` validates and saves the uploaded file.
2. `TextExtractionService` extracts text and word count.
3. A `Document` row stores metadata and extracted text.
4. Summary endpoints call `SummarizationService`.
5. Audio endpoints call `AudioService` and store generated file metadata in `Audio`.
6. Delete endpoints clean dependent audio files/rows before deleting summaries or documents.

## Database Tables

| Table | Purpose |
| --- | --- |
| `documents` | Uploaded document metadata, file path, extracted text, word count, extraction status. |
| `summaries` | Generated or edited summaries, model metadata, approval status, optional custom name. |
| `audios` | Generated audio file path, format, duration, TTS provider/model, processing metadata. |

## Runtime Artifact Policy

Generated files are ignored by git:

- `backend/uploads/`
- `backend/audio/`
- `backend/data/uploads/`
- `uploads/`
- `*.db`

These files stay local or belong in object storage, not source control.
