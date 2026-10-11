from datetime import UTC, date, datetime

from alembic import command
from alembic.config import Config
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.models import Assignment, AttendanceDay, AuditEvent, Shift, User
from app.services import recalculate, shift_on, snapshot, organization
from conftest import recorded_day, sign_in
from test_api import configure


def test_shift_only_contract_and_full_work_duration(client, users, database):
    configure(client, users)
    assert client.get("/api/v1/office/timezone").json() == {"timezone": "UTC"}
    payload = {"name": "Shift only", "starts_at": "09:00", "ends_at": "17:00", "active": True}
    response = client.post("/api/v1/shifts", json=payload)
    assert response.status_code == 201, response.text
    assert set(response.json()) == {"id", "expected_working_minutes", *payload.keys()}
    assert client.post("/api/v1/shifts", json={**payload, "ends_at": "08:00"}).status_code == 422
    assert client.post("/api/v1/shifts", json={**payload, "lunch_minutes": 60}).status_code == 422
    sign_in(client)
    day_id = recorded_day(
        database,
        users["alice"],
        datetime(2026, 10, 9, 8, tzinfo=UTC),
        datetime(2026, 10, 9, 17, tzinfo=UTC),
    )
    with Session(database) as db:
        day = db.get(AttendanceDay, day_id)
        assert day.net_minutes == 540 and day.expected_minutes == 480
        assert day.snapshot["calculation_version"] == 3
    assert client.post("/api/v1/admin/attendance/corrections", json={}).status_code == 404


def test_historical_snapshot_retains_recorded_calculation(database, users):
    with Session(database) as db:
        start, end = datetime(2026, 10, 9, 8, tzinfo=UTC), datetime(2026, 10, 9, 17, tzinfo=UTC)
        day = AttendanceDay(
            user_id=users["alice"],
            local_date=start.date(),
            punch_in=start,
            punch_out=end,
            snapshot={
                "start": start.isoformat(),
                "end": end.isoformat(),
                "working": True,
                "lunch_start": "2026-10-09T12:00:00+00:00",
                "lunch_end": "2026-10-09T13:00:00+00:00",
            },
        )
        db.add(day)
        db.flush()
        recalculate(db, day, db.get(User, users["admin"]))
        assert day.net_minutes == 480 and day.expected_minutes == 480


def test_migration_archives_previous_shift_settings_for_rollback(database):
    config = Config("alembic.ini")
    with database.begin() as connection:
        config.attributes["connection"] = connection
        command.downgrade(config, "0001")
        connection.execute(
            text("""INSERT INTO shifts (id,name,starts_at,ends_at,lunch_start,lunch_minutes,active)
            VALUES ('legacy','Existing shift','08:00','17:00','12:30',45,true)""")
        )
        command.upgrade(config, "head")
        archive = connection.execute(
            text("SELECT settings FROM retired_shift_settings WHERE shift_id='legacy'")
        ).scalar_one()
        assert archive["lunch_minutes"] == 45
        command.downgrade(config, "0001")
        assert (
            connection.execute(
                text("SELECT lunch_minutes FROM shifts WHERE id='legacy'")
            ).scalar_one()
            == 45
        )
        command.upgrade(config, "head")


def test_assigned_shift_edits_status_and_deletion_preserve_recorded_days(client, users, database):
    configure(client, users)
    shift = client.get("/api/v1/shifts").json()[0]
    target = f"/api/v1/shifts/{shift['id']}"
    with Session(database) as db:
        saved = snapshot(db, users["alice"], date(2026, 10, 9), organization(db))
        day = AttendanceDay(user_id=users["alice"], local_date=date(2026, 10, 9), snapshot=saved)
        db.add(day)
        db.commit()
        day_id = day.id
    body = {
        "name": "Updated assigned shift",
        "starts_at": "09:30",
        "ends_at": "18:00",
        "active": True,
    }
    assert client.put(target, json=body).status_code == 200
    with Session(database) as db:
        assert db.get(AttendanceDay, day_id).snapshot == saved
        upcoming = snapshot(db, users["alice"], date(2026, 10, 10), organization(db))
        assert "09:30" in upcoming["start"]
    assert client.put(target, json={**body, "active": False}).status_code == 200
    with Session(database) as db:
        assert shift_on(db, users["alice"], date(2026, 10, 10)) is None
    response = client.post(
        "/api/v1/assignments",
        json={"user_id": users["alice"], "shift_id": shift["id"], "valid_from": "2030-01-01"},
    )
    assert response.status_code == 422
    assert client.put(target, json=body).status_code == 200
    assert client.delete(target).status_code == 200
    assert client.get("/api/v1/shifts").json() == []
    assert client.put(target, json=body).status_code == 404
    assert client.delete(target).status_code == 404
    with Session(database) as db:
        assert db.get(Shift, shift["id"]).deleted
        assert db.get(AttendanceDay, day_id).snapshot == saved
        assert db.scalar(select(Assignment).where(Assignment.shift_id == shift["id"]))
        assert db.scalar(select(AuditEvent)) is None
    sign_in(client, "alice")
    assert client.delete(target).status_code == 403
