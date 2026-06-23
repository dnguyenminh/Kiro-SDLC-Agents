"""Tests for IngestGraphLinker — verifies edges are created on ingest."""

import sqlite3
import pytest

from src.mcp_code_intel.memory.schema import MEMORY_SCHEMA
from src.mcp_code_intel.memory.knowledge_repo import KnowledgeRepository
from src.mcp_code_intel.memory.graph_repo import GraphRepository
from src.mcp_code_intel.memory.knowledge_graph import KnowledgeGraph
from src.mcp_code_intel.memory.ingest_graph_linker import (
    IngestGraphLinker,
    RELATION_SAME_TICKET,
    RELATION_SAME_TAG,
    RELATION_DOC_DEPENDENCY,
    RELATION_SIBLING,
)


def _create_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(MEMORY_SCHEMA)
    conn.commit()
    return conn


class TestIngestGraphLinker:
    def setup_method(self):
        self.conn = _create_db()
        self.repo = KnowledgeRepository(self.conn)
        self.graph_repo = GraphRepository(self.conn)
        self.graph = KnowledgeGraph(self.graph_repo)
        self.linker = IngestGraphLinker(self.graph, self.conn)

    def test_link_by_ticket_creates_edges(self):
        """Entries with same ticket key should be linked."""
        id1 = self.repo.insert("BRD content", "BRD summary", "REQUIREMENT", "WORKING", "documents/KSA-110/BRD.md", "KSA-110 BRD")
        id2 = self.repo.insert("FSD content", "FSD summary", "REQUIREMENT", "WORKING", "documents/KSA-110/FSD.md", "KSA-110 FSD")

        edges = self.linker.link_by_ticket(id2, "documents/KSA-110/FSD.md", "KSA-110 FSD", "")
        assert edges >= 1
        assert self.graph_repo.count_edges() >= 1

    def test_link_by_tags_creates_edges(self):
        """Entries with shared tags should be linked."""
        id1 = self.repo.insert("Content A", "Summary A", "CONTEXT", "WORKING", "src/a.py", "authentication security")
        id2 = self.repo.insert("Content B", "Summary B", "CONTEXT", "WORKING", "src/b.py", "authentication api")

        edges = self.linker.link_by_tags(id2, "authentication api")
        assert edges >= 1
        assert self.graph_repo.count_edges() >= 1

    def test_link_by_doc_dependency(self):
        """FSD should link to BRD (upstream) for same ticket."""
        id1 = self.repo.insert("BRD content", "BRD", "REQUIREMENT", "WORKING", "documents/KSA-110/BRD.md", "KSA-110 BRD")
        id2 = self.repo.insert("FSD content", "FSD", "REQUIREMENT", "WORKING", "documents/KSA-110/FSD.md", "KSA-110 FSD")

        edges = self.linker.link_by_doc_dependency(id2, "documents/KSA-110/FSD.md", "KSA-110 FSD")
        assert edges >= 1
        # FSD should connect to BRD
        connected = self.graph.get_connected(id2)
        assert id1 in connected

    def test_link_chunks_creates_sibling_edges(self):
        """Adjacent chunks from same document should be siblings."""
        ids = []
        for i in range(5):
            eid = self.repo.insert(f"Chunk {i}", f"Summary {i}", "CONTEXT", "WORKING", "doc.md", "")
            ids.append(eid)

        edges = self.linker.link_chunks(ids, "doc.md")
        assert edges == 4  # 5 chunks = 4 sibling edges

    def test_link_entry_runs_all_strategies(self):
        """link_entry should run ticket + tag + doc_dependency."""
        id1 = self.repo.insert("BRD for KSA-110", "BRD", "REQUIREMENT", "WORKING", "documents/KSA-110/BRD.md", "KSA-110 BRD")
        id2 = self.repo.insert("FSD for KSA-110", "FSD", "REQUIREMENT", "WORKING", "documents/KSA-110/FSD.md", "KSA-110 FSD")

        edges = self.linker.link_entry(id2, "documents/KSA-110/FSD.md", "KSA-110 FSD", "FSD content for KSA-110")
        assert edges >= 1

    def test_no_duplicate_edges(self):
        """Running link_entry twice should not create duplicate edges."""
        id1 = self.repo.insert("BRD", "BRD", "REQUIREMENT", "WORKING", "documents/KSA-110/BRD.md", "KSA-110 BRD")
        id2 = self.repo.insert("FSD", "FSD", "REQUIREMENT", "WORKING", "documents/KSA-110/FSD.md", "KSA-110 FSD")

        edges1 = self.linker.link_entry(id2, "documents/KSA-110/FSD.md", "KSA-110 FSD", "")
        edges2 = self.linker.link_entry(id2, "documents/KSA-110/FSD.md", "KSA-110 FSD", "")
        assert edges2 == 0  # No new edges on second run

    def test_no_edges_without_ticket(self):
        """Entries without ticket key should not get SAME_TICKET edges."""
        id1 = self.repo.insert("Generic content", "Summary", "CONTEXT", "WORKING", "notes.md", "general")
        edges = self.linker.link_by_ticket(id1, "notes.md", "general", "Generic content")
        assert edges == 0

    def test_tdd_links_to_brd_and_fsd(self):
        """TDD should link to both BRD and FSD (upstream docs)."""
        id_brd = self.repo.insert("BRD", "BRD", "REQUIREMENT", "WORKING", "documents/KSA-110/BRD.md", "KSA-110 BRD")
        id_fsd = self.repo.insert("FSD", "FSD", "REQUIREMENT", "WORKING", "documents/KSA-110/FSD.md", "KSA-110 FSD")
        id_tdd = self.repo.insert("TDD", "TDD", "ARCHITECTURE", "WORKING", "documents/KSA-110/TDD.md", "KSA-110 TDD")

        edges = self.linker.link_by_doc_dependency(id_tdd, "documents/KSA-110/TDD.md", "KSA-110 TDD")
        assert edges >= 2  # Should link to both BRD and FSD
        connected = self.graph.get_connected(id_tdd)
        assert id_brd in connected
        assert id_fsd in connected


