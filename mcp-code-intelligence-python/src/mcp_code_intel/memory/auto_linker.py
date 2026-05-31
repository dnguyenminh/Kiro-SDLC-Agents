"""AutoLinker — entry-level semantic/entity/FTS linking orchestrator (KSA-190).

Complements IngestGraphLinker (chunk-level sibling/ticket/tag/doc-dependency).
Runs strategies in sequence, collects candidates, deduplicates, and commits edges.

Design:
- Fire-and-forget: errors never propagate to caller
- Strategy independence: each strategy can fail without affecting others
- Brute-force vector search: acceptable for < 50K entries
"""

import math
import re
import sqlite3
import struct
import sys
import time
from dataclasses import dataclass, field
from typing import Any, Protocol

from .auto_link_config import AutoLinkConfig
from .graph_repo import GraphRepository
from .vector_repo import VectorRepository
from .structured_map_extractor import EntityRepository


# --- Data classes ---

@dataclass
class CandidateEdge:
    """A candidate edge proposed by a linking strategy."""
    target_id: int
    relation: str       # SIMILAR_TO | SHARES_ENTITY | SHARES_TAG | TOPIC_OVERLAP
    score: float        # 0.0 - 1.0
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class AutoLinkResult:
    """Result of auto-linking a single entry."""
    entry_id: int
    edges_created: int = 0
    breakdown: dict[str, int] = field(default_factory=lambda: {
        "semantic": 0, "entity": 0, "tag": 0, "fts": 0
    })
    skipped: int = 0
    time_ms: float = 0.0


# --- Strategy Protocol ---

class LinkingStrategy(Protocol):
    """Protocol for auto-linking strategies."""

    @property
    def name(self) -> str: ...

    def is_enabled(self, config: AutoLinkConfig) -> bool: ...

    def find_candidates(self, entry_id: int, config: AutoLinkConfig) -> list[CandidateEdge]: ...


# --- Strategies ---

class SemanticStrategy:
    """Vector cosine similarity linking — finds semantically similar entries."""

    def __init__(self, vector_repo: VectorRepository) -> None:
        self._vector_repo = vector_repo

    @property
    def name(self) -> str:
        return "semantic"

    def is_enabled(self, config: AutoLinkConfig) -> bool:
        return config.semantic.enabled

    def find_candidates(self, entry_id: int, config: AutoLinkConfig) -> list[CandidateEdge]:
        my_record = self._vector_repo.find_by_entry_id(entry_id)
        if not my_record:
            return []

        my_vector = _bytes_to_floats(my_record["vector"])
        if not my_vector:
            return []

        all_vectors = self._vector_repo.find_all()
        candidates: list[CandidateEdge] = []

        for record in all_vectors:
            if record["entry_id"] == entry_id:
                continue
            other_vector = _bytes_to_floats(record["vector"])
            if not other_vector or len(other_vector) != len(my_vector):
                continue

            score = _cosine_similarity(my_vector, other_vector)
            if score >= config.semantic.min_score:
                candidates.append(CandidateEdge(
                    target_id=record["entry_id"],
                    relation="SIMILAR_TO",
                    score=score,
                    metadata={"method": "cosine", "model": record.get("model", "unknown")},
                ))

        candidates.sort(key=lambda c: c.score, reverse=True)
        return candidates[:config.semantic.max_edges]


class EntityStrategy:
    """Shared entity Jaccard linking — finds entries sharing named entities."""

    def __init__(self, entity_repo: EntityRepository) -> None:
        self._entity_repo = entity_repo

    @property
    def name(self) -> str:
        return "entity"

    def is_enabled(self, config: AutoLinkConfig) -> bool:
        return config.entity.enabled

    def find_candidates(self, entry_id: int, config: AutoLinkConfig) -> list[CandidateEdge]:
        my_entities = self._entity_repo.get_entities(entry_id)
        if not my_entities:
            return []

        my_names = {e["entity_name"] for e in my_entities}
        # Collect other entries sharing at least one entity
        candidate_map: dict[int, set[str]] = {}

        for entity in my_entities:
            other_ids = self._entity_repo.find_by_entity(entity["entity_name"])
            for oid in other_ids:
                if oid == entry_id:
                    continue
                candidate_map.setdefault(oid, set()).add(entity["entity_name"])

        # Compute Jaccard similarity
        candidates: list[CandidateEdge] = []
        for other_id, shared_names in candidate_map.items():
            other_entities = self._entity_repo.get_entities(other_id)
            other_names = {e["entity_name"] for e in other_entities}
            union = my_names | other_names
            if not union:
                continue
            jaccard = len(shared_names) / len(union)
            if jaccard >= config.entity.min_jaccard:
                candidates.append(CandidateEdge(
                    target_id=other_id,
                    relation="SHARES_ENTITY",
                    score=jaccard,
                    metadata={"shared": list(shared_names), "jaccard": round(jaccard, 4)},
                ))

        candidates.sort(key=lambda c: c.score, reverse=True)
        return candidates[:config.entity.max_edges]


