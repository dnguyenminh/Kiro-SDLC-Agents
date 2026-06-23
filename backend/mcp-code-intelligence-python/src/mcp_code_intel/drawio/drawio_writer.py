"""Writes updated node positions back to draw.io XML document.

Approach: reposition nodes to grid, REMOVE all manual waypoints and
exit/entry anchors — let draw.io's built-in edge router handle connectors.
"""

import re
import xml.etree.ElementTree as ET
from .drawio_parser import DiagramGraph, DiagramNode


def write_layout(tree: ET.ElementTree, graph: DiagramGraph, file_path: str) -> None:
    """Write layout results back to XML and save to file."""
    root = tree.getroot()
    all_nodes = graph.nodes + graph.containers
    cells = root.findall(".//" + "mxCell")
    _apply_positions(cells, all_nodes)
    _clean_edge_routing(cells)
    tree.write(file_path, encoding="unicode", xml_declaration=True)


def _apply_positions(cells: list, nodes: list) -> None:
    """Update x, y, width, height in mxGeometry elements."""
    node_map = {n.id: n for n in nodes}
    for cell in cells:
        cid = cell.get("id", "")
        node = node_map.get(cid)
        if not node:
            continue
        geom = cell.find("mxGeometry")
        if geom is None or geom.get("as") != "geometry":
            continue
        geom.set("x", _fmt(node.x))
        geom.set("y", _fmt(node.y))
        geom.set("width", _fmt(node.width))
        geom.set("height", _fmt(node.height))


def _clean_edge_routing(cells: list) -> None:
    """Remove manual waypoints and anchor overrides from edges.

    Draw.io's built-in edge router handles routing automatically.
    Manual waypoints and exit/entry anchors often cause ugly results.
    """
    for cell in cells:
        if cell.get("edge") != "1":
            continue
        # Remove manual exit/entry anchor points from style
        style = cell.get("style", "")
        style = re.sub(r"exitX=[^;]*;?", "", style)
        style = re.sub(r"exitY=[^;]*;?", "", style)
        style = re.sub(r"exitDx=[^;]*;?", "", style)
        style = re.sub(r"exitDy=[^;]*;?", "", style)
        style = re.sub(r"entryX=[^;]*;?", "", style)
        style = re.sub(r"entryY=[^;]*;?", "", style)
        style = re.sub(r"entryDx=[^;]*;?", "", style)
        style = re.sub(r"entryDy=[^;]*;?", "", style)
        # Clean trailing semicolons
        style = re.sub(r";+", ";", style).strip(";")
        if style:
            style += ";"
        cell.set("style", style)
        # Remove manual waypoints (Array as="points")
        geom = cell.find("mxGeometry")
        if geom is not None:
            for arr in list(geom.findall("Array")):
                if arr.get("as") == "points":
                    geom.remove(arr)


def _fmt(val: float) -> str:
    """Format number: integer if whole, else 1 decimal."""
    rounded = round(val)
    if rounded == val:
        return str(int(rounded))
    return f"{val:.1f}"
