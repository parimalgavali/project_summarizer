#!/usr/bin/env python3
"""
Provider-based audio generation service.
"""

import os
import subprocess
import time
import uuid
from pathlib import Path

from ..core.config import settings

try:
    import openai
except ImportError:  # OpenAI is optional for local-first audio.
    openai = None

try:
    from mutagen.mp3 import MP3
except ImportError:
    MP3 = None


class AudioService:
    def __init__(self):
        self.provider = settings.TTS_PROVIDER
        self.openai_api_key = settings.OPENAI_API_KEY
        self.tts_model = os.getenv("OPENAI_TTS_MODEL", "tts-1")
        self.voice = os.getenv("OPENAI_TTS_VOICE", "alloy")
        self.macos_voice = settings.MACOS_SAY_VOICE
        self.audio_format = "aiff" if self.provider == "macos_say" else "mp3"

        if self.provider == "macos_say":
            self.tts_model = f"macos-say:{self.macos_voice}"

    def generate_audio(self, text: str, output_path: str) -> tuple[float, int, float]:
        start_time = time.time()

        if settings.ENV == "TEST":
            with open(output_path, "wb") as f:
                f.write(b"FORM" if self.audio_format == "aiff" else b"\xff\xf3\x44\xc4")
            return 5.0, len(text), 0.1

        if self.provider == "macos_say":
            return self.generate_audio_with_macos_say(text, output_path, start_time)
        if self.provider == "openai":
            return self.generate_audio_with_openai(text, output_path, start_time)

        raise ValueError(f"Unsupported TTS_PROVIDER: {self.provider}")

    def generate_audio_with_macos_say(
        self, text: str, output_path: str, start_time: float
    ) -> tuple[float, int, float]:
        subprocess.run(
            ["say", "-v", self.macos_voice, "-o", output_path, text],
            check=True,
            capture_output=True,
            text=True,
        )

        duration = max(1.0, len(text) / 12.5)
        return duration, len(text), time.time() - start_time

    def generate_audio_with_openai(
        self, text: str, output_path: str, start_time: float
    ) -> tuple[float, int, float]:
        if openai is None:
            raise RuntimeError("openai package is not installed")

        client = openai.OpenAI(api_key=self.openai_api_key)
        response = client.audio.speech.create(
            model=self.tts_model,
            voice=self.voice,
            input=text,
            response_format="mp3",
        )

        with open(output_path, "wb") as f:
            f.write(response.content)

        duration = len(text) / 12.5
        if MP3 is not None:
            try:
                audio_file = MP3(output_path)
                duration = audio_file.info.length
            except Exception:
                pass

        return duration, len(text), time.time() - start_time

    def generate_audio_for_summary(
        self, summary_text: str, audio_dir: str
    ) -> tuple[str, float, int, float]:
        Path(audio_dir).mkdir(parents=True, exist_ok=True)

        audio_id = str(uuid.uuid4())
        output_path = os.path.join(audio_dir, f"{audio_id}.{self.audio_format}")

        duration, chars, processing_time = self.generate_audio(
            summary_text, output_path
        )

        return output_path, duration, chars, processing_time
