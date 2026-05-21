"""Regression tests for ``_week_of`` (Trends granularity=week).

Two bug classes guarded against here:

1. **Day-of-week off-by-one.** Python's ``datetime.weekday()`` is
   Mon=0..Sun=6, JS's ``Date.getUTCDay()`` is Sun=0..Sat=6. The
   original Python port used ``weekday()`` directly, silently shifting
   week numbers by one for any year whose Jan 1 isn't aligned.
2. **Naive vs aware datetime crash.** The production caller is
   ``rebucket(r["day"])`` where ``day`` comes from
   ``substr(timestamp, 1, 10)`` in ``aggregate_turns_by_day`` — i.e.
   a date-only string like ``"2026-05-22"``. That parses as a naive
   datetime; subtracting it from the aware ``Jan 1`` start would
   raise ``TypeError``. Both shapes (full ISO with Z, date-only) must
   work.
"""
from __future__ import annotations

import pytest

from argus.server.api import _week_of


@pytest.mark.parametrize(
    "iso,expected_week",
    [
        # 2024 Jan 1 was a Monday. Reference values are what JS produces
        # via the original weekOf() in the deleted src/server/api.ts.
        ("2024-01-01T00:00:00Z", "01"),
        ("2024-01-07T00:00:00Z", "02"),  # 7 days in -> week 2 (the day-of-week regression)
        ("2024-01-08T00:00:00Z", "02"),
        ("2024-12-30T00:00:00Z", "53"),
        ("2024-12-31T00:00:00Z", "53"),
        # 2025 Jan 1 was a Wednesday — another regression-prone year.
        ("2025-01-05T00:00:00Z", "02"),
        # 2026 Jan 1 was a Thursday.
        ("2026-01-01T00:00:00Z", "01"),
        ("2026-12-31T00:00:00Z", "53"),
    ],
)
def test_week_of_full_iso_inputs(iso: str, expected_week: str) -> None:
    assert _week_of(iso) == expected_week


@pytest.mark.parametrize(
    "date_only,expected_week",
    [
        # Production path: ``aggregate_turns_by_day`` returns date-only
        # strings via ``substr(timestamp, 1, 10)`` and ``rebucket`` passes
        # those straight into ``_week_of``. These must not raise.
        ("2024-01-01", "01"),
        ("2024-01-07", "02"),
        ("2025-01-05", "02"),
        ("2026-05-22", "21"),
        ("2026-12-31", "53"),
    ],
)
def test_week_of_accepts_date_only_inputs(date_only: str, expected_week: str) -> None:
    """Production caller passes date-only strings (no ``T``, no ``Z``).

    Naive ``datetime`` from ``fromisoformat("2026-05-22")`` would otherwise
    crash the trends endpoint with ``TypeError: can't subtract
    offset-naive and offset-aware datetimes``.
    """
    assert _week_of(date_only) == expected_week
