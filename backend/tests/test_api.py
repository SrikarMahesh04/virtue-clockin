from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.main import app
from app.models import (
    AttendanceDay,
    AttendanceEvent,
    AuditEvent,
    LateFlag,
    Organization,
    TimeOff,
    User,
    now,
)
from app.services import challenge, recalculate
from conftest import recorded_day, sign_in


def configure(client, users):
    sign_in(client)
    response = client.put(
        "/api/v1/settings",
        json={
            "name": "Test organization",
            "timezone": "UTC",
            "latitude": 0,
            "longitude": 0,
            "radius_m": 200,
            "max_accuracy_m": 50,
            "approved_networks": ["127.0.0.1/32"],
            "weekly_off": [],
            "reason": "Test setup",
        },
    )
    assert response.status_code == 200, response.text
    shift = client.post(
        "/api/v1/shifts",
        json={
            "name": "Test shift",
            "starts_at": "08:00",
            "ends_at": "17:00",
        },
    ).json()
    for user in users.values():
        response = client.post(
            "/api/v1/assignments",
            json={"user_id": user, "shift_id": shift["id"], "valid_from": "2020-01-01"},
        )
        assert response.status_code == 201, response.text


def test_empty_unconfigured_and_origin(client):
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/api/v1/auth/session").status_code == 401
    assert set(client.get("/api/v1/auth/methods").json()) == {"password", "pin", "recovery"}
    client.headers["Origin"] = "https://evil.example"
    response = client.post(
        "/api/v1/auth/login", json={"email": "nobody@example.com", "secret": "bad"}
    )
    assert response.status_code == 403
    assert "request_id" in response.json()


def test_pin_leading_zero_lockout_password_and_csrf(client, users):
    sign_in(client, "alice", "pin", "012345")
    for _ in range(5):
        assert (
            client.post(
                "/api/v1/auth/login",
                json={"email": "alice@example.com", "method": "pin", "secret": "999999"},
            ).status_code
            == 401
        )
    assert (
        client.post(
            "/api/v1/auth/login",
            json={"email": "alice@example.com", "method": "pin", "secret": "012345"},
        ).status_code
        == 401
    )
    sign_in(client, "alice")
    client.headers.pop("X-CSRF-Token")
    assert (
        client.post(
            "/api/v1/auth/pin", json={"password": "test-password-long", "pin": "123456"}
        ).status_code
        == 403
    )


def test_activation_replay_and_recovery_session_revocation(client, users, database):
    sign_in(client, "alice")
    with Session(database) as db:
        user = db.get(User, users["alice"])
        token = challenge(db, user, "recovery")
        db.commit()
    response = client.post(
        "/api/v1/auth/recovery/complete",
        json={"token": token, "password": "new-test-password-long", "pin": "000001"},
    )
    assert response.status_code == 200, response.text
    assert client.get("/api/v1/auth/session").status_code == 401
    assert (
        client.post(
            "/api/v1/auth/recovery/complete",
            json={"token": token, "password": "new-test-password-long", "pin": "000001"},
        ).status_code
        == 400
    )
    sign_in(client, "alice", "pin", "000001")
    assert (
        client.post(
            "/api/v1/auth/recovery/request", json={"email": "alice@example.com"}
        ).status_code
        == 503
    )


def test_rbac_and_deactivation(client, users):
    sign_in(client, "alice")
    assert client.get("/api/v1/employees").status_code == 403
    sign_in(client)
    response = client.put(
        f"/api/v1/employees/{users['bob']}",
        json={
            "name": "Bob",
            "email": "bob@example.com",
            "date_of_joining": "2026-10-11",
            "role": "employee",
            "active": False,
        },
    )
    assert response.status_code == 200
    assert (
        client.post(
            "/api/v1/auth/login",
            json={"email": "bob@example.com", "method": "pin", "secret": "012345"},
        ).status_code
        == 401
    )


