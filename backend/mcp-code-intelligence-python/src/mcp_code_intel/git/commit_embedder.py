"""Embed commit summaries for semantic search."""

from __future__ import annotations

import struct
import sys
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..memory.embedding.service import EmbeddingService

from .git_log_parser import Commit


class CommitEmbedder:
    """Generate embeddings for git commit summaries."""

    def __init__(self, embedding_service: "EmbeddingService") -> None:
        self._embed_svc = embedding_service

    def embed_commit(self, commit: Commit) -> bytes | None:
        """Generate embedding for a single commit.

        Combines message + file list into a searchable summary.
        """
        summary = self._build_summary(commit)
        vector = self._embed_svc.embed(summary)
        if vector is None:
            return None
        return self._float_list_to_bytes(vector)

    def embed_commits_batch(self, commits: list[Commit]) -> list[tuple[Commit, bytes | None]]:
        """Embed multiple commits. Returns list of (commit, embedding_bytes) tuples."""
        results: list[tuple[Commit, bytes | None]] = []
        for commit in commits:
            embedding = self.embed_commit(commit)
            results.append((commit, embedding))
        return results

    @staticmethod
    def _build_summary(commit: Commit) -> str:
        """Build a searchable text summary from commit data."""
        parts = [commit.message]
        if commit.files_changed:
            files = commit.files_changed[:20]
            parts.append(f"Files: {', '.join(files)}")
        if commit.insertions or commit.deletions:
            parts.append(f"Changes: +{commit.insertions} -{commit.deletions}")
        return "\n".join(parts)

    @staticmethod
    def _float_list_to_bytes(arr: list[float]) -> bytes:
        """Convert float list to little-endian bytes."""
        return struct.pack(f"<{len(arr)}f", *arr)


def _log(msg: str) -> None:
    print(f"[commit-embedder] {msg}", file=sys.stderr, flush=True)
