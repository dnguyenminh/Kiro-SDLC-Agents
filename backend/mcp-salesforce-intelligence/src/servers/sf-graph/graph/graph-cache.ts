/**
 * Graph cache — persists DependencyGraph to JSON file.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { GraphCacheData } from '../../../shared/types.js';
import { DependencyGraph } from './dependency-graph.js';

const CACHE_FILENAME = '.sf-graph-cache.json';
const CACHE_VERSION = 1;

export class GraphCache {
  private cachePath: string;

  constructor(projectRoot: string) {
    this.cachePath = path.join(projectRoot, CACHE_FILENAME);
  }

  load(): DependencyGraph | null {
    try {
      if (!fs.existsSync(this.cachePath)) return null;
      const content = fs.readFileSync(this.cachePath, 'utf-8');
      const data: GraphCacheData = JSON.parse(content);
      if (data.version !== CACHE_VERSION) return null;

      const graph = new DependencyGraph();
      for (const node of data.nodes) graph.addNode(node);
      for (const edge of data.edges) graph.addEdge(edge.source, edge.target, edge.relationship);
      return graph;
    } catch {
      return null;
    }
  }

  save(graph: DependencyGraph): void {
    try {
      const data: GraphCacheData = {
        version: CACHE_VERSION,
        built_at: new Date().toISOString(),
        nodes: graph.getAllNodes(),
        edges: graph.getAllEdges(),
      };
      fs.writeFileSync(this.cachePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[graph-cache] Failed to save:', (err as Error).message);
    }
  }

  invalidate(): void {
    try {
      if (fs.existsSync(this.cachePath)) fs.unlinkSync(this.cachePath);
    } catch { /* ignore */ }
  }
}
