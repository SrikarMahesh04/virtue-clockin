from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import (
    Assignment,
    CalendarEntry,
    Notification,
    Shift,
    User,
)
from app.schemas import (
    CalendarData,
    Message,
    NotificationView,
)
from app.security import current_user, employee_only
from app.services import daily_records, organization

router = APIRouter(prefix="/api/v1", tags=["workflows"])


@router.get("/notifications", response_model=list[NotificationView])
def notifications(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(500)
    ).all()


@router.post("/notifications/{notification_id}/read", response_model=Message)
def read_notification(
    notification_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    item = db.scalar(
        select(Notification).where(
            Notification.id == notification_id, Notification.user_id == user.id
        )
    )
    if not item:
        raise HTTPException(404, "NOT_FOUND: Notification not found")
    item.read = True
    db.commit()
    return {"message": "Notification marked read"}


@router.get("/me/calendar", response_model=CalendarData)
def calendar(
    start: date, end: date, user: User = Depends(employee_only), db: Session = Depends(get_db)
):
    if end < start or end - start > timedelta(days=366):
        raise HTTPException(422, "INVALID_RANGE: Choose an ordered range of at most one year")
    org = organization(db)
    return {
        "timezone": org.timezone,
        "weekly_off": org.policy.get("weekly_off", [5, 6]),
        "days": db.scalars(
            select(CalendarEntry).where(
                CalendarEntry.date >= start,
                CalendarEntry.date <= end,
                (CalendarEntry.user_id.is_(None)) | (CalendarEntry.user_id == user.id),
            )
        ).all(),
        "assignments": db.scalars(
            select(Assignment).where(
                Assignment.user_id == user.id,
                Assignment.valid_from <= end,
                (Assignment.valid_to.is_(None)) | (Assignment.valid_to >= start),
            )
        ).all(),
        "shifts": db.scalars(
            select(Shift)
            .join(Assignment, Assignment.shift_id == Shift.id)
            .where(Assignment.user_id == user.id)
        )
        .unique()
        .all(),
        "attendance": daily_records(db, start, end, user.id, limit=367, include_weekly_off=True),
    }
