"""Parses draw.io XML into graph nodes and edges for layout processing."""

import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class DiagramNode:
    """Represents a node (shape) in the diagram."""
    id: str
    parent_id: str
    x: float
    y: float
    width: float
    height: float
    style: str
    is_container: bool = False


@dataclass
class DiagramEdge:
    """Represents an edge (connector) between nodes."""
    id: str
    source_id: str
    target_id: str
    style: str


@dataclass
class DiagramGraph:
    """Parsed diagram graph ready for layout."""
    nodes: list = field(default_factory=list)
    edges: list = field(default_factory=list)
    containers: list = field(default_factory=list)


def parse_drawio(file_path: str) -> tuple:
    """Parse .drawio XML file into (ElementTree, DiagramGraph)."""
    tree = ET.parse(file_path)
    root = tree.getroot()
    model = _find_mx_graph_model(root)
    graph = _extract_graph(model)
    return tree, graph


def _find_mx_graph_model(root: ET.Element) -> ET.Element:
    """Handle mxfile > diagram > mxGraphModel wrapper + standalone."""
    if root.tag == "mxfile":
        diagram = root.find("diagram")
        if diagram is not None:
            model = diagram.find("mxGraphModel")
            if model is not None:
                return model
    if root.tag == "mxGraphModel":
        return root
    model = root.find(".//mxGraphModel")
    return model if model is not None else root


def _extract_graph(model: ET.Element) -> DiagramGraph:
    """Extract nodes and edges from mxCell elements."""
    cells = model.findall(".//mxCell")
    graph = DiagramGraph()

    for cell in cells:
        cid = cell.get("id", "")
        style = cell.get("style", "")
        parent = cell.get("parent", "1")

        if cell.get("edge") == "1":
            src = cell.get("source")
            tgt = cell.get("target")
            if src and tgt:
                graph.edges.append(DiagramEdge(cid, src, tgt, style))
        elif cid not in ("0", "1"):
            geom = _get_geometry(cell)
            if geom is None:
                continue
            x, y, w, h = geom
            is_cont = _has_child_nodes(cid, cells) or _is_container_style(style, w, h)
            node = DiagramNode(cid, parent, x, y, w, h, style, is_cont)
            if is_cont:
                graph.containers.append(node)
            else:
                graph.nodes.append(node)
    return graph


def _get_geometry(cell: ET.Element) -> Optional[tuple]:
    """Extract x, y, width, height from mxGeometry child."""
    geom = cell.find("mxGeometry")
    if geom is None or geom.get("as") != "geometry":
        return None
    x = float(geom.get("x", "0"))
    y = float(geom.get("y", "0"))
    w = float(geom.get("width", "80"))
    h = float(geom.get("height", "40"))
    return x, y, w, h


def _has_child_nodes(node_id: str, cells: list) -> bool:
    """Check if any cell has this node as parent (making it a container)."""
    for c in cells:
        if c.get("parent") == node_id and c.get("edge") != "1":
            if c.find("mxGeometry") is not None:
                return True
    return False


def _is_container_style(style: str, width: float, height: float) -> bool:
    """Detect containers by style keywords or large dashed rectangles."""
    s = style.lower()
    if "swimlane" in s:
        return True
    if "fillcolor=none" in s and "dashed=1" in s:
        return True
    if "shape=rectangle" in s and "dashed=1" in s and width > 300 and height > 300:
        return True
    return False
