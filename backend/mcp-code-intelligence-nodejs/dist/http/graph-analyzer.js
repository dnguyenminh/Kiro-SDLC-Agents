"use strict";
/**
 * GraphAnalyzer — server-side graph structure analysis for KB.
 * Port of Python graph_analyzer.py.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphAnalyzer = void 0;
class GraphAnalyzer {
    db;
    constructor(db) {
        this.db = db;
    }
    analyze() {
        const stats = this.computeStats();
        const insights = [
            ...this.findOrphans(),
            ...this.findHubs(),
            ...this.findClusters(),
            ...this.findStaleNodes(),
        ];
        return { insights, stats, computed_at: new Date().toISOString() };
    }
    computeStats() {
        try {
            const nc = this.db.prepare('SELECT COUNT(*) as c FROM knowledge_entries').get().c;
            const ec = this.db.prepare('SELECT COUNT(*) as c FROM knowledge_graph_edges').get().c;
            const maxEdges = nc > 1 ? nc * (nc - 1) : 1;
            return { node_count: nc, edge_count: ec, density: Math.round((ec / maxEdges) * 10000) / 10000 };
        }
        catch {
            return { node_count: 0, edge_count: 0, density: 0 };
        }
    }
    findOrphans() {
        try {
            const rows = this.db.prepare(`SELECT e.id FROM knowledge_entries e WHERE e.id NOT IN (
           SELECT source_id FROM knowledge_graph_edges
           UNION SELECT target_id FROM knowledge_graph_edges
         ) LIMIT 20`).all();
            if (!rows.length)
                return [];
            return [{
                    type: 'orphans', title: `${rows.length} Orphan Nodes`,
                    description: 'Entries không có relationships nào',
                    node_ids: rows.map(r => r.id), severity: 'warning',
                    action: { label: 'Find Related', endpoint: 'api/kb/entries/{id}/find-related', method: 'POST' },
                }];
        }
        catch {
            return [];
        }
    }
    findHubs() {
        try {
            const rows = this.db.prepare(`SELECT node_id, SUM(cnt) as total FROM (
           SELECT source_id AS node_id, COUNT(*) AS cnt FROM knowledge_graph_edges GROUP BY source_id
           UNION ALL
           SELECT target_id AS node_id, COUNT(*) AS cnt FROM knowledge_graph_edges GROUP BY target_id
         ) GROUP BY node_id HAVING total > 10 ORDER BY total DESC LIMIT 10`).all();
            if (!rows.length)
                return [];
            return [{
                    type: 'hubs', title: `${rows.length} Hub Nodes`,
                    description: 'Entries có >10 relationships (highly connected)',
                    node_ids: rows.map(r => r.node_id), severity: 'info', action: null,
                }];
        }
        catch {
            return [];
        }
    }
    findClusters() {
        try {
            const edges = this.db.prepare('SELECT source_id, target_id FROM knowledge_graph_edges')
                .all();
            const nodes = this.db.prepare('SELECT id FROM knowledge_entries')
                .all();
            if (!nodes.length)
                return [];
            const adj = new Map();
            for (const n of nodes)
                adj.set(n.id, new Set());
            for (const e of edges) {
                adj.get(e.source_id)?.add(e.target_id);
                adj.get(e.target_id)?.add(e.source_id);
            }
            const components = countComponents(adj);
            if (components <= 1)
                return [];
            return [{
                    type: 'clusters', title: `${components} Disconnected Clusters`,
                    description: 'Graph có nhiều components tách biệt',
                    node_ids: [], severity: 'info', action: null,
                }];
        }
        catch {
            return [];
        }
    }
    findStaleNodes() {
        const threshold = new Date(Date.now() - 180 * 86400000).toISOString();
        try {
            const rows = this.db.prepare('SELECT id FROM knowledge_entries WHERE updated_at < ? LIMIT 15').all(threshold);
            if (!rows.length)
                return [];
            return [{
                    type: 'stale', title: `${rows.length} Stale Nodes (>180 days)`,
                    description: 'Entries chưa được update > 180 ngày',
                    node_ids: rows.map(r => r.id), severity: 'warning',
                    action: { label: 'Review', endpoint: 'api/kb/entries/{id}/review', method: 'POST' },
                }];
        }
        catch {
            return [];
        }
    }
}
exports.GraphAnalyzer = GraphAnalyzer;
/** Count connected components via BFS. */
function countComponents(adj) {
    const visited = new Set();
    let components = 0;
    for (const node of adj.keys()) {
        if (visited.has(node))
            continue;
        components++;
        const queue = [node];
        while (queue.length) {
            const current = queue.shift();
            if (visited.has(current))
                continue;
            visited.add(current);
            for (const neighbor of adj.get(current) ?? []) {
                if (!visited.has(neighbor))
                    queue.push(neighbor);
            }
        }
    }
    return components;
}
//# sourceMappingURL=graph-analyzer.js.map