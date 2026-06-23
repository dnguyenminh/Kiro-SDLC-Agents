/**
 * GraphRepository — CRUD for knowledge graph edges (SQLite persistence).
 */
import Database from 'better-sqlite3';
import { GraphEdge } from './models.js';
export declare class GraphRepository {
    private readonly db;
    constructor(db: Database.Database);
    /** Add an edge between two knowledge entries. */
    addEdge(edge: Partial<GraphEdge>): number;
    /** Get all edges for a node (both directions). */
    getConnected(entryId: number): GraphEdge[];
    /** Get all edges (for loading graph into memory). */
    findAll(limit?: number): GraphEdge[];
    /** Remove an edge by ID. */
    removeEdge(id: number): void;
    /** Count total edges. */
    countEdges(): number;
    /** Check if edge exists (direction-agnostic). KSA-190. */
    edgeExists(sourceId: number, targetId: number, relation: string): boolean;
    /** Find entries with 0 edges (orphans). KSA-190. */
    findOrphans(limit?: number): number[];
}
//# sourceMappingURL=graph-repo.d.ts.map