"""Optional holidays are working calendar dates."""

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("calendar_entry_kind", "calendar_entries", type_="check")
    op.create_check_constraint(
        "calendar_entry_kind",
        "calendar_entries",
        "kind IN ('holiday', 'work_from_home', 'optional_holiday')",
    )


def downgrade() -> None:
    # Refuse to discard real optional dates or silently turn them into holidays.
    op.drop_constraint("calendar_entry_kind", "calendar_entries", type_="check")
    op.create_check_constraint(
        "calendar_entry_kind", "calendar_entries", "kind IN ('holiday', 'work_from_home')"
    )
