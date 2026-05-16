"""MCP tool handlers — implements all 5 code intelligence tools."""

from pathlib import Path
from typing import Any

from .query import QueryLayer
from .indexer import IndexingEngine


def handle_code_search(params: dict[str, Any], query_layer: QueryLayer) -> str:
    """Handle code_search tool invocation."""
    query = params.get("query", "")
    limit = params.get("limit", 20)
    results = query_layer.search_code(query, limit)
    return _format_search_results(results, query)


def handle_code_symbols(params: dict[str, Any], query_layer: QueryLayer) -> str:
    """Handle code_symbols tool invocation."""
    name = params.get("name")
    file = params.get("file")
    kind = params.get("kind")
    limit = params.get("limit", 50)

    if file:
        symbols = query_layer.get_file_symbols(file)
        return _format_file_symbols(file, symbols)
    if name:
        symbols = query_layer.find_symbols(name, kind, limit)
        return _format_symbol_list(symbols, name)
    return 'Provide either "name" or "file" parameter'


def handle_code_context(params: dict[str, Any], query_layer: QueryLayer, workspace: str) -> str:
    """Handle code_context tool invocation."""
    file = params.get("file", "")
    symbol = params.get("symbol")
    start_line = params.get("startLine")
    end_line = params.get("endLine")
    ctx_lines = params.get("contextLines", 5)

    full_path = Path(workspace) / file
    if not full_path.exists():
        return f"File not found: {file}"

    lines = full_path.read_text(encoding="utf-8", errors="replace").split("\n")

    if symbol:
        return _get_symbol_context(file, symbol, lines, ctx_lines, query_layer)

    start = max(0, (start_line or 1) - 1 - ctx_lines)
    end = min(len(lines), (end_line or start_line or len(lines)) + ctx_lines)
    return _format_lines(lines, start, end, file)


def handle_code_modules(params: dict[str, Any], query_layer: QueryLayer) -> str:
    """Handle code_modules tool invocation."""
    name = params.get("name")
    modules = query_layer.list_modules()
    if name:
        modules = [m for m in modules if m["name"].lower().startswith(name.lower())]
    return _format_modules(modules)


def handle_code_index_status(params: dict[str, Any], query_layer: QueryLayer, indexer: IndexingEngine) -> str:
    """Handle code_index_status tool invocation."""
    if params.get("reindex", False):
        indexer.run_full_index()
    status = query_layer.get_index_status()
    return _format_status(status, indexer.is_running)


def handle_code_kb_export(params: dict[str, Any], query_layer: QueryLayer, workspace: str) -> str:
    """Handle code_kb_export tool invocation."""
    module_filter = params.get("module")
    output_format = params.get("format", "json")
    modules = query_layer.list_modules_with_patterns(module_filter)
    project_name = _extract_project_name(workspace)
    if output_format == "text":
        return _format_kb_text(modules, project_name)
    return _format_kb_json(modules, project_name)


# --- Formatters ---

def _format_search_results(results: list[dict], query: str) -> str:
    if not results:
        return f'No results found for "{query}"'
    lines = [f'Found {len(results)} results for "{query}":\n']
    for r in results:
        lines.append(f"[{r['kind']}] {r['name']}")
        lines.append(f"  File: {r['file_path']}:{r['start_line']}")
        if r.get("signature"):
            lines.append(f"  Sig: {r['signature'][:120]}")
        if r.get("doc_comment"):
            lines.append(f"  Doc: {r['doc_comment'][:100]}")
        lines.append("")
    return "\n".join(lines)


def _format_file_symbols(file: str, symbols: list[dict]) -> str:
    if not symbols:
        return f"No symbols found in {file}"
    lines = [f"Symbols in {file} ({len(symbols)}):\n"]
    for s in symbols:
        vis = f"[{s['visibility']}] " if s.get("visibility") else ""
        lines.append(f"  L{s['start_line']} {vis}{s['kind']} {s['name']}")
    return "\n".join(lines)


def _format_symbol_list(symbols: list[dict], query: str) -> str:
    if not symbols:
        return f'No symbols matching "{query}"'
    lines = [f'Found {len(symbols)} symbols matching "{query}":\n']
    for s in symbols:
        lines.append(f"[{s['kind']}] {s['name']} — {s['file_path']}:{s['start_line']}")
        if s.get("signature"):
            lines.append(f"  {s['signature'][:120]}")
    return "\n".join(lines)


