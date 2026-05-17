/**
 * SessionRepository — tracks MCP sessions (one per connection).
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { MemorySession } from './models.js';

export class SessionRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /** Start a new session, returns session ID (8-char UUID prefix). */
  startSession(agentName?: string): string {
    const sessionId = randomUUID().slice(0, 8);
    this.db.prepare(
      'INSERT INTO memory_sessions (session_id, agent_name) VALUES (?, ?)'
    ).run(sessionId, agentName ?? null);
    return sessionId;
  }

  /** End a session. */
  endSession(sessionId: string): void {
    this.db.prepare(
      "UPDATE memory_sessions SET status = 'ended', ended_at = datetime('now') WHERE session_id = ?"
    ).run(sessionId);
  }

  /** Increment observation count. */
  incrementObservations(sessionId: string): void {
    this.db.prepare(
      'UPDATE memory_sessions SET observation_count = observation_count + 1 WHERE session_id = ?'
    ).run(sessionId);
  }

  /** List recent sessions. */
  listRecent(limit = 20): MemorySession[] {
    return this.db.prepare(
      'SELECT * FROM memory_sessions ORDER BY started_at DESC LIMIT ?'
    ).all(limit) as MemorySession[];
  }

  /** List sessions with optional agent and status filters. */
  listFiltered(agent: string, status: string, limit: number): MemorySession[] {
    const clauses: string[] = ['1=1'];
    const params: unknown[] = [];
    if (agent) { clauses.push('agent_name = ?'); params.push(agent); }
    if (status) { clauses.push('status = ?'); params.push(status); }
    params.push(limit);
    const where = clauses.join(' AND ');
    return this.db.prepare(
      `SELECT * FROM memory_sessions WHERE ${where} ORDER BY started_at DESC LIMIT ?`
    ).all(...params) as MemorySession[];
  }

  /** Get active session count. */
  activeCount(): number {
    const row = this.db.prepare(
      "SELECT COUNT(*) as cnt FROM memory_sessions WHERE status = 'active'"
    ).get() as { cnt: number };
    return row.cnt;
  }
}
