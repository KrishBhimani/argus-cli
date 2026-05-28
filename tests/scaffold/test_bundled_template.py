"""The bundled `default` template must ship with the expected files."""
from __future__ import annotations

from pathlib import Path

# tests/scaffold/test_bundled_template.py -> parents[2] is the repo root.
_REPO_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT = _REPO_ROOT / "templates" / "default"

_EXPECTED = [
    "CLAUDE.md",
    ".claude/settings.json",
    ".claude/agents/code-reviewer.md",
    ".claude/agents/security-auditor.md",
    ".claude/commands/commit.md",
    ".claude/commands/deploy.md",
    ".claude/commands/fix-issue.md",
    ".claude/commands/pr.md",
    ".claude/commands/review.md",
    ".claude/rules/api-conventions.md",
    ".claude/rules/code-style.md",
    ".claude/rules/testing.md",
]


def test_default_template_has_expected_files():
    missing = [rel for rel in _EXPECTED if not (_DEFAULT / rel).is_file()]
    assert missing == [], f"missing bundled template files: {missing}"


def test_default_template_ships_a_skill_file():
    skills = _DEFAULT / ".claude" / "skills"
    assert skills.is_dir()
    # An empty dir won't survive packaging; require at least one real file.
    assert any(p.is_file() for p in skills.rglob("*"))


def test_claude_md_is_at_template_root_not_under_dotclaude():
    assert (_DEFAULT / "CLAUDE.md").is_file()
    assert not (_DEFAULT / ".claude" / "CLAUDE.md").exists()
