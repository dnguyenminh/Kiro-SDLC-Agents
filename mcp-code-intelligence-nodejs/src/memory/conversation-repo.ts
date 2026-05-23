/**
 * ConversationRepository — CRUD for structured conversation turns.
 * Stores conversations as structured JSON (role, content, turn, session).
 */

import Database from 'better-sqlite3';

export interface ConversationTurn {
  id: number;
  session_id: string;
  turn_number: number;
  role: string;
  content: string;
  tool_calls: string | null;
  metadata: string | null;
  created_at: string;
}

export interface SessionSummary {
  session_id: string;
  turn_count: number;
  first_turn_at: string;
  last_turn_at: string;
  roles: string[];
}

export class ConversationRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /** Save a conversation turn. Returns turn ID. */
  saveTurn(sessionId: string, role: string, content: string, toolCalls?: object[], metadata?: object): number {
    const turnNumber = this.getNextTurnNumber(sessionId);
    const stmt = this.db.prepare(
      `INSERT INTO conversation_turns (session_id, turn_number, role, content, tool_calls, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const result = stmt.run(
      sessionId, turnNumber, role, content,
      toolCalls ? JSON.stringify(toolCalls) : null,
      metadata ? JSON.stringify(metadata) : null
    );
    return result.lastInsertRowid as number;
  }

  /** Get all turns for a session, ordered by turn number. */
  getSession(sessionId: string, limit = 100): ConversationTurn[] {
    return this.db.prepare(
      'SELECT * FROM conversation_turns WHERE session_id = ? ORDER BY turn_number ASC LIMIT ?'
    ).all(sessionId, limit) as ConversationTurn[];
  }

  /** List sessions with conversation data. */
  listSessions(limit = 20): SessionSummary[] {
    const rows = this.db.prepare(`
      SELECT session_id,
             COUNT(*) as turn_count,
             MIN(created_at) as first_turn_at,
             MAX(created_at) as last_turn_at
      FROM conversation_turns
      GROUP BY session_id
      ORDER BY last_turn_at DESC
      LIMIT ?
    `).all(limit) as Array<{ session_id: string; turn_count: number; first_turn_at: string; last_turn_at: string }>;

    return rows.map(r => ({
      ...r,
      roles: this.getSessionRoles(r.session_id),
    }));
  }

  /** Search turns by content. */
  searchTurns(query: string, limit = 20): ConversationTurn[] {
    return this.db.prepare(
      'SELECT * FROM conversation_turns WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?'
    ).all(`%${query}%`, limit) as ConversationTurn[];
  }

  /** Get turns by time range. */
  getTurnsByTimeRange(after: string, before?: string, limit = 50): ConversationTurn[] {
    if (before) {
      return this.db.prepare(
        'SELECT * FROM conversation_turns WHERE created_at >= ? AND created_at <= ? ORDER BY created_at ASC LIMIT ?'
      ).all(after, before, limit) as ConversationTurn[];
    }
    return this.db.prepare(
      'SELECT * FROM conversation_turns WHERE created_at >= ? ORDER BY created_at ASC LIMIT ?'
    ).all(after, limit) as ConversationTurn[];
  }

  /** Get turn count for a session. */
  getSessionTurnCount(sessionId: string): number {
    const row = this.db.prepare(
      'SELECT COUNT(*) as cnt FROM conversation_turns WHERE session_id = ?'
    ).get(sessionId) as { cnt: number };
    return row.cnt;
  }

  private getNextTurnNumber(sessionId: string): number {
    const row = this.db.prepare(
      'SELECT MAX(turn_number) as mx FROM conversation_turns WHERE session_id = ?'
    ).get(sessionId) as { mx: number | null };
    return (row.mx ?? 0) + 1;
  }

  private getSessionRoles(sessionId: string): string[] {
    const rows = this.db.prepare(
      'SELECT DISTINCT role FROM conversation_turns WHERE session_id = ?'
    ).all(sessionId) as Array<{ role: string }>;
    return rows.map(r => r.role);
  }
}
