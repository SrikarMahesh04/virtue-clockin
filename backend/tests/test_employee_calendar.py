from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.main import app
from app.models import AttendanceDay, AttendanceEvent, CalendarEntry, LateFlag, User, now
from conftest import recorded_day, sign_in
from test_api import configure


def test_optional_holiday_allows_verified_punches_and_keeps_lateness(
    client, users, database, monkeypatch
):
    configure(client, users)
    day = now().date()
    entry(client, day, "optional_holiday")
    # Optional dates remain working even if the date normally falls on a weekly off.
    with Session(database) as db:
        from app.models import Organization

        org = db.scalar(select(Organization))
        org.policy = {**org.policy, "weekly_off": list(range(7))}
        db.commit()
    sign_in(client, "alice")
    instant = datetime.combine(day, datetime.min.time(), UTC).replace(hour=8, minute=21)
    monkeypatch.setattr("app.attendance.now", lambda: instant)
    payload = {
        "location": {"latitude": 0, "longitude": 0, "accuracy_m": 5},
        "idempotency_key": "optional-holiday-in",
    }
    response = client.post("/api/v1/attendance/punch-in", json=payload)
    assert response.status_code == 200, response.text
    assert response.json()["late"] is True
    assert response.json()["snapshot"]["working"] is True
    monkeypatch.setattr("app.attendance.now", lambda: instant.replace(hour=17, minute=0))
    payload["idempotency_key"] = "optional-holiday-out"
    response = client.post("/api/v1/attendance/punch-out", json=payload)
    assert response.status_code == 200, response.text
    rows = client.get(
        "/api/v1/me/attendance", params={"start": str(day), "end": str(day), "status": "late"}
    ).json()
    assert len(rows) == 1 and rows[0]["net_minutes"] == 519
    assert rows[0]["status"] == "late" and rows[0]["expected_minutes"] == 480


def test_supplied_holiday_import_is_idempotent_and_preserves_individuals(database, users):
    from app.company_calendar import import_2026
    from datetime import date

    with Session(database) as db:
        db.add(
            CalendarEntry(
                date=date(2026, 10, 21),
                name="Individual WFH",
                kind="work_from_home",
                user_id=users["alice"],
            )
        )
        assert import_2026(db) == 14
        assert import_2026(db) == 0
        db.commit()
        rows = db.scalars(select(CalendarEntry)).all()
        assert len(rows) == 15
        assert sum(row.kind == "holiday" for row in rows) == 9
        assert sum(row.kind == "optional_holiday" for row in rows) == 5
        ugadi = next(row for row in rows if row.date == date(2026, 3, 20))
        assert ugadi.kind == "holiday"


