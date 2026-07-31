from pathlib import Path

from argus.adapters.claude_code.discover import discover_session_files, sub_agent_files_for


def test_finds_top_level_jsonl_files(tmp_path: Path):
    proj = tmp_path / "projects" / "C--proj"
    proj.mkdir(parents=True)
    (proj / "s1.jsonl").write_text("{}\n", encoding="utf-8")
    (proj / "s2.jsonl").write_text("{}\n", encoding="utf-8")
    (proj / "sessions-index.json").write_text("[]", encoding="utf-8")
    files = discover_session_files(tmp_path)
    jsonl = [f for f in files if f.suffix == ".jsonl"]
    assert len(jsonl) == 2
    assert not any(f.name == "sessions-index.json" for f in files)


def test_returns_sub_agent_files_for_a_session(tmp_path: Path):
    proj = tmp_path / "projects" / "C--proj"
    subdir = proj / "s1" / "subagents"
    subdir.mkdir(parents=True)
    (subdir / "agent-aabc.jsonl").write_text("{}\n", encoding="utf-8")
    (subdir / "agent-acompact-def.jsonl").write_text("{}\n", encoding="utf-8")
    subs = sub_agent_files_for(proj / "s1.jsonl", tmp_path)
    assert len(subs) == 2


def test_returns_empty_array_when_no_subagents_dir(tmp_path: Path):
    proj = tmp_path / "projects" / "C--proj"
    proj.mkdir(parents=True)
    assert sub_agent_files_for(proj / "s1.jsonl", tmp_path) == []


def test_finds_nested_workflow_subagents(tmp_path: Path):
    proj = tmp_path / "projects" / "C--proj"
    wf = proj / "s1" / "subagents" / "workflows" / "wf_abc"
    wf.mkdir(parents=True)
    (wf / "agent-a111.jsonl").write_text("{}\n", encoding="utf-8")
    (wf / "agent-a222.jsonl").write_text("{}\n", encoding="utf-8")
    # Bookkeeping + sidecars must NOT be picked up.
    (wf / "journal.jsonl").write_text('{"type":"started"}\n', encoding="utf-8")
    (wf / "agent-a111.meta.json").write_text("{}", encoding="utf-8")
    subs = sub_agent_files_for(proj / "s1.jsonl", tmp_path)
    names = {f.name for f in subs}
    assert names == {"agent-a111.jsonl", "agent-a222.jsonl"}


def test_finds_flat_and_nested_subagents_together(tmp_path: Path):
    proj = tmp_path / "projects" / "C--proj"
    sub = proj / "s1" / "subagents"
    wf = sub / "workflows" / "wf_abc"
    wf.mkdir(parents=True)
    (sub / "agent-flat.jsonl").write_text("{}\n", encoding="utf-8")
    (wf / "agent-nested.jsonl").write_text("{}\n", encoding="utf-8")
    subs = sub_agent_files_for(proj / "s1.jsonl", tmp_path)
    assert {f.name for f in subs} == {"agent-flat.jsonl", "agent-nested.jsonl"}


def test_warns_when_subdirs_present_but_nothing_matches(tmp_path, caplog):
    proj = tmp_path / "projects" / "C--proj"
    wf = proj / "s1" / "subagents" / "workflows" / "wf_abc"
    wf.mkdir(parents=True)
    # Unknown naming convention — nothing matches the allowlist.
    (wf / "sub-a111.jsonl").write_text("{}\n", encoding="utf-8")
    with caplog.at_level("WARNING"):
        subs = sub_agent_files_for(proj / "s1.jsonl", tmp_path)
    assert subs == []
    assert any("layout may have changed" in r.message for r in caplog.records)