def test_punch_idempotency_order_and_network(client, users, database):
    configure(client, users)
    sign_in(client, "alice")
    body = {
        "location": {"latitude": 0, "longitude": 0, "accuracy_m": 5},
        "idempotency_key": "test-unique-punch-key",
    }
    assert client.post("/api/v1/attendance/punch-out", json=body).status_code == 409
    response = client.post("/api/v1/attendance/punch-in", json=body)
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "incomplete"
    assert (
        client.post("/api/v1/attendance/punch-in", json=body).json()["id"] == response.json()["id"]
    )
    body["idempotency_key"] = "another-punch-in-key"
    assert client.post("/api/v1/attendance/punch-in", json=body).status_code == 409
    body["location"]["latitude"] = 30
    assert client.post("/api/v1/attendance/punch-out", json=body).status_code == 403
    body["location"]["latitude"] = 0
    body["idempotency_key"] = "test-unique-punch-out"
    assert client.post("/api/v1/attendance/punch-out", json=body).status_code == 200
    with Session(database) as db:
        assert len(db.scalars(select(AttendanceEvent)).all()) == 2
        org = db.scalar(select(Organization))
        org.policy = {}
        db.commit()
    assert (
        client.post(
            "/api/v1/attendance/punch-in",
            json={**body, "idempotency_key": "unconfigured-punch-key"},
        ).status_code
        == 503
    )


def test_map_selected_office_policy_is_enforced_for_both_punches(client, users, database):
    configure(client, users)
    settings = client.get("/api/v1/settings").json()
    policy = {
        **settings["policy"],
        "name": settings["name"],
        "timezone": settings["timezone"],
        "latitude": 10,
        "longitude": 20,
        "radius_m": 150,
        "reason": "Moved office pin and reviewed attendance circle",
    }
    response = client.put("/api/v1/settings", json=policy)
    assert response.status_code == 200, response.text
    assert response.json()["policy"]["latitude"] == 10
    assert response.json()["policy"]["radius_m"] == 150
    with Session(database) as db:
        assert db.scalar(select(AuditEvent)) is None
    sign_in(client, "alice")
    body = {
        "location": {"latitude": 0, "longitude": 0, "accuracy_m": 5},
        "idempotency_key": "new-office-map-punch-in",
    }
    assert client.post("/api/v1/attendance/punch-in", json=body).status_code == 403
    body["location"].update(latitude=10, longitude=20)
    assert client.post("/api/v1/attendance/punch-in", json=body).status_code == 200
    body["idempotency_key"] = "new-office-map-punch-out"
    body["location"]["longitude"] = 21
    assert client.post("/api/v1/attendance/punch-out", json=body).status_code == 403
    body["location"]["longitude"] = 20
    body["location"]["accuracy_m"] = 200
    assert client.post("/api/v1/attendance/punch-out", json=body).status_code == 403
    body["location"]["accuracy_m"] = 5
    assert client.post("/api/v1/attendance/punch-out", json=body).status_code == 200


def test_historical_permission_recalculation_preserves_late_flags(client, users, database):
    configure(client, users)
    first = (now() - timedelta(days=60)).date().replace(day=1)
    for index in range(6):
        day = first + timedelta(days=index)
        recorded_day(
            database,
            users["alice"],
            datetime.combine(day, datetime.min.time(), UTC).replace(hour=8, minute=21),
            datetime.combine(day, datetime.min.time(), UTC).replace(hour=17),
        )
    with Session(database) as db:
        flag = db.scalar(select(LateFlag).where(LateFlag.user_id == users["alice"]))
        assert flag.count == 6 and flag.state == "flagged"
    # Historical approved permissions still preserve established attendance totals.
    with Session(database) as db:
        db.add(
            TimeOff(
                user_id=users["alice"],
                kind="hourly",
                status="approved",
                starts_at=datetime.combine(first, datetime.min.time(), UTC).replace(hour=8),
                ends_at=datetime.combine(first, datetime.min.time(), UTC).replace(
                    hour=8, minute=30
                ),
                reason="Historical approved permission",
            )
        )
        db.flush()
        for saved in db.scalars(
            select(AttendanceDay).where(AttendanceDay.user_id == users["alice"])
        ):
            recalculate(db, saved)
        db.commit()
    with Session(database) as db:
        flag = db.scalar(select(LateFlag).where(LateFlag.user_id == users["alice"]))
        assert flag.count == 5 and flag.state == "warning"
        assert db.scalar(select(AuditEvent)) is None


