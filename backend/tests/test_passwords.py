import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import cli
from app.models import User
from app.passwords import password_strength
from app.security import hasher
from app.services import challenge
from conftest import sign_in


@pytest.mark.parametrize(
    "password, strength",
    [
        ("a", "Weak"),
        ("password123", "Weak"),
        ("a" * 24, "Weak"),
        ("abcdefghij", "Medium"),
        ("ClockIn!2026secure", "Strong"),
    ],
)
def test_advisory_strength(password, strength):
    assert password_strength(password) == strength


def test_bootstrap_accepts_weak_password(database, monkeypatch, capsys):
    monkeypatch.setattr(cli, "engine", lambda: database)
    monkeypatch.setattr(
        "sys.argv",
        [
            "cli",
            "bootstrap",
            "--email",
            "setup@example.com",
            "--name",
            "Setup",
        ],
    )
    answers = iter(["a", "a", "000001", "000001"])
    prompts = []

    def answer(prompt):
        prompts.append(prompt)
        return next(answers)

    monkeypatch.setattr(cli.getpass, "getpass", answer)
    cli.main()
    assert "Password strength: Weak (advisory)" in capsys.readouterr().out
    assert prompts[0] == "New administrator password: "
    with Session(database) as db:
        user = db.scalar(select(User))
        assert hasher.verify(user.password_hash, "a")
        assert user.employee_code is None and user.date_of_joining is None


@pytest.mark.parametrize(
    "purpose, endpoint",
    [
        ("activation", "/api/v1/auth/activate"),
        ("recovery", "/api/v1/auth/recovery/complete"),
    ],
)
def test_credentials_accept_short_password(client, users, database, purpose, endpoint):
    with Session(database) as db:
        user = db.get(User, users["alice"])
        if purpose == "activation":
            user.password_hash = None
            user.pin_hash = None
        token = challenge(db, user, purpose)
        db.commit()
    payload = {"token": token, "password": "", "pin": "000001"}
    assert client.post(endpoint, json=payload).status_code == 422
    payload["password"] = "a"
    response = client.post(endpoint, json=payload)
    assert response.status_code == 200, response.text
    sign_in(client, "alice", secret="a")
