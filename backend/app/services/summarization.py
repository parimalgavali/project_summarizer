#!/usr/bin/env python3
"""
Provider-based summarization service.
"""

import re
import time
from typing import Any

import requests

from ..core.config import settings

try:
    import openai
except ImportError:  # OpenAI is optional when running local providers.
    openai = None

try:
    import tiktoken
except ImportError:  # Token counting falls back to a rough local estimate.
    tiktoken = None

# Sentence end (., ! or ? then whitespace and a capital/digit/quote, so
# abbreviations like "U.S. data" stay intact) or a line break.
_SENTENCE_BOUNDARY = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(])|\n+")
# "Section N:" headers added when chunked HuggingFace summaries are joined.
_SECTION_HEADER = re.compile(r"Section \d+:")

class SummarizationService:
    def __init__(self):
        self.provider = settings.AI_PROVIDER
        self.openai_api_key = settings.OPENAI_API_KEY
        self.openai_model = settings.OPENAI_MODEL
        self.hf_api_key = settings.HF_API_KEY
        self.hf_model = settings.HF_MODEL_ID
        self.ollama_base_url = settings.OLLAMA_BASE_URL.rstrip("/")
        self.ollama_model = settings.OLLAMA_MODEL
        self.ollama_max_input_chars = settings.OLLAMA_MAX_INPUT_CHARS

        self.encoding = None
        if tiktoken is not None:
            try:
                self.encoding = tiktoken.encoding_for_model(self.openai_model)
            except Exception:
                self.encoding = tiktoken.get_encoding("cl100k_base")

    def get_model_name(self) -> str:
        if self.provider == "ollama":
            return f"ollama:{settings.OLLAMA_MODEL}"
        if self.provider == "openai":
            return self.openai_model
        if self.provider == "huggingface":
            return self.hf_model
        return self.provider

    def count_tokens(self, text: str) -> int:
        if self.encoding is not None:
            return len(self.encoding.encode(text))
        return max(1, len(text.split()))

    def chunk_text_by_tokens(
        self, text: str, max_tokens: int = 100000, overlap_tokens: int = 1000
    ) -> list[str]:
        if self.encoding is None:
            return self._chunk_text_by_words(text, max_tokens, overlap_tokens)

        tokens = self.encoding.encode(text)
        chunks = []

        i = 0
        while i < len(tokens):
            chunk_end = min(i + max_tokens, len(tokens))
            chunks.append(self.encoding.decode(tokens[i:chunk_end]))

            if chunk_end >= len(tokens):
                break

            i = max(0, chunk_end - overlap_tokens)

        return chunks

    def _chunk_text_by_words(
        self, text: str, chunk_size: int = 2000, overlap: int = 200
    ) -> list[str]:
        words = text.split()
        chunks = []

        i = 0
        while i < len(words):
            chunk_end = min(i + chunk_size, len(words))
            chunks.append(" ".join(words[i:chunk_end]))

            if chunk_end >= len(words):
                break

            i = max(0, chunk_end - overlap)

        return chunks

    def summarize_with_chunking_openai(
        self, text: str, format_type: str = "short_text"
    ) -> tuple[str, int]:
        total_tokens_used = 0
        total_tokens = self.count_tokens(text)

        if total_tokens <= 100000:
            summary, tokens = self._summarize_single_chunk_openai(text, format_type)
            return summary, tokens

        chunks = self.chunk_text_by_tokens(text, max_tokens=100000, overlap_tokens=1000)
        chunk_summaries = []
        for j, chunk in enumerate(chunks):
            chunk_summary, tokens = self._summarize_single_chunk_openai(
                chunk, "short_text"
            )
            total_tokens_used += tokens
            chunk_summaries.append(f"Section {j + 1}:\n{chunk_summary}")

        combined_text = "\n\n".join(chunk_summaries)
        if self.count_tokens(combined_text) <= 100000:
            final_summary, tokens = self._summarize_single_chunk_openai(
                combined_text, format_type
            )
            total_tokens_used += tokens
        else:
            final_summary = combined_text

        return final_summary, total_tokens_used

    def summarize_with_chunking_hf(
        self, text: str, chunk_size: int = 1500, overlap: int = 150
    ) -> str:
        chunks = self._chunk_text_by_words(text, chunk_size, overlap)
        chunk_summaries = []
        for j, chunk in enumerate(chunks):
            chunk_summary = self._summarize_single_chunk_hf(chunk, max_length=250)
            chunk_summaries.append(f"Section {j + 1}:\n{chunk_summary}")

        return "\n\n".join(chunk_summaries)

    def _summarize_single_chunk_openai(
        self, text: str, format_type: str = "short_text"
    ) -> tuple[str, int]:
        if openai is None:
            raise RuntimeError("openai package is not installed")

        prompt = self._get_prompt(format_type) + "\n\n" + text
        client = openai.OpenAI(api_key=self.openai_api_key)
        response = client.chat.completions.create(
            model=self.openai_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000,
            temperature=0.1,
        )

        summary = response.choices[0].message.content.strip()
        tokens_used = response.usage.total_tokens

        if not summary or len(summary.strip()) < 10:
            raise ValueError(f"Invalid summary received: {summary}")

        return summary, tokens_used

    def _summarize_single_chunk_hf(self, text: str, max_length: int = 200) -> str:
        url = f"https://router.huggingface.co/hf-inference/models/{self.hf_model}"
        headers = {"Authorization": f"Bearer {self.hf_api_key}"}

        max_input_length = 2048
        if len(text) > max_input_length:
            text = text[:max_input_length] + "..."

        payload = {
            "inputs": text,
            "parameters": {
                "max_length": max_length,
                "min_length": 50,
                "do_sample": False,
            },
        }

        try:
            response = requests.post(url, headers=headers, json=payload, timeout=180)
            response.raise_for_status()
            result: Any = response.json()

            if isinstance(result, list) and len(result) > 0:
                summary = result[0].get("summary_text", "")
            elif isinstance(result, dict):
                summary = result.get("summary_text", result.get("summary", ""))
            else:
                summary = str(result)

            if not summary or len(summary.strip()) < 10:
                raise ValueError(f"Invalid summary received: {summary}")

            return summary
        except requests.exceptions.RequestException as e:
            raise Exception(f"HuggingFace API request failed: {str(e)}")

    def _summarize_single_chunk_ollama(
        self, text: str, format_type: str = "short_text"
    ) -> tuple[str, int]:
        prompt = self._get_prompt(format_type)
        payload = {
            "model": settings.OLLAMA_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a careful document summarization assistant. "
                        "Return only the requested summary. Do not invent details."
                    ),
                },
                {"role": "user", "content": f"{prompt}\n\n{text}"},
            ],
            "stream": False,
            "keep_alive": settings.OLLAMA_KEEP_ALIVE,
            "options": {
                "temperature": 0.1,
                "num_ctx": settings.OLLAMA_NUM_CTX,
            },
        }

        response = requests.post(
            f"{self.ollama_base_url}/api/chat", json=payload, timeout=240
        )
        response.raise_for_status()
        result = response.json()
        summary = result.get("message", {}).get("content", "").strip()

        if not summary or len(summary) < 10:
            raise ValueError(f"Invalid Ollama summary received: {summary}")

        tokens_used = result.get("eval_count", 0) + result.get("prompt_eval_count", 0)
        if not tokens_used:
            tokens_used = self.count_tokens(text) + self.count_tokens(summary)

        return summary, tokens_used

    def summarize_with_ollama(
        self, text: str, format_type: str = "short_text"
    ) -> tuple[str, float, int]:
        start_time = time.time()

        if len(text) <= self.ollama_max_input_chars:
            summary, tokens_used = self._summarize_single_chunk_ollama(
                text, format_type
            )
            return summary, time.time() - start_time, tokens_used

        chunks = self._chunk_text_by_words(text, chunk_size=1800, overlap=150)
        chunk_summaries = []
        tokens_used = 0
        for j, chunk in enumerate(chunks):
            chunk_summary, chunk_tokens = self._summarize_single_chunk_ollama(
                chunk, "short_text"
            )
            tokens_used += chunk_tokens
            chunk_summaries.append(f"Section {j + 1}:\n{chunk_summary}")

        combined = "\n\n".join(chunk_summaries)
        final_summary, final_tokens = self._summarize_single_chunk_ollama(
            combined, format_type
        )
        tokens_used += final_tokens

        return final_summary, time.time() - start_time, tokens_used

    def summarize_with_openai(
        self, text: str, format_type: str = "short_text"
    ) -> tuple[str, float, int]:
        start_time = time.time()
        summary, tokens_used = self.summarize_with_chunking_openai(text, format_type)
        return summary, time.time() - start_time, tokens_used

    def summarize_with_huggingface(
        self, text: str, format_type: str = "short_text"
    ) -> tuple[str, float, int]:
        start_time = time.time()
        word_count = len(text.split())

        if word_count > 1000:
            raw_summary = self.summarize_with_chunking_hf(
                text, chunk_size=2000, overlap=200
            )
        else:
            raw_summary = self._summarize_single_chunk_hf(text, max_length=300)

        summary = self._apply_format(raw_summary, format_type)
        tokens_used = word_count + len(summary.split())

        return summary, time.time() - start_time, tokens_used

    def _apply_format(self, summary: str, format_type: str) -> str:
        # Only used for HuggingFace, whose summarization models ignore prompts:
        # the format is approximated by post-processing plain prose. Ollama and
        # OpenAI get the format through the prompt (see _get_prompt) instead.
        if format_type == "bullet_points":
            bullet_points = []
            for sentence in _SENTENCE_BOUNDARY.split(summary.strip()):
                sentence = sentence.strip().lstrip("-*• ").strip()
                if len(sentence) <= 10 or _SECTION_HEADER.fullmatch(sentence):
                    continue
                for prefix in ("The ", "This "):
                    if sentence.startswith(prefix):
                        sentence = sentence[len(prefix) :]
                        break
                bullet_points.append(f"- {sentence[:1].upper()}{sentence[1:]}")
            return "\n".join(bullet_points) if bullet_points else summary

        if format_type == "academic_tone":
            return (
                "This document presents a structured overview of the following "
                f"key aspects:\n\n{summary}\n\nIn summary, these points represent "
                "the primary academic contribution and context of the document."
            )

        return summary

    def _get_prompt(self, format_type: str) -> str:
        base_prompt = (
            "Summarize the following document clearly and accurately. Preserve key "
            "claims, methods, findings, and limitations when present."
        )

        if format_type == "bullet_points":
            return base_prompt + " Format the output as concise bullet points."
        if format_type == "academic_tone":
            return base_prompt + " Use a formal academic tone."
        return base_prompt + " Format the output as a concise paragraph."

    def summarize_text(
        self, text: str, format_type: str = "short_text"
    ) -> tuple[str, float, int]:
        if settings.ENV == "TEST":
            return self._summarize_for_testing(text, format_type)

        if self.provider == "ollama":
            return self.summarize_with_ollama(text, format_type)
        if self.provider == "openai":
            if not self.openai_api_key:
                raise ValueError("OPENAI_API_KEY is required when AI_PROVIDER=openai.")
            return self.summarize_with_openai(text, format_type)
        if self.provider == "huggingface":
            if not self.hf_api_key:
                raise ValueError("HF_API_KEY is required when AI_PROVIDER=huggingface.")
            return self.summarize_with_huggingface(text, format_type)

        raise ValueError(f"Unsupported AI_PROVIDER: {self.provider}")

    def _summarize_for_testing(
        self, text: str, format_type: str = "short_text"
    ) -> tuple[str, float, int]:
        if format_type == "bullet_points":
            summary = (
                "- This is a test summary in bullet point format.\n"
                "- It contains key information from the document.\n"
                "- Used for testing purposes only."
            )
        elif format_type == "academic_tone":
            summary = (
                "This document presents a comprehensive overview of the key "
                "concepts discussed. The analysis reveals several important "
                "findings that warrant further investigation."
            )
        else:
            summary = (
                "This is a test summary of the document content. It provides a "
                "concise overview of the main points and key information extracted "
                "from the text."
            )

        return summary, 0.5, 150
