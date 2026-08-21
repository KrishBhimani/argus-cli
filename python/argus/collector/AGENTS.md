# AGENTS.md — collector (ingest pipeline + backfill)

Parent: `python/argus/AGENTS.md`. Turns transcript files into stored rows.

## Purpose

`pipeline.py` ingests one file tick; `first_run.py` orchestrates the first-pass
ingest (foreground recent files, background older files) and backfills derived data
after a schema/feature upgrade.

## Local Contracts

- **Offset-driven reads.** `ingest_file` reads only bytes after the stored file
  offset, upserts turns/tool_calls/segments, then recomputes the session. A
  fully-read file sits at EOF and is **not** re-read on the next tick. To force a
  re-extract you MUST reset its offset to 0 (`repo.set_file_offset(path, 0)`) —
  re-calling `ingest_file` alone does nothing for an EOF file.
- **Sub-agents are walked via the parent.** A parent ingest discovers
  `adapter.sub_session_files_for(parent)` and ingests any that **grew past their
  offset**. Sub-agent session ids contain `/` (`<parent>/agent-<hex>`).
- **Segments are gated on indexing.** Parent and sub-agent segments are written
  only when `repo.is_search_indexing_enabled()` (see `store/AGENTS.md`). So
  enabling indexing *after* ingest requires re-reading the relevant files.
- **Backfill (`_backfill_missing_derived_data`) routes through parents.** Ids with
  `/` are skipped by the processing loop ("walked via parents"). Anything needing a
  sub-agent file re-read must add the **parent** id to both the work set and
  `deep_reset` (deep_reset zeroes the sub-agent file offsets). Missing-segment
  sessions therefore map to their parent + deep_reset — otherwise sub-agent
  segments never backfill and the dashboard's "Task given" stays empty.
- **One-shot backfills are flagged in `app_meta`.** The Agent/Task `subagent_type`
  re-read (`backfill_agent_subagent_type_v1`) marks itself done once its candidate
  list fits in a run, because default-agent calls are NULL forever and would
  otherwise re-trigger every start.
- **Bounded per run.** Backfill candidates are capped (200) per `argus start`;
  large installs may need several restarts to converge. If you add a new bounded
  sweep, surface what was deferred rather than silently truncating.

## Verification

`uv run pytest tests/collector` — covers incremental re-ingest, sub-agent
backfill, segment gating, and the "enable indexing late" path.
