# AGENTS.md — server (FastAPI app + API)

Parent: `python/argus/AGENTS.md`. Serves the API and the static dashboard at
`http://localhost:4242`.

## Purpose

`app.py` builds the app, serves the dashboard, and runs uvicorn; `api.py` defines
the `/api/...` routes over the repository.

## Local Contracts

- **Route registration order is load-bearing.** Session ids use the greedy
  `{session_id:path}` converter (so sub-agent ids containing `/` match). The bare
  `GET /api/sessions/{session_id:path}` handler must be registered **last** — any
  suffix route (`/timeline`, `/tool-output/{tool_use_id}`, `/transcript`,
  `/subagents`) must be declared **before** it, or the bare route shadows them. Add
  new session subroutes above the bare handler.
- **`/api/workflows*` is a fresh top-level prefix**, so it never collides with the
  greedy `{session_id:path}` route. The three routes are declared **above** the
  bare session handler (keeping "the bare route is last" literally true), and
  `/api/workflows/{run_id}/script` is declared **before** the bare
  `/api/workflows/{run_id}` for the same ordering reason. `GET
  /api/sessions/{id}/subagents` gained an additive `workflow_runs` key; existing
  consumers of `subagents` are untouched. Every new route is a GET, so daemon
  read-only mode is unaffected.
- **Static assets carry explicit `Cache-Control`.** `SafeStaticFiles.file_response`
  sends `no-cache` (revalidate-before-use) for stable-URL files (the HTML entry
  points, `/styles/global.css`) and `immutable` for content-hashed `_astro/*`.
  Without this the browser heuristically caches the HTML and shows a stale
  nav/stylesheet after an argus upgrade until a manual hard reload.
- **Static serving tolerates Windows path quirks.** The dashboard mount uses
  `SafeStaticFiles`, whose `lookup_path` swallows `OSError` and returns
  `("", None)` — needed because a `:` in a URL segment makes Starlette raise on
  Windows. Keep that subclass; don't mount plain `StaticFiles`.
- **Clean shutdown.** `serve_blocking` pre-installs SIGINT/SIGTERM handlers that
  flip uvicorn's `should_exit` (then `force_exit`) before `server.run()`, and
  restores the previous handlers in a `finally`. This is what makes Ctrl+C exit
  without a traceback — don't remove it.
- **Read-only under the daemon.** When `argusd` is running, mutating endpoints
  return 409 pointing at the CLI (`argus indexing enable`) or `argus daemon stop`.
- **The Origin allowlist is exact, and port-aware.** `is_allowed_origin(origin,
  port)` matches argus's own origin only — never a prefix, never "any loopback
  port". Loopback is a neighbourhood of mutually untrusting web origins (a dev
  server on `:3000`, a notebook on `:8888`), not one principal. Anything
  constructing the app must pass the real `opts.port` or same-origin POSTs break.
- **A loopback `Host` header is required** (`is_loopback_host` + the
  `host_header_check` middleware). This is the DNS-rebinding guard: the Origin
  check exempts GET and every data-bearing route is a GET, so without this a page
  that rebinds its own domain to `127.0.0.1` becomes same-origin in the browser
  and can read the user's entire prompt history. Don't relax it to satisfy a
  test — `TestClient` defaults to `Host: testserver`, so tests must pass
  `base_url=LOOPBACK`. The check is skipped only when the user deliberately bound
  a non-loopback interface (`--host 0.0.0.0`), which is a warned opt-out.

## Verification

`uv run pytest tests/server` — covers route ordering, `SafeStaticFiles`, and the
sub-agent URL (no 500).
