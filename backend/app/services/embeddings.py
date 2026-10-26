#!/usr/bin/env python3
"""
Local embedding service for semantic document search.
"""

import hashlib
import math
import re

import requests

from ..core.config import settings

TEST_EMBEDDING_DIMENSIONS = 256
_WORD = re.compile(r"[a-z0-9]+")


class EmbeddingService:
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL.rstrip("/")
        self.model = settings.OLLAMA_EMBED_MODEL

    @property
    def model_name(self) -> str:
        """Identifier stored with each vector; vectors from other models are ignored."""
        if settings.ENV == "TEST":
            return "test:hashed-bag-of-words"
        return f"ollama:{self.model}"

    def embed_text(self, text: str) -> list[float]:
        if settings.ENV == "TEST":
            return self._embed_for_testing(text)

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

    def _embed_for_testing(self, text: str) -> list[float]:
        """Deterministic hashed bag-of-words vector so search works without Ollama."""
        vector = [0.0] * TEST_EMBEDDING_DIMENSIONS
        for word in _WORD.findall(text.lower()):
            digest = hashlib.sha1(word.encode()).digest()
            vector[int.from_bytes(digest[:4], "big") % TEST_EMBEDDING_DIMENSIONS] += 1.0
        norm = math.sqrt(sum(v * v for v in vector)) or 1.0
        return [v / norm for v in vector]
