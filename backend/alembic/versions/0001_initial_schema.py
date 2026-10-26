"""Initial schema: documents, summaries, audios

Also adopts databases created by the pre-Alembic startup hook
(Base.metadata.create_all + manual ALTER TABLE): existing tables are left
in place and only missing columns are added.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-10-26

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columns(inspector, table: str) -> set[str]:
    return {col["name"] for col in inspector.get_columns(table)}


def _indexes(inspector, table: str) -> set[str]:
    return {idx["name"] for idx in inspector.get_indexes(table)}


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())

    if "documents" not in tables:
        op.create_table(
            "documents",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("filename", sa.String(), nullable=False),
            sa.Column("file_path", sa.String(), nullable=True),
            sa.Column("file_size", sa.Integer(), nullable=True),
            sa.Column("extracted_text", sa.Text(), nullable=True),
            sa.Column("word_count", sa.Integer(), nullable=True),
            sa.Column("extraction_date", sa.DateTime(), nullable=True),
            sa.Column("extraction_status", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
    if "ix_documents_id" not in _indexes(inspector, "documents"):
        op.create_index("ix_documents_id", "documents", ["id"], unique=False)

    if "summaries" not in tables:
        op.create_table(
            "summaries",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("document_id", sa.String(), nullable=True),
            sa.Column("custom_name", sa.String(), nullable=True),
            sa.Column("summary_text", sa.Text(), nullable=True),
            sa.Column("summary_word_count", sa.Integer(), nullable=True),
            sa.Column("summary_type", sa.String(), nullable=True),
            sa.Column("llm_model", sa.String(), nullable=True),
            sa.Column("processing_time_seconds", sa.Float(), nullable=True),
            sa.Column("tokens_used", sa.Integer(), nullable=True),
            sa.Column("human_rating", sa.Integer(), nullable=True),
            sa.Column("human_feedback", sa.Text(), nullable=True),
            sa.Column(
                "approval_status",
                sa.String(),
                server_default="pending",
                nullable=True,
            ),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["document_id"], ["documents.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    else:
        existing = _columns(inspector, "summaries")
        if "approval_status" not in existing:
            op.add_column(
                "summaries",
                sa.Column(
                    "approval_status",
                    sa.String(),
                    server_default="pending",
                    nullable=True,
                ),
            )
        if "custom_name" not in existing:
            op.add_column(
                "summaries", sa.Column("custom_name", sa.String(), nullable=True)
            )
    if "ix_summaries_id" not in _indexes(inspector, "summaries"):
        op.create_index("ix_summaries_id", "summaries", ["id"], unique=False)

    if "audios" not in tables:
        op.create_table(
            "audios",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("summary_id", sa.String(), nullable=True),
            sa.Column("audio_file_path", sa.String(), nullable=True),
            sa.Column("audio_length_seconds", sa.Float(), nullable=True),
            sa.Column("audio_format", sa.String(), nullable=True),
            sa.Column("tts_model", sa.String(), nullable=True),
            sa.Column("processing_time_seconds", sa.Float(), nullable=True),
            sa.Column("characters_processed", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["summary_id"], ["summaries.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    if "ix_audios_id" not in _indexes(inspector, "audios"):
        op.create_index("ix_audios_id", "audios", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_audios_id", table_name="audios")
    op.drop_table("audios")
    op.drop_index("ix_summaries_id", table_name="summaries")
    op.drop_table("summaries")
    op.drop_index("ix_documents_id", table_name="documents")
    op.drop_table("documents")
