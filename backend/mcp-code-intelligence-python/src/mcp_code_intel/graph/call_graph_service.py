"""Call Graph Service — BFS traversal for callers/callees. KSA-179."""

from __future__ import annotations

import re
import sqlite3
import time
from collections import deque

from .models import CallGraphItem, CallGraphMetadata, CallGraphResponse, ResolvedTo
from .symbol_resolver import SymbolResolver


class CallGraphService:
    """Provides transitive call graph analysis with depth control."""

    def __init__(self, conn: sqlite3.Connection, resolver: SymbolResolver) -> None:
        self._conn = conn
        self._resolver = resolver

    def find_callers(
        self,
        symbol_name: str,
        depth: int = 1,
        limit: int = 20,
        file_filter: str | None = None,
        kind_filter: str = "calls",
    ) -> CallGraphResponse:
        """Find all callers of a symbol with transitive depth."""
        start_time = time.time()
        clamped_depth = min(max(depth, 1), 5)

        resolved = self._resolver.resolve(symbol_name)
        if not resolved:
            return self._symbol_not_found(symbol_name)

        results: list[CallGraphItem] = []
        visited: set[int] = set()
        queue: deque[tuple[str, int]] = deque()

        for sym in resolved:
            queue.append((sym.name, 0))

        while queue and len(results) < limit:
            current_name, current_depth = queue.popleft()
            if current_depth >= clamped_depth:
                continue

            callers = self._find_callers_db(current_name, kind_filter, limit - len(results))

            for caller in callers:
                caller_id = caller["id"]
                if caller_id in visited:
                    continue
                visited.add(caller_id)

                item = CallGraphItem(
                    symbol=caller["name"],
                    qualified_name=f"{caller['parameters']}.{caller['name']}" if caller["parameters"] else caller["name"],
                    kind=caller["kind"],
                    file_path=caller["file_path"],
                    definition_line=caller["def_line"],
                    call_site_line=caller["call_line"],
                    depth_level=current_depth + 1,
                    parameters=caller["parameters"],
                    is_async=caller["is_async"] == 1,
                )

                if file_filter and not self._match_filter(item.file_path, file_filter):
                    continue

                results.append(item)

                if current_depth + 1 < clamped_depth:
                    queue.append((caller["name"], current_depth + 1))

        elapsed_ms = int((time.time() - start_time) * 1000)
        return CallGraphResponse(
            symbol=symbol_name,
            resolved_to=[ResolvedTo(id=s.id, file=s.file_path, line=s.line, kind=s.kind) for s in resolved],
            results=results,
            metadata=CallGraphMetadata(
                total_count=len(results),
                depth_searched=clamped_depth,
                truncated=len(results) >= limit,
                query_time_ms=elapsed_ms,
            ),
        )

    def find_callees(
        self,
        symbol_name: str,
        depth: int = 1,
        limit: int = 20,
        file_filter: str | None = None,
        include_external: bool = True,
    ) -> CallGraphResponse:
        """Find all callees of a symbol with transitive depth."""
        start_time = time.time()
        clamped_depth = min(max(depth, 1), 5)

        resolved = self._resolver.resolve(symbol_name)
        if not resolved:
            return self._symbol_not_found(symbol_name)

        results: list[CallGraphItem] = []
        visited: set[str] = set()
        queue: deque[tuple[int, int]] = deque()

        for sym in resolved:
            queue.append((sym.id, 0))

        while queue and len(results) < limit:
            symbol_id, current_depth = queue.popleft()
            if current_depth >= clamped_depth:
                continue

            callees = self._find_callees_db(symbol_id, "calls", limit - len(results))

            for callee in callees:
                key = f"{callee['name']}:{callee['call_line']}"
                if key in visited:
                    continue
                visited.add(key)

                if not include_external and not callee["file_path"]:
                    continue

                item = CallGraphItem(
                    symbol=callee["name"],
                    qualified_name=callee["name"],
                    kind=callee["kind"] or "unknown",
                    file_path=callee["file_path"] or "(external)",
                    definition_line=callee["def_line"] or 0,
                    call_site_line=callee["call_line"],
                    depth_level=current_depth + 1,
                )

                if file_filter and item.file_path != "(external)" and not self._match_filter(item.file_path, file_filter):
                    continue

                results.append(item)

                if callee["file_path"] and current_depth + 1 < clamped_depth:
                    callee_resolved = self._resolver.resolve(callee["name"])
                    for cr in callee_resolved:
                        if cr.file_path == callee["file_path"]:
                            queue.append((cr.id, current_depth + 1))
                            break

        elapsed_ms = int((time.time() - start_time) * 1000)
        return CallGraphResponse(
            symbol=symbol_name,
            resolved_to=[ResolvedTo(id=s.id, file=s.file_path, line=s.line, kind=s.kind) for s in resolved],
            results=results,
            metadata=CallGraphMetadata(
                total_count=len(results),
                depth_searched=clamped_depth,
                truncated=len(results) >= limit,
                query_time_ms=elapsed_ms,
            ),
        )

    def _find_callers_db(self, symbol_name: str, kind: str, limit: int) -> list[dict]:
        cur = self._conn.execute(
            """SELECT s.name, s.kind, s.file_path, s.start_line as def_line,
                      r.line as call_line, s.parent_symbol as parameters,
                      s.visibility as is_async, s.id
               FROM relationships r
               JOIN symbols s ON s.id = r.source_symbol_id
               WHERE r.target_symbol = ? AND r.kind = ?
               ORDER BY s.file_path, r.line
               LIMIT ?""",
            (symbol_name, kind, limit),
        )
        cols = ["name", "kind", "file_path", "def_line", "call_line", "parameters", "is_async", "id"]
        return [dict(zip(cols, row)) for row in cur.fetchall()]

    def _find_callees_db(self, symbol_id: int, kind: str, limit: int) -> list[dict]:
        cur = self._conn.execute(
            """SELECT r.target_symbol as name, r.line as call_line, r.metadata,
                      ts.kind, ts.file_path, ts.start_line as def_line
               FROM relationships r
               LEFT JOIN symbols ts ON ts.id = r.target_symbol_id
               WHERE r.source_symbol_id = ? AND r.kind = ?
               ORDER BY r.line
               LIMIT ?""",
            (symbol_id, kind, limit),
        )
        cols = ["name", "call_line", "metadata", "kind", "file_path", "def_line"]
        return [dict(zip(cols, row)) for row in cur.fetchall()]

    def _symbol_not_found(self, symbol_name: str) -> CallGraphResponse:
        return CallGraphResponse(
            symbol=symbol_name,
            metadata=CallGraphMetadata(query_time_ms=0),
        )

    @staticmethod
    def _match_filter(file_path: str, filter_str: str) -> bool:
        if "*" in filter_str:
            pattern = "^" + re.escape(filter_str).replace(r"\*", ".*") + "$"
            return bool(re.match(pattern, file_path))
        return filter_str in file_path
