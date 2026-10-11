from datetime import date, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.employee_ids import allocate_employee_id
from app.models import Assignment, CalendarEntry, Organization, Shift, User, now
from app.schemas import (
    AssignmentInput,
    AssignmentView,
    CalendarInput,
    CalendarView,
    EmployeeInput,
    EmployeeShiftInput,
    Message,
    OfficePolicy,
    OfficeTimezone,
    SettingsView,
    ServerTime,
    ShiftInput,
    ShiftView,
    UserView,
)
from app.security import admin, current_user, lock, locked_user, revoke
from app.services import (
    log_event,
    challenge,
    send_link,
    notify,
    update_flag,
    calendar_entry_on,
    organization,
)

router = APIRouter(prefix="/api/v1", tags=["workforce"])


@router.get("/time", response_model=ServerTime)
def server_time(user: User = Depends(current_user), db: Session = Depends(get_db)):
    org = db.scalar(select(Organization))
    return {"instant": now(), "timezone": org.timezone if org else "UTC"}


@router.get("/office/timezone", response_model=OfficeTimezone)
def office_timezone(user: User = Depends(current_user), db: Session = Depends(get_db)):
    org = db.scalar(select(Organization))
    return {"timezone": org.timezone if org else None}


@router.get("/settings", response_model=SettingsView)
def get_settings(user: User = Depends(admin), db: Session = Depends(get_db)):
    org = db.scalar(select(Organization))
    return {
        "configured": bool(org),
        "name": org.name if org else None,
        "timezone": org.timezone if org else None,
        "policy": org.policy if org else {},
    }


@router.put("/settings", response_model=SettingsView)
def put_settings(
    data: OfficePolicy,
    request: Request,
    user: User = Depends(admin),
    db: Session = Depends(get_db),
):
    lock(db, "organization-settings")
    org = db.scalar(select(Organization).with_for_update())
    before = {"name": org.name, "timezone": org.timezone, "policy": org.policy} if org else None
    if not org:
        org = Organization(name=data.name, timezone=data.timezone, policy={})
        db.add(org)
        db.flush()
    org.name, org.timezone = data.name, data.timezone
    org.policy = data.model_dump(exclude={"name", "timezone", "reason"})
    log_event(
        db,
        user,
        "settings.changed",
        org.id,
        data.reason,
        before,
        {"name": org.name, "timezone": org.timezone, "policy": org.policy},
        request,
    )
    db.commit()
    return get_settings(user, db)


@router.get("/employees", response_model=list[UserView])
def employees(user: User = Depends(admin), db: Session = Depends(get_db)):
    return db.scalars(select(User).order_by(User.name)).all()


def validate_employee(db: Session, data: EmployeeInput, actor: User, existing: User | None = None):
    if data.role != "employee" and data.date_of_joining is not None:
        raise HTTPException(422, "ADMIN_JOINING_DATE: Joining dates apply to employees only")
    if (
        data.role == "employee"
        and not data.date_of_joining
        and (not existing or existing.role != "employee" or existing.date_of_joining)
    ):
        raise HTTPException(422, "JOINING_DATE_REQUIRED: Enter the employee's date of joining")
    if existing and existing.id == actor.id and (not data.active or data.role != actor.role):
        raise HTTPException(
            409, "SELF_EDIT_RESTRICTED: Another administrator must change your access"
        )


@router.post("/employees", response_model=UserView, status_code=201)
def create_employee(
    data: EmployeeInput,
    request: Request,
    user: User = Depends(admin),
    db: Session = Depends(get_db),
):
    validate_employee(db, data, user)
    employee = User(
        **data.model_dump(exclude={"email"}),
        email=str(data.email).lower(),
        employee_code=allocate_employee_id(db, data.date_of_joining)
        if data.role == "employee" and data.date_of_joining
        else None,
    )
    db.add(employee)
    db.flush()
    log_event(
        db,
        user,
        "employee.created",
        employee.id,
        after=UserView.model_validate(employee).model_dump(),
        request=request,
    )
    db.commit()
    return employee


@router.put("/employees/{employee_id}", response_model=UserView)
def edit_employee(
    employee_id: str,
    data: EmployeeInput,
    request: Request,
    user: User = Depends(admin),
    db: Session = Depends(get_db),
):
    employee = locked_user(db, employee_id)
    validate_employee(db, data, user, employee)
    before = UserView.model_validate(employee).model_dump()
    if data.role != "employee":
        employee.employee_code = None
    elif employee.role != "employee" or employee.employee_code is None:
        if not data.date_of_joining:
            raise HTTPException(422, "JOINING_DATE_REQUIRED: Enter the employee's date of joining")
        employee.employee_code = allocate_employee_id(db, data.date_of_joining)
    for key, value in data.model_dump().items():
        setattr(employee, key, str(value).lower() if key == "email" else value)
    revoke(db, employee.id)
    log_event(
        db,
        user,
        "employee.updated",
        employee.id,
        before=before,
        after=UserView.model_validate(employee).model_dump(),
        request=request,
    )
    db.commit()
    return employee


