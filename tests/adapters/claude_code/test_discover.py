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
    subs = sub_agent_files_for(proj / "s1.jsonl")
    assert len(subs) == 2


def test_returns_empty_array_when_no_subagents_dir(tmp_path: Path):
    proj = tmp_path / "projects" / "C--proj"
    proj.mkdir(parents=True)
    assert sub_agent_files_for(proj / "s1.jsonl") == []
