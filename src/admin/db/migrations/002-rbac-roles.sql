-- KSA-286: Add roles table per BRD spec (Permission -> Roles 1:N)
-- Each permission within a group can have multiple named roles with roleData

CREATE TABLE IF NOT EXISTS roles (
  role_id TEXT PRIMARY KEY,
  access_group_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  role_name TEXT NOT NULL,
  role_data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (access_group_id, permission_id) REFERENCES group_permissions(access_group_id, permission_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_permission_roles_group_perm 
  ON roles(access_group_id, permission_id);

-- Migrate existing role_data into roles table
-- Each existing row with non-empty role_data becomes a "Default" role
INSERT OR IGNORE INTO roles (role_id, access_group_id, permission_id, role_name, role_data)
  SELECT 
    'role-' || access_group_id || '-' || permission_id,
    access_group_id,
    permission_id,
    'Default',
    role_data
  FROM group_permissions
  WHERE role_data != '{}';
