from datetime import UTC, datetime, timedelta

import pytest

from app.domain import calculate, distance_m


def at(hour, minute=0):
    return datetime(2026, 10, 9, hour, minute, tzinfo=UTC)


@pytest.mark.parametrize(
    "start,end,expected",
    [(8, 17, 540), (8, 16, 480), (9, 16, 420), (9, 17, 480)],
)
def test_shift_totals(start, end, expected):
    value = calculate((at(start), at(end)), at(start), at(end), [])
    assert value["net_minutes"] == expected
    assert value["expected_minutes"] == max(0, expected - 60)
    assert not value["late"]


def test_partial_work_and_late_boundary():
    shift = (at(8), at(17))
    assert not calculate(shift, at(8, 20), None, [])["late"]
    assert calculate(shift, at(8, 20) + timedelta(seconds=1), None, [])["late"]
    assert calculate(shift, at(13), at(17), [])["net_minutes"] == 240
    result = calculate(shift, at(13, 30), at(17), [(at(8), at(13, 30))])
    assert result["net_minutes"] == 210
    assert result["expected_minutes"] == 150
    assert not result["late"]


def test_overlapping_permissions_deduct_once_and_full_leave_conflict():
    shift = (at(8), at(17))
    result = calculate(shift, at(10), at(17), [(at(8), at(9, 30)), (at(9), at(10))])
    assert result["expected_minutes"] == 360
    assert not result["late"]
    assert calculate(shift, at(8), at(17), [shift])["status"] == "leave_conflict"
    assert calculate(shift, at(8), None, [])["status"] == "incomplete"


def test_distance():
    assert distance_m(0, 0, 0, 0) == 0
    assert 110000 < distance_m(0, 0, 1, 0) < 112000


def test_recorded_historical_exclusions_preserve_original_totals():
    value = calculate((at(8), at(17)), at(8), at(17), [], historical_exclusions=[(at(12), at(13))])
    assert value["net_minutes"] == 480
    assert value["expected_minutes"] == 480


@pytest.mark.parametrize("hour", [8, 13, 15])
def test_twenty_minute_grace_for_any_shift_and_approved_permissions(hour):
    start, end = at(hour), at(hour + 6)
    assert not calculate((start, end), start + timedelta(minutes=20), None, [])["late"]
    assert calculate((start, end), start + timedelta(minutes=20, seconds=1), None, [])["late"]
    permission_end = start + timedelta(hours=1)
    assert not calculate(
        (start, end), permission_end + timedelta(minutes=20), None, [(start, permission_end)]
    )["late"]
