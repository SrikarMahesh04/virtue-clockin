import secrets
from datetime import date, datetime, timedelta
from email.message import EmailMessage
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.email_delivery import EmailDeliveryError, deliver_email
from app.operational_logs import record_change
from app.domain import EXPECTED_DEDUCTION_MINUTES, GRACE_MINUTES, calculate, utc
from app.models import (
    Assignment,
    AttendanceDay,
    CalendarEntry,
    Challenge,
    LateFlag,
    Notification,
    Organization,
    Shift,
    TimeOff,
    User,
    now,
)
from app.schemas import AttendanceView
from app.security import digest, lock, locked_user


def log_event(
    db: Session,
    actor: User | None,
    action: str,
    target: str,
    reason: str = "",
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    request: Request | None = None,
) -> None:
    # Record only identifiers after a successful transaction, never submitted values.
    record_change(
        db,
        {
            "event": action,
            "actor_id": actor.id if actor else None,
            "target_id": target,
            "request_id": getattr(request.state, "request_id", "operator")
            if request
            else "operator",
        },
    )


def notify(db: Session, user_id: str, kind: str, message: str) -> None:
    db.add(Notification(user_id=user_id, kind=kind, message=message))


def organization(db: Session) -> Organization:
    org = db.scalar(select(Organization))
    if not org:
        raise HTTPException(
            503, "CONFIGURATION_REQUIRED: Configure the organization and office first"
        )
    return org


def shift_on(db: Session, user_id: str, day: date) -> Shift | None:
    assignment = db.scalar(
        select(Assignment).where(
            Assignment.user_id == user_id,
            Assignment.valid_from <= day,
            (Assignment.valid_to.is_(None)) | (Assignment.valid_to >= day),
        )
    )
    shift = db.get(Shift, assignment.shift_id) if assignment else None
    return shift if shift and shift.active and not shift.deleted else None


def calendar_entry_on(db: Session, user_id: str, day: date) -> CalendarEntry | None:
    entries = db.scalars(
        select(CalendarEntry).where(
            CalendarEntry.date == day,
            (CalendarEntry.user_id.is_(None)) | (CalendarEntry.user_id == user_id),
        )
    ).all()
    return next((entry for entry in entries if entry.user_id == user_id), next(iter(entries), None))


def snapshot(db: Session, user_id: str, day: date, org: Organization) -> dict[str, Any]:
    shift = shift_on(db, user_id, day)
    if not shift:
        raise HTTPException(409, "SHIFT_REQUIRED: No shift is assigned for this date")
    zone = ZoneInfo(org.timezone)
    start = datetime.combine(day, shift.starts_at, zone)
    end = datetime.combine(day, shift.ends_at, zone)
    special = calendar_entry_on(db, user_id, day)
    working = (
        special.kind != "holiday"
        if special
        else day.weekday() not in org.policy.get("weekly_off", [5, 6])
    )
    return {
        "shift_id": shift.id,
        "shift_name": shift.name,
        "timezone": org.timezone,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "calculation_version": 3,
        "expected_deduction_minutes": EXPECTED_DEDUCTION_MINUTES,
        "grace_minutes": GRACE_MINUTES,
        "working": working,
        "calendar_kind": special.kind if special else None,
        "office_policy": org.policy,
    }


