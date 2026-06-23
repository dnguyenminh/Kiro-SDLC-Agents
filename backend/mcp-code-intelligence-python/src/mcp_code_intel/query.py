"""Query layer — FTS5 search, symbol lookup, module listing."""

import re
from typing import Any

from .db import DatabaseManager


class QueryLayer:
    """Data access layer for all MCP tool handlers."""

    def __init__(self, db: DatabaseManager) -> None:
        self._db = db

    def search_code(self, query: str, limit: int = 20) -> list[dict[str, Any]]:
        """Full-text search across symbols using FTS5."""
        fts_query = _sanitize_fts_query(query)
        rows = self._db.conn.execute("""
            SELECT s.name, s.kind, s.signature, f.relative_path as file_path,
                   s.start_line, s.end_line, s.doc_comment, rank
            FROM symbols_fts
            JOIN symbols s ON symbols_fts.rowid = s.id
            JOIN files f ON s.file_id = f.id
            WHERE symbols_fts MATCH ?
            ORDER BY rank
            LIMIT ?
        """, (fts_query, limit)).fetchall()
        return [dict(r) for r in rows]

    def find_symbols(self, name: str, kind: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
        """Lookup symbols by name prefix."""
        sql = """
            SELECT s.name, s.kind, s.signature, f.relative_path as file_path,
                   s.start_line, s.end_line, s.visibility, s.doc_comment, s.parent_symbol
            FROM symbols s
            JOIN files f ON s.file_id = f.id
            WHERE s.name LIKE ?
        """
        params: list[Any] = [f"{name}%"]
        if kind:
            sql += " AND s.kind = ?"
            params.append(kind)
        sql += " ORDER BY s.name LIMIT ?"
        params.append(limit)
        rows = self._db.conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]

    def get_file_symbols(self, relative_path: str) -> list[dict[str, Any]]:
        """Get symbols in a specific file."""
        rows = self._db.conn.execute("""
            SELECT s.name, s.kind, s.signature, f.relative_path as file_path,
                   s.start_line, s.end_line, s.visibility, s.doc_comment, s.parent_symbol
            FROM symbols s
            JOIN files f ON s.file_id = f.id
            WHERE f.relative_path = ?
            ORDER BY s.start_line
        """, (relative_path,)).fetchall()
        return [dict(r) for r in rows]

    def list_modules(self) -> list[dict[str, Any]]:
        """List all modules with stats and pattern metadata."""
        rows = self._db.conn.execute("""
            SELECT name, root_path, language, description, file_count, symbol_count,
                   di_style, error_handling, naming_convention,
                   logging_framework, testing_framework, purpose
            FROM modules ORDER BY name
        """).fetchall()
        return [dict(r) for r in rows]

    def list_modules_with_patterns(self, name: str | None = None) -> list[dict[str, Any]]:
        """List modules with pattern metadata, optionally filtered by name."""
        if not name:
            return self.list_modules()
        rows = self._db.conn.execute("""
            SELECT name, root_path, language, description, file_count, symbol_count,
                   di_style, error_handling, naming_convention,
                   logging_framework, testing_framework, purpose
            FROM modules WHERE name LIKE ? ORDER BY name
        """, (f"{name}%",)).fetchall()
        return [dict(r) for r in rows]

    def get_index_status(self) -> dict[str, Any]:
        """Get index status and statistics."""
        conn = self._db.conn
        total_files = conn.execute("SELECT COUNT(*) as c FROM files").fetchone()["c"]
        total_symbols = conn.execute("SELECT COUNT(*) as c FROM symbols").fetchone()["c"]
        total_modules = conn.execute("SELECT COUNT(*) as c FROM modules").fetchone()["c"]
        last_row = conn.execute("SELECT MAX(last_indexed) as t FROM files").fetchone()
        lang_rows = conn.execute("SELECT language, COUNT(*) as c FROM files GROUP BY language").fetchall()

        languages = {row["language"]: row["c"] for row in lang_rows}
        return {
            "total_files": total_files,
            "total_symbols": total_symbols,
            "total_modules": total_modules,
            "languages": languages,
            "last_indexed": last_row["t"] if last_row else None,
        }


def _sanitize_fts_query(query: str) -> str:
    """Sanitize query for FTS5 MATCH syntax."""
    cleaned = re.sub(r"[^\w\s*\"]", " ", query).strip()
    return cleaned if cleaned else "*"
