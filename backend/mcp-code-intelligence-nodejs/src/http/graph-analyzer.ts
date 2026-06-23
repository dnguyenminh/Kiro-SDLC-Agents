/**
 * GraphAnalyzer — server-side graph structure analysis for KB.
 * Port of Python graph_analyzer.py.
 */

import Database from 'better-sqlite3';

interface GraphInsight {
  type: string;
  title: string;
  description: string;
  node_ids: number[];
  severity: string;
  action: { label: string; endpoint: string; method: string } | null;
}

interface GraphAnalysisResult {
  insights: GraphInsight[];
  stats: { node_count: number; edge_count: number; density: number };
  computed_at: string;
}

export class GraphAnalyzer {
  constructor(private readonly db: Database.Database) {}

  analyze(): GraphAnalysisResult {
    const stats = this.computeStats();
    const insights: GraphInsight[] = [
      ...this.findOrphans(),
      ...this.findHubs(),
      ...this.findClusters(),
      ...this.findStaleNodes(),
    ];
    return { insights, stats, computed_at: new Date().toISOString() };
  }

  private computeStats(): { node_count: number; edge_count: number; density: number } {
    try {
      const nc = (this.db.prepare('SELECT COUNT(*) as c FROM knowledge_entries').get() as { c: number }).c;
      const ec = (this.db.prepare('SELECT COUNT(*) as c FROM knowledge_graph_edges').get() as { c: number }).c;
      const maxEdges = nc > 1 ? nc * (nc - 1) : 1;
      return { node_count: nc, edge_count: ec, density: Math.round((ec / maxEdges) * 10000) / 10000 };
    } catch {
      return { node_count: 0, edge_count: 0, density: 0 };
    }
  }

  private findOrphans(): GraphInsight[] {
    try {
      const rows = this.db.prepare(
        `SELECT e.id FROM knowledge_entries e WHERE e.id NOT IN (
           SELECT source_id FROM knowledge_graph_edges
           UNION SELECT target_id FROM knowledge_graph_edges
         ) LIMIT 20`
      ).all() as { id: number }[];
      if (!rows.length) return [];
      return [{
        type: 'orphans', title: `${rows.length} Orphan Nodes`,
        description: 'Entries không có relationships nào',
        node_ids: rows.map(r => r.id), severity: 'warning',
        action: { label: 'Find Related', endpoint: 'api/kb/entries/{id}/find-related', method: 'POST' },
      }];
    } catch { return []; }
  }

  private findHubs(): GraphInsight[] {
    try {
      const rows = this.db.prepare(
        `SELECT node_id, SUM(cnt) as total FROM (
           SELECT source_id AS node_id, COUNT(*) AS cnt FROM knowledge_graph_edges GROUP BY source_id
           UNION ALL
           SELECT target_id AS node_id, COUNT(*) AS cnt FROM knowledge_graph_edges GROUP BY target_id
         ) GROUP BY node_id HAVING total > 10 ORDER BY total DESC LIMIT 10`
      ).all() as { node_id: number; total: number }[];
      if (!rows.length) return [];
      return [{
        type: 'hubs', title: `${rows.length} Hub Nodes`,
        description: 'Entries có >10 relationships (highly connected)',
        node_ids: rows.map(r => r.node_id), severity: 'info', action: null,
      }];
    } catch { return []; }
  }

  private findClusters(): GraphInsight[] {
    try {
      const edges = this.db.prepare('SELECT source_id, target_id FROM knowledge_graph_edges')
        .all() as { source_id: number; target_id: number }[];
      const nodes = this.db.prepare('SELECT id FROM knowledge_entries')
        .all() as { id: number }[];
      if (!nodes.length) return [];
      const adj = new Map<number, Set<number>>();
      for (const n of nodes) adj.set(n.id, new Set());
      for (const e of edges) {
        adj.get(e.source_id)?.add(e.target_id);
        adj.get(e.target_id)?.add(e.source_id);
      }
      const components = countComponents(adj);
      if (components <= 1) return [];
      return [{
        type: 'clusters', title: `${components} Disconnected Clusters`,
        description: 'Graph có nhiều components tách biệt',
        node_ids: [], severity: 'info', action: null,
      }];
    } catch { return []; }
  }

  private findStaleNodes(): GraphInsight[] {
    const threshold = new Date(Date.now() - 180 * 86400000).toISOString();
    try {
      const rows = this.db.prepare(
        'SELECT id FROM knowledge_entries WHERE updated_at < ? LIMIT 15'
      ).all(threshold) as { id: number }[];
      if (!rows.length) return [];
      return [{
        type: 'stale', title: `${rows.length} Stale Nodes (>180 days)`,
        description: 'Entries chưa được update > 180 ngày',
        node_ids: rows.map(r => r.id), severity: 'warning',
        action: { label: 'Review', endpoint: 'api/kb/entries/{id}/review', method: 'POST' },
      }];
    } catch { return []; }
  }
}

/** Count connected components via BFS. */
function countComponents(adj: Map<number, Set<number>>): number {
  const visited = new Set<number>();
  let components = 0;
  for (const node of adj.keys()) {
    if (visited.has(node)) continue;
    components++;
    const queue = [node];
    while (queue.length) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const neighbor of adj.get(current) ?? []) {
        if (!visited.has(neighbor)) queue.push(neighbor);
      }
    }
  }
  return components;
}
