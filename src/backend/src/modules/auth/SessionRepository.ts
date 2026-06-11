/**
 * SessionRepository — CRUD operations for the sessions table.
 * Implements TDD §4.2 sessions table, BR-3, BR-18.
 */

import { SessionRecord } from './types';
import { IDatabase } from './UserRepository';

export class SessionRepository {
  constructor(private readonly db: IDatabase) {}

  create(session: {
    id: string;
    user_id: string;
    refresh_token_hash: string;
    expires_at: string;
    user_agent?: string;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, user_id, refresh_token_hash, expires_at, user_agent)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      session.id,
      session.user_id,
      session.refresh_token_hash,
      session.expires_at,
      session.user_agent ?? null,
    );
  }

  findByRefreshTokenHash(hash: string): SessionRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions
      WHERE refresh_token_hash = ? AND revoked = 0 AND expires_at > datetime('now')
    `);
    const row = stmt.get(hash) as SessionRecord | undefined;
    return row ?? null;
  }

  revoke(sessionId: string): void {
    this.db.prepare(`
      UPDATE sessions SET revoked = 1, revoked_at = datetime('now') WHERE id = ?
    `).run(sessionId);
  }

  revokeByRefreshTokenHash(hash: string): void {
    this.db.prepare(`
      UPDATE sessions SET revoked = 1, revoked_at = datetime('now') WHERE refresh_token_hash = ?
    `).run(hash);
  }

  revokeAllForUser(userId: string): void {
    this.db.prepare(`
      UPDATE sessions SET revoked = 1, revoked_at = datetime('now') WHERE user_id = ? AND revoked = 0
    `).run(userId);
  }

  cleanupExpired(): number {
    const result = this.db.prepare(`
      DELETE FROM sessions WHERE expires_at < datetime('now') OR revoked = 1
    `).run();
    return result.changes;
  }
}
