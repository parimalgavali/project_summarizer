import pytest
from pydantic import ValidationError


@pytest.fixture()
def summary_id(client, upload):
    document_id = upload()
    response = client.post(
        f"/documents/{document_id}/summarize", json={"summary_type": "short_text"}
    )
    assert response.status_code == 200, response.text
    client.post(
        f"/summaries/{response.json()['id']}/approval", json={"status": "approved"}
    ).raise_for_status()
    return response.json()["id"]


def test_regenerate_request_model_validates_format_type():
    from app.models import RegenerateRequest

    assert RegenerateRequest().format_type is None
    assert RegenerateRequest(format_type="bullet_points").format_type == "bullet_points"
    with pytest.raises(ValidationError):
        RegenerateRequest(format_type="haiku")


def test_regenerate_with_new_format_updates_type_and_resets_approval(
    client, summary_id
):
    response = client.post(
        f"/summaries/{summary_id}/regenerate", json={"format_type": "bullet_points"}
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["summary_type"] == "bullet_points"
    assert body["summary_text"].startswith("- ")
    assert body["approval_status"] == "pending"
    assert body["message"] == "Summary regenerated successfully"


@pytest.mark.parametrize("kwargs", [{"json": {}}, {}])
def test_regenerate_without_format_keeps_existing_type(client, summary_id, kwargs):
    response = client.post(f"/summaries/{summary_id}/regenerate", **kwargs)

    assert response.status_code == 200, response.text
    assert response.json()["summary_type"] == "short_text"


def test_regenerate_rejects_unknown_format_type(client, summary_id):
    response = client.post(
        f"/summaries/{summary_id}/regenerate", json={"format_type": "haiku"}
    )

    assert response.status_code == 422


def test_regenerate_missing_summary_returns_404(client):
    response = client.post("/summaries/missing/regenerate", json={})

    assert response.status_code == 404


def test_summarize_response_created_at_is_timezone_aware(client, upload):
    from datetime import datetime

    document_id = upload()
    response = client.post(f"/documents/{document_id}/summarize", json={})

    assert datetime.fromisoformat(response.json()["created_at"]).tzinfo is not None


def test_huggingface_bullet_format_splits_on_sentence_boundaries():
    from app.services.summarization import SummarizationService

    raw = (
        "Section 1:\nThe study measured river flow in 2020! Did the U.S. data "
        "agree with NASA models?  This report says yes.\n\nSection 2:\n"
        "Results were consistent across all sites."
    )

    formatted = SummarizationService()._apply_format(raw, "bullet_points")

    assert formatted.splitlines() == [
        "- Study measured river flow in 2020!",
        "- Did the U.S. data agree with NASA models?",
        "- Report says yes.",
        "- Results were consistent across all sites.",
    ]


def test_bullet_format_falls_back_to_original_text_when_nothing_to_split():
    from app.services.summarization import SummarizationService

    assert SummarizationService()._apply_format("Too short", "bullet_points") == (
        "Too short"
    )
