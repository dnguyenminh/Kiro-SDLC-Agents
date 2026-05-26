"""Main dead code detection using call graph reachability + confidence scoring."""

from __future__ import annotations

import sqlite3
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .reachability import ReachabilityAnalyzer
from .confidence_scorer import ConfidenceScorer, ScoredCandidate
from .dynamic_dispatch import DynamicDispatchRecognizer


@dataclass
class DeadCodeReport:
    """Report of detected dead code."""
    total_functions_scanned: int
    total_reachable: int
    candidates: list[ScoredCandidate]
    summary: str = ""


class SimpleCallGraph:
    """Simple call graph backed by SQLite symbols + references."""

    def __init__(self, db_conn: sqlite3.Connection) -> None:
        self._conn = db_conn
        self._callees_cache: dict[str, list[str]] = {}
        self._callers_cache: dict[str, list[str]] = {}

    def get_callees(self, node_id: str) -> list[str]:
        """Get functions called by node_id. Uses symbol references from DB."""
        if node_id in self._callees_cache:
            return self._callees_cache[node_id]

        parts = node_id.split(":", 1)
        if len(parts) != 2:
            return []

        file_path, func_name = parts

        row = self._conn.execute("""
            SELECT s.start_line, s.end_line, f.id
            FROM symbols s
            JOIN files f ON s.file_id = f.id
            WHERE f.relative_path = ? AND s.name = ?
            LIMIT 1
        """, (file_path, func_name)).fetchone()

        if not row:
            self._callees_cache[node_id] = []
            return []

        # Placeholder — full call graph requires KSA-154
        self._callees_cache[node_id] = []
        return []

    def get_callers(self, node_id: str) -> list[str]:
        """Get functions that call node_id."""
        if node_id in self._callers_cache:
            return self._callers_cache[node_id]
        self._callers_cache[node_id] = []
        return []


class DeadCodeDetector:
    """Detect unreachable code using call graph reachability + confidence scoring."""

    def __init__(
        self,
        db_conn: sqlite3.Connection,
        workspace: str,
        entry_points: list[str] | None = None,
        min_confidence: int = 60,
    ) -> None:
        self._conn = db_conn
        self._workspace = workspace
        self._entry_points = entry_points or []
        self.min_confidence = min_confidence
        self._scorer = ConfidenceScorer()
        self._dispatch_recognizer = DynamicDispatchRecognizer()

    def detect(self, file_path: str | None = None) -> DeadCodeReport:
        """Find dead code with confidence scoring."""
        all_functions = self._get_all_functions(file_path)
        _log(f"Scanning {len(all_functions)} functions for dead code")

        if not all_functions:
            return DeadCodeReport(
                total_functions_scanned=0,
                total_reachable=0,
                candidates=[],
                summary="No functions found to analyze.",
            )

        call_graph = SimpleCallGraph(self._conn)
        entry_points = self._entry_points or self._detect_entry_points()
        analyzer = ReachabilityAnalyzer(call_graph, entry_points)
        reachable = analyzer.compute_reachable()

        all_ids = [f["id"] for f in all_functions]
        unreachable_ids = set(all_ids) - reachable

        candidates: list[ScoredCandidate] = []
        for func in all_functions:
            if func["id"] not in unreachable_ids:
                continue

            context = self._build_scoring_context(func)
            confidence, reasons = self._scorer.score(func["id"], context)

            if confidence >= self.min_confidence:
                candidates.append(ScoredCandidate(
                    function_id=func["id"],
                    name=func["name"],
                    file_path=func["file_path"],
                    start_line=func["start_line"],
                    end_line=func["end_line"],
                    confidence=confidence,
                    reasons=reasons,
                ))

        candidates.sort(key=lambda c: c.confidence, reverse=True)

        summary = (
            f"Scanned {len(all_functions)} functions. "
            f"{len(reachable)} reachable from entry points. "
            f"{len(candidates)} dead code candidates (confidence >= {self.min_confidence}%)."
        )

        return DeadCodeReport(
            total_functions_scanned=len(all_functions),
            total_reachable=len(reachable),
            candidates=candidates,
            summary=summary,
        )

    def _get_all_functions(self, file_path: str | None) -> list[dict[str, Any]]:
        """Get all function/method symbols from DB."""
        sql = """
            SELECT s.name, s.kind, s.start_line, s.end_line, s.visibility,
                   f.relative_path, s.doc_comment
            FROM symbols s
            JOIN files f ON s.file_id = f.id
            WHERE s.kind IN ('function', 'method')
        """
        params: list[Any] = []
        if file_path:
            sql += " AND f.relative_path = ?"
            params.append(file_path)

        rows = self._conn.execute(sql, params).fetchall()
        return [
            {
                "id": f"{row[5]}:{row[0]}",
                "name": row[0],
                "kind": row[1],
                "start_line": row[2],
                "end_line": row[3],
                "visibility": row[4],
                "file_path": row[5],
                "doc_comment": row[6] or "",
            }
            for row in rows
        ]

    def _detect_entry_points(self) -> list[str]:
        """Auto-detect entry points (main, exported, test, route handlers)."""
        entry_patterns = [
            "main", "__main__", "app", "server",
            "handle_", "route_", "endpoint_",
            "test_", "setup", "teardown",
        ]
        entries: list[str] = []

        rows = self._conn.execute("""
            SELECT s.name, f.relative_path, s.visibility
            FROM symbols s
            JOIN files f ON s.file_id = f.id
            WHERE s.kind IN ('function', 'method')
        """).fetchall()

        for row in rows:
            name, file_path, visibility = row[0], row[1], row[2]
            func_id = f"{file_path}:{name}"

            if visibility in ("public", "export"):
                entries.append(func_id)
                continue

            for pattern in entry_patterns:
                if name.startswith(pattern) or name == pattern:
                    entries.append(func_id)
                    break

        _log(f"Detected {len(entries)} entry points")
        return entries

    def _build_scoring_context(self, func: dict[str, Any]) -> dict[str, bool]:
        """Build context dict for confidence scoring."""
        context: dict[str, bool] = {}

        context["no_callers"] = True
        context["not_exported"] = func.get("visibility") not in ("public", "export")

        doc = func.get("doc_comment", "")
        context["has_deprecated"] = self._dispatch_recognizer.has_deprecated_marker(doc)

        file_path = Path(self._workspace) / func["file_path"]
        if file_path.exists():
            try:
                source = file_path.read_text(encoding="utf-8", errors="replace")
                lines = source.split("\n")
                start = max(0, func["start_line"] - 1)
                end = min(len(lines), func["end_line"])
                body = "\n".join(lines[start:end])
                context["dynamic_dispatch"] = self._dispatch_recognizer.is_dynamically_dispatched(body)
            except (OSError, UnicodeDecodeError):
                context["dynamic_dispatch"] = False
        else:
            context["dynamic_dispatch"] = False

        context["no_tests"] = not self._has_tests(func["name"])
        context["recently_modified"] = False
        context["config_reference"] = False

        return context

    def _has_tests(self, function_name: str) -> bool:
        """Check if function has associated tests."""
        test_name = f"test_{function_name}"
        row = self._conn.execute("""
            SELECT COUNT(*) as c FROM symbols
            WHERE name LIKE ? AND kind IN ('function', 'method')
        """, (f"%{test_name}%",)).fetchone()
        return row[0] > 0 if row else False


def _log(msg: str) -> None:
    print(f"[dead-code] {msg}", file=sys.stderr, flush=True)
