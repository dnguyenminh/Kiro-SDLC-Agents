"""Tests for KSA-168 similarity analysis module."""

import math
import sqlite3
import struct
import pytest

from mcp_code_intel.analyzers.similarity.cluster_builder import ClusterBuilder
from mcp_code_intel.analyzers.similarity.confidence_scorer import ConfidenceScorer
from mcp_code_intel.analyzers.similarity.reachability import ReachabilityAnalyzer
from mcp_code_intel.analyzers.similarity.dynamic_dispatch import DynamicDispatchRecognizer
from mcp_code_intel.analyzers.similarity.suggestion_generator import SuggestionGenerator
from mcp_code_intel.analyzers.similarity.cluster_builder import Cluster
from mcp_code_intel.analyzers.similarity.duplicate_detector import (
    DuplicateDetector,
    _cosine_similarity,
    _bytes_to_floats,
)
from mcp_code_intel.git.git_log_parser import GitLogParser, Commit


# --- ClusterBuilder Tests ---

class TestClusterBuilder:
    def test_empty(self):
        cb = ClusterBuilder()
        assert cb.get_clusters() == []

    def test_single_union(self):
        cb = ClusterBuilder()
        cb.union("a", "b")
        clusters = cb.get_clusters()
        assert len(clusters) == 1
        assert set(clusters[0].members) == {"a", "b"}

    def test_transitive_union(self):
        cb = ClusterBuilder()
        cb.union("a", "b")
        cb.union("b", "c")
        clusters = cb.get_clusters()
        assert len(clusters) == 1
        assert set(clusters[0].members) == {"a", "b", "c"}

    def test_separate_clusters(self):
        cb = ClusterBuilder()
        cb.union("a", "b")
        cb.union("c", "d")
        clusters = cb.get_clusters()
        assert len(clusters) == 2

    def test_find_path_compression(self):
        cb = ClusterBuilder()
        cb.union("a", "b")
        cb.union("b", "c")
        cb.union("c", "d")
        root = cb.find("d")
        assert cb.find("a") == root
        assert cb.find("b") == root
        assert cb.find("c") == root


# --- ConfidenceScorer Tests ---

class TestConfidenceScorer:
    def test_no_callers_only(self):
        scorer = ConfidenceScorer()
        score, reasons = scorer.score("func1", {"no_callers": True})
        assert score == 40
        assert "no_callers" in reasons[0]

    def test_high_confidence(self):
        scorer = ConfidenceScorer()
        context = {
            "no_callers": True,
            "not_exported": True,
            "no_tests": True,
        }
        score, reasons = scorer.score("func1", context)
        assert score == 75  # 40 + 20 + 15

    def test_dynamic_dispatch_reduces(self):
        scorer = ConfidenceScorer()
        context = {
            "no_callers": True,
            "not_exported": True,
            "dynamic_dispatch": True,
        }
        score, reasons = scorer.score("func1", context)
        assert score == 30  # 40 + 20 - 30

    def test_clamp_to_zero(self):
        scorer = ConfidenceScorer()
        context = {
            "dynamic_dispatch": True,
            "config_reference": True,
            "recently_modified": True,
        }
        score, _ = scorer.score("func1", context)
        assert score == 0  # -30 -20 -10 = -60 clamped to 0


# --- ReachabilityAnalyzer Tests ---

class MockCallGraph:
    def __init__(self, edges: dict):
        self._edges = edges

    def get_callees(self, node_id: str) -> list:
        return self._edges.get(node_id, [])

    def get_callers(self, node_id: str) -> list:
        return []


class TestReachabilityAnalyzer:
    def test_simple_reachability(self):
        graph = MockCallGraph({"main": ["a", "b"], "a": ["c"]})
        analyzer = ReachabilityAnalyzer(graph, ["main"])
        reachable = analyzer.compute_reachable()
        assert reachable == {"main", "a", "b", "c"}

    def test_unreachable(self):
        graph = MockCallGraph({"main": ["a"]})
        analyzer = ReachabilityAnalyzer(graph, ["main"])
        unreachable = analyzer.get_unreachable(["main", "a", "b", "c"])
        assert set(unreachable) == {"b", "c"}

    def test_cycle_handling(self):
        graph = MockCallGraph({"a": ["b"], "b": ["a"]})
        analyzer = ReachabilityAnalyzer(graph, ["a"])
        reachable = analyzer.compute_reachable()
        assert reachable == {"a", "b"}

    def test_empty_graph(self):
        graph = MockCallGraph({})
        analyzer = ReachabilityAnalyzer(graph, ["main"])
        reachable = analyzer.compute_reachable()
        assert reachable == {"main"}


# --- DynamicDispatchRecognizer Tests ---

class TestDynamicDispatchRecognizer:
    def test_getattr_detected(self):
        recognizer = DynamicDispatchRecognizer()
        assert recognizer.is_dynamically_dispatched("result = getattr(obj, name)")

    def test_decorator_detected(self):
        recognizer = DynamicDispatchRecognizer()
        assert recognizer.is_dynamically_dispatched("@app.route('/api')")

    def test_normal_code_not_detected(self):
        recognizer = DynamicDispatchRecognizer()
        assert not recognizer.is_dynamically_dispatched("def hello(): return 'world'")

    def test_deprecated_marker(self):
        recognizer = DynamicDispatchRecognizer()
        assert recognizer.has_deprecated_marker("@deprecated\ndef old_func(): pass")
        assert not recognizer.has_deprecated_marker("def new_func(): pass")

    def test_config_reference(self):
        recognizer = DynamicDispatchRecognizer()
        config = "handler: my_handler\ncallback: on_event"
        assert recognizer.is_config_referenced("my_handler", config)
        assert not recognizer.is_config_referenced("unknown_func", config)


