"""Initial schema — transactions, uploads, aliases, rules (pre-multiuser).

Revision ID: 0001
Revises:
Create Date: 2026-07-01
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("narration", sa.String, nullable=False),
        sa.Column("merchant", sa.String, nullable=True),
        sa.Column("category", sa.String, nullable=True, default="Others"),
        sa.Column("debit", sa.Float, nullable=True, default=0.0),
        sa.Column("credit", sa.Float, nullable=True, default=0.0),
        sa.Column("balance", sa.Float, nullable=True),
        sa.Column("transaction_type", sa.String, nullable=False),
        sa.Column("source_file", sa.String, nullable=True),
        sa.Column("account_name", sa.String, nullable=True),
        sa.Column("is_recurring", sa.Boolean, default=False),
        sa.Column("txn_hash", sa.String, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_table(
        "uploads",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("filename", sa.String, nullable=False),
        sa.Column("file_type", sa.String, nullable=False),
        sa.Column("file_hash", sa.String, nullable=True),
        sa.Column("file_size", sa.Integer, nullable=True),
        sa.Column("row_count", sa.Integer, default=0),
        sa.Column("account_number", sa.String, nullable=True),
        sa.Column("account_name", sa.String, nullable=True),
        sa.Column("date_from", sa.Date, nullable=True),
        sa.Column("date_to", sa.Date, nullable=True),
        sa.Column("uploaded_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_table(
        "merchant_aliases",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("raw_merchant", sa.String, nullable=False),
        sa.Column("alias", sa.String, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_table(
        "category_rules",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("keyword", sa.String, nullable=False),
        sa.Column("category", sa.String, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("category_rules")
    op.drop_table("merchant_aliases")
    op.drop_table("uploads")
    op.drop_table("transactions")