def recalculate(
    db: Session, day: AttendanceDay, actor: User | None = None, *, update_monthly_flag: bool = True
) -> None:
    policy = day.snapshot
    shift = (datetime.fromisoformat(policy["start"]), datetime.fromisoformat(policy["end"]))
    # Retain the calculation basis of records created before the policy change.
    historical_exclusions = []
    if "lunch_start" in policy and "lunch_end" in policy:
        historical_exclusions = [
            (
                datetime.fromisoformat(policy["lunch_start"]),
                datetime.fromisoformat(policy["lunch_end"]),
            )
        ]
    approved = db.scalars(
        select(TimeOff).where(
            TimeOff.user_id == day.user_id,
            TimeOff.status == "approved",
            TimeOff.kind != "correction",
            TimeOff.starts_at < shift[1],
            TimeOff.ends_at > shift[0],
        )
    ).all()
    if not day.punch_in:
        return
    previous = {
        "status": day.status,
        "late": day.late,
        "net_minutes": day.net_minutes,
        "expected_minutes": day.expected_minutes,
    }
    result = calculate(
        shift,
        day.punch_in,
        day.punch_out,
        [(utc(r.starts_at), utc(r.ends_at)) for r in approved],
        historical_exclusions=historical_exclusions,
    )
    day.snapshot = {
        **policy,
        "calculation_version": 3,
        "expected_deduction_minutes": EXPECTED_DEDUCTION_MINUTES,
    }
    day.net_minutes = int(result["net_minutes"])
    day.expected_minutes = int(result["expected_minutes"]) if policy["working"] else 0
    day.late = bool(result["late"]) if policy["working"] else False
    day.status = str(result["status"]) if policy["working"] else "special_work"
    changed = {
        "status": day.status,
        "late": day.late,
        "net_minutes": day.net_minutes,
        "expected_minutes": day.expected_minutes,
    }
    if previous != changed:
        log_event(db, actor, "attendance.recalculated", day.id, before=previous, after=changed)
    db.flush()
    if update_monthly_flag:
        update_flag(db, day.user_id, day.local_date, actor)


def apply_working_hours_policy(db: Session, reason: str) -> int:
    """Update expected hours once; retain punches, actual hours and late flags."""
    changed = 0
    for user_id in db.scalars(select(User.id).order_by(User.id)):
        locked_user(db, user_id)
        for day in db.scalars(
            select(AttendanceDay).where(AttendanceDay.user_id == user_id).with_for_update()
        ):
            if day.snapshot.get("expected_deduction_minutes") == EXPECTED_DEDUCTION_MINUTES:
                continue
            before = day.expected_minutes
            shift = (
                datetime.fromisoformat(day.snapshot["start"]),
                datetime.fromisoformat(day.snapshot["end"]),
            )
            approved = db.scalars(
                select(TimeOff).where(
                    TimeOff.user_id == user_id,
                    TimeOff.status == "approved",
                    TimeOff.kind != "correction",
                    TimeOff.starts_at < shift[1],
                    TimeOff.ends_at > shift[0],
                )
            ).all()
            expected = calculate(
                shift,
                day.punch_in or shift[0],
                day.punch_out,
                [(utc(item.starts_at), utc(item.ends_at)) for item in approved],
            )["expected_minutes"]
            day.expected_minutes = int(expected) if day.snapshot["working"] else 0
            day.snapshot = {
                **day.snapshot,
                "calculation_version": 3,
                "expected_deduction_minutes": EXPECTED_DEDUCTION_MINUTES,
                "previous_expected_minutes": before,
            }
            log_event(
                db,
                None,
                "attendance.expected_hours.updated",
                day.id,
                reason,
                {"expected_minutes": before},
                {"expected_minutes": day.expected_minutes},
            )
            changed += 1
    return changed


def apply_grace_policy(db: Session, reason: str) -> int:
    """Apply the current global grace period to saved days without changing punches."""
    changed = 0
    for user_id in db.scalars(select(User.id).order_by(User.id)):
        locked_user(db, user_id)
        months = {}
        days = db.scalars(
            select(AttendanceDay).where(AttendanceDay.user_id == user_id).with_for_update()
        ).all()
        for day in days:
            if not day.punch_in or day.snapshot.get("grace_minutes") == GRACE_MINUTES:
                continue
            before = {
                "grace_minutes": day.snapshot.get("grace_minutes", 10),
                "late": day.late,
            }
            recalculate(db, day, update_monthly_flag=False)
            day.snapshot = {**day.snapshot, "grace_minutes": GRACE_MINUTES}
            log_event(
                db,
                None,
                "attendance.grace_policy.updated",
                day.id,
                reason,
                before,
                {"grace_minutes": GRACE_MINUTES, "late": day.late},
            )
            months[day.local_date.strftime("%Y-%m")] = day.local_date
            changed += 1
        db.flush()
        for day_date in months.values():
            update_flag(db, user_id, day_date, None)
    return changed


