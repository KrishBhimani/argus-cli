"""Shared core runtime: DB + repo + first-pass ingest + watcher + scheduler.

Extracted verbatim from the inline lifecycle that used to live in
``cli.py:start()`` (open_db → repo → adapters → first-pass → watcher →
scheduler, and the reverse on shutdown). Both ``argus start`` and the
``argusd`` daemon construct a CoreRuntime so neither duplicates the wiring.

``read_only=True`` opens the DB read-only and skips ALL ingestion (no
first-pass, no watcher, no scheduler) — used when the dashboard yields to a
live daemon. ``read_only=False`` reproduces today's in-process behavior
exactly.

``require_adapters=False`` (used by ``argusd``) turns "no adapter data on
this machine" from a fatal error into a wait: the runtime starts, idles, and
brings ingestion up on its own once ``~/.claude/`` appears. A long-running
service must survive a fresh machine where Claude Code hasn't run yet.
"""
from __future__ import annotations

import logging
import threading
from pathlib import Path

from ..adapters.base import Adapter
from ..adapters.registry import available_adapters
from ..collector.first_run import IngestStatus, run_first_pass_ingest
from ..collector.scheduler import start_scheduler
from ..collector.watcher import start_watcher
from ..detectors.registry import available_detectors
from ..pricing.load import load_pricing_table
from ..pricing.types import PricingTable
from ..store.db import open_db
from ..store.repository import Repository

logger = logging.getLogger("argus")

# Static status reported in read-only mode (the dashboard's footer falls
# back to its own DB-derived sessionCount, so processed/total are 0).
_READ_ONLY_STATUS = IngestStatus(
    foreground_complete=True, pending=0, processed=0, total=0
)


class NoAdaptersError(RuntimeError):
    """Raised when no adapter's data is present on this machine."""


_NO_ADAPTERS_MSG = (
    "No adapter data found. Argus expects ~/.claude/ (Claude Code) "
    "to be present at minimum."
)

# How often the waiting runtime re-checks for adapter data to appear.
_ADAPTER_POLL_SEC = 30.0


