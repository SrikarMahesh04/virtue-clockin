"""Employee-scoped holiday and work-from-home calendar entries."""

from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "calendar_entries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("kind", sa.String(30), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
        sa.CheckConstraint("kind IN ('holiday', 'work_from_home')", name="calendar_entry_kind"),
    )
    op.create_index(
        "calendar_entry_all_date",
        "calendar_entries",
        ["date"],
        unique=True,
        postgresql_where=sa.text("user_id IS NULL"),
    )
    op.create_index(
        "calendar_entry_employee_date",
        "calendar_entries",
        ["date", "user_id"],
        unique=True,
        postgresql_where=sa.text("user_id IS NOT NULL"),
    )
    # Carry forward real existing holidays; keep the complete retired table intact.
    op.execute(
        "INSERT INTO calendar_entries (id, date, name, kind, user_id) "
        "SELECT id, date, name, 'holiday', NULL FROM calendar_days WHERE working = false"
    )


def downgrade() -> None:
    op.drop_table("calendar_entries")
