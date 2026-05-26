"""Semantic search over indexed git commits."""

from __future__ import annotations

import struct
import sys
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..memory.embedding.service import EmbeddingService

from .git_vector_index import GitVectorIndex, VectorSearchResult


@dataclass
class CommitResult:
    """A search result with commit info and relevance score."""
    hash: str
    author: str
    date: str
    message: str
    files_changed: list[str]
    insertions: int
    deletions: int
    relevance: float  # 0.0 - 1.0


class SemanticSearcher:
    """Natural language query over indexed git commits."""

    def __init__(
        self,
        index: GitVectorIndex,
        embedding_service: "EmbeddingService",
    ) -> None:
        self._index = index
        self._embed_svc = embedding_service

    def search(
        self,
        query: str,
        limit: int = 10,
        author: str | None = None,
        file_filter: str | None = None,
        since: str | None = None,
        until: str | None = None,
    ) -> list[CommitResult]:
        """Semantic search over indexed commits."""
        query_vector = self._embed_svc.embed(query)
        if query_vector is None:
            _log("Failed to embed query")
            return []

        query_bytes = _float_list_to_bytes(query_vector)

        fetch_limit = limit * 5 if any([author, file_filter, since, until]) else limit
        raw_results = self._index.search(query_bytes, limit=fetch_limit)

        filtered = self._apply_filters(raw_results, author, file_filter, since, until)

        results: list[CommitResult] = []
        for r in filtered[:limit]:
            results.append(CommitResult(
                hash=r.hash,
                author=r.author,
                date=r.date,
                message=r.message,
                files_changed=r.files_changed,
                insertions=r.insertions,
                deletions=r.deletions,
                relevance=r.similarity,
            ))

        return results

    def _apply_filters(
        self,
        results: list[VectorSearchResult],
        author: str | None,
        file_filter: str | None,
        since: str | None,
        until: str | None,
    ) -> list[VectorSearchResult]:
        """Apply post-retrieval filters."""
        filtered = results

        if author:
            author_lower = author.lower()
            filtered = [r for r in filtered if author_lower in r.author.lower()]

        if file_filter:
            file_lower = file_filter.lower()
            filtered = [
                r for r in filtered
                if any(file_lower in f.lower() for f in r.files_changed)
            ]

        if since:
            filtered = [r for r in filtered if r.date >= since]

        if until:
            filtered = [r for r in filtered if r.date <= until]

        return filtered


def _float_list_to_bytes(arr: list[float]) -> bytes:
    """Convert float list to little-endian bytes."""
    return struct.pack(f"<{len(arr)}f", *arr)


def _log(msg: str) -> None:
    print(f"[git-search] {msg}", file=sys.stderr, flush=True)