@router.post("/employees/{employee_id}/reset", response_model=Message)
def reset_employee(
    employee_id: str, request: Request, user: User = Depends(admin), db: Session = Depends(get_db)
):
    return employee_link(employee_id, "recovery", request, user, db)


@router.post("/employees/{employee_id}/activation-link", response_model=Message)
def activate_employee(
    employee_id: str, request: Request, user: User = Depends(admin), db: Session = Depends(get_db)
):
    return employee_link(employee_id, "activation", request, user, db)


def employee_link(employee_id: str, purpose: str, request: Request, user: User, db: Session):
    employee = locked_user(db, employee_id)
    if not employee.active:
        raise HTTPException(409, "INACTIVE_ACCOUNT: Activate the employee account first")
    if purpose == "activation" and employee.account_activated:
        raise HTTPException(409, "ALREADY_ACTIVATED: This account is activated. Use Reset Password")
    if purpose == "recovery" and not employee.account_activated:
        raise HTTPException(
            409, "ACTIVATION_REQUIRED: Send an activation link for this account first"
        )
    token = challenge(db, employee, purpose)
    send_link(employee.email, token, purpose)
    log_event(db, user, "employee." + purpose + "_link_sent", employee.id, request=request)
    db.commit()
    return {
        "message": "Activation link sent" if purpose == "activation" else "Password reset link sent"
    }


@router.put("/employees/{employee_id}/shift", response_model=AssignmentView)
def assign_employee_shift(
    employee_id: str,
    data: EmployeeShiftInput,
    request: Request,
    user: User = Depends(admin),
    db: Session = Depends(get_db),
):
    employee = locked_user(db, employee_id)
    if employee.role != "employee" or not employee.active:
        raise HTTPException(422, "INVALID_EMPLOYEE: Select an active employee")
    shift = db.get(Shift, data.shift_id)
    if not shift or not shift.active or shift.deleted:
        raise HTTPException(422, "INVALID_SHIFT: Choose an active shift")
    today = now().astimezone(ZoneInfo(organization(db).timezone)).date()
    start = max(today, employee.date_of_joining or today)
    rows = db.scalars(
        select(Assignment).where(Assignment.user_id == employee.id).with_for_update()
    ).all()
    for row in rows:
        if (
            row.valid_from <= start
            and row.valid_to is None
            and row.shift_id == shift.id
            and len([a for a in rows if a.valid_from > start]) == 0
        ):
            return row
    for row in rows:
        if row.valid_to and row.valid_to < start:
            continue
        if row.valid_from < start:
            row.valid_to = start - timedelta(days=1)
        else:
            db.delete(row)
    item = Assignment(user_id=employee.id, shift_id=shift.id, valid_from=start)
    db.add(item)
    db.flush()
    log_event(db, user, "shift.assigned", item.id, request=request)
    db.commit()
    return item


@router.get("/shifts", response_model=list[ShiftView])
def shifts(user: User = Depends(admin), db: Session = Depends(get_db)):
    return db.scalars(select(Shift).where(Shift.deleted.is_(False)).order_by(Shift.name)).all()


@router.post("/shifts", response_model=ShiftView, status_code=201)
def create_shift(
    data: ShiftInput, request: Request, user: User = Depends(admin), db: Session = Depends(get_db)
):
    shift = Shift(**data.model_dump())
    db.add(shift)
    db.flush()
    log_event(
        db, user, "shift.created", shift.id, after=data.model_dump(mode="json"), request=request
    )
    db.commit()
    return shift


@router.put("/shifts/{shift_id}", response_model=ShiftView)
def edit_shift(
    shift_id: str,
    data: ShiftInput,
    request: Request,
    user: User = Depends(admin),
    db: Session = Depends(get_db),
):
    shift = db.scalar(select(Shift).where(Shift.id == shift_id).with_for_update())
    if not shift or shift.deleted:
        raise HTTPException(404, "NOT_FOUND: Shift not found")
    # Recorded days retain their snapshots; edits affect subsequent snapshots.
    before = ShiftView.model_validate(shift).model_dump(mode="json")
    for key, value in data.model_dump().items():
        setattr(shift, key, value)
    log_event(
        db,
        user,
        "shift.updated",
        shift.id,
        before=before,
        after=data.model_dump(mode="json"),
        request=request,
    )
    db.commit()
    return shift


