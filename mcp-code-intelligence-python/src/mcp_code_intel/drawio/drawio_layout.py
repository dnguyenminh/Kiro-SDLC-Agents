"""Layout algorithms for draw.io diagrams — layered, force-directed, tree, radial."""

import math
from collections import deque
from .drawio_parser import DiagramGraph, DiagramNode, DiagramEdge


def apply_layout(graph: DiagramGraph, algorithm: str, spacing: float, direction: str) -> None:
    """Apply layout algorithm to graph, updating node positions in-place."""
    nodes = graph.nodes
    if not nodes:
        return
    dispatch = {
        "layered": _layered_layout,
        "force": _force_directed_layout,
        "mrtree": _tree_layout,
        "radial": _radial_layout,
    }
    fn = dispatch.get(algorithm, _layered_layout)
    fn(graph, spacing, direction)
    _resize_containers(graph, spacing)


def _layered_layout(graph: DiagramGraph, spacing: float, direction: str) -> None:
    """Sugiyama-style layered layout with topological sort."""
    layers = _assign_layers(graph.nodes, graph.edges)
    _position_layers(graph.nodes, layers, spacing, direction)


def _assign_layers(nodes: list, edges: list) -> dict:
    """Assign layer indices via topological sort (Kahn's algorithm)."""
    adj = {n.id: [] for n in nodes}
    in_deg = {n.id: 0 for n in nodes}
    for e in edges:
        if e.source_id in adj and e.target_id in adj:
            adj[e.source_id].append(e.target_id)
            in_deg[e.target_id] = in_deg.get(e.target_id, 0) + 1
    layers = {}
    queue = deque(nid for nid, deg in in_deg.items() if deg == 0)
    for nid in queue:
        layers[nid] = 0
    while queue:
        cur = queue.popleft()
        cur_layer = layers[cur]
        for nxt in adj.get(cur, []):
            new_layer = cur_layer + 1
            if layers.get(nxt, -1) < new_layer:
                layers[nxt] = new_layer
            in_deg[nxt] -= 1
            if in_deg[nxt] == 0:
                queue.append(nxt)
    # Assign unvisited nodes (cycles) to layer 0
    for n in nodes:
        if n.id not in layers:
            layers[n.id] = 0
    return layers


def _position_layers(nodes: list, layers: dict, spacing: float, direction: str) -> None:
    """Position nodes in their assigned layers."""
    grouped = {}
    for n in nodes:
        layer = layers.get(n.id, 0)
        grouped.setdefault(layer, []).append(n)
    layer_spacing = spacing * 2
    for layer, layer_nodes in grouped.items():
        for idx, node in enumerate(layer_nodes):
            primary = layer * layer_spacing
            secondary = idx * (node.width + spacing)
            if direction == "DOWN":
                node.x, node.y = secondary, primary
            elif direction == "RIGHT":
                node.x, node.y = primary, secondary
            elif direction == "UP":
                node.x, node.y = secondary, -primary
            elif direction == "LEFT":
                node.x, node.y = -primary, secondary


def _force_directed_layout(graph: DiagramGraph, spacing: float, _dir: str) -> None:
    """Force-directed layout with repulsion and attraction forces."""
    nodes = graph.nodes
    repulsion = spacing * spacing * 10
    attraction = 0.01
    # Initialize grid positions if all at origin
    if all(n.x == 0 and n.y == 0 for n in nodes):
        cols = max(1, math.ceil(math.sqrt(len(nodes))))
        for i, n in enumerate(nodes):
            n.x = (i % cols) * spacing * 2
            n.y = (i // cols) * spacing * 2
    for iteration in range(100):
        damping = 1.0 - iteration / 100 * 0.8
        _apply_forces(nodes, graph.edges, repulsion, attraction, damping)


def _apply_forces(nodes: list, edges: list, repulsion: float, attraction: float, damping: float) -> None:
    """Compute and apply repulsion/attraction forces."""
    n = len(nodes)
    dx = [0.0] * n
    dy = [0.0] * n
    node_idx = {node.id: i for i, node in enumerate(nodes)}
    # Repulsion between all pairs
    for i in range(n):
        for j in range(i + 1, n):
            diff_x = nodes[i].x - nodes[j].x
            diff_y = nodes[i].y - nodes[j].y
            dist = max(1.0, math.sqrt(diff_x * diff_x + diff_y * diff_y))
            force = repulsion / (dist * dist)
            fx = force * diff_x / dist
            fy = force * diff_y / dist
            dx[i] += fx; dy[i] += fy
            dx[j] -= fx; dy[j] -= fy
    # Attraction along edges
    for e in edges:
        si = node_idx.get(e.source_id)
        ti = node_idx.get(e.target_id)
        if si is None or ti is None:
            continue
        diff_x = nodes[ti].x - nodes[si].x
        diff_y = nodes[ti].y - nodes[si].y
        fx = attraction * diff_x
        fy = attraction * diff_y
        dx[si] += fx; dy[si] += fy
        dx[ti] -= fx; dy[ti] -= fy
    for i, node in enumerate(nodes):
        node.x += dx[i] * damping
        node.y += dy[i] * damping


def _tree_layout(graph: DiagramGraph, spacing: float, direction: str) -> None:
    """Tree layout — special case of layered."""
    _layered_layout(graph, spacing, direction)


def _radial_layout(graph: DiagramGraph, spacing: float, _dir: str) -> None:
    """Radial layout — center node with rings."""
    nodes = graph.nodes
    if not nodes:
        return
    nodes[0].x = 0.0
    nodes[0].y = 0.0
    remaining = nodes[1:]
    ring_size = 8
    for ring_idx, start in enumerate(range(0, len(remaining), ring_size)):
        ring = remaining[start:start + ring_size]
        radius = (ring_idx + 1) * spacing * 2.5
        for i, node in enumerate(ring):
            angle = 2 * math.pi * i / len(ring)
            node.x = radius * math.cos(angle)
            node.y = radius * math.sin(angle)


def _resize_containers(graph: DiagramGraph, spacing: float) -> None:
    """Resize containers to fit children, convert children to relative coords."""
    for container in graph.containers:
        children = [n for n in graph.nodes if n.parent_id == container.id]
        if not children:
            continue
        min_x = min(c.x for c in children) - spacing
        min_y = min(c.y for c in children) - spacing
        max_x = max(c.x + c.width for c in children) + spacing
        max_y = max(c.y + c.height for c in children) + spacing
        container.x = min_x
        container.y = min_y
        container.width = max_x - min_x
        container.height = max_y - min_y
        for child in children:
            child.x -= min_x
            child.y -= min_y
