"""HybridSearch — combines FTS5 (BM25) and graph context with RRF fusion."""

from typing import Any

from .search_repo import KnowledgeSearchRepository
from .knowledge_graph import KnowledgeGraph


class HybridSearch:
    """Hybrid search with RRF fusion (BM25 + graph boost)."""

    def __init__(self, fts_repo: KnowledgeSearchRepository,
                 graph: KnowledgeGraph) -> None:
        self._fts = fts_repo
        self._graph = graph

    def search(self, query: str, limit: int = 10,
               tier: str | None = None) -> list[dict[str, Any]]:
        """Execute hybrid search."""
        fts_results = self._search_fts(query, tier, limit * 2)
        graph_boost = self._compute_graph_boost(fts_results)
        return self._fuse(fts_results, graph_boost, limit)

    def _search_fts(self, query: str, tier: str | None,
                    limit: int) -> list[dict[str, Any]]:
        if tier:
            return self._fts.search_in_tier(query, tier, limit)
        return self._fts.search(query, limit)

    def _compute_graph_boost(self, fts_results: list[dict[str, Any]]) -> dict[int, float]:
        seed_ids = [r["entry"]["id"] for r in fts_results[:5]]
        boosted: dict[int, float] = {}
        for seed_id in seed_ids:
            for n in self._graph.get_connected(seed_id):
                boosted[n] = boosted.get(n, 0.0) + 1.0
        max_boost = max(boosted.values(), default=1.0)
        return {k: v / max_boost for k, v in boosted.items()}

    def _fuse(self, fts_results: list[dict[str, Any]],
              graph_boost: dict[int, float], limit: int) -> list[dict[str, Any]]:
        bm25_weight = 0.6
        graph_weight = 0.4
        fts_map = {r["entry"]["id"]: (r, i) for i, r in enumerate(fts_results)}
        all_ids = set(fts_map.keys()) | set(graph_boost.keys())

        scored: list[tuple[float, dict[str, Any] | None]] = []
        for entry_id in all_ids:
            fts_entry = fts_map.get(entry_id)
            fts_score = self._rrf_score(fts_entry[1]) * bm25_weight if fts_entry else 0
            g_score = graph_boost.get(entry_id, 0) * graph_weight
            total = fts_score + g_score
            result = fts_entry[0] if fts_entry else None
            scored.append((total, result))

        scored.sort(key=lambda x: x[0], reverse=True)
        output: list[dict[str, Any]] = []
        for score, result in scored[:limit]:
            if result is not None:
                output.append({**result, "score": score, "match_type": "hybrid"})
        return output

    def _rrf_score(self, rank: int, k: int = 60) -> float:
        """Reciprocal Rank Fusion score."""
        return 1.0 / (k + rank + 1)
