import os
from uuid import uuid4

# Test accounts must never use an operator's real SMTP or secure-cookie settings.
os.environ.update(
    {
        "APP_ENV": "test",
        "SMTP_HOST": "",
        "SMTP_FROM": "",
        "FRONTEND_ORIGIN": "http://localhost:3000",
        "FRONTEND_ADDITIONAL_ORIGINS": "",
        "COOKIE_SECURE": "false",
    }
)

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.db import get_db
from app.main import app
from app.models import User
from app.security import hasher


@pytest.fixture
def database():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL required for real PostgreSQL integration tests")
    if "test" not in url.rsplit("/", 1)[-1]:
        raise RuntimeError("Tests require a dedicated database whose name includes 'test'")
    root_engine = create_engine(url)
    schema = "test_" + uuid4().hex
    with root_engine.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    test_engine = create_engine(url, connect_args={"options": f"-csearch_path={schema}"})
    from alembic import command
    from alembic.config import Config

    config = Config("alembic.ini")
    with test_engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
        command.upgrade(config, "head")
    try:
        yield test_engine
    finally:
        test_engine.dispose()
        with root_engine.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        root_engine.dispose()


@pytest.fixture
def client(database):
    def override():
        with Session(database) as db:
            yield db

    app.dependency_overrides[get_db] = override
    with TestClient(app, base_url="http://testserver", client=("127.0.0.1", 50000)) as client:
        client.headers["Origin"] = "http://localhost:3000"
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def users(database):
    with Session(database) as db:
        for code, role in [("admin", "super_admin"), ("alice", "employee"), ("bob", "employee")]:
            db.add(
                User(
                    name=code.title(),
                    email=f"{code}@example.com",
                    employee_code=code if role == "employee" else None,
                    role=role,
                    password_hash=hasher.hash("test-password-long-enough"),
                    pin_hash=hasher.hash("012345"),
                )
            )
        db.commit()
        return {u.email.split("@")[0]: u.id for u in db.query(User).all()}


def sign_in(client, who="admin", method="password", secret="test-password-long-enough"):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": f"{who}@example.com", "method": method, "secret": secret},
    )
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = response.json()["csrf"]
    return response.json()


def recorded_day(database, user_id, start, end):
    """Persist synthetic attendance only in an isolated test schema."""
    from app.models import AttendanceDay
    from app.services import organization, recalculate, snapshot

    with Session(database) as db:
        day = AttendanceDay(
            user_id=user_id,
            local_date=start.date(),
            punch_in=start,
            punch_out=end,
            snapshot=snapshot(db, user_id, start.date(), organization(db)),
        )
        db.add(day)
        db.flush()
        recalculate(db, day)
        db.commit()
        return day.id
