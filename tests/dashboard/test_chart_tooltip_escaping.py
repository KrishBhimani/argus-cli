"""ECharts tooltip formatters must escape JSONL-derived labels.

Regression guard for docs/SECURITY_AUDIT_2026-07-31.md #3: a custom
``tooltip.formatter`` has its return value rendered as **HTML** by ECharts, so
interpolating a tool / MCP-server / sub-agent name straight from a session
transcript is a stored-XSS sink. The blast radius is total -- the dashboard
origin holds the user's whole prompt history and can call the API same-origin.

Scope, stated honestly: the dashboard has no JS test runner (``package.json``
exposes only ``build``/``dev``), so this asserts against the *source text*
rather than executing the formatter. It catches the specific regression --
re-introducing a bare label interpolation -- and cannot catch an escaping bug
inside ``escapeHtml`` itself. ECharts' own *default* tooltip is not covered
because ECharts escapes that internally; only hand-written formatters are.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

SRC = Path(__file__).resolve().parents[2] / "dashboard" / "src"

# `${identifier[...]}` or `${identifier.prop}` that is NOT wrapped in a
# recognised-safe call. Numbers formatted via tok()/num()/toLocaleString() and
# escapeHtml(...) are fine; a raw name is not.
#
# Limitation: this only inspects member/index expressions, where the risk
# concentrates (`t.name`, `labels[i]`). A bare `${key}` is not flagged, so a
# future formatter that interpolates a plain local holding attacker text would
# slip past. Tightening that needs a real JS parser, which is not worth a
# dependency here.
_RAW_INTERP = re.compile(r"\$\{(?!escapeHtml\(|tok\(|num\(|usd\(|dur\()([A-Za-z_$][\w$]*(?:\[[^\]]*\]|\.[\w$]+)+)\}")

# Expressions proven numeric by their TypeScript declaration, so they can never
# carry markup. Add here only with the declaration cited -- never to silence a
# genuine string.
_KNOWN_NUMERIC = {
    "t.sequence",  # charts.ts:183 `turns: { sequence: number; ... }[]`
}


def _formatter_bodies(text: str) -> list[str]:
    """Rough slice of each `formatter: (p) => { ... }` / `=> \\`...\\`` body."""
    out = []
    for m in re.finditer(r"formatter:\s*\(", text):
        # take the next ~600 chars; formatters in this codebase are short
        out.append(text[m.start() : m.start() + 600])
    return out


def _sources() -> list[Path]:
    return sorted(
        [*SRC.rglob("*.astro"), *SRC.rglob("*.ts")],
        key=lambda p: p.as_posix(),
    )


def test_source_tree_is_present():
    """Fail loudly rather than vacuously passing if the tree moved."""
    files = _sources()
    assert files, f"no dashboard sources found under {SRC}"
    assert any(p.name == "tools.astro" for p in files)


@pytest.mark.parametrize("path", _sources(), ids=lambda p: p.name)
def test_tooltip_formatters_escape_interpolated_labels(path: Path):
    text = path.read_text(encoding="utf-8")
    for body in _formatter_bodies(text):
        for m in _RAW_INTERP.finditer(body):
            expr = m.group(1)
            if expr in _KNOWN_NUMERIC:
                continue
            pytest.fail(
                f"{path.name}: chart formatter interpolates `${{{expr}}}` without "
                f"escapeHtml(). ECharts renders formatter output as HTML, so a "
                f"name read from .jsonl becomes stored XSS. Wrap it in "
                f"escapeHtml(), or use tok()/num() if it is numeric."
            )


def test_tools_page_escapes_its_bar_chart_label():
    """Pin the exact call site the audit found unescaped."""
    text = (SRC / "pages" / "tools.astro").read_text(encoding="utf-8")
    assert "escapeHtml(labels[i])" in text
    assert "${labels[i]}" not in text
