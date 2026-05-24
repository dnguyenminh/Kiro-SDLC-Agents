/**
 * Migration runner — sequential, versioned schema migrations.
 * Each migration is applied once and tracked in schema_version table.
 */
import Database from 'better-sqlite3';
/** Get current schema version from database. */
export declare function getCurrentVersion(db: Database.Database): number;
/** Run all pending migrations sequentially. */
export declare function runMigrations(db: Database.Database): void;
//# sourceMappingURL=migrations.d.ts.map