import logging
import os
import shutil

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..core.config import get_db, settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Testing"])

RESET_TABLES = ["audios", "summaries", "documents"]


def ensure_testing_environment():
    """Dependency that blocks access unless settings.ENV is 'TEST'."""
    if settings.ENV != "TEST":
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Reset endpoint is disabled in this environment.",
        )


@router.post(
    "/testing/reset-db", dependencies=[Depends(ensure_testing_environment)]
)
def reset_database(db: Session = Depends(get_db)):
    """
    Resets the database and clears file directories for E2E testing.
    Access is strictly gated by the environment check dependency.
    """
    try:
        db.execute(
            text(f'TRUNCATE TABLE {", ".join(RESET_TABLES)} RESTART IDENTITY CASCADE;')
        )
        db.commit()

        for dir_path in [settings.UPLOAD_DIR, settings.AUDIO_DIR]:
            if not os.path.exists(dir_path):
                logger.warning("Test reset directory not found: %s", dir_path)
                continue

            for filename in os.listdir(dir_path):
                if filename == ".gitkeep":
                    continue
                file_path = os.path.join(dir_path, filename)
                try:
                    if os.path.isfile(file_path) or os.path.islink(file_path):
                        os.unlink(file_path)
                    elif os.path.isdir(file_path):
                        shutil.rmtree(file_path)
                except Exception:
                    logger.warning("Failed to delete %s", file_path, exc_info=True)

        return {"message": "Database and directories reset successfully"}

    except Exception as e:
        db.rollback()
        logger.exception("Failed to reset database")
        raise HTTPException(
            status_code=500, detail=f"Failed to reset database: {str(e)}"
        )
