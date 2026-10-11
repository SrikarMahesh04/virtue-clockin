"""Explicit local operator reset; never exposed as a web endpoint."""

from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session

from app.models import (
    Assignment,
    AttendanceDay,
    AttendanceEvent,
    AuditEvent,
    AuthSession,
    CalendarEntry,
    Challenge,
    LateFlag,
    Note,
    Notification,
    RateLimit,
    TimeOff,
    User,
)
from app.security import lock
from app.services import challenge, log_event


def replace_accounts(db: Session, email: str, name: str, reason: str) -> tuple[User, str, int]:
    """Replace accounts and their dependent records atomically; caller commits."""
    if not name.strip() or len(name) > 160 or len(reason.strip()) < 3:
        raise ValueError("A valid name and reset reason are required")
    lock(db, "bootstrap")
    # Stop account writes while replacing users and all referencing rows.
    db.execute(text("LOCK TABLE users IN ACCESS EXCLUSIVE MODE"))
    count = db.scalar(select(func.count()).select_from(User)) or 0
    # Immutable legacy records may only be removed in this explicit operator reset.
    for table in ("attendance_events", "audit_events"):
        db.execute(text(f"ALTER TABLE {table} DISABLE TRIGGER immutable_{table}"))
    for model in (
        AuthSession,
        Challenge,
        Notification,
        LateFlag,
        Note,
        TimeOff,
        Assignment,
        AttendanceEvent,
        AttendanceDay,
        AuditEvent,
        RateLimit,
    ):
        db.execute(delete(model))
    db.execute(delete(CalendarEntry).where(CalendarEntry.user_id.is_not(None)))
    db.execute(delete(User))
    for table in ("attendance_events", "audit_events"):
        db.execute(text(f"ALTER TABLE {table} ENABLE TRIGGER immutable_{table}"))
    # Keep office settings, shift definitions, global calendar and reserved ID counters.
    user = User(email=email.lower(), name=name.strip(), role="super_admin", active=True)
    db.add(user)
    db.flush()
    token = challenge(db, user, "activation")
    log_event(db, user, "operator.accounts_replaced", user.id, reason=reason)
    return user, token, count
