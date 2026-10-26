import os
import tempfile

# Configure the app for tests before any `app` module is imported.
_TMP = tempfile.mkdtemp(prefix="summarizer-tests-")
os.environ["ENV"] = "TEST"
# Never reuse DATABASE_URL: the test database is dropped and recreated.
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql://postgres:sql@localhost:5432/summarizer_test"
)
os.environ["UPLOAD_DIR"] = os.path.join(_TMP, "uploads")
os.environ["AUDIO_DIR"] = os.path.join(_TMP, "audio")
os.environ["DB_AUTO_CREATE"] = "false"

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_URL = os.environ["DATABASE_URL"]


def alembic_config(url: str | None = None) -> Config:
    cfg = Config(os.path.join(BACKEND_DIR, "alembic.ini"))
    if url:
        cfg.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    return cfg


def _admin_engine(url: str):
    return create_engine(
        make_url(url).set(database="postgres"), isolation_level="AUTOCOMMIT"
    )


def recreate_database(url: str) -> None:
    name = make_url(url).database
    engine = _admin_engine(url)
    with engine.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
        conn.execute(text(f'CREATE DATABASE "{name}"'))
    engine.dispose()


def drop_database(url: str) -> None:
    name = make_url(url).database
    engine = _admin_engine(url)
    with engine.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
    engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def migrated_database():
    """Fresh database with the schema built by Alembic migrations."""
    recreate_database(DATABASE_URL)
    command.upgrade(alembic_config(), "head")
    yield
    from app.core.config import engine

    engine.dispose()
    drop_database(DATABASE_URL)


@pytest.fixture()
def client(migrated_database):
    from app.main import app

    with TestClient(app) as test_client:
        test_client.post("/api/testing/reset-db").raise_for_status()
        yield test_client
    app.dependency_overrides.clear()


SAMPLE_TEXT = (
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " * 10
).encode()


@pytest.fixture()
def upload(client):
    def _upload(name: str = "doc.txt") -> str:
        response = client.post(
            "/documents/upload", files={"file": (name, SAMPLE_TEXT, "text/plain")}
        )
        assert response.status_code == 200, response.text
        assert response.json()["status"] == "text_ready"
        return response.json()["id"]

    return _upload
