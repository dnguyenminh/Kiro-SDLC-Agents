/**
 * ConfigRepository — CRUD operations for mcp_config table.
 * Implements TDD §4.2 mcp_config table.
 */
export class ConfigRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    findByUserAndServer(userId, serverName) {
        const stmt = this.db.prepare('SELECT * FROM mcp_config WHERE user_id = ? AND server_name = ?');
        const row = stmt.get(userId, serverName);
        return row ?? null;
    }
    findAllByUser(userId) {
        const stmt = this.db.prepare('SELECT * FROM mcp_config WHERE user_id = ?');
        return stmt.all(userId);
    }
    upsert(userId, serverName, configData) {
        const existing = this.findByUserAndServer(userId, serverName);
        if (existing) {
            this.db.prepare(`
        UPDATE mcp_config SET config_data = ?, updated_at = datetime('now')
        WHERE user_id = ? AND server_name = ?
      `).run(configData, userId, serverName);
        }
        else {
            this.db.prepare(`
        INSERT INTO mcp_config (id, user_id, server_name, config_data)
        VALUES (lower(hex(randomblob(16))), ?, ?, ?)
      `).run(userId, serverName, configData);
        }
    }
    delete(userId, serverName) {
        this.db.prepare('DELETE FROM mcp_config WHERE user_id = ? AND server_name = ?').run(userId, serverName);
    }
    getLastUpdated(userId) {
        const stmt = this.db.prepare('SELECT MAX(updated_at) as last_updated FROM mcp_config WHERE user_id = ?');
        const row = stmt.get(userId);
        return row?.last_updated ?? null;
    }
}
//# sourceMappingURL=ConfigRepository.js.map