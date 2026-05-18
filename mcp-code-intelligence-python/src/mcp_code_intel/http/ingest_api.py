"""POST /api/memory/ingest HTTP endpoint — HTTP API for external ingest."""

from __future__ import annotations

import json
from typing import Any

from aiohttp import web


def setup_ingest_routes(app: web.Application, engine_provider: Any) -> None:
    """Register ingest API routes on the aiohttp app."""
    app.router.add_post("/api/memory/ingest", _handle_ingest(engine_provider))


def _handle_ingest(engine_provider: Any):
    """Create handler for POST /api/memory/ingest."""

    async def handler(request: web.Request) -> web.Response:
        engine = engine_provider()
        if engine is None:
            return web.json_response(
                {"error": "Memory not initialized"}, status=503
            )
        try:
            body = await request.json()
        except (json.JSONDecodeError, Exception):
            return web.json_response(
                {"error": "Invalid request body"}, status=400
            )
        content = body.get("content", "").strip()
        if not content:
            return web.json_response(
                {"error": "content is required"}, status=400
            )
        summary = (body.get("summary") or "").strip() or content[:120]
        entry_type = (body.get("type") or "").strip() or "CONTEXT"
        tags = body.get("tags", "")
        source = body.get("source")

        entry_id = engine.knowledge.insert_entry(
            content=content,
            summary=summary,
            entry_type=entry_type,
            tier="WORKING",
            source=source,
            tags=tags,
        )
        return web.json_response(
            {"id": entry_id, "type": entry_type, "tier": "WORKING"},
            status=201,
        )

    return handler