def update_flag(db: Session, user_id: str, day: date, actor: User | None) -> None:
    lock(db, "late:" + user_id)
    month = day.strftime("%Y-%m")
    month_start = day.replace(day=1)
    next_month = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
    late_days = db.scalars(
        select(AttendanceDay).where(
            AttendanceDay.user_id == user_id,
            AttendanceDay.local_date >= month_start,
            AttendanceDay.local_date < next_month,
            AttendanceDay.late.is_(True),
        )
    ).all()
    count = sum(
        entry is None or entry.kind == "optional_holiday"
        for saved in late_days
        for entry in [calendar_entry_on(db, user_id, saved.local_date)]
    )
    flag = db.scalar(select(LateFlag).where(LateFlag.user_id == user_id, LateFlag.month == month))
    state = "flagged" if count >= 6 else "warning" if count == 5 else "resolved"
    old_state = flag.state if flag else None
    if not flag and count >= 5:
        flag = LateFlag(user_id=user_id, month=month, count=count, state=state)
        db.add(flag)
    elif flag:
        flag.count, flag.state = count, state
    if flag and state != old_state:
        message = f"{month}: {count} unexcused late arrivals. Status: {state}."
        notify(db, user_id, "late_arrival", message)
        if state in ("flagged", "warning"):
            for reviewer in db.scalars(
                select(User).where(User.active.is_(True), User.role != "employee")
            ):
                notify(db, reviewer.id, "late_arrival", message + f" Employee: {user_id}")
        log_event(
            db,
            actor,
            "late_flag.changed",
            user_id,
            before={"state": old_state},
            after={"state": state, "count": count},
        )


def challenge(db: Session, user: User, purpose: str) -> str:
    # Serialize issuance and invalidate earlier unused links for the same purpose.
    lock(db, "challenge:" + user.id)
    for previous in db.scalars(
        select(Challenge).where(
            Challenge.user_id == user.id,
            Challenge.purpose == purpose,
            Challenge.used_at.is_(None),
        )
    ):
        previous.used_at = now()
    token = secrets.token_urlsafe(32)
    db.add(
        Challenge(
            id=digest(token),
            user_id=user.id,
            purpose=purpose,
            expires_at=now() + timedelta(minutes=30),
        )
    )
    return token


def send_link(email: str, token: str, purpose: str) -> None:
    config = settings()
    if not config.email_configured:
        raise HTTPException(
            503,
            "INTEGRATION_NOT_CONFIGURED: Email delivery is not configured. Contact the operator.",
        )
    path = "activate" if purpose == "activation" else "reset-password"
    message = EmailMessage()
    message["From"], message["To"] = config.email_sender, email
    message["Subject"] = "Virtue ClockIn account " + purpose
    message.set_content(
        f"Open this single-use link within 30 minutes:\n{config.app_base_url}/{path}#token={token}\nIf you did not request this, contact your administrator."
    )
    try:
        deliver_email(message, config)
    except EmailDeliveryError:
        raise HTTPException(
            503, "DEPENDENCY_UNAVAILABLE: Email delivery failed. Try again later."
        ) from None


def attendance_json(day: AttendanceDay) -> dict[str, Any]:
    return AttendanceView.model_validate(day).model_dump(mode="json")


