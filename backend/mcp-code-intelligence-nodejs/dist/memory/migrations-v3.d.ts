/**
 * V3 migration runner — safely applies additive schema changes.
 * Each ALTER is wrapped in try/catch (column may already exist).
 */
import Database from 'better-sqlite3';
/** Run all V3 migrations (idempotent — safe to call multiple times). */
export declare function runV3Migrations(db: Database.Database): void;
//# sourceMappingURL=migrations-v3.d.ts.map