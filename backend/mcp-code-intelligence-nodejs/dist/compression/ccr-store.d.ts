/**
 * CCR Store — Context Compression and Retrieval (SQLite)
 * KSA-244: Persists original content for on-demand retrieval by LLM
 *
 * TTL: 1 hour, Max entries: 1000, Eviction: LRU
 * Budget: < 2ms per store/retrieve operation.
 */
import Database from 'better-sqlite3';
import { CCREntry } from './types.js';
export declare class CCRStore {
    private db;
    private maxEntries;
    private ttlMs;
    private storeStmt;
    private retrieveStmt;
    private updateAccessStmt;
    private countStmt;
    private evictStmt;
    private cleanupStmt;
    private storeCount;
    constructor(db: Database.Database, maxEntries?: number, ttlMs?: number);
    private initTable;
    private prepareStatements;
    /**
     * Store original content and return a retrieval key.
     * BR-23: Key is crypto.randomUUID()
     */
    store(original: string, contentType: string): string;
    /**
     * Retrieve original content by key.
     * Returns null if expired or not found.
     */
    retrieve(key: string): CCREntry | null;
    /**
     * BR-22: Evict LRU entries if at capacity.
     */
    private evictIfNeeded;
    /**
     * Remove expired entries.
     */
    private cleanup;
}
//# sourceMappingURL=ccr-store.d.ts.map