"""``argus`` CLI — typer subcommand tree."""
from __future__ import annotations

import logging
import shutil
import sys
import webbrowser
from importlib import resources
from pathlib import Path

import typer

import argus.detectors  # noqa: F401  — triggers @register side-effects

from .adapters.registry import available_adapters
from .collector.first_run import run_first_pass_ingest
from .collector.scheduler import start_scheduler
from .collector.watcher import start_watcher
from .detectors.registry import available_detectors
from .pricing.load import load_pricing_table
from .pricing.refresh import diff_pricing, fetch_litellm_table
from .server.app import ServerOpts, build_app, serve_blocking
from .store.db import open_db
from .store.repository import Repository

logger = logging.getLogger("argus")
app = typer.Typer(help="Local-first dashboard for coding-agent costs", no_args_is_help=True)
pricing_app = typer.Typer(help="Pricing-table operations")
search_app = typer.Typer(help="Manage transcript-search indexing")
app.add_typer(pricing_app, name="pricing")
app.add_typer(search_app, name="search")


def _setup_logging(quiet: bool = False, verbose: bool = False) -> None:
    level = logging.WARNING if quiet else (logging.DEBUG if verbose else logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )


def _dashboard_dir() -> Path:
    """Path of the bundled dashboard-dist (wheel) or repo-root one (dev)."""
    try:
        traversable = resources.files("argus") / "dashboard-dist"
        candidate = Path(str(traversable))
        if candidate.exists():
            return candidate
    except (ModuleNotFoundError, FileNotFoundError):
        pass
    return Path(__file__).resolve().parents[2] / "dashboard-dist"


def _default_data_dir() -> Path:
    return Path.home() / ".argus"


@app.command()
def start(
    port: int = typer.Option(4242, "-p", "--port"),
    host: str = typer.Option(
        "127.0.0.1",
        "--host",
        help=(
            "Bind host. Default 127.0.0.1 (loopback only). Pass 0.0.0.0 to "
            "expose on LAN — see SECURITY.md."
        ),
    ),
    data_dir: Path = typer.Option(_default_data_dir(), "--data-dir"),
    quiet: bool = typer.Option(False, "--quiet"),
    verbose: bool = typer.Option(False, "--verbose"),
) -> None:
    """Start the watcher, ingester, and dashboard server."""
    _setup_logging(quiet=quiet, verbose=verbose)

    db = open_db(data_dir / "argus.db")
    repo = Repository(db)

    adapters = available_adapters()
    if not adapters:
        typer.echo(
            "No adapter data found. Argus expects ~/.claude/ (Claude Code) "
            "to be present at minimum.",
            err=True,
        )
        raise typer.Exit(code=1)

    names = ", ".join(a.agent for a in adapters)
    logger.info("Detected adapters: %s", names)

    table = load_pricing_table()
    logger.info("Argus: ingesting recent sessions...")
    handle = run_first_pass_ingest(adapters, repo, table, recent_days=30)
    handle.wait_foreground()
    s = handle.status()
    logger.info(
        "Argus: foreground ingest complete (%d/%d files), starting watcher...",
        s.processed,
        s.total,
    )

    watcher = start_watcher(adapters, repo, table)

    detectors = available_detectors()
    logger.info("Loaded %d detectors: %s", len(detectors), [d.name for d in detectors])
    scheduler = start_scheduler(detectors, repo)

    dash_dir = _dashboard_dir()
    server_app = build_app(
        repo,
        ServerOpts(
            pricing_table_version=table.version,
            ingest_status=handle.status,
            dashboard_dir=dash_dir,
            port=port,
            host=host,
            adapters=adapters,
            pricing_table=table,
        ),
    )
    display_host = "localhost" if host in ("0.0.0.0", "::") else host
    url = f"http://{display_host}:{port}"
    logger.info("Argus running at %s", url)
    if host in ("0.0.0.0", "::"):
        logger.warning(
            "⚠ WARNING: bound to all network interfaces. Anyone on your LAN "
            "can read your prompt history, transcripts, and project paths."
        )
    try:
        webbrowser.open(url)
    except Exception:  # noqa: BLE001
        pass

    try:
        serve_blocking(server_app, host=host, port=port)
    except KeyboardInterrupt:
        pass
    finally:
        scheduler.stop()
        watcher.stop()
        db.close()
        logger.info("Argus stopped.")


