"""Dependency Graph Service — BFS traversal on import relationships. KSA-179.

Uses NetworkX DiGraph for efficient graph traversal and cycle detection.
"""

from __future__ import annotations

import posixpath
import sqlite3
import time
from collections import deque

import networkx as nx

from .file_resolver import FileResolver
from .models import DependencyMetadata, DependencyNode, DependencyResult


class DependencyGraphService:
    """BFS traversal on import relationships with cycle detection.

    Supports outgoing (what does this file import?) and incoming (who imports this file?).
    """

    def __init__(self, conn: sqlite3.Connection, file_resolver: FileResolver) -> None:
        self._conn = conn
        self._file_resolver = file_resolver

    def query(
        self,
        file: str,
        direction: str = "outgoing",
        depth: int = 1,
        include_external: bool = False,
        limit: int = 50,
    ) -> DependencyResult:
        """Query dependency graph with direction and depth control."""
        start_time = time.time()
        clamped_depth = min(max(depth, 1), 5)

        resolved = self._file_resolver.resolve_file(file)
        if not resolved:
            return self._file_not_found(file)

        if direction == "both":
            out = self._bfs_traversal(resolved, "outgoing", clamped_depth, include_external, limit)
            inc = self._bfs_traversal(resolved, "incoming", clamped_depth, include_external, limit)
            results = self._merge_results(out["results"], inc["results"])
            cycles = out["cycles"] + inc["cycles"]
        else:
            traversal = self._bfs_traversal(resolved, direction, clamped_depth, include_external, limit)
            results = traversal["results"]
            cycles = traversal["cycles"]

        elapsed_ms = int((time.time() - start_time) * 1000)
        max_d = max((r.depth for r in results), default=0)

        return DependencyResult(
            root=resolved,
            direction=direction,
            results=results,
            cycles=cycles,
            metadata=DependencyMetadata(
                total_nodes=len(results),
                max_depth_reached=min(clamped_depth, max_d),
                truncated=len(results) >= limit,
                query_time_ms=elapsed_ms,
                external_count=sum(1 for r in results if r.is_external),
            ),
        )

    def build_networkx_graph(self, root: str, direction: str, depth: int) -> nx.DiGraph:
        """Build a NetworkX DiGraph from the dependency data for advanced analysis."""
        G = nx.DiGraph()
        G.add_node(root, depth=0)

        result = self.query(root, direction, depth, include_external=False, limit=200)
        for node in result.results:
            G.add_node(node.file, depth=node.depth, is_external=node.is_external)
            if direction == "outgoing":
                G.add_edge(root if node.depth == 1 else node.file, node.file,
                           symbols=node.imported_symbols)
            else:
                G.add_edge(node.file, root if node.depth == 1 else node.file,
                           symbols=node.imported_symbols)

        return G

    def detect_cycles_nx(self, root: str, depth: int = 3) -> list[list[str]]:
        """Use NetworkX to detect all simple cycles reachable from root."""
        G = self.build_networkx_graph(root, "outgoing", depth)
        try:
            return [list(c) for c in nx.simple_cycles(G)]
        except nx.NetworkXError:
            return []

    def _bfs_traversal(
        self,
        root: str,
        direction: str,
        max_depth: int,
        include_external: bool,
        limit: int,
    ) -> dict:
        visited: set[str] = {root}
        results: list[DependencyNode] = []
        cycles: list[list[str]] = []
        queue: deque[tuple[str, int, list[str]]] = deque()
        queue.append((root, 0, [root]))

        while queue and len(results) < limit:
            current, current_depth, current_path = queue.popleft()
            if current_depth >= max_depth:
                continue

            deps = (
                self._get_outgoing_deps(current)
                if direction == "outgoing"
                else self._get_incoming_deps(current)
            )

            for dep in deps:
                is_external = self._file_resolver.is_external(dep["target"])
                if is_external and not include_external:
                    continue

                resolved_target = (
                    dep["target"]
                    if is_external
                    else self._file_resolver.resolve_import_target(current, dep["target"])
                )
                if not resolved_target:
                    continue

                # Cycle detection
                if resolved_target in current_path:
                    cycles.append([*current_path, resolved_target])
                    continue

                if resolved_target not in visited:
                    visited.add(resolved_target)
                    results.append(DependencyNode(
                        file=resolved_target,
                        depth=current_depth + 1,
                        imported_symbols=dep["symbols"],
                        is_external=is_external,
                    ))

                    if not is_external and current_depth + 1 < max_depth:
                        queue.append((resolved_target, current_depth + 1, [*current_path, resolved_target]))

        return {"results": results, "cycles": cycles}

    def _get_outgoing_deps(self, file_path: str) -> list[dict]:
        cur = self._conn.execute(
            """SELECT target_symbol, metadata
               FROM relationships
               WHERE file_path = ? AND kind = 'imports'
               ORDER BY line""",
            (file_path,),
        )
        grouped: dict[str, list[str]] = {}
        for row in cur.fetchall():
            module = self._extract_module(row[0])
            if module not in grouped:
                grouped[module] = []
            symbol = self._extract_symbol_name(row[0])
            if symbol:
                grouped[module].append(symbol)

        return [{"target": t, "symbols": s} for t, s in grouped.items()]

    def _get_incoming_deps(self, file_path: str) -> list[dict]:
        basename = posixpath.basename(file_path).rsplit(".", 1)[0]
        cur = self._conn.execute(
            """SELECT DISTINCT file_path, target_symbol
               FROM relationships
               WHERE kind = 'imports'
                 AND (target_symbol LIKE ? OR target_symbol LIKE ? OR target_symbol LIKE ?)""",
            (f"%/{basename}", f"%{basename}%", file_path),
        )
        grouped: dict[str, list[str]] = {}
        for row in cur.fetchall():
            if row[0] == file_path:
                continue
            if row[0] not in grouped:
                grouped[row[0]] = []
            grouped[row[0]].append(self._extract_symbol_name(row[1]) or "*")

        return [{"target": t, "symbols": s} for t, s in grouped.items()]

    @staticmethod
    def _extract_module(target_symbol: str) -> str:
        last_dot = target_symbol.rfind(".")
        if last_dot > 0 and "/" not in target_symbol:
            return target_symbol
        if last_dot > 0:
            return target_symbol[:last_dot]
        return target_symbol

    @staticmethod
    def _extract_symbol_name(target_symbol: str) -> str:
        last_dot = target_symbol.rfind(".")
        if 0 < last_dot < len(target_symbol) - 1:
            return target_symbol[last_dot + 1:]
        return posixpath.basename(target_symbol)

    @staticmethod
    def _merge_results(outgoing: list[DependencyNode], incoming: list[DependencyNode]) -> list[DependencyNode]:
        seen: set[str] = set()
        merged: list[DependencyNode] = []
        for node in [*outgoing, *incoming]:
            if node.file not in seen:
                seen.add(node.file)
                merged.append(node)
        return merged

    @staticmethod
    def _file_not_found(file: str) -> DependencyResult:
        return DependencyResult(root=file, direction="outgoing")
