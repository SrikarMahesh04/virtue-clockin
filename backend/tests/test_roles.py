from datetime import date

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.account_reset import replace_accounts
from app.models import (
    AttendanceDay,
    AttendanceEvent,
    AuditEvent,
    AuthSession,
    CalendarEntry,
    Organization,
    Shift,
    User,
)
from app.services import challenge
from conftest import sign_in
from test_api import configure


def test_legacy_hr_migration_revokes_sessions_and_converts_role(database):
    config = Config("alembic.ini")
    with database.begin() as connection:
        config.attributes["connection"] = connection
        command.downgrade(config, "0006")
        connection.execute(
            text("""INSERT INTO users
            (id,email,name,role,active,pin_failures,created_at)
            VALUES ('legacy-hr','legacy@example.com','Legacy Admin','hr_admin',true,0,now())""")
        )
        connection.execute(
            text("""INSERT INTO sessions(id,user_id,csrf,expires_at)
            VALUES ('old-session','legacy-hr','old-csrf',now() + interval '1 hour')""")
        )
        command.upgrade(config, "head")
        assert (
            connection.execute(text("SELECT role FROM users WHERE id='legacy-hr'")).scalar()
            == "admin"
        )
        assert connection.execute(text("SELECT count(*) FROM sessions")).scalar() == 0


@pytest.mark.parametrize("role", ["admin", "super_admin"])
def test_equal_administrative_access_and_separate_credentials(client, users, database, role):
    assert client.get("/ready").status_code == 200
    configure(client, users)
    created = client.post(
        "/api/v1/employees",
        json={
            "email": "second@example.com",
            "name": "Second administrator",
            "role": role,
        },
    )
    assert created.status_code == 201, created.text
    account = created.json()
    assert account["employee_code"] is None and account["date_of_joining"] is None
    with Session(database) as db:
        token = challenge(db, db.get(User, account["id"]), "activation")
        db.commit()
    credentials = {"token": token, "password": "separate-admin-password", "pin": "098765"}
    assert client.post("/api/v1/auth/activate", json=credentials).status_code == 200
    assert client.post("/api/v1/auth/activate", json=credentials).status_code == 400
    sign_in(client, "second", "pin", "098765")
    assert client.get("/api/v1/settings").status_code == 403  # Password reauthentication
    assert (
        client.post(
            "/api/v1/auth/reauthenticate",
            json={
                "password": "separate-admin-password",
            },
        ).status_code
        == 200
    )
    for path in (
        "/api/v1/settings",
        "/api/v1/employees",
        "/api/v1/shifts",
        "/api/v1/admin/dashboard",
    ):
        assert client.get(path).status_code == 200, path
    settings = client.get("/api/v1/settings").json()
    assert (
        client.put(
            "/api/v1/settings",
            json={
                "name": settings["name"],
                "timezone": settings["timezone"],
                **settings["policy"],
                "reason": "Verify equal administrator permissions",
            },
        ).status_code
        == 200
    )
    for new_role in ("employee", "admin", "super_admin"):
        response = client.post(
            "/api/v1/employees",
            json={
                "name": "Managed account",
                "email": new_role + "@example.net",
                "role": new_role,
                "date_of_joining": "2026-10-11" if new_role == "employee" else None,
            },
        )
        assert response.status_code == 201, response.text
        body = response.json()
        assert (
            client.put(
                "/api/v1/employees/" + body["id"],
                json={
                    "name": body["name"],
                    "email": body["email"],
                    "role": new_role,
                    "date_of_joining": body["date_of_joining"],
                    "active": False,
                },
            ).status_code
            == 200
        )
    assert (
        client.put(
            "/api/v1/employees/" + account["id"],
            json={
                "name": account["name"],
                "email": account["email"],
                "role": "employee",
                "date_of_joining": "2026-10-11",
            },
        ).status_code
        == 409
    )
    assert client.get("/api/v1/me/dashboard").status_code == 403
    sign_in(client, "second", secret="separate-admin-password")
    assert client.get("/api/v1/settings").status_code == 200
    sign_in(client, "alice")
    assert client.get("/api/v1/settings").status_code == 403
    assert (
        client.post(
            "/api/v1/employees",
            json={
                "name": "Forbidden",
                "email": "forbidden@example.net",
                "role": "super_admin",
            },
        ).status_code
        == 403
    )


@pytest.mark.parametrize("commit", [False, True])
def test_account_replacement_is_atomic_and_preserves_office_configuration(
    client,
    users,
    database,
    commit,
):
    configure(client, users)
    old_session = dict(client.cookies)
    with Session(database) as db:
        old_token = challenge(db, db.get(User, users["alice"]), "activation")
        day = AttendanceDay(user_id=users["alice"], local_date=date(2026, 10, 11), snapshot={})
        db.add(day)
        db.flush()
        db.add_all(
            [
                AttendanceEvent(day_id=day.id, kind="in", evidence={}, idempotency_key="old-event"),
                AuditEvent(actor_id=users["admin"], action="old.action", target_id=day.id),
                CalendarEntry(date=date(2026, 10, 11), name="Global holiday", kind="holiday"),
                CalendarEntry(
                    date=date(2026, 10, 12),
                    name="Personal WFH",
                    kind="work_from_home",
                    user_id=users["alice"],
                ),
            ]
        )
        db.commit()
    with Session(database) as db:
        account, token, count = replace_accounts(
            db, "fresh@example.com", "Fresh Super Admin", "User requested account reset"
        )
        new_id = account.id
        assert count == 3
        if commit:
            db.commit()
        else:
            db.rollback()
    with Session(database) as db:
        assert db.scalar(select(func.count()).select_from(User)) == (1 if commit else 3)
        assert db.scalar(select(Organization)) is not None
        assert db.scalar(select(Shift)) is not None
        assert db.scalar(select(func.count()).select_from(CalendarEntry)) == (1 if commit else 2)
        assert db.scalar(select(func.count()).select_from(AttendanceEvent)) == (0 if commit else 1)
        assert db.scalar(select(func.count()).select_from(AuditEvent)) == (0 if commit else 1)
        assert db.scalar(select(func.count()).select_from(AuthSession)) == (0 if commit else 1)
        assert (
            db.execute(
                text(
                    "SELECT count(*) FROM pg_trigger WHERE tgrelid IN ('attendance_events'::regclass, 'audit_events'::regclass) AND tgname LIKE 'immutable_%' AND tgenabled = 'O'"
                )
            ).scalar()
            == 2
        )
    client.cookies.update(old_session)
    assert client.get("/api/v1/auth/session").status_code == (401 if commit else 200)
    if commit:
        client.cookies.clear()
        assert (
            client.post(
                "/api/v1/auth/activate",
                json={"token": old_token, "password": "old-pass", "pin": "012345"},
            ).status_code
            == 400
        )
        assert (
            client.post(
                "/api/v1/auth/activate",
                json={"token": token, "password": "new-pass", "pin": "001234"},
            ).status_code
            == 200
        )
        session = sign_in(client, "fresh", secret="new-pass")
        assert session["user"]["id"] == new_id and session["user"]["role"] == "super_admin"
        assert client.get("/api/v1/employees").json()[0]["employee_code"] is None
