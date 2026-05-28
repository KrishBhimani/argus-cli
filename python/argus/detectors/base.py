"""Detector contract.

Detectors are pure: they read from a Repository and return findings.
Writes are performed by the scheduler, not the detector. This split keeps
detectors trivially unit-testable and the alerts table single-writer.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Protocol, runtime_checkable

from ..schema.types import AlertSeverity

if TYPE_CHECKING:
    from ..store.repository import Repository


@dataclass(frozen=True)
class Finding:
    """One alert-shaped result returned by a detector."""

    detector: str
    dedup_key: str
    severity: AlertSeverity
    title: str
    message: str
    metadata: dict[str, Any] = field(default_factory=dict)


@runtime_checkable
class Detector(Protocol):
    name: str

    def detect(self, repo: "Repository", now_iso: str) -> list[Finding]: ...
