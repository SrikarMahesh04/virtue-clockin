"""Joining dates and monthly generated Employee IDs; administrators have no ID."""

from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("date_of_joining", sa.Date(), nullable=True))
    op.alter_column("users", "employee_code", existing_type=sa.String(50), nullable=True)
    op.create_table(
        "employee_id_counters",
        sa.Column("month", sa.String(4), primary_key=True),
        sa.Column("last_number", sa.Integer(), nullable=False),
        sa.CheckConstraint("last_number BETWEEN 0 AND 999", name="employee_id_counter_range"),
    )
    # Reserve any already-used matching IDs before clearing administrator IDs.
    op.execute("""INSERT INTO employee_id_counters(month,last_number)
        SELECT left(employee_code,4), max(right(employee_code,3)::integer)
        FROM users WHERE employee_code ~ '^[0-9]{4}-[0-9]{3}$'
        GROUP BY left(employee_code,4)""")
    op.execute("UPDATE users SET employee_code = NULL WHERE role <> 'employee'")
    op.create_check_constraint(
        "administrator_has_no_employee_id", "users", "role = 'employee' OR employee_code IS NULL"
    )


def downgrade() -> None:
    # Existing administrator accounts must not be assigned invented IDs on rollback.
    op.alter_column("users", "employee_code", existing_type=sa.String(50), nullable=False)
    op.drop_constraint("administrator_has_no_employee_id", "users", type_="check")
    op.drop_table("employee_id_counters")
    op.drop_column("users", "date_of_joining")
