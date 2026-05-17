"""REST API route handlers for memory engine — search, list, graph, stats."""

import re
from http.server import BaseHTTPRequestHandler

from ..memory.engine import MemoryEngine
from ..memory.knowledge_graph import KnowledgeGraph
from .response_helpers import (
    to_entry_response, to_detail_response, to_graph_node,
    send_json, send_error, first_param,
)
from .session_routes import handle_sessions, handle_session_events


def handle_api_route(
    path: str, query: dict[str, list[str]],
    handler: BaseHTTPRequestHandler,
    engine: MemoryEngine | None,
    graph: KnowledgeGraph | None,
) -> None:
    """Dispatch API requests to the correct handler."""
    try:
        _dispatch_api(path, query, handler, engine, graph)
    except Exception as e:
        import sys
        print(f"[http-api] Error: {e}", file=sys.stderr, flush=True)
        send_error(handler, 500, str(e))


def _dispatch_api(
    path: str, query: dict[str, list[str]],
    handler: BaseHTTPRequestHandler,
    engine: MemoryEngine | None,
    graph: KnowledgeGraph | None,
) -> None:
    """Internal dispatch — exceptions caught by handle_api_route."""
    api_path = path.replace("/api/memory", "")

    if api_path == "/status":
        _handle_status(handler, engine)
    elif api_path == "/search":
        _handle_search(query, handler, engine)
    elif re.match(r"^/entries/\d+$", api_path):
        _handle_get_entry(api_path, handler, engine)
    elif api_path == "/entries":
        _handle_list_entries(query, handler, engine)
    elif api_path == "/sessions":
        handle_sessions(query, handler, engine)
    elif re.match(r"^/sessions/[^/]+/events$", api_path):
        handle_session_events(api_path, query, handler, engine)
    elif api_path == "/audit":
        _handle_audit(query, handler, engine)
    elif re.match(r"^/graph/\d+/neighbors$", api_path):
        _handle_neighbors(api_path, handler, engine, graph)
    elif api_path == "/graph/data":
        _handle_graph_data(query, handler, engine, graph)
    else:
        send_error(handler, 404, "Route not found")


def handle_health(
    handler: BaseHTTPRequestHandler, engine: MemoryEngine | None,
    workspace: str = ""
) -> None:
    """GET /api/health — health check endpoint."""
    send_json(handler, {
        "status": "ok",
        "version": "0.2.0",
        "workspace": workspace,
        "memoryEnabled": engine is not None,
    })


def _handle_status(
    handler: BaseHTTPRequestHandler, engine: MemoryEngine | None
) -> None:
    """GET /api/memory/status."""
    if not engine:
        send_error(handler, 503, "Memory not initialized")
        return
    stats = engine.get_stats()
    tier_map: dict[str, int] = {}
    for t in stats["tier_breakdown"]:
        tier_map[t["tier"]] = t["entry_count"]
    send_json(handler, {
        "totalEntries": stats["total_entries"],
        "totalEdges": stats["total_edges"],
        "totalVectors": stats["total_vectors"],
        "tierBreakdown": tier_map,
    })


def _handle_search(
    query: dict[str, list[str]],
    handler: BaseHTTPRequestHandler,
    engine: MemoryEngine | None,
) -> None:
    """GET /api/memory/search?q=X."""
    if not engine:
        send_error(handler, 503, "Memory not initialized")
        return
    q = first_param(query, "q", "")
    limit = int(first_param(query, "limit", "10"))
    tier = first_param(query, "tier", "")
    results = (
        engine.search.search_in_tier(q, tier, limit)
        if tier
        else engine.search.search(q, limit)
    )
    send_json(handler, [to_entry_response(r["entry"], r["score"]) for r in results])


def _handle_list_entries(
    query: dict[str, list[str]],
    handler: BaseHTTPRequestHandler,
    engine: MemoryEngine | None,
) -> None:
    """GET /api/memory/entries?tier=X&type=Y&limit=Z&offset=W&sort=S."""
    if not engine:
        send_error(handler, 503, "Memory not initialized")
        return
    tier = first_param(query, "tier", "")
    type_ = first_param(query, "type", "")
    limit = int(first_param(query, "limit", "20"))
    offset = int(first_param(query, "offset", "0"))
    sort = first_param(query, "sort", "created_at")
    after_id = first_param(query, "after_id", "")
    entries = _query_entries(engine, tier, type_, limit, offset, sort, after_id)
    send_json(handler, [to_entry_response(e) for e in entries])


