/**
 * KSA-155: Dependency Graph Service - BFS traversal on import relationships.
 * Supports outgoing (what does this file import?) and incoming (who imports this file?) queries.
 */
import Database from 'better-sqlite3';
import { FileResolver } from './file-resolver.js';
export interface DependencyNode {
    file: string;
    depth: number;
    importedSymbols: string[];
    isExternal: boolean;
}
export interface DependencyResult {
    root: string;
    direction: string;
    results: DependencyNode[];
    cycles: string[][];
    metadata: {
        totalNodes: number;
        maxDepthReached: number;
        truncated: boolean;
        queryTimeMs: number;
        externalCount: number;
    };
}
export declare class DependencyGraphService {
    private db;
    private fileResolver;
    constructor(db: Database.Database, fileResolver: FileResolver);
    /** Query dependency graph with direction and depth control. */
    query(file: string, direction?: 'incoming' | 'outgoing' | 'both', depth?: number, includeExternal?: boolean, limit?: number, kindFilter?: string | string[]): DependencyResult;
    private bfsTraversal;
    private getOutgoingDeps;
    private getIncomingDeps;
    private extractModule;
    private extractSymbolName;
    private mergeResults;
    private fileNotFoundResponse;
}