def _format_modules(modules: list[dict]) -> str:
    if not modules:
        return "No modules indexed yet. Run indexing first."
    lines = [f"Modules ({len(modules)}):\n"]
    for m in modules:
        lines.append(f"\U0001f4e6 {m['name']}")
        lines.append(f"   Path: {m['root_path']}")
        if m.get("language"):
            lines.append(f"   Lang: {m['language']}")
        lines.append(f"   Files: {m['file_count']} | Symbols: {m['symbol_count']}")
        patterns = _format_patterns(m)
        if patterns:
            lines.append(f"   Patterns: {patterns}")
        if m.get("purpose"):
            lines.append(f"   Purpose: {m['purpose']}")
        if m.get("description"):
            lines.append(f"   {m['description']}")
        lines.append("")
    return "\n".join(lines)


def _format_patterns(m: dict) -> str:
    """Format pattern metadata fields into a compact string."""
    parts = []
    if m.get("di_style"):
        parts.append(f"DI={m['di_style']}")
    if m.get("error_handling"):
        parts.append(f"Errors={m['error_handling']}")
    if m.get("naming_convention"):
        parts.append(f"Naming={m['naming_convention']}")
    if m.get("logging_framework"):
        parts.append(f"Logging={m['logging_framework']}")
    if m.get("testing_framework"):
        parts.append(f"Testing={m['testing_framework']}")
    return " | ".join(parts)


def _format_status(status: dict, is_running: bool) -> str:
    state = "\U0001f504 Indexing..." if is_running else "\u2705 Idle"
    lines = [
        "\U0001f4ca Code Intelligence Index Status\n",
        f"State: {state}",
        f"Files: {status['total_files']}",
        f"Symbols: {status['total_symbols']}",
        f"Modules: {status['total_modules']}",
        f"Last indexed: {status['last_indexed'] or 'Never'}",
        "",
        "Languages:",
    ]
    for lang, count in status["languages"].items():
        lines.append(f"  {lang}: {count} files")
    return "\n".join(lines)


def _get_symbol_context(file: str, symbol: str, lines: list[str], ctx: int, ql: QueryLayer) -> str:
    symbols = ql.get_file_symbols(file)
    match = next((s for s in symbols if s["name"] == symbol), None)
    if not match:
        return f'Symbol "{symbol}" not found in {file}'
    start = max(0, match["start_line"] - 1 - ctx)
    end = min(len(lines), match["end_line"] + ctx)
    return _format_lines(lines, start, end, file)


def _format_lines(lines: list[str], start: int, end: int, file: str) -> str:
    numbered = [f"{str(start + i + 1).rjust(4)} | {lines[start + i]}" for i in range(end - start)]
    return f"// {file} [{start + 1}-{end}]\n" + "\n".join(numbered)


# --- KB Export helpers ---

def _extract_project_name(workspace: str) -> str:
    """Extract project name from workspace path."""
    parts = workspace.replace("\\", "/").rstrip("/").split("/")
    return parts[-1] if parts else "unknown"


def _build_kb_payload(m: dict[str, Any], project_name: str) -> dict[str, Any]:
    """Build a single KB payload from module data."""
    content_lines = [
        f"Module: {m['name']}",
        f"Language: {m.get('language') or 'unknown'}",
        f"Purpose: {m.get('purpose') or 'unknown'}",
        f"Files: {m['file_count']}",
        f"Symbols: {m['symbol_count']}",
        "",
        "Patterns:",
        f"  DI Style: {m.get('di_style') or 'unknown'}",
        f"  Error Handling: {m.get('error_handling') or 'unknown'}",
        f"  Naming: {m.get('naming_convention') or 'unknown'}",
        f"  Logging: {m.get('logging_framework') or 'unknown'}",
        f"  Testing: {m.get('testing_framework') or 'unknown'}",
    ]
    lang = m.get("language") or "unknown"
    return {
        "title": f"Code Index — {m['name']}",
        "content": "\n".join(content_lines),
        "tags": f"code-index, {m['name']}, {lang}",
        "project": project_name,
    }


def _format_kb_json(modules: list[dict], project_name: str) -> str:
    """Format modules as JSON KB payloads."""
    import json
    if not modules:
        return "[]"
    payloads = [_build_kb_payload(m, project_name) for m in modules]
    return json.dumps(payloads, indent=2)


def _format_kb_text(modules: list[dict], project_name: str) -> str:
    """Format modules as human-readable text KB payloads."""
    if not modules:
        return "No modules indexed yet. Run indexing first."
    payloads = [_build_kb_payload(m, project_name) for m in modules]
    lines: list[str] = []
    for p in payloads:
        lines.append(f"--- {p['title']} ---")
        lines.append(p["content"])
        lines.append(f"Tags: {p['tags']}")
        lines.append(f"Project: {p['project']}")
        lines.append("")
    return "\n".join(lines)
