"""KSA-161: MCP Tool for complexity_analysis."""
from __future__ import annotations
import sqlite3
from typing import Any
from .models import Grade, ComplexityFilters, SortBy
from .analyzer import ComplexityAnalyzer

COMPLEXITY_TOOL_DEFINITION = {
    "name": "complexity_analysis",
    "description": "Analyze cyclomatic complexity with breakdown and A-F grading.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "file_path": {"type": "string", "description": "Filter by file path"},
            "symbol_name": {"type": "string", "description": "Filter by function name"},
            "min_complexity": {"type": "number", "description": "Minimum CC threshold"},
            "grade_filter": {"type": "string", "description": "Comma-separated grades"},
            "module": {"type": "string", "description": "Filter by module"},
            "limit": {"type": "number", "description": "Max results (default: 20)"},
            "sort_by": {"type": "string", "description": "Sort: complexity, name, file"},
        },
    },
}


def handle_complexity_tool(args: dict[str, Any], conn: sqlite3.Connection) -> str:
    analyzer = ComplexityAnalyzer(conn)
    grade_filter = None
    if gf := args.get("grade_filter"):
        grade_filter = [Grade(g.strip()) for g in gf.split(",") if g.strip() in [x.value for x in Grade]]
    sort_map = {"name": SortBy.NAME, "file": SortBy.FILE}
    filters = ComplexityFilters(
        file_path=args.get("file_path"),
        symbol_name=args.get("symbol_name"),
        min_complexity=args.get("min_complexity"),
        grade_filter=grade_filter,
        module=args.get("module"),
        limit=args.get("limit", 20),
        sort_by=sort_map.get(args.get("sort_by", ""), SortBy.COMPLEXITY),
    )
    result = analyzer.query(filters)
    if not result.results:
        return "No complexity data found. Run indexing first."
    lines = [
        f"Complexity Analysis — {result.total} functions found",
        f"Average CC: {result.summary.average:.1f} | Grade Distribution: "
        + " ".join(f"{g.value}={c}" for g, c in result.summary.grade_distribution.items()),
        "",
    ]
    for r in result.results:
        lines.append(
            f"[{r.grade.value}] {r.symbol_name} — CC={r.cyclomatic_complexity} "
            f"(branches={r.branches} loops={r.loops} logic={r.logical_ops} "
            f"exceptions={r.exception_handlers} depth={r.nesting_depth})"
        )
        lines.append(f"    {r.file_path}:{r.start_line}-{r.end_line}")
    return "\n".join(lines)
