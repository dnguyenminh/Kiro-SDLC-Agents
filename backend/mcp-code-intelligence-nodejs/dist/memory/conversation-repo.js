"use strict";
/**
 * ConversationRepository — CRUD for structured conversation turns.
 * Stores conversations as structured JSON (role, content, turn, session).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationRepository = void 0;
class ConversationRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    /** Save a conversation turn. Returns turn ID. */
    saveTurn(sessionId, role, content, toolCalls, metadata) {
        const sid = sessionId || `session-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}`;
        const turnNumber = this.getNextTurnNumber(sid);
        const stmt = this.db.prepare(`INSERT INTO conversation_turns (session_id, turn_number, role, content, tool_calls, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`);
        const result = stmt.run(sid, turnNumber, role, content, toolCalls ? JSON.stringify(toolCalls) : null, metadata ? JSON.stringify(metadata) : null);
        return result.lastInsertRowid;
    }
    /** Get all turns for a session, ordered by turn number. */
    getSession(sessionId, limit = 100) {
        return this.db.prepare('SELECT * FROM conversation_turns WHERE session_id = ? ORDER BY turn_number ASC LIMIT ?').all(sessionId, limit);
    }
    /** List sessions with conversation data. */
    listSessions(limit = 20) {
        const rows = this.db.prepare(`
      SELECT session_id,
             COUNT(*) as turn_count,
             MIN(created_at) as first_turn_at,
             MAX(created_at) as last_turn_at
      FROM conversation_turns
      GROUP BY session_id
      ORDER BY last_turn_at DESC
      LIMIT ?
    `).all(limit);
        return rows.map(r => ({
            ...r,
            roles: this.getSessionRoles(r.session_id),
        }));
    }
    /** Search turns by content. */
    searchTurns(query, limit = 20) {
        return this.db.prepare('SELECT * FROM conversation_turns WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?').all(`%${query}%`, limit);
    }
    /** Get turns by time range. */
    getTurnsByTimeRange(after, before, limit = 50) {
        if (before) {
            return this.db.prepare('SELECT * FROM conversation_turns WHERE created_at >= ? AND created_at <= ? ORDER BY created_at ASC LIMIT ?').all(after, before, limit);
        }
        return this.db.prepare('SELECT * FROM conversation_turns WHERE created_at >= ? ORDER BY created_at ASC LIMIT ?').all(after, limit);
    }
    /** Get turn count for a session. */
    getSessionTurnCount(sessionId) {
        const row = this.db.prepare('SELECT COUNT(*) as cnt FROM conversation_turns WHERE session_id = ?').get(sessionId);
        return row.cnt;
    }
    getNextTurnNumber(sessionId) {
        const row = this.db.prepare('SELECT MAX(turn_number) as mx FROM conversation_turns WHERE session_id = ?').get(sessionId);
        return (row.mx ?? 0) + 1;
    }
    getSessionRoles(sessionId) {
        const rows = this.db.prepare('SELECT DISTINCT role FROM conversation_turns WHERE session_id = ?').all(sessionId);
        return rows.map(r => r.role);
    }
}
exports.ConversationRepository = ConversationRepository;
//# sourceMappingURL=conversation-repo.js.map