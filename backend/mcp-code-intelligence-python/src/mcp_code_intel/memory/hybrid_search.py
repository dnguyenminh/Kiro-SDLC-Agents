"""HybridSearch — combines FTS5 (BM25) and graph context with RRF fusion.

Enhanced with: agent scope filter, token budget, working tier expiry (KSA-110 F4).
"""

from dataclasses import dataclass
from typing import Any

from .search_repo import KnowledgeSearchRepository
from .knowledge_graph import KnowledgeGraph
from .role_filter import types_for_role
from .tier_boost import factor as tier_boost_factor


@dataclass
class EnhancedSearchResponse:
    """Enhanced search response with pinned context, budget info, and expiry actions."""

    pinned_context: str
    results: list[dict[str, Any]]
    tokens_used: int
    tokens_budget: int
    results_truncated: bool
    expiry_actions: list


class HybridSearch:
    """Hybrid search with RRF fusion (BM25 + graph boost + role filter + tier boost)."""

    def __init__(self, fts_repo: KnowledgeSearchRepository,
                 graph: KnowledgeGraph) -> None:
        self._fts = fts_repo
        self._graph = graph
        # V2 injectable dependencies (KSA-110 F4)
        self._scope_filter = None
        self._token_budget = None
        self._working_expiry = None
        self._pinned_context_provider = None

    def set_scope_filter(self, filter_) -> None:
        """Inject AgentScopeFilter for tag-based isolation."""
        self._scope_filter = filter_

    def set_token_budget(self, budget) -> None:
        """Inject TokenBudget for result limiting."""
        self._token_budget = budget

    def set_working_expiry(self, expiry) -> None:
        """Inject WorkingTierExpiry for lazy auto-expiry."""
        self._working_expiry = expiry

    def set_pinned_context_provider(self, provider) -> None:
        """Inject pinned context provider (callable returning str)."""
        self._pinned_context_provider = provider

    def enhanced_search(self, query: str, limit: int = 10,
                        tier: str | None = None, role: str | None = None,
                        agent_scope: str | None = None,
                        max_tokens: int = 2000) -> EnhancedSearchResponse:
        """Enhanced search: expiry → pins → search → scope → budget."""
        # 1. Lazy auto-expiry
        expiry_actions = []
        if self._working_expiry:
            expiry_actions = self._working_expiry.process_stale()

        # 2. Load pinned context
        pinned_context = ""
        if self._pinned_context_provider:
            pinned_context = self._pinned_context_provider()

        # 3. Execute hybrid search
        results = self.search(query, limit, tier, role)

        # 4. Apply agent scope filter
        if agent_scope and self._scope_filter:
            results = self._scope_filter.filter(results, agent_scope)

        # 5. Apply token budget
        tokens_used = 0
        truncated = False
        if self._token_budget:
            budget_result = self._token_budget.apply(results, max_tokens)
            results = budget_result.results
            tokens_used = budget_result.tokens_used
            truncated = budget_result.truncated

        return EnhancedSearchResponse(
            pinned_context=pinned_context,
            results=results,
            tokens_used=tokens_used,
            tokens_budget=max_tokens,
            results_truncated=truncated,
            expiry_actions=expiry_actions,
        )

    def search(self, query: str, limit: int = 10,
               tier: str | None = None, role: str | None = None) -> list[dict[str, Any]]:
        """Execute hybrid search."""
        fts_results = self._search_fts(query, tier, limit * 2)
        graph_boost = self._compute_graph_boost(fts_results)
        return self._fuse(fts_results, graph_boost, limit, role)

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
              graph_boost: dict[int, float], limit: int,
              role: str | None = None) -> list[dict[str, Any]]:
        bm25_weight = 0.6
        graph_weight = 0.4
        role_types = types_for_role(role)
        fts_map = {r["entry"]["id"]: (r, i) for i, r in enumerate(fts_results)}
        all_ids = set(fts_map.keys()) | set(graph_boost.keys())

        scored: list[tuple[float, dict[str, Any] | None]] = []
        for entry_id in all_ids:
            fts_entry = fts_map.get(entry_id)
            if fts_entry is None:
                continue
            result, rank = fts_entry
            entry_type = result.get("entry", {}).get("type", "")
            if role_types and entry_type not in role_types:
                continue
            fts_score = self._rrf_score(rank) * bm25_weight
            g_score = graph_boost.get(entry_id, 0) * graph_weight
            entry_tier = result.get("entry", {}).get("tier")
            boost = tier_boost_factor(entry_tier)
            total = (fts_score + g_score) * boost
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
