"""Orthogonal edge routing — computes waypoints so connectors avoid shapes."""

import math
from .drawio_parser import DiagramGraph, DiagramNode


class Waypoint:
    """A waypoint (bend point) in an edge route."""
    __slots__ = ("x", "y")

    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y


def route_edges(graph: DiagramGraph) -> dict:
    """Route all edges, returning {edge_id: [Waypoint, ...]} for edges needing waypoints."""
    all_nodes = graph.nodes + graph.containers
    node_map = {n.id: n for n in all_nodes}
    routes = {}
    for edge in graph.edges:
        src = node_map.get(edge.source_id)
        tgt = node_map.get(edge.target_id)
        if not src or not tgt:
            continue
        obstacles = [n for n in all_nodes if n.id != src.id and n.id != tgt.id]
        waypoints = _compute_route(src, tgt, obstacles)
        if waypoints:
            routes[edge.id] = waypoints
    return routes


def _compute_route(src: DiagramNode, tgt: DiagramNode, obstacles: list) -> list:
    """Compute waypoints for a single edge to avoid obstacles."""
    src_port = _exit_port(src, tgt)
    tgt_port = _entry_port(src, tgt)
    crossed = [o for o in obstacles if _line_intersects_rect(src_port, tgt_port, o)]
    if not crossed:
        return []
    return _orthogonal_route(src_port, tgt_port, crossed)


def _orthogonal_route(start: Waypoint, end: Waypoint, obstacles: list) -> list:
    """Compute orthogonal (right-angle) route around obstacles."""
    # Try L-shape: horizontal first
    mid_l = Waypoint(end.x, start.y)
    if not _any_intersection(start, mid_l, obstacles) and not _any_intersection(mid_l, end, obstacles):
        return [mid_l]
    # Try L-shape: vertical first
    mid_l2 = Waypoint(start.x, end.y)
    if not _any_intersection(start, mid_l2, obstacles) and not _any_intersection(mid_l2, end, obstacles):
        return [mid_l2]
    # Z-shape: go around the first obstacle
    dx = end.x - start.x
    dy = end.y - start.y
    offset = 30.0
    obs = obstacles[0]
    if abs(dx) > abs(dy):
        bypass_y = (obs.y - offset) if start.y < obs.y else (obs.y + obs.height + offset)
        return [
            Waypoint(start.x + dx * 0.3, start.y),
            Waypoint(start.x + dx * 0.3, bypass_y),
            Waypoint(end.x - dx * 0.1, bypass_y),
        ]
    else:
        bypass_x = (obs.x - offset) if start.x < obs.x else (obs.x + obs.width + offset)
        return [
            Waypoint(start.x, start.y + dy * 0.3),
            Waypoint(bypass_x, start.y + dy * 0.3),
            Waypoint(bypass_x, end.y - dy * 0.1),
        ]


def _any_intersection(a: Waypoint, b: Waypoint, obstacles: list) -> bool:
    """Check if line segment a→b intersects any obstacle."""
    return any(_line_intersects_rect(a, b, o) for o in obstacles)


def _line_intersects_rect(a: Waypoint, b: Waypoint, node: DiagramNode) -> bool:
    """Check if line segment intersects node bounding box (with margin)."""
    margin = 5.0
    left = node.x - margin
    right = node.x + node.width + margin
    top = node.y - margin
    bottom = node.y + node.height + margin
    # Quick AABB check
    min_x, max_x = min(a.x, b.x), max(a.x, b.x)
    min_y, max_y = min(a.y, b.y), max(a.y, b.y)
    if max_x < left or min_x > right or max_y < top or min_y > bottom:
        return False
    # Cohen-Sutherland simplified
    code1 = _out_code(a.x, a.y, left, top, right, bottom)
    code2 = _out_code(b.x, b.y, left, top, right, bottom)
    if code1 == 0 or code2 == 0:
        return True
    if code1 & code2 != 0:
        return False
    return True


def _out_code(x: float, y: float, l: float, t: float, r: float, b: float) -> int:
    """Cohen-Sutherland outcode."""
    code = 0
    if x < l: code |= 1
    if x > r: code |= 2
    if y < t: code |= 4
    if y > b: code |= 8
    return code


def _exit_port(src: DiagramNode, tgt: DiagramNode) -> Waypoint:
    """Compute exit point on source node facing target."""
    dx = (tgt.x + tgt.width / 2) - (src.x + src.width / 2)
    dy = (tgt.y + tgt.height / 2) - (src.y + src.height / 2)
    if abs(dx) > abs(dy):
        if dx > 0:
            return Waypoint(src.x + src.width, src.y + src.height / 2)
        return Waypoint(src.x, src.y + src.height / 2)
    if dy > 0:
        return Waypoint(src.x + src.width / 2, src.y + src.height)
    return Waypoint(src.x + src.width / 2, src.y)


def _entry_port(src: DiagramNode, tgt: DiagramNode) -> Waypoint:
    """Compute entry point on target node facing source."""
    dx = (src.x + src.width / 2) - (tgt.x + tgt.width / 2)
    dy = (src.y + src.height / 2) - (tgt.y + tgt.height / 2)
    if abs(dx) > abs(dy):
        if dx > 0:
            return Waypoint(tgt.x + tgt.width, tgt.y + tgt.height / 2)
        return Waypoint(tgt.x, tgt.y + tgt.height / 2)
    if dy > 0:
        return Waypoint(tgt.x + tgt.width / 2, tgt.y + tgt.height)
    return Waypoint(tgt.x + tgt.width / 2, tgt.y)
