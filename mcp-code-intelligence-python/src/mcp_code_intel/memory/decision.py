"""DecisionMemory — tracks architectural decisions and their rationale."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class Decision:
    """A structured decision record (ADR)."""

    title: str
    context: str
    decision: str
    rationale: str
    alternatives: list[str] = field(default_factory=list)
    consequences: str = ""
    source: str | None = None
    tags: str = ""


class DecisionMemory:
    """Records and retrieves architectural decisions."""

    def __init__(self, repo: Any, graph_repo: Any) -> None:
        self._repo = repo
        self._graph = graph_repo

    def record_decision(self, decision: Decision) -> int:
        """Record a new decision."""
        content = self._format_content(decision)
        return self._repo.insert_entry(
            content=content,
            summary=f"Decision: {decision.title}",
            entry_type="DECISION",
            tier="EPISODIC",
            source=decision.source,
            tags=decision.tags,
            confidence=0.9,
        )

    def link_decision(self, decision_id: int, related_id: int, relation: str = "RELATES_TO") -> None:
        """Link a decision to related entries."""
        self._graph.add_edge(decision_id, related_id, relation)

    def find_decisions(self, limit: int = 20) -> list[dict]:
        """Find decisions."""
        return self._repo.find_by_type("DECISION", limit)

    def _format_content(self, d: Decision) -> str:
        lines: list[str] = []
        lines.append(f"## Context\n{d.context}")
        lines.append(f"\n## Decision\n{d.decision}")
        lines.append(f"\n## Rationale\n{d.rationale}")
        if d.alternatives:
            lines.append("\n## Alternatives Considered")
            lines.extend(f"- {a}" for a in d.alternatives)
        if d.consequences:
            lines.append(f"\n## Consequences\n{d.consequences}")
        return "\n".join(lines)
