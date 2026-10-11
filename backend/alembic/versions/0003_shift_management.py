"""Preserve shift references when removing definitions from the available list."""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "shifts", sa.Column("deleted", sa.Boolean(), nullable=False, server_default=sa.false())
    )


def downgrade():
    op.drop_column("shifts", "deleted")
