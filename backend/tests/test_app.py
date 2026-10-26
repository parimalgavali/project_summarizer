import threading

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError


def test_unhandled_errors_return_500_error_payload(client):
    from app.main import app

    @app.get("/v1/_boom")
    async def boom():
        raise RuntimeError("kaboom")

    try:
        with TestClient(app, raise_server_exceptions=False) as raw_client:
            response = raw_client.get("/v1/_boom")
    finally:
        app.router.routes = [
            r for r in app.router.routes if getattr(r, "path", "") != "/v1/_boom"
        ]

    assert response.status_code == 500
    assert response.json() == {"detail": "Internal server error"}
    assert "kaboom" not in response.text


def test_services_are_cached_singletons():
    from app.dependencies import get_audio_service, get_summarization_service

    assert get_summarization_service() is get_summarization_service()
    assert get_audio_service() is get_audio_service()


def test_summarization_runs_off_the_event_loop(client, upload):
    from app.dependencies import get_summarization_service
    from app.main import app

    calls = []

    class RecordingSummarizer:
        def summarize_text(self, text, format_type="short_text"):
            calls.append(threading.current_thread().name)
            return "A recorded summary for the test.", 0.1, 10

        def get_model_name(self):
            return "recording"

    document_id = upload()
    app.dependency_overrides[get_summarization_service] = RecordingSummarizer

    response = client.post(
        f"/documents/{document_id}/summarize", json={"summary_type": "short_text"}
    )

    assert response.status_code == 200, response.text
    assert response.json()["llm_model"] == "recording"
    assert calls and "AnyIO worker thread" in calls[0]


def test_cors_allows_only_used_methods(client):
    headers = {"Origin": "http://localhost:5173"}

    allowed = client.options(
        "/documents/x",
        headers={**headers, "Access-Control-Request-Method": "DELETE"},
    )
    rejected = client.options(
        "/documents/x",
        headers={**headers, "Access-Control-Request-Method": "PUT"},
    )

    assert allowed.status_code == 200
    assert rejected.status_code == 400


def test_database_url_is_required(monkeypatch):
    from app.core.config import Settings

    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_debug_defaults_to_false(monkeypatch):
    from app.core.config import Settings

    monkeypatch.delenv("DEBUG", raising=False)
    assert Settings(_env_file=None, DATABASE_URL="postgresql://x/y").DEBUG is False
