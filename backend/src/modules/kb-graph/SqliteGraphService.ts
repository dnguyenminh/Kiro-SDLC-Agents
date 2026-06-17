/**
 * SqliteGraphService — Embedded graph layer using SQLite for KB Graph visualization.
 * 
 * Zero external dependencies — uses the existing admin.db with graph_nodes + graph_edges tables.
 * Provides spatial bounding-box queries for progressive 3D loading.
 * New KB entries auto-get 3D positions computed via Fibonacci sphere layout.
 */

import type { Logger } from 'pino';
import { getAdminDb, getKbEntries } from '../../admin/admin-db.js';

export interface SpatialQueryParams {
  camX: number;
  camY: number;
  camZ: number;
  zoom: number;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  tier: string;
  x: number;
  y: number;
  z: number;
  level: number;
  clusterId: string | null;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  type: string;
}

export interface SpatialGraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    queryTimeMs: number;
    level: string;
    totalInDb: number;
    totalEdgesInDb: number;
  };
}

const LEVEL_MAP: Record<string, number> = {
  ARCHITECTURE: 0, REQUIREMENT: 0, DECISION: 0,
  PROCEDURE: 0, CONTEXT: 0, CODE_ENTITY: 0,
  LESSON_LEARNED: 1, ERROR_PATTERN: 1, DOCUMENT: 1,
};

export class SqliteGraphService {
  private logger: Logger;
  private _ready = false;

  constructor(logger: Logger) {
    this.logger = logger.child({ service: 'sqlite-graph' });
  }

  get ready(): boolean { return this._ready; }

