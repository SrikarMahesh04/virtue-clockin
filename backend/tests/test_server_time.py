from datetime import UTC, datetime
import csv
import io

from conftest import sign_in
from test_api import configure
from conftest import recorded_day


def test_clock_and_punches_use_server_time_and_reject_client_timestamps(client, users, monkeypatch):
    assert client.get("/api/v1/time").status_code == 401
    configure(client, users)
    instant = datetime(2026, 10, 11, 8, 15, tzinfo=UTC)
    monkeypatch.setattr("app.workforce.now", lambda: instant)
    monkeypatch.setattr("app.attendance.now", lambda: instant)
    sign_in(client, "alice")
    clock = client.get("/api/v1/time")
    assert clock.status_code == 200
    assert datetime.fromisoformat(clock.json()["instant"]) == instant
    assert clock.json()["timezone"] == "UTC"
    assert clock.headers["cache-control"] == "no-store"
    body = {
        "location": {"latitude": 0, "longitude": 0, "accuracy_m": 5},
        "idempotency_key": "server-clock-test-punch",
    }
    forged = {**body, "punch_in": "2036-01-01T00:00:00Z"}
    assert client.post("/api/v1/attendance/punch-in", json=forged).status_code == 422
    punched = client.post("/api/v1/attendance/punch-in", json=body)
    assert punched.status_code == 200
    assert datetime.fromisoformat(punched.json()["punch_in"]) == instant
    assert punched.json()["local_date"] == "2026-10-11"
    assert not punched.json()["late"]
    sign_in(client)
    export = client.get(
        "/api/v1/reports/attendance.csv",
        params={"start": "2026-10-11", "end": "2026-10-11", "employee_id": users["alice"]},
    )
    row = next(csv.DictReader(io.StringIO(export.text)))
    assert row["Date"] == "11-Oct-2026"
    assert row["Punch In"] == "11-Oct-2026 08:15 AM +0000"


def test_csv_uses_display_durations_and_omits_corrected_and_source(client, users, database):
    configure(client, users)
    start = datetime(2026, 10, 11, 9, tzinfo=UTC)
    recorded_day(database, users["alice"], start, start.replace(hour=16, minute=36))
    response = client.get(
        "/api/v1/reports/attendance.csv",
        params={"start": "2026-10-11", "end": "2026-10-11", "employee_id": users["alice"]},
    )
    assert response.status_code == 200
    reader = csv.DictReader(io.StringIO(response.text))
    assert reader.fieldnames == [
        "Employee ID",
        "Name",
        "Email",
        "Date",
        "Shift",
        "Punch In",
        "Punch Out",
        "Status",
        "Net Hours",
        "Expected Hours",
        "Late",
    ]
    row = next(reader)
    assert row["Net Hours"] == "7h 36min"
    assert row["Expected Hours"] == "8h 0min"
