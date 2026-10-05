# AI-Powered Thesis and Document Summarizer

A comprehensive full-stack application designed to extract text from documents, generate AI-powered summaries in various formats, manage an approval workflow, prioritize revisions, and generate text-to-speech audio.

## Architecture & Tech Stack
- **Backend**: FastAPI (Python), SQLAlchemy, and PostgreSQL. Handles document parsing (.pdf, .docx, .txt), summarization logic, audio generation (OpenAI TTS API), and API provisioning.
- **Frontend**: React 19, TypeScript, and Vite. Provides an interactive dashboard with modular components (e.g. `AudioList`, `DocumentList`, `SummaryList`) and modal-driven UI for handling the document flows.
- **Database**: PostgreSQL (Dockerized). Tracks document files, summaries with varying statuses (pending, approved, rejected), and audio references.
- **Testing**: Playwright for end-to-end (E2E) testing (`tests-e2e`), Pytest for backend tests (`backend/tests`).

## Project links
* [Task board](https://summarizer-ut.atlassian.net/jira/software/projects/KAN/boards/1)
* [Wiki](https://summarizer-ut-wiki.atlassian.net/wiki/spaces/SW/overview)

## [Release v4.0.0 (Current)](https://bitbucket.org/ai-powered-thesis-and-document-summarizer/summarizer/src/v4.0.0/)
* Implement features:
	* Summary comparison view [#39](https://summarizer-ut.atlassian.net/browse/KAN-39)
	* Access relevant summaries by clicking on the original document [#30](https://summarizer-ut.atlassian.net/browse/KAN-30)
	* Various UI refinements [#58](https://summarizer-ut.atlassian.net/browse/KAN-58)

## [Release v3.0.0](https://bitbucket.org/ai-powered-thesis-and-document-summarizer/summarizer/src/v3.0.0/)
* Implement features:
	* Add audio generation and playback functionality using OpenAI TTS API [#35](https://summarizer-ut.atlassian.net/browse/KAN-35)
	* Implement audio management UI with player and controls [#34](https://summarizer-ut.atlassian.net/browse/KAN-34)
	* Implement audio summary download option [#45](https://summarizer-ut.atlassian.net/browse/KAN-45)

## [Release v2.1.0](https://bitbucket.org/ai-powered-thesis-and-document-summarizer/summarizer/src/v2.1.0/)
* Implement features:
	* Implemented comprehensive summary approval workflow with status-based action buttons (Approve, Reject, Regenerate, Download, Edit, Delete) [#25](https://summarizer-ut.atlassian.net/browse/KAN-25) [#26](https://summarizer-ut.atlassian.net/browse/KAN-26) [#27](https://summarizer-ut.atlassian.net/browse/KAN-27)
	* Added multi-format summary generation with three format options: short_text, bullet_points, and academic_tone [#23](https://summarizer-ut.atlassian.net/browse/KAN-23) [#40](https://summarizer-ut.atlassian.net/browse/KAN-40)
	* Enhanced UI/UX with improved table styling (alternating row colors, color-coded status indicators), delete functionality for documents, and format selection during upload [#29](https://summarizer-ut.atlassian.net/browse/KAN-29)
	* Updated database schema to track approval status with three states: pending, approved, rejected [#31](https://summarizer-ut.atlassian.net/browse/KAN-31)
	* Replaced full page reloads with callback-based data refresh mechanism for better user experience

## [Release v2.0.0](https://bitbucket.org/ai-powered-thesis-and-document-summarizer/summarizer/src/v2.0.0/)
* Implement core features for Iteration 2:
	* Documents, Summaries, Audio sections available in dashboard [#29](https://summarizer-ut.atlassian.net/browse/KAN-29)
	* Document upload functionality [#16](https://summarizer-ut.atlassian.net/browse/KAN-16) [#17](https://summarizer-ut.atlassian.net/browse/KAN-17) [#32](https://summarizer-ut.atlassian.net/browse/KAN-32)
	* Document auto-extraction [#18](https://summarizer-ut.atlassian.net/browse/KAN-18)
	* Document table view with a search bar and sorting options [#20](https://summarizer-ut.atlassian.net/browse/KAN-20)
	* Summarization engine [#22](https://summarizer-ut.atlassian.net/browse/KAN-22)
	* Summary editing capability [#26](https://summarizer-ut.atlassian.net/browse/KAN-26)

## Installation

### Backend
1. ```cd backend```
2. ```python -m venv .venv```
3. ```source .venv/Scripts/activate```
4. ```pip install -r requirements.txt``` on first-time use
5. Install Docker desktop and have it running, then run the following command. NB! replace user and password with your own postgres credentials.  
```docker run -d --name postgres16 -e POSTGRES_DB=summarizer -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password -p 5432:5432 postgres:16```
6. ```uvicorn app.main:app --reload```
pip install pydantic-settings, if any errors
→ runs at http://localhost:8000 / http://127.0.0.1:8000
Swagger UI is available at http://localhost:8000/docs

### Frontend
1. ```cd frontend```
2. ```npm install``` on first-time use
3. ```npm run dev```
→ runs at http://localhost:5173 / http://127.0.0.1:5173


