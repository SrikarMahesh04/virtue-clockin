"""Initial schema. Immutable migration metadata is frozen in schema_v1.py."""

from alembic import op
from app.schema_v1 import metadata

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    metadata.create_all(op.get_bind())
    if op.get_bind().dialect.name == "postgresql":
        op.execute("""CREATE FUNCTION clockin_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Immutable audit/event record'; END; $$""")
        for table in ("attendance_events", "audit_events"):
            op.execute(
                f"CREATE TRIGGER immutable_{table} BEFORE UPDATE OR DELETE ON {table} FOR EACH ROW EXECUTE FUNCTION clockin_immutable()"
            )


def downgrade():
    metadata.drop_all(op.get_bind())
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DROP FUNCTION clockin_immutable()")
