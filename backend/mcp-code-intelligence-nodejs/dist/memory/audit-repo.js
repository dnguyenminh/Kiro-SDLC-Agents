"use strict";
/**
 * AuditRepository — logs all memory operations for observability.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditRepository = void 0;
class AuditRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    /** Log an operation to the audit trail. */
    log(operation, entryId, sessionId, details) {
        this.db.prepare(`
      INSERT INTO memory_audit (operation, entry_id, session_id, details)
      VALUES (?, ?, ?, ?)
    `).run(operation, entryId ?? null, sessionId ?? null, details ?? null);
    }
    /** List audit entries for a specific session. */
    listBySession(sessionId, limit = 200) {
        return this.db.prepare('SELECT * FROM memory_audit WHERE session_id = ? ORDER BY created_at ASC LIMIT ?').all(sessionId, limit);
    }
    /** List recent audit entries. */
    listRecent(limit = 20, operation) {
        if (operation) {
            return this.db.prepare('SELECT * FROM memory_audit WHERE operation = ? ORDER BY id DESC LIMIT ?').all(operation, limit);
        }
        return this.db.prepare('SELECT * FROM memory_audit ORDER BY id DESC LIMIT ?').all(limit);
    }
    /** List audit entries after a given ID (for streaming). */
    listRecentAfterId(afterId, limit = 20) {
        return this.db.prepare('SELECT * FROM memory_audit WHERE id > ? ORDER BY id DESC LIMIT ?').all(afterId, limit);
    }
    /** List audit entries with exclude filter (for stream tab). */
    listFiltered(limit, afterId, exclude) {
        const clauses = [];
        const params = [];
        if (afterId !== null) {
            clauses.push('id > ?');
            params.push(afterId);
        }
        if (exclude.length > 0) {
            clauses.push(`operation NOT IN (${exclude.map(() => '?').join(',')})`);
            params.push(...exclude);
        }
        const where = clauses.length > 0 ? ' WHERE ' + clauses.join(' AND ') : '';
        params.push(limit);
        return this.db.prepare(`SELECT * FROM memory_audit${where} ORDER BY id DESC LIMIT ?`).all(...params);
    }
}
exports.AuditRepository = AuditRepository;
//# sourceMappingURL=audit-repo.js.map