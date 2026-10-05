import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class LocalAIStaticChecks(unittest.TestCase):
    def test_config_declares_local_ai_options(self):
        config = (ROOT / "backend/app/core/config.py").read_text(encoding="utf-8")

        for expected in [
            'AI_PROVIDER: Literal["ollama", "openai", "huggingface"] = "ollama"',
            'OLLAMA_BASE_URL: str = "http://localhost:11434"',
            'OLLAMA_MODEL: str = "llama3.2"',
            'OLLAMA_EMBED_MODEL: str = "embeddinggemma"',
            'TTS_PROVIDER: Literal["macos_say", "openai"] = "macos_say"',
        ]:
            self.assertIn(expected, config)

    def test_summarization_service_supports_ollama(self):
        summarization = (
            ROOT / "backend/app/services/summarization.py"
        ).read_text(encoding="utf-8")

        for expected in [
            "summarize_with_ollama",
            "/api/chat",
            "settings.OLLAMA_MODEL",
            "settings.OLLAMA_KEEP_ALIVE",
            "self.provider == \"ollama\"",
            "def get_model_name",
        ]:
            self.assertIn(expected, summarization)

    def test_embedding_service_uses_ollama_embed_endpoint(self):
        embeddings_path = ROOT / "backend/app/services/embeddings.py"
        self.assertTrue(embeddings_path.exists())

        embeddings = embeddings_path.read_text(encoding="utf-8")
        for expected in [
            "class EmbeddingService",
            "/api/embed",
            "settings.OLLAMA_EMBED_MODEL",
            "embed_text",
        ]:
            self.assertIn(expected, embeddings)

    def test_audio_service_supports_macos_say(self):
        audio = (ROOT / "backend/app/services/audio.py").read_text(encoding="utf-8")

        for expected in [
            "generate_audio_with_macos_say",
            "subprocess.run",
            "settings.TTS_PROVIDER",
            "self.audio_format = \"aiff\"",
        ]:
            self.assertIn(expected, audio)


if __name__ == "__main__":
    unittest.main()
