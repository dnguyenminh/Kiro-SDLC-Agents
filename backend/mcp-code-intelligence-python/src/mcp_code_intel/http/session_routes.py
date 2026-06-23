"""REST API route handlers for sessions and session events."""

from http.server import BaseHTTPRequestHandler

from ..memory.engine import MemoryEngine
from .response_helpers import send_json, send_error, first_param


def handle_sessions(
    query: dict[str, list[str]],
    handler: BaseHTTPRequestHandler,
    engine: MemoryEngine | None,
) -> None:
    """GET /api/memory/sessions?agent=X&status=Y&limit=Z."""
    if not engine:
        send_error(handler, 503, "Memory not initialized")
        return
    agent = first_param(query, "agent", "")
    status = first_param(query, "status", "")
    limit = int(first_param(query, "limit", "50"))

    clauses = ["1=1"]
    params: list = []
    if agent:
        clauses.append("agent_name = ?")
        params.append(agent)
    if status:
        clauses.append("status = ?")
        params.append(status)
    where = " AND ".join(clauses)
    sql = f"SELECT * FROM memory_sessions WHERE {where} AND observation_count > 0 ORDER BY observation_count DESC, started_at DESC LIMIT ?"
    params.append(limit)
    cur = engine._conn.execute(sql, params)
    sessions = [dict(r) for r in cur.fetchall()]
    send_json(handler, [_to_session_response(s) for s in sessions])


def handle_session_events(
    api_path: str, query: dict[str, list[str]],
    handler: BaseHTTPRequestHandler,
    engine: MemoryEngine | None,
) -> None:
    """GET /api/memory/sessions/<id>/events."""
    if not engine:
        send_error(handler, 503, "Memory not initialized")
        return
    session_id = api_path.split("/")[2]
    limit = int(first_param(query, "limit", "200"))
    cur = engine._conn.execute(
        "SELECT * FROM memory_audit WHERE session_id = ? ORDER BY created_at ASC LIMIT ?",
        (session_id, limit),
    )
    events = [dict(r) for r in cur.fetchall()]
    send_json(handler, [_to_event_response(e) for e in events])


def _to_session_response(s: dict) -> dict:
    """Map session row to API response."""
    return {
        "id": s["session_id"], "agentName": s.get("agent_name"),
        "startedAt": s["started_at"], "endedAt": s.get("ended_at"),
        "observationCount": s.get("observation_count", 0),
        "status": s.get("status", "active"),
    }


def _to_event_response(e: dict) -> dict:
    """Map audit row to event response."""
    return {
        "id": e["id"], "operation": e["operation"],
        "entryId": e.get("entry_id"), "sessionId": e.get("session_id"),
        "details": e.get("details"), "createdAt": e["created_at"],
    }
