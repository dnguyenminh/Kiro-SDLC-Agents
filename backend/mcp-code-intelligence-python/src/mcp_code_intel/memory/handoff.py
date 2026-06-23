"""AgentHandoffMemory — preserves context between agent sessions."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class HandoffContext:
    """Handoff context for agent transitions."""

    from_agent: str
    to_agent: str
    summary: str
    key_decisions: list[str] = field(default_factory=list)
    open_questions: list[str] = field(default_factory=list)
    artifacts: list[str] = field(default_factory=list)
    ticket_key: str | None = None


class AgentHandoffMemory:
    """Records and retrieves agent handoff context."""

    def __init__(self, repo: Any, search_repo: Any) -> None:
        self._repo = repo
        self._search = search_repo

    def record_handoff(self, ctx: HandoffContext) -> int:
        """Record a handoff between agents."""
        content = self._format_handoff(ctx)
        return self._repo.insert_entry(
            content=content,
            summary=f"Handoff: {ctx.from_agent} → {ctx.to_agent}: {ctx.summary[:60]}",
            entry_type="CONTEXT",
            tier="WORKING",
            source=ctx.ticket_key,
            tags=f"handoff,{ctx.from_agent},{ctx.to_agent}",
        )

    def get_handoffs_for_agent(self, agent_name: str, limit: int = 5) -> list[dict]:
        """Get recent handoffs for an agent."""
        results = self._search.search_by_tags(["handoff", agent_name], limit)
        return sorted(results, key=lambda r: r.get("created_at", ""), reverse=True)

    def get_latest_for_ticket(self, ticket_key: str) -> dict | None:
        """Get latest handoff context for a ticket."""
        results = self._search.search(f"{ticket_key} handoff", limit=1)
        return results[0].get("entry") if results else None

    def _format_handoff(self, ctx: HandoffContext) -> str:
        lines: list[str] = []
        lines.append(f"## Agent Handoff: {ctx.from_agent} → {ctx.to_agent}")
        lines.append(f"\n### Summary\n{ctx.summary}")
        if ctx.key_decisions:
            lines.append("\n### Key Decisions")
            lines.extend(f"- {d}" for d in ctx.key_decisions)
        if ctx.open_questions:
            lines.append("\n### Open Questions")
            lines.extend(f"- {q}" for q in ctx.open_questions)
        if ctx.artifacts:
            lines.append("\n### Artifacts")
            lines.extend(f"- {a}" for a in ctx.artifacts)
        return "\n".join(lines)
