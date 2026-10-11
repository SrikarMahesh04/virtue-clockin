import csv
import io
import ipaddress
from datetime import date, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.domain import distance_m, utc
from app.models import AttendanceDay, AttendanceEvent, LateFlag, User, now
from app.schemas import AdminDashboard, AttendanceView, Dashboard, PunchInput
from app.security import admin, client_ip, employee_only, lock, locked_user, throttle
from app.services import (
    log_event,
    daily_records,
    calendar_entry_on,
    notify,
    organization,
    recalculate,
    shift_on,
    snapshot,
)

router = APIRouter(prefix="/api/v1", tags=["attendance"])


@router.get("/me/dashboard", response_model=Dashboard)
def dashboard(user: User = Depends(employee_only), db: Session = Depends(get_db)):
    org = organization(db)
    today = now().astimezone(ZoneInfo(org.timezone)).date()
    day: AttendanceDay | AttendanceView | None = db.scalar(
        select(AttendanceDay).where(
            AttendanceDay.user_id == user.id, AttendanceDay.local_date == today
        )
    )
    start = today.replace(day=1)
    entry = calendar_entry_on(db, user.id, today)
    if entry:
        projected = daily_records(db, today, today, user.id, limit=1, include_weekly_off=True)
        day = projected[0] if projected else day
    return {
        "today": today,
        "timezone": org.timezone,
        "attendance": day,
        "shift": shift_on(db, user.id, today),
        "policy_configured": bool(org.policy),
        "late_count": sum(row.late for row in daily_records(db, start, today, user.id, limit=367)),
    }


def date_window(db: Session, start: date | None, end: date | None) -> tuple[date, date]:
    org = organization(db)
    today = now().astimezone(ZoneInfo(org.timezone)).date()
    return start or today - timedelta(days=30), end or today


@router.get("/me/attendance", response_model=list[AttendanceView])
def my_attendance(
    start: date | None = None,
    end: date | None = None,
    status: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user: User = Depends(employee_only),
    db: Session = Depends(get_db),
):
    return daily_records(
        db, *date_window(db, start, end), user.id, status, limit=limit, offset=offset
    )


@router.get("/admin/attendance", response_model=list[AttendanceView])
def all_attendance(
    start: date | None = None,
    end: date | None = None,
    employee_id: str | None = None,
    status: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user: User = Depends(admin),
    db: Session = Depends(get_db),
):
    return daily_records(db, *date_window(db, start, end), employee_id, status, limit, offset)


def punch(kind: str, data: PunchInput, request: Request, user: User, db: Session):
    throttle(db, "punch:" + user.id, 60)
    org = organization(db)
    employee = locked_user(db, user.id)  # Serialize employee punches.
    if not employee.active:
        raise HTTPException(401, "UNAUTHENTICATED: Account is inactive")
    instant = now()
    today = instant.astimezone(ZoneInfo(org.timezone)).date()
    lock(db, "calendar:" + today.isoformat())
    entry = calendar_entry_on(db, user.id, today)
    if entry and entry.kind == "work_from_home":
        raise HTTPException(
            403,
            "WORK_FROM_HOME: Work from home is recorded from the calendar; punches are not available on this date",
        )
    event_key = user.id + ":" + data.idempotency_key
    prior = db.scalar(select(AttendanceEvent).where(AttendanceEvent.idempotency_key == event_key))
    if prior:
        if prior.kind != kind:
            raise HTTPException(409, "IDEMPOTENCY_CONFLICT: Key was used for a different action")
        return db.get(AttendanceDay, prior.day_id)
    policy = org.policy
    required = {"latitude", "longitude", "radius_m", "max_accuracy_m", "approved_networks"}
    if not required <= policy.keys() or not policy["approved_networks"]:
        raise HTTPException(503, "CONFIGURATION_REQUIRED: Office verification policy is incomplete")
    ip = client_ip(request)
    try:
        network_ok = "0.0.0.0/0" in policy["approved_networks"] or any(
            ipaddress.ip_address(ip).version == ipaddress.ip_network(net).version
            and ipaddress.ip_address(ip) in ipaddress.ip_network(net)
            for net in policy["approved_networks"]
        )
    except (ValueError, TypeError):
        network_ok = False
    location = data.location
    distance = distance_m(
        location.latitude, location.longitude, policy["latitude"], policy["longitude"]
    )
    location_ok = (
        location.accuracy_m <= policy["max_accuracy_m"]
        and distance + location.accuracy_m <= policy["radius_m"]
    )
    if not network_ok or not location_ok:
        log_event(
            db,
            user,
            "attendance.verification_failed",
            user.id,
            after={"network_passed": network_ok, "location_passed": location_ok},
            request=request,
        )
        db.commit()
        raise HTTPException(
            403,
            "VERIFICATION_FAILED: Use the approved office network and a sufficiently accurate office location",
        )
    day = db.scalar(
        select(AttendanceDay)
        .where(AttendanceDay.user_id == user.id, AttendanceDay.local_date == today)
        .with_for_update()
    )
    if kind == "in":
        if day and day.punch_in:
            raise HTTPException(409, "ALREADY_PUNCHED_IN: Punch In already exists for today")
        if not day:
            day = AttendanceDay(
                user_id=user.id, local_date=today, snapshot=snapshot(db, user.id, today, org)
            )
            db.add(day)
        day.punch_in = instant
    else:
        if not day or not day.punch_in:
            raise HTTPException(
                409,
                "PUNCH_IN_REQUIRED: No Punch In exists for today",
            )
        if day.punch_out:
            raise HTTPException(409, "ALREADY_PUNCHED_OUT: Punch Out already exists for today")
        day.punch_out = instant
    db.flush()
    db.add(
        AttendanceEvent(
            day_id=day.id,
            kind=kind,
            occurred_at=instant,
            idempotency_key=event_key,
            evidence={
                "network_passed": True,
                "location_passed": True,
                "accuracy_m": location.accuracy_m,
                "distance_m": round(distance, 1),
            },
        )
    )
    recalculate(db, day, user)
    notify(
        db,
        user.id,
        "attendance",
        f"Punch {kind.title()} recorded at "
        f"{instant.astimezone(ZoneInfo(org.timezone)).strftime('%d-%b-%Y %I:%M %p')}.",
    )
    log_event(db, user, "attendance.punch_" + kind, day.id, request=request)
    db.commit()
    return day