def daily_records(
    db: Session,
    start: date,
    end: date,
    user_id: str | None = None,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
    *,
    include_weekly_off: bool = False,
) -> list[AttendanceView]:
    """Read-only policy projections. Never fabricate punches or persist synthetic events."""
    from collections import defaultdict
    from uuid import NAMESPACE_URL, uuid5

    if end < start or (end - start).days > 366:
        raise HTTPException(422, "INVALID_RANGE: Choose an ordered range of at most one year")
    org = organization(db)
    zone = ZoneInfo(org.timezone)
    query = select(User).where(User.role == "employee")
    if user_id:
        query = query.where(User.id == user_id)
    users = db.scalars(query).all()
    if len(users) * ((end - start).days + 1) > 50000:
        raise HTTPException(422, "REPORT_TOO_LARGE: Narrow the employee or date filters")
    ids = [user.id for user in users]
    persisted = db.scalars(
        select(AttendanceDay).where(
            AttendanceDay.user_id.in_(ids),
            AttendanceDay.local_date >= start,
            AttendanceDay.local_date <= end,
        )
    ).all()
    actual = {(d.user_id, d.local_date): AttendanceView.model_validate(d) for d in persisted}
    assignments: dict[str, list[Assignment]] = defaultdict(list)
    for assignment in db.scalars(
        select(Assignment).where(
            Assignment.user_id.in_(ids),
            Assignment.valid_from <= end,
            (Assignment.valid_to.is_(None)) | (Assignment.valid_to >= start),
        )
    ):
        assignments[assignment.user_id].append(assignment)
    shifts = {s.id: s for s in db.scalars(select(Shift))}
    overrides = {
        (d.date, d.user_id): d
        for d in db.scalars(
            select(CalendarEntry).where(CalendarEntry.date >= start, CalendarEntry.date <= end)
        )
    }
    requests: dict[str, list[TimeOff]] = defaultdict(list)
    for item in db.scalars(
        select(TimeOff).where(
            TimeOff.user_id.in_(ids), TimeOff.status == "approved", TimeOff.kind != "correction"
        )
    ):
        requests[item.user_id].append(item)
    rows = []
    for saved in actual.values():
        entry = overrides.get((saved.local_date, saved.user_id)) or overrides.get(
            (saved.local_date, None)
        )
        if entry and entry.kind != "optional_holiday":
            saved = saved.model_copy(
                update={
                    "status": entry.kind,
                    "late": False,
                    "expected_minutes": 0 if entry.kind == "holiday" else saved.expected_minutes,
                    "snapshot": {
                        **saved.snapshot,
                        "calendar_kind": entry.kind,
                        "calendar_override": True,
                    },
                }
            )
        rows.append(saved)
    instant = now()
    for employee in users:
        if not employee.active:
            continue  # Without access-history data, do not infer absence for inactive accounts.
        for index in range((end - start).days + 1):
            day = start + timedelta(days=index)
            if (employee.id, day) in actual or day < utc(employee.created_at).astimezone(
                zone
            ).date():
                continue
            effective_assignment = next(
                (
                    a
                    for a in assignments[employee.id]
                    if a.valid_from <= day and (not a.valid_to or day <= a.valid_to)
                ),
                None,
            )
            shift = shifts.get(effective_assignment.shift_id) if effective_assignment else None
            holiday = overrides.get((day, employee.id)) or overrides.get((day, None))
            if not shift and (not holiday or holiday.kind == "optional_holiday"):
                continue
            work_start, work_end = (
                datetime.combine(day, shift.starts_at if shift else datetime.min.time(), zone),
                datetime.combine(day, shift.ends_at if shift else datetime.min.time(), zone),
            )
            working = (
                holiday.kind != "holiday"
                if holiday
                else day.weekday() not in org.policy.get("weekly_off", [5, 6])
            )
            approved = [(utc(r.starts_at), utc(r.ends_at)) for r in requests[employee.id]]
            calculation = calculate((work_start, work_end), work_start, work_end, approved)
            expected = int(calculation["expected_minutes"]) if working else 0
            classification = (
                "work_from_home"
                if holiday and holiday.kind == "work_from_home"
                else ("holiday" if holiday else "weekly_off")
                if not working
                else (
                    "approved_leave"
                    if calculation["status"] == "leave_conflict"
                    else "absent"
                    if instant > utc(work_end)
                    else "scheduled"
                    if instant < utc(work_start)
                    else "not_started"
                )
            )
            rows.append(
                AttendanceView(
                    id=str(uuid5(NAMESPACE_URL, f"clockin:projection:{employee.id}:{day}")),
                    user_id=employee.id,
                    local_date=day,
                    punch_in=None,
                    punch_out=None,
                    net_minutes=0,
                    expected_minutes=expected,
                    status=classification,
                    late=False,
                    corrected=False,
                    snapshot={
                        "derived": True,
                        "timezone": org.timezone,
                        "shift_name": shift.name if shift else "Not assigned",
                        "shift_id": shift.id if shift else None,
                        "working": working,
                        "calendar_kind": holiday.kind if holiday else None,
                        "start": work_start.isoformat(),
                        "end": work_end.isoformat(),
                    },
                )
            )
    rows = [
        row
        for row in rows
        if (include_weekly_off or row.status != "weekly_off")
        and (not status or row.status == status)
    ]
    rows.sort(key=lambda row: (row.local_date, row.id), reverse=True)
    return rows[offset : offset + limit]
