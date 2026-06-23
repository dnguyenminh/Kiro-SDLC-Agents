"""Curated Context Service — NL query → parallel search → RRF merge → budget allocation. KSA-171."""

from __future__ import annotations

import sqlite3
import time
from typing import Any

from ..graph.symbol_resolver import SymbolResolver
from ..graph.traverser import GraphTraverser
from ..query import QueryLayer
from .budget_allocator import AllocatedResult, BudgetAllocator
from .query_analyzer import QueryAnalyzer
from .rrf_merger import RRFMerger
from .types import (
    ContextItem, ContextSection, CuratedContextParams, CuratedContextResponse,
)


class CuratedContextService:
    """NL query → parallel search → RRF merge → budget allocation."""

    def __init__(
        self,
        conn: sqlite3.Connection,
        query_layer: QueryLayer,
        traverser: GraphTraverser,
        resolver: SymbolResolver,
    ) -> None:
        self._analyzer = QueryAnalyzer()
        self._merger = RRFMerger()
        self._allocator = BudgetAllocator()
        self._conn = conn
        self._query_layer = query_layer
        self._traverser = traverser
        self._resolver = resolver

    def get_context(self, params: CuratedContextParams) -> CuratedContextResponse:
        """Execute curated context search with NL query."""
        start_time = time.time()

        # 1. Analyze query
        analysis = self._analyzer.analyze(params.query)

        # 2. Search sources
        code_results = self._search_code(analysis) if params.include_source else {"source": "code", "results": []}
        memory_results = self._search_memory(analysis) if params.include_memory else {"source": "memory", "results": []}

        # 3. Graph expansion (depends on code results)
        graph_results: dict[str, Any] = {"source": "graph", "results": []}
        if params.include_graph and code_results["results"]:
            graph_results = self._expand_graph(code_results["results"][:5])

        # 4. Merge with RRF
        merged = self._merger.merge(
            {"code": code_results, "memory": memory_results, "graph": graph_results},
            params.source_weights,
        )

        # 5. Allocate token budget
        allocated = self._allocator.allocate(merged, params.max_tokens)

        # 6. Format response
        sections = self._format_sections(allocated)
        tokens_used = sum(r.tokens for r in allocated) + 100

        elapsed_ms = int((time.time() - start_time) * 1000)
        sources_queried: list[str] = []
        if params.include_source:
            sources_queried.append("code")
        if params.include_memory:
            sources_queried.append("memory")
        if params.include_graph:
            sources_queried.append("graph")

        return CuratedContextResponse(
            query=params.query,
            sections=sections,
            metadata={
                "tokens_used": tokens_used,
                "tokens_budget": params.max_tokens,
                "sources_queried": sources_queried,
                "total_candidates": len(code_results["results"]) + len(memory_results["results"]) + len(graph_results["results"]),
                "results_returned": len(allocated),
                "execution_time_ms": elapsed_ms,
            },
        )

    def _search_code(self, analysis: Any) -> dict[str, Any]:
        try:
            fts_results = self._query_layer.search_code(analysis.fts_query, 30)

            # Also try direct symbol resolution
            symbol_results: list[dict[str, Any]] = []
            for candidate in analysis.symbol_candidates[:5]:
                resolved = self._resolver.resolve(candidate)
                for sym in resolved[:3]:
                    symbol_results.append({
                        "id": sym.id, "name": sym.name, "kind": sym.kind,
                        "file": sym.file_path, "line": sym.line, "signature": None,
                    })

            # Combine FTS + symbol results (mini-RRF)
            fts_items = [
                {"name": r["name"], "kind": r["kind"], "file": r["file_path"],
                 "line": r["start_line"], "signature": r.get("signature")}
                for r in fts_results
            ]
            combined = self._mini_rrf(fts_items, symbol_results)
            return {"source": "code", "results": combined[:20]}
        except Exception:
            return {"source": "code", "results": []}

    def _search_memory(self, analysis: Any) -> dict[str, Any]:
        try:
            query = " ".join(analysis.keywords[:5])
            cur = self._conn.execute(
                """SELECT id, content, summary, type, tags, created_at
                   FROM knowledge_entries
                   WHERE id IN (
                       SELECT rowid FROM knowledge_fts WHERE knowledge_fts MATCH ?
                   )
                   ORDER BY created_at DESC LIMIT 10""",
                (query,),
            )
            rows = cur.fetchall()
            results = []
            for row in rows:
                results.append({
                    "id": row[0],
                    "name": row[2] or (row[1][:50] if row[1] else "entry"),
                    "kind": row[3] or "memory",
                    "content": row[2] or (row[1][:200] if row[1] else ""),
                    "file": None, "line": None,
                })
            return {"source": "memory", "results": results}
        except Exception:
            return {"source": "memory", "results": []}

    def _expand_graph(self, top_symbols: list[dict[str, Any]]) -> dict[str, Any]:
        expanded: list[dict[str, Any]] = []
        seen: set[str] = set()

        for symbol in top_symbols:
            try:
                start_node = self._traverser.resolve_node(symbol.get("name", ""))
                if not start_node:
                    continue

                from ..graph.models import TraverseConfig
                results = self._traverser.traverse(start_node, TraverseConfig(
                    edge_types=["calls", "imports", "inherits"],
                    direction="both", max_depth=1, max_results=5,
                ))

                for r in results:
                    key = f"{r.node.name}:{r.node.file_path}"
                    if key in seen:
                        continue
                    seen.add(key)
                    expanded.append({
                        "id": r.node.id, "name": r.node.name,
                        "kind": r.node.kind, "file": r.node.file_path,
                        "line": r.node.start_line,
                        "relationship": f"{r.edge_type} {symbol.get('name', '')}",
                    })
            except Exception:
                continue

        return {"source": "graph", "results": expanded}

    def _mini_rrf(self, list_a: list[dict], list_b: list[dict]) -> list[dict]:
        k = 60
        scores: dict[str, dict[str, Any]] = {}

        for i, item in enumerate(list_a):
            key = f"{item.get('name', '')}:{item.get('file', '')}"
            scores[key] = {"score": 1 / (k + i), "item": item}

        for i, item in enumerate(list_b):
            key = f"{item.get('name', '')}:{item.get('file', '')}"
            if key in scores:
                scores[key]["score"] += 1 / (k + i)
            else:
                scores[key] = {"score": 1 / (k + i), "item": item}

        return [e["item"] for e in sorted(scores.values(), key=lambda x: x["score"], reverse=True)]

    def _format_sections(self, allocated: list[AllocatedResult]) -> list[ContextSection]:
        by_source: dict[str, list[ContextItem]] = {}

        for item in allocated:
            source = item.sources[0] if item.sources else "code"
            if source not in by_source:
                by_source[source] = []
            by_source[source].append(ContextItem(
                name=item.name, kind=item.kind, file=item.file,
                line=item.line, relevance=item.relevance_score,
                detail=item.detail, content=item.content,
                relationship=item.relationship,
            ))

        title_map = {"code": "Code Symbols", "memory": "Knowledge Base", "graph": "Related (Graph)"}
        return [
            ContextSection(title=title_map.get(source, source), source=source, items=items)
            for source, items in by_source.items()
        ]
