"""
KSA-165: Suppression Checker — Detects nosec/NOLINT markers to suppress findings.
"""

from __future__ import annotations
from typing import Optional
from ..types import SuppressionInfo


_DEFAULT_MARKERS = [
    ("// nosec", "line"),
    ("# nosec", "line"),
    ("// NOLINT", "line"),
    ("/* NOLINT */", "line"),
    ("// @security-ignore", "line"),
    ("# @security-ignore", "line"),
    ("// nosec:block", "block"),
    ("// @security-ignore-file", "file"),
]


class SuppressionChecker:
    def __init__(self, markers: Optional[list[tuple[str, str]]] = None) -> None:
        self._markers = markers or _DEFAULT_MARKERS

    def is_suppressed(self, source_lines: list[str], line: int) -> Optional[SuppressionInfo]:
        """Check if a specific line in source code has a suppression marker."""
        line_idx = line - 1
        if line_idx < 0 or line_idx >= len(source_lines):
            return None

        line_text = source_lines[line_idx]
        prev_line_text = source_lines[line_idx - 1] if line_idx > 0 else ""

        for pattern, scope in self._markers:
            if pattern in line_text:
                return SuppressionInfo(marker=pattern, scope=scope, line=line)
            if pattern in prev_line_text:
                return SuppressionInfo(marker=pattern, scope=scope, line=line - 1)

        return None

    def is_file_suppressed(self, source_lines: list[str]) -> bool:
        """Check if entire file is suppressed."""
        header_lines = source_lines[:5]
        for line_text in header_lines:
            for pattern, scope in self._markers:
                if scope == "file" and pattern in line_text:
                    return True
        return False
