/**
 * KSA-153: Schema Migrator — Applies graph schema migrations.
 * Extends the existing migration system with graph-specific tables and columns.
 */
import Database from 'better-sqlite3';
/**
 * Run graph-related migrations (KSA-153 + KSA-169).
 * Safe to call multiple times — all operations are idempotent.
 */
export declare function runGraphMigrations(db: Database.Database): void;
/** Check if graph migrations have been applied. */
export declare function isGraphSchemaReady(db: Database.Database): boolean;
