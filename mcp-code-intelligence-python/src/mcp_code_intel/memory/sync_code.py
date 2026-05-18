"""mem_sync_code — sync code symbols into memory graph with IMPLEMENTED_BY edges."""

from __future__ import annotations

from typing import Any


class MemSyncCode:
    """Ingests code symbols into memory and creates cross-reference edges."""

    def __init__(self, engine: Any, query_layer: Any, graph: Any) -> None:
        self._engine = engine
        self._query = query_layer
        self._graph = graph

    def execute(self, args: dict) -> str:
        """Sync code symbols into memory graph."""
        limit = args.get("limit", 10000)
        kind = args.get("kind")
        symbols = self._fetch_symbols(kind, limit)
        if not symbols:
            return "No code symbols found to sync."
        created = self._ingest_symbols(symbols)
        linked = self._link_to_documents(created)
        return f"Synced: {len(created)} code symbols, {linked} cross-reference edges"

    def _fetch_symbols(self, kind: str | None, limit: int) -> list[dict]:
        if kind:
            return self._query.find_symbols("", kind, limit)
        classes = self._query.find_symbols("", "class", limit // 2)
        interfaces = self._query.find_symbols("", "interface", limit // 2)
        return classes + interfaces

    def _ingest_symbols(self, symbols: list[dict]) -> list[tuple[int, dict]]:
        results: list[tuple[int, dict]] = []
        for sym in symbols:
            if self._is_already_ingested(sym):
                continue
            entry_id = self._create_code_entry(sym)
            results.append((entry_id, sym))
        return results

    def _is_already_ingested(self, sym: dict) -> bool:
        existing = self._engine.search.search(sym["name"], 3)
        return any(
            r["entry"]["type"] == "CODE_ENTITY" and r["entry"].get("source") == sym.get("file_path")
            for r in existing
        )

    def _create_code_entry(self, sym: dict) -> int:
        content = self._build_content(sym)
        summary = f"{sym.get('kind')}: {sym['name']} ({sym.get('file_path')})"
        return self._engine.knowledge.insert_entry(
            content=content,
            summary=summary,
            entry_type="CODE_ENTITY",
            tier="SEMANTIC",
            source=sym.get("file_path"),
            tags=f"{sym.get('kind')},{sym['name']},code",
        )

    def _build_content(self, sym: dict) -> str:
        parts = [f"{sym.get('kind')} {sym['name']}"]
        if sym.get("signature"):
            parts.append(f"Signature: {sym['signature']}")
        parts.append(f"File: {sym.get('file_path')} (lines {sym.get('start_line')}-{sym.get('end_line')})")
        if sym.get("parent_symbol"):
            parts.append(f"Parent: {sym['parent_symbol']}")
        if sym.get("doc_comment"):
            parts.append(f"Doc: {sym['doc_comment']}")
        return "\n".join(parts)

    def _link_to_documents(self, code_entries: list[tuple[int, dict]]) -> int:
        edge_count = 0
        for code_id, sym in code_entries:
            related = self._find_related_doc_entries(sym["name"])
            for doc_id in related:
                self._graph.add_edge_if_not_exists(code_id, doc_id, "IMPLEMENTED_BY")
                edge_count += 1
        return edge_count

    def _find_related_doc_entries(self, symbol_name: str) -> list[int]:
        results = self._engine.search.search(symbol_name, 5)
        return [
            r["entry"]["id"]
            for r in results
            if r["entry"]["type"] != "CODE_ENTITY"
        ][:3]