class FtsStrategy:
    """Full-text search fallback — finds entries with topic overlap via FTS5."""

    _STOPWORDS = frozenset([
        "this", "that", "with", "from", "have", "been", "will", "would",
        "could", "should", "their", "there", "where", "when", "what",
        "which", "about", "into", "more", "some", "than", "them", "then",
        "these", "they", "were", "your", "also", "just", "only", "very",
    ])

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    @property
    def name(self) -> str:
        return "fts"

    def is_enabled(self, config: AutoLinkConfig) -> bool:
        return config.fts.enabled

    def find_candidates(self, entry_id: int, config: AutoLinkConfig) -> list[CandidateEdge]:
        # Get entry summary for keyword extraction
        cur = self._conn.execute(
            "SELECT summary FROM knowledge_entries WHERE id = ?", (entry_id,)
        )
        row = cur.fetchone()
        if not row or not row[0]:
            return []

        summary: str = row[0]
        words = self._extract_keywords(summary)
        if not words:
            return []

        # Build FTS5 query
        query = " OR ".join(words)
        try:
            cur = self._conn.execute(
                """SELECT ke.id, rank
                   FROM knowledge_fts
                   JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id
                   WHERE knowledge_fts MATCH ?
                     AND ke.id != ?
                     AND ke.archived_at IS NULL
                   ORDER BY rank
                   LIMIT 10""",
                (query, entry_id),
            )
            rows = cur.fetchall()
        except (sqlite3.OperationalError, sqlite3.DatabaseError):
            return []  # FTS may fail on malformed queries or missing table

        if not rows:
            return []

        # Normalize scores (FTS rank is negative, more negative = better match)
        max_rank = abs(rows[0][1]) if rows[0][1] != 0 else 1.0
        candidates: list[CandidateEdge] = []
        for r in rows:
            normalized_score = min(1.0, abs(r[1]) / max_rank)
            candidates.append(CandidateEdge(
                target_id=r[0],
                relation="TOPIC_OVERLAP",
                score=normalized_score,
                metadata={"query_words": words, "fts_rank": r[1]},
            ))

        return candidates[:config.fts.max_edges]

    def _extract_keywords(self, text: str) -> list[str]:
        """Extract significant words for FTS query."""
        # Sanitize: only alphanumeric
        words = re.findall(r"[a-zA-Z0-9]+", text.lower())
        # Filter: > 3 chars, not stopwords
        filtered = [w for w in words if len(w) > 3 and w not in self._STOPWORDS]
        # Take top 5 unique words
        seen: set[str] = set()
        result: list[str] = []
        for w in filtered:
            if w not in seen:
                seen.add(w)
                result.append(w)
            if len(result) >= 5:
                break
        return result


# --- Orchestrator ---

