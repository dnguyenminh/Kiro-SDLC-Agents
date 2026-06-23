"""KSA-163: Graph Loader — Loads subgraphs from relationships table."""
from __future__ import annotations
import sqlite3
from .. import AdjacencyList, SymbolInfo


class GraphLoader:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def load_dependency_graph(self, module: str | None = None) -> AdjacencyList:
        sql = ("SELECT source_symbol_id, target_symbol_id FROM relationships "
               "WHERE kind = 'imports' AND target_symbol_id IS NOT NULL "
               "AND file_path NOT LIKE '%node_modules%' AND file_path NOT LIKE '%vendor%'")
        params: list = []
        if module:
            sql += " AND file_path LIKE ?"; params.append(f"%{module}%")
        return self._load_graph(sql, params)

    def load_reverse_call_graph(self, module: str | None = None) -> AdjacencyList:
        sql = ("SELECT source_symbol_id, target_symbol_id FROM relationships "
               "WHERE kind = 'calls' AND target_symbol_id IS NOT NULL")
        params: list = []
        if module:
            sql += " AND file_path LIKE ?"; params.append(f"%{module}%")
        graph: AdjacencyList = {}
        for row in self._conn.execute(sql, params).fetchall():
            src, tgt = row[0], row[1]
            graph.setdefault(tgt, []).append(src)  # reversed
            graph.setdefault(src, [])
        return graph

    def get_symbol_info(self, symbol_id: int) -> SymbolInfo | None:
        row = self._conn.execute(
            "SELECT s.id, s.name, s.kind, f.relative_path FROM symbols s "
            "JOIN files f ON f.id = s.file_id WHERE s.id = ?", (symbol_id,),
        ).fetchone()
        return SymbolInfo(row[0], row[1], row[2], row[3]) if row else None

    def get_symbol_info_batch(self, ids: list[int]) -> dict[int, SymbolInfo]:
        if not ids: return {}
        ph = ",".join("?" * len(ids))
        rows = self._conn.execute(
            f"SELECT s.id, s.name, s.kind, f.relative_path FROM symbols s "
            f"JOIN files f ON f.id = s.file_id WHERE s.id IN ({ph})", ids,
        ).fetchall()
        return {r[0]: SymbolInfo(r[0], r[1], r[2], r[3]) for r in rows}

    def resolve_symbol_id(self, name: str, file_path: str | None = None) -> int | None:
        sql = "SELECT s.id FROM symbols s JOIN files f ON f.id = s.file_id WHERE s.name = ?"
        params: list = [name]
        if file_path:
            sql += " AND f.relative_path LIKE ?"; params.append(f"%{file_path}%")
        sql += " LIMIT 1"
        row = self._conn.execute(sql, params).fetchone()
        return row[0] if row else None

    def _load_graph(self, sql: str, params: list) -> AdjacencyList:
        graph: AdjacencyList = {}
        for row in self._conn.execute(sql, params).fetchall():
            src, tgt = row[0], row[1]
            graph.setdefault(src, []).append(tgt)
            graph.setdefault(tgt, [])
        return graph
