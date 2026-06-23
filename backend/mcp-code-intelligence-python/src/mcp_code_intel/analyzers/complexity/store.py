"""KSA-161: SQLite CRUD for complexity results."""
from __future__ import annotations
import sqlite3
from typing import Optional
from .models import (
    ComplexityResult, ComplexityFilters, ComplexityQueryResult,
    ComplexitySummary, Grade, SortBy,
)

CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS complexity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol_id INTEGER NOT NULL,
  cyclomatic_complexity INTEGER NOT NULL DEFAULT 1,
  branches INTEGER NOT NULL DEFAULT 0,
  loops INTEGER NOT NULL DEFAULT 0,
  logical_ops INTEGER NOT NULL DEFAULT 0,
  nesting_depth INTEGER NOT NULL DEFAULT 0,
  early_returns INTEGER NOT NULL DEFAULT 0,
  exception_handlers INTEGER NOT NULL DEFAULT 0,
  grade TEXT NOT NULL DEFAULT 'A',
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
  UNIQUE(symbol_id)
);
CREATE INDEX IF NOT EXISTS idx_complexity_grade ON complexity(grade);
CREATE INDEX IF NOT EXISTS idx_complexity_cc ON complexity(cyclomatic_complexity DESC);
"""


class ComplexityStore:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn
        self._ensure_table()

    def upsert(self, result: ComplexityResult) -> None:
        self._conn.execute(
            """INSERT OR REPLACE INTO complexity
               (symbol_id, cyclomatic_complexity, branches, loops, logical_ops,
                nesting_depth, early_returns, exception_handlers, grade, computed_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
            (result.symbol_id, result.cyclomatic_complexity, result.branches,
             result.loops, result.logical_ops, result.nesting_depth,
             result.early_returns, result.exception_handlers, result.grade.value),
        )

    def upsert_batch(self, results: list[ComplexityResult]) -> None:
        for r in results:
            self.upsert(r)
        self._conn.commit()

    def get_by_symbol(self, symbol_id: int) -> Optional[ComplexityResult]:
        row = self._conn.execute(
            """SELECT c.*, s.name as symbol_name, f.relative_path as file_path,
                      s.start_line, s.end_line
               FROM complexity c JOIN symbols s ON s.id = c.symbol_id
               JOIN files f ON f.id = s.file_id WHERE c.symbol_id = ?""",
            (symbol_id,),
        ).fetchone()
        return self._map_row(row) if row else None

    def query(self, filters: ComplexityFilters) -> ComplexityQueryResult:
        where, params = self._build_where(filters)
        total = self._conn.execute(
            f"SELECT COUNT(*) FROM complexity c JOIN symbols s ON s.id = c.symbol_id "
            f"JOIN files f ON f.id = s.file_id WHERE {where}", params,
        ).fetchone()[0]

        order = {"name": "s.name ASC", "file": "f.relative_path ASC"}.get(
            filters.sort_by.value, "c.cyclomatic_complexity DESC")
        rows = self._conn.execute(
            f"""SELECT c.*, s.name as symbol_name, f.relative_path as file_path,
                       s.start_line, s.end_line
                FROM complexity c JOIN symbols s ON s.id = c.symbol_id
                JOIN files f ON f.id = s.file_id WHERE {where}
                ORDER BY {order} LIMIT ?""",
            params + [filters.limit],
        ).fetchall()
        results = [self._map_row(r) for r in rows]
        summary = self._compute_summary(filters.module)
        return ComplexityQueryResult(results=results, total=total, summary=summary)

    def _build_where(self, f: ComplexityFilters) -> tuple[str, list]:
        clauses, params = ["1=1"], []
        if f.file_path:
            clauses.append("f.relative_path LIKE ?"); params.append(f"%{f.file_path}%")
        if f.symbol_name:
            clauses.append("s.name LIKE ?"); params.append(f"%{f.symbol_name}%")
        if f.min_complexity is not None:
            clauses.append("c.cyclomatic_complexity >= ?"); params.append(f.min_complexity)
        if f.grade_filter:
            ph = ",".join("?" * len(f.grade_filter))
            clauses.append(f"c.grade IN ({ph})")
            params.extend(g.value for g in f.grade_filter)
        if f.module:
            clauses.append("f.module = ?"); params.append(f.module)
        return " AND ".join(clauses), params

    def _compute_summary(self, module: Optional[str]) -> ComplexitySummary:
        dist: dict[Grade, int] = {g: 0 for g in Grade}
        sql = "SELECT grade, COUNT(*) FROM complexity c JOIN symbols s ON s.id = c.symbol_id JOIN files f ON f.id = s.file_id"
        params: list = []
        if module:
            sql += " WHERE f.module = ?"; params.append(module)
        sql += " GROUP BY grade"
        for row in self._conn.execute(sql, params).fetchall():
            try:
                dist[Grade(row[0])] = row[1]
            except ValueError:
                pass
        avg_row = self._conn.execute("SELECT AVG(cyclomatic_complexity) FROM complexity").fetchone()
        avg = avg_row[0] if avg_row and avg_row[0] else 0.0
        return ComplexitySummary(average=avg, grade_distribution=dist)

    def _map_row(self, row) -> ComplexityResult:
        return ComplexityResult(
            symbol_id=row[1], symbol_name=row[10], file_path=row[11],
            start_line=row[12], end_line=row[13],
            grade=Grade(row[9]) if row[9] in [g.value for g in Grade] else Grade.A,
            cyclomatic_complexity=row[2], branches=row[3], loops=row[4],
            logical_ops=row[5], nesting_depth=row[6], early_returns=row[7],
            exception_handlers=row[8],
        )

    def _ensure_table(self) -> None:
        self._conn.executescript(CREATE_TABLE)
