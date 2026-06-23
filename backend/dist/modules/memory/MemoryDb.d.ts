/**
 * MemoryDatabaseManager — initializes memory schema on a dedicated SQLite DB.
 * Uses index-backend.db (same as extension) for data portability.
 */
import Database from 'better-sqlite3';
/** Get or create the memory database instance (singleton). */
export declare function getMemoryDb(): Database.Database;
/** Close the memory database (for graceful shutdown). */
export declare function closeMemoryDb(): void;
