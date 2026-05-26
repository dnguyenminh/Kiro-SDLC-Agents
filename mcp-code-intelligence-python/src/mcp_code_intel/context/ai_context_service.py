"""AI Context Service — intent-aware context assembly with token budgeting. KSA-171."""

from __future__ import annotations

import os
import sqlite3
import time
from typing import Any

from ..graph.call_graph_service import CallGraphService
from ..graph.symbol_resolver import SymbolResolver
from .git_service import GitService
from .intent_strategies import SectionDef, get_strategy
from .token_budget_manager import TokenBudgetManager
from .types import AIContextParams, AIContextResponse


class AIContextService:
    """Orchestrates symbol resolution, section fetching, and budget management."""

    def __init__(
        self,
        conn: sqlite3.Connection,
        resolver: SymbolResolver,
        call_graph: CallGraphService,
        workspace: str,
    ) -> None:
        self._conn = conn
        self._resolver = resolver
        self._call_graph = call_graph
        self._git_service = GitService(workspace)
        self._workspace = workspace

    def get_context(self, params: AIContextParams) -> AIContextResponse:
        """Get intent-aware context for a symbol within token budget."""
        start_time = time.time()

        # 1. Resolve symbol
        resolved = self._resolver.resolve(params.symbol)
        if not resolved:
            return self._not_found(params, start_time)

        target = resolved[0]

        # 2. Get intent strategy
        strategy = get_strategy(params.intent)

        # 3. Assemble context with budget
        budget_mgr = TokenBudgetManager(params.token_budget)
        context: dict[str, Any] = {}
        included: list[str] = []
        omitted: list[str] = []

        for section in strategy.sections:
            if budget_mgr.is_exhausted():
                omitted.append(section.name)
                continue

            content = self._fetch_section(section, target, params.caller_depth)
            if content is None:
                continue

            tokens = budget_mgr.count_tokens(content)

            if budget_mgr.can_fit(tokens):
                context[section.name] = content
                budget_mgr.consume(tokens)
                included.append(section.name)
            elif budget_mgr.remaining() > 100:
                truncated = budget_mgr.truncate_to_fit(content)
                context[section.name] = truncated
                context[f"{section.name}_truncated"] = True
                budget_mgr.consume_all()
                included.append(section.name)
            else:
                omitted.append(section.name)

        elapsed_ms = int((time.time() - start_time) * 1000)
        return AIContextResponse(
            symbol=target.name,
            file_path=target.file_path,
            kind=target.kind,
            intent=params.intent,
            context=context,
            metadata={
                "budget_used": budget_mgr.used(),
                "budget_total": params.token_budget,
                "sections_included": included,
                "sections_omitted": omitted,
                "query_time_ms": elapsed_ms,
            },
        )

    def _fetch_section(self, section: SectionDef, symbol: Any, caller_depth: int) -> Any:
        try:
            handlers = {
                "source": self._fetch_source,
                "callers": lambda s: self._fetch_callers(s, caller_depth, section.format),
                "callees": lambda s: self._fetch_callees(s, caller_depth),
                "siblings": self._fetch_siblings,
                "imports": self._fetch_imports,
                "tests": self._fetch_related_tests,
                "type_definitions": self._fetch_type_definitions,
                "doc_comment": self._fetch_doc_comment,
                "error_patterns": self._fetch_error_patterns,
                "recent_changes": self._fetch_recent_changes,
                "test_patterns": self._fetch_test_patterns,
                "mocks_needed": self._fetch_mocks_needed,
            }
            handler = handlers.get(section.name)
            return handler(symbol) if handler else None
        except Exception:
            return None

    def _fetch_source(self, symbol: Any) -> str | None:
        try:
            full_path = os.path.join(self._workspace, symbol.file_path)
            if not os.path.isfile(full_path):
                return None
            with open(full_path, encoding="utf-8") as f:
                lines = f.readlines()
            start = symbol.line - 1
            end = self._get_symbol_end_line(symbol) or start + 50
            return "".join(lines[start:end])
        except (OSError, IndexError):
            return None

    def _fetch_callers(self, symbol: Any, depth: int, fmt: str) -> Any:
        result = self._call_graph.find_callers(symbol.name, depth, 10)
        if not result.results:
            return None
        if fmt == "summary":
            return [f"{r.symbol} ({r.file_path}:{r.call_site_line})" for r in result.results]
        return [{"symbol": r.symbol, "file": r.file_path, "line": r.call_site_line, "kind": r.kind} for r in result.results]

    def _fetch_callees(self, symbol: Any, depth: int) -> Any:
        result = self._call_graph.find_callees(symbol.name, depth, 10)
        if not result.results:
            return None
        return [{"symbol": r.symbol, "file": r.file_path, "line": r.call_site_line, "kind": r.kind} for r in result.results]

    def _fetch_siblings(self, symbol: Any) -> Any:
        if symbol.parent_symbol_id:
            cur = self._conn.execute(
                "SELECT name, kind, signature, start_line FROM symbols WHERE parent_symbol = ? AND id != ? ORDER BY start_line",
                (str(symbol.parent_symbol_id), symbol.id),
            )
        else:
            cur = self._conn.execute(
                """SELECT s.name, s.kind, s.signature, s.start_line
                   FROM symbols s JOIN files f ON s.file_id = f.id
                   WHERE f.relative_path = ? AND s.parent_symbol IS NULL AND s.id != ?
                   ORDER BY s.start_line""",
                (symbol.file_path, symbol.id),
            )
        rows = cur.fetchall()
        if not rows:
            return None
        return [{"name": r[0], "kind": r[1], "signature": r[2], "line": r[3]} for r in rows]

    def _fetch_imports(self, symbol: Any) -> Any:
        cur = self._conn.execute(
            """SELECT DISTINCT r.target_symbol
               FROM relationships r
               WHERE r.source_symbol_id = ? AND r.kind = 'imports'""",
            (symbol.id,),
        )
        rows = cur.fetchall()
        return [r[0] for r in rows] if rows else None

    def _fetch_related_tests(self, symbol: Any) -> Any:
        cur = self._conn.execute(
            """SELECT DISTINCT f.relative_path
               FROM relationships r
               JOIN files f ON r.file_path = f.relative_path
               WHERE r.target_symbol LIKE ?
               AND (f.relative_path LIKE '%test%' OR f.relative_path LIKE '%spec%')
               LIMIT 5""",
            (f"%{symbol.name}%",),
        )
        rows = cur.fetchall()
        return [r[0] for r in rows] if rows else None

    def _fetch_type_definitions(self, symbol: Any) -> Any:
        cur = self._conn.execute(
            """SELECT DISTINCT s.name, s.kind, s.signature, f.relative_path
               FROM relationships r
               JOIN symbols s ON s.id = r.target_symbol_id
               JOIN files f ON s.file_id = f.id
               WHERE r.source_symbol_id = ? AND s.kind IN ('interface', 'type_alias', 'enum', 'class')
               LIMIT 10""",
            (symbol.id,),
        )
        rows = cur.fetchall()
        return [{"name": r[0], "kind": r[1], "signature": r[2], "file": r[3]} for r in rows] if rows else None

    def _fetch_doc_comment(self, symbol: Any) -> str | None:
        cur = self._conn.execute("SELECT doc_comment FROM symbols WHERE id = ?", (symbol.id,))
        row = cur.fetchone()
        return row[0] if row and row[0] else None

    def _fetch_error_patterns(self, symbol: Any) -> Any:
        source = self._fetch_source(symbol)
        if not source:
            return None
        patterns: list[dict[str, Any]] = []
        for i, line in enumerate(source.splitlines(), 1):
            stripped = line.strip()
            if stripped.startswith("raise "):
                patterns.append({"type": "raise", "line": i, "text": stripped})
            elif stripped.startswith("except"):
                patterns.append({"type": "except", "line": i, "text": stripped})
            elif ".catch(" in stripped:
                patterns.append({"type": "promise-catch", "line": i, "text": stripped})
        return patterns if patterns else None

    def _fetch_recent_changes(self, symbol: Any) -> Any:
        commits = self._git_service.get_file_history(symbol.file_path, 5)
        return [{"hash": c.hash, "message": c.message} for c in commits] if commits else None

    def _fetch_test_patterns(self, symbol: Any) -> Any:
        cur = self._conn.execute(
            """SELECT DISTINCT s.name
               FROM symbols s JOIN files f ON s.file_id = f.id
               WHERE (f.relative_path LIKE '%test%' OR f.relative_path LIKE '%spec%')
               AND s.kind = 'function'
               AND f.module = (SELECT module FROM files WHERE relative_path = ?)
               LIMIT 10""",
            (symbol.file_path,),
        )
        rows = cur.fetchall()
        return [r[0] for r in rows] if rows else None

    def _fetch_mocks_needed(self, symbol: Any) -> Any:
        result = self._call_graph.find_callees(symbol.name, 1, 20)
        if not result.results:
            return None
        deps = [
            {"symbol": r.symbol, "file": r.file_path}
            for r in result.results
            if r.file_path != symbol.file_path and r.file_path != "(external)"
        ]
        return deps if deps else None

    def _get_symbol_end_line(self, symbol: Any) -> int | None:
        cur = self._conn.execute("SELECT end_line FROM symbols WHERE id = ?", (symbol.id,))
        row = cur.fetchone()
        return row[0] if row and row[0] else None

    def _not_found(self, params: AIContextParams, start_time: float) -> AIContextResponse:
        suggestions = self._resolver.suggest(params.symbol)
        elapsed_ms = int((time.time() - start_time) * 1000)
        return AIContextResponse(
            symbol=params.symbol,
            file_path="",
            kind="unknown",
            intent=params.intent,
            context={"error": f'Symbol "{params.symbol}" not found', "suggestions": suggestions},
            metadata={
                "budget_used": 0,
                "budget_total": params.token_budget,
                "sections_included": [],
                "sections_omitted": [],
                "query_time_ms": elapsed_ms,
            },
        )