class TestIngestPipelineWithLinker:
    """Integration test: verify IngestPipeline creates edges when linker is wired."""

    def setup_method(self):
        self.conn = _create_db()
        self.repo = KnowledgeRepository(self.conn)
        self.graph_repo = GraphRepository(self.conn)
        self.graph = KnowledgeGraph(self.graph_repo)
        self.linker = IngestGraphLinker(self.graph, self.conn)

    def test_ingest_entry_creates_edges(self):
        """ingest_entry should auto-create edges via linker."""
        from src.mcp_code_intel.memory.ingest import IngestPipeline

        pipeline = IngestPipeline(self.repo)
        pipeline.set_graph_linker(self.linker)

        # Ingest BRD first
        id1 = pipeline.ingest_entry(
            "BRD content for KSA-110",
            "BRD KSA-110",
            "REQUIREMENT",
            source="documents/KSA-110/BRD.md",
            tags="KSA-110 BRD",
        )

        # Ingest FSD — should auto-link to BRD
        id2 = pipeline.ingest_entry(
            "FSD content for KSA-110",
            "FSD KSA-110",
            "REQUIREMENT",
            source="documents/KSA-110/FSD.md",
            tags="KSA-110 FSD",
        )

        assert self.graph_repo.count_edges() >= 1
        connected = self.graph.get_connected(id2)
        assert id1 in connected

    def test_ingest_markdown_creates_sibling_edges(self):
        """ingest_markdown should create sibling edges between chunks."""
        from src.mcp_code_intel.memory.ingest import IngestPipeline

        pipeline = IngestPipeline(self.repo)
        pipeline.set_graph_linker(self.linker)

        markdown = """# Section 1
This is the first section with enough content to be a chunk.

# Section 2
This is the second section with enough content to be a chunk.

# Section 3
This is the third section with enough content to be a chunk.
"""
        result = pipeline.ingest_markdown(markdown, "documents/KSA-110/BRD.md", "REQUIREMENT")
        assert result["entries_created"] >= 2
        assert result["edges_created"] >= 1  # At least sibling edges
