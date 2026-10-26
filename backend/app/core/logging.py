import logging

from .config import settings

LOG_FORMAT = "%(asctime)s %(levelname)s [%(name)s] %(message)s"


def configure_logging() -> None:
    level = logging.getLevelName(settings.LOG_LEVEL.upper())
    if not isinstance(level, int):
        level = logging.INFO
    logging.basicConfig(level=level, format=LOG_FORMAT)
    logging.getLogger("app").setLevel(level)
