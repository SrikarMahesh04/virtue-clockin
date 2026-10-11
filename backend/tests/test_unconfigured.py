from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.db import engine


def test_liveness_does_not_claim_readiness(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "")
    settings.cache_clear()
    engine.cache_clear()
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        assert client.get("/ready").status_code == 503
        assert (
            client.get("/api/v1/auth/session").json()["error"]["code"] == "CONFIGURATION_REQUIRED"
        )
    settings.cache_clear()
    engine.cache_clear()
