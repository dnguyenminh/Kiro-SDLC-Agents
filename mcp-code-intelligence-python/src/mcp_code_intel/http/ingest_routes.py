"""HTTP ingest-file route — POST /api/memory/ingest-file.

Allows extension to directly index documents without going through MCP stdio.
Supports single file and batch requests with deduplication via checksum.
"""

import hashlib
import json
import os
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Any


def handle_ingest_file_route(
    handler: BaseHTTPRequestHandler,
    memory_engine: Any,
    workspace: str,
) -> None:
    """Handle POST /api/memory/ingest-file."""
    if memory_engine is None:
        _send_json(handler, 503, {"error": "Memory not initialized"})
        return

    try:
        length = int(handler.headers.get("Content-Length", 0))
        body = handler.rfile.read(length).decode("utf-8")
        data = json.loads(body)
    except (json.JSONDecodeError, ValueError) as e:
        _send_json(handler, 400, {"error": f"Invalid JSON: {e}"})
        return

    files = data.get("files") or [data]
    results = [_ingest_single(f, memory_engine, workspace) for f in files]
    ingested = sum(1 for r in results if not r["skipped"])
    skipped = sum(1 for r in results if r["skipped"])

    _send_json(handler, 200, {
        "total": len(results),
        "ingested": ingested,
        "skipped": skipped,
        "results": results,
    })


def _ingest_single(req: dict, engine: Any, workspace: str) -> dict:
    """Ingest a single file with dedup check."""
    file_path = req.get("file_path", "")
    doc_type = req.get("type", "CONTEXT")

    resolved = _resolve_path(file_path, workspace)
    if not resolved or not os.path.isfile(resolved):
        return {"file_path": file_path, "entries_created": 0, "skipped": True, "reason": "file not found"}

    content = Path(resolved).read_text(encoding="utf-8")
    checksum = hashlib.md5(content.encode()).hexdigest()

    # Dedup: check if already ingested with same checksum
    if hasattr(engine, "get_source_checksum"):
        existing = engine.get_source_checksum(file_path)
        if existing == checksum:
            return {"file_path": file_path, "entries_created": 0, "skipped": True, "reason": "unchanged (checksum match)"}

    # Ingest via pipeline
    from ..memory.ingest_pipeline import ingest_markdown
    entries = ingest_markdown(engine, content, file_path, doc_type)

    if hasattr(engine, "set_source_checksum"):
        engine.set_source_checksum(file_path, checksum)

    return {"file_path": file_path, "entries_created": entries}


def _resolve_path(file_path: str, workspace: str) -> str | None:
    """Resolve file path relative to workspace."""
    if os.path.isabs(file_path) and os.path.isfile(file_path):
        return file_path
    if workspace:
        ws_path = os.path.join(workspace, file_path)
        if os.path.isfile(ws_path):
            return ws_path
    return None


def _send_json(handler: BaseHTTPRequestHandler, status: int, data: dict) -> None:
    """Send JSON response."""
    body = json.dumps(data).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)
