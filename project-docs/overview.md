# AI Document Intelligence Platform Overview

## Goal

This project is evolving from a simple document summarizer into a local-first AI document intelligence platform. The core user flow is:

1. Upload a PDF, DOCX, or TXT document.
2. Extract text and store document metadata.
3. Generate summaries in multiple styles.
4. Review, edit, approve, reject, or regenerate summaries.
5. Generate audio from approved or generated summaries.
6. Use local AI providers where possible so the project can run without paid API keys.

## Resume-Worthy Direction

The project now emphasizes:

- Local LLM summarization with Ollama and Llama 3.2.
- Local embeddings with EmbeddingGemma for future semantic search and RAG.
- Local audio export with macOS `say`.
- Provider-based backend design so OpenAI and Hugging Face remain optional.
- A polished workbench-style frontend instead of a basic upload demo.
- Production-aware cleanup: generated uploads, audio, and local databases are no longer tracked in git.

## Current AI Providers

| Capability | Default Provider | Optional Providers |
| --- | --- | --- |
| Summarization | Ollama `llama3.2` | OpenAI, Hugging Face |
| Embeddings | Ollama `embeddinggemma` | Future vector DB integrations |
| Text to speech | macOS `say` | OpenAI TTS |

## Current Major Features

- Document upload and text extraction.
- Summary generation, preview, editing, approval, rejection, and regeneration.
- Multi-format summaries: short text, bullet points, academic tone.
- Audio generation, listing, playback, download, and deletion.
- Document-specific summary modal.
- Runtime artifact cleanup for GitHub readiness.

## Recommended Next Enhancements

- Persist document chunks and embeddings in the database.
- Add semantic search and "Ask your document library" endpoints.
- Add background job status for summarization/audio generation.
- Replace startup schema edits with migrations.
- Add backend tests with a managed test environment.
