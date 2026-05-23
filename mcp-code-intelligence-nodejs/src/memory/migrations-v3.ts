/**
 * V3 migration runner — safely applies additive schema changes.
 * Each ALTER is wrapped in try/catch (column may already exist).
 */

import Database from 'better-sqlite3';
import {
  SCHEMA_V3_CORE_MEMORY,
  SCHEMA_V3_CORE_MEMORY_INDEX,
  SCHEMA_V3_CONVERSATION,
  SCHEMA_V3_STRUCTURED_MAP_ALTER,
  SCHEMA_V3_STRUCTURED_MAP_TABLES,
  SCHEMA_V3_QUALITY_ARCHIVE_ALTER,
  SCHEMA_V3_QUALITY_ARCHIVE_INDEXES,
  SCHEMA_V3_AGENT_SCOPE,
  SCHEMA_V3_CONVERSATION_SUMMARIZED,
  SCHEMA_V3_CONVERSATION_INDEXES,
  SCHEMA_V3_ENTITY_FTS,
} from './schema-v3.js';

/** Run all V3 migrations (idempotent — safe to call multiple times). */
export function runV3Migrations(db: Database.Database): void {
  // F1: Core Memory
  runAlterStatements(db, SCHEMA_V3_CORE_MEMORY);
  safeExec(db, SCHEMA_V3_CORE_MEMORY_INDEX);

  // F2: Conversation History
  safeExec(db, SCHEMA_V3_CONVERSATION);
  runAlterStatements(db, SCHEMA_V3_CONVERSATION_SUMMARIZED);
  safeExec(db, SCHEMA_V3_CONVERSATION_INDEXES);

  // F3: Structured Map
  runAlterStatements(db, SCHEMA_V3_STRUCTURED_MAP_ALTER);
  safeExec(db, SCHEMA_V3_STRUCTURED_MAP_TABLES);
  safeExec(db, SCHEMA_V3_ENTITY_FTS);

  // F4: Anti-Pattern Protection
  runAlterStatements(db, SCHEMA_V3_QUALITY_ARCHIVE_ALTER);
  safeExec(db, SCHEMA_V3_QUALITY_ARCHIVE_INDEXES);
  safeExec(db, SCHEMA_V3_AGENT_SCOPE);
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
