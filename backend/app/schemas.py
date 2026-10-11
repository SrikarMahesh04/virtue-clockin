import ipaddress
from datetime import date, datetime, time
from typing import Any, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    computed_field,
    field_validator,
    model_validator,
)
from app.domain import expected_shift_minutes

Role = Literal["employee", "admin", "super_admin"]


class DTO(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")


class Message(DTO):
    message: str


class Health(DTO):
    status: str


class AuthMethods(DTO):
    password: bool = True
    pin: bool = True
    recovery: bool


class Login(DTO):
    email: EmailStr
    method: Literal["password", "pin"] = "password"
    secret: str = Field(min_length=1, max_length=256)


class UserView(DTO):
    id: str
    email: str
    name: str
    employee_code: str | None
    date_of_joining: date | None
    role: Role
    active: bool
    account_activated: bool


class ServerTime(DTO):
    instant: datetime
    timezone: str


class SessionView(DTO):
    user: UserView
    csrf: str
    expires_at: datetime


class EmailInput(DTO):
    email: EmailStr


class Credentials(DTO):
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(min_length=1, max_length=256)
    pin: str = Field(pattern=r"^[0-9]{6}$")


class PasswordInput(DTO):
    password: str = Field(min_length=1, max_length=256)


class PinChange(PasswordInput):
    pin: str = Field(pattern=r"^[0-9]{6}$")


class EmployeeInput(DTO):
    email: EmailStr
    name: str = Field(min_length=1, max_length=160)
    date_of_joining: date | None = None
    role: Role = "employee"
    active: bool = True


class OfficePolicy(DTO):
    name: str = Field(min_length=1, max_length=200)
    timezone: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    radius_m: float = Field(gt=0, le=10000)
    max_accuracy_m: float = Field(gt=0, le=5000)
    approved_networks: list[str] = Field(min_length=1, max_length=30)
    weekly_off: list[int] = Field(default_factory=lambda: [5, 6], max_length=7)
    reason: str = Field(min_length=3, max_length=1000)

    @field_validator("timezone")
    @classmethod
    def zone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as error:
            raise ValueError("Use a valid IANA timezone") from error
        return value

    @field_validator("approved_networks")
    @classmethod
    def networks(cls, values: list[str]) -> list[str]:
        return [str(ipaddress.ip_network(v, strict=False)) for v in values]

    @field_validator("weekly_off")
    @classmethod
    def weekdays(cls, values: list[int]) -> list[int]:
        if len(set(values)) != len(values) or any(v < 0 or v > 6 for v in values):
            raise ValueError("Weekdays must be unique values from 0 (Monday) to 6")
        return values


class SettingsView(DTO):
    configured: bool
    name: str | None
    timezone: str | None
    policy: dict[str, Any]


class ShiftInput(DTO):
    name: str = Field(min_length=1, max_length=120)
    starts_at: time
    ends_at: time
    active: bool = True

    @model_validator(mode="after")
    def same_day(self) -> "ShiftInput":
        def minute(t: time) -> int:
            if t.tzinfo or t.second or t.microsecond:
                raise ValueError("Use local HH:MM times without seconds or timezone")
            return t.hour * 60 + t.minute

        start, end = map(minute, [self.starts_at, self.ends_at])
        if end <= start:
            raise ValueError("Same-day shift end time must follow start time")
        return self


class ShiftView(ShiftInput):
    id: str

    @computed_field  # type: ignore[prop-decorator]
    @property
    def expected_working_minutes(self) -> int:
        return expected_shift_minutes(self.starts_at, self.ends_at)


class OfficeTimezone(DTO):
    timezone: str | None


class AssignmentInput(DTO):
    user_id: str
    shift_id: str
    valid_from: date
    valid_to: date | None = None

    @model_validator(mode="after")
    def ordered(self) -> "AssignmentInput":
        if self.valid_to and self.valid_to < self.valid_from:
            raise ValueError("End date must follow start date")
        return self


class EmployeeShiftInput(DTO):
    shift_id: str


class AssignmentView(AssignmentInput):
    id: str


class CalendarInput(DTO):
    date: date
    name: str = Field(min_length=1, max_length=160)
    kind: Literal["holiday", "work_from_home", "optional_holiday"]
    user_id: str | None = None


class CalendarView(CalendarInput):
    id: str


class Location(DTO):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy_m: float = Field(gt=0, le=100000)


class PunchInput(DTO):
    location: Location
    idempotency_key: str = Field(min_length=16, max_length=100)


class AttendanceView(DTO):
    id: str
    user_id: str
    local_date: date
    punch_in: datetime | None
    punch_out: datetime | None
    snapshot: dict[str, Any]
    status: str
    net_minutes: int
    expected_minutes: int
    late: bool
    corrected: bool


class Dashboard(DTO):
    today: date
    timezone: str
    attendance: AttendanceView | None
    shift: ShiftView | None
    late_count: int
    policy_configured: bool


class NotificationView(DTO):
    id: str
    kind: str
    message: str
    read: bool
    created_at: datetime


class FlagView(DTO):
    id: str
    user_id: str
    month: str
    count: int
    state: str


class CalendarData(DTO):
    timezone: str
    days: list[CalendarView]
    assignments: list[AssignmentView]
    shifts: list[ShiftView]
    attendance: list[AttendanceView]
    weekly_off: list[int]


class AdminDashboard(DTO):
    total_employees: int
    work_from_home: int
    present: int
    absent: int
    late: int
    incomplete: int
    flags: list[FlagView]
    attendance: list[AttendanceView]
