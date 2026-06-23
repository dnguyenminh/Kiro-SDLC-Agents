"use strict";
/**
 * GraphAnalytics — centrality, hubs, connected components analysis.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.degreeCentrality = degreeCentrality;
exports.findHubs = findHubs;
exports.findIsolated = findIsolated;
exports.connectedComponents = connectedComponents;
exports.density = density;
/** Degree centrality — normalized count of connections per node. */
function degreeCentrality(adj) {
    if (adj.size === 0)
        return new Map();
    let maxDegree = 0;
    for (const neighbors of adj.values()) {
        if (neighbors.size > maxDegree)
            maxDegree = neighbors.size;
    }
    if (maxDegree === 0)
        return new Map([...adj.keys()].map(k => [k, 0]));
    const result = new Map();
    for (const [node, neighbors] of adj) {
        result.set(node, neighbors.size / maxDegree);
    }
    return result;
}
/** Find hub nodes — nodes with degree above threshold. */
function findHubs(adj, minDegree = 3) {
    const hubs = [];
    for (const [node, neighbors] of adj) {
        if (neighbors.size >= minDegree)
            hubs.push(node);
    }
    return hubs;
}
/** Find isolated nodes — nodes with no connections. */
function findIsolated(adj) {
    const isolated = [];
    for (const [node, neighbors] of adj) {
        if (neighbors.size === 0)
            isolated.push(node);
    }
    return isolated;
}
/** Connected components using BFS. */
function connectedComponents(adj) {
    const visited = new Set();
    const components = [];
    for (const node of adj.keys()) {
        if (visited.has(node))
            continue;
        const component = new Set();
        const queue = [node];
        while (queue.length > 0) {
            const current = queue.shift();
            if (visited.has(current))
                continue;
            visited.add(current);
            component.add(current);
            for (const neighbor of adj.get(current) ?? []) {
                if (!visited.has(neighbor))
                    queue.push(neighbor);
            }
        }
        components.push(component);
    }
    return components;
}
/** Graph density — ratio of actual edges to possible edges. */
function density(nodeCount, edgeCount) {
    if (nodeCount <= 1)
        return 0;
    const maxEdges = nodeCount * (nodeCount - 1);
    return edgeCount / maxEdges;
}
//# sourceMappingURL=graph-analytics.js.map