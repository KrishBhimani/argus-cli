"""Adapter registry.

Each Adapter class self-registers at import time via ``@register``.
"""
from __future__ import annotations

from .base import Adapter

_REGISTRY: dict[str, type[Adapter]] = {}


def register(cls: type[Adapter]) -> type[Adapter]:
    """Class decorator — adds ``cls`` to the registry by ``cls.agent``."""
    _REGISTRY[cls.agent] = cls
    return cls


def available_adapters() -> list[Adapter]:
    """Instantiate every registered adapter whose ``is_present()`` is True."""
    out: list[Adapter] = []
    for cls in _REGISTRY.values():
        a = cls()
        if a.is_present():
            out.append(a)
    return out


def registered_adapter_names() -> list[str]:
    """Names of every adapter the registry knows about (present or not)."""
    return list(_REGISTRY.keys())
