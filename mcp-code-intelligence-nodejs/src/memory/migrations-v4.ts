/**
 * V4 migration runner — adds agent_name column to knowledge_entries.
 * Idempotent — safe to call multiple times.
 */

import Database from 'better-sqlite3';
import { SCHEMA_V4_AGENT_NAME_ALTER, SCHEMA_V4_AGENT_NAME_INDEX } from './schema-v4.js';

/** Run all V4 migrations (idempotent). */
export function runV4Migrations(db: Database.Database): void {
  runAlterStatements(db, SCHEMA_V4_AGENT_NAME_ALTER);
  safeExec(db, SCHEMA_V4_AGENT_NAME_INDEX);
}

/** Run ALTER statements one by one, ignoring "duplicate column" errors. */
function runAlterStatements(db: Database.Database, stmts: string[]): void {
  for (const sql of stmts) {
    try {
      db.exec(sql);
    } catch (err: unknown) {
      const msg = (err as Error).message ?? '';
      if (!msg.includes('duplicate column')) throw err;
    }
  }
}

/** Execute multi-statement SQL, ignoring "already exists" errors. */
function safeExec(db: Database.Database, sql: string): void {
  try {
    db.exec(sql);
  } catch (err: unknown) {
    const msg = (err as Error).message ?? '';
    if (!msg.includes('already exists')) throw err;
  }
}
