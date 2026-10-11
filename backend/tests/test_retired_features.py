import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditEvent, Note
from app.operational_logs import file_handler, logger
from conftest import sign_in
from test_api import configure


def test_notes_and_audit_endpoints_are_absent(client, users, database):
    configure(client, users)
    for who in ("admin", "alice"):
        sign_in(client, who)
        for method, path in (
            ("GET", "/api/v1/notes"),
            ("POST", "/api/v1/notes"),
            ("PUT", "/api/v1/notes/retired"),
            ("DELETE", "/api/v1/notes/retired"),
            ("GET", "/api/v1/audit-events"),
        ):
            assert client.request(method, path, json={}).status_code == 404
        assert "notes_count" not in client.get("/api/v1/me/dashboard").json()
        calendar = client.get("/api/v1/me/calendar?start=2026-10-01&end=2026-10-31")
        assert calendar.status_code == (403 if who == "admin" else 200)
        assert "notes" not in calendar.json()
    paths = client.get("/openapi.json").json()["paths"]
    assert not any("notes" in path or "audit-events" in path for path in paths)
    with Session(database) as db:
        assert db.scalar(select(Note)) is None
        assert db.scalar(select(AuditEvent)) is None


def test_internal_file_logs_safe_requests_and_committed_changes(
    client, users, database, tmp_path: Path
):
    path = tmp_path / "clockin.log"
    handler = file_handler(path)
    logger.addHandler(handler)
    try:
        configure(client, users)
        response = client.get("/health?token=never-log-this-secret")
        client.get("/never-log-this-secret")
        with Session(database) as db:
            from app.services import log_event

            db.begin()
            log_event(db, None, "rollback.must_not_log", "test")
            db.rollback()
        handler.flush()
        raw = path.read_text(encoding="utf-8")
        records = [json.loads(line) for line in raw.splitlines()]
        assert "never-log-this-secret" not in raw
        assert "test-password" not in raw
        assert "rollback.must_not_log" not in raw
        assert any(item["event"] == "settings.changed" for item in records)
        request = next(
            item for item in records if item.get("request_id") == response.headers["X-Request-ID"]
        )
        assert request["route"] == "/health" and request["status"] == 200
        assert request["timestamp"].endswith("+00:00")
        assert handler.maxBytes == 5_000_000 and handler.backupCount == 3
    finally:
        logger.removeHandler(handler)
        handler.close()
