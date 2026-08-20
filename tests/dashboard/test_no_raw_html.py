"""React escapes text by default; the one way to reintroduce stored XSS from
.jsonl-derived strings (model names, paths, tool names, snippets) is
``dangerouslySetInnerHTML`` or a raw ``innerHTML`` write. Forbid both.

Replaces ``test_chart_tooltip_escaping.py``, which guarded ECharts formatters in
the Astro dashboard (docs/SECURITY_AUDIT_2026-07-31.md #3). FTS5 ``<mark>``
snippets are split into text runs by ``features/search/cleanSnippet.ts``.
"""
from __future__ import annotations

from pathlib import Path

import pytest

SRC = Path(__file__).resolve().parents[2] / "dashboard" / "src"
FORBIDDEN = ("dangerouslySetInnerHTML", ".innerHTML", "insertAdjacentHTML")


def _sources() -> list[Path]:
    return sorted(
        p
        for p in SRC.rglob("*")
        if p.suffix in {".ts", ".tsx"} and "routeTree.gen" not in p.name
    )


def test_source_tree_is_present():
    """Fail loudly rather than vacuously passing if the tree moved."""
    files = _sources()
    assert files, f"no dashboard sources under {SRC}"
    assert any(p.name == "OverviewPage.tsx" for p in files)


@pytest.mark.parametrize(
    "path", _sources(), ids=lambda p: p.relative_to(SRC).as_posix()
)
def test_no_raw_html_sinks(path: Path):
    text = path.read_text(encoding="utf-8")
    for token in FORBIDDEN:
        assert token not in text, (
            f"{path.name} uses {token}; render transcript-derived strings as "
            f"text nodes (see tests/dashboard/test_no_raw_html.py)"
        )
