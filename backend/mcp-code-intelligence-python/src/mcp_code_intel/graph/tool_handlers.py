"""Graph tool handlers — dispatch to existing services. KSA-171."""

from __future__ import annotations

import json
import sqlite3
import time
from typing import Any

from .call_graph_service import CallGraphService
from .dependency_formatters import format_dependency_result
from .dependency_graph_service import DependencyGraphService
from .file_resolver import FileResolver
from .impact_analysis_service import ImpactAnalysisService
from .models import ImpactAction, Severity, TraverseConfig
from .symbol_resolver import SymbolResolver
from .test_detector import TestDetector
from .traverser import GraphTraverser


def handle_code_callers(args: dict[str, Any], conn: sqlite3.Connection, workspace: str) -> str:
    """Handle code_callers tool call."""
    symbol = args.get("symbol", "")
    if not symbol:
        return json.dumps({"error": 'Parameter "symbol" is required'})

    depth = int(args.get("depth", 1))
    limit = int(args.get("limit", 20))
    file_filter = args.get("file_filter")
    kind_filter = args.get("kind_filter", "calls")

    resolver = SymbolResolver(conn)
    service = CallGraphService(conn, resolver)
    result = service.find_callers(symbol, depth, limit, file_filter, kind_filter)
    return _format_call_graph(result, "callers")


def handle_code_callees(args: dict[str, Any], conn: sqlite3.Connection, workspace: str) -> str:
    """Handle code_callees tool call."""
    symbol = args.get("symbol", "")
    if not symbol:
        return json.dumps({"error": 'Parameter "symbol" is required'})

    depth = int(args.get("depth", 1))
    limit = int(args.get("limit", 20))
    file_filter = args.get("file_filter")
    include_external = args.get("include_external", True)

    resolver = SymbolResolver(conn)
    service = CallGraphService(conn, resolver)
    result = service.find_callees(symbol, depth, limit, file_filter, include_external)
    return _format_call_graph(result, "callees")


def handle_code_traverse(args: dict[str, Any], conn: sqlite3.Connection, workspace: str) -> str:
    """Handle code_traverse tool call."""
    start = args.get("start", "")
    if not start:
        return json.dumps({"error": 'Parameter "start" is required'})

    edge_types = args.get("edge_types", [])
    node_types = args.get("node_types", [])
    direction = args.get("direction", "outgoing")
    max_depth = min(max(int(args.get("max_depth", 3)), 1), 10)
    max_results = min(int(args.get("max_results", 50)), 200)
    include_source = args.get("include_source", False)
    source_lines = int(args.get("source_lines", 5))

    resolver = SymbolResolver(conn)
    traverser = GraphTraverser(conn, resolver, workspace)

    start_node = traverser.resolve_node(start)
    if not start_node:
        suggestions = resolver.suggest(start)
        if suggestions:
            return f'Symbol "{start}" not found. Did you mean: {", ".join(suggestions)}?'
        return f'Symbol "{start}" not found in index.'

    config = TraverseConfig(
        edge_types=edge_types, node_types=node_types,
        direction=direction, max_depth=max_depth, max_results=max_results,
    )

    start_time = time.time()
    results = traverser.traverse(start_node, config)
    elapsed_ms = int((time.time() - start_time) * 1000)

    if not results:
        return (
            f'No connected nodes found from "{start}" with the given filters '
            f"(direction: {direction}, edge_types: {', '.join(edge_types) or 'all'}, "
            f"node_types: {', '.join(node_types) or 'all'})"
        )

    response = traverser.format_response(
        start_node, results, include_source, source_lines, elapsed_ms
    )
    return json.dumps(
        {"start": response.start, "results": response.results, "metadata": response.metadata},
        indent=2,
    )


def handle_code_impact(args: dict[str, Any], conn: sqlite3.Connection, workspace: str) -> str:
    """Handle code_impact tool call."""
    symbol = args.get("symbol", "")
    if not symbol:
        return json.dumps({"error": 'Parameter "symbol" is required'})

    action = ImpactAction(args.get("action", "modify"))
    depth = int(args.get("depth", 3))
    include_tests = args.get("include_tests", True)
    severity_threshold = Severity(args.get("severity_threshold", "low"))

    resolver = SymbolResolver(conn)
    call_graph = CallGraphService(conn, resolver)
    file_resolver = FileResolver(conn, workspace)
    dep_graph = DependencyGraphService(conn, file_resolver)
    test_detector = TestDetector(conn)
    service = ImpactAnalysisService(
        conn, call_graph, dep_graph, resolver, test_detector
    )

    result = service.analyze_impact(
        symbol, action, depth, include_tests, severity_threshold
    )
    return _format_impact(result)


