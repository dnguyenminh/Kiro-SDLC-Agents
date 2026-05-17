/**
 * KnowledgeGraph — in-memory graph with SQLite persistence.
 * Provides BFS, shortest path, and ego graph traversal.
 */

import { GraphEdge } from './models.js';
import { GraphRepository } from './graph-repo.js';

export class KnowledgeGraph {
  private readonly repo: GraphRepository;
  private adjacency = new Map<number, Set<number>>();
  private reverseAdj = new Map<number, Set<number>>();

  constructor(repo: GraphRepository) {
    this.repo = repo;
  }

  /** Load graph from database into memory. */
  loadFromDb(): void {
    const edges = this.repo.findAll();
    for (const edge of edges) this.addToMemory(edge);
    console.error(`[graph] Loaded: ${this.adjacency.size} nodes, ${edges.length} edges`);
  }

  /** Add edge and persist to DB. Returns edge ID. */
  addEdge(edge: Partial<GraphEdge>): number {
    const id = this.repo.addEdge(edge);
    this.addToMemory({ ...edge, id } as GraphEdge);
    return id;
  }

  /** Get all connected node IDs (both directions). */
  getConnected(nodeId: number): Set<number> {
    const out = this.adjacency.get(nodeId) ?? new Set();
    const inc = this.reverseAdj.get(nodeId) ?? new Set();
    return new Set([...out, ...inc]);
  }

  /** BFS shortest path. Returns null if no path. */
  shortestPath(from: number, to: number): number[] | null {
    if (from === to) return [from];
    const queue: number[] = [from];
    const parent = new Map<number, number>();
    const seen = new Set([from]);
    while (queue.length > 0) {
      const node = queue.shift()!;
      for (const neighbor of this.adjacency.get(node) ?? []) {
        if (seen.has(neighbor)) continue;
        parent.set(neighbor, node);
        if (neighbor === to) return this.reconstructPath(parent, from, to);
        seen.add(neighbor);
        queue.push(neighbor);
      }
    }
    return null;
  }

  /** Ego graph — all nodes within radius hops. */
  egoGraph(nodeId: number, radius = 2): Set<number> {
    const result = new Set([nodeId]);
    const queue: Array<[number, number]> = [[nodeId, 0]];
    while (queue.length > 0) {
      const [current, depth] = queue.shift()!;
      if (depth >= radius) continue;
      const neighbors = [
        ...(this.adjacency.get(current) ?? []),
        ...(this.reverseAdj.get(current) ?? []),
      ];
      for (const n of neighbors) {
        if (!result.has(n)) {
          result.add(n);
          queue.push([n, depth + 1]);
        }
      }
    }
    return result;
  }

  private addToMemory(edge: GraphEdge): void {
    if (!this.adjacency.has(edge.source_id)) this.adjacency.set(edge.source_id, new Set());
    if (!this.adjacency.has(edge.target_id)) this.adjacency.set(edge.target_id, new Set());
    if (!this.reverseAdj.has(edge.source_id)) this.reverseAdj.set(edge.source_id, new Set());
    if (!this.reverseAdj.has(edge.target_id)) this.reverseAdj.set(edge.target_id, new Set());
    this.adjacency.get(edge.source_id)!.add(edge.target_id);
    this.reverseAdj.get(edge.target_id)!.add(edge.source_id);
  }

  private reconstructPath(parent: Map<number, number>, from: number, to: number): number[] {
    const path = [to];
    let current = to;
    while (current !== from) {
      const p = parent.get(current);
      if (p === undefined) return [];
      path.push(p);
      current = p;
    }
    return path.reverse();
  }
}
