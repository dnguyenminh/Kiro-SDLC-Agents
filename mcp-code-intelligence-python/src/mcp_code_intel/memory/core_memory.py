"""CoreMemoryManager — manages pinned entries for auto-recall.

Pinned entries are injected into agent context on every search.
Enforces a 2000-token budget across all pinned entries.
Port of Node.js core-memory.ts (KSA-142 F1).
"""

import sqlite3
from dataclasses import dataclass


@dataclass
class PinnedEntrySummary:
    """Summary of a pinned entry with token usage."""

    id: int
    summary: str
    tokens: int
    pin_order: int


@dataclass
class BudgetStatus:
    """Token budget status for pinned context."""

    used: int
    remaining: int
    max: int
    warning: bool


def count_tokens(text: str) -> int:
    """Approximate token count: chars / 4."""
    return len(text) // 4


def truncate_to_fit(text: str, max_tokens: int) -> str:
    """Truncate text to fit within token budget."""
    max_chars = max_tokens * 4
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "..."


class CoreMemoryManager:
    """Manages pinned entries for auto-recall context injection."""

    def __init__(
        self,
        db: sqlite3.Connection,
        max_tokens: int = 2000,
        warning_threshold: int = 1800,
        max_pinned_entries: int = 10,
    ) -> None:
        self.db = db
        self.MAX_TOKENS = max_tokens
        self.WARNING_THRESHOLD = warning_threshold
        self.MAX_PINNED_ENTRIES = max_pinned_entries

    def pin(self, entry_id: int) -> str:
        """Pin an entry. Returns success/failure message."""
        entry = self._get_entry(entry_id)
        if entry is None:
            return f"Error: entry {entry_id} not found"
        if entry["pinned"]:
            return f"Entry {entry_id} is already pinned"
        if self._get_pinned_count() >= self.MAX_PINNED_ENTRIES:
            return f"Error: max pinned entries ({self.MAX_PINNED_ENTRIES}) reached"
        budget = self._get_remaining_budget()
        text = entry["summary"] or entry["content"]
        tokens = count_tokens(text)
        if tokens > budget:
            return f"Error: entry needs ~{tokens} tokens but only {budget} remaining in budget"
        next_order = self._get_next_pin_order()
        self.db.execute(
            "UPDATE knowledge_entries SET pinned = 1, pin_order = ?, "
            "updated_at = datetime('now') WHERE id = ?",
            (next_order, entry_id),
        )
        self.db.commit()
        return f"Pinned entry {entry_id} (order: {next_order}, ~{tokens} tokens)"

    def unpin(self, entry_id: int) -> str:
        """Unpin an entry."""
        entry = self._get_entry(entry_id)
        if entry is None:
            return f"Error: entry {entry_id} not found"
        if not entry["pinned"]:
            return f"Entry {entry_id} is not pinned"
        self.db.execute(
            "UPDATE knowledge_entries SET pinned = 0, pin_order = 0, "
            "updated_at = datetime('now') WHERE id = ?",
            (entry_id,),
        )
        self.db.commit()
        return f"Unpinned entry {entry_id}"

    def list_pinned(self) -> list[PinnedEntrySummary]:
        """List all pinned entries with token usage."""
        cur = self.db.execute(
            "SELECT id, summary, content, pin_order FROM knowledge_entries "
            "WHERE pinned = 1 ORDER BY pin_order ASC"
        )
        rows = cur.fetchall()
        result = []
        for row in rows:
            text = row[1] or row[2][:120]
            result.append(PinnedEntrySummary(
                id=row[0],
                summary=row[1] or row[2][:120],
                tokens=count_tokens(text),
                pin_order=row[3],
            ))
        return result

    def reorder(self, entry_id: int, new_order: int) -> str:
        """Reorder a pinned entry to a new position."""
        entry = self._get_entry(entry_id)
        if entry is None:
            return f"Error: entry {entry_id} not found"
        if not entry["pinned"]:
            return f"Error: entry {entry_id} is not pinned"
        self.db.execute(
            "UPDATE knowledge_entries SET pin_order = ?, "
            "updated_at = datetime('now') WHERE id = ?",
            (new_order, entry_id),
        )
        self.db.commit()
        return f"Reordered entry {entry_id} to position {new_order}"

    def get_context(self) -> str:
        """Get pinned context string for injection into search results."""
        pinned = self.list_pinned()
        if not pinned:
            return ""
        parts = ["--- PINNED CONTEXT ---"]
        used_tokens = count_tokens(parts[0])
        for p in pinned:
            line = f"[#{p.id}] {p.summary}"
            line_tokens = count_tokens(line)
            if used_tokens + line_tokens > self.MAX_TOKENS:
                remaining = self.MAX_TOKENS - used_tokens
                parts.append(truncate_to_fit(line, remaining))
                break
            parts.append(line)
            used_tokens += line_tokens
        parts.append("--- END PINNED ---")
        return "\n".join(parts)

    def get_budget_status(self) -> BudgetStatus:
        """Get token budget status."""
        used = self._get_used_tokens()
        return BudgetStatus(
            used=used,
            remaining=self.MAX_TOKENS - used,
            max=self.MAX_TOKENS,
            warning=used >= self.WARNING_THRESHOLD,
        )

    def _get_entry(self, entry_id: int) -> dict | None:
        cur = self.db.execute(
            "SELECT id, summary, content, pinned FROM knowledge_entries WHERE id = ?",
            (entry_id,),
        )
        row = cur.fetchone()
        if row is None:
            return None
        return {"id": row[0], "summary": row[1], "content": row[2], "pinned": row[3]}

    def _get_pinned_count(self) -> int:
        cur = self.db.execute(
            "SELECT COUNT(*) FROM knowledge_entries WHERE pinned = 1"
        )
        return cur.fetchone()[0]

    def _get_next_pin_order(self) -> int:
        cur = self.db.execute(
            "SELECT MAX(pin_order) FROM knowledge_entries WHERE pinned = 1"
        )
        mx = cur.fetchone()[0]
        return (mx or 0) + 1

    def _get_used_tokens(self) -> int:
        cur = self.db.execute(
            "SELECT summary, content FROM knowledge_entries WHERE pinned = 1"
        )
        total = 0
        for row in cur.fetchall():
            total += count_tokens(row[0] or row[1])
        return total

    def _get_remaining_budget(self) -> int:
        return self.MAX_TOKENS - self._get_used_tokens()
