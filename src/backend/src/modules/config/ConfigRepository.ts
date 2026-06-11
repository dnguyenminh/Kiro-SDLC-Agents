/**
 * ConfigRepository — CRUD operations for mcp_config table.
 * Implements TDD §4.2 mcp_config table.
 */

import { IDatabase } from '../auth/UserRepository';
import { McpConfigRecord } from './types';

export class ConfigRepository {
  constructor(private readonly db: IDatabase) {}

  findByUserAndServer(userId: string, serverName: string): McpConfigRecord | null {
    const stmt = this.db.prepare(
      'SELECT * FROM mcp_config WHERE user_id = ? AND server_name = ?'
    );
    const row = stmt.get(userId, serverName) as McpConfigRecord | undefined;
    return row ?? null;
  }

  findAllByUser(userId: string): McpConfigRecord[] {
    const stmt = this.db.prepare('SELECT * FROM mcp_config WHERE user_id = ?');
    return stmt.all(userId) as McpConfigRecord[];
  }

  upsert(userId: string, serverName: string, configData: string): void {
    const existing = this.findByUserAndServer(userId, serverName);
    if (existing) {
      this.db.prepare(`
        UPDATE mcp_config SET config_data = ?, updated_at = datetime('now')
        WHERE user_id = ? AND server_name = ?
      `).run(configData, userId, serverName);
    } else {
      this.db.prepare(`
        INSERT INTO mcp_config (id, user_id, server_name, config_data)
        VALUES (lower(hex(randomblob(16))), ?, ?, ?)
      `).run(userId, serverName, configData);
    }
  }

  delete(userId: string, serverName: string): void {
    this.db.prepare(
      'DELETE FROM mcp_config WHERE user_id = ? AND server_name = ?'
    ).run(userId, serverName);
  }

  getLastUpdated(userId: string): string | null {
    const stmt = this.db.prepare(
      'SELECT MAX(updated_at) as last_updated FROM mcp_config WHERE user_id = ?'
    );
    const row = stmt.get(userId) as { last_updated: string | null } | undefined;
    return row?.last_updated ?? null;
  }
}