  initialize(): void {
    const db = getAdminDb();
    const count = (db.prepare('SELECT COUNT(*) as cnt FROM graph_nodes').get() as any).cnt;
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

  getNodeCount(): number {
    return (getAdminDb().prepare('SELECT COUNT(*) as cnt FROM graph_nodes').get() as any).cnt;
  }

  addNode(entryId: string, label: string, type: string, tier: string): GraphNode {
    const db = getAdminDb();
    const existing = db.prepare('SELECT entry_id FROM graph_nodes WHERE entry_id = ?').get(entryId);
    if (existing) return this.getNode(entryId)!;

    const count = this.getNodeCount();
    const pos = this.computePosition(count, type);
    db.prepare(`INSERT OR IGNORE INTO graph_nodes (entry_id, label, type, tier, x, y, z, level, cluster_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(entryId, label.substring(0, 50), type.toUpperCase(), tier, pos.x, pos.y, pos.z, pos.level, pos.clusterId);
    this.autoCreateEdges(entryId, type.toUpperCase(), tier);
    return { id: entryId, label, type: type.toUpperCase(), tier, ...pos };
  }

  removeNode(entryId: string): void {
    const db = getAdminDb();
    db.prepare('DELETE FROM graph_edges WHERE source = ? OR target = ?').run(entryId, entryId);
    db.prepare('DELETE FROM graph_nodes WHERE entry_id = ?').run(entryId);
  }

  getNode(entryId: string): GraphNode | null {
    const row = getAdminDb().prepare('SELECT * FROM graph_nodes WHERE entry_id = ?').get(entryId) as any;
    if (!row) return null;
    return this.rowToNode(row);
  }

  addEdge(source: string, target: string, weight = 0.5, relType = 'RELATED_TO'): void {
    getAdminDb().prepare('INSERT OR IGNORE INTO graph_edges (source, target, weight, rel_type) VALUES (?, ?, ?, ?)').run(source, target, weight, relType);
  }

  /**
   * Returns ALL node positions (minimal data, no edges) for initial full-load rendering.
   * Optimized for Points-based visualization of 72k+ nodes.
   */
  getAllPositions(): { nodes: { id: string; x: number; y: number; z: number; type: string; tier: string; label: string }[]; total: number } {
    const db = getAdminDb();
    const rows = db.prepare('SELECT entry_id, x, y, z, type, tier, label FROM graph_nodes').all() as any[];
    const nodes = rows.map((r: any) => ({
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

  spatialQuery(params: SpatialQueryParams): SpatialGraphResult {
    const db = getAdminDb();
    const startTime = performance.now();
    const { camX, camY, camZ, zoom } = params;
    // Radius inversely proportional to zoom distance:
    // Far away (zoom=1000) → large radius (500) to show overview
    // Close up (zoom=100) → medium radius (300) to show local detail
    const r = Math.max(200, zoom * 0.5);
    let nodes: GraphNode[];
    let level: string;

    if (zoom > 500) {
      level = 'macro';
      // Sample evenly from each type (no RANDOM — use LIMIT per type)
      const types = (db.prepare('SELECT DISTINCT type FROM graph_nodes WHERE level = 0').all() as any[]).map((r: any) => r.type);
      const perType = Math.max(20, Math.floor(500 / Math.max(types.length, 1)));
      const allNodes: any[] = [];
      for (const t of types) {
        const rows = db.prepare('SELECT * FROM graph_nodes WHERE level = 0 AND type = ? LIMIT ?').all(t, perType) as any[];
        allNodes.push(...rows);
      }
      nodes = allNodes.slice(0, 500).map(this.rowToNode);
    } else if (zoom > 200) {
      level = 'mid';
      // Mid: nodes near camera, include level 0+1
      nodes = (db.prepare(`
        SELECT *, ABS(x - ?) + ABS(y - ?) + ABS(z - ?) as manhattan_dist
        FROM graph_nodes WHERE level <= 1
        ORDER BY manhattan_dist ASC
        LIMIT 1500
      `).all(camX, camY, camZ) as any[]).map(this.rowToNode);
    } else {
      level = 'micro';
      // Close up: get ALL nodes near camera position
      const nearNodes = db.prepare(`
        SELECT *, ABS(x - ?) + ABS(y - ?) + ABS(z - ?) as manhattan_dist
        FROM graph_nodes
        ORDER BY manhattan_dist ASC
        LIMIT 10000
      `).all(camX, camY, camZ) as any[];
      nodes = nearNodes.map(this.rowToNode);
    }

    let edges: GraphEdge[] = [];
    if (nodes.length > 0 && nodes.length <= 500) {
      // For small sets: direct indexed lookups per node (fast)
      const nodeIdSet = new Set(nodes.map(n => n.id));
      for (const id of nodeIdSet) {
        const rows = db.prepare('SELECT * FROM graph_edges WHERE source = ? LIMIT 10').all(id) as any[];
        for (const r of rows) {
          if (nodeIdSet.has(r.target)) {
            edges.push({ source: r.source, target: r.target, weight: r.weight, type: r.rel_type });
          }
        }
        if (edges.length >= 3000) break;
      }
    } else if (nodes.length > 500) {
      // For larger sets: use temp table JOIN
      const ids = nodes.map(n => n.id);
      db.exec('CREATE TEMP TABLE IF NOT EXISTS _vis (id TEXT PRIMARY KEY)');
      db.exec('DELETE FROM _vis');
      const ins = db.prepare('INSERT OR IGNORE INTO _vis VALUES (?)');
      db.transaction(() => { for (const id of ids) ins.run(id); })();
      edges = (db.prepare(`SELECT e.source, e.target, e.weight, e.rel_type FROM graph_edges e INNER JOIN _vis v1 ON e.source = v1.id INNER JOIN _vis v2 ON e.target = v2.id LIMIT 3000`).all() as any[])
        .map((r: any) => ({ source: r.source, target: r.target, weight: r.weight, type: r.rel_type }));
    }

    const queryTimeMs = performance.now() - startTime;
    // Cache counts (expensive full-table scans on 354k rows)
    if (!(this as any)._cachedEdgeCount || Date.now() - ((this as any)._cachedEdgeCountTime || 0) > 60000) {
      (this as any)._cachedEdgeCount = (db.prepare('SELECT COUNT(*) as cnt FROM graph_edges').get() as any).cnt;
      (this as any)._cachedNodeCount = this.getNodeCount();
      (this as any)._cachedEdgeCountTime = Date.now();
    }
    return { nodes, edges, stats: { totalNodes: nodes.length, totalEdges: edges.length, queryTimeMs: Math.round(queryTimeMs * 100) / 100, level, totalInDb: (this as any)._cachedNodeCount || 0, totalEdgesInDb: (this as any)._cachedEdgeCount || 0 } };
  }

  syncFromEntries(entries: any[]): { nodesCreated: number; edgesCreated: number } {
    const db = getAdminDb();
    let nodesCreated = 0;
    let edgesCreated = 0;
    const groups = new Map<string, number>();
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
        if (!groups.has(type)) groups.set(type, groupCounter++);
        const groupId = groups.get(type)!;
        const pos = this.computePositionByIndex(i, n, type, groupId, groupCounter);
        insertNode.run(id, label, type, tier, pos.x, pos.y, pos.z, pos.level, pos.clusterId);
        nodesCreated++;
      }

      // Create edges based on SPATIAL PROXIMITY (k-nearest neighbors)
      // Each node connects to its 3 nearest neighbors by 3D distance
      const allNodeRows = db.prepare('SELECT entry_id, x, y, z, cluster_id FROM graph_nodes').all() as any[];

      // For performance with large datasets, use bucket-based approach
      const bucketSize = 100;
      const buckets = new Map<string, any[]>();
      for (const row of allNodeRows) {
        const bx = Math.floor(row.x / bucketSize);
        const by = Math.floor(row.y / bucketSize);
        const bz = Math.floor(row.z / bucketSize);
        const key = `${bx},${by},${bz}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key)!.push(row);
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
      const clusterMap = new Map<string, string>();
      for (const row of allNodeRows) {
        const cid = row.cluster_id || 'default';
        if (!clusterMap.has(cid)) clusterMap.set(cid, row.entry_id);
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

  private computePosition(index: number, type: string) {
    const db = getAdminDb();
    const typeRows = db.prepare('SELECT DISTINCT type FROM graph_nodes').all() as any[];
    const groups = new Map<string, number>();
    let gc = 0;
    for (const r of typeRows) { groups.set(r.type, gc++); }
    if (!groups.has(type.toUpperCase())) groups.set(type.toUpperCase(), gc++);
    return this.computePositionByIndex(index, this.getNodeCount() + 1, type, groups.get(type.toUpperCase()) || 0, gc || 1);
  }

  private computePositionByIndex(i: number, total: number, type: string, groupId: number, groupCount: number) {
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

  private autoCreateEdges(entryId: string, type: string, tier: string): void {
    const db = getAdminDb();
    for (const row of db.prepare('SELECT entry_id FROM graph_nodes WHERE type = ? AND entry_id != ? ORDER BY RANDOM() LIMIT 3').all(type, entryId) as any[]) {
      db.prepare('INSERT OR IGNORE INTO graph_edges (source, target, weight, rel_type) VALUES (?, ?, ?, ?)').run(entryId, row.entry_id, 0.6, 'TYPE_MATCH');
    }
    for (const row of db.prepare('SELECT entry_id FROM graph_nodes WHERE tier = ? AND type != ? AND entry_id != ? ORDER BY RANDOM() LIMIT 1').all(tier, type, entryId) as any[]) {
      db.prepare('INSERT OR IGNORE INTO graph_edges (source, target, weight, rel_type) VALUES (?, ?, ?, ?)').run(entryId, row.entry_id, 0.4, 'TIER_MATCH');
    }
  }

  private rowToNode(row: any): GraphNode {
    return { id: row.entry_id, label: row.label, type: row.type, tier: row.tier, x: row.x, y: row.y, z: row.z, level: row.level, clusterId: row.cluster_id };
  }
}
