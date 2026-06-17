-- KSA-286: Seed data - Permissions, Default Groups, Admin User

-- Permissions catalog
INSERT OR IGNORE INTO permissions (permission_id, permission_name, description, role_data_schema) VALUES
  ('DASHBOARD_VIEW', 'Dashboard View', 'View system dashboard', '{}'),
  ('KB_READ', 'KB Read', 'Read KB entries', '{"type":"object","properties":{"tiers":{"type":"array","items":{"type":"string","enum":["USER","PROJECT","SHARED"]}}}}'),
  ('KB_WRITE', 'KB Write', 'Create/edit/delete KB entries', '{"type":"object","properties":{"tiers":{"type":"array"},"maxEntries":{"type":"number"}}}'),
  ('KB_PROMOTE', 'KB Promote', 'Approve/reject promotions', '{"type":"object","properties":{"targetTiers":{"type":"array"}}}'),
  ('KB_IMPORT_EXPORT', 'KB Import/Export', 'Bulk import and export', '{"type":"object","properties":{"formats":{"type":"array"}}}'),
  ('MCP_ACCESS', 'MCP Server Access', 'View MCP server status', '{"type":"object","properties":{"mcpServers":{"type":"array"},"methods":{"type":"array"}}}'),
  ('MCP_MANAGE', 'MCP Server Manage', 'Start/stop/restart servers', '{"type":"object","properties":{"mcpServers":{"type":"array"}}}'),
  ('USER_MANAGE', 'User Management', 'Create/edit/disable/delete users', '{"type":"object","properties":{"canDelete":{"type":"boolean"}}}'),
  ('RBAC_MANAGE', 'RBAC Management', 'Manage Access Groups and Permissions', '{}'),
  ('CONFIG_EDIT', 'Configuration Edit', 'Edit server configuration', '{"type":"object","properties":{"sections":{"type":"array"},"readOnly":{"type":"boolean"}}}'),
  ('SEARCH_EXPLORE', 'Search Explorer', 'Test and debug search queries', '{}'),
  ('AUDIT_VIEW', 'Audit Trail View', 'View audit log', '{"type":"object","properties":{"exportAllowed":{"type":"boolean"}}}'),
  ('GRAPH_VIEW', 'KB Graph View', 'View KB graph visualization', '{}'),
  ('ANALYTICS_VIEW', 'Analytics View', 'View analytics and quality metrics', '{"type":"object","properties":{"exportAllowed":{"type":"boolean"}}}');

-- Default Access Groups
INSERT OR IGNORE INTO access_groups (access_group_id, access_group_name, is_system_group) VALUES
  ('grp-system-owner', 'System Owner', 1),
  ('grp-administrator', 'Administrator', 0),
  ('grp-operator', 'Operator', 0),
  ('grp-developer', 'Developer', 0),
  ('grp-viewer', 'Viewer', 0);

-- System Owner: ALL permissions
INSERT OR IGNORE INTO group_permissions (access_group_id, permission_id, role_data)
  SELECT 'grp-system-owner', permission_id, '{}' FROM permissions;

-- Administrator: All except RBAC_MANAGE
INSERT OR IGNORE INTO group_permissions (access_group_id, permission_id, role_data)
  SELECT 'grp-administrator', permission_id, '{}' FROM permissions WHERE permission_id != 'RBAC_MANAGE';

-- Operator
INSERT OR IGNORE INTO group_permissions (access_group_id, permission_id, role_data) VALUES
  ('grp-operator', 'DASHBOARD_VIEW', '{}'),
  ('grp-operator', 'MCP_ACCESS', '{}'),
  ('grp-operator', 'MCP_MANAGE', '{}'),
  ('grp-operator', 'KB_READ', '{}'),
  ('grp-operator', 'AUDIT_VIEW', '{"exportAllowed":false}');

-- Developer
INSERT OR IGNORE INTO group_permissions (access_group_id, permission_id, role_data) VALUES
  ('grp-developer', 'DASHBOARD_VIEW', '{}'),
  ('grp-developer', 'KB_READ', '{}'),
  ('grp-developer', 'KB_WRITE', '{"tiers":["USER","PROJECT"],"maxEntries":1000}'),
  ('grp-developer', 'MCP_ACCESS', '{}'),
  ('grp-developer', 'SEARCH_EXPLORE', '{}'),
  ('grp-developer', 'GRAPH_VIEW', '{}');

-- Viewer
INSERT OR IGNORE INTO group_permissions (access_group_id, permission_id, role_data) VALUES
  ('grp-viewer', 'DASHBOARD_VIEW', '{}'),
  ('grp-viewer', 'KB_READ', '{}'),
  ('grp-viewer', 'GRAPH_VIEW', '{}'),
  ('grp-viewer', 'ANALYTICS_VIEW', '{"exportAllowed":false}');

-- Default admin user (password: Admin123!)
INSERT OR IGNORE INTO users (user_id, username, email, password_hash, status, access_group_id, force_password_change) VALUES
  ('user-admin-001', 'admin', 'admin@localhost', '$2b$10$rGZK8yNnZ8N1qHsISfkAOeYQ2RmMZxECN8grT9q7NY3viLqPy8jDW', 'ACTIVE', 'grp-system-owner', 1);
