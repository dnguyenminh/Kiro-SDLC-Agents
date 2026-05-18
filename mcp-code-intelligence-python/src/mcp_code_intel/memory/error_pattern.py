"""ErrorPatternMemory — tracks recurring errors and their solutions."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class ErrorPattern:
    """A structured error pattern."""

    error_message: str
    context: str
    root_cause: str
    solution: str
    prevention: str = ""
    source: str | None = None
    tags: str = ""


class ErrorPatternMemory:
    """Records and retrieves error patterns."""

    def __init__(self, repo: Any) -> None:
        self._repo = repo

    def record_error(self, pattern: ErrorPattern) -> int:
        """Record a new error pattern."""
        content = self._format_content(pattern)
        return self._repo.insert_entry(
            content=content,
            summary=f"Error: {pattern.error_message[:80]}",
            entry_type="ERROR_PATTERN",
            tier="EPISODIC",
            source=pattern.source,
            tags=pattern.tags,
            confidence=0.8,
        )

    def find_errors(self, limit: int = 20) -> list[dict]:
        """Find error patterns."""
        return self._repo.find_by_type("ERROR_PATTERN", limit)

    def _format_content(self, p: ErrorPattern) -> str:
        lines: list[str] = []
        lines.append(f"## Error\n{p.error_message}")
        lines.append(f"\n## Context\n{p.context}")
        lines.append(f"\n## Root Cause\n{p.root_cause}")
        lines.append(f"\n## Solution\n{p.solution}")
        if p.prevention:
            lines.append(f"\n## Prevention\n{p.prevention}")
        return "\n".join(lines)
