"""Add sandbox payments and expiring entitlement."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0004_payments"
down_revision = "0003_session_version"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("users", sa.Column("pro_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table("payments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", UUID(as_uuid=True), nullable=False),
        sa.Column("order_id", sa.String(64), nullable=False, unique=True),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("redirect_url", sa.String(512), nullable=True),
        sa.Column("granted_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "client_id", name="uq_payment_user_client"))
    op.create_index("ix_payments_user_id", "payments", ["user_id"])

def downgrade():
    op.drop_index("ix_payments_user_id", table_name="payments")
    op.drop_table("payments")
    op.drop_column("users", "pro_expires_at")
