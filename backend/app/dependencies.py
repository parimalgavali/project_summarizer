from functools import lru_cache

from .services.audio import AudioService
from .services.summarization import SummarizationService
from .services.text_extraction import TextExtractionService


@lru_cache
def get_summarization_service() -> SummarizationService:
    return SummarizationService()


@lru_cache
def get_audio_service() -> AudioService:
    return AudioService()


@lru_cache
def get_text_extraction_service() -> TextExtractionService:
    return TextExtractionService()
