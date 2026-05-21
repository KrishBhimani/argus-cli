"""Pricing-table model — direct port of src/pricing/types.ts."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ModelPricing(BaseModel):
    model_config = ConfigDict(extra="allow")

    input: float
    output: float
    cache_write_5m: float | None = None
    cache_write_1h: float | None = None
    cache_read: float


class PricingTable(BaseModel):
    model_config = ConfigDict(extra="allow")

    version: str
    models: dict[str, ModelPricing] = Field(default_factory=dict)
