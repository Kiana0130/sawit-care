"""Add durable payment grant intervals; preserve existing expiry as baseline.

Pre-existing payments cannot be safely reconstructed from their ending timestamps.
They remain legacy baseline and require manual review on refund.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0005_payment_grants"
down_revision = "0004_payments"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("entitlement_baseline_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE users SET entitlement_baseline_at = pro_expires_at WHERE pro_expires_at IS NOT NULL")
    op.create_table(
        "payment_grants",
        sa.Column("payment_id", UUID(as_uuid=True), sa.ForeignKey("payments.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_payment_grants_user_id", "payment_grants", ["user_id"])


def downgrade():
    op.drop_index("ix_payment_grants_user_id", table_name="payment_grants")
    op.drop_table("payment_grants")
    op.drop_column("users", "entitlement_baseline_at")
