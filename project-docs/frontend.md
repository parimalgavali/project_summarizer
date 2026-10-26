# Frontend Documentation

## Stack

- React 19
- TypeScript
- Vite
- Axios
- TanStack Query (`@tanstack/react-query`) for server state

## Main Entry Points

- `frontend/src/main.tsx` mounts the React app.
- `frontend/src/main.tsx` also provides the shared `QueryClient`.
- `frontend/src/App.tsx` defines the primary workbench shell, tab navigation, hero panel, metrics, and loading/error states for the workspace lists.
- `frontend/src/lib/queries.ts` defines the list queries (`documents`, `summaries`, `audios`), `useSearch` (semantic search), `useModels` (configured providers), and mutation hooks. Approve/edit/regenerate/delete update only the affected cache entries; uploads and audio generation invalidate just the affected list.
- `frontend/src/App.css` styles the simplified local-AI workbench.
- `frontend/src/lib/api.ts` centralizes API calls.

## Current UI Direction

The frontend follows the simpler workbench mockup:

- Left navigation rail for Documents, Summaries, and Audio Studio.
- Hero panel that explains local-first AI behavior.
- Metrics for documents, summaries, summary provider, and audio provider (providers loaded live from `GET /v1/models`).
- Semantic search bar (`SearchPanel`) below the metrics.
- Main workspace panel that switches between active workflows.

This keeps the app approachable while still showing production-oriented AI features.

## Components

| Component | Purpose |
| --- | --- |
| `UploadPanel` | Selects and uploads PDF, DOCX, or TXT documents. Performs client-side file type and 10 MB size validation. |
| `DocumentList` | Displays uploaded documents, search/sort controls, summary navigation, and delete actions. |
| `SummaryList` | Lists summaries, supports summary preview, download, editing, and deletion. |
| `GenerateSummaryModal` | Guides users through document selection, summary format selection, preview, comparison, editing, and approval. |
| `DocumentSummariesModal` | Shows all summaries for one document and checks related audio records with `GET /audios?summary_id=...`. |
| `AudioList` | Lists generated audio records, supports audio generation, playback, download, and deletion. |
| `AudioPlayerModal` | Loads audio blobs from the backend and plays them in the browser when the format is supported. |
| `CustomNameModal` | Captures a custom name for approved summaries. |
| `SearchPanel` | Semantic search bar; shows ranked documents with match score and snippet, and opens `DocumentSummariesModal` for a result. |
| `QueryStatus` | Shared loading spinner and error-with-retry banner for list queries. |

## API Configuration

`frontend/src/lib/api.ts` uses:

The default local API base is `http://localhost:8000`. Deployments can override it with `VITE_API_BASE`.

For local development, set:

```bash
VITE_API_BASE=http://localhost:8000
```

## Known Frontend Notes

- Several workflow components still use inline styles. The app shell is now polished, but a later pass should move repeated table/modal button styles into reusable components.
- Audio playback support depends on the browser and generated format. macOS `say` generates AIFF by default; downloads work, and browser playback may vary.
