"""Dedicated PostgreSQL browser-test server. Never runs against a real app database."""

import json
import os
import sys
from pathlib import Path
from uuid import uuid4

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "backend"))
url = os.environ.get("TEST_DATABASE_URL", "")
if not url or "test" not in url.rsplit("/", 1)[-1]:
    raise SystemExit("Provide TEST_DATABASE_URL pointing to a dedicated test database")

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

schema = "e2e_" + uuid4().hex
base = create_engine(url)
with base.begin() as connection:
    connection.execute(text(f'CREATE SCHEMA "{schema}"'))
test_url = (
    make_url(url)
    .update_query_dict({"options": f"-csearch_path={schema}"})
    .render_as_string(hide_password=False)
)
os.environ["DATABASE_URL"] = test_url
os.environ["FRONTEND_ORIGIN"] = "http://localhost:3000"
os.environ["FRONTEND_ADDITIONAL_ORIGINS"] = (
    f"http://{os.environ['TEST_LAN_HOST']}:3000"
    if os.environ.get("TEST_LAN_HOST")
    else ""
)
os.environ["APP_ENV"] = "test"
os.environ["SMTP_HOST"] = ""

from datetime import date, datetime, time, timedelta

from app.db import engine
from app.models import Assignment, AttendanceDay, Organization, Shift, User, now
from app.security import hasher
from app.services import challenge, recalculate, snapshot

config = Config(str(root / "backend/alembic.ini"))
config.set_main_option("script_location", str(root / "backend/alembic"))
with engine().begin() as connection:
    config.attributes["connection"] = connection
    command.upgrade(config, "head")

with Session(engine()) as db:
    db.add(
        Organization(
            name="Isolated test organization",
            timezone="UTC",
            policy={
                "latitude": 0,
                "longitude": 0,
                "radius_m": 200,
                "max_accuracy_m": 50,
                "approved_networks": ["127.0.0.1/32"],
                "weekly_off": [],
            },
        )
    )
    for code, role in [("admin", "super_admin"), ("administrator", "admin"), ("employee", "employee")]:
        db.add(
            User(
                email=f"{code}@example.com",
                name=code.title(),
                employee_code=code if role == "employee" else None,
                role=role,
                password_hash=hasher.hash("browser-test-password-long"),
                pin_hash=hasher.hash("012345"),
            )
        )
    pending = User(
        email="activate@example.com",
        name="Activation test",
        employee_code="activate",
        role="employee",
    )
    db.add(pending)
    db.flush()
    token = challenge(db, pending, "activation")
    shift = Shift(
        name="Isolated test shift",
        starts_at=time(8),
        ends_at=time(17),
    )
    db.add(shift)
    db.flush()
    for user in db.query(User).all():
        db.add(
            Assignment(user_id=user.id, shift_id=shift.id, valid_from=date(2020, 1, 1))
        )
    db.flush()
    # Historical recorded-day fixture exists only in this isolated test schema.
    employee = db.scalar(select(User).where(User.employee_code == "employee"))
    org = db.scalar(select(Organization))
    yesterday = (now() - timedelta(days=1)).date()
    recorded = AttendanceDay(
        user_id=employee.id,
        local_date=yesterday,
        punch_in=datetime.combine(yesterday, time(9), now().tzinfo),
        punch_out=datetime.combine(yesterday, time(16, 36), now().tzinfo),
        snapshot=snapshot(db, employee.id, yesterday, org),
    )
    db.add(recorded)
    db.flush()
    recalculate(db, recorded)
    for index in range(2, 13):
        day = (now() - timedelta(days=index)).date()
        previous = AttendanceDay(
            user_id=employee.id,
            local_date=day,
            punch_in=datetime.combine(day, time(9), now().tzinfo),
            punch_out=datetime.combine(day, time(16, 36), now().tzinfo),
            snapshot=snapshot(db, employee.id, day, org),
        )
        db.add(previous)
        db.flush()
        recalculate(db, previous)
    db.commit()
fixture = root / ".tools/e2e-fixture.json"
fixture.parent.mkdir(exist_ok=True)
fixture.write_text(
    json.dumps({"activation_token": token, "schema": schema}), encoding="utf-8"
)

try:
    import uvicorn
    from app.main import app

    uvicorn.run(
        app,
        host="0.0.0.0" if os.environ.get("TEST_LAN_HOST") else "127.0.0.1",
        port=8000,
        access_log=False,
    )
finally:
    engine().dispose()
    with base.begin() as connection:
        connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
    base.dispose()
    fixture.unlink(missing_ok=True)
