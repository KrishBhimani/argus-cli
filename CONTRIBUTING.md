# Contributing to Argus

Thanks for being here. Argus is a one-person project at this point, so
the bar for contributions is "does it make the tool better for people
running it?". Bug fixes, docs improvements, and small features are all
welcome — please skim this file before opening a big PR so we're not
working at cross-purposes.

If you're new to the codebase, **read [ARCHITECTURE.md](./ARCHITECTURE.md)
first** — it's a 5-minute tour of how the pieces fit together.

## Quick start

```sh
git clone https://github.com/KrishBhimani/argus-cli.git
cd argus-cli
uv sync               # creates .venv and installs deps + dev tools
uv run pytest         # ~120 tests, ~10s
uv run argus start    # fast iteration loop — runs directly from source
```

`uv run argus start` runs the Python source directly. No build step.
Change a file, restart, see the result.

If you don't have `uv` yet: <https://docs.astral.sh/uv/getting-started/installation/>.

## Running the built form

CI builds and tests on every push. To smoke-test the built wheel
locally exactly as a user would:

```sh
cd dashboard && npm ci && npm run build && cd ..
cp -r dashboard/dist dashboard-dist          # bundle the dashboard
uv build                                     # wheel + sdist in dist/
uv tool install ./dist/argus_cli-*.whl       # install globally
argus start
```

## Tests

```sh
uv run pytest                # one-shot
uv run pytest -k <expr>      # filter by test name
uv run pytest tests/store/   # by directory
uv run pytest --cov=argus    # with coverage
```

Tests live in a sibling `tests/` tree mirroring `python/argus/`
(e.g., `python/argus/store/repository.py` → `tests/store/test_repository.py`).
New features need new tests. Bug fixes need a regression test that
fails before the fix and passes after. See [TESTING.md](./TESTING.md)
for the full catalog.

## CI

`.github/workflows/test.yml` runs on every push and PR:

- **Test matrix:** Ubuntu, macOS, Windows × Python 3.11, 3.12, 3.13.
- **Dashboard build** (release-only): runs `npm ci && npm run build`
  before `uv build` to bundle the static dashboard into the wheel.

The Windows runner is non-negotiable — path normalisation, WAL `-shm`
cleanup, and short-name path quirks are all platform-sensitive.

If CI fails on a platform you don't have, mention it in the PR and we'll
help debug rather than asking you to set up a Windows VM.

## Code style

- Type-annotated Python (`from __future__ import annotations`,
  `int | None` over `Optional[int]`).
- Match the existing style. There's no separate lint config — read the
  neighboring files and mimic.
- Run `uv run pytest` before pushing. CI is a backstop, not a replacement.
- Conventional commit prefixes (`feat:`, `fix:`, `docs:`, `chore:`,
  `ci:`) for clarity. Not strictly enforced, but helpful.

## Areas to be careful

A few corners of the codebase have hidden complexity. If you're
touching them, take a beat.

### Path handling on Windows

The Windows filesystem is case-insensitive but Python's string
equality isn't. `discover_session_files()` lowercases both sides of
the canonical-root containment check before comparing, so case
differences in resolved paths don't silently reject every candidate.
If your change touches path comparison logic, test on Windows CI
before assuming it works.

### Pricing tables (`pricing/*.json`)

These are generated from LiteLLM via `argus pricing refresh`. Don't
hand-edit them. If you need to change pricing logic, look at
`python/argus/pricing/compute.py`.

### Schema migrations (`python/argus/store/migrations/inline.py`)

Append-only. Never edit a published migration. Add a new `MIGRATION_N+1`
and bump the `schema_version` check in `db.py`. SQLite in production
has data that depends on the exact SQL that already ran.

### Windowed aggregations

For any "last N days" / windowed view, query the **`turns`** table by
`timestamp`, NOT the **`sessions`** table by `started_at`. Session
totals are pre-summed across the session's lifetime — using them for
windowed views silently drops activity in sessions that started before
the window and dumps multi-day spend onto the session's start date in
heatmaps. The canonical helper is `Repository.aggregate_turns_by_day()`.
See [ARCHITECTURE.md](./ARCHITECTURE.md) for the data-model rationale.

### Adapters

The `Adapter` protocol in `python/argus/adapters/base.py` is what the
pipeline, watcher, and server depend on. Per-adapter packages
self-register via `@register` in their `adapter.py`. If you're adding
a new adapter (Codex, OpenClaw, Hermes, …), do not edit shared code
to special-case it — express the per-agent behavior through the
optional extension points (`extra_watch_paths`, `ingest_extra`,
`sub_session_files_for`, `should_skip`, `normalize_model_name`).

### Security model

`SECURITY.md` lists the invariants this codebase deliberately
maintains: `127.0.0.1` binding by default, CSRF Origin check, HTML
escaping, symlink rejection, parameterized SQL, no postinstall scripts.
If your change weakens any of those, call it out explicitly in the PR
description so review can focus there.

## Reporting bugs / requesting features

Use the issue templates:

- **Bug** — include OS, Python version, argus version, repro steps.
- **Feature** — describe the problem first, the solution second.

For **security issues**, do not open a public issue — see
[SECURITY.md](./SECURITY.md) for the private reporting path.

## License

By contributing, you agree your code ships under the MIT license (same
as the rest of the repo — see [LICENSE](./LICENSE)).
