#!/usr/bin/env python3
"""
Local embedding service for semantic document search.
"""

import requests

from ..core.config import settings


class EmbeddingService:
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL.rstrip("/")
        self.model = settings.OLLAMA_EMBED_MODEL

    def embed_text(self, text: str) -> list[float]:
        response = requests.post(
            f"{self.base_url}/api/embed",
            json={"model": settings.OLLAMA_EMBED_MODEL, "input": text},
            timeout=120,
        )
        response.raise_for_status()
        data = response.json()

        if "embeddings" in data and data["embeddings"]:
            return data["embeddings"][0]
        if "embedding" in data:
            return data["embedding"]

        raise ValueError("Ollama embedding response did not include embeddings.")
