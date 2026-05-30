"""KSA-163: Dead Import Detector."""
from __future__ import annotations
import json
import sqlite3
from . import DeadImport


class DeadImportDetector:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def detect(self, file_path: str | None = None, module: str | None = None, limit: int = 50) -> list[DeadImport]:
        sql = """SELECT r.file_path, r.line, r.target_symbol, r.metadata
                 FROM relationships r WHERE r.kind = 'imports'
                 AND NOT EXISTS (
                   SELECT 1 FROM relationships r2
                   WHERE r2.file_path = r.file_path AND r2.kind IN ('calls','uses')
                   AND r2.target_symbol = r.target_symbol AND r2.id != r.id
                 )"""
        params: list = []
        if file_path: sql += " AND r.file_path LIKE ?"; params.append(f"%{file_path}%")
        if module: sql += " AND r.file_path LIKE ?"; params.append(f"%{module}%")
        sql += " ORDER BY r.file_path, r.line LIMIT ?"
        params.append(limit)
        results = []
        for row in self._conn.execute(sql, params).fetchall():
            from_mod = ""
            if row[3]:
                try:
                    meta = json.loads(row[3])
                    from_mod = meta.get("source", meta.get("from", ""))
                except (json.JSONDecodeError, TypeError):
                    pass
            results.append(DeadImport(row[0], row[1], row[2], from_mod))
        return results
