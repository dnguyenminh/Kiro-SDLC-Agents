"""Creates graph edges between ingested chunks from the same document.

Edge creation strategies:
1. SIBLING — adjacent chunks from the same document
2. SAME_TICKET — entries sharing the same Jira ticket (e.g. KSA-110)
3. SAME_TAG — entries sharing at least one tag
4. DOC_DEPENDENCY — document hierarchy (BRD -> FSD -> TDD -> STP/STC)
5. DERIVED_FROM — explicit source relationship
"""

import re
import sqlite3
import sys
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .knowledge_graph import KnowledgeGraph

# Relation types for ingest-created edges.
RELATION_SIBLING = "SIBLING"
RELATION_DERIVED_FROM = "DERIVED_FROM"
RELATION_SAME_TICKET = "SAME_TICKET"
RELATION_SAME_TAG = "SAME_TAG"
RELATION_DOC_DEPENDENCY = "DOC_DEPENDENCY"

# Document dependency order — downstream depends on upstream
_DOC_HIERARCHY = ["BRD", "FSD", "TDD", "STP", "STC", "UG", "DPG", "RLN"]

# Regex to extract ticket key from source/tags/content (e.g. KSA-110, COLLEX-64)
_TICKET_RE = re.compile(r"\b([A-Z][A-Z0-9]+-\d+)\b")

# Regex to detect document type from source field
_DOC_TYPE_RE = re.compile(r"\b(BRD|FSD|TDD|STP|STC|UG|DPG|RLN)\b", re.IGNORECASE)


