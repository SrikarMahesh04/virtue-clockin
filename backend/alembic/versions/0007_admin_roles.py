"""Three roles with equal administrative permissions; retire the HR role."""

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE role = 'hr_admin')"
    )
    op.execute("UPDATE users SET role = 'admin' WHERE role = 'hr_admin'")
    op.create_check_constraint(
        "valid_user_role", "users", "role IN ('employee', 'admin', 'super_admin')"
    )


def downgrade():
    op.drop_constraint("valid_user_role", "users", type_="check")
    op.execute("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE role = 'admin')")
    op.execute("UPDATE users SET role = 'hr_admin' WHERE role = 'admin'")
