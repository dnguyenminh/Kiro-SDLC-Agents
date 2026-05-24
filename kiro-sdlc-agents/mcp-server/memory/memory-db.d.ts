/**
 * MemoryDatabaseManager — initializes memory schema on existing DB.
 * Shares the same better-sqlite3 instance as code intelligence.
 */
import Database from 'better-sqlite3';
export declare class MemoryDatabaseManager {
    private readonly db;
    private initialized;
    constructor(db: Database.Database);
    /** Initialize memory tables (idempotent). */
    initialize(): void;
    /** Get underlying database instance. */
    getDb(): Database.Database;
}
//# sourceMappingURL=memory-db.d.ts.map