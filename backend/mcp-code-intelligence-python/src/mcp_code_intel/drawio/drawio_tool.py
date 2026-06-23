"""drawio_auto_layout MCP tool — REVIEW mode: detect overlaps, report issues.

Does NOT modify the file. Returns detailed issue list for AI agent to fix.
AI agent reads report → fixes XML → calls tool again → loop until 0 issues.
"""

import json
import os
from .drawio_parser import parse_drawio, DiagramGraph, DiagramNode

DRAWIO_TOOL_DEFINITION = {
    "name": "drawio_auto_layout",
    "description": "Auto-layout draw.io diagrams using graph algorithms. "
    "Reads .drawio file, computes optimal node positions, writes back. "
    "Preserves all styles/labels.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "file_path": {"type": "string",
                "description": "Path to .drawio file (absolute or relative)"},
            "algorithm": {"type": "string",
                "description": "layered|force|mrtree|radial (default: layered)"},
            "spacing": {"type": "number",
                "description": "Node spacing in pixels (default: 80)"},
            "direction": {"type": "string",
                "description": "DOWN|RIGHT|LEFT|UP (default: DOWN)"},
            "export_png": {"type": "boolean",
                "description": "Export PNG after layout (default: false)"},
            "force": {"type": "boolean",
                "description": "Force re-layout even if no overlaps (default: false)"},
        },
        "required": ["file_path"],
    },
}


def handle_drawio_layout(args: dict, workspace: str) -> str:
    """MCP tool handler — detect and report diagram issues."""
    raw_path = args.get("file_path")
    if not raw_path:
        return _error("file_path is required")

    file_path = raw_path if os.path.isabs(raw_path) else os.path.join(workspace, raw_path)
    if not os.path.exists(file_path):
        return _error(f"File not found: {file_path}")
    if not file_path.endswith(".drawio"):
        return _error(f"Not a .drawio file: {os.path.basename(file_path)}")

    try:
        tree, graph = parse_drawio(file_path)
        node_count = len(graph.nodes) + len(graph.containers)
        if node_count == 0:
            return _error("No nodes found in diagram")

        issues = _detect_all_issues(graph)

        if not issues:
            return json.dumps({
                "status": "already_good",
                "message": "Diagram looks good — no overlapping nodes or edge crossings detected.",
                "nodes": node_count,
                "edges": len(graph.edges),
                "issues": [],
            })

        return json.dumps({
            "status": "needs_fix",
            "message": f"Found {len(issues)} issues. Fix the drawio XML and call this tool again to verify.",
            "nodes": node_count,
            "edges": len(graph.edges),
            "issues": issues,
        })
    except Exception as e:
        return _error(f"Analysis failed: {e}")


def _detect_all_issues(graph: DiagramGraph) -> list:
    """Detect node overlaps + edge crossings + diagonal edges."""
    issues = []
    issues.extend(_detect_node_overlaps(graph))
    issues.extend(_detect_edge_crossings(graph))
    issues.extend(_detect_diagonal_edges(graph))
    return issues


def _detect_node_overlaps(graph: DiagramGraph) -> list:
    """Detect sibling nodes overlapping (>50% area)."""
    issues = []
    nodes = graph.nodes
    for i in range(len(nodes)):
        for j in range(i + 1, len(nodes)):
            a, b = nodes[i], nodes[j]
            if a.parent_id != b.parent_id:
                continue
            overlap = _overlap_area(a, b)
            if overlap > 0.50:
                issues.append({
                    "type": "node_overlap",
                    "severity": "high",
                    "node_a": {"id": a.id, "x": a.x, "y": a.y, "w": a.width, "h": a.height},
                    "node_b": {"id": b.id, "x": b.x, "y": b.y, "w": b.width, "h": b.height},
                    "overlap_pct": round(overlap * 100),
                    "fix_hint": f"Move node '{b.id}' away from '{a.id}'. Suggest: x={a.x + a.width + 40:.0f} or y={a.y + a.height + 40:.0f}",
                })
    return issues


