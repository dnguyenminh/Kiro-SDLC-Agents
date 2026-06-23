"""Main duplicate detection using embedding similarity."""

from __future__ import annotations

import math
import sqlite3
import struct
import sys
from dataclasses import dataclass, field
from typing import Any

from .cluster_builder import ClusterBuilder, Cluster
from .suggestion_generator import SuggestionGenerator, RefactoringSuggestion


@dataclass
class SimilarityPair:
    """A pair of similar functions."""
    a: str  # function ID (file:name)
    b: str
    similarity: float


@dataclass
class DuplicateReport:
    """Report of detected duplicates."""
    total_functions_scanned: int
    pairs: list[SimilarityPair]
    clusters: list[Cluster]
    suggestions: list[RefactoringSuggestion]


class DuplicateDetector:
    """Find near-duplicate code using embedding similarity.

    Uses body embeddings from the index DB to compute cosine similarity
    between all function pairs, then clusters them using Union-Find.
    """

    def __init__(
        self,
        db_conn: sqlite3.Connection,
        min_similarity: float = 0.85,
        min_lines: int = 5,
    ) -> None:
        self._conn = db_conn
        self.min_similarity = min_similarity
        self.min_lines = min_lines
        self._suggestion_gen = SuggestionGenerator()

    def detect(self, file_path: str | None = None) -> DuplicateReport:
        """Find duplicate functions.

        Args:
            file_path: Optional filter to scan only one file's functions.

        Returns:
            DuplicateReport with pairs, clusters, and suggestions.
        """
        # 1. Load body embeddings
        embeddings = self._load_embeddings(file_path)
        _log(f"Loaded {len(embeddings)} function embeddings")

        if len(embeddings) < 2:
            return DuplicateReport(
                total_functions_scanned=len(embeddings),
                pairs=[],
                clusters=[],
                suggestions=[],
            )

        # 2. Compute pairwise similarity
        pairs = self._compute_similarities(embeddings)
        _log(f"Found {len(pairs)} similar pairs (threshold={self.min_similarity})")

        # 3. Build clusters
        cluster_builder = ClusterBuilder()
        for pair in pairs:
            cluster_builder.union(pair.a, pair.b)
        clusters = cluster_builder.get_clusters()

        # 4. Generate suggestions
        symbol_info = self._get_symbol_info(embeddings)
        suggestions = self._suggestion_gen.generate(clusters, symbol_info)

        return DuplicateReport(
            total_functions_scanned=len(embeddings),
            pairs=pairs,
            clusters=clusters,
            suggestions=suggestions,
        )

    def _load_embeddings(self, file_path: str | None) -> dict[str, list[float]]:
        """Load embeddings from DB, filtered by min_lines."""
        sql = """
            SELECT s.name, f.relative_path, s.start_line, s.end_line, e.vector
            FROM embeddings e
            JOIN symbols s ON e.symbol_id = s.id
            JOIN files f ON s.file_id = f.id
            WHERE s.kind IN ('function', 'method')
              AND (s.end_line - s.start_line) >= ?
        """
        params: list[Any] = [self.min_lines]

        if file_path:
            sql += " AND f.relative_path = ?"
            params.append(file_path)

        rows = self._conn.execute(sql, params).fetchall()
        result: dict[str, list[float]] = {}
        for row in rows:
            key = f"{row[1]}:{row[0]}"  # file:function_name
            vector_blob = row[4]
            if vector_blob:
                vector = _bytes_to_floats(vector_blob)
                result[key] = vector
        return result

    def _compute_similarities(self, embeddings: dict[str, list[float]]) -> list[SimilarityPair]:
        """Compute cosine similarity between all pairs."""
        keys = list(embeddings.keys())
        n = len(keys)

        if n > 10000:
            return self._ann_search(embeddings)

        return self._brute_force(keys, embeddings)

    def _brute_force(self, keys: list[str], embeddings: dict[str, list[float]]) -> list[SimilarityPair]:
        """Exact pairwise cosine similarity (O(n^2))."""
        pairs: list[SimilarityPair] = []
        n = len(keys)

        for i in range(n):
            vec_a = embeddings[keys[i]]
            for j in range(i + 1, n):
                vec_b = embeddings[keys[j]]
                sim = _cosine_similarity(vec_a, vec_b)
                if sim >= self.min_similarity:
                    pairs.append(SimilarityPair(a=keys[i], b=keys[j], similarity=sim))

        return pairs

    def _ann_search(self, embeddings: dict[str, list[float]]) -> list[SimilarityPair]:
        """Approximate nearest neighbor for large codebases.

        Falls back to sampling + brute force if sqlite-vec not available.
        """
        keys = list(embeddings.keys())
        pairs: list[SimilarityPair] = []
        seen: set[tuple[str, str]] = set()

        for i, key_a in enumerate(keys):
            vec_a = embeddings[key_a]
            candidates: list[tuple[float, str]] = []

            for j, key_b in enumerate(keys):
                if i == j:
                    continue
                sim = _cosine_similarity(vec_a, embeddings[key_b])
                if sim >= self.min_similarity:
                    candidates.append((sim, key_b))

            candidates.sort(reverse=True)
            for sim, key_b in candidates[:20]:
                pair_key = tuple(sorted([key_a, key_b]))
                if pair_key not in seen:
                    seen.add(pair_key)
                    pairs.append(SimilarityPair(a=key_a, b=key_b, similarity=sim))

        return pairs

    def _get_symbol_info(self, embeddings: dict[str, list[float]]) -> dict[str, dict]:
        """Get symbol metadata for suggestion generation."""
        info: dict[str, dict] = {}
        for key in embeddings:
            parts = key.split(":", 1)
            if len(parts) == 2:
                file_path, name = parts
                row = self._conn.execute("""
                    SELECT s.kind, s.start_line, s.end_line, s.visibility
                    FROM symbols s
                    JOIN files f ON s.file_id = f.id
                    WHERE f.relative_path = ? AND s.name = ?
                    LIMIT 1
                """, (file_path, name)).fetchone()
                if row:
                    info[key] = {
                        "file": file_path,
                        "name": name,
                        "kind": row[0],
                        "start_line": row[1],
                        "end_line": row[2],
                        "visibility": row[3],
                    }
        return info


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    denom = norm_a * norm_b
    return dot / denom if denom > 0 else 0.0


def _bytes_to_floats(data: bytes) -> list[float]:
    """Convert little-endian bytes to float list."""
    count = len(data) // 4
    return list(struct.unpack(f"<{count}f", data))


def _log(msg: str) -> None:
    print(f"[duplicate-detector] {msg}", file=sys.stderr, flush=True)
