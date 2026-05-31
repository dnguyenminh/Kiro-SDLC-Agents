/**
 * KSA-153: Graph Repository — CRUD operations for the code relationship graph.
 * Provides prepared-statement-based access to the relationships table.
 */
import Database from 'better-sqlite3';
export interface CallerResult {
    name: string;
    kind: string;
    file_path: string;
    def_line: number;
    call_line: number;
    parameters: string | null;
    is_async: number;
    id: number;
}
export interface CalleeResult {
    name: string;
    call_line: number;
    metadata: string | null;
    kind: string | null;
    file_path: string | null;
    def_line: number | null;
}
export interface RelationshipInput {
    sourceSymbolId: number;
    targetSymbol: string;
    targetSymbolId?: number | null;
    kind: string;
    filePath: string;
    line: number;
    metadata?: Record<string, unknown> | null;
}
export declare class GraphRepository {
    private db;
    private stmts;
    constructor(db: Database.Database);
    /** Insert a batch of relationships within a transaction. */
    insertRelationships(relationships: RelationshipInput[]): void;
    /** Delete all relationships originating from a file. */
    deleteFileRelationships(filePath: string): void;
    /** Find direct callers of a symbol by name. */
    findCallers(symbolName: string, kind?: string, limit?: number): CallerResult[];
    /** Find direct callees of a symbol by ID. */
    findCallees(symbolId: number, kind?: string, limit?: number): CalleeResult[];
    /** Resolve target_symbol_id for unresolved relationships (batch). */
    resolveTargets(batchSize?: number): number;
    /** Get total relationship count. */
    getRelationshipCount(): number;
    /** Get relationship statistics by kind. */
    getStats(): {
        kind: string;
        count: number;
    }[];
    private prepareStatements;
}
//# sourceMappingURL=graph-repository.d.ts.map