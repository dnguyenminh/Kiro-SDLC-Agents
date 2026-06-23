/**
 * KSA-162: Entry Point Store — SQLite CRUD for detected entry points.
 */
import Database from 'better-sqlite3';
import type { EntryPoint, EntryPointFilters, EntryPointQueryResult } from './types.js';
export declare class EntryPointStore {
    private db;
    private stmts;
    constructor(db: Database.Database);
    /** Store or update an entry point. */
    upsert(ep: EntryPoint): void;
    /** Batch upsert entry points. */
    upsertBatch(entries: EntryPoint[]): void;
    /** Query entry points with filters. */
    query(filters: EntryPointFilters): EntryPointQueryResult;
    /** Delete entry point for a symbol. */
    deleteBySymbol(symbolId: number): void;
    private ensureTable;
    private prepareStatements;
}
