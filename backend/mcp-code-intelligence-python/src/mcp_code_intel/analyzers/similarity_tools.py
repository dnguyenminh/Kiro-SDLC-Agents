"""MCP tool handlers for similarity analysis (duplicates, dead code, git mining)."""

from __future__ import annotations

import json
import sqlite3
import sys
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from ..memory.embedding.service import EmbeddingService

from .similarity.duplicate_detector import DuplicateDetector
from .similarity.dead_code_detector import DeadCodeDetector
from ..git.git_miner import GitMiner


# --- Tool Definitions ---

SIMILARITY_TOOL_DEFINITIONS = [
    {
        "name": "find_duplicates",
        "description": "Find near-duplicate functions using embedding similarity. Groups duplicates into clusters and suggests refactoring strategies.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "file": {
                    "type": "string",
                    "description": "Optional file path to scan (scans all indexed files if omitted)",
                },
                "min_similarity": {
                    "type": "number",
                    "description": "Minimum cosine similarity threshold (0.0-1.0, default 0.85)",
                },
                "min_lines": {
                    "type": "number",
                    "description": "Minimum function line count to consider (default 5)",
                },
            },
        },
    },
    {
        "name": "find_dead_code",
        "description": "Detect potentially dead/unreachable code using call graph reachability analysis and confidence scoring.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "file": {
                    "type": "string",
                    "description": "Optional file path to scan (scans all indexed files if omitted)",
                },
                "min_confidence": {
                    "type": "number",
                    "description": "Minimum confidence threshold 0-100 (default 60)",
                },
            },
        },
    },
    {
        "name": "git_search",
        "description": "Semantic search over git commit history. Find commits by natural language query with optional filters.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Natural language search query (e.g., 'authentication refactoring', 'fix memory leak')",
                },
                "limit": {
                    "type": "number",
                    "description": "Max results (default 10)",
                },
                "author": {
                    "type": "string",
                    "description": "Filter by author name (substring match)",
                },
                "file": {
                    "type": "string",
                    "description": "Filter by file path (substring match)",
                },
                "since": {
                    "type": "string",
                    "description": "Filter commits after this date (ISO 8601)",
                },
                "until": {
                    "type": "string",
                    "description": "Filter commits before this date (ISO 8601)",
                },
                "index": {
                    "type": "boolean",
                    "description": "If true, (re-)index git history before searching",
                },
                "force_reindex": {
                    "type": "boolean",
                    "description": "If true, force full re-index (not incremental)",
                },
            },
            "required": ["query"],
        },
    },
]


# --- Tool Handlers ---

def handle_find_duplicates(
    params: dict[str, Any],
    db_conn: sqlite3.Connection,
) -> str:
    """Handle find_duplicates tool invocation."""
    file_path = params.get("file")
    min_similarity = params.get("min_similarity", 0.85)
    min_lines = params.get("min_lines", 5)

    detector = DuplicateDetector(
        db_conn=db_conn,
        min_similarity=min_similarity,
        min_lines=min_lines,
    )

    report = detector.detect(file_path=file_path)
    return _format_duplicate_report(report)


def handle_find_dead_code(
    params: dict[str, Any],
    db_conn: sqlite3.Connection,
    workspace: str,
) -> str:
    """Handle find_dead_code tool invocation."""
    file_path = params.get("file")
    min_confidence = params.get("min_confidence", 60)

    detector = DeadCodeDetector(
        db_conn=db_conn,
        workspace=workspace,
        min_confidence=min_confidence,
    )

    report = detector.detect(file_path=file_path)
    return _format_dead_code_report(report)


