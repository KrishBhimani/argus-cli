"""Discovery of workflow run records (`<sid>/workflows/wf_*.json`)."""
from __future__ import annotations

import sys

import pytest

from argus.adapters.claude_code.discover import workflow_record_files_for


def _session(root, sid="s1"):
    proj = root / "projects" / "p1"
    proj.mkdir(parents=True, exist_ok=True)
    f = proj / f"{sid}.jsonl"
    f.write_text("", encoding="utf-8")
    return f


def test_finds_workflow_records(tmp_path):
    root = tmp_path / ".claude"
    sf = _session(root)
    wf = sf.parent / "s1" / "workflows"
    wf.mkdir(parents=True)
    (wf / "wf_abc.json").write_text("{}", encoding="utf-8")
    (wf / "wf_def.json").write_text("{}", encoding="utf-8")
    found = workflow_record_files_for(sf, root)
    assert [p.name for p in found] == ["wf_abc.json", "wf_def.json"]


def test_ignores_scripts_subdir_and_non_wf_json(tmp_path):
    # Only wf_*.json directly under workflows/ are records. scripts/*.js is the
    # orchestration source (already inlined in the record) and must not be read.
    root = tmp_path / ".claude"
    sf = _session(root)
    wf = sf.parent / "s1" / "workflows"
    (wf / "scripts").mkdir(parents=True)
    (wf / "scripts" / "audit-wf_abc.js").write_text("//", encoding="utf-8")
    (wf / "scripts" / "wf_sneaky.json").write_text("{}", encoding="utf-8")
    (wf / "notes.json").write_text("{}", encoding="utf-8")
    assert workflow_record_files_for(sf, root) == []


def test_missing_workflows_dir_returns_empty(tmp_path):
    root = tmp_path / ".claude"
    sf = _session(root)
    assert workflow_record_files_for(sf, root) == []


@pytest.mark.skipif(sys.platform == "win32", reason="symlink needs admin on Windows")
def test_symlink_escaping_the_root_is_refused(tmp_path, caplog):
    # Regression: containment is mandatory at every file-reading call site.
    root = tmp_path / ".claude"
    sf = _session(root)
    wf = sf.parent / "s1" / "workflows"
    wf.mkdir(parents=True)
    outside = tmp_path / "secret.json"
    outside.write_text("{}", encoding="utf-8")
    (wf / "wf_evil.json").symlink_to(outside)
    assert workflow_record_files_for(sf, root) == []
    assert "escapes the claude root" in caplog.text
