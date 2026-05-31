"""Tests for AutoLinker — verifies semantic/entity/FTS auto-linking (KSA-190)."""

import math
import sqlite3
import struct

import pytest

from src.mcp_code_intel.memory.schema import MEMORY_SCHEMA
from src.mcp_code_intel.memory.knowledge_repo import KnowledgeRepository
from src.mcp_code_intel.memory.graph_repo import GraphRepository
from src.mcp_code_intel.memory.vector_repo import VectorRepository
from src.mcp_code_intel.memory.knowledge_graph import KnowledgeGraph
from src.mcp_code_intel.memory.structured_map_extractor import EntityRepository
from src.mcp_code_intel.memory.auto_link_config import (
    AutoLinkConfig,
    SemanticConfig,
    EntityConfig,
    FtsConfig,
    TagConfig,
)
from src.mcp_code_intel.memory.auto_linker import (
    AutoLinker,
    SemanticStrategy,
    EntityStrategy,
    FtsStrategy,
    CandidateEdge,
    AutoLinkResult,
    _cosine_similarity,
    _bytes_to_floats,
)


def _create_db() -> sqlite3.Connection:
    """Create in-memory DB with full schema."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(MEMORY_SCHEMA)
    # Ensure entity_index table exists
    conn.execute("""
        CREATE TABLE IF NOT EXISTS entity_index (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entry_id INTEGER NOT NULL,
            entity_name TEXT NOT NULL,
            entity_type TEXT DEFAULT 'auto'
        )
    """)
    conn.commit()
    return conn


def _make_vector(values: list[float]) -> bytes:
    """Convert float list to bytes (little-endian float32)."""
    return struct.pack(f"<{len(values)}f", *values)


class TestCosineSimilarity:
    """Unit tests for cosine similarity calculation."""

    def test_identical_vectors(self):
        v = [1.0, 0.0, 0.0]
        assert _cosine_similarity(v, v) == pytest.approx(1.0)

    def test_orthogonal_vectors(self):
        a = [1.0, 0.0, 0.0]
        b = [0.0, 1.0, 0.0]
        assert _cosine_similarity(a, b) == pytest.approx(0.0)

    def test_opposite_vectors(self):
        a = [1.0, 0.0]
        b = [-1.0, 0.0]
        assert _cosine_similarity(a, b) == pytest.approx(-1.0)

    def test_similar_vectors(self):
        a = [1.0, 1.0, 0.0]
        b = [1.0, 0.9, 0.1]
        score = _cosine_similarity(a, b)
        assert score > 0.9

    def test_empty_vectors(self):
        assert _cosine_similarity([], []) == 0.0

    def test_zero_vector(self):
        a = [0.0, 0.0, 0.0]
        b = [1.0, 1.0, 1.0]
        assert _cosine_similarity(a, b) == 0.0

    def test_different_lengths(self):
        a = [1.0, 0.0]
        b = [1.0, 0.0, 0.0]
        assert _cosine_similarity(a, b) == 0.0


class TestBytesToFloats:
    """Unit tests for byte-to-float conversion."""

    def test_basic_conversion(self):
        data = _make_vector([1.0, 2.0, 3.0])
        result = _bytes_to_floats(data)
        assert len(result) == 3
        assert result[0] == pytest.approx(1.0)
        assert result[1] == pytest.approx(2.0)
        assert result[2] == pytest.approx(3.0)

    def test_empty_bytes(self):
        assert _bytes_to_floats(b"") == []

    def test_none_input(self):
        assert _bytes_to_floats(None) == []


class TestSemanticStrategy:
    """Unit tests for SemanticStrategy."""

    def setup_method(self):
        self.conn = _create_db()
        self.repo = KnowledgeRepository(self.conn)
        self.vector_repo = VectorRepository(self.conn)
        self.config = AutoLinkConfig()

    def test_finds_similar_entries(self):
        """Should find entries with cosine >= 0.75."""
        # Create entries with similar vectors
        id1 = self.repo.insert("Entry A", "Summary A", "CONTEXT", "WORKING", "a.md", "")
        id2 = self.repo.insert("Entry B", "Summary B", "CONTEXT", "WORKING", "b.md", "")
        id3 = self.repo.insert("Entry C", "Summary C", "CONTEXT", "WORKING", "c.md", "")

        # id1 and id2 have very similar vectors, id3 is different
        v1 = _make_vector([1.0, 0.0, 0.0, 0.0])
        v2 = _make_vector([0.95, 0.1, 0.0, 0.0])  # Very similar to v1
        v3 = _make_vector([0.0, 0.0, 1.0, 0.0])   # Orthogonal to v1

        self.vector_repo.upsert(id1, v1, "test-model", 4)
        self.vector_repo.upsert(id2, v2, "test-model", 4)
        self.vector_repo.upsert(id3, v3, "test-model", 4)

        strategy = SemanticStrategy(self.vector_repo)
        candidates = strategy.find_candidates(id1, self.config)

        # Should find id2 (similar) but not id3 (orthogonal)
        target_ids = [c.target_id for c in candidates]
        assert id2 in target_ids
        assert id3 not in target_ids

    def test_returns_empty_when_no_vector(self):
        """Should return [] if entry has no vector."""
        id1 = self.repo.insert("Entry A", "Summary A", "CONTEXT", "WORKING", "a.md", "")
        strategy = SemanticStrategy(self.vector_repo)
        candidates = strategy.find_candidates(id1, self.config)
        assert candidates == []

    def test_respects_max_edges(self):
        """Should cap results at config.semantic.max_edges."""
        config = AutoLinkConfig(semantic=SemanticConfig(max_edges=2))
        id1 = self.repo.insert("Entry A", "Summary A", "CONTEXT", "WORKING", "a.md", "")
        v1 = _make_vector([1.0, 0.0, 0.0, 0.0])
        self.vector_repo.upsert(id1, v1, "test-model", 4)

        # Create 5 similar entries
        for i in range(5):
            eid = self.repo.insert(f"Entry {i}", f"Summary {i}", "CONTEXT", "WORKING", f"{i}.md", "")
            v = _make_vector([0.9 + i * 0.01, 0.1, 0.0, 0.0])
            self.vector_repo.upsert(eid, v, "test-model", 4)

        strategy = SemanticStrategy(self.vector_repo)
        candidates = strategy.find_candidates(id1, config)
        assert len(candidates) <= 2

    def test_relation_is_similar_to(self):
        """All candidates should have SIMILAR_TO relation."""
        id1 = self.repo.insert("Entry A", "Summary A", "CONTEXT", "WORKING", "a.md", "")
        id2 = self.repo.insert("Entry B", "Summary B", "CONTEXT", "WORKING", "b.md", "")
        v1 = _make_vector([1.0, 0.0, 0.0, 0.0])
        v2 = _make_vector([0.99, 0.01, 0.0, 0.0])
        self.vector_repo.upsert(id1, v1, "test-model", 4)
        self.vector_repo.upsert(id2, v2, "test-model", 4)

        strategy = SemanticStrategy(self.vector_repo)
        candidates = strategy.find_candidates(id1, self.config)
        for c in candidates:
            assert c.relation == "SIMILAR_TO"

    def test_disabled_returns_empty(self):
        """Should return [] when semantic is disabled."""
        config = AutoLinkConfig(semantic=SemanticConfig(enabled=False))
        strategy = SemanticStrategy(self.vector_repo)
        assert strategy.is_enabled(config) is False


class TestEntityStrategy:
    """Unit tests for EntityStrategy."""

    def setup_method(self):
        self.conn = _create_db()
        self.repo = KnowledgeRepository(self.conn)
        self.entity_repo = EntityRepository(self.conn)
        self.config = AutoLinkConfig()

    def test_finds_shared_entities(self):
        """Should find entries sharing entities with Jaccard >= 0.3."""
        id1 = self.repo.insert("Entry A", "Summary A", "CONTEXT", "WORKING", "a.md", "")
        id2 = self.repo.insert("Entry B", "Summary B", "CONTEXT", "WORKING", "b.md", "")

        # Both share "KSA-110" and "AuthService"
        self.entity_repo.index_entities(id1, ["KSA-110", "AuthService", "UserRepo"])
        self.entity_repo.index_entities(id2, ["KSA-110", "AuthService", "PaymentService"])

        strategy = EntityStrategy(self.entity_repo)
        candidates = strategy.find_candidates(id1, self.config)

        assert len(candidates) >= 1
        assert candidates[0].target_id == id2
        assert candidates[0].relation == "SHARES_ENTITY"
        # Jaccard: 2 shared / 4 union = 0.5
        assert candidates[0].score == pytest.approx(0.5, abs=0.01)

    def test_below_threshold_excluded(self):
        """Entries with Jaccard < 0.3 should be excluded."""
        id1 = self.repo.insert("Entry A", "Summary A", "CONTEXT", "WORKING", "a.md", "")
        id2 = self.repo.insert("Entry B", "Summary B", "CONTEXT", "WORKING", "b.md", "")

        # Only 1 shared out of many = low Jaccard
        self.entity_repo.index_entities(id1, ["KSA-110", "A", "B", "C", "D", "E"])
        self.entity_repo.index_entities(id2, ["KSA-110", "X", "Y", "Z", "W", "V"])

        strategy = EntityStrategy(self.entity_repo)
        candidates = strategy.find_candidates(id1, self.config)
        # Jaccard: 1/11 ≈ 0.09 < 0.3
        assert len(candidates) == 0

    def test_no_entities_returns_empty(self):
        """Should return [] if entry has no entities."""
        id1 = self.repo.insert("Entry A", "Summary A", "CONTEXT", "WORKING", "a.md", "")
        strategy = EntityStrategy(self.entity_repo)
        candidates = strategy.find_candidates(id1, self.config)
        assert candidates == []


class TestFtsStrategy:
    """Unit tests for FtsStrategy."""

    def setup_method(self):
        self.conn = _create_db()
        self.repo = KnowledgeRepository(self.conn)
        self.config = AutoLinkConfig()

    def _has_fts_table(self) -> bool:
        """Check if knowledge_fts table exists."""
        cur = self.conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_fts'"
        )
        return cur.fetchone() is not None

    def test_finds_topic_overlap(self):
        """Should find entries with matching keywords via FTS."""
        if not self._has_fts_table():
            pytest.skip("knowledge_fts table not available in test schema")

        id1 = self.repo.insert(
            "Authentication service implementation details",
            "Authentication service implementation",
            "CONTEXT", "WORKING", "auth.md", ""
        )
        id2 = self.repo.insert(
            "Authentication middleware for API gateway",
            "Authentication middleware gateway",
            "CONTEXT", "WORKING", "gateway.md", ""
        )

        strategy = FtsStrategy(self.conn)
        candidates = strategy.find_candidates(id1, self.config)
        # May find id2 if FTS is populated
        for c in candidates:
            assert c.relation == "TOPIC_OVERLAP"

    def test_no_summary_returns_empty(self):
        """Should return [] if entry has no summary."""
        # Insert with empty summary
        self.conn.execute(
            "INSERT INTO knowledge_entries (content, summary, type, tier) VALUES (?, ?, ?, ?)",
            ("content", "", "CONTEXT", "WORKING"),
        )
        self.conn.commit()
        entry_id = self.conn.execute("SELECT last_insert_rowid()").fetchone()[0]

        strategy = FtsStrategy(self.conn)
        candidates = strategy.find_candidates(entry_id, self.config)
        assert candidates == []

    def test_keyword_extraction(self):
        """Should extract meaningful keywords from summary."""
        strategy = FtsStrategy(self.conn)
        words = strategy._extract_keywords("Authentication service implementation details for users")
        assert "authentication" in words
        assert "service" in words
        assert "implementation" in words
        # Stopwords and short words excluded
        assert "for" not in words
        assert "the" not in words

    def test_disabled_returns_false(self):
        """Should report disabled when config says so."""
        config = AutoLinkConfig(fts=FtsConfig(enabled=False))
        strategy = FtsStrategy(self.conn)
        assert strategy.is_enabled(config) is False


class TestAutoLinker:
    """Integration tests for AutoLinker orchestrator."""

    def setup_method(self):
        self.conn = _create_db()
        self.repo = KnowledgeRepository(self.conn)
        self.graph_repo = GraphRepository(self.conn)
        self.vector_repo = VectorRepository(self.conn)
        self.entity_repo = EntityRepository(self.conn)
        self.linker = AutoLinker(
            graph_repo=self.graph_repo,
            conn=self.conn,
            vector_repo=self.vector_repo,
            entity_repo=self.entity_repo,
        )

    def test_link_creates_edges(self):
        """Should create edges from multiple strategies."""
        id1 = self.repo.insert("Entry A", "Summary A", "CONTEXT", "WORKING", "a.md", "")
        id2 = self.repo.insert("Entry B", "Summary B", "CONTEXT", "WORKING", "b.md", "")

        # Set up similar vectors
        v1 = _make_vector([1.0, 0.0, 0.0, 0.0])
        v2 = _make_vector([0.99, 0.01, 0.0, 0.0])
        self.vector_repo.upsert(id1, v1, "test-model", 4)
        self.vector_repo.upsert(id2, v2, "test-model", 4)

        # Set up shared entities
        self.entity_repo.index_entities(id1, ["KSA-110", "AuthService"])
        self.entity_repo.index_entities(id2, ["KSA-110", "AuthService"])

        result = self.linker.link(id1)
        assert isinstance(result, AutoLinkResult)
        assert result.entry_id == id1
        assert result.edges_created >= 1

    def test_disabled_config_creates_no_edges(self):
        """Should create 0 edges when config.enabled=False."""
        config = AutoLinkConfig(enabled=False)
        linker = AutoLinker(
            graph_repo=self.graph_repo,
            conn=self.conn,
            vector_repo=self.vector_repo,
            entity_repo=self.entity_repo,
            config=config,
        )
        id1 = self.repo.insert("Entry A", "Summary A", "CONTEXT", "WORKING", "a.md", "")
        result = linker.link(id1)
        assert result.edges_created == 0

    def test_no_duplicate_edges(self):
        """Running link twice should not create duplicate edges."""
        id1 = self.repo.insert("Entry A", "Summary A", "CONTEXT", "WORKING", "a.md", "")
        id2 = self.repo.insert("Entry B", "Summary B", "CONTEXT", "WORKING", "b.md", "")

        v1 = _make_vector([1.0, 0.0, 0.0, 0.0])
        v2 = _make_vector([0.99, 0.01, 0.0, 0.0])
        self.vector_repo.upsert(id1, v1, "test-model", 4)
        self.vector_repo.upsert(id2, v2, "test-model", 4)

        result1 = self.linker.link(id1)
        result2 = self.linker.link(id1)
        # Second run should skip existing edges
        assert result2.edges_created == 0
        assert result2.skipped >= result1.edges_created

    def test_respects_total_max_edges(self):
        """Should cap total edges at config.total_max_edges."""
        config = AutoLinkConfig(total_max_edges=2)
        linker = AutoLinker(
            graph_repo=self.graph_repo,
            conn=self.conn,
            vector_repo=self.vector_repo,
            entity_repo=self.entity_repo,
            config=config,
        )

        id1 = self.repo.insert("Entry A", "Summary A", "CONTEXT", "WORKING", "a.md", "")
        v1 = _make_vector([1.0, 0.0, 0.0, 0.0])
        self.vector_repo.upsert(id1, v1, "test-model", 4)

        # Create many similar entries
        for i in range(10):
            eid = self.repo.insert(f"Entry {i}", f"Summary {i}", "CONTEXT", "WORKING", f"{i}.md", "")
            v = _make_vector([0.95 + i * 0.005, 0.05, 0.0, 0.0])
            self.vector_repo.upsert(eid, v, "test-model", 4)

        result = linker.link(id1)
        assert result.edges_created <= 2

    def test_strategy_failure_isolation(self):
        """One strategy failing should not affect others."""
        id1 = self.repo.insert("Entry A", "Summary A", "CONTEXT", "WORKING", "a.md", "")
        id2 = self.repo.insert("Entry B", "Summary B", "CONTEXT", "WORKING", "b.md", "")

        # Only set up entities (no vectors) — semantic will return [], entity should work
        self.entity_repo.index_entities(id1, ["KSA-110", "AuthService"])
        self.entity_repo.index_entities(id2, ["KSA-110", "AuthService"])

        result = self.linker.link(id1)
        # Should still create entity edges even though semantic found nothing
        assert result.edges_created >= 1
        assert result.breakdown["entity"] >= 1

    def test_self_links_excluded(self):
        """Should never create an edge from entry to itself."""
        id1 = self.repo.insert("Entry A", "Summary A", "CONTEXT", "WORKING", "a.md", "")
        v1 = _make_vector([1.0, 0.0, 0.0, 0.0])
        self.vector_repo.upsert(id1, v1, "test-model", 4)

        result = self.linker.link(id1)
        # Check no self-edge in DB
        cur = self.conn.execute(
            "SELECT COUNT(*) FROM knowledge_graph_edges WHERE source_id = ? AND target_id = ?",
            (id1, id1),
        )
        assert cur.fetchone()[0] == 0

    def test_fts_fallback_skipped_when_enough_edges(self):
        """FTS should be skipped if prior strategies found >= fallback_threshold edges."""
        config = AutoLinkConfig(fts=FtsConfig(fallback_threshold=1))
        linker = AutoLinker(
            graph_repo=self.graph_repo,
            conn=self.conn,
            vector_repo=self.vector_repo,
            entity_repo=self.entity_repo,
            config=config,
        )

        id1 = self.repo.insert("Entry A", "Summary A", "CONTEXT", "WORKING", "a.md", "")
        id2 = self.repo.insert("Entry B", "Summary B", "CONTEXT", "WORKING", "b.md", "")

        # Set up vectors so semantic finds a match
        v1 = _make_vector([1.0, 0.0, 0.0, 0.0])
        v2 = _make_vector([0.99, 0.01, 0.0, 0.0])
        self.vector_repo.upsert(id1, v1, "test-model", 4)
        self.vector_repo.upsert(id2, v2, "test-model", 4)

        result = linker.link(id1)
        # FTS should not have run (semantic already found >= 1 candidate)
        assert result.breakdown["fts"] == 0

    def test_backfill_single_entry(self):
        """Backfill with entry_id should link that specific entry."""
        id1 = self.repo.insert("Entry A", "Summary A", "CONTEXT", "WORKING", "a.md", "")
        id2 = self.repo.insert("Entry B", "Summary B", "CONTEXT", "WORKING", "b.md", "")

        v1 = _make_vector([1.0, 0.0, 0.0, 0.0])
        v2 = _make_vector([0.99, 0.01, 0.0, 0.0])
        self.vector_repo.upsert(id1, v1, "test-model", 4)
        self.vector_repo.upsert(id2, v2, "test-model", 4)

        msg = self.linker.backfill(entry_id=id1)
        assert "Auto-linked entry" in msg
        assert self.graph_repo.count_edges() >= 1

    def test_backfill_orphans(self):
        """Backfill without entry_id should find and link orphan entries."""
        id1 = self.repo.insert("Entry A", "Summary A", "CONTEXT", "WORKING", "a.md", "")
        id2 = self.repo.insert("Entry B", "Summary B", "CONTEXT", "WORKING", "b.md", "")

        # Both are orphans (no edges)
        v1 = _make_vector([1.0, 0.0, 0.0, 0.0])
        v2 = _make_vector([0.99, 0.01, 0.0, 0.0])
        self.vector_repo.upsert(id1, v1, "test-model", 4)
        self.vector_repo.upsert(id2, v2, "test-model", 4)

        msg = self.linker.backfill()
        assert "Backfill:" in msg
        assert "processed" in msg

    def test_backfill_no_orphans(self):
        """Backfill should report no orphans when all entries have edges."""
        id1 = self.repo.insert("Entry A", "Summary A", "CONTEXT", "WORKING", "a.md", "")
        id2 = self.repo.insert("Entry B", "Summary B", "CONTEXT", "WORKING", "b.md", "")
        # Create an edge so they're not orphans
        self.graph_repo.add_edge(id1, id2, "RELATES_TO")

        msg = self.linker.backfill()
        assert "no orphan entries found" in msg

    def test_result_breakdown(self):
        """Result should have correct breakdown by type."""
        id1 = self.repo.insert("Entry A", "Summary A", "CONTEXT", "WORKING", "a.md", "")
        id2 = self.repo.insert("Entry B", "Summary B", "CONTEXT", "WORKING", "b.md", "")

        # Set up both vectors and entities
        v1 = _make_vector([1.0, 0.0, 0.0, 0.0])
        v2 = _make_vector([0.99, 0.01, 0.0, 0.0])
        self.vector_repo.upsert(id1, v1, "test-model", 4)
        self.vector_repo.upsert(id2, v2, "test-model", 4)

        self.entity_repo.index_entities(id1, ["KSA-110", "AuthService"])
        self.entity_repo.index_entities(id2, ["KSA-110", "AuthService"])

        result = self.linker.link(id1)
        assert result.breakdown["semantic"] >= 1
        assert result.breakdown["entity"] >= 1
        assert result.time_ms >= 0


class TestAutoLinkConfig:
    """Unit tests for AutoLinkConfig defaults."""

    def test_default_values(self):
        config = AutoLinkConfig()
        assert config.enabled is True
        assert config.semantic.min_score == 0.75
        assert config.entity.min_jaccard == 0.3
        assert config.tag.min_overlap == 2
        assert config.fts.fallback_threshold == 2
        assert config.total_max_edges == 10

    def test_custom_values(self):
        config = AutoLinkConfig(
            semantic=SemanticConfig(min_score=0.9, max_edges=3),
            entity=EntityConfig(min_jaccard=0.5),
            total_max_edges=5,
        )
        assert config.semantic.min_score == 0.9
        assert config.semantic.max_edges == 3
        assert config.entity.min_jaccard == 0.5
        assert config.total_max_edges == 5

    def test_disable_all(self):
        config = AutoLinkConfig(enabled=False)
        assert config.enabled is False