class CoreRuntime:
    def __init__(
        self,
        data_dir: Path,
        *,
        read_only: bool = False,
        recent_days: int = 30,
        require_adapters: bool = True,
        adapter_poll_sec: float = _ADAPTER_POLL_SEC,
    ) -> None:
        self._data_dir = Path(data_dir)
        self.read_only = read_only
        self._recent_days = recent_days
        self._require_adapters = require_adapters
        self._adapter_poll_sec = adapter_poll_sec
        self._db = None
        self.repo: Repository | None = None
        self.adapters: list[Adapter] = []
        self.pricing_table: PricingTable | None = None
        self._first_run = None
        self._watcher = None
        self._scheduler = None
        # Guards the "waiting for adapters" background thread against a
        # concurrent stop(): ingestion is only ever brought up under the lock,
        # and only while _stopped is False.
        self._lock = threading.Lock()
        self._stopped = False
        self._adapter_wait: threading.Thread | None = None
        self._adapter_wait_stop = threading.Event()

    def start(self) -> None:
        # A CoreRuntime is reusable: stop() then start() must behave like a
        # fresh instance, so clear the shutdown flags a previous stop() set.
        with self._lock:
            self._stopped = False
        self._adapter_wait_stop.clear()

        self._db = open_db(self._data_dir / "argus.db", read_only=self.read_only)
        self.repo = Repository(self._db)
        self.pricing_table = load_pricing_table()

        self.adapters = available_adapters()
        if not self.adapters:
            if self._require_adapters:
                raise NoAdaptersError(_NO_ADAPTERS_MSG)
            logger.warning(
                "%s Staying up and re-checking every %.0fs — ingestion starts "
                "as soon as it appears.",
                _NO_ADAPTERS_MSG,
                self._adapter_poll_sec,
            )
            if not self.read_only:
                self._start_adapter_wait()
            return

        logger.info("Detected adapters: %s", ", ".join(a.agent for a in self.adapters))

        if self.read_only:
            logger.info("argusd active — dashboard read-only (no ingest/scheduler).")
            return

        self._start_ingestion()

    # ─── Ingestion bring-up ────────────────────────────────────────────

    def _start_ingestion(self) -> None:
        """First-pass ingest + watcher + scheduler for ``self.adapters``."""
        logger.info("Argus: ingesting recent sessions...")
        self._first_run = run_first_pass_ingest(
            self.adapters, self.repo, self.pricing_table, recent_days=self._recent_days
        )
        self._first_run.wait_foreground()
        s = self._first_run.status()
        logger.info(
            "Argus: foreground ingest complete (%d/%d files), starting watcher...",
            s.processed,
            s.total,
        )

        self._watcher = start_watcher(self.adapters, self.repo, self.pricing_table)

        detectors = available_detectors()
        logger.info(
            "Loaded %d detectors: %s", len(detectors), [d.name for d in detectors]
        )
        self._scheduler = start_scheduler(detectors, self.repo)

    def _start_adapter_wait(self) -> None:
        if self._adapter_wait is not None and self._adapter_wait.is_alive():
            return  # already waiting; never run two pollers
        self._adapter_wait = threading.Thread(
            target=self._await_adapters, name="argus-adapter-wait", daemon=True
        )
        self._adapter_wait.start()

    def _await_adapters(self) -> None:
        """Poll until adapter data shows up, then bring ingestion up.

        Returns only once ingestion is running or stop() was called — a
        failed bring-up rolls back and keeps polling, so a transient error
        (locked DB, unreadable file) can't leave the daemon permanently
        blind until someone restarts it.
        """
        while not self._adapter_wait_stop.wait(self._adapter_poll_sec):
            try:
                adapters = available_adapters()
            except Exception:  # noqa: BLE001 — never kill the daemon over a probe
                logger.exception("Adapter probe failed — retrying.")
                continue
            if not adapters:
                continue
            with self._lock:
                if self._stopped or self._adapter_wait_stop.is_set():
                    return
                self.adapters = adapters
                logger.info(
                    "Adapter data appeared: %s — starting ingestion.",
                    ", ".join(a.agent for a in adapters),
                )
                try:
                    self._start_ingestion()
                except Exception:  # noqa: BLE001 — keep the daemon alive
                    logger.exception(
                        "Failed to start ingestion — retrying in %.0fs.",
                        self._adapter_poll_sec,
                    )
                    # Undo a partial bring-up so the retry doesn't orphan a
                    # half-wired watcher/scheduler.
                    self._stop_ingestion_locked()
                    self.adapters = []
                    continue
            return

    def ingest_status(self) -> IngestStatus:
        """Callable handed to the server. Static-complete in read-only mode."""
        if self._first_run is None:
            return _READ_ONLY_STATUS
        return self._first_run.status()

    def stop(self) -> None:
        # Signal the waiter first: it re-checks the flag under the lock before
        # bringing ingestion up, so after this it can only be finishing an
        # already-started bring-up — never beginning a new one.
        self._adapter_wait_stop.set()
        waiter, self._adapter_wait = self._adapter_wait, None
        if waiter is not None and waiter is not threading.current_thread():
            # Deliberately unbounded: the only thing we can still be waiting
            # on is an in-flight first-pass ingest, and closing the DB out
            # from under it would corrupt the shutdown. The wait is the same
            # one `argus start` has always done inline in start().
            waiter.join()

        with self._lock:
            self._stopped = True
            self._stop_ingestion_locked()
            if self._db is not None:
                self._db.close()
                self._db = None

    def _stop_ingestion_locked(self) -> None:
        """Tear down scheduler/watcher/first-pass, leaving the DB open."""
        if self._scheduler is not None:
            self._scheduler.stop()
            self._scheduler = None
        if self._watcher is not None:
            self._watcher.stop()
            self._watcher = None
        if self._first_run is not None:
            # Let the background backfill thread finish so it can't write to a
            # closed DB. Returns instantly if already done; bounded so a huge
            # backfill can't hang shutdown indefinitely.
            self._first_run.wait_backfill(timeout=10)
            self._first_run = None
