"""REST API route handlers for memory engine — search, list, graph, stats."""

import re
from http.server import BaseHTTPRequestHandler

from ..memory.engine import MemoryEngine
from ..memory.knowledge_graph import KnowledgeGraph
from .response_helpers import (
    to_entry_response, to_detail_response, to_graph_node,
    send_json, send_error, first_param,
)


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
    elif re.match(r"^/graph/\d+/neighbors$", api_path):
        _handle_neighbors(api_path, handler, engine, graph)
    elif api_path == "/graph/data":
        _handle_graph_data(query, handler, engine, graph)
    else:
        send_error(handler, 404, "Route not found")


def handle_health(
    handler: BaseHTTPRequestHandler, engine: MemoryEngine | None
) -> None:
    """GET /api/health — health check endpoint."""
    send_json(handler, {
        "status": "ok",
        "version": "0.1.0",
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
    """GET /api/memory/entries?tier=X&limit=Y."""
    if not engine:
        send_error(handler, 503, "Memory not initialized")
        return
    tier = first_param(query, "tier", "WORKING")
    limit = int(first_param(query, "limit", "20"))
    entries = engine.knowledge.find_by_tier(tier, limit)
    send_json(handler, [to_entry_response(e) for e in entries])


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
    entries = [
        engine.knowledge.find_by_id(nid)
        for nid in neighbor_ids
    ]
    send_json(handler, [to_entry_response(e) for e in entries if e])


def _handle_graph_data(
    query: dict[str, list[str]],
    handler: BaseHTTPRequestHandler,
    engine: MemoryEngine | None,
    graph: KnowledgeGraph | None,
) -> None:
    """GET /api/memory/graph/data?limit=X — all entries as nodes."""
    if not engine or not graph:
        send_error(handler, 503, "Not initialized")
        return
    limit = int(first_param(query, "limit", "500"))
    all_entries = engine.knowledge.find_all(limit)
    nodes = [to_graph_node(e) for e in all_entries]
    edges = engine.graph_repo.find_all(limit)
    edge_list = [
        {"source": e["source_id"], "target": e["target_id"], "relation": e["relation"]}
        for e in edges
    ]
    send_json(handler, {"nodes": nodes, "edges": edge_list})
