# API Reference

Base URL in local development is usually `http://localhost:8000`.

## Errors

Failures use a non-2xx status with a JSON body of the form `{"detail": ...}`. Unhandled exceptions return `500` with `{"detail": "Internal server error"}`; details are logged server-side.

## Pagination

`GET /documents`, `GET /summary-list`, and `GET /audio-list` accept `limit` (1-500, default 100) and `offset` (default 0) query parameters, return items newest first, and respond with:

```json
{ "data": [], "total": 0, "limit": 100, "offset": 0 }
```

## Model and Compatibility

### `GET /v1/models`

Returns a lightweight model list (kept for compatibility with model-list style clients) plus the configured TTS and embedding providers. The dashboard uses it for the "Summary engine" / "Audio engine" cards.

```json
{
  "data": [{ "id": "llama3.2", "provider": "ollama" }],
  "tts": { "provider": "macos_say", "model": "macos-say:Samantha" },
  "embedding": { "model": "ollama:embeddinggemma" }
}
```

## Search

### `GET /search?q={query}&limit={limit}`

Semantic search over uploaded documents. `q` is required (1-1000 chars, not blank); `limit` is 1-50 (default 10). Returns documents ranked by the cosine similarity of their best-matching chunk; `503` if the embedding service is unavailable.

```json
{
  "query": "river sediment",
  "data": [
    {
      "document_id": "…",
      "document_filename": "rivers.txt",
      "score": 0.82,
      "chunk_index": 0,
      "snippet": "Rivers carry sediment downstream…",
      "summary_count": 1,
      "latest_summary_id": "…"
    }
  ]
}
```

## Documents

### `POST /documents/upload`

Uploads one document and extracts text.

Form fields:

- `file`: PDF, DOCX, or TXT file.
- `format_type`: optional summary format hint. Accepted values: `short_text`, `bullet_points`, `academic_tone`.

Behavior:

- Rejects unsupported file types.
- Rejects files above backend `MAX_UPLOAD_SIZE`.
- Saves the file to local upload storage.
- Extracts text synchronously.
- Creates a `documents` row with extraction status.

### `GET /documents`

Returns uploaded documents (paginated) with status, file size, word count, and creation timestamp.

### `DELETE /documents/{document_id}`

Deletes a document, its summaries, dependent audio rows, related audio files, and the uploaded document file.

### `GET /documents/{document_id}/summaries`

Returns all summaries for a document.

### `POST /documents/{document_id}/preview-summary`

Generates a summary preview without saving it.

### `POST /documents/{document_id}/summarize`

Generates and saves a summary. `custom_text` can be provided to save edited text instead of generating.

### `POST /documents/{document_id}/generate-audio`

Generates a summary and audio directly from a document. The generated summary is auto-approved because it exists to support audio export.

## Summaries

### `GET /summary-list`

Returns summaries (paginated) joined with document filenames.

### `POST /summaries/{summary_id}/edit`

Updates a summary in place with human-edited text. Returns the updated summary (same fields as `GET /summary-list` items) plus `message`.

Body:

```json
{
  "edited_text": "Updated summary text"
}
```

### `POST /summaries/{summary_id}/approval`

Updates summary approval state and optional custom name.

Accepted statuses:

- `approved`
- `rejected`
- `final_approved`

### `POST /summaries/{summary_id}/regenerate`

Regenerates an existing summary with the same or a new format. Optional JSON body `{"format_type": "bullet_points"}` (`RegenerateRequest`; one of `general`, `short_text`, `bullet_points`, `academic_tone`); omit it to keep the current format. Unknown formats return `422`. Resets approval to `pending` and returns the updated summary plus `message`.

### `DELETE /summaries/{summary_id}`

Deletes one summary and its dependent audio rows/files.

## Audio

### `GET /audio-list`

Returns generated audio records (paginated) joined with summary and document metadata.

### `GET /audios?summary_id={summary_id}`

Returns audio records, optionally filtered by summary ID.

### `POST /summaries/{summary_id}/generate-audio`

Generates audio for an existing summary.

Default provider:

- `TTS_PROVIDER=macos_say`
- Output format: `aiff`

Optional provider:

- `TTS_PROVIDER=openai`
- Output format: `mp3`

### `GET /audios/{audio_id}/download`

Downloads an audio file with a media type inferred from its generated file path.

### `DELETE /audios/{audio_id}`

Deletes one audio row and its generated audio file.

## Testing

### `POST /api/testing/reset-db`

Resets database tables and clears container upload/audio directories. This endpoint is gated by `ENV=TEST`.