def _query_entries(
    engine: MemoryEngine, tier: str, type_: str,
    limit: int, offset: int, sort: str, after_id: str,
) -> list[dict]:
    """Build and execute filtered entry query."""
    sort_col = {"access_count": "access_count", "confidence": "confidence"}.get(
        sort, "created_at"
    )
    clauses = ["1=1"]
    params: list = []
    if tier:
        clauses.append("tier = ?")
        params.append(tier)
    if type_:
        clauses.append("type = ?")
        params.append(type_)
    if after_id:
        clauses.append("id > ?")
        params.append(int(after_id))
    where = " AND ".join(clauses)
    sql = f"SELECT * FROM knowledge_entries WHERE {where} ORDER BY {sort_col} DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    cur = engine._conn.execute(sql, params)
    return [dict(r) for r in cur.fetchall()]


def _handle_get_entry(
    api_path: str, handler: BaseHTTPRequestHandler, engine: MemoryEngine | None
) -> None:
    """GET /api/memory/entries/<id>."""
    if not engine:
        send_error(handler, 503, "Memory not initialized")
        return
    entry_id = int(api_path.split("/")[2])
    entry = engine.knowledge.find_by_id(entry_id)
    if not entry:
        send_error(handler, 404, "Not found")
        return
    engine.knowledge.record_access(entry_id)
    send_json(handler, to_detail_response(entry))


def _handle_neighbors(
    api_path: str, handler: BaseHTTPRequestHandler,
    engine: MemoryEngine | None, graph: KnowledgeGraph | None,
) -> None:
    """GET /api/memory/graph/<id>/neighbors."""
    if not engine or not graph:
        send_error(handler, 503, "Not initialized")
        return
    entry_id = int(api_path.split("/")[2])
    neighbor_ids = graph.get_connected(entry_id)
    entries = [engine.knowledge.find_by_id(nid) for nid in neighbor_ids]
    send_json(handler, [to_entry_response(e) for e in entries if e])


def _handle_graph_data(
    query: dict[str, list[str]],
    handler: BaseHTTPRequestHandler,
    engine: MemoryEngine | None,
    graph: KnowledgeGraph | None,
) -> None:
    """GET /api/memory/graph/data?limit=X — nodes from edges."""
    if not engine or not graph:
        send_error(handler, 503, "Not initialized")
        return
    limit = int(first_param(query, "limit", "500"))
    edges = engine.graph_repo.find_all(limit)
    if not edges:
        entries = engine.knowledge.find_by_tier("WORKING", 50)
        nodes = [to_graph_node(e) for e in entries]
        send_json(handler, {"nodes": nodes, "edges": []})
        return
    node_ids: set[int] = set()
    for e in edges:
        node_ids.add(e["source_id"])
        node_ids.add(e["target_id"])
    nodes = []
    for nid in node_ids:
        entry = engine.knowledge.find_by_id(nid)
        if entry:
            nodes.append(to_graph_node(entry))
    edge_list = [
        {"source": e["source_id"], "target": e["target_id"], "relation": e["relation"]}
        for e in edges
    ]
    send_json(handler, {"nodes": nodes, "edges": edge_list})


def _handle_audit(
    query: dict[str, list[str]],
    handler: BaseHTTPRequestHandler,
    engine: MemoryEngine | None,
) -> None:
    """GET /api/memory/audit?limit=20&after_id=X — recent audit events."""
    if not engine:
        send_error(handler, 503, "Memory not initialized")
        return
    limit = int(first_param(query, "limit", "20"))
    after_id = first_param(query, "after_id", "")
    if after_id:
        cur = engine._conn.execute(
            "SELECT * FROM memory_audit WHERE id > ? ORDER BY id DESC LIMIT ?",
            (int(after_id), limit),
        )
    else:
        cur = engine._conn.execute(
            "SELECT * FROM memory_audit ORDER BY id DESC LIMIT ?", (limit,)
        )
    events = [dict(r) for r in cur.fetchall()]
    send_json(handler, [
        {"id": e["id"], "operation": e["operation"], "entryId": e.get("entry_id"),
         "sessionId": e.get("session_id"), "details": e.get("details"),
         "createdAt": e["created_at"]}
        for e in events
    ])
