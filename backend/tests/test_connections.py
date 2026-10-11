import pytest

from app.core.config import Settings
from conftest import sign_in


@pytest.mark.parametrize("origin", ["http://localhost:3000", "http://127.0.0.1:3000"])
def test_local_preflight_session_and_csrf(client, users, origin):
    client.headers["Origin"] = origin
    preflight = client.options(
        "/api/v1/auth/login",
        headers={
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-csrf-token",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == origin
    assert preflight.headers["access-control-allow-credentials"] == "true"
    sign_in(client)
    assert client.get("/api/v1/auth/session").status_code == 200
    assert client.post("/api/v1/auth/logout").status_code == 200
    assert client.get("/api/v1/auth/session").status_code == 401


@pytest.mark.parametrize(
    "origin", ["http://127.0.0.1:3001", "http://localhost.evil:3000", "https://evil.example"]
)
def test_untrusted_preflight_and_login_rejected(client, origin):
    client.headers["Origin"] = origin
    response = client.options(
        "/api/v1/auth/login", headers={"Access-Control-Request-Method": "POST"}
    )
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers
    response = client.post(
        "/api/v1/auth/login", json={"email": "unknown@example.com", "secret": "x"}
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "CSRF_REJECTED"


def test_local_alias_policy_is_limited_to_development_and_test():
    for environment in ("development", "test"):
        value = Settings(
            _env_file=None, app_env=environment, frontend_origin="http://127.0.0.1:3456"
        )
        assert {
            "http://127.0.0.1:3456",
            "http://localhost:3456",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        } <= set(value.allowed_frontend_origins)
    for environment in ("production", "staging"):
        value = Settings(
            _env_file=None, app_env=environment, frontend_origin="http://localhost:3000"
        )
        assert value.allowed_frontend_origins == ["http://localhost:3000"]
    value = Settings(
        _env_file=None, app_env="production", frontend_origin="https://clockin.example.com"
    )
    assert value.allowed_frontend_origins == ["https://clockin.example.com"]


def test_lan_origins_are_explicit_and_only_enabled_for_development():
    value = Settings(
        _env_file=None,
        frontend_additional_origins="http://192.168.88.8:3000, https://clockin.local:3000",
    )
    assert "http://192.168.88.8:3000" in value.allowed_frontend_origins
    assert "http://192.168.88.9:3000" not in value.allowed_frontend_origins
    assert "https://clockin.local:3000" in value.allowed_frontend_origins
    value = Settings(
        _env_file=None,
        app_env="production",
        frontend_origin="https://clockin.example.com",
        frontend_additional_origins="http://192.168.88.8:3000",
    )
    assert value.allowed_frontend_origins == ["https://clockin.example.com"]
