"""Add multi-user support — users table and user_id FK on all data tables.

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-26
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("username", sa.String, nullable=False, unique=True),
        sa.Column("hashed_password", sa.String, nullable=False),
        sa.Column("display_name", sa.String, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    with op.batch_alter_table("transactions") as batch_op:
        batch_op.add_column(sa.Column("user_id", sa.Integer, nullable=True))
        batch_op.create_index("ix_transactions_user_id", ["user_id"])
        batch_op.create_foreign_key("fk_transactions_user", "users", ["user_id"], ["id"], ondelete="CASCADE")

    with op.batch_alter_table("uploads") as batch_op:
        batch_op.add_column(sa.Column("user_id", sa.Integer, nullable=True))
        batch_op.create_index("ix_uploads_user_id", ["user_id"])
        batch_op.create_foreign_key("fk_uploads_user", "users", ["user_id"], ["id"], ondelete="CASCADE")

    with op.batch_alter_table("merchant_aliases") as batch_op:
        batch_op.add_column(sa.Column("user_id", sa.Integer, nullable=True))
        batch_op.create_index("ix_merchant_aliases_user_id", ["user_id"])
        batch_op.create_foreign_key("fk_aliases_user", "users", ["user_id"], ["id"], ondelete="CASCADE")
        batch_op.create_unique_constraint("uq_alias_user_raw", ["user_id", "raw_merchant"])

    with op.batch_alter_table("category_rules") as batch_op:
        batch_op.add_column(sa.Column("user_id", sa.Integer, nullable=True))
        batch_op.create_index("ix_category_rules_user_id", ["user_id"])
        batch_op.create_foreign_key("fk_rules_user", "users", ["user_id"], ["id"], ondelete="CASCADE")
        batch_op.create_unique_constraint("uq_rule_user_keyword", ["user_id", "keyword"])


def downgrade() -> None:
    with op.batch_alter_table("category_rules") as batch_op:
        batch_op.drop_constraint("uq_rule_user_keyword", type_="unique")
        batch_op.drop_constraint("fk_rules_user", type_="foreignkey")
        batch_op.drop_index("ix_category_rules_user_id")
        batch_op.drop_column("user_id")

    with op.batch_alter_table("merchant_aliases") as batch_op:
        batch_op.drop_constraint("uq_alias_user_raw", type_="unique")
        batch_op.drop_constraint("fk_aliases_user", type_="foreignkey")
        batch_op.drop_index("ix_merchant_aliases_user_id")
        batch_op.drop_column("user_id")

    with op.batch_alter_table("uploads") as batch_op:
        batch_op.drop_constraint("fk_uploads_user", type_="foreignkey")
        batch_op.drop_index("ix_uploads_user_id")
        batch_op.drop_column("user_id")

    with op.batch_alter_table("transactions") as batch_op:
        batch_op.drop_constraint("fk_transactions_user", type_="foreignkey")
        batch_op.drop_index("ix_transactions_user_id")
        batch_op.drop_column("user_id")

    op.drop_table("users")
