/** Layout algorithms for draw.io diagrams — layered (Sugiyama), force-directed, tree. */
package com.codeintel.tools.drawio

/** Supported layout algorithms. */
enum class Algorithm { LAYERED, FORCE, MRTREE, RADIAL }

/** Layout direction for layered/tree algorithms. */
enum class Direction { DOWN, RIGHT, LEFT, UP }

/** Applies layout algorithm to a DiagramGraph, updating node positions in-place. */
object LayoutAlgorithm {

    fun apply(graph: DiagramGraph, algo: Algorithm, spacing: Double, direction: Direction) {
        val nodes = graph.nodes.ifEmpty { return }
        when (algo) {
            Algorithm.LAYERED -> layeredLayout(graph, spacing, direction)
            Algorithm.FORCE -> forceDirectedLayout(nodes, graph.edges, spacing)
            Algorithm.MRTREE -> treeLayout(graph, spacing, direction)
            Algorithm.RADIAL -> radialLayout(nodes, graph.edges, spacing)
        }
        resizeContainers(graph, spacing)
    }

    private fun layeredLayout(graph: DiagramGraph, spacing: Double, dir: Direction) {
        val layers = assignLayers(graph.nodes, graph.edges)
        positionLayers(graph.nodes, layers, spacing, dir)
    }

    private fun assignLayers(nodes: List<DiagramNode>, edges: List<DiagramEdge>): Map<String, Int> {
        val adj = mutableMapOf<String, MutableList<String>>()
        val inDeg = mutableMapOf<String, Int>()
        nodes.forEach { adj[it.id] = mutableListOf(); inDeg[it.id] = 0 }
        edges.forEach { e ->
            if (adj.containsKey(e.sourceId) && adj.containsKey(e.targetId)) {
                adj[e.sourceId]!!.add(e.targetId)
                inDeg[e.targetId] = (inDeg[e.targetId] ?: 0) + 1
            }
        }
        val layers = mutableMapOf<String, Int>()
        val queue = ArrayDeque(inDeg.filter { it.value == 0 }.keys.toList())
        queue.forEach { layers[it] = 0 }
        while (queue.isNotEmpty()) {
            val cur = queue.removeFirst()
            val curLayer = layers[cur] ?: 0
            adj[cur]?.forEach { next ->
                val newLayer = curLayer + 1
                if ((layers[next] ?: -1) < newLayer) layers[next] = newLayer
                inDeg[next] = (inDeg[next] ?: 1) - 1
                if (inDeg[next] == 0) queue.add(next)
            }
        }
        // Assign unvisited nodes (cycles) to layer 0
        nodes.filter { it.id !in layers }.forEach { layers[it.id] = 0 }
        return layers
    }

    private fun positionLayers(
        nodes: List<DiagramNode>, layers: Map<String, Int>, spacing: Double, dir: Direction
    ) {
        val grouped = nodes.groupBy { layers[it.id] ?: 0 }
        val layerSpacing = spacing * 2
        grouped.forEach { (layer, layerNodes) ->
            layerNodes.forEachIndexed { idx, node ->
                val primary = layer * layerSpacing
                val secondary = idx * (node.width + spacing)
                when (dir) {
                    Direction.DOWN -> { node.x = secondary; node.y = primary }
                    Direction.RIGHT -> { node.x = primary; node.y = secondary }
                    Direction.UP -> { node.x = secondary; node.y = -primary }
                    Direction.LEFT -> { node.x = -primary; node.y = secondary }
                }
            }
        }
    }

    private fun forceDirectedLayout(nodes: List<DiagramNode>, edges: List<DiagramEdge>, spacing: Double) {
        val repulsion = spacing * spacing * 10
        val attraction = 0.01
        val iterations = 100
        // Initialize positions in grid if all at origin
        if (nodes.all { it.x == 0.0 && it.y == 0.0 }) {
            val cols = Math.ceil(Math.sqrt(nodes.size.toDouble())).toInt()
            nodes.forEachIndexed { i, n -> n.x = (i % cols) * spacing * 2; n.y = (i / cols) * spacing * 2 }
        }
        repeat(iterations) { iter ->
            val damping = 1.0 - iter.toDouble() / iterations * 0.8
            applyForces(nodes, edges, repulsion, attraction, damping)
        }
    }

    private fun applyForces(
        nodes: List<DiagramNode>, edges: List<DiagramEdge>,
        repulsion: Double, attraction: Double, damping: Double
    ) {
        val dx = DoubleArray(nodes.size)
        val dy = DoubleArray(nodes.size)
        val nodeIdx = nodes.withIndex().associate { (i, n) -> n.id to i }
        // Repulsion between all pairs
        for (i in nodes.indices) {
            for (j in i + 1 until nodes.size) {
                val diffX = nodes[i].x - nodes[j].x
                val diffY = nodes[i].y - nodes[j].y
                val dist = Math.sqrt(diffX * diffX + diffY * diffY).coerceAtLeast(1.0)
                val force = repulsion / (dist * dist)
                val fx = force * diffX / dist; val fy = force * diffY / dist
                dx[i] += fx; dy[i] += fy; dx[j] -= fx; dy[j] -= fy
            }
        }
        // Attraction along edges
        edges.forEach { e ->
            val si = nodeIdx[e.sourceId] ?: return@forEach
            val ti = nodeIdx[e.targetId] ?: return@forEach
            val diffX = nodes[ti].x - nodes[si].x
            val diffY = nodes[ti].y - nodes[si].y
            val fx = attraction * diffX; val fy = attraction * diffY
            dx[si] += fx; dy[si] += fy; dx[ti] -= fx; dy[ti] -= fy
        }
        nodes.forEachIndexed { i, n -> n.x += dx[i] * damping; n.y += dy[i] * damping }
    }

    private fun treeLayout(graph: DiagramGraph, spacing: Double, dir: Direction) {
        layeredLayout(graph, spacing, dir) // Tree is a special case of layered
    }

    private fun radialLayout(nodes: List<DiagramNode>, edges: List<DiagramEdge>, spacing: Double) {
        val center = nodes.firstOrNull() ?: return
        center.x = 0.0; center.y = 0.0
        val remaining = nodes.drop(1)
        val rings = remaining.chunked(8)
        rings.forEachIndexed { ringIdx, ring ->
            val radius = (ringIdx + 1) * spacing * 2.5
            ring.forEachIndexed { i, node ->
                val angle = 2 * Math.PI * i / ring.size
                node.x = radius * Math.cos(angle)
                node.y = radius * Math.sin(angle)
            }
        }
    }

    private fun resizeContainers(graph: DiagramGraph, spacing: Double) {
        graph.containers.forEach { container ->
            val children = graph.nodes.filter { it.parentId == container.id }
            if (children.isEmpty()) return@forEach
            val minX = children.minOf { it.x } - spacing
            val minY = children.minOf { it.y } - spacing
            val maxX = children.maxOf { it.x + it.width } + spacing
            val maxY = children.maxOf { it.y + it.height } + spacing
            container.x = minX; container.y = minY
            container.width = maxX - minX; container.height = maxY - minY
            // Convert children to relative coordinates
            children.forEach { it.x -= minX; it.y -= minY }
        }
    }
}