def entry(client, day, kind, user_id=None):
    response = client.post(
        "/api/v1/calendar-days",
        json={
            "date": str(day),
            "kind": kind,
            "user_id": user_id,
            "name": kind.replace("_", " ").title(),
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_employee_scopes_wfh_filters_notifications_and_no_punches(client, users, database):
    configure(client, users)
    day = now().date()
    entry(client, day, "work_from_home")
    holiday = entry(client, day, "holiday", users["bob"])
    dashboard = client.get("/api/v1/admin/dashboard").json()
    assert dashboard["total_employees"] == 2
    assert dashboard["work_from_home"] == 1
    assert dashboard["present"] == dashboard["late"] == dashboard["incomplete"] == 0
    rows = client.get(
        "/api/v1/admin/attendance",
        params={"start": str(day), "end": str(day), "status": "work_from_home"},
    ).json()
    assert len(rows) == 1 and rows[0]["user_id"] == users["alice"]
    assert rows[0]["punch_in"] is None and rows[0]["punch_out"] is None
    assert rows[0]["net_minutes"] == 0 and rows[0]["expected_minutes"] == 480
    csv = client.get(
        "/api/v1/reports/attendance.csv",
        params={"start": str(day), "end": str(day), "status": "work_from_home"},
    )
    assert csv.status_code == 200 and "work_from_home" in csv.text and "Bob" not in csv.text
    sign_in(client, "alice")
    assert all(
        item["user_id"] in (None, users["alice"])
        for item in client.get("/api/v1/calendar-days").json()
    )
    assert client.get("/api/v1/me/dashboard").json()["attendance"]["status"] == "work_from_home"
    assert any(item["kind"] == "calendar" for item in client.get("/api/v1/notifications").json())
    for action in ("punch-in", "punch-out"):
        response = client.post(
            "/api/v1/attendance/" + action,
            json={
                "location": {"latitude": 50, "longitude": 50, "accuracy_m": 5},
                "idempotency_key": "wfh-punch-must-be-blocked-" + action,
            },
        )
        assert response.status_code == 403 and response.json()["error"]["code"] == "WORK_FROM_HOME"
    assert (
        client.post(
            "/api/v1/calendar-days", json={"date": str(day), "kind": "holiday", "name": "No access"}
        ).status_code
        == 403
    )
    sign_in(client, "bob")
    calendar = client.get("/api/v1/me/calendar", params={"start": str(day), "end": str(day)}).json()
    assert calendar["attendance"][0]["status"] == "holiday"
    sign_in(client)
    assert client.delete("/api/v1/calendar-days/" + holiday["id"]).status_code == 200
    rows = client.get(
        "/api/v1/admin/attendance",
        params={"start": str(day), "end": str(day), "status": "work_from_home"},
    ).json()
    assert {row["user_id"] for row in rows} == {users["alice"], users["bob"]}
    with Session(database) as db:
        assert db.scalar(select(AttendanceEvent)) is None
        assert db.scalar(select(AttendanceDay)) is None


def test_administrators_cannot_access_employee_attendance_and_retired_settings_fields(
    client, users, database
):
    configure(client, users)
    with Session(database) as db:
        admin = db.get(User, users["admin"])
        db.add(
            User(
                name="HR test",
                email="hr@example.com",
                role="admin",
                password_hash=admin.password_hash,
                pin_hash=admin.pin_hash,
            )
        )
        db.commit()
    for who in ("admin", "hr"):
        sign_in(client, who)
        for path in (
            "/api/v1/me/dashboard",
            "/api/v1/me/attendance",
            "/api/v1/me/calendar?start=2026-10-01&end=2026-10-31",
        ):
            assert client.get(path).status_code == 403
        for action in ("punch-in", "punch-out"):
            assert (
                client.post(
                    "/api/v1/attendance/" + action,
                    json={
                        "location": {"latitude": 0, "longitude": 0, "accuracy_m": 5},
                        "idempotency_key": "administrator-may-not-punch",
                    },
                ).status_code
                == 403
            )
    sign_in(client)
    assert set(client.get("/api/v1/settings").json()) == {
        "configured",
        "name",
        "timezone",
        "policy",
    }
    assert "microsoft" not in client.get("/api/v1/auth/methods").json()
    assert client.get("/api/v1/holidays").status_code == 404
    assert (
        client.post(
            "/api/v1/calendar-days", json={"date": "2026-10-15", "name": "Retired", "working": True}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/calendar-days",
            json={
                "date": "2026-10-15",
                "name": "Admin",
                "kind": "holiday",
                "user_id": users["admin"],
            },
        ).status_code
        == 422
    )


def test_retroactive_wfh_preserves_originals_and_recalculates_late_flags(client, users, database):
    configure(client, users)
    first = now().date().replace(day=1) - timedelta(days=32)
    first = first.replace(day=1)
    with Session(database) as db:
        db.get(User, users["alice"]).created_at = datetime.combine(first, datetime.min.time(), UTC)
        db.commit()
    ids = []
    for offset in range(6):
        start = datetime.combine(first + timedelta(days=offset), datetime.min.time(), UTC).replace(
            hour=8, minute=21
        )
        ids.append(recorded_day(database, users["alice"], start, start.replace(hour=17, minute=0)))
    entry(client, first, "optional_holiday", users["alice"])
    with Session(database) as db:
        assert db.scalar(select(LateFlag).where(LateFlag.user_id == users["alice"])).count == 6
    saved = entry(client, first, "work_from_home", users["alice"])
    row = client.get(
        "/api/v1/admin/attendance",
        params={"start": str(first), "end": str(first), "employee_id": users["alice"]},
    ).json()[0]
    assert row["status"] == "work_from_home" and row["late"] is False
    with Session(database) as db:
        original = db.get(AttendanceDay, ids[0])
        assert original.late and original.status == "late" and original.net_minutes == 519
        assert row["punch_in"] == original.punch_in.isoformat().replace("+00:00", "Z")
        assert db.scalar(select(LateFlag).where(LateFlag.user_id == users["alice"])).count == 5
    assert client.delete("/api/v1/calendar-days/" + saved["id"]).status_code == 200
    with Session(database) as db:
        assert db.scalar(select(LateFlag).where(LateFlag.user_id == users["alice"])).count == 6


def test_calendar_migration_preserves_real_legacy_holidays_and_archives_special_days(database):
    config = Config("alembic.ini")
    with database.begin() as connection:
        config.attributes["connection"] = connection
        command.downgrade(config, "0003")
        connection.execute(
            text(
                "INSERT INTO calendar_days(id,date,name,working) VALUES ('existing-holiday','2026-10-12','Existing holiday',false), ('existing-special','2026-10-13','Existing special day',true)"
            )
        )
        command.upgrade(config, "head")
        assert connection.execute(text("SELECT count(*) FROM calendar_days")).scalar_one() == 2
        row = connection.execute(text("SELECT id,kind,user_id FROM calendar_entries")).one()
        assert tuple(row) == ("existing-holiday", "holiday", None)


def test_concurrent_calendar_upsert_has_one_entry(client, users, database):
    configure(client, users)
    cookies, headers = dict(client.cookies), dict(client.headers)

    def send(_):
        with TestClient(app, client=("127.0.0.1", 50000)) as other:
            other.cookies.update(cookies)
            return other.post(
                "/api/v1/calendar-days",
                headers=headers,
                json={
                    "date": "2026-11-15",
                    "kind": "work_from_home",
                    "name": "Remote day",
                    "user_id": users["alice"],
                },
            )

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(send, range(2)))
    assert all(response.status_code == 201 for response in responses)
    assert responses[0].json()["id"] == responses[1].json()["id"]
    with Session(database) as db:
        assert len(db.scalars(select(CalendarEntry)).all()) == 1
