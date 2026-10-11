"""Operator import of the user-supplied Virtue India Holiday List 2026.

Dates are transcribed from the PDF, including its moon-dependent dates.
Ugadi appears in both lists; the user confirmed office-holiday precedence.
"""

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import CalendarEntry, User
from app.security import lock
from app.services import log_event, update_flag

HOLIDAYS_2026 = (
    ("2026-01-01", "New Year's Day", "holiday"),
    ("2026-01-15", "Sankranti / Pongal", "holiday"),
    ("2026-01-26", "Republic Day", "holiday"),
    ("2026-03-03", "Hol", "optional_holiday"),
    ("2026-03-20", "Ugadi", "holiday"),
    ("2026-03-27", "Sri Rama Navami", "optional_holiday"),
    ("2026-04-03", "Good Friday", "optional_holiday"),
    ("2026-04-21", "Id-ul-Fitr (Ramzan) - subject to the moon", "optional_holiday"),
    ("2026-05-01", "May Day", "holiday"),
    ("2026-08-19", "Muharram - subject to the moon", "optional_holiday"),
    ("2026-09-14", "Ganesh Chaturthi", "holiday"),
    ("2026-10-02", "Mahatma Gandhi Jayanti", "holiday"),
    ("2026-10-21", "Vijaya Dashami / Dussehra", "holiday"),
    ("2026-12-25", "Christmas", "holiday"),
)


def import_2026(db: Session) -> int:
    """Idempotently import All-employee dates without overwriting other entries."""
    changed = []
    for value, name, kind in HOLIDAYS_2026:
        day = date.fromisoformat(value)
        lock(db, "calendar:" + value)
        existing = db.scalar(
            select(CalendarEntry).where(CalendarEntry.date == day, CalendarEntry.user_id.is_(None))
        )
        if existing:
            if (existing.name, existing.kind) != (name, kind):
                raise ValueError(
                    f"Existing All-employees entry conflicts on {value}; resolve it before import"
                )
            continue
        item = CalendarEntry(date=day, name=name, kind=kind)
        db.add(item)
        db.flush()
        log_event(db, None, "operator.calendar_import", item.id)
        changed.append(day)
    for user in db.scalars(select(User).where(User.role == "employee")):
        for day in changed:
            update_flag(db, user.id, day, None)
    return len(changed)
