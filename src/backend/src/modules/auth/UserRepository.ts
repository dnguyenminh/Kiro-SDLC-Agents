/**
 * UserRepository — CRUD operations for the users table.
 * Implements TDD §4.2 users table, §4.4 Key Query Patterns.
 */

import { UserRecord } from './types';

export interface IDatabase {
  prepare(sql: string): IStatement;
  exec(sql: string): void;
}

export interface IStatement {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
}

export class UserRepository {
  constructor(private readonly db: IDatabase) {}

  findByUsername(username: string): UserRecord | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    const row = stmt.get(username) as UserRecord | undefined;
    return row ?? null;
  }

  findByEmail(email: string): UserRecord | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    const row = stmt.get(email) as UserRecord | undefined;
    return row ?? null;
  }

  findById(id: string): UserRecord | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id) as UserRecord | undefined;
    return row ?? null;
  }

  findBySsoSubject(provider: string, subject: string): UserRecord | null {
    const stmt = this.db.prepare(
      'SELECT * FROM users WHERE sso_provider = ? AND sso_subject = ?'
    );
    const row = stmt.get(provider, subject) as UserRecord | undefined;
    return row ?? null;
  }

  create(user: {
    id: string;
    username: string;
    email: string;
    display_name?: string;
    password_hash?: string;
    role?: 'user' | 'admin';
    sso_provider?: string;
    sso_subject?: string;
    projects?: string[];
  }): UserRecord {
    const stmt = this.db.prepare(`
      INSERT INTO users (id, username, email, display_name, password_hash, role, sso_provider, sso_subject, projects)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      user.id,
      user.username,
      user.email,
      user.display_name ?? null,
      user.password_hash ?? null,
      user.role ?? 'user',
      user.sso_provider ?? null,
      user.sso_subject ?? null,
      JSON.stringify(user.projects ?? []),
    );
    return this.findById(user.id)!;
  }

  incrementFailedAttempts(userId: string): void {
    this.db.prepare(`
      UPDATE users SET failed_attempts = failed_attempts + 1, updated_at = datetime('now') WHERE id = ?
    `).run(userId);
  }

  lockAccount(userId: string, lockUntil: Date): void {
    this.db.prepare(`
      UPDATE users SET locked_until = ?, updated_at = datetime('now') WHERE id = ?
    `).run(lockUntil.toISOString(), userId);
  }

  resetFailedAttempts(userId: string): void {
    this.db.prepare(`
      UPDATE users SET failed_attempts = 0, locked_until = NULL, updated_at = datetime('now') WHERE id = ?
    `).run(userId);
  }

  updateProjects(userId: string, projects: string[]): void {
    this.db.prepare(`
      UPDATE users SET projects = ?, updated_at = datetime('now') WHERE id = ?
    `).run(JSON.stringify(projects), userId);
  }
}
