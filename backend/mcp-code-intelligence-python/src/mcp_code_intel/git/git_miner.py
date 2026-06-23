"""Git history mining orchestrator — index and search commit history."""

from __future__ import annotations

import sqlite3
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..memory.embedding.service import EmbeddingService

from .git_log_parser import GitLogParser, Commit
from .commit_embedder import CommitEmbedder
from .git_vector_index import GitVectorIndex
from .semantic_searcher import SemanticSearcher, CommitResult


@dataclass
class IndexingSummary:
    """Summary of git indexing operation."""
    commits_indexed: int
    total_commits: int
    last_hash: str | None
    duration_ms: int
    incremental: bool


class GitMiner:
    """Semantic search over git commit history.

    Orchestrates parsing, embedding, indexing, and searching.
    """

    def __init__(
        self,
        db_conn: sqlite3.Connection,
        repo_path: str,
        embedding_service: "EmbeddingService",
        max_commits: int = 10000,
    ) -> None:
        self._conn = db_conn
        self._repo_path = repo_path
        self._max_commits = max_commits
        self._parser = GitLogParser(repo_path)
        self._embedder = CommitEmbedder(embedding_service)
        self._index = GitVectorIndex(db_conn)
        self._searcher = SemanticSearcher(self._index, embedding_service)

    def index_history(self, force: bool = False) -> IndexingSummary:
        """Index git commits (incremental by default)."""
        start = datetime.now(timezone.utc)

        since_hash = None if force else self._index.get_last_indexed_hash()
        incremental = since_hash is not None

        _log(f"Indexing git history (incremental={incremental}, since={since_hash[:8] if since_hash else 'beginning'})")

        commits = self._parser.parse(since_hash=since_hash, max_commits=self._max_commits)
        _log(f"Parsed {len(commits)} commits")

        if not commits:
            return IndexingSummary(
                commits_indexed=0,
                total_commits=self._index.get_total_commits(),
                last_hash=since_hash,
                duration_ms=0,
                incremental=incremental,
            )

        indexed = 0
        batch: list[tuple[Commit, bytes]] = []

        for commit in commits:
            embedding = self._embedder.embed_commit(commit)
            if embedding:
                batch.append((commit, embedding))
                indexed += 1

            if len(batch) >= 100:
                self._index.store_batch(batch)
                batch.clear()

        if batch:
            self._index.store_batch(batch)

        latest_hash = self._parser.get_latest_hash()
        if latest_hash:
            self._index.set_last_indexed_hash(latest_hash)

        self._index.set_meta("last_indexed_at", datetime.now(timezone.utc).isoformat())
        self._index.set_meta("total_commits", str(self._index.get_total_commits()))

        elapsed = int((datetime.now(timezone.utc) - start).total_seconds() * 1000)
        _log(f"Indexed {indexed} commits in {elapsed}ms")

        return IndexingSummary(
            commits_indexed=indexed,
            total_commits=self._index.get_total_commits(),
            last_hash=latest_hash,
            duration_ms=elapsed,
            incremental=incremental,
        )

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
        return self._searcher.search(
            query=query,
            limit=limit,
            author=author,
            file_filter=file_filter,
            since=since,
            until=until,
        )

    def get_status(self) -> dict[str, str | int | None]:
        """Get current indexing status."""
        return {
            "total_commits": self._index.get_total_commits(),
            "last_indexed_hash": self._index.get_last_indexed_hash(),
            "last_indexed_at": self._index.get_meta("last_indexed_at"),
        }


def _log(msg: str) -> None:
    print(f"[git-miner] {msg}", file=sys.stderr, flush=True)
