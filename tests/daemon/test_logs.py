"""argusd.log setup, tail, and rotation-aware follow."""
from __future__ import annotations

import logging
import threading
import time

from argus.daemon import logging as dlog


def test_log_path(tmp_path):
    assert dlog.log_path(tmp_path) == tmp_path / "argusd.log"


def test_tail_lines_returns_last_n(tmp_path):
    p = dlog.log_path(tmp_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("".join(f"line {i}\n" for i in range(10)), encoding="utf-8")
    assert dlog.tail_lines(p, 3) == ["line 7\n", "line 8\n", "line 9\n"]


def test_tail_lines_missing_file(tmp_path):
    assert dlog.tail_lines(tmp_path / "nope.log", 5) == []


def test_setup_file_logging_writes_to_argusd_log(tmp_path):
    handler = dlog.setup_file_logging(tmp_path)
    try:
        logging.getLogger("argus").warning("hello-daemon")
        handler.flush()
        text = dlog.log_path(tmp_path).read_text(encoding="utf-8")
        assert "hello-daemon" in text
    finally:
        logging.getLogger("argus").removeHandler(handler)
        handler.close()


def test_follow_survives_rotation(tmp_path):
    p = dlog.log_path(tmp_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("", encoding="utf-8")

    captured: list[str] = []
    stop = threading.Event()
    t = threading.Thread(
        target=dlog.follow,
        args=(p,),
        kwargs={"poll": 0.02, "emit": captured.append, "stop_event": stop},
        daemon=True,
    )
    t.start()
    try:
        with p.open("a", encoding="utf-8") as f:
            f.write("before-rotation\n")
        time.sleep(0.15)

        # Simulate RotatingFileHandler rollover: rename current, create new.
        rotated = p.with_suffix(".log.1")
        p.rename(rotated)
        p.write_text("", encoding="utf-8")
        time.sleep(0.15)
        with p.open("a", encoding="utf-8") as f:
            f.write("after-rotation\n")
        time.sleep(0.2)
    finally:
        stop.set()
        t.join(timeout=2)

    assert "before-rotation" in captured
    assert "after-rotation" in captured
