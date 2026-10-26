import pytest

RIVERS = (
    "Rivers carry sediment downstream and shape valleys over thousands of years. "
    "Floodplains form where river water spreads across flat land. " * 5
)
COMPILERS = (
    "Compilers translate source code into machine instructions. "
    "Parsers build syntax trees before code generation and optimisation. " * 5
)


def _upload(client, name: str, text: str) -> str:
    response = client.post(
        "/documents/upload", files={"file": (name, text.encode(), "text/plain")}
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "text_ready"
    return response.json()["id"]


def _chunks(document_id: str):
    from app.core.config import SessionLocal
    from app.models.database import DocumentChunk

    with SessionLocal() as db:
        return (
            db.query(DocumentChunk)
            .filter(DocumentChunk.document_id == document_id)
            .order_by(DocumentChunk.chunk_index)
            .all()
        )


def test_upload_stores_chunk_embeddings(client):
    document_id = _upload(client, "rivers.txt", RIVERS)

    chunks = _chunks(document_id)
    assert chunks
    assert all(chunk.embedding and chunk.text for chunk in chunks)
    assert chunks[0].embedding_model == "test:hashed-bag-of-words"


def test_long_documents_are_split_into_multiple_chunks(client):
    from app.services import search

    long_text = RIVERS * 20
    document_id = _upload(client, "long.txt", long_text)

    chunks = _chunks(document_id)
    assert len(chunks) > 1
    assert [c.chunk_index for c in chunks] == list(range(len(chunks)))
    assert search.CHUNK_TOKENS < len(long_text.split())


def test_search_ranks_most_relevant_document_first(client):
    rivers_id = _upload(client, "rivers.txt", RIVERS)
    compilers_id = _upload(client, "compilers.txt", COMPILERS)
    summary = client.post(
        f"/documents/{compilers_id}/summarize", json={"summary_type": "short_text"}
    ).json()

    response = client.get("/search", params={"q": "parsers and source code"})

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["query"] == "parsers and source code"
    results = body["data"]
    assert results[0]["document_id"] == compilers_id
    assert results[0]["document_filename"] == "compilers.txt"
    assert results[0]["summary_count"] == 1
    assert results[0]["latest_summary_id"] == summary["id"]
    assert "Compilers" in results[0]["snippet"]
    scores = {r["document_id"]: r["score"] for r in results}
    assert scores[compilers_id] > scores.get(rivers_id, 0)


def test_search_respects_limit_and_scores_are_sorted(client):
    for i in range(3):
        _upload(client, f"rivers-{i}.txt", RIVERS + f" Extra river note {i}.")

    results = client.get("/search", params={"q": "river valleys", "limit": 2}).json()[
        "data"
    ]

    assert len(results) == 2
    assert results[0]["score"] >= results[1]["score"] > 0


def test_search_without_indexed_documents_returns_empty_list(client):
    response = client.get("/search", params={"q": "rivers"})

    assert response.status_code == 200
    assert response.json()["data"] == []


@pytest.mark.parametrize(
    "params", [{}, {"q": ""}, {"q": "   "}, {"q": "x", "limit": 0}, {"q": "x", "limit": 51}]
)
def test_search_validates_query_params(client, params):
    assert client.get("/search", params=params).status_code == 422


def test_deleting_document_removes_its_chunks_from_search(client):
    document_id = _upload(client, "compilers.txt", COMPILERS)
    assert client.get("/search", params={"q": "compilers"}).json()["data"]

    assert client.delete(f"/documents/{document_id}").status_code == 200

    assert _chunks(document_id) == []
    assert client.get("/search", params={"q": "compilers"}).json()["data"] == []


def test_upload_succeeds_when_embedding_fails(client):
    from app.dependencies import get_embedding_service
    from app.main import app

    class BrokenEmbedder:
        model_name = "broken"

        def embed_text(self, text):
            raise ConnectionError("ollama down")

    app.dependency_overrides[get_embedding_service] = BrokenEmbedder

    document_id = _upload(client, "rivers.txt", RIVERS)

    assert _chunks(document_id) == []
    assert client.get("/documents").json()["total"] == 1


def test_search_returns_503_when_embedding_service_is_down(client):
    from app.dependencies import get_embedding_service
    from app.main import app

    class BrokenEmbedder:
        model_name = "broken"

        def embed_text(self, text):
            raise ConnectionError("ollama down")

    app.dependency_overrides[get_embedding_service] = BrokenEmbedder

    response = client.get("/search", params={"q": "rivers"})

    assert response.status_code == 503
    assert response.json() == {"detail": "Embedding service unavailable"}


def test_search_ignores_vectors_from_other_embedding_models(client):
    from app.core.config import SessionLocal
    from app.models.database import DocumentChunk

    document_id = _upload(client, "rivers.txt", RIVERS)
    with SessionLocal() as db:
        db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id
        ).update({"embedding_model": "ollama:some-other-model"})
        db.commit()

    assert client.get("/search", params={"q": "rivers"}).json()["data"] == []


def test_cosine_similarity_handles_mismatched_and_zero_vectors():
    from app.services.search import cosine_similarity

    assert cosine_similarity([1.0, 0.0], [1.0, 0.0]) == pytest.approx(1.0)
    assert cosine_similarity([1.0, 0.0], [0.0, 1.0]) == 0.0
    assert cosine_similarity([1.0, 0.0], [1.0, 0.0, 0.0]) == 0.0
    assert cosine_similarity([0.0, 0.0], [1.0, 0.0]) == 0.0


def test_models_endpoint_reports_ai_tts_and_embedding_providers(client):
    body = client.get("/v1/models").json()

    assert body["data"][0]["provider"] == "ollama"
    assert body["data"][0]["id"] == "llama3.2"
    assert body["tts"] == {"provider": "macos_say", "model": "macos-say:Samantha"}
    assert body["embedding"] == {"model": "test:hashed-bag-of-words"}
