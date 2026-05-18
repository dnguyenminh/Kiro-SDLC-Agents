"""Creates graph edges between ingested chunks from the same document."""

import sys
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .knowledge_graph import KnowledgeGraph

# Relation types for ingest-created edges.
RELATION_SIBLING = "SIBLING"
RELATION_DERIVED_FROM = "DERIVED_FROM"


class IngestGraphLinker:
    """Links ingested entries with graph edges (sibling + source relationships)."""

    def __init__(self, graph: "KnowledgeGraph") -> None:
        self._graph = graph

    def link_chunks(self, chunk_ids: list[int], source: str) -> None:
        """Create sibling edges for a batch of chunk IDs from the same document."""
        if len(chunk_ids) < 2:
            return
        self._create_sibling_edges(chunk_ids)
        _log(f"created {len(chunk_ids) - 1} edges for {len(chunk_ids)} chunks from {source}")

    def link_to_source(self, entry_id: int, source_entry_id: int) -> None:
        """Create DERIVED_FROM edge between entry and its source."""
        self._graph.add_edge(entry_id, source_entry_id, RELATION_DERIVED_FROM)

    def edge_count(self, chunk_ids: list[int]) -> int:
        """Calculate how many edges would be created for a chunk list."""
        return max(0, len(chunk_ids) - 1)

    def _create_sibling_edges(self, chunk_ids: list[int]) -> None:
        """Create sequential sibling edges between adjacent chunks."""
        for i in range(len(chunk_ids) - 1):
            self._graph.add_edge(chunk_ids[i], chunk_ids[i + 1], RELATION_SIBLING)


def _log(msg: str) -> None:
    print(f"[ingest-linker] {msg}", file=sys.stderr, flush=True)
