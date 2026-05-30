"""Tests for new analyzer modules — standalone (no tree_sitter dependency)."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "src"))

from mcp_code_intel.analyzers.complexity.models import Grade, GradeThresholds
from mcp_code_intel.analyzers.complexity.grade_assigner import GradeAssigner
from mcp_code_intel.analyzers.graph_analysis.utils.tarjan_scc import TarjanSCC
from mcp_code_intel.analyzers.entry_points.route_resolver import RouteResolver


def test_grade_assigner_defaults():
    g = GradeAssigner()
    assert g.assign_grade(1) == Grade.A
    assert g.assign_grade(5) == Grade.A
    assert g.assign_grade(6) == Grade.B
    assert g.assign_grade(10) == Grade.B
    assert g.assign_grade(11) == Grade.C
    assert g.assign_grade(20) == Grade.C
    assert g.assign_grade(21) == Grade.D
    assert g.assign_grade(50) == Grade.D
    assert g.assign_grade(51) == Grade.F
    print("  ✓ grade_assigner defaults")


def test_grade_assigner_custom():
    g = GradeAssigner(GradeThresholds(a=3, b=6, c=10, d=20))
    assert g.assign_grade(3) == Grade.A
    assert g.assign_grade(4) == Grade.B
    assert g.assign_grade(21) == Grade.F
    print("  ✓ grade_assigner custom thresholds")


def test_tarjan_simple_cycle():
    t = TarjanSCC()
    graph = {1: [2], 2: [1]}
    sccs = t.find_sccs(graph)
    assert len(sccs) == 1
    assert set(sccs[0]) == {1, 2}
    print("  ✓ tarjan simple cycle")


def test_tarjan_no_cycle():
    t = TarjanSCC()
    graph = {1: [2], 2: [3], 3: []}
    sccs = t.find_sccs(graph)
    assert len(sccs) == 0
    print("  ✓ tarjan no cycle (DAG)")


def test_tarjan_triangle():
    t = TarjanSCC()
    graph = {1: [2], 2: [3], 3: [1]}
    sccs = t.find_sccs(graph)
    assert len(sccs) == 1
    assert len(sccs[0]) == 3
    print("  ✓ tarjan triangle cycle")


def test_tarjan_multiple_sccs():
    t = TarjanSCC()
    graph = {1: [2], 2: [1], 3: [4], 4: [3]}
    sccs = t.find_sccs(graph)
    assert len(sccs) == 2
    print("  ✓ tarjan multiple SCCs")


def test_route_resolver():
    r = RouteResolver()
    assert r.resolve("/api", "/users") == "/api/users"
    assert r.resolve(None, "/users") == "/users"
    assert r.resolve("/api", "") == "/api"
    assert r.resolve("/api", "/") == "/api"
    assert r.normalize_params("/users/:id") == "/users/{id}"
    assert r.normalize_params("/users/<int:id>") == "/users/{id}"
    assert r.extract_path_from_arg("'/users/:id'") == "/users/{id}"
    print("  ✓ route_resolver")


if __name__ == "__main__":
    print("Running analyzer module tests...")
    test_grade_assigner_defaults()
    test_grade_assigner_custom()
    test_tarjan_simple_cycle()
    test_tarjan_no_cycle()
    test_tarjan_triangle()
    test_tarjan_multiple_sccs()
    test_route_resolver()
    print("\nAll 7 tests passed! ✓")
