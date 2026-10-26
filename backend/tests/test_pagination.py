import pytest


@pytest.fixture()
def three_audios(client, upload):
    for i in range(3):
        document_id = upload(f"doc{i}.txt")
        response = client.post(f"/documents/{document_id}/generate-audio", json={})
        assert response.status_code == 200, response.text


@pytest.mark.parametrize("path", ["/documents", "/summary-list", "/audio-list"])
def test_list_endpoints_paginate(client, three_audios, path):
    first = client.get(path, params={"limit": 2}).json()
    second = client.get(path, params={"limit": 2, "offset": 2}).json()

    assert first["total"] == 3 and second["total"] == 3
    assert (first["limit"], first["offset"]) == (2, 0)
    assert len(first["data"]) == 2
    assert len(second["data"]) == 1
    ids = {item["id"] for item in first["data"] + second["data"]}
    assert len(ids) == 3


@pytest.mark.parametrize("path", ["/documents", "/summary-list", "/audio-list"])
def test_list_endpoints_default_page(client, three_audios, path):
    body = client.get(path).json()

    assert len(body["data"]) == 3
    assert (body["limit"], body["offset"]) == (100, 0)


@pytest.mark.parametrize(
    "params", [{"limit": 0}, {"limit": 501}, {"offset": -1}, {"limit": "x"}]
)
def test_invalid_pagination_params_rejected(client, params):
    assert client.get("/documents", params=params).status_code == 422
