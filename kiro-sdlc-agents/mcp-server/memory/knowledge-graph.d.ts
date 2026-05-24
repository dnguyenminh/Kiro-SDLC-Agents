/**
 * KnowledgeGraph — in-memory graph with SQLite persistence.
 * Provides BFS, shortest path, and ego graph traversal.
 */
import { GraphEdge } from './models.js';
import { GraphRepository } from './graph-repo.js';
export declare class KnowledgeGraph {
    private readonly repo;
    private adjacency;
    private reverseAdj;
    constructor(repo: GraphRepository);
    /** Load graph from database into memory. */
    loadFromDb(): void;
    /** Add edge and persist to DB. Returns edge ID. */
    addEdge(edge: Partial<GraphEdge>): number;
    /** Get all connected node IDs (both directions). */
    getConnected(nodeId: number): Set<number>;
    /** BFS shortest path. Returns null if no path. */
    shortestPath(from: number, to: number): number[] | null;
    /** Ego graph — all nodes within radius hops. */
    egoGraph(nodeId: number, radius?: number): Set<number>;
    private addToMemory;
    private reconstructPath;
}
//# sourceMappingURL=knowledge-graph.d.ts.map