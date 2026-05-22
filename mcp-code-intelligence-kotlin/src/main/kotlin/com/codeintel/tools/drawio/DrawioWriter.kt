/** Writes updated node positions back to draw.io XML document. */
package com.codeintel.tools.drawio

import org.w3c.dom.Document
import org.w3c.dom.Element
import org.w3c.dom.NodeList
import java.io.File
import java.io.StringWriter
import javax.xml.transform.OutputKeys
import javax.xml.transform.TransformerFactory
import javax.xml.transform.dom.DOMSource
import javax.xml.transform.stream.StreamResult

/** Writes layout results back to the XML document and saves to file. */
object DrawioWriter {

    fun write(doc: Document, graph: DiagramGraph, file: File) {
        val cells = doc.getElementsByTagName("mxCell")
        val allNodes = graph.nodes + graph.containers
        applyPositions(cells, allNodes)
        applyEdgeAnchors(cells, graph)
        applyEdgeRouting(doc, cells, graph)
        saveDocument(doc, file)
    }

    private fun applyPositions(cells: NodeList, nodes: List<DiagramNode>) {
        val nodeMap = nodes.associateBy { it.id }
        for (i in 0 until cells.length) {
            val cell = cells.item(i) as Element
            val id = cell.getAttribute("id")
            val node = nodeMap[id] ?: continue
            val geoms = cell.getElementsByTagName("mxGeometry")
            if (geoms.length == 0) continue
            val geom = geoms.item(0) as Element
            if (geom.getAttribute("as") != "geometry") continue
            geom.setAttribute("x", node.x.format())
            geom.setAttribute("y", node.y.format())
            geom.setAttribute("width", node.width.format())
            geom.setAttribute("height", node.height.format())
        }
    }

    private fun applyEdgeAnchors(cells: NodeList, graph: DiagramGraph) {
        val nodeMap = (graph.nodes + graph.containers).associateBy { it.id }
        for (i in 0 until cells.length) {
            val cell = cells.item(i) as Element
            if (cell.getAttribute("edge") != "1") continue
            val srcId = cell.getAttribute("source") ?: continue
            val tgtId = cell.getAttribute("target") ?: continue
            val src = nodeMap[srcId] ?: continue
            val tgt = nodeMap[tgtId] ?: continue
            val (exitX, exitY) = computeExitPoint(src, tgt)
            val (entryX, entryY) = computeEntryPoint(src, tgt)
            updateEdgeStyle(cell, exitX, exitY, entryX, entryY)
        }
    }

    private fun computeExitPoint(src: DiagramNode, tgt: DiagramNode): Pair<Double, Double> {
        val srcCx = src.x + src.width / 2
        val srcCy = src.y + src.height / 2
        val tgtCx = tgt.x + tgt.width / 2
        val tgtCy = tgt.y + tgt.height / 2
        val dx = tgtCx - srcCx
        val dy = tgtCy - srcCy
        return pickSide(dx, dy)
    }

    private fun computeEntryPoint(src: DiagramNode, tgt: DiagramNode): Pair<Double, Double> {
        val srcCx = src.x + src.width / 2
        val srcCy = src.y + src.height / 2
        val tgtCx = tgt.x + tgt.width / 2
        val tgtCy = tgt.y + tgt.height / 2
        val dx = srcCx - tgtCx
        val dy = srcCy - tgtCy
        return pickSide(dx, dy)
    }

    private fun pickSide(dx: Double, dy: Double): Pair<Double, Double> {
        return if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) Pair(1.0, 0.5) else Pair(0.0, 0.5) // right or left
        } else {
            if (dy > 0) Pair(0.5, 1.0) else Pair(0.5, 0.0) // bottom or top
        }
    }

    private fun updateEdgeStyle(cell: Element, exitX: Double, exitY: Double, entryX: Double, entryY: Double) {
        var style = cell.getAttribute("style") ?: ""
        style = replaceOrAppend(style, "exitX", exitX.format())
        style = replaceOrAppend(style, "exitY", exitY.format())
        style = replaceOrAppend(style, "entryX", entryX.format())
        style = replaceOrAppend(style, "entryY", entryY.format())
        cell.setAttribute("style", style)
    }

    private fun replaceOrAppend(style: String, key: String, value: String): String {
        val regex = Regex("$key=[^;]*")
        return if (regex.containsMatchIn(style)) {
            regex.replace(style, "$key=$value")
        } else {
            if (style.endsWith(";")) "${style}$key=$value;" else "$style;$key=$value;"
        }
    }

    /** Apply orthogonal edge routing — add waypoints where edges cross shapes. */
    private fun applyEdgeRouting(doc: Document, cells: NodeList, graph: DiagramGraph) {
        val routes = EdgeRouter.route(graph)
        if (routes.isEmpty()) return
        for (i in 0 until cells.length) {
            val cell = cells.item(i) as Element
            if (cell.getAttribute("edge") != "1") continue
            val edgeId = cell.getAttribute("id")
            val waypoints = routes[edgeId] ?: continue
            // Set orthogonal edge style
            var style = cell.getAttribute("style") ?: ""
            style = replaceOrAppend(style, "edgeStyle", "orthogonalEdgeStyle")
            style = replaceOrAppend(style, "rounded", "1")
            cell.setAttribute("style", style)
            // Add waypoints as mxPoint array inside mxGeometry
            addWaypoints(doc, cell, waypoints)
        }
    }

    private fun addWaypoints(doc: Document, cell: Element, waypoints: List<Waypoint>) {
        val geoms = cell.getElementsByTagName("mxGeometry")
        val geom = if (geoms.length > 0) geoms.item(0) as Element
            else doc.createElement("mxGeometry").also { it.setAttribute("as", "geometry"); it.setAttribute("relative", "1"); cell.appendChild(it) }
        // Remove existing Array points
        val existing = geom.getElementsByTagName("Array")
        for (i in existing.length - 1 downTo 0) {
            val arr = existing.item(i) as Element
            if (arr.getAttribute("as") == "points") geom.removeChild(arr)
        }
        // Create new Array with mxPoints
        val array = doc.createElement("Array")
        array.setAttribute("as", "points")
        for (wp in waypoints) {
            val point = doc.createElement("mxPoint")
            point.setAttribute("x", wp.x.format())
            point.setAttribute("y", wp.y.format())
            array.appendChild(point)
        }
        geom.appendChild(array)
    }

    private fun saveDocument(doc: Document, file: File) {
        val transformer = TransformerFactory.newInstance().newTransformer()
        transformer.setOutputProperty(OutputKeys.INDENT, "yes")
        transformer.setOutputProperty(OutputKeys.OMIT_XML_DECLARATION, "yes")
        transformer.setOutputProperty("{http://xml.apache.org/xslt}indent-amount", "2")
        val writer = StringWriter()
        transformer.transform(DOMSource(doc), StreamResult(writer))
        file.writeText(writer.toString())
    }

    private fun Double.format(): String {
        val rounded = Math.round(this).toDouble()
        return if (rounded == this) rounded.toLong().toString() else "%.1f".format(this)
    }
}
