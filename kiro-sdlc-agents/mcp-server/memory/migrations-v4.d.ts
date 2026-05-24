/**
 * V4 migration runner — adds agent_name column to knowledge_entries.
 * Idempotent — safe to call multiple times.
 */
import Database from 'better-sqlite3';
/** Run all V4 migrations (idempotent). */
export declare function runV4Migrations(db: Database.Database): void;
//# sourceMappingURL=migrations-v4.d.ts.map