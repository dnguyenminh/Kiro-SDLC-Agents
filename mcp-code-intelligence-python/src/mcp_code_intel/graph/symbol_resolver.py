"""Symbol Resolver — resolves symbol names to database records. KSA-179."""

from __future__ import annotations

import sqlite3

from .models import ResolvedSymbol


class SymbolResolver:
    """Resolves symbol identifiers to indexed symbol records.

    Supports: exact match, qualified names (Class.method), file:symbol format.
    """

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def resolve(self, input_name: str) -> list[ResolvedSymbol]:
        """Resolve a symbol name to one or more database records."""
        # Strategy 1: Exact match
        results = self._exact_match(input_name)
        if results:
            return results

        # Strategy 2: Qualified name (Class.method)
        if "." in input_name:
            dot_idx = input_name.rfind(".")
            parent = input_name[:dot_idx]
            method = input_name[dot_idx + 1:]
            results = self._qualified_match(method, parent)
            if results:
                return results

        # Strategy 3: file:symbol format
        if ":" in input_name:
            colon_idx = input_name.rfind(":")
            file_part = input_name[:colon_idx]
            name_part = input_name[colon_idx + 1:]
            results = self._file_match(name_part, file_part)
            if results:
                return results

        return []

    def suggest(self, input_name: str, limit: int = 5) -> list[str]:
        """Suggest similar symbol names for 'did you mean?' responses."""
        cur = self._conn.execute(
            "SELECT DISTINCT name FROM symbols WHERE name LIKE ? LIMIT ?",
            (f"%{input_name}%", limit),
        )
        return [row[0] for row in cur.fetchall()]

    def _exact_match(self, name: str) -> list[ResolvedSymbol]:
        cur = self._conn.execute(
            """SELECT s.id, s.name, s.kind, f.relative_path, s.start_line, s.parent_symbol
               FROM symbols s
               JOIN files f ON s.file_id = f.id
               WHERE s.name = ?
               ORDER BY s.start_line ASC""",
            (name,),
        )
        return [self._to_resolved(row) for row in cur.fetchall()]

    def _qualified_match(self, method: str, parent: str) -> list[ResolvedSymbol]:
        cur = self._conn.execute(
            """SELECT s.id, s.name, s.kind, f.relative_path, s.start_line, s.parent_symbol
               FROM symbols s
               JOIN files f ON s.file_id = f.id
               JOIN symbols p ON p.id = CAST(s.parent_symbol AS INTEGER)
               WHERE s.name = ? AND p.name = ?""",
            (method, parent),
        )
        return [self._to_resolved(row) for row in cur.fetchall()]

    def _file_match(self, name: str, file_part: str) -> list[ResolvedSymbol]:
        cur = self._conn.execute(
            """SELECT s.id, s.name, s.kind, f.relative_path, s.start_line, s.parent_symbol
               FROM symbols s
               JOIN files f ON s.file_id = f.id
               WHERE s.name = ? AND f.relative_path LIKE ?""",
            (name, f"%{file_part}%"),
        )
        return [self._to_resolved(row) for row in cur.fetchall()]

    @staticmethod
    def _to_resolved(row: tuple) -> ResolvedSymbol:
        parent_id = int(row[5]) if row[5] and str(row[5]).isdigit() else None
        return ResolvedSymbol(
            id=row[0], name=row[1], kind=row[2],
            file_path=row[3], line=row[4], parent_symbol_id=parent_id,
        )
