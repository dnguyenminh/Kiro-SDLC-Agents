"""TierConsolidator — promotes/demotes entries between 4 tiers."""

import sqlite3
from datetime import datetime
from typing import Any

from .knowledge_repo import KnowledgeRepository

# Promotion thresholds
THRESHOLDS = {
    "WORKING_TO_EPISODIC": {"access": 3, "confidence": 0.7},
    "EPISODIC_TO_SEMANTIC": {"access": 10, "confidence": 0.85},
    "SEMANTIC_TO_PROCEDURAL": {"access": 25, "confidence": 0.95},
}


class ConsolidationRepository:
    """Tier transition logging and statistics."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def get_tier_stats(self) -> list[dict[str, Any]]:
        """Get tier statistics."""
        cur = self._conn.execute(
            """SELECT tier, COUNT(*) as entry_count,
                      AVG(confidence) as avg_confidence,
                      AVG(access_count) as avg_access_count
               FROM knowledge_entries GROUP BY tier"""
        )
        return [dict(r) for r in cur.fetchall()]

    def find_promotion_candidates(self, tier: str, min_access: int,
                                  min_confidence: float) -> list[int]:
        """Find entries eligible for promotion."""
        cur = self._conn.execute(
            """SELECT id FROM knowledge_entries
               WHERE tier = ? AND access_count >= ? AND confidence >= ?
               ORDER BY access_count DESC""",
            (tier, min_access, min_confidence),
        )
        return [row[0] for row in cur.fetchall()]

    def log_transition(self, entry_id: int, from_tier: str,
                       to_tier: str, reason: str) -> None:
        """Log a tier transition."""
        self._conn.execute(
            """INSERT INTO consolidation_log (entry_id, from_tier, to_tier, reason)
               VALUES (?, ?, ?, ?)""",
            (entry_id, from_tier, to_tier, reason),
        )
        self._conn.commit()


class TierConsolidator:
    """Promotes/demotes entries based on access patterns."""

    def __init__(self, knowledge: KnowledgeRepository,
                 consolidation: "ConsolidationRepository") -> None:
        self._knowledge = knowledge
        self._consolidation = consolidation

    def consolidate(self) -> dict[str, int]:
        """Run full consolidation cycle."""
        fixed = self._fix_tier_mismatches()
        promoted = self._promote_eligible()
        expired = self._expire_stale()
        return {"promoted": promoted + fixed, "demoted": 0, "expired": expired}

    def _fix_tier_mismatches(self) -> int:
        """Fix entries whose tier doesn't match their type (legacy data)."""
        working = self._knowledge.find_by_tier("WORKING", 1000)
        fixed = 0
        for entry in working:
            correct_tier = self._tier_for_type(entry.get("type", ""))
            if correct_tier != "WORKING":
                self._knowledge.update_tier(entry["id"], correct_tier)
                self._consolidation.log_transition(
                    entry["id"], "WORKING", correct_tier, "auto:tier_fix"
                )
                fixed += 1
        return fixed

    @staticmethod
    def _tier_for_type(entry_type: str) -> str:
        """Determine correct tier based on knowledge type."""
        if entry_type in ("REQUIREMENT", "ARCHITECTURE", "PROCEDURE", "API_DESIGN"):
            return "SEMANTIC"
        if entry_type in ("DECISION", "LESSON_LEARNED", "ERROR_PATTERN"):
            return "EPISODIC"
        return "WORKING"

    def _promote_eligible(self) -> int:
        count = 0
        t = THRESHOLDS
        count += self._promote("WORKING", "EPISODIC",
                               t["WORKING_TO_EPISODIC"]["access"],
                               t["WORKING_TO_EPISODIC"]["confidence"])
        count += self._promote("EPISODIC", "SEMANTIC",
                               t["EPISODIC_TO_SEMANTIC"]["access"],
                               t["EPISODIC_TO_SEMANTIC"]["confidence"])
        count += self._promote("SEMANTIC", "PROCEDURAL",
                               t["SEMANTIC_TO_PROCEDURAL"]["access"],
                               t["SEMANTIC_TO_PROCEDURAL"]["confidence"])
        return count

    def _promote(self, from_tier: str, to_tier: str,
                 min_access: int, min_conf: float) -> int:
        candidates = self._consolidation.find_promotion_candidates(
            from_tier, min_access, min_conf
        )
        for entry_id in candidates:
            self._knowledge.update_tier(entry_id, to_tier)
            self._consolidation.log_transition(
                entry_id, from_tier, to_tier, "auto:threshold_met"
            )
        return len(candidates)

    def _expire_stale(self) -> int:
        working = self._knowledge.find_by_tier("WORKING", 500)
        now = datetime.utcnow().isoformat()
        expired = 0
        for entry in working:
            if entry.get("expires_at") and entry["expires_at"] < now:
                self._knowledge.delete(entry["id"])
                expired += 1
        return expired
