"""Initial Sawit Care schema.

Revision ID: 0001_initial
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=150), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("plan", sa.String(length=20), server_default="free", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "disease_classes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("model_label", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=True),
        sa.Column("is_healthy", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("cause", sa.Text(), nullable=True),
        sa.Column("symptoms", sa.Text(), nullable=True),
        sa.Column("treatment", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_disease_classes"),
        sa.UniqueConstraint("model_label", name="uq_disease_classes_model_label"),
    )

    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_refresh_tokens_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_refresh_tokens"),
        sa.UniqueConstraint("token_hash", name="uq_refresh_tokens_token_hash"),
    )
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"], unique=False)

    op.create_table(
        "scans",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("disease_class_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("image_object_key", sa.String(length=512), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("confidence", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("scanned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["disease_class_id"], ["disease_classes.id"], name="fk_scans_disease_class_id_disease_classes", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_scans_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_scans"),
        sa.UniqueConstraint("client_id", name="uq_scans_client_id"),
    )
    op.create_index("ix_scans_client_id", "scans", ["client_id"], unique=False)

    op.create_table(
        "daily_scan_usage",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("usage_date", sa.Date(), nullable=False),
        sa.Column("scan_count", sa.Integer(), server_default="0", nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_daily_scan_usage_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "usage_date", name="pk_daily_scan_usage"),
    )


def downgrade() -> None:
    op.drop_table("daily_scan_usage")
    op.drop_index("ix_scans_client_id", table_name="scans")
    op.drop_table("scans")
    op.drop_index("ix_refresh_tokens_token_hash", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
    op.drop_table("disease_classes")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
