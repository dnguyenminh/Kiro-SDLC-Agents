/** Parses draw.io XML into graph nodes and edges for layout processing. */
package com.codeintel.tools.drawio

import javax.xml.parsers.DocumentBuilderFactory
import org.w3c.dom.Document
import org.w3c.dom.Element
import org.w3c.dom.NodeList
import java.io.File

/** Represents a node (shape) in the diagram. */
data class DiagramNode(
    val id: String,
    val parentId: String,
    var x: Double,
    var y: Double,
    var width: Double,
    var height: Double,
    val style: String,
    val isContainer: Boolean = false
)

/** Represents an edge (connector) between nodes. */
data class DiagramEdge(
    val id: String,
    val sourceId: String,
    val targetId: String,
    val style: String
)

/** Parsed diagram graph ready for layout. */
data class DiagramGraph(
    val nodes: MutableList<DiagramNode>,
    val edges: MutableList<DiagramEdge>,
    val containers: MutableList<DiagramNode>
)

/** Parses .drawio XML file into DiagramGraph. Handles mxfile wrapper. */
object DrawioParser {

    fun parse(file: File): Pair<Document, DiagramGraph> {
        val doc = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(file)
        doc.documentElement.normalize()
        val root = findMxGraphModel(doc)
        val cells = root.getElementsByTagName("mxCell")
        return Pair(doc, extractGraph(cells))
    }

    private fun findMxGraphModel(doc: Document): Element {
        val mxFiles = doc.getElementsByTagName("mxfile")
        if (mxFiles.length > 0) {
            val diagrams = (mxFiles.item(0) as Element).getElementsByTagName("diagram")
            if (diagrams.length > 0) {
                val models = (diagrams.item(0) as Element).getElementsByTagName("mxGraphModel")
                if (models.length > 0) return models.item(0) as Element
            }
        }
        val models = doc.getElementsByTagName("mxGraphModel")
        if (models.length > 0) return models.item(0) as Element
        return doc.documentElement
    }

    private fun extractGraph(cells: NodeList): DiagramGraph {
        val nodes = mutableListOf<DiagramNode>()
        val edges = mutableListOf<DiagramEdge>()
        val containers = mutableListOf<DiagramNode>()

        for (i in 0 until cells.length) {
            val cell = cells.item(i) as Element
            val id = cell.getAttribute("id")
            val style = cell.getAttribute("style") ?: ""
            val parent = cell.getAttribute("parent") ?: "1"

            if (cell.getAttribute("edge") == "1") {
                val src = cell.getAttribute("source") ?: continue
                val tgt = cell.getAttribute("target") ?: continue
                edges.add(DiagramEdge(id, src, tgt, style))
            } else if (hasGeometry(cell) && id != "0" && id != "1") {
                val geom = getGeometry(cell) ?: continue
                val node = DiagramNode(
                    id = id, parentId = parent,
                    x = geom.x, y = geom.y,
                    width = geom.w, height = geom.h,
                    style = style,
                    isContainer = hasChildNodes(id, cells) || isContainerByStyle(style, geom.w, geom.h)
                )
                if (node.isContainer) containers.add(node) else nodes.add(node)
            }
        }
        return DiagramGraph(nodes, edges, containers)
    }

    private fun hasGeometry(cell: Element): Boolean {
        val children = cell.getElementsByTagName("mxGeometry")
        return children.length > 0
    }

    private data class Geom(val x: Double, val y: Double, val w: Double, val h: Double)

    private fun getGeometry(cell: Element): Geom? {
        val geoms = cell.getElementsByTagName("mxGeometry")
        if (geoms.length == 0) return null
        val g = geoms.item(0) as Element
        if (g.getAttribute("as") != "geometry") return null
        return Geom(
            x = g.getAttribute("x").toDoubleOrNull() ?: 0.0,
            y = g.getAttribute("y").toDoubleOrNull() ?: 0.0,
            w = g.getAttribute("width").toDoubleOrNull() ?: 80.0,
            h = g.getAttribute("height").toDoubleOrNull() ?: 40.0
        )
    }

    private fun hasChildNodes(id: String, cells: NodeList): Boolean {
        for (i in 0 until cells.length) {
            val c = cells.item(i) as Element
            if (c.getAttribute("parent") == id && c.getAttribute("edge") != "1" && hasGeometry(c)) {
                return true
            }
        }
        return false
    }

    /** Detect containers by style keywords or large size (system boundaries, swimlanes). */
    private fun isContainerByStyle(style: String, width: Double, height: Double): Boolean {
        val s = style.lowercase()
        if (s.contains("swimlane")) return true
        if (s.contains("fillcolor=none") && s.contains("dashed=1")) return true
        if (s.contains("shape=rectangle") && s.contains("dashed=1") && width > 300 && height > 300) return true
        return false
    }
}
