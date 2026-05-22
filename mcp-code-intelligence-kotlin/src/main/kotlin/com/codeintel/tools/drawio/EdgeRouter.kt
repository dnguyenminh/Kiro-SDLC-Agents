/** Orthogonal edge routing — computes waypoints so connectors avoid shapes. */
package com.codeintel.tools.drawio

/** A waypoint (bend point) in an edge route. */
data class Waypoint(val x: Double, val y: Double)

/** Computes orthogonal routes for edges that would cross shapes. */
object EdgeRouter {

    /** Route all edges, adding waypoints where needed to avoid node overlaps. */
    fun route(graph: DiagramGraph): Map<String, List<Waypoint>> {
        val allNodes = graph.nodes + graph.containers
        val nodeMap = allNodes.associateBy { it.id }
        val routes = mutableMapOf<String, List<Waypoint>>()

        for (edge in graph.edges) {
            val src = nodeMap[edge.sourceId] ?: continue
            val tgt = nodeMap[edge.targetId] ?: continue
            val obstacles = allNodes.filter { it.id != src.id && it.id != tgt.id }
            val waypoints = computeRoute(src, tgt, obstacles)
            if (waypoints.isNotEmpty()) routes[edge.id] = waypoints
        }
        return routes
    }

    /** Compute waypoints for a single edge to avoid obstacles. */
    private fun computeRoute(
        src: DiagramNode, tgt: DiagramNode, obstacles: List<DiagramNode>
    ): List<Waypoint> {
        val srcPort = exitPort(src, tgt)
        val tgtPort = entryPort(src, tgt)

        // Check if straight line crosses any obstacle
        val crossedObstacles = obstacles.filter { lineIntersectsRect(srcPort, tgtPort, it) }
        if (crossedObstacles.isEmpty()) return emptyList() // straight line is fine

        // Orthogonal routing: go around obstacles with L-shape or Z-shape
        return orthogonalRoute(srcPort, tgtPort, crossedObstacles)
    }

    /** Compute orthogonal (right-angle) route around obstacles. */
    private fun orthogonalRoute(
        start: Waypoint, end: Waypoint, obstacles: List<DiagramNode>
    ): List<Waypoint> {
        val dx = end.x - start.x
        val dy = end.y - start.y

        // Try L-shape: horizontal first, then vertical
        val midL = Waypoint(end.x, start.y)
        if (!anyIntersection(start, midL, obstacles) && !anyIntersection(midL, end, obstacles)) {
            return listOf(midL)
        }

        // Try L-shape: vertical first, then horizontal
        val midL2 = Waypoint(start.x, end.y)
        if (!anyIntersection(start, midL2, obstacles) && !anyIntersection(midL2, end, obstacles)) {
            return listOf(midL2)
        }

        // Z-shape: go around the obstacle with offset
        val offset = 30.0
        val obstacle = obstacles.first()
        return if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal dominant — go above or below obstacle
            val bypassY = if (start.y < obstacle.y) obstacle.y - offset else obstacle.y + obstacle.height + offset
            listOf(Waypoint(start.x + dx * 0.3, start.y), Waypoint(start.x + dx * 0.3, bypassY), Waypoint(end.x - dx * 0.1, bypassY))
        } else {
            // Vertical dominant — go left or right of obstacle
            val bypassX = if (start.x < obstacle.x) obstacle.x - offset else obstacle.x + obstacle.width + offset
            listOf(Waypoint(start.x, start.y + dy * 0.3), Waypoint(bypassX, start.y + dy * 0.3), Waypoint(bypassX, end.y - dy * 0.1))
        }
    }

    private fun anyIntersection(a: Waypoint, b: Waypoint, obstacles: List<DiagramNode>): Boolean {
        return obstacles.any { lineIntersectsRect(a, b, it) }
    }

    /** Check if line segment from a to b intersects a node's bounding box. */
    private fun lineIntersectsRect(a: Waypoint, b: Waypoint, node: DiagramNode): Boolean {
        val margin = 5.0
        val left = node.x - margin; val right = node.x + node.width + margin
        val top = node.y - margin; val bottom = node.y + node.height + margin

        // Quick AABB check: if line bbox doesn't overlap node bbox, no intersection
        val minX = minOf(a.x, b.x); val maxX = maxOf(a.x, b.x)
        val minY = minOf(a.y, b.y); val maxY = maxOf(a.y, b.y)
        if (maxX < left || minX > right || maxY < top || minY > bottom) return false

        // Check if line passes through rectangle using Cohen-Sutherland
        return cohenSutherlandIntersects(a.x, a.y, b.x, b.y, left, top, right, bottom)
    }

    private fun cohenSutherlandIntersects(
        x1: Double, y1: Double, x2: Double, y2: Double,
        left: Double, top: Double, right: Double, bottom: Double
    ): Boolean {
        var code1 = outCode(x1, y1, left, top, right, bottom)
        var code2 = outCode(x2, y2, left, top, right, bottom)
        if (code1 == 0 || code2 == 0) return true // endpoint inside rect
        if (code1 and code2 != 0) return false // both on same side
        return true // potentially intersects (simplified)
    }

    private fun outCode(x: Double, y: Double, l: Double, t: Double, r: Double, b: Double): Int {
        var code = 0
        if (x < l) code = code or 1
        if (x > r) code = code or 2
        if (y < t) code = code or 4
        if (y > b) code = code or 8
        return code
    }

    private fun exitPort(src: DiagramNode, tgt: DiagramNode): Waypoint {
        val dx = (tgt.x + tgt.width / 2) - (src.x + src.width / 2)
        val dy = (tgt.y + tgt.height / 2) - (src.y + src.height / 2)
        return if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) Waypoint(src.x + src.width, src.y + src.height / 2)
            else Waypoint(src.x, src.y + src.height / 2)
        } else {
            if (dy > 0) Waypoint(src.x + src.width / 2, src.y + src.height)
            else Waypoint(src.x + src.width / 2, src.y)
        }
    }

    private fun entryPort(src: DiagramNode, tgt: DiagramNode): Waypoint {
        val dx = (src.x + src.width / 2) - (tgt.x + tgt.width / 2)
        val dy = (src.y + src.height / 2) - (tgt.y + tgt.height / 2)
        return if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) Waypoint(tgt.x + tgt.width, tgt.y + tgt.height / 2)
            else Waypoint(tgt.x, tgt.y + tgt.height / 2)
        } else {
            if (dy > 0) Waypoint(tgt.x + tgt.width / 2, tgt.y + tgt.height)
            else Waypoint(tgt.x + tgt.width / 2, tgt.y)
        }
    }
}