class IngestGraphLinker:
    """Links ingested entries with graph edges (sibling, ticket, tag, doc-dependency)."""

    def __init__(self, graph: "KnowledgeGraph", conn: sqlite3.Connection) -> None:
        self._graph = graph
        self._conn = conn

    def link_chunks(self, chunk_ids: list[int], source: str) -> int:
        """Create sibling edges for a batch of chunk IDs from the same document.
        Returns number of edges created."""
        if len(chunk_ids) < 2:
            return 0
        self._create_sibling_edges(chunk_ids)
        count = len(chunk_ids) - 1
        _log(f"SIBLING: {count} edges for {len(chunk_ids)} chunks from {source}")
        return count

    def link_to_source(self, entry_id: int, source_entry_id: int) -> None:
        """Create DERIVED_FROM edge between entry and its source."""
        self._graph.add_edge(entry_id, source_entry_id, RELATION_DERIVED_FROM)

    def link_by_ticket(self, entry_id: int, source: str | None, tags: str, content: str) -> int:
        """Find other entries with the same ticket key and create SAME_TICKET edges.
        Returns number of edges created."""
        ticket = self._extract_ticket(source, tags, content)
        if not ticket:
            return 0

        # Find existing entries with same ticket in source or tags
        cur = self._conn.execute(
            """SELECT id FROM knowledge_entries
               WHERE id != ? AND (source LIKE ? OR tags LIKE ? OR content LIKE ?)
               LIMIT 50""",
            (entry_id, f"%{ticket}%", f"%{ticket}%", f"%{ticket}%"),
        )
        related_ids = [row[0] for row in cur.fetchall()]
        if not related_ids:
            return 0

        count = 0
        for rid in related_ids:
            if not self._edge_exists(entry_id, rid, RELATION_SAME_TICKET):
                self._graph.add_edge(entry_id, rid, RELATION_SAME_TICKET)
                count += 1

        if count:
            _log(f"SAME_TICKET: {count} edges for entry {entry_id} (ticket={ticket})")
        return count

    def link_by_tags(self, entry_id: int, tags: str) -> int:
        """Find entries sharing at least one tag and create SAME_TAG edges.
        Returns number of edges created."""
        if not tags or not tags.strip():
            return 0

        tag_list = [t.strip().lower() for t in tags.replace(",", " ").split() if t.strip()]
        if not tag_list:
            return 0

        # Build query to find entries with overlapping tags
        conditions = " OR ".join(["LOWER(tags) LIKE ?" for _ in tag_list])
        params: list = [entry_id] + [f"%{t}%" for t in tag_list]

        cur = self._conn.execute(
            f"""SELECT id FROM knowledge_entries
                WHERE id != ? AND ({conditions})
                LIMIT 30""",
            params,
        )
        related_ids = [row[0] for row in cur.fetchall()]
        if not related_ids:
            return 0

        count = 0
        for rid in related_ids:
            if not self._edge_exists(entry_id, rid, RELATION_SAME_TAG):
                self._graph.add_edge(entry_id, rid, RELATION_SAME_TAG)
                count += 1

        if count:
            _log(f"SAME_TAG: {count} edges for entry {entry_id} (tags={tags[:50]})")
        return count

    def link_by_doc_dependency(self, entry_id: int, source: str | None, tags: str) -> int:
        """Create DOC_DEPENDENCY edges based on document hierarchy.
        BRD -> FSD -> TDD -> STP/STC. Returns number of edges created."""
        doc_type = self._extract_doc_type(source, tags)
        if not doc_type:
            return 0

        ticket = self._extract_ticket(source, tags, "")
        if not ticket:
            return 0

        # Find position in hierarchy
        doc_upper = doc_type.upper()
        if doc_upper not in _DOC_HIERARCHY:
            return 0

        idx = _DOC_HIERARCHY.index(doc_upper)
        count = 0

        # Link to upstream documents (predecessors)
        for upstream_doc in _DOC_HIERARCHY[:idx]:
            upstream_ids = self._find_entries_by_ticket_and_doc(ticket, upstream_doc, entry_id)
            for uid in upstream_ids:
                if not self._edge_exists(entry_id, uid, RELATION_DOC_DEPENDENCY):
                    self._graph.add_edge(entry_id, uid, RELATION_DOC_DEPENDENCY)
                    count += 1

        # Link to downstream documents (dependents) — they depend on us
        for downstream_doc in _DOC_HIERARCHY[idx + 1:]:
            downstream_ids = self._find_entries_by_ticket_and_doc(ticket, downstream_doc, entry_id)
            for did in downstream_ids:
                if not self._edge_exists(did, entry_id, RELATION_DOC_DEPENDENCY):
                    self._graph.add_edge(did, entry_id, RELATION_DOC_DEPENDENCY)
                    count += 1

        if count:
            _log(f"DOC_DEPENDENCY: {count} edges for entry {entry_id} ({doc_upper} in {ticket})")
        return count

    def link_entry(self, entry_id: int, source: str | None, tags: str, content: str) -> int:
        """Run all linking strategies for a single entry. Returns total edges created."""
        total = 0
        total += self.link_by_ticket(entry_id, source, tags, content)
        total += self.link_by_tags(entry_id, tags)
        total += self.link_by_doc_dependency(entry_id, source, tags)
        return total

    def edge_count(self, chunk_ids: list[int]) -> int:
        """Calculate how many edges would be created for a chunk list."""
        return max(0, len(chunk_ids) - 1)

    # --- Private helpers ---

    def _create_sibling_edges(self, chunk_ids: list[int]) -> None:
        """Create sequential sibling edges between adjacent chunks."""
        for i in range(len(chunk_ids) - 1):
            self._graph.add_edge(chunk_ids[i], chunk_ids[i + 1], RELATION_SIBLING)

    def _extract_ticket(self, source: str | None, tags: str, content: str) -> str | None:
        """Extract Jira ticket key from source, tags, or content."""
        for text in [source or "", tags, content[:500]]:
            match = _TICKET_RE.search(text)
            if match:
                return match.group(1)
        return None

    def _extract_doc_type(self, source: str | None, tags: str) -> str | None:
        """Extract document type (BRD, FSD, TDD, etc.) from source or tags."""
        for text in [source or "", tags]:
            match = _DOC_TYPE_RE.search(text)
            if match:
                return match.group(1).upper()
        return None

    def _find_entries_by_ticket_and_doc(
        self, ticket: str, doc_type: str, exclude_id: int
    ) -> list[int]:
        """Find entries matching both a ticket key and document type."""
        cur = self._conn.execute(
            """SELECT id FROM knowledge_entries
               WHERE id != ?
                 AND (source LIKE ? OR tags LIKE ?)
                 AND (UPPER(source) LIKE ? OR UPPER(tags) LIKE ?)
               LIMIT 20""",
            (exclude_id, f"%{ticket}%", f"%{ticket}%",
             f"%{doc_type}%", f"%{doc_type}%"),
        )
        return [row[0] for row in cur.fetchall()]

    def _edge_exists(self, source_id: int, target_id: int, relation: str) -> bool:
        """Check if an edge already exists (prevent duplicates)."""
        cur = self._conn.execute(
            """SELECT 1 FROM knowledge_graph_edges
               WHERE source_id = ? AND target_id = ? AND relation = ?
               LIMIT 1""",
            (source_id, target_id, relation),
        )
        return cur.fetchone() is not None


def _log(msg: str) -> None:
    print(f"[ingest-linker] {msg}", file=sys.stderr, flush=True)
