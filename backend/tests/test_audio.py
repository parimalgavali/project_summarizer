import os


def _generate_audio(client, document_id: str) -> dict:
    response = client.post(
        f"/documents/{document_id}/generate-audio",
        json={"format_type": "bullet_points"},
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_download_audio_returns_file(client, upload):
    audio = _generate_audio(client, upload())

    response = client.get(f"/audios/{audio['audio_id']}/download")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("audio/")
    assert f"summary_audio_{audio['audio_id']}" in response.headers[
        "content-disposition"
    ]
    assert response.content  # TEST-mode AudioService writes a stub header


def test_download_audio_missing_file_returns_404(client, upload):
    from app.core.config import SessionLocal
    from app.models.database import Audio

    audio_id = _generate_audio(client, upload())["audio_id"]
    with SessionLocal() as db:
        os.remove(db.get(Audio, audio_id).audio_file_path)

    response = client.get(f"/audios/{audio_id}/download")

    assert response.status_code == 404
    assert response.json() == {"detail": "Audio file not found"}


def test_download_unknown_audio_returns_404(client):
    assert client.get("/audios/does-not-exist/download").status_code == 404


def test_delete_document_removes_audio(client, upload):
    document_id = upload()
    _generate_audio(client, document_id)

    assert client.delete(f"/documents/{document_id}").status_code == 200
    assert client.get("/audio-list").json()["total"] == 0
    assert client.get("/summary-list").json()["total"] == 0
