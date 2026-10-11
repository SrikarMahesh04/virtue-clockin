"""Internal JSON logs; no application API or database audit collection."""

import json
import logging
from datetime import UTC, datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any

from sqlalchemy import event
from sqlalchemy.orm import Session

from app.core.config import settings


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps(
            {
                "timestamp": datetime.fromtimestamp(record.created, UTC).isoformat(),
                "level": record.levelname,
                **getattr(record, "fields", {"event": record.getMessage()}),
            }
        )


def file_handler(path: Path) -> RotatingFileHandler:
    path.parent.mkdir(parents=True, exist_ok=True)
    handler = RotatingFileHandler(
        path, maxBytes=5_000_000, backupCount=3, encoding="utf-8", delay=True
    )
    handler.setFormatter(JsonFormatter())
    return handler


logger = logging.getLogger("clockin")
logger.setLevel(logging.INFO)
logger.propagate = False
if not logger.handlers:
    logger.addHandler(
        logging.NullHandler()
        if settings().app_env == "test"
        else file_handler(Path(__file__).resolve().parents[1] / "logs" / "clockin.log")
    )


def write_event(event_name: str, **fields: Any) -> None:
    logger.info(event_name, extra={"fields": {"event": event_name, **fields}})


def record_change(db: Session, fields: dict[str, Any]) -> None:
    db.info.setdefault("operational_events", []).append(fields)


@event.listens_for(Session, "after_commit")
def committed(db: Session) -> None:
    for fields in db.info.pop("operational_events", []):
        logger.info(fields["event"], extra={"fields": fields})


@event.listens_for(Session, "after_rollback")
def rolled_back(db: Session) -> None:
    db.info.pop("operational_events", None)
