/**
 * MemoryDatabaseManager — initializes memory schema on existing DB.
 * Shares the same better-sqlite3 instance as code intelligence.
 */

import Database from 'better-sqlite3';
import { MEMORY_SCHEMA } from './schema.js';
import { runV3Migrations } from './migrations-v3.js';
import { runV4Migrations } from './migrations-v4.js';

export class MemoryDatabaseManager {
  private readonly db: Database.Database;
  private initialized = false;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /** Initialize memory tables (idempotent). */
  initialize(): void {
    if (this.initialized) return;
    this.db.exec(MEMORY_SCHEMA);
    runV3Migrations(this.db);
    runV4Migrations(this.db);
    this.initialized = true;
    console.error('[memory-db] Schema initialized (v4)');
  }

  /** Get underlying database instance. */
  getDb(): Database.Database {
    return this.db;
  }
}