def _detect_edge_crossings(graph: DiagramGraph) -> list:
    """Detect connectors that cross through shapes."""
    issues = []
    nodes = graph.nodes + graph.containers
    node_map = {n.id: n for n in nodes}
    for edge in graph.edges:
        src = node_map.get(edge.source_id)
        tgt = node_map.get(edge.target_id)
        if not src or not tgt:
            continue
        sx = src.x + src.width / 2
        sy = src.y + src.height / 2
        tx = tgt.x + tgt.width / 2
        ty = tgt.y + tgt.height / 2
        for node in graph.nodes:
            if node.id in (edge.source_id, edge.target_id):
                continue
            if node.is_container:
                continue
            if _line_crosses_rect(sx, sy, tx, ty, node):
                issues.append({
                    "type": "edge_crossing",
                    "severity": "medium",
                    "edge_id": edge.id,
                    "edge_source": edge.source_id,
                    "edge_target": edge.target_id,
                    "crosses_node": {"id": node.id, "x": node.x, "y": node.y, "w": node.width, "h": node.height},
                    "fix_hint": f"Edge '{edge.id}' ({edge.source_id}→{edge.target_id}) crosses node '{node.id}'. "
                                f"Move '{node.id}' out of the path, or rearrange source/target positions.",
                })
                break  # one issue per edge
    return issues


def _overlap_area(a: DiagramNode, b: DiagramNode) -> float:
    """Compute overlap ratio (0-1) relative to smaller shape."""
    ox = max(0.0, min(a.x + a.width, b.x + b.width) - max(a.x, b.x))
    oy = max(0.0, min(a.y + a.height, b.y + b.height) - max(a.y, b.y))
    area = ox * oy
    if area <= 0:
        return 0.0
    smaller = min(a.width * a.height, b.width * b.height)
    return area / smaller if smaller > 0 else 0.0


def _line_crosses_rect(x1, y1, x2, y2, node: DiagramNode) -> bool:
    """Check if line segment crosses node bounding box."""
    margin = 5.0
    left = node.x - margin
    right = node.x + node.width + margin
    top = node.y - margin
    bottom = node.y + node.height + margin
    if max(x1, x2) < left or min(x1, x2) > right:
        return False
    if max(y1, y2) < top or min(y1, y2) > bottom:
        return False
    code1 = _out_code(x1, y1, left, top, right, bottom)
    code2 = _out_code(x2, y2, left, top, right, bottom)
    if code1 & code2 != 0:
        return False
    if code1 == 0 or code2 == 0:
        return False
    return True


def _out_code(x, y, left, top, right, bottom) -> int:
    """Cohen-Sutherland outcode."""
    code = 0
    if x < left: code |= 1
    if x > right: code |= 2
    if y < top: code |= 4
    if y > bottom: code |= 8
    return code


def _error(msg: str) -> str:
    return json.dumps({"error": msg})


def _detect_diagonal_edges(graph: DiagramGraph) -> list:
    """Detect edges that are diagonal (not aligned horizontally or vertically).

    Professional diagrams use orthogonal connectors (0°, 90°, 180°, 270°).
    Diagonal edges look unprofessional — nodes should be aligned so edges go straight.
    """
    issues = []
    node_map = {n.id: n for n in graph.nodes + graph.containers}
    tolerance = 20.0  # px — allow slight misalignment

    for edge in graph.edges:
        src = node_map.get(edge.source_id)
        tgt = node_map.get(edge.target_id)
        if not src or not tgt:
            continue
        # Check if centers are aligned horizontally or vertically
        src_cx = src.x + src.width / 2
        src_cy = src.y + src.height / 2
        tgt_cx = tgt.x + tgt.width / 2
        tgt_cy = tgt.y + tgt.height / 2
        dx = abs(src_cx - tgt_cx)
        dy = abs(src_cy - tgt_cy)
        # Edge is orthogonal if nodes share roughly same x OR same y
        is_horizontal = dy <= tolerance
        is_vertical = dx <= tolerance
        if not is_horizontal and not is_vertical:
            # Suggest alignment
            if dx < dy:
                fix = f"Align horizontally: set '{edge.target_id}' x={src.x:.0f} (same column as '{edge.source_id}')"
            else:
                fix = f"Align vertically: set '{edge.target_id}' y={src.y:.0f} (same row as '{edge.source_id}')"
            issues.append({
                "type": "diagonal_edge",
                "severity": "low",
                "edge_id": edge.id,
                "edge_source": edge.source_id,
                "edge_target": edge.target_id,
                "source_center": {"x": round(src_cx), "y": round(src_cy)},
                "target_center": {"x": round(tgt_cx), "y": round(tgt_cy)},
                "fix_hint": fix,
            })
    return issues
