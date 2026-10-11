from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Assignment, AttendanceDay, Challenge, Organization, User
from app.security import digest
from conftest import recorded_day, sign_in
from test_api import configure


def test_separate_activation_and_reset_links_have_correct_purposes(
    client, users, database, monkeypatch
):
    sign_in(client)
    pending = client.post(
        "/api/v1/employees",
        json={
            "name": "Pending",
            "email": "pending@example.com",
            "date_of_joining": "2026-10-11",
        },
    ).json()
    assert pending["account_activated"] is False
    delivered = []
    monkeypatch.setattr(
        "app.workforce.send_link",
        lambda email, token, purpose: delivered.append((email, token, purpose)),
    )
    assert client.post(f"/api/v1/employees/{users['alice']}/activation-link").status_code == 409
    assert client.post(f"/api/v1/employees/{pending['id']}/reset").status_code == 409
    response = client.post(f"/api/v1/employees/{pending['id']}/activation-link")
    assert response.status_code == 200 and response.json()["message"] == "Activation link sent"
    assert delivered[-1][0] == pending["email"] and delivered[-1][2] == "activation"
    token = delivered[-1][1]
    response = client.post(
        "/api/v1/auth/activate",
        json={"token": token, "password": "chosen-password", "pin": "000001"},
    )
    assert response.status_code == 200
    assert client.post(f"/api/v1/employees/{pending['id']}/activation-link").status_code == 409
    response = client.post(f"/api/v1/employees/{pending['id']}/reset")
    assert response.status_code == 200 and response.json()["message"] == "Password reset link sent"
    assert delivered[-1][2] == "recovery"
    with Session(database) as db:
        assert db.get(Challenge, digest(delivered[-1][1])).purpose == "recovery"
    sign_in(client, "alice")
    assert client.post(f"/api/v1/employees/{pending['id']}/reset").status_code == 403
    assert client.post(f"/api/v1/employees/{pending['id']}/activation-link").status_code == 403


def test_missing_email_is_not_reported_as_success(client, users, database):
    sign_in(client)
    pending = client.post(
        "/api/v1/employees",
        json={
            "name": "Pending",
            "email": "pending@example.com",
            "date_of_joining": "2026-10-11",
        },
    ).json()
    for target, endpoint in ((pending["id"], "activation-link"), (users["alice"], "reset")):
        response = client.post(f"/api/v1/employees/{target}/{endpoint}")
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "INTEGRATION_NOT_CONFIGURED"
    with Session(database) as db:
        assert db.scalar(select(Challenge)) is None


def test_date_free_shift_assignment_preserves_history_and_existing_attendance(
    client, users, database, monkeypatch
):
    configure(client, users)
    instant = datetime(2026, 10, 11, 20, tzinfo=UTC)
    monkeypatch.setattr("app.workforce.now", lambda: instant)
    with Session(database) as db:
        db.scalar(select(Organization)).timezone = "Asia/Kolkata"
        db.commit()
    yesterday = datetime(2026, 10, 10, 8, tzinfo=UTC)
    saved_id = recorded_day(database, users["alice"], yesterday, yesterday.replace(hour=17))
    shift = client.post(
        "/api/v1/shifts", json={"name": "New shift", "starts_at": "09:00", "ends_at": "18:00"}
    ).json()
    endpoint = f"/api/v1/employees/{users['alice']}/shift"
    assigned = client.put(endpoint, json={"shift_id": shift["id"]})
    assert assigned.status_code == 200, assigned.text
    assigned = assigned.json()
    assert assigned["valid_from"] == "2026-10-12" and assigned["valid_to"] is None
    assert client.put(endpoint, json={"shift_id": shift["id"]}).json()["id"] == assigned["id"]
    with Session(database) as db:
        previous = db.scalar(
            select(Assignment).where(
                Assignment.user_id == users["alice"], Assignment.id != assigned["id"]
            )
        )
        assert str(previous.valid_to) == "2026-10-11"
        saved = db.get(AttendanceDay, saved_id)
        assert saved.snapshot["shift_name"] == "Test shift" and saved.net_minutes == 540
        employee = db.get(User, users["bob"])
        employee.date_of_joining = instant.date() + timedelta(days=20)
        db.commit()
    future = client.put(
        f"/api/v1/employees/{users['bob']}/shift", json={"shift_id": shift["id"]}
    ).json()
    assert future["valid_from"] == "2026-10-31"
    assert client.put(endpoint, json={"shift_id": "missing"}).status_code == 422
    assert (
        client.put(
            f"/api/v1/employees/{users['admin']}/shift", json={"shift_id": shift["id"]}
        ).status_code
        == 422
    )
