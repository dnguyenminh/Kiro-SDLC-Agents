/**
 * KSA-161: SQLite CRUD for complexity results.
 */
import Database from 'better-sqlite3';
import type { ComplexityResult, ComplexityFilters, ComplexityQueryResult } from './types.js';
export declare class ComplexityStore {
    private db;
    private stmts;
    constructor(db: Database.Database);
    /** Store or update complexity result for a symbol. */
    upsert(result: ComplexityResult): void;
    /** Batch upsert complexity results. */
    upsertBatch(results: ComplexityResult[]): void;
    /** Get complexity for a specific symbol. */
    getBySymbol(symbolId: number): ComplexityResult | null;
    /** Query complexity results with filters. */
    query(filters: ComplexityFilters): ComplexityQueryResult;
    /** Delete complexity data for a symbol. */
    deleteBySymbol(symbolId: number): void;
    private ensureTable;
    private prepareStatements;
}
