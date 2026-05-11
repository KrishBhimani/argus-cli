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
npm install
npm test        # 98 tests, ~3s
npm run dev     # tsx src/cli.ts start — fast iteration loop
```

`npm run dev` runs the TypeScript directly via `tsx`. No build step.
Change a file, restart, see the result.

## Running the built form

CI builds and tests on every push. To run the same compiled output
locally:

```sh
npm run build                        # tsc + astro build
node dist/cli.js start               # what ships in the npm tarball
```

Or, to smoke-test the binary path exactly as a user would invoke it:

```sh
npm link
argus start
```

## Tests

```sh
npm test            # one-shot
npm run test:watch  # vitest --watch
```

Tests live next to the code (`src/foo.ts` → `src/foo.test.ts`). New
features need new tests. Bug fixes need a regression test that fails
before the fix and passes after.

## CI

`.github/workflows/ci.yml` runs three jobs on every push and PR:

- **Test** on Ubuntu, macOS, and Windows (Node 22).
- **Build** on Ubuntu (the dashboard build script uses POSIX `cp`/`rm`).
- **Audit** — `npm audit --audit-level=high --omit=dev`.

If CI fails on a platform you don't have, mention it in the PR and we'll
help debug rather than asking you to set up a Windows VM.

## Code style

- TypeScript strict mode. Avoid `any` without a comment justifying it.
- Match the existing style. There's no separate lint config — read the
  neighboring files and mimic.
- Run `npm test` before pushing. CI is a backstop, not a replacement.
- Conventional commit prefixes (`feat:`, `fix:`, `docs:`, `chore:`,
  `ci:`) for clarity. Not strictly enforced, but helpful.

## Areas to be careful

A few corners of the codebase have hidden complexity. If you're
touching them, take a beat.

### Path handling on Windows

We hit this once already: Node's `realpathSync` and async `realpath`
behave differently on Windows for 8.3 short-name paths (`RUNNER~1`
vs `runneradmin`). If your change does anything with file paths, test
on Windows CI before assuming it works. Don't mix sync and async
path-resolving APIs in the same containment check.

### Pricing tables (`pricing/*.json`)

These are generated from LiteLLM via `argus pricing refresh`. Don't
hand-edit them. If you need to change pricing logic, look at
`src/pricing/compute.ts`.

### Schema migrations (`src/store/migrations/inline.ts`)

Append-only. Never edit a published migration. Add a new `MIGRATION_N+1`
and bump the `schema_version` check in `db.ts`. SQLite in production
has data that depends on the exact SQL that already ran.

### Windowed aggregations

For any "last N days" / windowed view, query the **`turns`** table by
`timestamp`, NOT the **`sessions`** table by `started_at`. Session
totals are pre-summed across the session's lifetime — using them for
windowed views silently drops activity in sessions that started before
the window and dumps multi-day spend onto the session's start date in
heatmaps. The canonical helper is `Repository.aggregateTurnsByDay()`.
See [ARCHITECTURE.md](./ARCHITECTURE.md) for the data-model rationale.

### Security model

`SECURITY.md` lists the invariants this codebase deliberately
maintains: `127.0.0.1` binding by default, CSRF Origin check, HTML
escaping, symlink rejection, parameterized SQL, no postinstall scripts.
If your change weakens any of those, call it out explicitly in the PR
description so review can focus there.

## Reporting bugs / requesting features

Use the issue templates:

- **Bug** — include OS, Node version, argus version, repro steps.
- **Feature** — describe the problem first, the solution second.

For **security issues**, do not open a public issue — see
[SECURITY.md](./SECURITY.md) for the private reporting path.

## License

By contributing, you agree your code ships under the MIT license (same
as the rest of the repo — see [LICENSE](./LICENSE)).
