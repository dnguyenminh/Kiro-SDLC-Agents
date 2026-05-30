"""KSA-161: Complexity Analyzer — Main orchestrator."""
from __future__ import annotations
import sqlite3
from typing import Any, Callable, Optional
from .models import ComplexityResult, ComplexityFilters, ComplexityQueryResult, FileComplexityResult
from .calculator import ComplexityCalculator
from .grade_assigner import GradeAssigner
from .store import ComplexityStore


class ComplexityAnalyzer:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn
        self._calculator = ComplexityCalculator()
        self._grader = GradeAssigner()
        self._store = ComplexityStore(conn)

    def analyze_function(
        self, symbol_id: int, symbol_name: str, file_path: str,
        start_line: int, end_line: int, body_node: Any, language: str,
    ) -> Optional[ComplexityResult]:
        breakdown = self._calculator.calculate(body_node, language)
        if not breakdown:
            return None
        grade = self._grader.assign_grade(breakdown.cyclomatic_complexity)
        result = ComplexityResult(
            symbol_id=symbol_id, symbol_name=symbol_name,
            file_path=file_path, start_line=start_line, end_line=end_line,
            grade=grade, cyclomatic_complexity=breakdown.cyclomatic_complexity,
            branches=breakdown.branches, loops=breakdown.loops,
            logical_ops=breakdown.logical_ops,
            exception_handlers=breakdown.exception_handlers,
            nesting_depth=breakdown.nesting_depth,
            early_returns=breakdown.early_returns,
        )
        self._store.upsert(result)
        return result

    def analyze_file_from_db(
        self, file_path: str,
        parse_and_get_body: Callable[[int, int, int], Optional[Any]],
    ) -> FileComplexityResult:
        rows = self._conn.execute(
            """SELECT s.id, s.name, s.start_line, s.end_line, f.language, f.relative_path
               FROM symbols s JOIN files f ON f.id = s.file_id
               WHERE f.relative_path LIKE ? AND s.kind IN ('function','method')""",
            (f"%{file_path}%",),
        ).fetchall()
        results: list[ComplexityResult] = []
        for row in rows:
            body = parse_and_get_body(row[0], row[2], row[3])
            if not body:
                continue
            r = self.analyze_function(row[0], row[1], row[5], row[2], row[3], body, row[4])
            if r:
                results.append(r)
        total_cc = sum(r.cyclomatic_complexity for r in results)
        return FileComplexityResult(
            file_path=file_path, functions=results,
            average_complexity=total_cc / len(results) if results else 0.0,
            max_complexity=max((r.cyclomatic_complexity for r in results), default=0),
            total_functions=len(results),
        )

    def query(self, filters: ComplexityFilters) -> ComplexityQueryResult:
        return self._store.query(filters)

    def supports_language(self, language: str) -> bool:
        return self._calculator.supports_language(language)
