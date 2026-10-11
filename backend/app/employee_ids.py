"""Transactional, monthly employee identifier allocation."""

import re
from datetime import date

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import EmployeeIdCounter, User
from app.security import lock


def allocate_employee_id(db: Session, joining_date: date) -> str:
    prefix = joining_date.strftime("%y%m")
    lock(db, "employee-id:" + prefix)
    counter = db.get(EmployeeIdCounter, prefix)
    if not counter:
        counter = EmployeeIdCounter(month=prefix, last_number=0)
        db.add(counter)
    # Existing IDs are preserved and reserved, including inactive employees.
    existing = db.scalars(select(User.employee_code).where(User.employee_code.like(prefix + "-%")))
    highest = max(
        (int(code[-3:]) for code in existing if code and re.fullmatch(r"\d{4}-\d{3}", code)),
        default=0,
    )
    number = max(counter.last_number, highest) + 1
    if number > 999:
        raise HTTPException(
            409, "EMPLOYEE_ID_LIMIT: This joining month has exhausted its 999 Employee IDs"
        )
    counter.last_number = number
    return f"{prefix}-{number:03d}"
