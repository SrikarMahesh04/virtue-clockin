from datetime import UTC, datetime, time

import pytest
from sqlalchemy.orm import Session

from app.domain import calculate, expected_shift_minutes
from app.models import AttendanceDay, now
from app.services import apply_working_hours_policy
from conftest import recorded_day, sign_in
from test_api import configure


@pytest.mark.parametrize("start,end,expected", [(8, 17, 480), (9, 16, 360), (9, 10, 0)])
def test_expected_hours_follow_assigned_shift_across_employee_views(
    client, users, database, start, end, expected
):
    configure(client, users)
    shift = client.post(
        "/api/v1/shifts",
        json={"name": "Assigned hours", "starts_at": f"{start:02}:00", "ends_at": f"{end:02}:00"},
    ).json()
    assert shift["expected_working_minutes"] == expected
    assert (
        client.put(
            f"/api/v1/employees/{users['alice']}/shift", json={"shift_id": shift["id"]}
        ).status_code
        == 200
    )
    sign_in(client, "alice")
    assert (
        client.get("/api/v1/me/dashboard").json()["shift"]["expected_working_minutes"] == expected
    )
    today = now().date()
    recorded_day(
        database,
        users["alice"],
        datetime.combine(today, time(start), UTC),
        datetime.combine(today, time(end), UTC),
    )
    params = {"start": str(today), "end": str(today)}
    row = client.get("/api/v1/me/attendance", params=params).json()[0]
    assert row["expected_minutes"] == expected
    assert row["net_minutes"] == (end - start) * 60
    calendar = client.get("/api/v1/me/calendar", params=params).json()
    assert calendar["attendance"][0]["expected_minutes"] == expected
    assert (
        next(item for item in calendar["shifts"] if item["id"] == shift["id"])[
            "expected_working_minutes"
        ]
        == expected
    )


def test_policy_updates_saved_expected_hours_once_without_changing_actuals_or_lateness(
    client, users, database
):
    configure(client, users)
    start = datetime(2026, 10, 9, 8, tzinfo=UTC)
    day_id = recorded_day(
        database, users["alice"], start.replace(minute=21), start.replace(hour=17)
    )
    with Session(database) as db:
        day = db.get(AttendanceDay, day_id)
        day.snapshot = {
            key: value for key, value in day.snapshot.items() if key != "expected_deduction_minutes"
        }
        day.expected_minutes = 540
        day.snapshot = {**day.snapshot, "calculation_version": 2}
        db.commit()
        original = (day.punch_in, day.punch_out, day.net_minutes, day.status, day.late)
        assert apply_working_hours_policy(db, "Company expected hours update") == 1
        assert day.expected_minutes == 480
        assert (day.punch_in, day.punch_out, day.net_minutes, day.status, day.late) == original
        assert day.snapshot["previous_expected_minutes"] == 540
        assert apply_working_hours_policy(db, "Repeat") == 0
        db.commit()


def test_short_and_partial_shifts_never_produce_negative_expected_hours():
    assert expected_shift_minutes(time(9, 15), time(16, 45)) == 390
    assert expected_shift_minutes(time(9), time(9, 30)) == 0
    start, end = datetime(2026, 10, 9, 9, tzinfo=UTC), datetime(2026, 10, 9, 9, 30, tzinfo=UTC)
    result = calculate((start, end), start, end, [])
    assert result["expected_minutes"] == 0 and result["net_minutes"] == 30
