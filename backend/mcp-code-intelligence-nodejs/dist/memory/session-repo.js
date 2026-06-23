"use strict";
/**
 * SessionRepository — tracks MCP sessions (one per connection).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionRepository = void 0;
const crypto_1 = require("crypto");
class SessionRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    /** Start a new session, returns session ID (8-char UUID prefix). */
    startSession(agentName) {
        const sessionId = (0, crypto_1.randomUUID)().slice(0, 8);
        this.db.prepare('INSERT INTO memory_sessions (session_id, agent_name) VALUES (?, ?)').run(sessionId, agentName ?? null);
        return sessionId;
    }
    /** End a session. */
    endSession(sessionId) {
        this.db.prepare("UPDATE memory_sessions SET status = 'ended', ended_at = datetime('now') WHERE session_id = ?").run(sessionId);
    }
    /** Increment observation count. */
    incrementObservations(sessionId) {
        this.db.prepare('UPDATE memory_sessions SET observation_count = observation_count + 1 WHERE session_id = ?').run(sessionId);
    }
    /** List recent sessions. */
    listRecent(limit = 20) {
        return this.db.prepare('SELECT * FROM memory_sessions ORDER BY started_at DESC LIMIT ?').all(limit);
    }
    /** List sessions with optional agent and status filters. */
    listFiltered(agent, status, limit) {
        const clauses = ['1=1'];
        const params = [];
        if (agent) {
            clauses.push('agent_name = ?');
            params.push(agent);
        }
        if (status) {
            clauses.push('status = ?');
            params.push(status);
        }
        params.push(limit);
        const where = clauses.join(' AND ');
        return this.db.prepare(`SELECT * FROM memory_sessions WHERE ${where} ORDER BY started_at DESC LIMIT ?`).all(...params);
    }
    /** Get active session count. */
    activeCount() {
        const row = this.db.prepare("SELECT COUNT(*) as cnt FROM memory_sessions WHERE status = 'active'").get();
        return row.cnt;
    }
}
exports.SessionRepository = SessionRepository;
//# sourceMappingURL=session-repo.js.map