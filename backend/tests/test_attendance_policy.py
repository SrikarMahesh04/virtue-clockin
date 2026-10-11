from datetime import UTC, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AttendanceDay, AuditEvent, now
from app.services import apply_grace_policy
from conftest import recorded_day, sign_in
from test_api import configure


def test_grace_policy_updates_saved_lateness_once_without_changing_punches(client, users, database):
    configure(client, users)
    start = datetime(2026, 10, 9, 8, 15, tzinfo=UTC)
    end = datetime(2026, 10, 9, 17, tzinfo=UTC)
    day_id = recorded_day(database, users["alice"], start, end)
    with Session(database) as db:
        day = db.get(AttendanceDay, day_id)
        day.snapshot = {key: value for key, value in day.snapshot.items() if key != "grace_minutes"}
        day.late, day.status = True, "late"
        db.commit()
        assert apply_grace_policy(db, "Apply approved 20-minute grace") == 1
        db.commit()
        assert day.punch_in == start and day.punch_out == end
        assert not day.late and day.status == "present"
        assert day.net_minutes == 525 and day.expected_minutes == 480
        assert apply_grace_policy(db, "Repeat policy application") == 0
        assert db.scalar(select(AuditEvent)) is None


def test_new_secondary_shift_uses_twenty_minutes_and_manual_entry_is_retired(
    client, users, database, monkeypatch
):
    configure(client, users)
    shift = client.post(
        "/api/v1/shifts",
        json={"name": "Secondary", "starts_at": "13:00", "ends_at": "21:00"},
    ).json()
    today = now().date()
    for who in ("alice", "bob"):
        response = client.post(
            "/api/v1/assignments",
            json={
                "user_id": users[who],
                "shift_id": shift["id"],
                "valid_from": str(today),
            },
        )
        assert response.status_code == 201, response.text
    instant = datetime.combine(today, time(13, 20), UTC)
    for who, delta, late in (("alice", 0, False), ("bob", 1, True)):
        monkeypatch.setattr(
            "app.attendance.now", lambda delta=delta: instant + timedelta(seconds=delta)
        )
        sign_in(client, who)
        response = client.post(
            "/api/v1/attendance/punch-in",
            json={
                "location": {"latitude": 0, "longitude": 0, "accuracy_m": 5},
                "idempotency_key": f"policy-boundary-{who}",
            },
        )
        assert response.status_code == 200, response.text
        assert response.json()["late"] is late
    assert client.post("/api/v1/admin/attendance/corrections", json={}).status_code == 404
    assert (
        client.post(
            "/api/v1/requests",
            json={
                "kind": "correction",
                "starts_at": instant.isoformat(),
                "ends_at": (instant + timedelta(hours=1)).isoformat(),
                "reason": "Retired feature",
            },
        ).status_code
        == 404
    )
