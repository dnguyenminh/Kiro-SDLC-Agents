"""Dependency Formatters — tree/flat/graph output formats. KSA-179."""

from __future__ import annotations

import posixpath

from .models import DependencyNode, DependencyResult


def format_dependency_result(result: DependencyResult, fmt: str = "tree") -> dict:
    """Format a DependencyResult into the requested output format."""
    if fmt == "flat":
        return to_flat_format(result)
    if fmt == "graph":
        return to_graph_format(result)
    return to_tree_format(result)


def to_tree_format(result: DependencyResult) -> dict:
    """Build a tree representation of the dependency result."""
    by_depth: dict[int, list[DependencyNode]] = {}
    for node in result.results:
        by_depth.setdefault(node.depth, []).append(node)

    tree = {
        "file": result.root,
        "label": posixpath.basename(result.root),
        "depth": 0,
        "importedSymbols": [],
        "isExternal": False,
        "children": _build_children(by_depth, 1),
    }
    return {
        "root": result.root,
        "tree": tree,
        "cycles": result.cycles,
        "metadata": _metadata_dict(result),
    }


def to_flat_format(result: DependencyResult) -> dict:
    """Build a flat list representation."""
    return {
        "root": result.root,
        "direction": result.direction,
        "dependencies": [
            {
                "file": r.file,
                "depth": r.depth,
                "importedSymbols": r.imported_symbols,
                "isExternal": r.is_external,
            }
            for r in result.results
        ],
        "cycles": result.cycles,
        "metadata": _metadata_dict(result),
    }


def to_graph_format(result: DependencyResult) -> dict:
    """Build a nodes+edges graph representation."""
    nodes = [
        {"id": result.root, "label": posixpath.basename(result.root), "depth": 0, "isExternal": False},
        *[
            {"id": r.file, "label": posixpath.basename(r.file), "depth": r.depth, "isExternal": r.is_external}
            for r in result.results
        ],
    ]
    edges = [
        {"from": result.root, "to": r.file, "symbols": r.imported_symbols}
        for r in result.results
        if r.depth == 1
    ]
    return {"nodes": nodes, "edges": edges, "cycles": result.cycles, "metadata": _metadata_dict(result)}


def _build_children(by_depth: dict[int, list[DependencyNode]], depth: int) -> list[dict]:
    nodes = by_depth.get(depth, [])
    return [
        {
            "file": n.file,
            "label": posixpath.basename(n.file),
            "depth": n.depth,
            "importedSymbols": n.imported_symbols,
            "isExternal": n.is_external,
            "children": _build_children(by_depth, depth + 1),
        }
        for n in nodes
    ]


def _metadata_dict(result: DependencyResult) -> dict:
    m = result.metadata
    return {
        "totalNodes": m.total_nodes,
        "maxDepthReached": m.max_depth_reached,
        "truncated": m.truncated,
        "queryTimeMs": m.query_time_ms,
        "externalCount": m.external_count,
    }
