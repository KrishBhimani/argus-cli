"""FastAPI app builder + uvicorn launcher."""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import uvicorn
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from ..adapters.base import Adapter
from ..collector.first_run import FirstRunHandle
from ..pricing.types import PricingTable
from ..store.repository import Repository
from .api import ApiDeps, build_api, is_allowed_origin

logger = logging.getLogger(__name__)


@dataclass
class ServerOpts:
    pricing_table_version: str
    ingest_status: Any  # callable returning IngestStatus
    dashboard_dir: Path
    port: int
    adapters: list[Adapter]
    pricing_table: PricingTable
    host: str = "127.0.0.1"


def build_app(repo: Repository, opts: ServerOpts) -> FastAPI:
    """Build the FastAPI app with CSRF middleware, API routes, static mount."""
    app = FastAPI(title="Argus", docs_url=None, redoc_url=None, openapi_url=None)

    @app.exception_handler(RequestValidationError)
    async def on_validation_error(request: Request, exc: RequestValidationError):
        return JSONResponse(
            {"error": "bad request", "detail": exc.errors()}, status_code=400
        )

    # CSRF origin guard for state-changing requests. GETs are unrestricted
    # because the dashboard issues same-origin GETs without an Origin
    # header in some setups; POSTs from browsers always carry Origin.
    @app.middleware("http")
    async def csrf_origin_check(request: Request, call_next):
        method = request.method
        if method in ("GET", "HEAD", "OPTIONS"):
            return await call_next(request)
        # Allow API-prefixed paths to enforce the check; non-API endpoints
        # don't exist on this server today, but apply uniformly.
        if not is_allowed_origin(request.headers.get("origin")):
            return JSONResponse(
                {"error": "cross-origin requests not allowed"}, status_code=403
            )
        return await call_next(request)

    api = build_api(
        repo,
        ApiDeps(
            pricing_table_version=opts.pricing_table_version,
            ingest_status=opts.ingest_status,
            adapters=opts.adapters,
            pricing_table=opts.pricing_table,
        ),
    )
    app.include_router(api)

    # Static dashboard mount LAST so /api/* routes win.
    if opts.dashboard_dir.exists():
        app.mount(
            "/",
            StaticFiles(directory=str(opts.dashboard_dir), html=True),
            name="dashboard",
        )

    return app


def serve_blocking(app: FastAPI, *, host: str, port: int) -> None:
    """Run uvicorn in the current thread until SIGINT or .should_exit."""
    config = uvicorn.Config(
        app,
        host=host,
        port=port,
        log_level="warning",  # quiet access log; user opts in via --verbose
        access_log=False,
    )
    server = uvicorn.Server(config)
    try:
        server.run()
    except KeyboardInterrupt:
        pass
