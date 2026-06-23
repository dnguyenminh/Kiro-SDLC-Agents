/** drawio_auto_layout MCP tool — REVIEW mode: detect issues, report for AI to fix. */
package com.codeintel.tools.drawio

import kotlinx.serialization.json.*
import java.io.File

/** MCP tool that analyzes .drawio file and reports layout issues. Does NOT modify file. */
class DrawioAutoLayoutTool(private val workspace: String) {

    fun execute(args: JsonObject): String {
        val rawPath = args["file_path"]?.jsonPrimitive?.content
            ?: return error("file_path is required")
        val file = resolveFile(rawPath)
        if (!file.exists()) return error("File not found: ${file.absolutePath}")
        if (!file.name.endsWith(".drawio")) return error("Not a .drawio file: ${file.name}")

        return try {
            val (_, graph) = DrawioParser.parse(file)
            val nodeCount = graph.nodes.size + graph.containers.size
            if (nodeCount == 0) return error("No nodes found in diagram")

            val issues = detectAllIssues(graph)
            if (issues.isEmpty()) {
                buildJsonObject {
                    put("status", "already_good")
                    put("message", "Diagram looks good — no overlapping nodes or edge crossings detected.")
                    put("nodes", nodeCount)
                    put("edges", graph.edges.size)
                    putJsonArray("issues") {}
                }.toString()
            } else {
                buildJsonObject {
                    put("status", "needs_fix")
                    put("message", "Found ${issues.size} issues. Fix the drawio XML and call this tool again to verify.")
                    put("nodes", nodeCount)
                    put("edges", graph.edges.size)
                    putJsonArray("issues") { issues.forEach { add(it) } }
                }.toString()
            }
        } catch (e: Exception) {
            error("Analysis failed: ${e.message}")
        }
    }

    private fun detectAllIssues(graph: DiagramGraph): List<JsonObject> {
        val issues = mutableListOf<JsonObject>()
        issues.addAll(detectNodeOverlaps(graph))
        issues.addAll(detectEdgeCrossings(graph))
        issues.addAll(detectDiagonalEdges(graph))
        return issues
    }

    private fun detectNodeOverlaps(graph: DiagramGraph): List<JsonObject> {
        val issues = mutableListOf<JsonObject>()
        val nodes = graph.nodes
        for (i in nodes.indices) {
            for (j in i + 1 until nodes.size) {
                val a = nodes[i]; val b = nodes[j]
                if (a.parentId != b.parentId) continue
                val overlap = overlapRatio(a, b)
                if (overlap > 0.50) {
                    issues.add(buildJsonObject {
                        put("type", "node_overlap"); put("severity", "high")
                        put("node_a", a.id); put("node_b", b.id)
                        put("overlap_pct", (overlap * 100).toInt())
                        put("fix_hint", "Move '${b.id}' away from '${a.id}'.")
                    })
                }
            }
        }
        return issues
    }

    private fun detectEdgeCrossings(graph: DiagramGraph): List<JsonObject> {
        val issues = mutableListOf<JsonObject>()
        val allNodes = graph.nodes + graph.containers
        val nodeMap = allNodes.associateBy { it.id }
        for (edge in graph.edges) {
            val src = nodeMap[edge.sourceId] ?: continue
            val tgt = nodeMap[edge.targetId] ?: continue
            val sx = src.x + src.width / 2; val sy = src.y + src.height / 2
            val tx = tgt.x + tgt.width / 2; val ty = tgt.y + tgt.height / 2
            for (node in graph.nodes) {
                if (node.id == edge.sourceId || node.id == edge.targetId) continue
                if (lineCrossesRect(sx, sy, tx, ty, node)) {
                    issues.add(buildJsonObject {
                        put("type", "edge_crossing"); put("severity", "medium")
                        put("edge_id", edge.id)
                        put("edge_source", edge.sourceId); put("edge_target", edge.targetId)
                        put("crosses_node", node.id)
                        put("fix_hint", "Edge '${edge.id}' (${edge.sourceId}→${edge.targetId}) crosses '${node.id}'. Rearrange nodes.")
                    })
                    break
                }
            }
        }
        return issues
    }

    private fun detectDiagonalEdges(graph: DiagramGraph): List<JsonObject> {
        val issues = mutableListOf<JsonObject>()
        val nodeMap = (graph.nodes + graph.containers).associateBy { it.id }
        val tolerance = 20.0
        for (edge in graph.edges) {
            val src = nodeMap[edge.sourceId] ?: continue
            val tgt = nodeMap[edge.targetId] ?: continue
            val srcCy = src.y + src.height / 2
            val tgtCy = tgt.y + tgt.height / 2
            val srcCx = src.x + src.width / 2
            val tgtCx = tgt.x + tgt.width / 2
            val dx = Math.abs(srcCx - tgtCx)
            val dy = Math.abs(srcCy - tgtCy)
            if (dy > tolerance && dx > tolerance) {
                val fix = if (dx < dy)
                    "Align horizontally: set '${edge.targetId}' x=${src.x.toInt()} (same column)"
                else
                    "Align vertically: set '${edge.targetId}' y=${src.y.toInt()} (same row)"
                issues.add(buildJsonObject {
                    put("type", "diagonal_edge"); put("severity", "low")
                    put("edge_id", edge.id)
                    put("edge_source", edge.sourceId); put("edge_target", edge.targetId)
                    put("fix_hint", fix)
                })
            }
        }
        return issues
    }

    private fun overlapRatio(a: DiagramNode, b: DiagramNode): Double {
        val ox = maxOf(0.0, minOf(a.x + a.width, b.x + b.width) - maxOf(a.x, b.x))
        val oy = maxOf(0.0, minOf(a.y + a.height, b.y + b.height) - maxOf(a.y, b.y))
        val area = ox * oy
        if (area <= 0) return 0.0
        val smaller = minOf(a.width * a.height, b.width * b.height)
        return if (smaller > 0) area / smaller else 0.0
    }

    private fun lineCrossesRect(x1: Double, y1: Double, x2: Double, y2: Double, node: DiagramNode): Boolean {
        val m = 5.0
        val l = node.x - m; val r = node.x + node.width + m
        val t = node.y - m; val b = node.y + node.height + m
        if (maxOf(x1, x2) < l || minOf(x1, x2) > r) return false
        if (maxOf(y1, y2) < t || minOf(y1, y2) > b) return false
        val c1 = outCode(x1, y1, l, t, r, b)
        val c2 = outCode(x2, y2, l, t, r, b)
        if (c1 and c2 != 0) return false
        if (c1 == 0 || c2 == 0) return false
        return true
    }

    private fun outCode(x: Double, y: Double, l: Double, t: Double, r: Double, b: Double): Int {
        var c = 0
        if (x < l) c = c or 1; if (x > r) c = c or 2
        if (y < t) c = c or 4; if (y > b) c = c or 8
        return c
    }

    private fun resolveFile(rawPath: String): File {
        val f = File(rawPath)
        return if (f.isAbsolute) f else File(workspace, rawPath)
    }

    private fun error(msg: String) = """{"error":"$msg"}"""
}
