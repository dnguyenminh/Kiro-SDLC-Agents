/**
 * DatabaseManager — SQLite lifecycle management.
 * Handles open, WAL mode, migrations, and graceful close.
 */
import Database from 'better-sqlite3';
export declare class DatabaseManager {
    private db;
    private readonly dbPath;
    private static resolvedBinding;
    private static sharedDb;
    private static initPromise;
    constructor(dbPath: string);
    /**
     * Pre-resolve native binding (async). Call once at server startup before initialize().
     * Downloads prebuilt binary if needed (standalone mode).
     */
    static preResolveBinding(): Promise<void>;
    /** Open database, enable WAL, run migrations. */
    initialize(): void;
    /** Get the underlying database instance. */
    getDb(): Database.Database;
    /** Close database connection gracefully. */
    close(): void;
    private ensureDirectory;
    private configureDatabase;
}
