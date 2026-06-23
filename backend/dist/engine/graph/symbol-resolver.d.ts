/**
 * KSA-154: Symbol Resolver — resolves symbol names to database records.
 * Supports exact match, qualified names (Class.method), and file:symbol format.
 */
import Database from 'better-sqlite3';
export interface ResolvedSymbol {
    id: number;
    name: string;
    kind: string;
    filePath: string;
    line: number;
    parentSymbolId: number | null;
}
export declare class SymbolResolver {
    private db;
    private stmts;
    constructor(db: Database.Database);
    /** Resolve a symbol name to one or more database records. */
    resolve(input: string): ResolvedSymbol[];
    /** Suggest similar symbol names for "did you mean?" responses. */
    suggest(input: string, limit?: number): string[];
}
