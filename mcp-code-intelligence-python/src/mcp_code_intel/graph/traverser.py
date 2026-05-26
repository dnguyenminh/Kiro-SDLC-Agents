"""Graph Traverser — generic BFS/DFS engine with edge/node type filtering. KSA-179.

Uses NetworkX for graph construction and traversal algorithms.
"""

from __future__ import annotations

import sqlite3
import time
from collections import deque
from pathlib import Path

import networkx as nx

from .models import GraphNode, TraverseConfig, TraverseResponse, TraverseResultItem
from .symbol_resolver import SymbolResolver


class GraphTraverser:
    """Generic BFS/DFS traversal engine with edge/node type filtering."""

    def __init__(self, conn: sqlite3.Connection, resolver: SymbolResolver, workspace: str) -> None:
        self._conn = conn
        self._resolver = resolver
        self._workspace = workspace

    def resolve_node(self, identifier: str) -> GraphNode | None:
        """Resolve a symbol identifier to a graph node."""
        resolved = self._resolver.resolve(identifier)
        if not resolved:
            return None
        r = resolved[0]
        return GraphNode(id=r.id, name=r.name, kind=r.kind, file_path=r.file_path, start_line=r.line)

    def traverse(self, start_node: GraphNode, config: TraverseConfig) -> list[TraverseResultItem]:
        """BFS traversal from a start node with edge/node type filters."""
        visited: set[int] = set()
        queue: deque[tuple[GraphNode, int, list[str]]] = deque()
        queue.append((start_node, 0, [start_node.name]))
        results: list[TraverseResultItem] = []

        while queue and len(results) < config.max_results:
            node, depth, current_path = queue.popleft()

            if node.id in visited:
                continue
            visited.add(node.id)

            # Add to results (skip start node)
            if depth > 0:
                if not config.node_types or node.kind in config.node_types:
                    results.append(TraverseResultItem(
                        node=node, depth=depth, path=current_path,
                        edge_type=node.incoming_edge_type or "unknown",
                    ))

            # Expand neighbors if within depth limit
            if depth < config.max_depth:
                neighbors = self._get_neighbors(node.id, config)
                for neighbor in neighbors:
                    if neighbor.id not in visited:
                        queue.append((neighbor, depth + 1, [*current_path, neighbor.name]))

        return sorted(results, key=lambda r: r.depth)

    def traverse_dfs(self, start_node: GraphNode, config: TraverseConfig) -> list[TraverseResultItem]:
        """DFS traversal from a start node with edge/node type filters."""
        visited: set[int] = set()
        stack: list[tuple[GraphNode, int, list[str]]] = [(start_node, 0, [start_node.name])]
        results: list[TraverseResultItem] = []

        while stack and len(results) < config.max_results:
            node, depth, current_path = stack.pop()

            if node.id in visited:
                continue
            visited.add(node.id)

            if depth > 0:
                if not config.node_types or node.kind in config.node_types:
                    results.append(TraverseResultItem(
                        node=node, depth=depth, path=current_path,
                        edge_type=node.incoming_edge_type or "unknown",
                    ))

            if depth < config.max_depth:
                neighbors = self._get_neighbors(node.id, config)
                for neighbor in reversed(neighbors):
                    if neighbor.id not in visited:
                        stack.append((neighbor, depth + 1, [*current_path, neighbor.name]))

        return results

    def build_networkx_graph(self, start_node: GraphNode, config: TraverseConfig) -> nx.DiGraph:
        """Build a NetworkX DiGraph from traversal for advanced analysis."""
        G = nx.DiGraph()
        G.add_node(start_node.id, name=start_node.name, kind=start_node.kind, file=start_node.file_path)

        results = self.traverse(start_node, config)
        for item in results:
            G.add_node(item.node.id, name=item.node.name, kind=item.node.kind, file=item.node.file_path)
            # Add edge from parent (simplified: connect to start for depth 1)
            if item.depth == 1:
                G.add_edge(start_node.id, item.node.id, edge_type=item.edge_type)

        return G

    def format_response(
        self,
        start_node: GraphNode,
        results: list[TraverseResultItem],
        include_source: bool = False,
        source_lines: int = 5,
        execution_time_ms: int = 0,
    ) -> TraverseResponse:
        """Format traversal results into the MCP response format."""
        formatted_results = []
        for r in results:
            entry: dict = {
                "name": r.node.name,
                "kind": r.node.kind,
                "file": r.node.file_path,
                "line": r.node.start_line,
                "depth": r.depth,
                "edge_type": r.edge_type,
            }
            if include_source:
                snippet = self._get_source_snippet(r.node.file_path, r.node.start_line, source_lines)
                if snippet:
                    entry["source"] = snippet
            formatted_results.append(entry)

        return TraverseResponse(
            start={"name": start_node.name, "kind": start_node.kind, "file": start_node.file_path, "line": start_node.start_line},
            results=formatted_results,
            metadata={
                "total_traversed": len(results),
                "total_results": len(formatted_results),
                "max_depth_reached": max((r.depth for r in results), default=0),
                "truncated": len(results) >= 50,
                "execution_time_ms": execution_time_ms,
            },
        )

    def _get_neighbors(self, node_id: int, config: TraverseConfig) -> list[GraphNode]:
        edge_filter = ""
        params: list = [node_id]
        if config.edge_types:
            placeholders = ",".join("?" * len(config.edge_types))
            edge_filter = f"AND r.kind IN ({placeholders})"
            params.extend(config.edge_types)

        rows: list[tuple] = []
        if config.direction in ("outgoing", "both"):
            cur = self._conn.execute(
                f"""SELECT s.id, s.name, s.kind, f.relative_path, s.start_line, r.kind
                    FROM relationships r
                    JOIN symbols s ON s.id = r.target_symbol_id
                    JOIN files f ON s.file_id = f.id
                    WHERE r.source_symbol_id = ? {edge_filter}
                    LIMIT 100""",
                params,
            )
            rows.extend(cur.fetchall())

        if config.direction in ("incoming", "both"):
            cur = self._conn.execute(
                f"""SELECT s.id, s.name, s.kind, f.relative_path, s.start_line, r.kind
                    FROM relationships r
                    JOIN symbols s ON s.id = r.source_symbol_id
                    JOIN files f ON s.file_id = f.id
                    WHERE r.target_symbol_id = ? {edge_filter}
                    LIMIT 100""",
                params,
            )
            rows.extend(cur.fetchall())

        return [
            GraphNode(id=r[0], name=r[1], kind=r[2], file_path=r[3], start_line=r[4], incoming_edge_type=r[5])
            for r in rows
        ]

    def _get_source_snippet(self, file_path: str, start_line: int, context_lines: int) -> str | None:
        try:
            full_path = Path(self._workspace) / file_path
            if not full_path.exists():
                return None
            lines = full_path.read_text(encoding="utf-8").splitlines()
            start = max(0, start_line - 1)
            end = min(len(lines), start + context_lines)
            return "\n".join(lines[start:end])
        except (OSError, UnicodeDecodeError):
            return None