def handle_code_dependencies(args: dict[str, Any], conn: sqlite3.Connection, workspace: str) -> str:
    """Handle code_dependencies tool call."""
    file = args.get("file", "")
    if not file:
        return json.dumps({"error": 'Parameter "file" is required'})

    direction = args.get("direction", "outgoing")
    depth = int(args.get("depth", 1))
    include_external = args.get("include_external", False)
    fmt = args.get("format", "tree")
    limit = int(args.get("limit", 50))

    file_resolver = FileResolver(conn, workspace)
    service = DependencyGraphService(conn, file_resolver)
    result = service.query(file, direction, depth, include_external, limit)

    if not result.results and result.root == file:
        return f'File "{file}" not found in index. Make sure the file has been indexed.'
    if not result.results:
        return f'No {direction} dependencies found for "{result.root}"'

    formatted = format_dependency_result(result, fmt)
    return json.dumps(formatted, indent=2)


def _format_call_graph(result: Any, direction: str) -> str:
    """Format CallGraphResponse into human-readable text."""
    if not result.results and not result.resolved_to:
        return f'Symbol "{result.symbol}" not found in index.'

    if not result.results:
        n = len(result.resolved_to)
        return f'No {direction} found for "{result.symbol}" (resolved to {n} definition(s))'

    lines: list[str] = []
    label = "Callers" if direction == "callers" else "Callees"
    lines.append(f'{label} of "{result.symbol}" (depth {result.metadata.depth_searched}):\n')

    if result.resolved_to:
        lines.append("Resolved to:")
        for r in result.resolved_to:
            lines.append(f"  [{r.kind}] {r.file}:{r.line}")
        lines.append("")

    for item in result.results:
        prefix = "  " * item.depth_level
        lines.append(f"{prefix}[{item.kind}] {item.qualified_name}")
        lines.append(
            f"{prefix}  {item.file_path}:{item.call_site_line} (def: L{item.definition_line})"
        )

    truncated = " | TRUNCATED" if result.metadata.truncated else ""
    lines.append(
        f"\n--- {result.metadata.total_count} results | "
        f"{result.metadata.query_time_ms}ms{truncated}"
    )
    return "\n".join(lines)


def _format_impact(result: Any) -> str:
    """Format ImpactResult into human-readable text."""
    lines: list[str] = []
    lines.append(f'Impact Analysis: "{result.symbol}" ({result.action.value})\n')
    lines.append("Blast Radius:")
    lines.append(f"  Critical: {result.blast_radius.summary.get('critical', 0)}")
    lines.append(f"  High: {result.blast_radius.summary.get('high', 0)}")
    lines.append(f"  Medium: {result.blast_radius.summary.get('medium', 0)}")
    lines.append(f"  Low: {result.blast_radius.summary.get('low', 0)}")
    af = result.blast_radius.affected_files
    lines.append(f"  Total affected: {result.blast_radius.total_affected} ({af} files)")
    lines.append(f"  Affected tests: {result.blast_radius.affected_tests}\n")

    if result.impacts:
        lines.append("Impacts:")
        for impact in result.impacts[:30]:
            icon = (
                "!!" if impact.severity == Severity.CRITICAL
                else "!" if impact.severity == Severity.HIGH
                else "-"
            )
            lines.append(f"  {icon} [{impact.severity.value}] {impact.symbol}")
            lines.append(f"    {impact.file}:{impact.line} - {impact.reason}")
        if len(result.impacts) > 30:
            lines.append(f"  ... and {len(result.impacts) - 30} more")
        lines.append("")

    if result.affected_tests:
        lines.append("Affected Tests:")
        for test in result.affected_tests[:10]:
            lines.append(f"  - {test.file} ({test.reason})")
        lines.append("")

    if result.recommendations:
        lines.append("Recommendations:")
        for rec in result.recommendations:
            lines.append(f"  * {rec}")
        lines.append("")

    truncated = " | TRUNCATED" if result.metadata.get("truncated") else ""
    depth = result.metadata.get("depth_searched", 0)
    ms = result.metadata.get("query_time_ms", 0)
    lines.append(f"--- {ms}ms | depth {depth}{truncated}")
    return "\n".join(lines)
