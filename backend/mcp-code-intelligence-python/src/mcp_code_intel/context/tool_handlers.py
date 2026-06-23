"""Context tool handlers — dispatch to existing services. KSA-171."""

from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict
from typing import Any

from ..graph.call_graph_service import CallGraphService
from ..graph.symbol_resolver import SymbolResolver
from ..graph.test_detector import TestDetector
from ..graph.traverser import GraphTraverser
from ..query import QueryLayer
from .ai_context_service import AIContextService
from .curated_context_service import CuratedContextService
from .edit_context_service import EditContextService
from .types import (
    AIContextParams,
    CuratedContextParams,
    EditContextParams,
    SourceWeights,
)


def handle_get_ai_context(
    args: dict[str, Any], conn: sqlite3.Connection, workspace: str
) -> str:
    """Handle get_ai_context tool call."""
    symbol = args.get("symbol", "")
    if not symbol:
        return json.dumps({"error": 'Parameter "symbol" is required'})

    params = AIContextParams(
        symbol=symbol,
        intent=args.get("intent", "explain"),
        token_budget=int(args.get("token_budget", 4000)),
        caller_depth=int(args.get("caller_depth", 1)),
    )

    resolver = SymbolResolver(conn)
    call_graph = CallGraphService(conn, resolver)
    service = AIContextService(conn, resolver, call_graph, workspace)
    result = service.get_context(params)
    return json.dumps(
        {"symbol": result.symbol, "file_path": result.file_path, "kind": result.kind,
         "intent": result.intent, "context": result.context, "metadata": result.metadata},
        indent=2, default=str,
    )


def handle_get_edit_context(
    args: dict[str, Any], conn: sqlite3.Connection, workspace: str
) -> str:
    """Handle get_edit_context tool call."""
    symbol = args.get("symbol", "")
    if not symbol:
        return json.dumps({"error": 'Parameter "symbol" is required'})

    params = EditContextParams(
        symbol=symbol,
        include_callers=args.get("include_callers", True),
        include_tests=args.get("include_tests", True),
        include_git=args.get("include_git", True),
        token_budget=int(args.get("token_budget", 4000)),
        caller_depth=int(args.get("caller_depth", 1)),
    )

    resolver = SymbolResolver(conn)
    call_graph = CallGraphService(conn, resolver)
    test_detector = TestDetector(conn)
    service = EditContextService(conn, resolver, call_graph, test_detector, workspace)
    result = service.get_context(params)
    return json.dumps(_edit_result_to_dict(result), indent=2, default=str)


def handle_get_curated_context(
    args: dict[str, Any], conn: sqlite3.Connection, workspace: str,
    query_layer: QueryLayer | None = None,
) -> str:
    """Handle get_curated_context tool call."""
    query = args.get("query", "")
    if not query:
        return json.dumps({"error": 'Parameter "query" is required'})

    weights = None
    if args.get("source_weights"):
        w = args["source_weights"]
        weights = SourceWeights(
            code=float(w.get("code", 0.5)),
            memory=float(w.get("memory", 0.3)),
            graph=float(w.get("graph", 0.2)),
        )

    params = CuratedContextParams(
        query=query,
        max_tokens=int(args.get("max_tokens", 4000)),
        include_source=args.get("include_source", True),
        include_memory=args.get("include_memory", True),
        include_graph=args.get("include_graph", True),
        source_weights=weights,
    )

    resolver = SymbolResolver(conn)
    traverser = GraphTraverser(conn, resolver, workspace)
    ql = query_layer or QueryLayer(None)
    service = CuratedContextService(conn, ql, traverser, resolver)
    result = service.get_context(params)
    return json.dumps(_curated_result_to_dict(result), indent=2, default=str)


def _edit_result_to_dict(result: Any) -> dict[str, Any]:
    """Convert EditContextResult to serializable dict."""
    d: dict[str, Any] = {
        "symbol": result.symbol, "file": result.file,
        "line": result.line, "kind": result.kind,
        "source": result.source, "signature": result.signature,
        "metadata": result.metadata,
    }
    if result.callers:
        d["callers"] = [asdict(c) for c in result.callers]
    if result.tests:
        d["tests"] = [asdict(t) for t in result.tests]
    if result.git_history:
        d["git_history"] = [asdict(g) for g in result.git_history]
    if result.siblings:
        d["siblings"] = [asdict(s) for s in result.siblings]
    return d


def _curated_result_to_dict(result: Any) -> dict[str, Any]:
    """Convert CuratedContextResponse to serializable dict."""
    sections = []
    for section in result.sections:
        items = [
            {"name": i.name, "kind": i.kind, "file": i.file, "line": i.line,
             "relevance": i.relevance, "detail": i.detail, "content": i.content,
             "relationship": i.relationship}
            for i in section.items
        ]
        sections.append({"title": section.title, "source": section.source, "items": items})
    return {"query": result.query, "sections": sections, "metadata": result.metadata}