@pricing_app.command("refresh")
def pricing_refresh() -> None:
    """Fetch the latest LiteLLM pricing and (after confirm) overwrite the bundled table."""
    _setup_logging()
    current = load_pricing_table()
    typer.echo("Fetching latest pricing from LiteLLM...")
    fresh = fetch_litellm_table()
    diff = diff_pricing(current, fresh)
    typer.echo(
        f"Added: {len(diff.added)}, Removed: {len(diff.removed)}, "
        f"Changed: {len(diff.changed)}, Unchanged: {len(diff.unchanged)}"
    )
    for k in diff.changed:
        typer.echo(f"  ~ {k}: {current.models[k].model_dump()} -> {fresh.models[k].model_dump()}")
    for k in diff.added:
        typer.echo(f"  + {k}: {fresh.models[k].model_dump()}")
    for k in diff.removed:
        typer.echo(f"  - {k}")
    if not (diff.added or diff.changed or diff.removed):
        typer.echo("Nothing to update.")
        return
    if not typer.confirm("Apply?"):
        typer.echo("Cancelled.")
        return
    # Write into the repo's pricing/ dir if we're in dev; otherwise into the
    # wheel's bundled dir (which is read-only for installed packages — print
    # a hint).
    try:
        traversable = resources.files("argus") / "pricing"
        out_dir = Path(str(traversable))
        if not out_dir.is_dir():
            raise FileNotFoundError(out_dir)
    except (ModuleNotFoundError, FileNotFoundError):
        out_dir = Path(__file__).resolve().parents[2] / "pricing"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / f"{fresh.version}.json"
    out_file.write_text(fresh.model_dump_json(indent=2), encoding="utf-8")
    typer.echo(f"Wrote {out_file}")


@search_app.command("status")
def search_status(data_dir: Path = typer.Option(_default_data_dir(), "--data-dir")) -> None:
    db = open_db(data_dir / "argus.db")
    repo = Repository(db)
    enabled = repo.is_search_indexing_enabled()
    segs = repo.segment_stats()
    typer.echo(f"Status:   {'ENABLED' if enabled else 'disabled'}")
    typer.echo(f"Indexed:  {segs['total']:,} segments across {segs['sessions']} sessions")
    if not enabled and segs["total"] > 0:
        typer.echo("Note:     existing segments stay on disk but are hidden from search")
        typer.echo("          until you re-enable. Use 'argus search clear' to wipe them.")


@search_app.command("enable")
def search_enable(data_dir: Path = typer.Option(_default_data_dir(), "--data-dir")) -> None:
    db = open_db(data_dir / "argus.db")
    repo = Repository(db)
    if repo.is_search_indexing_enabled():
        typer.echo("Already enabled.")
        segs = repo.segment_stats()
        typer.echo(f"Indexed: {segs['total']:,} segments across {segs['sessions']} sessions")
        return
    repo.set_search_indexing_enabled(True)
    typer.echo("Enabled. Run `argus start` to backfill — historical sessions will")
    typer.echo("index in the background. New sessions are indexed automatically.")


@search_app.command("disable")
def search_disable(data_dir: Path = typer.Option(_default_data_dir(), "--data-dir")) -> None:
    db = open_db(data_dir / "argus.db")
    repo = Repository(db)
    repo.set_search_indexing_enabled(False)
    segs = repo.segment_stats()
    typer.echo("Disabled.")
    if segs["total"] > 0:
        typer.echo(f"{segs['total']:,} existing segments are still on disk but hidden")
        typer.echo("from search. Run `argus search clear` to wipe them.")


@search_app.command("clear")
def search_clear(
    data_dir: Path = typer.Option(_default_data_dir(), "--data-dir"),
    yes: bool = typer.Option(False, "-y", "--yes"),
) -> None:
    db = open_db(data_dir / "argus.db")
    repo = Repository(db)
    segs = repo.segment_stats()
    if segs["total"] == 0:
        typer.echo("Nothing to clear (0 indexed segments).")
        repo.set_search_indexing_enabled(False)
        return
    if not yes and not typer.confirm(f"Delete {segs['total']:,} indexed segments?"):
        typer.echo("Cancelled.")
        return
    before_bytes = repo.db_size_bytes()
    repo.clear_all_segments()
    repo.set_search_indexing_enabled(False)
    repo.vacuum()
    after_bytes = repo.db_size_bytes()
    freed = max(0, before_bytes - after_bytes)

    def fmt(n: int) -> str:
        if n >= 1024 * 1024:
            return f"{n / 1024 / 1024:.1f} MB"
        if n >= 1024:
            return f"{n / 1024:.1f} KB"
        return f"{n} B"

    typer.echo(f"Deleted {segs['total']:,} segments.")
    typer.echo(f"Freed {fmt(freed)} on disk (DB now {fmt(after_bytes)}).")


@app.command()
def wipe(
    data_dir: Path = typer.Option(_default_data_dir(), "--data-dir"),
    yes: bool = typer.Option(False, "-y", "--yes"),
) -> None:
    """Delete all local Argus data."""
    if not yes and not typer.confirm(f"Delete {data_dir}?"):
        typer.echo("Cancelled.")
        return
    if data_dir.exists():
        shutil.rmtree(data_dir)
    typer.echo(f"Deleted {data_dir}")


def main() -> None:
    app()


if __name__ == "__main__":
    main()
