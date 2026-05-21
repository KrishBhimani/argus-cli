import json
from pathlib import Path

from argus.adapters.claude_code.history_jsonl import HistoryLine, ingest_history_file, line_to_prompt
from argus.store.repository import Repository, normalize_project_path


def _hl(**kw):
    base = {"display": kw.get("display", ""), "pastedContents": kw.get("pastedContents", {}),
            "timestamp": kw.get("timestamp", 1), "project": kw.get("project", "/p")}
    return HistoryLine.model_validate(base)


def test_skips_empty_or_whitespace_display():
    assert line_to_prompt(_hl(display="")) is None
    assert line_to_prompt(_hl(display="   ")) is None


def test_flags_slash_commands():
    r = line_to_prompt(_hl(display="/exit"))
    assert r is not None and r.is_slash == 1
    r2 = line_to_prompt(_hl(display="hello"))
    assert r2 is not None and r2.is_slash == 0


def test_normalizes_windows_project_path():
    r = line_to_prompt(_hl(display="hi", project="C:\\documents\\GEN AI\\My Project"))
    assert r is not None
    assert r.project_path == normalize_project_path("C:\\documents\\GEN AI\\My Project")
    assert "\\" not in r.project_path


def test_pasted_chars_zero_when_no_paste():
    r = line_to_prompt(_hl(display="hi"))
    assert r is not None and r.pasted_chars == 0


def test_pasted_chars_nonzero_when_paste_present():
    r = line_to_prompt(_hl(display="hi", pastedContents={"1": {"content": "large"}}))
    assert r is not None and r.pasted_chars > 0


def test_truncates_display_past_8kb_cap():
    huge = "x" * 20_000
    r = line_to_prompt(_hl(display=huge))
    assert r is not None
    assert len(r.display) < len(huge)
    assert r.display.endswith("…")


def test_preserves_leading_slash_after_trim():
    r = line_to_prompt(_hl(display="   /clear"))
    assert r is not None and r.is_slash == 1


# ─── ingest_history_file ───────────────────────────────────────────────


def _write_lines(path: Path, lines: list[dict]) -> None:
    path.write_text("\n".join(json.dumps(l) for l in lines) + "\n", encoding="utf-8")


def _append_line(path: Path, line: dict) -> None:
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(line) + "\n")


def test_reads_new_bytes_only_on_subsequent_calls(tmp_path: Path, repo: Repository):
    path = tmp_path / "history.jsonl"
    _write_lines(path, [{"display": "hello", "pastedContents": {}, "timestamp": 1000, "project": "/p"}])
    first = ingest_history_file(path, repo)
    assert first.inserted == 1

    _append_line(path, {"display": "world", "pastedContents": {}, "timestamp": 2000, "project": "/p"})
    second = ingest_history_file(path, repo)
    assert second.inserted == 1
    assert repo.prompt_stats()["total"] == 2


def test_holds_back_partial_last_line(tmp_path: Path, repo: Repository):
    path = tmp_path / "history.jsonl"
    complete = json.dumps({"display": "a", "pastedContents": {}, "timestamp": 1000, "project": "/p"}) + "\n"
    partial = '{"display":"b","timestamp":2000,"project":"/p"'
    path.write_text(complete + partial, encoding="utf-8")
    r1 = ingest_history_file(path, repo)
    assert r1.inserted == 1
    with path.open("a", encoding="utf-8") as f:
        f.write(',"pastedContents":{}}\n')
    r2 = ingest_history_file(path, repo)
    assert r2.inserted == 1


def test_skips_malformed_lines(tmp_path: Path, repo: Repository):
    path = tmp_path / "history.jsonl"
    lines = [
        json.dumps({"display": "good", "pastedContents": {}, "timestamp": 1, "project": "/p"}),
        "not-json",
        json.dumps({"display": "good2", "pastedContents": {}, "timestamp": 2, "project": "/p"}),
    ]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    r = ingest_history_file(path, repo)
    assert r.inserted == 2
    assert r.parse_errors == 1


def test_resets_offset_when_file_shrinks(tmp_path: Path, repo: Repository):
    path = tmp_path / "history.jsonl"
    big = "x" * 500
    _write_lines(path, [
        {"display": big + " a", "pastedContents": {}, "timestamp": 1, "project": "/p"},
        {"display": big + " b", "pastedContents": {}, "timestamp": 2, "project": "/p"},
        {"display": big + " c", "pastedContents": {}, "timestamp": 3, "project": "/p"},
    ])
    first = ingest_history_file(path, repo)
    assert first.inserted == 3

    _write_lines(path, [{"display": "fresh", "pastedContents": {}, "timestamp": 4, "project": "/p"}])
    r = ingest_history_file(path, repo)
    assert r.inserted == 1


def test_fts5_search_returns_marked_matches(tmp_path: Path, repo: Repository):
    path = tmp_path / "history.jsonl"
    _write_lines(path, [
        {"display": "how do I configure vitest", "pastedContents": {}, "timestamp": 1, "project": "/p"},
        {"display": "unrelated prompt", "pastedContents": {}, "timestamp": 2, "project": "/p"},
        {"display": "vitest hangs in CI", "pastedContents": {}, "timestamp": 3, "project": "/p"},
    ])
    ingest_history_file(path, repo)
    r = repo.search_prompts(q="vitest", limit=10)
    assert r["total"] == 2
    assert all("<mark>" in row["snippet"] for row in r["rows"])


def test_empty_query_returns_chronological_recents(tmp_path: Path, repo: Repository):
    path = tmp_path / "history.jsonl"
    _write_lines(path, [
        {"display": "old", "pastedContents": {}, "timestamp": 1000, "project": "/p"},
        {"display": "middle", "pastedContents": {}, "timestamp": 2000, "project": "/p"},
        {"display": "newest", "pastedContents": {}, "timestamp": 3000, "project": "/p"},
    ])
    ingest_history_file(path, repo)
    r = repo.search_prompts(limit=10)
    assert r["rows"][0]["display"] == "newest"
    assert r["rows"][2]["display"] == "old"


def test_slash_excluded_by_default_includeable_via_flag(tmp_path: Path, repo: Repository):
    path = tmp_path / "history.jsonl"
    _write_lines(path, [
        {"display": "/exit", "pastedContents": {}, "timestamp": 1, "project": "/p"},
        {"display": "real prompt", "pastedContents": {}, "timestamp": 2, "project": "/p"},
    ])
    ingest_history_file(path, repo)
    assert repo.search_prompts(limit=10)["total"] == 1
    assert repo.search_prompts(limit=10, include_slash=True)["total"] == 2
