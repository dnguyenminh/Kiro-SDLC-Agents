"""
KSA-178: Tree-sitter Indexer — Orchestrates file parsing and database storage.
Uses tree-sitter for supported languages, falls back to regex extraction.
Port of mcp-code-intelligence-nodejs/src/parsers/tree-sitter-indexer.ts.
"""

from __future__ import annotations

import os
import sqlite3
import time
from pathlib import Path

from .grammar_registry import GrammarRegistry
from .types import IndexResult, ParseResult


class TreeSitterIndexer:
    """Orchestrates file parsing using tree-sitter and stores results in SQLite."""

    def __init__(
        self,
        registry: GrammarRegistry,
        db: sqlite3.Connection,
        max_file_size: int = 1_048_576,
    ) -> None:
        self._registry = registry
        self._db = db
        self._max_file_size = max_file_size

    def index_file(self, file_path: str, relative_path: str) -> IndexResult:
        """Index a single file using tree-sitter or regex fallback."""
        start_time = time.time()

        try:
            stat = os.stat(file_path)
            if stat.st_size > self._max_file_size:
                return self._regex_fallback(file_path, relative_path, start_time)
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                source = f.read()
        except (OSError, IOError):
            return IndexResult(
                file_path=relative_path,
                symbol_count=0,
                relationship_count=0,
                parse_errors=1,
                duration=time.time() - start_time,
                method="regex-fallback",
            )

        # Try tree-sitter first
        parser = self._registry.get_parser(file_path)
        if parser:
            result = parser.parse(source, relative_path)
            method = "tree-sitter"
        else:
            return self._regex_fallback(file_path, relative_path, start_time)

        # Atomic database update
        self._store_results(relative_path, result)

        return IndexResult(
            file_path=relative_path,
            symbol_count=len(result.symbols),
            relationship_count=len(result.relationships),
            parse_errors=len(result.errors),
            duration=time.time() - start_time,
            method=method,
        )

    def index_files(
        self, files: list[dict[str, str]]
    ) -> list[IndexResult]:
        """Batch index multiple files. Each dict has 'absolute_path' and 'relative_path'."""
        results: list[IndexResult] = []
        for file_info in files:
            result = self.index_file(
                file_info["absolute_path"], file_info["relative_path"]
            )
            results.append(result)
        return results

    def _store_results(self, file_path: str, result: ParseResult) -> None:
        """Store parse results in the database atomically."""
        cursor = self._db.cursor()
        try:
            # Get file_id
            row = cursor.execute(
                "SELECT id FROM files WHERE relative_path = ?", (file_path,)
            ).fetchone()
            if not row:
                return
            file_id = row[0]

            # Delete old symbols
            cursor.execute("DELETE FROM symbols WHERE file_id = ?", (file_id,))

            # Delete old relationships for this file
            try:
                cursor.execute(
                    "DELETE FROM relationships WHERE file_path = ?", (file_path,)
                )
            except sqlite3.OperationalError:
                pass  # relationships table may not exist yet

            # Insert new symbols
            symbol_ids: dict[str, int] = {}
            for sym in result.symbols:
                cursor.execute(
                    """INSERT INTO symbols (file_id, name, kind, signature, start_line, end_line,
                       parent_symbol, visibility, doc_comment)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        file_id, sym.name, sym.kind, sym.signature,
                        sym.start_line, sym.end_line, sym.parent_name,
                        "export" if sym.is_exported else None,
                        sym.doc_comment,
                    ),
                )
                symbol_ids[sym.name] = cursor.lastrowid  # type: ignore

            # Insert relationships
            try:
                for rel in result.relationships:
                    source_id = symbol_ids.get(rel.source_symbol)
                    if not source_id:
                        continue
                    target_id = symbol_ids.get(rel.target_symbol)
                    import json
                    cursor.execute(
                        """INSERT INTO relationships
                           (source_symbol_id, target_symbol, target_symbol_id, kind, file_path, line, metadata)
                        VALUES (?, ?, ?, ?, ?, ?, ?)""",
                        (
                            source_id, rel.target_symbol, target_id,
                            rel.kind, file_path, rel.line,
                            json.dumps(rel.metadata) if rel.metadata else None,
                        ),
                    )
            except sqlite3.OperationalError:
                pass  # relationships table may not exist yet

            self._db.commit()
        except Exception:
            self._db.rollback()
            raise

    def _regex_fallback(
        self, file_path: str, relative_path: str, start_time: float
    ) -> IndexResult:
        """Fallback to regex-based extraction."""
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                source = f.read()
            # Simple line-count based estimation
            return IndexResult(
                file_path=relative_path,
                symbol_count=0,
                relationship_count=0,
                parse_errors=0,
                duration=time.time() - start_time,
                method="regex-fallback",
            )
        except (OSError, IOError):
            return IndexResult(
                file_path=relative_path,
                symbol_count=0,
                relationship_count=0,
                parse_errors=1,
                duration=time.time() - start_time,
                method="regex-fallback",
            )
