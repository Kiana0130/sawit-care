"""Version access sessions when a password changes.

Revision ID: 0003_session_version
Revises: 0002_scans_quota
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_session_version"
down_revision = "0002_scans_quota"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("session_version", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("users", "session_version")
