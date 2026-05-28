"""tool_error_rate_spike detector tests."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from argus.detectors.tool_error_rate_spike import ToolErrorRateSpikeDetector
from argus.schema.types import ToolCall
from tests.conftest import session_factory


NOW = "2026-05-27T12:00:00Z"


def _now_dt():
    return datetime.fromisoformat(NOW.replace("Z", "+00:00"))


def _ts(days_ago: float) -> str:
    dt = _now_dt() - timedelta(days=days_ago)
    return dt.isoformat().replace("+00:00", "Z")


def _seed_calls(repo, tool: str, *, days_ago: float, calls: int, errors: int) -> None:
    """Insert one synthetic session + `calls` tool_calls at `days_ago`."""
    sid = f"claude_code:s-{tool}-{days_ago}"
    repo.upsert_session(session_factory(sid, _ts(days_ago)))
    rows = []
    for i in range(calls):
        rows.append(
            ToolCall(
                id=f"{sid}:{tool}:{i}",
                session_id=sid,
                turn_index=i,
                tool_name=tool,
                is_error=1 if i < errors else 0,
                input_size=0,
                subagent_type=None,
                timestamp=_ts(days_ago),
            )
        )
    repo.upsert_tool_calls(rows)


@pytest.fixture
def detector():
    return ToolErrorRateSpikeDetector()


def test_empty_repo_returns_no_findings(repo, detector):
    assert detector.detect(repo, NOW) == []


def test_below_window_call_floor_returns_nothing(repo, detector):
    _seed_calls(repo, "Bash", days_ago=2, calls=15, errors=10)
    _seed_calls(repo, "Bash", days_ago=20, calls=200, errors=10)
    assert detector.detect(repo, NOW) == []


def test_below_baseline_call_floor_returns_nothing(repo, detector):
    _seed_calls(repo, "Bash", days_ago=2, calls=200, errors=50)
    _seed_calls(repo, "Bash", days_ago=20, calls=15, errors=1)
    assert detector.detect(repo, NOW) == []


def test_window_below_2x_baseline_returns_nothing(repo, detector):
    _seed_calls(repo, "Bash", days_ago=2, calls=100, errors=4)    # 4%
    _seed_calls(repo, "Bash", days_ago=20, calls=200, errors=6)   # 3% → 1.33x
    assert detector.detect(repo, NOW) == []


def test_warning_severity_when_window_is_2x_to_5x_baseline(repo, detector):
    _seed_calls(repo, "Bash", days_ago=2, calls=200, errors=24)   # 12%
    _seed_calls(repo, "Bash", days_ago=20, calls=400, errors=20)  # 5% → 2.4x
    findings = detector.detect(repo, NOW)
    assert len(findings) == 1
    f = findings[0]
    assert f.detector == "tool_error_rate_spike"
    assert f.dedup_key == "Bash"
    assert f.severity == "warning"
    assert pytest.approx(f.metadata["multiple"], rel=1e-2) == 2.4
    assert f.metadata["window_calls"] == 200
    assert f.metadata["baseline_calls"] == 400


def test_critical_severity_when_window_is_5x_plus_baseline(repo, detector):
    _seed_calls(repo, "Bash", days_ago=2, calls=200, errors=60)   # 30%
    _seed_calls(repo, "Bash", days_ago=20, calls=400, errors=20)  # 5% → 6x
    findings = detector.detect(repo, NOW)
    assert findings[0].severity == "critical"


def test_multiple_tools_are_independent(repo, detector):
    _seed_calls(repo, "Bash", days_ago=2, calls=200, errors=30)
    _seed_calls(repo, "Bash", days_ago=20, calls=400, errors=20)
    _seed_calls(repo, "Read", days_ago=2, calls=200, errors=8)
    _seed_calls(repo, "Read", days_ago=20, calls=400, errors=15)
    findings = detector.detect(repo, NOW)
    names = {f.dedup_key for f in findings}
    assert "Bash" in names
    assert "Read" not in names


def test_detector_is_pure_no_writes(repo, detector):
    _seed_calls(repo, "Bash", days_ago=2, calls=200, errors=30)
    _seed_calls(repo, "Bash", days_ago=20, calls=400, errors=20)
    detector.detect(repo, NOW)
    assert repo.list_alerts(limit=10) == []


def test_baseline_window_does_not_overlap_window(repo, detector):
    """Calls at day -5 (inside window) must NOT be counted in baseline."""
    _seed_calls(repo, "Bash", days_ago=5, calls=200, errors=200)   # 100%, in window
    _seed_calls(repo, "Bash", days_ago=20, calls=400, errors=20)   # baseline 5%
    findings = detector.detect(repo, NOW)
    assert findings[0].severity == "critical"
    assert pytest.approx(findings[0].metadata["window_rate"], rel=1e-3) == 1.0


def test_fires_critical_when_baseline_is_zero_and_window_rate_at_least_5pct(repo, detector):
    _seed_calls(repo, "Bash", days_ago=2, calls=200, errors=20)    # 10% window
    _seed_calls(repo, "Bash", days_ago=20, calls=400, errors=0)    # 0% baseline
    findings = detector.detect(repo, NOW)
    assert len(findings) == 1
    f = findings[0]
    assert f.severity == "critical"
    assert "started failing" in f.title.lower()
    assert f.metadata["baseline_rate"] == 0.0
    assert pytest.approx(f.metadata["window_rate"], rel=1e-3) == 0.10
    assert "multiple" not in f.metadata


def test_baseline_zero_with_low_window_rate_returns_nothing(repo, detector):
    _seed_calls(repo, "Bash", days_ago=2, calls=200, errors=4)     # 2% window
    _seed_calls(repo, "Bash", days_ago=20, calls=400, errors=0)    # 0% baseline
    assert detector.detect(repo, NOW) == []


def test_baseline_zero_below_call_floor_returns_nothing(repo, detector):
    _seed_calls(repo, "Bash", days_ago=2, calls=15, errors=10)     # too few calls
    _seed_calls(repo, "Bash", days_ago=20, calls=400, errors=0)    # 0% baseline
    assert detector.detect(repo, NOW) == []
