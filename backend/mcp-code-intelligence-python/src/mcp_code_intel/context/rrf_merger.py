"""RRF Merger — Reciprocal Rank Fusion for merging multi-source results. KSA-171."""

from __future__ import annotations

import json
from typing import Any

from .types import MergedResult, SourceWeights


class RRFMerger:
    """Merges results from multiple sources using Reciprocal Rank Fusion."""

    def __init__(self, k: int = 60) -> None:
        self._k = k

    def merge(
        self,
        sources: dict[str, dict[str, Any]],
        weights: SourceWeights | None = None,
    ) -> list[MergedResult]:
        """Merge results from multiple sources using RRF.

        Args:
            sources: {"code": {"source": "code", "results": [...]}, ...}
            weights: Optional source weights
        """
        w = weights or SourceWeights()
        scores: dict[str, dict[str, Any]] = {}

        self._add_scores(scores, sources.get("code", {}).get("results", []), w.code, "code")
        self._add_scores(scores, sources.get("memory", {}).get("results", []), w.memory, "memory")
        self._add_scores(scores, sources.get("graph", {}).get("results", []), w.graph, "graph")

        merged = sorted(scores.values(), key=lambda x: x["score"], reverse=True)

        return [
            MergedResult(
                name=entry["item"].get("name", ""),
                id=entry["item"].get("id"),
                kind=entry["item"].get("kind"),
                file=entry["item"].get("file"),
                line=entry["item"].get("line"),
                signature=entry["item"].get("signature"),
                source_code=entry["item"].get("source_code"),
                content=entry["item"].get("content"),
                relevance_score=entry["score"],
                sources=entry["sources"],
                relationship=entry["item"].get("relationship"),
            )
            for entry in merged
        ]

    def _add_scores(
        self,
        scores: dict[str, dict[str, Any]],
        results: list[Any],
        weight: float,
        source: str,
    ) -> None:
        for rank, item in enumerate(results):
            key = self._get_key(item)
            rrf_score = weight * (1 / (self._k + rank))

            if key in scores:
                scores[key]["score"] += rrf_score
                scores[key]["sources"].append(source)
            else:
                scores[key] = {"score": rrf_score, "item": item, "sources": [source]}

    @staticmethod
    def _get_key(item: Any) -> str:
        if isinstance(item, dict):
            if item.get("id"):
                return str(item["id"])
            if item.get("name") and item.get("file"):
                return f"{item['name']}:{item['file']}"
            if item.get("name"):
                return item["name"]
        return json.dumps(item, default=str)[:100]
