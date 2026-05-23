"""StructuredMapExtractor + EntityRepository — metadata extraction & entity indexing.

Rule-based extraction of metadata from content (no LLM dependency).
Port of Node.js structured-map-extractor.ts + entity-repo.ts (KSA-142 F3).
"""

import json
import re
import sqlite3
from dataclasses import dataclass, field


@dataclass
class StructuredMap:
    """Structured metadata extracted from entry content."""

    topic: str = ""
    entities_mentioned: list[str] = field(default_factory=list)
    decisions_made: list[str] = field(default_factory=list)
    action_items: list[str] = field(default_factory=list)
    context_refs: list[str] = field(default_factory=list)
    sentiment: str = "neutral"  # positive|neutral|negative|mixed

    def to_json(self) -> str:
        """Serialize to JSON string."""
        return json.dumps({
            "topic": self.topic,
            "entities_mentioned": self.entities_mentioned,
            "decisions_made": self.decisions_made,
            "action_items": self.action_items,
            "context_refs": self.context_refs,
            "sentiment": self.sentiment,
        })


def extract_structured_map(content: str) -> StructuredMap:
    """Extract structured map from text content."""
    if not content or not content.strip():
        return StructuredMap()
    return StructuredMap(
        topic=_extract_topic(content),
        entities_mentioned=_extract_entities(content),
        decisions_made=_extract_decisions(content),
        action_items=_extract_action_items(content),
        context_refs=_extract_context_refs(content),
        sentiment=_analyze_sentiment(content),
    )


def _extract_topic(content: str) -> str:
    """Extract primary topic from first heading or first sentence."""
    match = re.search(r"^#+\s+(.+)$", content, re.MULTILINE)
    if match:
        return match.group(1).strip()[:120]
    first_line = next((l for l in content.split("\n") if l.strip()), "")
    return first_line.strip()[:120]


def _extract_entities(content: str) -> list[str]:
    """Extract entities: ticket IDs, @mentions, PascalCase names."""
    entities: set[str] = set()
    patterns = [
        r"[A-Z][A-Z0-9]+-\d+",              # Ticket IDs (JIRA-123)
        r"@[\w-]+",                           # @mentions
        r"(?:^|\s)((?:[A-Z][a-z0-9]+){2,})",  # PascalCase class names
    ]
    for pat in patterns:
        for match in re.finditer(pat, content, re.MULTILINE):
            entities.add(match.group(0).strip())
    return list(entities)[:20]


def _extract_decisions(content: str) -> list[str]:
    """Extract decisions from content."""
    decisions: list[str] = []
    prefixes = ["decision:", "decided:", "we will", "chosen approach", "agreed:"]
    for line in content.split("\n"):
        lower = line.lower().strip()
        if any(lower.startswith(p) for p in prefixes):
            decisions.append(line.strip()[:200])
    return decisions[:10]


def _extract_action_items(content: str) -> list[str]:
    """Extract action items (TODOs, next steps)."""
    items: list[str] = []
    patterns = [re.compile(r"TODO", re.I), re.compile(r"action:", re.I),
                re.compile(r"next step:", re.I), re.compile(r"\[ \]")]
    for line in content.split("\n"):
        if any(p.search(line) for p in patterns):
            items.append(line.strip()[:200])
    return items[:10]


def _extract_context_refs(content: str) -> list[str]:
    """Extract context references: URLs, file paths, ticket IDs."""
    refs: set[str] = set()
    patterns = [
        r"https?://[^\s)]+",                  # URLs
        r"[A-Z][A-Z0-9]+-\d+",              # Ticket IDs
        r"(?:[\w-]+/)+[\w-]+\.\w+",          # File paths
    ]
    for pat in patterns:
        for match in re.finditer(pat, content):
            refs.add(match.group(0))
    return list(refs)[:20]


def _analyze_sentiment(content: str) -> str:
    """Simple keyword-based sentiment analysis."""
    lower = content.lower()
    pos_words = ["success", "resolved", "fixed", "improved", "great", "works", "done", "complete"]
    neg_words = ["error", "fail", "bug", "broken", "issue", "problem", "crash", "blocked"]
    pos_score = sum(1 for w in pos_words if w in lower)
    neg_score = sum(1 for w in neg_words if w in lower)
    if pos_score > 0 and neg_score > 0:
        return "mixed"
    if pos_score > neg_score:
        return "positive"
    if neg_score > pos_score:
        return "negative"
    return "neutral"


class EntityRepository:
    """CRUD for entity_index table — fast entity-based search."""

    def __init__(self, db: sqlite3.Connection) -> None:
        self.db = db

    def index_entities(
        self, entry_id: int, entities: list[str], entity_type: str = "auto"
    ) -> None:
        """Index entities for an entry (replaces existing)."""
        self.db.execute("DELETE FROM entity_index WHERE entry_id = ?", (entry_id,))
        for name in entities:
            self.db.execute(
                "INSERT INTO entity_index (entry_id, entity_name, entity_type) "
                "VALUES (?, ?, ?)",
                (entry_id, name, entity_type),
            )
        self.db.commit()

    def find_by_entity(self, entity_name: str, limit: int = 20) -> list[int]:
        """Find entry IDs that mention a specific entity."""
        cur = self.db.execute(
            "SELECT DISTINCT entry_id FROM entity_index "
            "WHERE entity_name LIKE ? LIMIT ?",
            (f"%{entity_name}%", limit),
        )
        return [row[0] for row in cur.fetchall()]

    def find_by_type(self, entity_type: str, limit: int = 20) -> list[int]:
        """Find entry IDs by entity type."""
        cur = self.db.execute(
            "SELECT DISTINCT entry_id FROM entity_index "
            "WHERE entity_type = ? LIMIT ?",
            (entity_type, limit),
        )
        return [row[0] for row in cur.fetchall()]

    def get_entities(self, entry_id: int) -> list[dict]:
        """Get all entities for an entry."""
        cur = self.db.execute(
            "SELECT id, entry_id, entity_name, entity_type "
            "FROM entity_index WHERE entry_id = ?",
            (entry_id,),
        )
        return [
            {"id": r[0], "entry_id": r[1], "entity_name": r[2], "entity_type": r[3]}
            for r in cur.fetchall()
        ]

    def search_entities(self, pattern: str, limit: int = 20) -> list[dict]:
        """Search entities by name pattern."""
        cur = self.db.execute(
            "SELECT id, entry_id, entity_name, entity_type "
            "FROM entity_index WHERE entity_name LIKE ? LIMIT ?",
            (f"%{pattern}%", limit),
        )
        return [
            {"id": r[0], "entry_id": r[1], "entity_name": r[2], "entity_type": r[3]}
            for r in cur.fetchall()
        ]
