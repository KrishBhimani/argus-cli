"""Detector registry. Mirrors argus.adapters.registry verbatim."""
from __future__ import annotations

from .base import Detector

_REGISTRY: dict[str, type[Detector]] = {}


def register(cls):
    """Class decorator — adds ``cls`` to the registry by ``cls.name``."""
    _REGISTRY[cls.name] = cls
    return cls


def available_detectors() -> list[Detector]:
    return [cls() for cls in _REGISTRY.values()]


def registered_detector_names() -> list[str]:
    return list(_REGISTRY.keys())