# --- Cosine Similarity Tests ---

class TestCosineSimilarity:
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

    def test_different_lengths(self):
        a = [1.0, 0.0]
        b = [1.0, 0.0, 0.0]
        assert _cosine_similarity(a, b) == 0.0


# --- GitLogParser Tests ---

class TestGitLogParser:
    def test_parse_output(self):
        parser = GitLogParser("/tmp")
        output = (
            "abc1234567890123456789012345678901234567|John|2024-01-15T10:00:00+00:00|Fix bug in auth\n"
            "5\t2\tsrc/auth.py\n"
            "1\t0\ttests/test_auth.py\n"
            "\n"
            "def4567890123456789012345678901234567890|Jane|2024-01-14T09:00:00+00:00|Add feature X\n"
            "20\t5\tsrc/feature.py\n"
        )
        commits = parser._parse_output(output)
        assert len(commits) == 2
        assert commits[0].hash == "abc1234567890123456789012345678901234567"
        assert commits[0].author == "John"
        assert commits[0].message == "Fix bug in auth"
        assert commits[0].files_changed == ["src/auth.py", "tests/test_auth.py"]
        assert commits[0].insertions == 6
        assert commits[0].deletions == 2
        assert commits[1].hash == "def4567890123456789012345678901234567890"
        assert commits[1].files_changed == ["src/feature.py"]


# --- SuggestionGenerator Tests ---

class TestSuggestionGenerator:
    def test_same_file_suggestion(self):
        gen = SuggestionGenerator()
        clusters = [Cluster(representative="a", members=["file.py:func_a", "file.py:func_b"])]
        symbol_info = {
            "file.py:func_a": {"file": "file.py", "kind": "function", "start_line": 1, "end_line": 20},
            "file.py:func_b": {"file": "file.py", "kind": "function", "start_line": 25, "end_line": 44},
        }
        suggestions = gen.generate(clusters, symbol_info)
        assert len(suggestions) == 1
        assert suggestions[0].suggestion_type == "extract_function"
        assert suggestions[0].estimated_lines_saved > 0

    def test_cross_file_method_suggestion(self):
        gen = SuggestionGenerator()
        clusters = [Cluster(representative="a", members=["a.py:method_x", "b.py:method_y"])]
        symbol_info = {
            "a.py:method_x": {"file": "a.py", "kind": "method", "start_line": 1, "end_line": 15},
            "b.py:method_y": {"file": "b.py", "kind": "method", "start_line": 1, "end_line": 15},
        }
        suggestions = gen.generate(clusters, symbol_info)
        assert len(suggestions) == 1
        assert suggestions[0].suggestion_type == "extract_base_class"


# --- DuplicateDetector Integration Test ---

class TestDuplicateDetectorIntegration:
    def _setup_db(self):
        conn = sqlite3.connect(":memory:")
        conn.execute("""
            CREATE TABLE files (
                id INTEGER PRIMARY KEY, path TEXT, relative_path TEXT,
                language TEXT, module TEXT, content_hash TEXT,
                size_bytes INTEGER, last_indexed TEXT, line_count INTEGER
            )
        """)
        conn.execute("""
            CREATE TABLE symbols (
                id INTEGER PRIMARY KEY, file_id INTEGER, name TEXT,
                kind TEXT, signature TEXT, start_line INTEGER,
                end_line INTEGER, parent_symbol TEXT, visibility TEXT, doc_comment TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE embeddings (
                id INTEGER PRIMARY KEY, symbol_id INTEGER, file_id INTEGER,
                vector BLOB, model TEXT, created_at TEXT
            )
        """)

        conn.execute(
            "INSERT INTO files VALUES (1, '/src/a.py', 'src/a.py', 'python', 'main', 'h1', 100, '2024-01-01', 50)"
        )
        conn.execute(
            "INSERT INTO symbols VALUES (1, 1, 'func_a', 'function', 'def func_a()', 1, 20, NULL, 'public', NULL)"
        )
        conn.execute(
            "INSERT INTO symbols VALUES (2, 1, 'func_b', 'function', 'def func_b()', 25, 44, NULL, 'public', NULL)"
        )

        vec_a = [0.5] * 384
        vec_b = [0.5] * 383 + [0.51]
        blob_a = struct.pack(f"<{len(vec_a)}f", *vec_a)
        blob_b = struct.pack(f"<{len(vec_b)}f", *vec_b)

        conn.execute(
            "INSERT INTO embeddings VALUES (1, 1, 1, ?, 'test', '2024-01-01')", (blob_a,)
        )
        conn.execute(
            "INSERT INTO embeddings VALUES (2, 2, 1, ?, 'test', '2024-01-01')", (blob_b,)
        )
        conn.commit()
        return conn

    def test_detect_duplicates(self):
        conn = self._setup_db()
        detector = DuplicateDetector(conn, min_similarity=0.99, min_lines=5)
        report = detector.detect()
        assert report.total_functions_scanned == 2
        assert len(report.pairs) >= 1
        assert report.pairs[0].similarity > 0.99

    def test_no_duplicates_below_threshold(self):
        conn = self._setup_db()
        detector = DuplicateDetector(conn, min_similarity=1.0, min_lines=5)
        report = detector.detect()
        assert len(report.clusters) == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
