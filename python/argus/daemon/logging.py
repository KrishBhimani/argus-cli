"""argusd log file: rotating handler + tail/follow helpers.

``follow`` implements ``tail -F`` semantics: it detects rotation (the live
file's identity changing or its size shrinking) and reopens the new file,
rather than ``tail -f`` which would silently stick to the old descriptor.
"""
from __future__ import annotations

import logging
import os
import time
from logging.handlers import RotatingFileHandler
from pathlib import Path

LOG_FILENAME = "argusd.log"
_MAX_BYTES = 1_000_000
_BACKUP_COUNT = 3


def log_path(data_dir: Path) -> Path:
    return Path(data_dir) / LOG_FILENAME


def setup_file_logging(data_dir: Path) -> RotatingFileHandler:
    """Attach a RotatingFileHandler to the 'argus' logger; return it."""
    p = log_path(data_dir)
    p.parent.mkdir(parents=True, exist_ok=True)
    handler = RotatingFileHandler(
        str(p), maxBytes=_MAX_BYTES, backupCount=_BACKUP_COUNT, encoding="utf-8"
    )
    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s %(levelname)s %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    )
    root = logging.getLogger("argus")
    root.setLevel(logging.INFO)
    root.addHandler(handler)
    return handler


def tail_lines(path: Path, n: int) -> list[str]:
    """Return the last ``n`` lines (logs are <=~1MB so read-all is fine)."""
    try:
        with Path(path).open("r", encoding="utf-8", errors="replace") as f:
            return f.readlines()[-n:]
    except FileNotFoundError:
        return []


def follow(
    path: Path,
    *,
    poll: float = 0.5,
    emit=print,
    stop_event=None,
) -> None:
    """Follow appends to ``path``, surviving rotation (``tail -F``).

    Opens/seeks/reads/closes on each poll rather than holding a long-lived
    handle: a held handle would (a) block the daemon's own rotation rename on
    Windows and (b) keep reading the renamed-away file. Rotation is detected
    by the file's identity changing or its size shrinking below our offset, at
    which point we start reading the new file from the top.

    ``stop_event`` (threading.Event) lets callers/tests break the loop.
    """
    path = Path(path)
    offset: int | None = None  # None => not yet initialized (tail from end)
    cur_id: tuple[int, int] | None = None
    buf = b""

    while stop_event is None or not stop_event.is_set():
        try:
            st = os.stat(path)
        except OSError:
            time.sleep(poll)
            continue

        fid = (st.st_dev, st.st_ino)
        size = st.st_size

        if offset is None:
            offset = size  # start at end — don't replay existing history
            cur_id = fid
        elif fid != cur_id or size < offset:
            offset = 0  # rotated or truncated — read the new file from 0
            cur_id = fid
            buf = b""

        if size > offset:
            with path.open("rb") as f:
                f.seek(offset)
                chunk = f.read()
                offset = f.tell()
            buf += chunk
            *lines, buf = buf.split(b"\n")
            for line in lines:
                # Strip a trailing CR so CRLF-written logs (Windows) emit clean.
                emit(line.rstrip(b"\r").decode("utf-8", errors="replace"))
        else:
            time.sleep(poll)
