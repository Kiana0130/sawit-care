"""Add indexes needed by authenticated scan history and quota queries.

Revision ID: 0002_scans_quota
Revises: 0001_initial
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0002_scans_quota"
down_revision: Union[str, Sequence[str], None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("ix_scans_client_id", table_name="scans")
    op.create_unique_constraint("uq_scans_user_client", "scans", ["user_id", "client_id"])
    op.create_index("ix_scans_user_id", "scans", ["user_id"], unique=False)
    op.create_index("ix_scans_scanned_at", "scans", ["scanned_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_scans_scanned_at", table_name="scans")
    op.drop_index("ix_scans_user_id", table_name="scans")
    op.drop_constraint("uq_scans_user_client", "scans", type_="unique")
    op.create_unique_constraint("uq_scans_client_id", "scans", ["client_id"])
    op.create_index("ix_scans_client_id", "scans", ["client_id"], unique=False)
