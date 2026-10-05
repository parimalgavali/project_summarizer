# AI-Powered Thesis and Document Summarizer - Frontend

This is the frontend application for the Document Summarizer project, built with React, TypeScript, and Vite.

## Tech Stack
- **Framework**: React 19
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Standard CSS (`index.css` and `App.css`)
- **HTTP Client**: Axios for communicating with the FastAPI backend

## Features
- **Document Management**: Upload and list documents (PDF, DOCX, TXT) via an `UploadPanel` and `DocumentList`.
- **Summarization**: Request summaries in different formats (short text, bullet points, academic tone). Modals handle generation and summary listing (`GenerateSummaryModal`, `DocumentSummariesModal`). 
- **Summary Approval Workflow**: Review generated summaries, edit them in-place, approve, reject, or regenerate them (`SummaryList`, `SummaryModal`).
- **Audio Generation**: Generate text-to-speech audio from summaries and play/download them using a built-in player module (`AudioList`, `AudioPlayerModal`).

## Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Run the development server
npm run dev
```

The frontend will run at `http://localhost:5173`. Make sure the FastAPI backend is running on `http://localhost:8000` to ensure API calls succeed.
