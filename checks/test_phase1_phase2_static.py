import pathlib
import re
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


def backend_route_sources() -> str:
    paths = [ROOT / "backend/app/main.py", *sorted((ROOT / "backend/app/routers").glob("*.py"))]
    return "\n".join(path.read_text(encoding="utf-8") for path in paths)


class PhaseOneTwoStaticChecks(unittest.TestCase):
    def test_generated_runtime_artifacts_are_ignored(self):
        gitignore = (ROOT / ".gitignore").read_text(encoding="utf-8")

        for pattern in [
            "backend/uploads/",
            "backend/audio/",
            "backend/data/uploads/",
            "uploads/",
            "*.db",
            ".superpowers/",
        ]:
            self.assertIn(pattern, gitignore)

    def test_cors_uses_configured_origins(self):
        main = (ROOT / "backend/app/main.py").read_text(encoding="utf-8")

        self.assertIn("allow_origins=settings.CORS_ORIGINS", main)
        self.assertNotIn('allow_origins=["*"]', main)

    def test_backend_exposes_audio_filter_endpoint_used_by_frontend(self):
        main = backend_route_sources()
        api = (ROOT / "frontend/src/lib/api.ts").read_text(encoding="utf-8")

        self.assertRegex(main, r'@(app|router)\.get\("/audios"\)')
        self.assertIn("/audios?summary_id=", api)

    def test_delete_paths_handle_audio_before_summaries(self):
        main = backend_route_sources()

        self.assertIn("delete_audio_record", main)
        summary_delete = re.search(
            r"def delete_summary.*?return \{\"message\": f?\"Summary deleted successfully\"\}",
            main,
            re.S,
        )
        self.assertIsNotNone(summary_delete)
        self.assertIn("delete_audio_record", summary_delete.group(0))

        document_delete = re.search(
            r"def delete_document.*?return \{\s*\"message\": f?\"Document",
            main,
            re.S,
        )
        self.assertIsNotNone(document_delete)
        self.assertIn("delete_audio_record", document_delete.group(0))


if __name__ == "__main__":
    unittest.main()
