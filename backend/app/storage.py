from pathlib import Path
from uuid import uuid4
from fastapi import UploadFile, HTTPException
from .core.config import settings

UPLOAD_ROOT = Path(settings.UPLOAD_DIR).resolve()
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)


def save_upload(filename: str, content: bytes):
    ext = Path(filename).suffix.lower()
    allowed = set(settings.ALLOWED_EXTENSIONS)
    if ext not in allowed:
        raise ValueError(f"Unsupported file type: {ext}")

    uid = str(uuid4())
    dest = UPLOAD_ROOT / f"{uid}{ext}"
    dest.write_bytes(content)

    return uid, dest
