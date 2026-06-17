/**
 * UserRepository — CRUD operations for the users table.
 * Implements TDD §4.2 users table, §4.4 Key Query Patterns.
 */
export class UserRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    findByUsername(username) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
        const row = stmt.get(username);
        return row ?? null;
    }
    findByEmail(email) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
        const row = stmt.get(email);
        return row ?? null;
    }
    findById(id) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
        const row = stmt.get(id);
        return row ?? null;
    }
    findBySsoSubject(provider, subject) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE sso_provider = ? AND sso_subject = ?');
        const row = stmt.get(provider, subject);
        return row ?? null;
    }
    create(user) {
        const stmt = this.db.prepare(`
      INSERT INTO users (id, username, email, display_name, password_hash, role, sso_provider, sso_subject, projects)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(user.id, user.username, user.email, user.display_name ?? null, user.password_hash ?? null, user.role ?? 'user', user.sso_provider ?? null, user.sso_subject ?? null, JSON.stringify(user.projects ?? []));
        return this.findById(user.id);
    }
    incrementFailedAttempts(userId) {
        this.db.prepare(`
      UPDATE users SET failed_attempts = failed_attempts + 1, updated_at = datetime('now') WHERE id = ?
    `).run(userId);
    }
    lockAccount(userId, lockUntil) {
        this.db.prepare(`
      UPDATE users SET locked_until = ?, updated_at = datetime('now') WHERE id = ?
    `).run(lockUntil.toISOString(), userId);
    }
    resetFailedAttempts(userId) {
        this.db.prepare(`
      UPDATE users SET failed_attempts = 0, locked_until = NULL, updated_at = datetime('now') WHERE id = ?
    `).run(userId);
    }
    updateProjects(userId, projects) {
        this.db.prepare(`
      UPDATE users SET projects = ?, updated_at = datetime('now') WHERE id = ?
    `).run(JSON.stringify(projects), userId);
    }
}
//# sourceMappingURL=UserRepository.js.map