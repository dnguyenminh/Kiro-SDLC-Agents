-- KSA-286: Web Admin Portal - Database Migration
-- Creates all admin portal tables, indexes, and constraints

-- Access Groups (must be created before users due to FK)
CREATE TABLE IF NOT EXISTS access_groups (
  access_group_id TEXT PRIMARY KEY,
  access_group_name TEXT NOT NULL UNIQUE,
  is_system_group INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','DISABLED','PENDING')),
  access_group_id TEXT NOT NULL,
  force_password_change INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT,
  FOREIGN KEY (access_group_id) REFERENCES access_groups(access_group_id)
);

-- Permissions catalog
CREATE TABLE IF NOT EXISTS permissions (
  permission_id TEXT PRIMARY KEY,
  permission_name TEXT NOT NULL,
  description TEXT,
  role_data_schema TEXT NOT NULL DEFAULT '{}'
);

-- Group <-> Permission join (with roleData)
CREATE TABLE IF NOT EXISTS group_permissions (
  access_group_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  role_data TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (access_group_id, permission_id),
  FOREIGN KEY (access_group_id) REFERENCES access_groups(access_group_id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device TEXT,
  ip_address TEXT,
  login_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Audit trail (immutable)
CREATE TABLE IF NOT EXISTS audit_entries (
  audit_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  changes TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  ip_address TEXT
);

-- Configuration entries
CREATE TABLE IF NOT EXISTS config_entries (
  section TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('string','number','boolean','select')),
  default_value TEXT NOT NULL,
  requires_restart INTEGER NOT NULL DEFAULT 0,
  last_modified TEXT,
  modified_by TEXT,
  PRIMARY KEY (section, key)
);

-- Configuration change history
CREATE TABLE IF NOT EXISTS config_history (
  history_id TEXT PRIMARY KEY,
  section TEXT NOT NULL,
  key TEXT NOT NULL,
  old_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  changed_by TEXT NOT NULL
);

-- KB Promotion queue
CREATE TABLE IF NOT EXISTS kb_promotion_queue (
  promotion_id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  source_tier TEXT NOT NULL,
  target_tier TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
  review_comment TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  cooldown_until TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_access_group ON users(access_group_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_entries(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_entries(action);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_entries(resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_config_history_key ON config_history(section, key, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_promotion_status ON kb_promotion_queue(status);
CREATE INDEX IF NOT EXISTS idx_promotion_entry ON kb_promotion_queue(entry_id);
