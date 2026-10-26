from alembic import command
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url

from .conftest import (
    DATABASE_URL,
    alembic_config,
    drop_database,
    recreate_database,
)

LEGACY_SCHEMA = """
CREATE TABLE documents (
    id VARCHAR PRIMARY KEY, filename VARCHAR NOT NULL, file_path VARCHAR,
    file_size INTEGER, extracted_text TEXT, word_count INTEGER,
    extraction_date TIMESTAMP, extraction_status VARCHAR,
    created_at TIMESTAMP, updated_at TIMESTAMP
);
CREATE TABLE summaries (
    id VARCHAR PRIMARY KEY, document_id VARCHAR REFERENCES documents(id),
    summary_text TEXT, summary_word_count INTEGER, summary_type VARCHAR,
    llm_model VARCHAR, processing_time_seconds FLOAT, tokens_used INTEGER,
    human_rating INTEGER, human_feedback TEXT, created_at TIMESTAMP
);
INSERT INTO documents (id, filename) VALUES ('legacy-doc', 'legacy.txt');
INSERT INTO summaries (id, document_id, summary_text)
    VALUES ('legacy-summary', 'legacy-doc', 'kept');
"""


def test_migrations_create_full_schema():
    engine = create_engine(DATABASE_URL)
    inspector = inspect(engine)

    assert {
        "documents",
        "summaries",
        "audios",
        "document_chunks",
        "alembic_version",
    } <= set(inspector.get_table_names())
    summary_columns = {c["name"] for c in inspector.get_columns("summaries")}
    assert {"approval_status", "custom_name"} <= summary_columns
    chunk_columns = {c["name"] for c in inspector.get_columns("document_chunks")}
    assert {"document_id", "chunk_index", "text", "embedding"} <= chunk_columns
    engine.dispose()


def test_initial_migration_adopts_legacy_database():
    url = make_url(DATABASE_URL).set(
        database=f"{make_url(DATABASE_URL).database}_legacy"
    ).render_as_string(hide_password=False)
    recreate_database(url)
    engine = create_engine(url)
    try:
        with engine.begin() as conn:
            conn.execute(text(LEGACY_SCHEMA))

        command.upgrade(alembic_config(url), "head")

        inspector = inspect(engine)
        summary_columns = {c["name"] for c in inspector.get_columns("summaries")}
        assert {"approval_status", "custom_name"} <= summary_columns
        assert {"audios", "document_chunks"} <= set(inspector.get_table_names())
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT summary_text FROM summaries WHERE id = 'legacy-summary'")
            ).one()
        assert row.summary_text == "kept"

        command.downgrade(alembic_config(url), "base")
        remaining = set(inspect(engine).get_table_names())
        assert not {"summaries", "document_chunks"} & remaining
    finally:
        engine.dispose()
        drop_database(url)