def test_simultaneous_punches(client, users, database):
    configure(client, users)
    sign_in(client, "alice")
    cookies = dict(client.cookies)
    headers = dict(client.headers)

    def send(index):
        with TestClient(app, client=("127.0.0.1", 50000)) as other:
            other.cookies.update(cookies)
            return other.post(
                "/api/v1/attendance/punch-in",
                headers=headers,
                json={
                    "location": {"latitude": 0, "longitude": 0, "accuracy_m": 5},
                    "idempotency_key": f"concurrent-punch-{index}",
                },
            ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        codes = list(pool.map(send, [1, 2]))
    assert sorted(codes) == [200, 409]
    with Session(database) as db:
        assert len(db.scalars(select(AttendanceDay)).all()) == 1


def test_csv_formula_and_pin_admin_elevation(client, users):
    configure(client, users)
    sign_in(client, "admin", "pin", "012345")
    assert client.get("/api/v1/employees").json()["error"]["code"] == "REAUTH_REQUIRED"
    assert (
        client.post(
            "/api/v1/auth/reauthenticate", json={"password": "test-password-long-enough"}
        ).status_code
        == 200
    )
    assert client.get("/api/v1/employees").status_code == 200
    from app.attendance import safe_cell

    assert safe_cell(" =SUM(A1)").startswith("'")
    assert safe_cell("Normal name") == "Normal name"


def test_schedule_projections_never_fabricate_punches(client, users, database):
    configure(client, users)
    past = (now() - timedelta(days=3)).date()
    with Session(database) as db:
        employee = db.get(User, users["alice"])
        employee.created_at = now() - timedelta(days=10)
        db.commit()
    response = client.get("/reports/attendance")
    assert response.status_code == 404
    response = client.get(
        "/api/v1/reports/attendance",
        params={"start": str(past), "end": str(past), "employee_id": users["alice"]},
    )
    assert response.status_code == 200, response.text
    row = response.json()[0]
    assert row["status"] == "absent" and row["snapshot"]["derived"] is True
    assert row["punch_in"] is None and row["punch_out"] is None
    with Session(database) as db:
        db.add(
            TimeOff(
                user_id=users["alice"],
                kind="full_day",
                status="approved",
                starts_at=datetime.combine(past, datetime.min.time(), UTC).replace(hour=8),
                ends_at=datetime.combine(past, datetime.min.time(), UTC).replace(hour=17),
                reason="Historical approved full day",
            )
        )
        db.commit()
    row = client.get(
        "/api/v1/reports/attendance",
        params={"start": str(past), "end": str(past), "employee_id": users["alice"]},
    ).json()[0]
    assert row["status"] == "approved_leave" and row["expected_minutes"] == 0
    with Session(database) as db:
        assert db.scalars(select(AttendanceEvent)).all() == []
        assert db.scalars(select(AttendanceDay)).all() == []


def test_preserved_historical_audit_and_untrusted_forwarded_header(client, users, database):
    import pytest
    from sqlalchemy import text
    from sqlalchemy.exc import DBAPIError

    configure(client, users)
    with Session(database) as db:
        # Seed historical storage explicitly; current operations no longer add these rows.
        db.add(AuditEvent(action="historical.change", target_id="legacy", request_id="legacy"))
        db.commit()
        with pytest.raises(DBAPIError):
            db.execute(text("UPDATE audit_events SET reason = 'tampered'"))
        db.rollback()
        org = db.scalar(select(Organization))
        org.policy = {**org.policy, "approved_networks": ["203.0.113.0/24"]}
        db.commit()
    sign_in(client, "alice")
    response = client.post(
        "/api/v1/attendance/punch-in",
        headers={"X-Forwarded-For": "203.0.113.4"},
        json={
            "location": {"latitude": 0, "longitude": 0, "accuracy_m": 5},
            "idempotency_key": "forged-forwarded-header",
        },
    )
    assert response.status_code == 403


def test_request_workflow_is_removed_for_both_roles(client, users, database):
    configure(client, users)
    for who in ("admin", "alice"):
        sign_in(client, who)
        for path in ("/api/v1/requests", "/api/v1/admin/requests"):
            assert client.get(path).status_code == 404
        assert client.post("/api/v1/requests", json={}).status_code == 404
        assert client.post("/api/v1/requests/old-id/review", json={}).status_code == 404
    calendar = client.get(
        "/api/v1/me/calendar", params={"start": "2026-10-01", "end": "2026-10-31"}
    )
    assert calendar.status_code == 200
    assert "requests" not in calendar.json()
    sign_in(client)
    dashboard = client.get("/api/v1/admin/dashboard").json()
    assert "pending" not in dashboard and "on_leave" not in dashboard
    from app.main import app

    assert not any("/requests" in path for path in app.openapi()["paths"])
