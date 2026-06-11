/**
 * Migration 002 — Auth, Multi-Tenant KB, and MCP Config tables.
 * Implements TDD §4.2 DDL Scripts, §4.3 Migration Strategy.
 */

import { IDatabase } from '../../modules/auth/UserRepository';

const DDL_UP = `
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  sso_provider TEXT,
  sso_subject TEXT,
  projects TEXT NOT NULL DEFAULT '[]',
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_sso ON users(sso_provider, sso_subject);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  revoked_at TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token_hash);

CREATE TABLE IF NOT EXISTS kb_entries (
  id TEXT PRIMARY KEY,
  tier INTEGER NOT NULL DEFAULT 1 CHECK (tier IN (1, 2, 3)),
  owner_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT,
  title TEXT,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  embedding BLOB,
  tags TEXT DEFAULT '[]',
  quality_score REAL DEFAULT 0.0,
  ttl_days INTEGER,
  promoted INTEGER NOT NULL DEFAULT 0,
  promoted_from TEXT REFERENCES kb_entries(id),
  promoted_by TEXT REFERENCES users(id),
  referenced_by_projects TEXT DEFAULT '[]',
  admin_promoted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_kb_tier_owner ON kb_entries(tier, owner_id);
CREATE INDEX IF NOT EXISTS idx_kb_tier_project ON kb_entries(tier, project_id);
CREATE INDEX IF NOT EXISTS idx_kb_tier3 ON kb_entries(tier) WHERE tier = 3;
CREATE INDEX IF NOT EXISTS idx_kb_promotion ON kb_entries(tier, promoted) WHERE promoted = 0;
CREATE INDEX IF NOT EXISTS idx_kb_ttl ON kb_entries(tier, ttl_days, created_at) WHERE tier = 1 AND ttl_days IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kb_content_hash ON kb_entries(content_hash);

CREATE TABLE IF NOT EXISTS mcp_config (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  server_name TEXT NOT NULL CHECK (server_name IN ('jira', 'drawio', 'export')),
  config_data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, server_name)
);

CREATE INDEX IF NOT EXISTS idx_mcp_config_user ON mcp_config(user_id);

CREATE TABLE IF NOT EXISTS sso_config (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  issuer_url TEXT NOT NULL,
  client_id TEXT NOT NULL,
  allowed_domains TEXT NOT NULL DEFAULT '[]',
  redirect_uri TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  user_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_log(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id, created_at);
`;

const DDL_DOWN = `
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS sso_config;
DROP TABLE IF EXISTS mcp_config;
DROP TABLE IF EXISTS kb_entries;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;
`;

export const MIGRATION_002 = {
  version: 2,
  name: 'auth-multitenant-kb',
  up: (db: IDatabase): void => {
    db.exec(DDL_UP);
  },
  down: (db: IDatabase): void => {
    db.exec(DDL_DOWN);
  },
};
