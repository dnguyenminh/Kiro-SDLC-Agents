"""KSA-162: SQLite store for entry points."""
from __future__ import annotations
import sqlite3
from . import EntryPoint, EntryPointFilters, EntryPointQueryResult, EntryPointSummary, AuthCoverage, EntryType, Confidence

CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS entry_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol_id INTEGER NOT NULL,
  entry_type TEXT NOT NULL,
  framework TEXT,
  http_method TEXT,
  route_path TEXT,
  full_route TEXT,
  middleware TEXT,
  has_auth INTEGER NOT NULL DEFAULT 0,
  controller TEXT,
  event_name TEXT,
  confidence TEXT NOT NULL DEFAULT 'Medium',
  FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
  UNIQUE(symbol_id)
);
CREATE INDEX IF NOT EXISTS idx_ep_type ON entry_points(entry_type);
CREATE INDEX IF NOT EXISTS idx_ep_route ON entry_points(full_route);
"""


class EntryPointStore:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn
        self._conn.executescript(CREATE_TABLE)

    def upsert_batch(self, entries: list[EntryPoint]) -> None:
        for ep in entries:
            self._conn.execute(
                """INSERT OR REPLACE INTO entry_points
                   (symbol_id, entry_type, framework, http_method, route_path,
                    full_route, middleware, has_auth, controller, event_name, confidence)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (ep.symbol_id, ep.entry_type.value, ep.framework, ep.http_method,
                 ep.route_path, ep.full_route, ",".join(ep.middleware),
                 1 if ep.has_auth else 0, ep.controller, ep.event_name, ep.confidence.value),
            )
        self._conn.commit()

    def query(self, filters: EntryPointFilters) -> EntryPointQueryResult:
        where, params = self._build_where(filters)
        total = self._conn.execute(
            f"SELECT COUNT(*) FROM entry_points ep JOIN symbols s ON s.id = ep.symbol_id "
            f"JOIN files f ON f.id = s.file_id WHERE {where}", params,
        ).fetchone()[0]
        rows = self._conn.execute(
            f"""SELECT ep.*, s.name as symbol_name, f.relative_path as file_path, s.start_line
                FROM entry_points ep JOIN symbols s ON s.id = ep.symbol_id
                JOIN files f ON f.id = s.file_id WHERE {where}
                ORDER BY ep.entry_type, s.name LIMIT ?""",
            params + [filters.limit],
        ).fetchall()
        results = [self._map_row(r) for r in rows]
        return EntryPointQueryResult(results, total, self._summary(results))

    def _build_where(self, f: EntryPointFilters) -> tuple[str, list]:
        clauses, params = ["1=1"], []
        if f.entry_type: clauses.append("ep.entry_type = ?"); params.append(f.entry_type.value)
        if f.framework: clauses.append("ep.framework = ?"); params.append(f.framework)
        if f.http_method: clauses.append("ep.http_method = ?"); params.append(f.http_method.upper())
        if f.route_pattern: clauses.append("ep.full_route LIKE ?"); params.append(f"%{f.route_pattern}%")
        if f.has_auth is not None: clauses.append("ep.has_auth = ?"); params.append(1 if f.has_auth else 0)
        if f.file_path: clauses.append("f.relative_path LIKE ?"); params.append(f"%{f.file_path}%")
        return " AND ".join(clauses), params

    def _summary(self, results: list[EntryPoint]) -> EntryPointSummary:
        by_type: dict[str, int] = {}
        by_fw: dict[str, int] = {}
        with_auth = 0
        for r in results:
            by_type[r.entry_type.value] = by_type.get(r.entry_type.value, 0) + 1
            if r.framework: by_fw[r.framework] = by_fw.get(r.framework, 0) + 1
            if r.has_auth: with_auth += 1
        return EntryPointSummary(by_type, by_fw, AuthCoverage(with_auth, len(results) - with_auth))

    def _map_row(self, row) -> EntryPoint:
        return EntryPoint(
            symbol_id=row[1], symbol_name=row[12], file_path=row[13], start_line=row[14],
            entry_type=EntryType(row[2]), framework=row[3], http_method=row[4],
            route_path=row[5], full_route=row[6],
            middleware=[m for m in (row[7] or "").split(",") if m],
            has_auth=bool(row[8]), controller=row[9], event_name=row[10],
            confidence=Confidence(row[11]) if row[11] else Confidence.Medium,
        )