@router.post("/attendance/punch-in", response_model=AttendanceView)
def punch_in(
    data: PunchInput,
    request: Request,
    user: User = Depends(employee_only),
    db: Session = Depends(get_db),
):
    return punch("in", data, request, user, db)


@router.post("/attendance/punch-out", response_model=AttendanceView)
def punch_out(
    data: PunchInput,
    request: Request,
    user: User = Depends(employee_only),
    db: Session = Depends(get_db),
):
    return punch("out", data, request, user, db)


@router.get("/admin/dashboard", response_model=AdminDashboard)
def admin_dashboard(user: User = Depends(admin), db: Session = Depends(get_db)):
    org = organization(db)
    today = now().astimezone(ZoneInfo(org.timezone)).date()
    projected = daily_records(db, today, today, limit=50000)
    return {
        "total_employees": len(
            db.scalars(select(User).where(User.active.is_(True), User.role == "employee")).all()
        ),
        "present": sum(bool(d.punch_in) and d.status != "work_from_home" for d in projected),
        "work_from_home": sum(d.status == "work_from_home" for d in projected),
        "absent": sum(d.status == "absent" for d in projected),
        "late": sum(d.late for d in projected),
        "incomplete": sum(
            bool(d.punch_in) and d.punch_out is None and d.status != "work_from_home"
            for d in projected
        ),
        "attendance": [d for d in projected if d.punch_in or d.status == "work_from_home"],
        "flags": db.scalars(
            select(LateFlag)
            .join(User, User.id == LateFlag.user_id)
            .where(LateFlag.state != "resolved", User.role == "employee")
        ).all(),
    }


@router.get("/reports/attendance", response_model=list[AttendanceView])
def report(
    start: date,
    end: date,
    employee_id: str | None = None,
    status: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user: User = Depends(admin),
    db: Session = Depends(get_db),
):
    return daily_records(db, start, end, employee_id, status, limit, offset)


def safe_cell(value: object) -> str:
    text = str(value) if value is not None else ""
    return "'" + text if text.lstrip().startswith(("=", "+", "-", "@", "\t", "\r", "\n")) else text


@router.get("/reports/attendance.csv", response_class=Response)
def export(
    start: date,
    end: date,
    request: Request,
    employee_id: str | None = None,
    status: str | None = None,
    user: User = Depends(admin),
    db: Session = Depends(get_db),
):
    rows = daily_records(db, start, end, employee_id, status, 10001)
    if len(rows) > 10000:
        raise HTTPException(422, "EXPORT_TOO_LARGE: Narrow the export date range")
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(
        [
            "Employee ID",
            "Name",
            "Email",
            "Date",
            "Shift",
            "Punch In",
            "Punch Out",
            "Status",
            "Net Hours",
            "Expected Hours",
            "Late",
        ]
    )
    for day in rows:
        employee = db.get(User, day.user_id)
        assert employee
        zone = ZoneInfo(day.snapshot["timezone"])
        writer.writerow(
            [
                safe_cell(v)
                for v in [
                    employee.employee_code,
                    employee.name,
                    employee.email,
                    day.local_date.strftime("%d-%b-%Y"),
                    day.snapshot["shift_name"],
                    utc(day.punch_in).astimezone(zone).strftime("%d-%b-%Y %I:%M %p %z")
                    if day.punch_in
                    else "",
                    utc(day.punch_out).astimezone(zone).strftime("%d-%b-%Y %I:%M %p %z")
                    if day.punch_out
                    else "",
                    day.status,
                    "—"
                    if day.status == "work_from_home" and not day.punch_in
                    else f"{day.net_minutes // 60}h {day.net_minutes % 60}min",
                    f"{day.expected_minutes // 60}h {day.expected_minutes % 60}min",
                    day.late,
                ]
            ]
        )
    log_event(
        db,
        user,
        "report.exported",
        "attendance",
        after={"start": str(start), "end": str(end), "rows": len(rows)},
        request=request,
    )
    db.commit()
    return Response(
        output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="attendance.csv"'},
    )
