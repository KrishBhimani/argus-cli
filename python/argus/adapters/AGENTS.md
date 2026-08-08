# AGENTS.md — adapters (Claude Code transcript adapter)

Parent: `python/argus/AGENTS.md`. Parses agent transcript files into typed results.

## Purpose

`claude_code/` reads Claude Code's `.jsonl` transcripts: `adapter.py` discovers and
ingests files, `schemas.py` validates each line (`AssistantLine`, `UserLine`, …),
`extract_transcript.py` derives searchable segments.

## Local Contracts

- **Discovery excludes sub-agent files.** `discover_session_files()` returns
  top-level session files only; sub-agent transcripts are reached via
  `sub_session_files_for(parent_file)`, which walks the parent's `subagents/`
  directory (including the nested `subagents/workflows/<wf>/agent-*.jsonl` layout).
- **Sub-agent session id** = `<parent_session_id>/<sub_file_stem>` (e.g.
  `claude_code:<parent>/agent-<hex>`). The `/` is what marks a row as a sub-agent
  everywhere downstream.
- **`extract_transcript_segments`** emits `RawSegment`s with roles `assistant`,
  `thinking`, `user`, and `tool_result`; each is byte-capped (`_cap_text`). The
  first `user` segment of a sub-agent is its "Task given" in the dashboard.
- **Known data limitation — do not design against it:** `subagent_type` is empty
  for every row, sub-agent ids are exactly one level deep, and there is no stored
  workflow grouping or spawn-turn link. Don't build features that assume a nested
  sub-agent tree, type pills, or a spawn→child edge; the data isn't there.
- **`ingest_file(path, offset)` is pure-ish:** it parses from a byte offset and
  returns `(result, new_offset)`. It does not write to the DB — `collector/` owns
  persistence and offset bookkeeping.
- **Path containment is enforced at `ClaudeCodeAdapter.ingest_file`, and that is
  deliberate.** It is the one choke point every read reaches — discovery, the
  watcher's fs events, and the pipeline's sub-agent walk — so a path that doesn't
  `resolve()` under the adapter's root gets an empty result and a logged warning
  instead of being read. Don't move this check out to the callers: it lived only
  in `discover_session_files()` once, and `sub_agent_files_for()` plus the watcher
  silently bypassed it into an arbitrary-file-read (bytes reached `parse_errors`,
  which `GET /api/parse-errors` serves out). `sub_agent_files_for()` now *also*
  takes `claude_root` and filters — required, not optional, so a new caller must
  confront it. Covers symlinks and NTFS junctions alike (both resolve out).

## Verification

`uv run pytest tests/adapters`. Real-`~/.claude/` tests are gated by
`ARGUS_REAL_CLAUDE_ROOT` and skipped otherwise.