class AutoLinker:
    """Orchestrates all linking strategies, deduplicates, and commits edges.

    Fire-and-forget safe — errors are logged but never propagated.
    """

    def __init__(
        self,
        graph_repo: GraphRepository,
        conn: sqlite3.Connection,
        vector_repo: VectorRepository,
        entity_repo: EntityRepository,
        config: AutoLinkConfig | None = None,
    ) -> None:
        self._graph_repo = graph_repo
        self._conn = conn
        self._config = config or AutoLinkConfig()

        # Build strategies
        self._strategies: list[Any] = [
            SemanticStrategy(vector_repo),
            EntityStrategy(entity_repo),
            FtsStrategy(conn),
        ]

    @property
    def config(self) -> AutoLinkConfig:
        return self._config

    def link(self, entry_id: int) -> AutoLinkResult:
        """Link a single entry to related entries. Fire-and-forget safe."""
        if not self._config.enabled:
            return AutoLinkResult(entry_id=entry_id)

        start = time.time()
        all_candidates: list[CandidateEdge] = []

        for strategy in self._strategies:
            if not strategy.is_enabled(self._config):
                continue

            # FTS fallback: skip if we already have enough edges from prior strategies
            if (strategy.name == "fts"
                    and len(all_candidates) >= self._config.fts.fallback_threshold):
                continue

            try:
                candidates = strategy.find_candidates(entry_id, self._config)
                all_candidates.extend(candidates)
            except Exception as e:
                _log(f"Strategy {strategy.name} failed for #{entry_id}: {e}")

        # Dedup and cap
        deduped = self._dedup(entry_id, all_candidates)
        capped = deduped[:self._config.total_max_edges]

        # Commit edges
        created = 0
        skipped = 0
        for edge in capped:
            if self._edge_exists_bidirectional(entry_id, edge.target_id, edge.relation):
                skipped += 1
            else:
                self._graph_repo.add_edge(
                    entry_id, edge.target_id, edge.relation, edge.score
                )
                created += 1

        time_ms = (time.time() - start) * 1000
        breakdown = self._count_by_type(capped)

        if created:
            _log(f"Entry #{entry_id}: {created} edges created ({time_ms:.1f}ms)")

        return AutoLinkResult(
            entry_id=entry_id,
            edges_created=created,
            breakdown=breakdown,
            skipped=skipped,
            time_ms=round(time_ms, 1),
        )

    def backfill(self, entry_id: int | None = None, limit: int = 50) -> str:
        """Batch backfill: link orphan entries (no edges).

        If entry_id is provided, link only that entry.
        Otherwise, find orphan entries and link them.
        """
        if entry_id is not None:
            result = self.link(entry_id)
            return (
                f"Auto-linked entry #{entry_id}: {result.edges_created} edges created. "
                f"Time: {result.time_ms}ms"
            )

        # Find orphans — entries with no edges
        orphan_ids = self._find_orphans(limit)
        if not orphan_ids:
            return "Backfill: no orphan entries found"

        total_edges = 0
        for oid in orphan_ids:
            try:
                result = self.link(oid)
                total_edges += result.edges_created
            except Exception as e:
                _log(f"Backfill failed for #{oid}: {e}")

        return f"Backfill: processed {len(orphan_ids)} entries, created {total_edges} edges"

    def _dedup(self, source_id: int, candidates: list[CandidateEdge]) -> list[CandidateEdge]:
        """Remove self-links, duplicates, sort by score descending."""
        # Remove self-links
        filtered = [c for c in candidates if c.target_id != source_id]
        # Sort by score descending
        filtered.sort(key=lambda c: c.score, reverse=True)
        # Remove duplicates (same target + relation)
        seen: set[str] = set()
        result: list[CandidateEdge] = []
        for c in filtered:
            key = f"{c.target_id}:{c.relation}"
            if key not in seen:
                seen.add(key)
                result.append(c)
        return result

    def _edge_exists_bidirectional(
        self, source_id: int, target_id: int, relation: str
    ) -> bool:
        """Check if edge exists in either direction."""
        cur = self._conn.execute(
            """SELECT 1 FROM knowledge_graph_edges
               WHERE ((source_id = ? AND target_id = ?) OR (source_id = ? AND target_id = ?))
                 AND relation = ?
               LIMIT 1""",
            (source_id, target_id, target_id, source_id, relation),
        )
        return cur.fetchone() is not None

    def _find_orphans(self, limit: int) -> list[int]:
        """Find entries with 0 edges (not source or target of any edge)."""
        # Check if archived_at column exists (added by V2 schema)
        has_archived = self._has_column("knowledge_entries", "archived_at")
        if has_archived:
            sql = """SELECT ke.id FROM knowledge_entries ke
                     WHERE ke.archived_at IS NULL
                       AND ke.id NOT IN (
                           SELECT source_id FROM knowledge_graph_edges
                           UNION
                           SELECT target_id FROM knowledge_graph_edges
                       )
                     LIMIT ?"""
        else:
            sql = """SELECT ke.id FROM knowledge_entries ke
                     WHERE ke.id NOT IN (
                         SELECT source_id FROM knowledge_graph_edges
                         UNION
                         SELECT target_id FROM knowledge_graph_edges
                     )
                     LIMIT ?"""
        cur = self._conn.execute(sql, (limit,))
        return [row[0] for row in cur.fetchall()]

    def _has_column(self, table: str, column: str) -> bool:
        """Check if a column exists in a table."""
        cur = self._conn.execute(f"PRAGMA table_info({table})")
        return any(row[1] == column for row in cur.fetchall())

    @staticmethod
    def _count_by_type(edges: list[CandidateEdge]) -> dict[str, int]:
        """Count edges by relation type."""
        counts = {"semantic": 0, "entity": 0, "tag": 0, "fts": 0}
        for e in edges:
            if e.relation == "SIMILAR_TO":
                counts["semantic"] += 1
            elif e.relation == "SHARES_ENTITY":
                counts["entity"] += 1
            elif e.relation == "SHARES_TAG":
                counts["tag"] += 1
            elif e.relation == "TOPIC_OVERLAP":
                counts["fts"] += 1
        return counts


# --- Utility functions ---

def _bytes_to_floats(data: bytes | None) -> list[float]:
    """Convert raw bytes to list of float32 values."""
    if not data:
        return []
    count = len(data) // 4
    return list(struct.unpack(f"<{count}f", data[:count * 4]))


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if len(a) != len(b) or not a:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    denom = norm_a * norm_b
    return dot / denom if denom > 0 else 0.0


def _log(msg: str) -> None:
    print(f"[auto-link] {msg}", file=sys.stderr, flush=True)
