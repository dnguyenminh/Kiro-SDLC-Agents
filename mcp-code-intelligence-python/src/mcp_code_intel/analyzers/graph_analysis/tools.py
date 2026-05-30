"""KSA-163: MCP Tool registrations for graph analysis."""
from __future__ import annotations
import sqlite3
from typing import Any
from .utils import GraphLoader
from .circular_dep_detector import CircularDepDetector
from .related_test_finder import RelatedTestFinder
from .hot_path_analyzer import HotPathAnalyzer
from .dead_import_detector import DeadImportDetector
from .module_summarizer import ModuleSummarizer

GRAPH_TOOL_DEFINITIONS = [
    {"name": "find_circular_deps", "description": "Find circular dependencies using Tarjan's SCC.",
     "inputSchema": {"type": "object", "properties": {
         "module": {"type": "string"}, "max_length": {"type": "number"}}}},
    {"name": "find_related_tests", "description": "Find tests for a symbol via reverse BFS.",
     "inputSchema": {"type": "object", "properties": {
         "symbol_name": {"type": "string"}, "file_path": {"type": "string"},
         "max_depth": {"type": "number"}}, "required": ["symbol_name"]}},
    {"name": "find_hot_paths", "description": "Find most-called functions.",
     "inputSchema": {"type": "object", "properties": {
         "module": {"type": "string"}, "limit": {"type": "number"}, "min_callers": {"type": "number"}}}},
    {"name": "find_dead_imports", "description": "Find unused imports.",
     "inputSchema": {"type": "object", "properties": {
         "file_path": {"type": "string"}, "module": {"type": "string"}, "limit": {"type": "number"}}}},
    {"name": "module_summary", "description": "Quality summary per module.",
     "inputSchema": {"type": "object", "properties": {"module": {"type": "string"}}}},
]


def handle_graph_tool(name: str, args: dict[str, Any], conn: sqlite3.Connection) -> str | None:
    gl = GraphLoader(conn)
    handlers = {
        "find_circular_deps": lambda: _circular(args, gl),
        "find_related_tests": lambda: _tests(args, gl),
        "find_hot_paths": lambda: _hot(args, gl),
        "find_dead_imports": lambda: _dead(args, conn),
        "module_summary": lambda: _summary(args, conn),
    }
    handler = handlers.get(name)
    return handler() if handler else None


def _circular(args: dict, gl: GraphLoader) -> str:
    results = CircularDepDetector(gl).detect(args.get("module"), args.get("max_length"))
    if not results: return "No circular dependencies found."
    lines = [f"Found {len(results)} circular dependencies:"]
    for d in results:
        lines.append(f"[{d.severity.upper()}] Cycle (length {d.length}):")
        lines.append(f"  {' → '.join(d.cycle.edges)}")
    return "\n".join(lines)


def _tests(args: dict, gl: GraphLoader) -> str:
    name = args.get("symbol_name")
    if not name: return "Parameter 'symbol_name' required."
    r = RelatedTestFinder(gl).find(name, args.get("max_depth", 3), args.get("file_path"))
    if not r: return f'Symbol "{name}" not found.'
    if r.total_tests == 0: return f'No tests found for "{name}".'
    lines = [f"Tests for {r.symbol.name} ({r.symbol.file_path}):"]
    for t in r.direct_tests: lines.append(f"  ✓ {t.test_name} — {t.file_path}")
    for t in r.indirect_tests: lines.append(f"  ○ {t.test_name} — {t.file_path} (depth: {t.depth})")
    return "\n".join(lines)


def _hot(args: dict, gl: GraphLoader) -> str:
    results = HotPathAnalyzer(gl).analyze(args.get("module"), args.get("limit", 20), args.get("min_callers", 2))
    if not results: return "No hot paths found."
    lines = [f"Hot Paths — Top {len(results)}:"]
    for i, h in enumerate(results, 1):
        lines.append(f"{i}. {h.symbol_name} ({h.kind}) — {h.direct_callers} direct, {h.transitive_callers} transitive")
    return "\n".join(lines)


def _dead(args: dict, conn: sqlite3.Connection) -> str:
    results = DeadImportDetector(conn).detect(args.get("file_path"), args.get("module"), args.get("limit", 50))
    if not results: return "No dead imports found."
    lines = [f"Found {len(results)} unused imports:"]
    for i in results: lines.append(f"  {i.file_path}:{i.line} — {i.imported_symbol}")
    return "\n".join(lines)


def _summary(args: dict, conn: sqlite3.Connection) -> str:
    results = ModuleSummarizer(conn).summarize(args.get("module"))
    if not results: return "No modules found."
    lines = [f"Module Summary ({len(results)} modules):"]
    for m in results:
        lines.append(f"📦 {m.module} — Files: {m.file_count} | Symbols: {m.symbol_count} | "
                     f"Circular: {m.circular_deps} | Dead: {m.dead_imports} | "
                     f"Avg CC: {f'{m.avg_complexity:.1f}' if m.avg_complexity else 'N/A'}")
    return "\n".join(lines)
