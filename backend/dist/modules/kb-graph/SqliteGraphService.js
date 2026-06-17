/**
 * SqliteGraphService — Embedded graph layer using SQLite for KB Graph visualization.
 *
 * Zero external dependencies — uses the existing admin.db with graph_nodes + graph_edges tables.
 * Provides spatial bounding-box queries for progressive 3D loading.
 * New KB entries auto-get 3D positions computed via Fibonacci sphere layout.
 */
import { getAdminDb, getKbEntries } from '../../admin/admin-db.js';
const LEVEL_MAP = {
    ARCHITECTURE: 0, REQUIREMENT: 0, DECISION: 0,
    PROCEDURE: 0, CONTEXT: 0, CODE_ENTITY: 0,
    LESSON_LEARNED: 1, ERROR_PATTERN: 1, DOCUMENT: 1,
};
export class SqliteGraphService {
    logger;
    _ready = false;
    constructor(logger) {
        this.logger = logger.child({ service: 'sqlite-graph' });
    }
    get ready() { return this._ready; }
    initialize() {
        const db = getAdminDb();
        const count = db.prepare('SELECT COUNT(*) as cnt FROM graph_nodes').get().cnt;
        this._ready = true;
        // Auto-sync from KB entries if graph is empty
        if (count === 0) {
            const result = getKbEntries(1, 100000, 'created_at', 'desc');
            if (result.items.length > 0) {
                this.logger.info({ kbEntries: result.items.length }, 'Graph empty — auto-syncing from KB entries');
                this.syncFromEntries(result.items);
            }
        }
        this.logger.info({ existingNodes: this.getNodeCount() }, 'SQLite graph service ready');
    }
    getNodeCount() {
        return getAdminDb().prepare('SELECT COUNT(*) as cnt FROM graph_nodes').get().cnt;
    }
    addNode(entryId, label, type, tier) {
        const db = getAdminDb();
        const existing = db.prepare('SELECT entry_id FROM graph_nodes WHERE entry_id = ?').get(entryId);
        if (existing)
            return this.getNode(entryId);
        const count = this.getNodeCount();
        const pos = this.computePosition(count, type);
        db.prepare(`INSERT OR IGNORE INTO graph_nodes (entry_id, label, type, tier, x, y, z, level, cluster_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(entryId, label.substring(0, 50), type.toUpperCase(), tier, pos.x, pos.y, pos.z, pos.level, pos.clusterId);
        this.autoCreateEdges(entryId, type.toUpperCase(), tier);
        return { id: entryId, label, type: type.toUpperCase(), tier, ...pos };
    }
    removeNode(entryId) {
        const db = getAdminDb();
        db.prepare('DELETE FROM graph_edges WHERE source = ? OR target = ?').run(entryId, entryId);
        db.prepare('DELETE FROM graph_nodes WHERE entry_id = ?').run(entryId);
    }
    getNode(entryId) {
        const row = getAdminDb().prepare('SELECT * FROM graph_nodes WHERE entry_id = ?').get(entryId);
        if (!row)
            return null;
        return this.rowToNode(row);
    }
    addEdge(source, target, weight = 0.5, relType = 'RELATED_TO') {
        getAdminDb().prepare('INSERT OR IGNORE INTO graph_edges (source, target, weight, rel_type) VALUES (?, ?, ?, ?)').run(source, target, weight, relType);
    }
    /**
     * Returns ALL node positions (minimal data, no edges) for initial full-load rendering.
     * Optimized for Points-based visualization of 72k+ nodes.
     */
    getAllPositions() {
        const db = getAdminDb();
        const rows = db.prepare('SELECT entry_id, x, y, z, type, tier, label FROM graph_nodes').all();
        const nodes = rows.map((r) => ({
            id: r.entry_id,
            x: r.x,
            y: r.y,
            z: r.z,
            type: r.type,
            tier: r.tier,
            label: r.label,
        }));
        return { nodes, total: nodes.length };
    }
    spatialQuery(params) {
        const db = getAdminDb();
        const startTime = performance.now();
        const { camX, camY, camZ, zoom } = params;
        // Radius inversely proportional to zoom distance:
        // Far away (zoom=1000) → large radius (500) to show overview
        // Close up (zoom=100) → medium radius (300) to show local detail
        const r = Math.max(200, zoom * 0.5);
        let nodes;
        let level;
        if (zoom > 500) {
            level = 'macro';
            // Sample evenly from each type (no RANDOM — use LIMIT per type)
            const types = db.prepare('SELECT DISTINCT type FROM graph_nodes WHERE level = 0').all().map((r) => r.type);
            const perType = Math.max(20, Math.floor(500 / Math.max(types.length, 1)));
            const allNodes = [];
            for (const t of types) {
                const rows = db.prepare('SELECT * FROM graph_nodes WHERE level = 0 AND type = ? LIMIT ?').all(t, perType);
                allNodes.push(...rows);
            }
            nodes = allNodes.slice(0, 500).map(this.rowToNode);
        }
        else if (zoom > 200) {
            level = 'mid';
            // Mid: nodes near camera, include level 0+1
            nodes = db.prepare(`
        SELECT *, ABS(x - ?) + ABS(y - ?) + ABS(z - ?) as manhattan_dist
        FROM graph_nodes WHERE level <= 1
        ORDER BY manhattan_dist ASC
        LIMIT 1500
      `).all(camX, camY, camZ).map(this.rowToNode);
        }
        else {
            level = 'micro';
            // Close up: get ALL nodes near camera position
            const nearNodes = db.prepare(`
        SELECT *, ABS(x - ?) + ABS(y - ?) + ABS(z - ?) as manhattan_dist
        FROM graph_nodes
        ORDER BY manhattan_dist ASC
        LIMIT 10000
      `).all(camX, camY, camZ);
            nodes = nearNodes.map(this.rowToNode);
        }
        let edges = [];
        if (nodes.length > 0 && nodes.length <= 500) {
            // For small sets: direct indexed lookups per node (fast)
            const nodeIdSet = new Set(nodes.map(n => n.id));
            for (const id of nodeIdSet) {
                const rows = db.prepare('SELECT * FROM graph_edges WHERE source = ? LIMIT 10').all(id);
                for (const r of rows) {
                    if (nodeIdSet.has(r.target)) {
                        edges.push({ source: r.source, target: r.target, weight: r.weight, type: r.rel_type });
                    }
                }
                if (edges.length >= 3000)
                    break;
            }
        }
        else if (nodes.length > 500) {
            // For larger sets: use temp table JOIN
            const ids = nodes.map(n => n.id);
            db.exec('CREATE TEMP TABLE IF NOT EXISTS _vis (id TEXT PRIMARY KEY)');
            db.exec('DELETE FROM _vis');
            const ins = db.prepare('INSERT OR IGNORE INTO _vis VALUES (?)');
            db.transaction(() => { for (const id of ids)
                ins.run(id); })();
            edges = db.prepare(`SELECT e.source, e.target, e.weight, e.rel_type FROM graph_edges e INNER JOIN _vis v1 ON e.source = v1.id INNER JOIN _vis v2 ON e.target = v2.id LIMIT 3000`).all()
                .map((r) => ({ source: r.source, target: r.target, weight: r.weight, type: r.rel_type }));
        }
        const queryTimeMs = performance.now() - startTime;
        // Cache counts (expensive full-table scans on 354k rows)
        if (!this._cachedEdgeCount || Date.now() - (this._cachedEdgeCountTime || 0) > 60000) {
            this._cachedEdgeCount = db.prepare('SELECT COUNT(*) as cnt FROM graph_edges').get().cnt;
            this._cachedNodeCount = this.getNodeCount();
            this._cachedEdgeCountTime = Date.now();
        }
        return { nodes, edges, stats: { totalNodes: nodes.length, totalEdges: edges.length, queryTimeMs: Math.round(queryTimeMs * 100) / 100, level, totalInDb: this._cachedNodeCount || 0, totalEdgesInDb: this._cachedEdgeCount || 0 } };
    }
    syncFromEntries(entries) {
        const db = getAdminDb();
        let nodesCreated = 0;
        let edgesCreated = 0;
        const groups = new Map();
        let groupCounter = 0;
        const n = entries.length;
        const insertNode = db.prepare(`INSERT OR REPLACE INTO graph_nodes (entry_id, label, type, tier, x, y, z, level, cluster_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        const insertEdge = db.prepare(`INSERT OR IGNORE INTO graph_edges (source, target, weight, rel_type) VALUES (?, ?, ?, ?)`);
        db.transaction(() => {
            for (let i = 0; i < n; i++) {
                const entry = entries[i];
                const type = (entry.type || entry.content_type || 'DOCUMENT').toUpperCase();
                const tier = entry.tier || entry.scope || 'SHARED';
                const id = entry.id || entry.entry_id || `node-${i}`;
                const label = ((entry.summary || entry.tags || '').substring(0, 50)) || (entry.source || '').split('/').pop() || `Entry ${i + 1}`;
                if (!groups.has(type))
                    groups.set(type, groupCounter++);
                const groupId = groups.get(type);
                const pos = this.computePositionByIndex(i, n, type, groupId, groupCounter);
                insertNode.run(id, label, type, tier, pos.x, pos.y, pos.z, pos.level, pos.clusterId);
                nodesCreated++;
            }
            // Create edges based on SPATIAL PROXIMITY (k-nearest neighbors)
            // Each node connects to its 3 nearest neighbors by 3D distance
            const allNodeRows = db.prepare('SELECT entry_id, x, y, z, cluster_id FROM graph_nodes').all();
            // For performance with large datasets, use bucket-based approach
            const bucketSize = 100;
            const buckets = new Map();
            for (const row of allNodeRows) {
                const bx = Math.floor(row.x / bucketSize);
                const by = Math.floor(row.y / bucketSize);
                const bz = Math.floor(row.z / bucketSize);
                const key = `${bx},${by},${bz}`;
                if (!buckets.has(key))
                    buckets.set(key, []);
                buckets.get(key).push(row);
            }
            // Connect nodes within same bucket and adjacent buckets
            for (const [, members] of buckets) {
                // Connect every node to up to 5 neighbors in same bucket
                for (let i = 0; i < members.length; i++) {
                    for (let j = i + 1; j < Math.min(members.length, i + 6); j++) {
                        insertEdge.run(members[i].entry_id, members[j].entry_id, 0.7, 'SPATIAL');
                        edgesCreated++;
                    }
                }
            }
            // Also connect cluster hubs
            const clusterMap = new Map();
            for (const row of allNodeRows) {
                const cid = row.cluster_id || 'default';
                if (!clusterMap.has(cid))
                    clusterMap.set(cid, row.entry_id);
            }
            const hubs = Array.from(clusterMap.values());
            for (let i = 0; i < hubs.length; i++) {
                for (let j = i + 1; j < hubs.length; j++) {
                    insertEdge.run(hubs[i], hubs[j], 0.6, 'CLUSTER_LINK');
                    edgesCreated++;
                }
            }
        })();
        this.logger.info({ nodesCreated, edgesCreated }, 'Graph sync complete');
        return { nodesCreated, edgesCreated };
    }
    computePosition(index, type) {
        const db = getAdminDb();
        const typeRows = db.prepare('SELECT DISTINCT type FROM graph_nodes').all();
        const groups = new Map();
        let gc = 0;
        for (const r of typeRows) {
            groups.set(r.type, gc++);
        }
        if (!groups.has(type.toUpperCase()))
            groups.set(type.toUpperCase(), gc++);
        return this.computePositionByIndex(index, this.getNodeCount() + 1, type, groups.get(type.toUpperCase()) || 0, gc || 1);
    }
    computePositionByIndex(i, total, type, groupId, groupCount) {
        const n = Math.max(total, 1);
        const level = LEVEL_MAP[type.toUpperCase()] ?? 2;
        const golden = (1 + Math.sqrt(5)) / 2;
        // Each type group gets its own center, spread far apart
        const groupAngle = (groupId / Math.max(groupCount, 1)) * 2 * Math.PI;
        const groupRadius = 600; // distance between group centers
        const centerX = groupRadius * Math.cos(groupAngle);
        const centerY = groupRadius * Math.sin(groupAngle);
        const centerZ = (level - 1) * 400; // levels stack vertically
        // Nodes within group: random-ish scatter (not sphere surface)
        // Use golden ratio for even distribution within a CUBE volume
        const localIdx = i; // position within all nodes
        const spread = 200 + Math.sqrt(n) * 0.5; // spread grows with node count
        const theta = 2 * Math.PI * localIdx / golden;
        const r = Math.sqrt(localIdx / n) * spread; // disk distribution (denser at center)
        const zOffset = ((localIdx * golden) % 1 - 0.5) * spread; // pseudo-random z
        return {
            x: Math.round((centerX + r * Math.cos(theta)) * 100) / 100,
            y: Math.round((centerY + r * Math.sin(theta)) * 100) / 100,
            z: Math.round((centerZ + zOffset) * 100) / 100,
            level, clusterId: `cluster-${groupId}`,
        };
    }
    autoCreateEdges(entryId, type, tier) {
        const db = getAdminDb();
        for (const row of db.prepare('SELECT entry_id FROM graph_nodes WHERE type = ? AND entry_id != ? ORDER BY RANDOM() LIMIT 3').all(type, entryId)) {
            db.prepare('INSERT OR IGNORE INTO graph_edges (source, target, weight, rel_type) VALUES (?, ?, ?, ?)').run(entryId, row.entry_id, 0.6, 'TYPE_MATCH');
        }
        for (const row of db.prepare('SELECT entry_id FROM graph_nodes WHERE tier = ? AND type != ? AND entry_id != ? ORDER BY RANDOM() LIMIT 1').all(tier, type, entryId)) {
            db.prepare('INSERT OR IGNORE INTO graph_edges (source, target, weight, rel_type) VALUES (?, ?, ?, ?)').run(entryId, row.entry_id, 0.4, 'TIER_MATCH');
        }
    }
    rowToNode(row) {
        return { id: row.entry_id, label: row.label, type: row.type, tier: row.tier, x: row.x, y: row.y, z: row.z, level: row.level, clusterId: row.cluster_id };
    }
}
//# sourceMappingURL=SqliteGraphService.js.map