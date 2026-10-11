from concurrent.futures import ThreadPoolExecutor

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.main import app
from app.models import EmployeeIdCounter, User
from conftest import sign_in


def hire(client, email, doj="2026-10-11", **overrides):
    return client.post(
        "/api/v1/employees",
        json={
            "name": "New hire",
            "email": email,
            "date_of_joining": doj,
            **overrides,
        },
    )


def test_joining_month_sequences_and_stable_existing_ids(client, users):
    sign_in(client)
    first = hire(client, "first@example.com")
    assert first.status_code == 201, first.text
    first = first.json()
    assert first["employee_code"] == "2610-001"
    assert first["date_of_joining"] == "2026-10-11"
    assert hire(client, "second@example.com").json()["employee_code"] == "2610-002"
    assert hire(client, "nov@example.com", "2026-11-02").json()["employee_code"] == "2611-001"
    assert hire(client, "jan@example.com", "2027-01-01").json()["employee_code"] == "2701-001"
    changed = client.put(
        "/api/v1/employees/" + first["id"],
        json={
            "name": "Updated hire",
            "email": first["email"],
            "date_of_joining": "2026-10-12",
            "active": False,
        },
    )
    assert changed.status_code == 200 and changed.json()["employee_code"] == "2610-001"
    assert hire(client, "third@example.com", "2026-10-01").json()["employee_code"] == "2610-003"
    assert hire(client, "manual@example.com", employee_code="CUSTOM").status_code == 422
    assert hire(client, "missing@example.com", None).status_code == 422
    assert hire(client, "hr@example.com", None, role="hr_admin").status_code == 422


def test_admins_have_no_id_or_joining_date_and_role_changes_do_not_reuse_ids(
    client, users, database
):
    sign_in(client)
    response = hire(client, "admin2@example.com", None, role="super_admin")
    assert response.status_code == 201, response.text
    assert response.json()["employee_code"] is None and response.json()["date_of_joining"] is None
    assert hire(client, "badadmin@example.com", role="super_admin").status_code == 422
    created = hire(client, "promoted@example.com").json()
    changed = client.put(
        "/api/v1/employees/" + created["id"],
        json={
            "name": created["name"],
            "email": created["email"],
            "role": "super_admin",
        },
    )
    assert changed.status_code == 200 and changed.json()["employee_code"] is None
    assert hire(client, "next@example.com").json()["employee_code"] == "2610-002"
    with Session(database) as db:
        assert db.get(User, users["admin"]).employee_code is None


def test_concurrent_hires_get_unique_sequential_ids(client, users):
    sign_in(client)
    cookies, headers = dict(client.cookies), dict(client.headers)

    def create(index):
        with TestClient(app, client=("127.0.0.1", 50000)) as other:
            other.cookies.update(cookies)
            other.headers.update(headers)
            return hire(other, f"hire{index}@example.com")

    with ThreadPoolExecutor(max_workers=6) as pool:
        responses = list(pool.map(create, range(6)))
    assert all(response.status_code == 201 for response in responses)
    assert {response.json()["employee_code"] for response in responses} == {
        f"2610-{number:03d}" for number in range(1, 7)
    }


def test_existing_ids_reserved_and_three_digit_limit_is_explicit(client, users, database):
    sign_in(client)
    with Session(database) as db:
        db.get(User, users["alice"]).employee_code = "2610-012"
        db.add(EmployeeIdCounter(month="2611", last_number=999))
        db.commit()
    assert hire(client, "next@example.com").json()["employee_code"] == "2610-013"
    response = hire(client, "full@example.com", "2026-11-01")
    assert response.status_code == 409 and response.json()["error"]["code"] == "EMPLOYEE_ID_LIMIT"
    assert hire(client, "dec@example.com", "2026-12-01").json()["employee_code"] == "2612-001"


def test_migration_preserves_employees_without_inventing_joining_dates(database):
    config = Config("alembic.ini")
    with database.begin() as connection:
        config.attributes["connection"] = connection
        command.downgrade(config, "0005")
        connection.execute(
            text("""INSERT INTO users
            (id,email,name,employee_code,role,active,pin_failures,created_at)
            VALUES ('old-admin','oldadmin@example.com','Admin','2610-010','super_admin',true,0,now()),
            ('old-employee','oldemployee@example.com','Employee','LEGACY','employee',true,0,now())""")
        )
        command.upgrade(config, "head")
        assert (
            connection.execute(
                text("SELECT employee_code FROM users WHERE id='old-admin'")
            ).scalar_one()
            is None
        )
        assert (
            connection.execute(
                text("SELECT employee_code FROM users WHERE id='old-employee'")
            ).scalar_one()
            == "LEGACY"
        )
        assert (
            connection.execute(
                text("SELECT count(*) FROM users WHERE date_of_joining IS NOT NULL")
            ).scalar_one()
            == 0
        )
        assert (
            connection.execute(
                text("SELECT last_number FROM employee_id_counters WHERE month='2610'")
            ).scalar_one()
            == 10
        )
