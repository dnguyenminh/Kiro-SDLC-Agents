/**
 * KSA-163: Graph Loader — Loads subgraphs from the relationships table.
 */
import Database from 'better-sqlite3';
import type { AdjacencyList } from '../types.js';
export interface SymbolInfo {
    id: number;
    name: string;
    kind: string;
    filePath: string;
}
export declare class GraphLoader {
    private db;
    constructor(db: Database.Database);
    /** Load the import/dependency graph as adjacency list. */
    loadDependencyGraph(module?: string): AdjacencyList;
    /** Load the call graph as adjacency list (caller → callee). */
    loadCallGraph(module?: string): AdjacencyList;
    /** Load reverse call graph (callee → callers). */
    loadReverseCallGraph(module?: string): AdjacencyList;
    /** Get symbol info by ID. */
    getSymbolInfo(symbolId: number): SymbolInfo | null;
    /** Get symbol info for multiple IDs. */
    getSymbolInfoBatch(symbolIds: number[]): Map<number, SymbolInfo>;
    /** Resolve a symbol name to its ID. */
    resolveSymbolId(name: string, filePath?: string): number | null;
}