@router.delete("/shifts/{shift_id}", response_model=Message)
def delete_shift(
    shift_id: str,
    request: Request,
    user: User = Depends(admin),
    db: Session = Depends(get_db),
):
    shift = db.scalar(select(Shift).where(Shift.id == shift_id).with_for_update())
    if not shift or shift.deleted:
        raise HTTPException(404, "NOT_FOUND: Shift not found")
    before = ShiftView.model_validate(shift).model_dump(mode="json")
    shift.deleted = True
    shift.active = False
    log_event(
        db,
        user,
        "shift.deleted",
        shift.id,
        before=before,
        after={"deleted": True, "active": False},
        request=request,
    )
    db.commit()
    return {"message": "Shift deleted. Recorded attendance and assignment history are preserved."}


@router.get("/assignments", response_model=list[AssignmentView])
def assignments(user: User = Depends(admin), db: Session = Depends(get_db)):
    return db.scalars(select(Assignment).order_by(Assignment.valid_from.desc())).all()


@router.post("/assignments", response_model=AssignmentView, status_code=201)
def assign(
    data: AssignmentInput,
    request: Request,
    user: User = Depends(admin),
    db: Session = Depends(get_db),
):
    locked_user(db, data.user_id)
    shift = db.get(Shift, data.shift_id)
    if not shift or not shift.active or shift.deleted:
        raise HTTPException(422, "INVALID_SHIFT: Choose an active shift")
    rows = db.scalars(
        select(Assignment).where(Assignment.user_id == data.user_id).with_for_update()
    ).all()
    for row in rows:
        if (
            row.valid_from <= (data.valid_to or date.max)
            and (row.valid_to or date.max) >= data.valid_from
        ):
            # Replace the future portion of a currently open assignment, preserving its history.
            if row.valid_to is None and row.valid_from < data.valid_from and data.valid_to is None:
                from datetime import timedelta

                row.valid_to = data.valid_from - timedelta(days=1)
            else:
                raise HTTPException(409, "ASSIGNMENT_OVERLAP: Shift assignments cannot overlap")
    item = Assignment(**data.model_dump())
    db.add(item)
    db.flush()
    log_event(
        db, user, "shift.assigned", item.id, after=data.model_dump(mode="json"), request=request
    )
    db.commit()
    return item


@router.get("/calendar-days", response_model=list[CalendarView])
def calendar_days(user: User = Depends(current_user), db: Session = Depends(get_db)):
    query = select(CalendarEntry)
    if user.role == "employee":
        query = query.where((CalendarEntry.user_id.is_(None)) | (CalendarEntry.user_id == user.id))
    return db.scalars(query.order_by(CalendarEntry.date, CalendarEntry.id)).all()


@router.post("/calendar-days", response_model=CalendarView, status_code=201)
def save_calendar_day(
    data: CalendarInput,
    request: Request,
    user: User = Depends(admin),
    db: Session = Depends(get_db),
):
    lock(db, "calendar:" + data.date.isoformat())
    if data.user_id:
        target = db.get(User, data.user_id)
        if not target or target.role != "employee" or not target.active:
            raise HTTPException(422, "INVALID_EMPLOYEE: Select an active employee")
    item = db.scalar(
        select(CalendarEntry).where(
            CalendarEntry.date == data.date, CalendarEntry.user_id == data.user_id
        )
    )
    changed = not item or item.kind != data.kind or item.name != data.name
    if not item:
        item = CalendarEntry(**data.model_dump())
        db.add(item)
        db.flush()
    else:
        item.name, item.kind = data.name, data.kind
    db.flush()
    for target in db.scalars(select(User).where(User.role == "employee", User.active.is_(True))):
        if data.user_id and target.id != data.user_id:
            continue
        effective = calendar_entry_on(db, target.id, data.date)
        if effective and effective.id == item.id:
            update_flag(db, target.id, data.date, user)
            if changed:
                notify(
                    db,
                    target.id,
                    "calendar",
                    f"{data.date.strftime('%d-%b-%Y')}: {data.kind.replace('_', ' ').title()} scheduled for you. Check your calendar.",
                )
    log_event(db, user, "calendar.changed", item.id, request=request)
    db.commit()
    return item


@router.delete("/calendar-days/{entry_id}", response_model=Message)
def delete_calendar_day(
    entry_id: str,
    request: Request,
    user: User = Depends(admin),
    db: Session = Depends(get_db),
):
    item = db.get(CalendarEntry, entry_id)
    if not item:
        raise HTTPException(404, "NOT_FOUND: Calendar entry not found")
    lock(db, "calendar:" + item.date.isoformat())
    day, target_id = item.date, item.user_id
    db.delete(item)
    db.flush()
    for target in db.scalars(select(User).where(User.role == "employee", User.active.is_(True))):
        if target_id and target.id != target_id:
            continue
        update_flag(db, target.id, day, user)
        notify(
            db,
            target.id,
            "calendar",
            f"Calendar entry for {day.strftime('%d-%b-%Y')} removed. Check your updated calendar.",
        )
    log_event(db, user, "calendar.deleted", entry_id, request=request)
    db.commit()
    return {"message": "Calendar entry removed"}
