"""Pure attendance interval calculations; no ORM or HTTP dependencies."""

import math
from datetime import UTC, datetime, time, timedelta

Interval = tuple[datetime, datetime]
GRACE_MINUTES = 20
EXPECTED_DEDUCTION_MINUTES = 60


def expected_shift_minutes(start: time, end: time) -> int:
    return max(
        0,
        (end.hour * 60 + end.minute)
        - (start.hour * 60 + start.minute)
        - EXPECTED_DEDUCTION_MINUTES,
    )


def utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def merge(intervals: list[Interval]) -> list[Interval]:
    result: list[Interval] = []
    for start, end in sorted((utc(a), utc(b)) for a, b in intervals if b > a):
        if result and start <= result[-1][1]:
            result[-1] = (result[-1][0], max(end, result[-1][1]))
        else:
            result.append((start, end))
    return result


def overlap(a: Interval, b: Interval) -> timedelta:
    return max(timedelta(), min(utc(a[1]), utc(b[1])) - max(utc(a[0]), utc(b[0])))


def minutes(value: timedelta) -> int:
    return max(0, int(value.total_seconds() // 60))


def calculate(
    shift: Interval,
    punch_in: datetime,
    punch_out: datetime | None,
    permissions: list[Interval],
    *,
    historical_exclusions: list[Interval] | None = None,
    expected_deduction_minutes: int = EXPECTED_DEDUCTION_MINUTES,
) -> dict[str, int | bool | str]:
    shift = (utc(shift[0]), utc(shift[1]))
    punch_in = utc(punch_in)
    excused = merge(permissions)
    recorded_exclusions = merge(historical_exclusions or [])
    exclusions = merge([*recorded_exclusions, *excused])
    expected = max(
        0,
        minutes(shift[1] - shift[0] - sum((overlap(shift, item) for item in excused), timedelta()))
        - expected_deduction_minutes,
    )
    arrival = shift[0]
    for start, end in exclusions:
        if start <= arrival < end:
            arrival = end
    late = punch_in > arrival + timedelta(minutes=GRACE_MINUTES) and arrival < shift[1]
    net = 0
    if punch_out:
        work = (punch_in, utc(punch_out))
        net = minutes(
            work[1]
            - work[0]
            - sum((overlap(work, item) for item in recorded_exclusions), timedelta())
        )
    conflict = any(a <= shift[0] and b >= shift[1] for a, b in excused)
    status = (
        "leave_conflict"
        if conflict
        else ("incomplete" if punch_out is None else "late" if late else "present")
    )
    return {"net_minutes": net, "expected_minutes": expected, "late": late, "status": status}


def distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    a, b = math.radians(lat1), math.radians(lat2)
    delta_lat, delta_lon = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    h = math.sin(delta_lat / 2) ** 2 + math.cos(a) * math.cos(b) * math.sin(delta_lon / 2) ** 2
    return 6371000 * 2 * math.asin(min(1, math.sqrt(h)))
