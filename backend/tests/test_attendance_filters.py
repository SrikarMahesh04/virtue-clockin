from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.main import app
from app.models import Organization, User, now
from conftest import recorded_day, sign_in
from test_api import configure


def test_departments_are_removed_from_public_contract_and_employee_forms(client, users):
    configure(client, users)
    assert client.get("/api/v1/departments").status_code == 404
    assert client.post("/api/v1/departments", json={"name": "Retired"}).status_code == 404
    assert all("department_id" not in user for user in client.get("/api/v1/employees").json())
    payload = {
        "name": "New employee",
        "email": "new@example.com",
        "date_of_joining": "2026-10-11",
        "department_id": "retired",
    }
    assert client.post("/api/v1/employees", json=payload).status_code == 422
    payload.pop("department_id")
    response = client.post("/api/v1/employees", json=payload)
    assert response.status_code == 201
    assert "department_id" not in response.json()
    contract = app.openapi()
    assert not any("department" in path for path in contract["paths"])
    assert not any("Department" in schema for schema in contract["components"]["schemas"])
    for path in (
        "/api/v1/admin/attendance",
        "/api/v1/reports/attendance",
        "/api/v1/reports/attendance.csv",
    ):
        assert not any(
            p["name"] == "department_id" for p in contract["paths"][path]["get"]["parameters"]
        )


def test_weekly_off_records_are_hidden_but_calendar_and_actual_work_are_preserved(
    client, users, database
):
    configure(client, users)
    off_day = (now() - timedelta(days=3)).date()
    work_day = off_day + timedelta(days=1)
    with Session(database) as db:
        org = db.scalar(select(Organization))
        org.policy = {**org.policy, "weekly_off": [off_day.weekday()]}
        employee = db.get(User, users["alice"])
        employee.created_at = now() - timedelta(days=10)
        db.commit()
    dates = {"start": str(off_day), "end": str(work_day)}
    for path in ("/api/v1/admin/attendance", "/api/v1/reports/attendance"):
        rows = client.get(path, params={**dates, "employee_id": users["alice"], "limit": 1}).json()
        assert len(rows) == 1 and rows[0]["local_date"] == str(work_day)
        assert rows[0]["status"] != "weekly_off"
    csv = client.get(
        "/api/v1/reports/attendance.csv", params={**dates, "employee_id": users["alice"]}
    )
    assert csv.status_code == 200 and "weekly_off" not in csv.text
    sign_in(client, "alice")
    assert all(
        row["status"] != "weekly_off"
        for row in client.get("/api/v1/me/attendance", params=dates).json()
    )
    calendar = client.get("/api/v1/me/calendar", params=dates).json()
    assert any(row["status"] == "weekly_off" for row in calendar["attendance"])
    start = datetime.combine(off_day, datetime.min.time(), UTC).replace(hour=8)
    recorded_day(database, users["alice"], start, start + timedelta(hours=9))
    rows = client.get(
        "/api/v1/me/attendance", params={"start": str(off_day), "end": str(off_day)}
    ).json()
    assert len(rows) == 1 and rows[0]["status"] == "special_work"
    assert rows[0]["punch_in"] is not None and rows[0]["net_minutes"] == 540
