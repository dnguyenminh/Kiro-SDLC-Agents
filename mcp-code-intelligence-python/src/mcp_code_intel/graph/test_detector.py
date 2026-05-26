"""Test Detector — identifies test files and finds related tests. KSA-179."""

from __future__ import annotations

import posixpath
import re
import sqlite3

from .models import RelatedTest, ResolvedSymbol


class TestDetector:
    """Identifies test files and finds related tests for symbols."""

    _TEST_PATH_PATTERNS = [
        re.compile(r"/tests?/", re.IGNORECASE),
        re.compile(r"/__tests__/"),
        re.compile(r"/spec/", re.IGNORECASE),
    ]

    _TEST_FILE_PATTERNS = [
        re.compile(r"\.test\.[tj]sx?$"),
        re.compile(r"\.spec\.[tj]sx?$"),
        re.compile(r"Test\.kt$"),
        re.compile(r"_test\.py$"),
        re.compile(r"^test_.*\.py$"),
    ]

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def is_test_file(self, file_path: str) -> bool:
        """Check if a file path is a test file."""
        basename = posixpath.basename(file_path)
        return (
            any(p.search(file_path) for p in self._TEST_PATH_PATTERNS)
            or any(p.search(basename) for p in self._TEST_FILE_PATTERNS)
        )

    def find_related_tests(
        self,
        symbols: list[ResolvedSymbol],
        impact_files: list[str],
    ) -> list[RelatedTest]:
        """Find test files related to the given symbols and impacts."""
        results: list[RelatedTest] = []
        seen: set[str] = set()

        for sym in symbols:
            ext = posixpath.basename(sym.file_path).rsplit(".", 1)
            source_basename = ext[0] if len(ext) > 1 else posixpath.basename(sym.file_path)

            cur = self._conn.execute(
                """SELECT DISTINCT file_path FROM relationships
                   WHERE kind = 'imports' AND target_symbol LIKE ?""",
                (f"%{source_basename}%",),
            )
            for row in cur.fetchall():
                tf = row[0]
                if self.is_test_file(tf) and tf not in seen:
                    seen.add(tf)
                    results.append(RelatedTest(file=tf, reason=f"Tests {sym.name}"))

        for file in impact_files:
            if self.is_test_file(file) and file not in seen:
                seen.add(file)
                results.append(RelatedTest(file=file, reason="Calls modified symbol"))

        return results
