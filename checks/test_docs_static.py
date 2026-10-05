import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class DocumentationStaticChecks(unittest.TestCase):
    def test_project_docs_folder_contains_required_docs(self):
        docs_dir = ROOT / "project-docs"

        for filename in [
            "README.md",
            "overview.md",
            "frontend.md",
            "backend.md",
            "api-reference.md",
            "local-ai-setup.md",
        ]:
            self.assertTrue((docs_dir / filename).exists(), filename)

    def test_api_reference_mentions_exposed_routes(self):
        api_reference = (ROOT / "project-docs/api-reference.md").read_text(
            encoding="utf-8"
        )

        for route in [
            "GET /v1/models",
            "POST /documents/upload",
            "GET /documents",
            "DELETE /documents/{document_id}",
            "POST /documents/{document_id}/summarize",
            "GET /summary-list",
            "POST /summaries/{summary_id}/approval",
            "GET /audio-list",
            "GET /audios?summary_id={summary_id}",
            "POST /summaries/{summary_id}/generate-audio",
            "GET /audios/{audio_id}/download",
            "POST /api/testing/reset-db",
        ]:
            self.assertIn(route, api_reference)

    def test_frontend_and_backend_docs_cover_local_ai(self):
        frontend = (ROOT / "project-docs/frontend.md").read_text(encoding="utf-8")
        backend = (ROOT / "project-docs/backend.md").read_text(encoding="utf-8")
        local_ai = (ROOT / "project-docs/local-ai-setup.md").read_text(
            encoding="utf-8"
        )

        self.assertIn("workbench", frontend.lower())
        self.assertIn("SummarizationService", backend)
        self.assertIn("AudioService", backend)
        self.assertIn("ollama pull llama3.2", local_ai)
        self.assertIn("ollama pull embeddinggemma", local_ai)


if __name__ == "__main__":
    unittest.main()
