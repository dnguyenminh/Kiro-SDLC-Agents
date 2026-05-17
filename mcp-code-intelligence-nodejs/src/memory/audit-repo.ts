/**
 * AuditRepository — logs all memory operations for observability.
 */

import Database from 'better-sqlite3';
import { AuditEntry } from './models.js';

export class AuditRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /** Log an operation to the audit trail. */
  log(operation: string, entryId?: number, sessionId?: string, details?: string): void {
    this.db.prepare(`
      INSERT INTO memory_audit (operation, entry_id, session_id, details)
      VALUES (?, ?, ?, ?)
    `).run(operation, entryId ?? null, sessionId ?? null, details ?? null);
  }

  /** List audit entries for a specific session. */
  listBySession(sessionId: string, limit = 200): AuditEntry[] {
    return this.db.prepare(
      'SELECT * FROM memory_audit WHERE session_id = ? ORDER BY created_at ASC LIMIT ?'
    ).all(sessionId, limit) as AuditEntry[];
  }

  /** List recent audit entries. */
  listRecent(limit = 20, operation?: string): AuditEntry[] {
    if (operation) {
      return this.db.prepare(
        'SELECT * FROM memory_audit WHERE operation = ? ORDER BY id DESC LIMIT ?'
      ).all(operation, limit) as AuditEntry[];
    }
    return this.db.prepare(
      'SELECT * FROM memory_audit ORDER BY id DESC LIMIT ?'
    ).all(limit) as AuditEntry[];
  }

  /** List audit entries after a given ID (for streaming). */
  listRecentAfterId(afterId: number, limit = 20): AuditEntry[] {
    return this.db.prepare(
      'SELECT * FROM memory_audit WHERE id > ? ORDER BY id DESC LIMIT ?'
    ).all(afterId, limit) as AuditEntry[];
  }

  /** List audit entries with exclude filter (for stream tab). */
  listFiltered(limit: number, afterId: number | null, exclude: string[]): AuditEntry[] {
    const clauses: string[] = [];
    const params: any[] = [];
    if (afterId !== null) { clauses.push('id > ?'); params.push(afterId); }
    if (exclude.length > 0) {
      clauses.push(`operation NOT IN (${exclude.map(() => '?').join(',')})`);
      params.push(...exclude);
    }
    const where = clauses.length > 0 ? ' WHERE ' + clauses.join(' AND ') : '';
    params.push(limit);
    return this.db.prepare(
      `SELECT * FROM memory_audit${where} ORDER BY id DESC LIMIT ?`
    ).all(...params) as AuditEntry[];
  }
}
