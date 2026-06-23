"""Edit Context Service — source + callers + tests + git for editing. KSA-171."""

from __future__ import annotations

import os
import re
import sqlite3
import time
from typing import Any

from ..graph.call_graph_service import CallGraphService
from ..graph.symbol_resolver import SymbolResolver
from ..graph.test_detector import TestDetector
from .git_service import GitService
from .token_budget_manager import TokenBudgetManager
from .types import (
    CallerContext, EditContextParams, EditContextResult,
    GitCommit, SiblingContext, TestContext,
)


class EditContextService:
    """Gathers everything needed before modifying a symbol."""

    def __init__(
        self,
        conn: sqlite3.Connection,
        resolver: SymbolResolver,
        call_graph: CallGraphService,
        test_detector: TestDetector,
        workspace: str,
    ) -> None:
        self._conn = conn
        self._resolver = resolver
        self._call_graph = call_graph
        self._test_detector = test_detector
        self._git_service = GitService(workspace)
        self._budget_mgr = TokenBudgetManager(4000)
        self._workspace = workspace

    def get_context(self, params: EditContextParams) -> EditContextResult:
        """Get full edit context for a symbol."""
        start_time = time.time()

        # 1. Resolve symbol
        symbol = self._resolve_symbol_input(params.symbol)
        if not symbol:
            return self._not_found(params.symbol, params.token_budget, start_time)

        # 2. Read source (always included)
        source = self._read_symbol_source(symbol)
        signature = self._get_signature(symbol)

        # 3. Gather sections
        callers = self._get_caller_context(symbol, params.caller_depth) if params.include_callers else None
        tests = self._get_test_context(symbol) if params.include_tests else None
        git_history = self._get_git_context(symbol) if params.include_git else None
        siblings = self._get_sibling_context(symbol)

        # 4. Assemble within token budget
        sections: dict[str, dict[str, Any]] = {
            "source": {"content": source, "priority": 1},
        }
        if callers:
            sections["callers"] = {"content": callers, "priority": 2}
        if tests:
            sections["tests"] = {"content": tests, "priority": 3}
        if git_history:
            sections["git_history"] = {"content": git_history, "priority": 5}
        if siblings:
            sections["siblings"] = {"content": siblings, "priority": 6}

        assembled = self._budget_mgr.assemble(sections, params.token_budget)

        elapsed_ms = int((time.time() - start_time) * 1000)
        result = EditContextResult(
            symbol=symbol["name"],
            file=symbol["file_path"],
            line=symbol["line"],
            kind=symbol["kind"],
            source=assembled["result"].get("source", source),
            signature=signature,
            metadata={
                "tokenCount": assembled["token_count"],
                "tokenBudget": params.token_budget,
                "sectionsIncluded": assembled["included"],
                "sectionsExcluded": assembled["excluded"],
                "queryTimeMs": elapsed_ms,
            },
        )

        if "callers" in assembled["result"]:
            result.callers = assembled["result"]["callers"]
        if "tests" in assembled["result"]:
            result.tests = assembled["result"]["tests"]
        if "git_history" in assembled["result"]:
            result.git_history = assembled["result"]["git_history"]
        if "siblings" in assembled["result"]:
            result.siblings = assembled["result"]["siblings"]

        return result

    def _resolve_symbol_input(self, input_str: str) -> dict[str, Any] | None:
        # Try file:line format
        if ":" in input_str and re.search(r":\d+$", input_str):
            colon_idx = input_str.rfind(":")
            file_part = input_str[:colon_idx]
            line = int(input_str[colon_idx + 1:])
            return self._find_symbol_at_line(file_part, line)

        # Standard resolution
        resolved = self._resolver.resolve(input_str)
        if not resolved:
            return None

        sym = resolved[0]
        cur = self._conn.execute(
            "SELECT end_line, signature FROM symbols WHERE id = ?", (sym.id,)
        )
        row = cur.fetchone()
        return {
            "id": sym.id,
            "name": sym.name,
            "kind": sym.kind,
            "file_path": sym.file_path,
            "line": sym.line,
            "end_line": row[0] if row else None,
            "signature": row[1] if row else None,
            "parent_symbol_id": sym.parent_symbol_id,
        }

    def _find_symbol_at_line(self, file_part: str, line: int) -> dict[str, Any] | None:
        cur = self._conn.execute(
            """SELECT s.id, s.name, s.kind, f.relative_path, s.start_line,
                      s.end_line, s.signature, s.parent_symbol
               FROM symbols s JOIN files f ON s.file_id = f.id
               WHERE f.relative_path LIKE ? AND s.start_line <= ? AND s.end_line >= ?
               ORDER BY (s.end_line - s.start_line) ASC LIMIT 1""",
            (f"%{file_part}", line, line),
        )
        row = cur.fetchone()
        if not row:
            return None
        parent_id = int(row[7]) if row[7] and str(row[7]).isdigit() else None
        return {
            "id": row[0], "name": row[1], "kind": row[2], "file_path": row[3],
            "line": row[4], "end_line": row[5], "signature": row[6],
            "parent_symbol_id": parent_id,
        }

    def _read_symbol_source(self, symbol: dict[str, Any]) -> str:
        try:
            full_path = os.path.join(self._workspace, symbol["file_path"])
            with open(full_path, encoding="utf-8") as f:
                lines = f.readlines()
            start = symbol["line"] - 1
            end = symbol.get("end_line") or start + 50
            return "".join(lines[start:end])
        except (OSError, IndexError):
            return ""

    def _get_signature(self, symbol: dict[str, Any]) -> str | None:
        if symbol.get("signature"):
            return symbol["signature"]
        cur = self._conn.execute("SELECT signature FROM symbols WHERE id = ?", (symbol["id"],))
        row = cur.fetchone()
        return row[0] if row else None

    def _get_caller_context(self, symbol: dict[str, Any], depth: int) -> list[CallerContext] | None:
        result = self._call_graph.find_callers(symbol["name"], depth, 10)
        if not result.results:
            return None
        callers: list[CallerContext] = []
        for caller in result.results:
            ctx = self._get_line_context(caller.file_path, caller.call_site_line, 2)
            callers.append(CallerContext(
                symbol=caller.qualified_name or caller.symbol,
                file=caller.file_path,
                line=caller.call_site_line,
                context=ctx,
            ))
        return callers

    def _get_line_context(self, file_path: str, line: int, surrounding: int) -> str:
        try:
            full_path = os.path.join(self._workspace, file_path)
            with open(full_path, encoding="utf-8") as f:
                lines = f.readlines()
            start = max(0, line - 1 - surrounding)
            end = min(len(lines), line + surrounding)
            return "".join(lines[start:end])
        except (OSError, IndexError):
            return ""

    def _get_test_context(self, symbol: dict[str, Any]) -> list[TestContext] | None:
        from ..graph.models import ResolvedSymbol
        sym = ResolvedSymbol(
            id=symbol["id"], name=symbol["name"], kind=symbol["kind"],
            file_path=symbol["file_path"], line=symbol["line"],
            parent_symbol_id=symbol.get("parent_symbol_id"),
        )
        test_files = self._test_detector.find_related_tests([sym], [])
        results: list[TestContext] = []
        for tf in test_files[:3]:
            try:
                full_path = os.path.join(self._workspace, tf.file)
                with open(full_path, encoding="utf-8") as f:
                    content = f.read()
                blocks = self._extract_test_blocks(content, symbol["name"])
                for block in blocks[:2]:
                    results.append(TestContext(
                        file=tf.file, test_name=block["name"], source=block["source"],
                    ))
            except OSError:
                continue
        return results if results else None

    def _extract_test_blocks(self, content: str, symbol_name: str) -> list[dict[str, str]]:
        blocks: list[dict[str, str]] = []
        lines = content.splitlines()
        test_pattern = re.compile(r"""(?:it|test|describe|def test_)\s*[\('"](.*?)['"]""")

        for i, line in enumerate(lines):
            match = test_pattern.search(line)
            if match:
                window = "\n".join(lines[i:i + 10])
                if symbol_name in line or symbol_name in window:
                    name = match.group(1)
                    end = min(i + 15, len(lines))
                    source = "\n".join(lines[i:end])
                    blocks.append({"name": name, "source": source})
        return blocks

    def _get_git_context(self, symbol: dict[str, Any]) -> list[GitCommit] | None:
        commits = self._git_service.get_file_history(symbol["file_path"], 5)
        return commits if commits else None

    def _get_sibling_context(self, symbol: dict[str, Any]) -> list[SiblingContext] | None:
        if symbol.get("parent_symbol_id"):
            cur = self._conn.execute(
                "SELECT name, kind, signature, start_line FROM symbols WHERE parent_symbol = ? AND id != ? ORDER BY start_line",
                (str(symbol["parent_symbol_id"]), symbol["id"]),
            )
        else:
            cur = self._conn.execute(
                """SELECT s.name, s.kind, s.signature, s.start_line
                   FROM symbols s JOIN files f ON s.file_id = f.id
                   WHERE f.relative_path = ? AND s.parent_symbol IS NULL AND s.id != ?
                   ORDER BY s.start_line""",
                (symbol["file_path"], symbol["id"]),
            )
        rows = cur.fetchall()
        if not rows:
            return None
        return [SiblingContext(name=r[0], kind=r[1], signature=r[2], line=r[3]) for r in rows]

    def _not_found(self, symbol: str, budget: int, start_time: float) -> EditContextResult:
        elapsed_ms = int((time.time() - start_time) * 1000)
        return EditContextResult(
            symbol=symbol, file="", line=0, kind="unknown",
            source="", signature=None,
            metadata={
                "tokenCount": 0, "tokenBudget": budget,
                "sectionsIncluded": [], "sectionsExcluded": ["error: symbol not found"],
                "queryTimeMs": elapsed_ms,
            },
        )
