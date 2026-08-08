"""`template create` must not snapshot credentials into a reusable template.

docs/SECURITY_AUDIT_2026-07-31.md #8. `_safe_top_files` copied every top-level
file in `.claude/`, excluding only `history.jsonl` and `*.local.json`. A real
`~/.claude/` holds `.credentials.json` (OAuth tokens) and `.env`.

There is no remote attacker here — it is a footgun, but the dangerous path is
the *inviting* one. `--path` defaults to `.`, so a user who has tuned their
global setup and runs `argus claude template create mysetup` from their home
directory copies their tokens into ~/.argus/templates/<name>/, and from there
into every project scaffolded from it — projects people commit to git.

The guard is deliberately paired with a loud report rather than a silent drop:
a heuristic that quietly omits a file the user wanted is its own bug, so the
CLI prints what it withheld.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from argus.scaffold.snapshot import secret_files_in, snapshot_template


def _home_shaped_claude(tmp_path: Path) -> Path:
    """A `.claude/` shaped like a real ~/.claude — secrets and all."""
    proj = tmp_path / "home"
    claude = proj / ".claude"
    claude.mkdir(parents=True)
    # Secrets that must never be snapshotted.
    (claude / ".credentials.json").write_text('{"oauth":"tok"}', encoding="utf-8")
    (claude / ".env").write_text("ANTHROPIC_API_KEY=sk-ant-secret", encoding="utf-8")
    # Legitimate config that must still be snapshotted.
    (claude / "settings.json").write_text('{"theme":"dark"}', encoding="utf-8")
    (claude / "CLAUDE.md").write_text("# my setup", encoding="utf-8")
    return proj


SECRET_NAMES = [
    ".credentials.json",
    "credentials.json",
    ".env",
    ".env.local",
    "my-api-key.txt",
    "auth-token.json",
    "client_secret.json",
]


@pytest.mark.parametrize("name", SECRET_NAMES)
def test_secret_files_are_recognised(name: str):
    assert secret_files_in.__module__  # sanity: imported
    from argus.scaffold.snapshot import is_secret_file

    assert is_secret_file(name), f"{name} should be treated as a secret"


@pytest.mark.parametrize("name", ["settings.json", "CLAUDE.md", "notes.md", "tools.md"])
def test_ordinary_files_are_not_flagged(name: str):
    from argus.scaffold.snapshot import is_secret_file

    assert not is_secret_file(name), f"{name} was wrongly treated as a secret"


def test_snapshot_omits_credentials_but_keeps_config(tmp_path: Path):
    proj = _home_shaped_claude(tmp_path)

    target = snapshot_template(proj, "mysetup", tmp_path / "data", include_subdirs=[])

    copied = {p.name for p in (target / ".claude").iterdir()}
    assert ".credentials.json" not in copied, "OAuth tokens were snapshotted"
    assert ".env" not in copied, "env secrets were snapshotted"
    # Fail-closed must not mean fail-always.
    assert copied == {"settings.json", "CLAUDE.md"}


def test_secret_files_in_reports_what_was_withheld(tmp_path: Path):
    """The CLI needs this to tell the user, rather than silently dropping."""
    proj = _home_shaped_claude(tmp_path)

    withheld = secret_files_in(proj / ".claude")

    assert set(withheld) == {".credentials.json", ".env"}


def test_snapshot_does_not_dereference_a_symlinked_top_file(tmp_path: Path):
    """A link out of the tree must not pull its target's contents in."""
    proj = tmp_path / "proj"
    claude = proj / ".claude"
    claude.mkdir(parents=True)
    (claude / "settings.json").write_text("{}", encoding="utf-8")
    outside = tmp_path / "id_rsa"
    outside.write_text("PRIVATE KEY", encoding="utf-8")
    try:
        (claude / "notes.md").symlink_to(outside)
    except (OSError, NotImplementedError) as exc:  # pragma: no cover - env dependent
        pytest.skip(f"symlinks not permitted here: {exc}")

    target = snapshot_template(proj, "t", tmp_path / "data", include_subdirs=[])

    assert not (target / ".claude" / "notes.md").exists()
    assert (target / ".claude" / "settings.json").exists()
