"""Retire optional scheduled deductions; preserve previous settings for rollback."""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "retired_shift_settings",
        sa.Column("shift_id", sa.String(36), primary_key=True),
        sa.Column("settings", sa.JSON(), nullable=False),
    )
    op.execute("""INSERT INTO retired_shift_settings (shift_id, settings)
        SELECT id, json_build_object('lunch_start', lunch_start::text, 'lunch_minutes', lunch_minutes)
        FROM shifts""")
    op.drop_column("shifts", "lunch_start")
    op.drop_column("shifts", "lunch_minutes")


def downgrade():
    op.add_column("shifts", sa.Column("lunch_start", sa.Time(), nullable=True))
    op.add_column("shifts", sa.Column("lunch_minutes", sa.Integer(), nullable=True))
    op.execute("""UPDATE shifts SET lunch_start = (archive.settings->>'lunch_start')::time,
        lunch_minutes = (archive.settings->>'lunch_minutes')::integer
        FROM retired_shift_settings archive WHERE shifts.id = archive.shift_id""")
    op.execute(
        "UPDATE shifts SET lunch_start = starts_at, lunch_minutes = 0 WHERE lunch_start IS NULL"
    )
    op.alter_column("shifts", "lunch_start", nullable=False)
    op.alter_column("shifts", "lunch_minutes", nullable=False)
    op.drop_table("retired_shift_settings")