def handle_git_search(
    params: dict[str, Any],
    db_conn: sqlite3.Connection,
    workspace: str,
    embedding_service: "EmbeddingService | None",
) -> str:
    """Handle git_search tool invocation."""
    if not embedding_service or not embedding_service.is_available():
        return "Error: Embedding service not available. Git search requires embeddings."

    query = params.get("query", "")
    if not query:
        return "Error: 'query' parameter is required."

    miner = GitMiner(
        db_conn=db_conn,
        repo_path=workspace,
        embedding_service=embedding_service,
    )

    # Index if requested
    should_index = params.get("index", False)
    force_reindex = params.get("force_reindex", False)

    if should_index or force_reindex:
        summary = miner.index_history(force=force_reindex)
        index_msg = f"Indexed {summary.commits_indexed} commits (total: {summary.total_commits})\n\n"
    else:
        # Auto-index if no commits indexed yet
        status = miner.get_status()
        if status["total_commits"] == 0:
            summary = miner.index_history(force=False)
            index_msg = f"Auto-indexed {summary.commits_indexed} commits\n\n"
        else:
            index_msg = ""

    # Search
    results = miner.search(
        query=query,
        limit=params.get("limit", 10),
        author=params.get("author"),
        file_filter=params.get("file"),
        since=params.get("since"),
        until=params.get("until"),
    )

    return index_msg + _format_git_results(results, query)


# --- Formatters ---

def _format_duplicate_report(report) -> str:
    """Format DuplicateReport as readable text."""
    lines = [
        f"Duplicate Detection Report",
        f"{'=' * 40}",
        f"Functions scanned: {report.total_functions_scanned}",
        f"Similar pairs found: {len(report.pairs)}",
        f"Clusters: {len(report.clusters)}",
        "",
    ]

    if not report.clusters:
        lines.append("No duplicates found above threshold.")
        return "\n".join(lines)

    lines.append("Duplicate Clusters:")
    lines.append("-" * 30)

    for i, cluster in enumerate(report.clusters, 1):
        lines.append(f"\nCluster {i} ({len(cluster.members)} members):")
        for member in cluster.members:
            lines.append(f"  - {member}")

    if report.suggestions:
        lines.append("\n\nRefactoring Suggestions:")
        lines.append("-" * 30)
        for suggestion in report.suggestions:
            lines.append(f"\n[{suggestion.suggestion_type}] {suggestion.description}")
            lines.append(f"  Estimated lines saved: ~{suggestion.estimated_lines_saved}")
            lines.append(f"  Members: {', '.join(suggestion.members[:5])}")

    return "\n".join(lines)


def _format_dead_code_report(report) -> str:
    """Format DeadCodeReport as readable text."""
    lines = [
        f"Dead Code Detection Report",
        f"{'=' * 40}",
        f"{report.summary}",
        "",
    ]

    if not report.candidates:
        lines.append("No dead code candidates found above confidence threshold.")
        return "\n".join(lines)

    lines.append(f"Candidates ({len(report.candidates)}):")
    lines.append("-" * 30)

    for candidate in report.candidates:
        lines.append(
            f"\n[{candidate.confidence}%] {candidate.name}"
            f"  ({candidate.file_path}:{candidate.start_line}-{candidate.end_line})"
        )
        lines.append(f"  Reasons: {', '.join(candidate.reasons)}")

    return "\n".join(lines)


def _format_git_results(results: list, query: str) -> str:
    """Format git search results as readable text."""
    if not results:
        return f'No commits found matching "{query}"'

    lines = [
        f'Git History Search: "{query}"',
        f"Found {len(results)} relevant commits:",
        "",
    ]

    for r in results:
        lines.append(f"[{r.relevance:.2f}] {r.hash[:8]} -- {r.message}")
        lines.append(f"  Author: {r.author} | Date: {r.date[:10]}")
        if r.files_changed:
            files_str = ", ".join(r.files_changed[:5])
            if len(r.files_changed) > 5:
                files_str += f" (+{len(r.files_changed) - 5} more)"
            lines.append(f"  Files: {files_str}")
        lines.append(f"  Changes: +{r.insertions} -{r.deletions}")
        lines.append("")

    return "\n".join(lines)


def _log(msg: str) -> None:
    print(f"[similarity-tools] {msg}", file=sys.stderr, flush=True)
