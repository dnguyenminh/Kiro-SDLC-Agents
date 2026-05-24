"use strict";
/**
 * GraphTraversal — BFS, DFS, shortest path algorithms.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.bfs = bfs;
exports.shortestPath = shortestPath;
exports.egoGraph = egoGraph;
/** BFS from start node, returns visited nodes up to maxDepth. */
function bfs(adj, startId, maxDepth) {
    const visited = [];
    const queue = [[startId, 0]];
    const seen = new Set([startId]);
    while (queue.length > 0) {
        const [node, depth] = queue.shift();
        visited.push(node);
        if (depth >= maxDepth)
            continue;
        for (const neighbor of adj.get(node) ?? []) {
            if (!seen.has(neighbor)) {
                seen.add(neighbor);
                queue.push([neighbor, depth + 1]);
            }
        }
    }
    return visited;
}
/** Shortest path using BFS. Returns null if no path exists. */
function shortestPath(adj, from, to) {
    if (from === to)
        return [from];
    const queue = [from];
    const parent = new Map();
    const seen = new Set([from]);
    while (queue.length > 0) {
        const node = queue.shift();
        for (const neighbor of adj.get(node) ?? []) {
            if (seen.has(neighbor))
                continue;
            parent.set(neighbor, node);
            if (neighbor === to)
                return reconstructPath(parent, from, to);
            seen.add(neighbor);
            queue.push(neighbor);
        }
    }
    return null;
}
/** Ego graph — all nodes within radius hops (both directions). */
function egoGraph(adj, reverseAdj, nodeId, radius) {
    const result = new Set([nodeId]);
    const queue = [[nodeId, 0]];
    while (queue.length > 0) {
        const [current, depth] = queue.shift();
        if (depth >= radius)
            continue;
        const forward = adj.get(current) ?? new Set();
        const backward = reverseAdj.get(current) ?? new Set();
        for (const n of [...forward, ...backward]) {
            if (!result.has(n)) {
                result.add(n);
                queue.push([n, depth + 1]);
            }
        }
    }
    return result;
}
function reconstructPath(parent, from, to) {
    const path = [to];
    let current = to;
    while (current !== from) {
        const p = parent.get(current);
        if (p === undefined)
            return [];
        path.push(p);
        current = p;
    }
    return path.reverse();
}
//# sourceMappingURL=graph-traversal.js.map