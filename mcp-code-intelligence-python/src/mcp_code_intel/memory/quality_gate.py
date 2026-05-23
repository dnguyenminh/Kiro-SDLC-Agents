"""QualityGate — validates content before ingest to prevent KB pollution.

Checks: minimum length, duplicate detection (trigram Jaccard), quality scoring.
Rejects entries with score < 30, warns for score 30-50.
"""

import re
import sqlite3
from dataclasses import dataclass


@dataclass
class QualityResult:
    """Result of quality validation."""

    score: int
    decision: str  # "accept", "warn", "reject"
    message: str | None
    duplicate_detected: bool
    duplicate_entry_id: int | None


@dataclass
class IngestMeta:
    """Metadata provided during ingest for quality scoring."""

    tags: str | None = None
    type: str | None = None
    source: str | None = None


class QualityGate:
    """Validates content quality before KB ingest."""

    def __init__(
        self,
        conn: sqlite3.Connection,
        min_length: int = 50,
        reject_threshold: int = 30,
        warn_threshold: int = 50,
        duplicate_threshold: float = 0.95,
    ) -> None:
        self._conn = conn
        self._min_length = min_length
        self._reject_threshold = reject_threshold
        self._warn_threshold = warn_threshold
        self._duplicate_threshold = duplicate_threshold

    def validate(self, content: str, meta: IngestMeta) -> QualityResult:
        """Validate content before ingest. Returns quality decision."""
        trimmed = content.strip()
        if len(trimmed) < self._min_length:
            return QualityResult(
                score=0, decision="reject",
                message=f"Content too short (min {self._min_length} chars). Got {len(trimmed)}.",
                duplicate_detected=False, duplicate_entry_id=None,
            )

        sim, dup_id = self._check_duplicate(trimmed)
        if sim >= self._duplicate_threshold:
            return QualityResult(
                score=10, decision="reject",
                message=f"Duplicate detected (similarity: {sim * 100:.1f}%). Existing entry ID: {dup_id}",
                duplicate_detected=True, duplicate_entry_id=dup_id,
            )

        score = self._calculate_score(trimmed, meta)
        decision = self._decide_from_score(score)
        message = (
            f"Low quality score ({score}/100). Consider adding tags, source, or more detail."
            if decision == "warn" else None
        )
        return QualityResult(score, decision, message, False, None)

    def _calculate_score(self, content: str, meta: IngestMeta) -> int:
        score = 0
        score += min(40, (len(content) * 40) // 500)
        if meta.tags and meta.tags.strip():
            score += 20
        if meta.type and meta.type.strip():
            score += 10
        if meta.source and meta.source.strip():
            score += 10
        if _has_structure(content):
            score += 10
        if _has_actionable_content(content):
            score += 10
        return min(100, score)

    def _check_duplicate(self, content: str) -> tuple[float, int | None]:
        trigrams = _build_trigrams(content.lower()[:200])
        if not trigrams:
            return 0.0, None

        cursor = self._conn.cursor()
        cursor.execute(
            "SELECT id, content FROM knowledge_entries "
            "WHERE archived = 0 ORDER BY created_at DESC LIMIT 50"
        )
        max_sim = 0.0
        match_id: int | None = None

        for row in cursor.fetchall():
            cand_trigrams = _build_trigrams(row[1].lower()[:200])
            sim = _jaccard_similarity(trigrams, cand_trigrams)
            if sim > max_sim:
                max_sim = sim
                match_id = row[0]
        return max_sim, match_id

    def _decide_from_score(self, score: int) -> str:
        if score < self._reject_threshold:
            return "reject"
        if score < self._warn_threshold:
            return "warn"
        return "accept"


def _has_structure(text: str) -> bool:
    return bool(
        re.search(r"^#{1,6}\s", text, re.MULTILINE)
        or re.search(r"^[-*]\s", text, re.MULTILINE)
        or "```" in text
    )


def _has_actionable_content(text: str) -> bool:
    return bool(
        re.search(r"\b(TODO|Action:|Decision:|Next step:|Decided:)\b", text, re.IGNORECASE)
        or re.search(r"\[[ x]\]", text, re.IGNORECASE)
    )


def _build_trigrams(text: str) -> set[str]:
    return {text[i:i + 3] for i in range(len(text) - 2)}


def _jaccard_similarity(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 1.0
    intersection = len(a & b)
    union = len(a) + len(b) - intersection
    return intersection / union if union else 0.0
