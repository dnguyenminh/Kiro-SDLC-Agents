/**
 * DatabaseManager — SQLite lifecycle management.
 * Handles open, WAL mode, migrations, and graceful close.
 */
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { runMigrations } from './migrations.js';
import { resolveNativeBinding, resolveNativeBindingSync } from './native-addon-resolver.js';
export class DatabaseManager {
    db = null;
    dbPath;
    static resolvedBinding = null; // null = not yet resolved
    static sharedDb = null;
    static initPromise = null;
    constructor(dbPath) {
        this.dbPath = dbPath;
    }
    /**
     * Pre-resolve native binding (async). Call once at server startup before initialize().
     * Downloads prebuilt binary if needed (standalone mode).
     */
    static async preResolveBinding() {
        DatabaseManager.resolvedBinding = await resolveNativeBinding();
    }
    /** Open database, enable WAL, run migrations. */
    initialize() {
        if (DatabaseManager.sharedDb) {
            this.db = DatabaseManager.sharedDb;
            return;
        }
        this.ensureDirectory();
        // Use pre-resolved binding, or try sync resolve as fallback
        const nativeBinding = DatabaseManager.resolvedBinding !== null
            ? DatabaseManager.resolvedBinding
            : resolveNativeBindingSync();
        if (nativeBinding) {
            console.error(`[db] Using native binding: ${nativeBinding}`);
            this.db = new Database(this.dbPath, { nativeBinding });
        }
        else {
            console.error('[db] Using npm-installed better-sqlite3');
            this.db = new Database(this.dbPath);
        }
        this.configureDatabase();
        runMigrations(this.db);
        DatabaseManager.sharedDb = this.db;
        console.error(`[db] Initialized at ${this.dbPath}`);
    }
    /** Get the underlying database instance. */
    getDb() {
        if (!this.db)
            throw new Error('Database not initialized');
        return this.db;
    }
    /** Close database connection gracefully. */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            console.error('[db] Connection closed');
        }
    }
    ensureDirectory() {
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    configureDatabase() {
        if (!this.db)
            return;
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.db.pragma('cache_size = -64000');
        this.db.pragma('foreign_keys = ON');
        this.db.pragma('temp_store = MEMORY');
    }
}
//# sourceMappingURL=database-manager.js.map