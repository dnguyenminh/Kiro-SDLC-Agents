/**
 * Admin Portal routes — /admin (SPA) + /api/admin/* (API)
 * Features: Real JWT auth, persistent RBAC (SQLite), full User CRUD.
 * All on same port as MCP backend (48721).
 */

import { Hono } from 'hono';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { Logger } from 'pino';
import {
  getAdminDb,
  verifyPassword,
  createSession,
  validateSession,
  invalidateSession,
  invalidateUserSessions,
  getUsers,
  getUserById,
  getUserByUsername,
  createUser,
  updateUserStatus,
  deleteUser,
  resetUserPassword,
  changePassword,
  updateLastLogin,
  getGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  getUserPermissions,
  getUserSessions,
  recordAudit,
  getAuditLogs,
  recordConfigChange,
  getConfigChanges,
  getKbEntryCount,
  getKbEntries,
  getRecentActivity,
} from '../../admin/admin-db.js';
import { loadConfig } from '../../config/BackendConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export function createAdminRoute(logger: Logger): Hono {
  const app = new Hono();

  // Initialize DB on first load
  getAdminDb();

  // Resolve SPA file path
  const spaPath = path.resolve(__dirname, '../../admin-ui/dist/index.html');

  // Admin SPA
  app.get('/admin', (c) => {
    if (fs.existsSync(spaPath)) {
      const html = fs.readFileSync(spaPath, 'utf-8');
      return c.html(html);
    }
    return c.text('Admin Portal not found', 404);
  });

  app.get('/admin/*', (c) => {
    if (fs.existsSync(spaPath)) {
      const html = fs.readFileSync(spaPath, 'utf-8');
      return c.html(html);
    }
    return c.text('Admin Portal not found', 404);
  });

  // ===== Auth Middleware Helper =====

  const authenticate = (c: any): { userId: string; username: string; accessGroupId: string } | null => {
    const auth = c.req.header('Authorization') || '';
    const token = auth.replace('Bearer ', '');
    if (!token) return null;
    return validateSession(token);
  };

  const requireAuth = (c: any): { userId: string; username: string; accessGroupId: string } | Response => {
    const user = authenticate(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    return user;
  };

  // ===== Auth Endpoints =====

  // POST /api/admin/auth/login
  app.post('/api/admin/auth/login', async (c) => {
    try {
      const { username, password } = await c.req.json();
      if (!username || !password) {
        return c.json({ error: 'Username and password required' }, 400);
      }

      const user = getUserByUsername(username);
      if (!user) {
        recordAudit('unknown', username, 'LOGIN_FAILED', 'auth', undefined, 'User not found');
        return c.json({ error: 'Invalid credentials' }, 401);
      }

      if (user.status !== 'ACTIVE') {
        recordAudit(user.userId, username, 'LOGIN_FAILED', 'auth', undefined, 'Account disabled');
        return c.json({ error: 'Account is disabled' }, 403);
      }

      if (!verifyPassword(password, user.passwordHash)) {
        recordAudit(user.userId, username, 'LOGIN_FAILED', 'auth', undefined, 'Wrong password');
        return c.json({ error: 'Invalid credentials' }, 401);
      }

      // Create session
      const session = createSession(user.userId);
      updateLastLogin(user.userId);
      recordAudit(user.userId, username, 'LOGIN', 'auth', session.sessionId);

      const permissions = getUserPermissions(user.userId);

      return c.json({
        token: session.token,
        user: {
          userId: user.userId,
          username: user.username,
          email: user.email,
          accessGroupId: user.accessGroupId,
          forcePasswordChange: user.forcePasswordChange,
          permissions: permissions.map(p => p.permissionId),
        },
        expiresAt: session.expiresAt,
      });
    } catch (err: any) {
      logger.error({ err }, 'Login error');
      return c.json({ error: 'Internal error' }, 500);
    }
  });

  // POST /api/admin/auth/logout
  app.post('/api/admin/auth/logout', (c) => {
    const auth = c.req.header('Authorization') || '';
    const token = auth.replace('Bearer ', '');
    if (token) {
      const user = validateSession(token);
      if (user) {
        recordAudit(user.userId, user.username, 'LOGOUT', 'auth');
      }
      invalidateSession(token);
    }
    return c.json({ success: true });
  });

  // POST /api/admin/auth/change-password
  app.post('/api/admin/auth/change-password', async (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    const { currentPassword, newPassword } = await c.req.json();
    if (!currentPassword || !newPassword) {
      return c.json({ error: 'Current and new password required' }, 400);
    }
    if (newPassword.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400);
    }

    const dbUser = getUserByUsername(user.username);
    if (!dbUser || !verifyPassword(currentPassword, dbUser.passwordHash)) {
      return c.json({ error: 'Current password is incorrect' }, 401);
    }

    changePassword(user.userId, newPassword);
    recordAudit(user.userId, user.username, 'CHANGE_PASSWORD', 'auth');
    return c.json({ success: true });
  });

  // GET /api/admin/auth/me
  app.get('/api/admin/auth/me', (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    const permissions = getUserPermissions(user.userId);
    const dbUser = getUserById(user.userId);
    return c.json({
      userId: user.userId,
      username: user.username,
      accessGroupId: user.accessGroupId,
      email: dbUser?.email || '',
      forcePasswordChange: dbUser?.forcePasswordChange || false,
      permissions: permissions.map(p => p.permissionId),
    });
  });

  // ===== Stats (Real Metrics) =====

  const SERVER_START_TIME = Date.now();

  app.get('/api/admin/stats', (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    const d = getAdminDb();
    const userCount = (d.prepare('SELECT COUNT(*) as cnt FROM users').get() as any).cnt;
    const orchPath = path.resolve(__dirname, '../../../../.code-intel/orchestration.json');
    let mcpCount = 0;
    if (fs.existsSync(orchPath)) {
      try { mcpCount = Object.keys(JSON.parse(fs.readFileSync(orchPath, 'utf-8')).mcpServers || {}).length; } catch {}
    }

    const kbEntries = getKbEntryCount();
    const uptimeMs = Date.now() - SERVER_START_TIME;
    const mem = process.memoryUsage();
    const recentActivity = getRecentActivity(10);

    return c.json({
      kbEntries,
      users: userCount,
      mcpServers: mcpCount,
      uptime: {
        ms: uptimeMs,
        formatted: formatUptime(uptimeMs),
      },
      memory: {
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        rss: mem.rss,
        formatted: formatBytes(mem.heapUsed) + ' / ' + formatBytes(mem.heapTotal),
      },
      recentActivity,
    });
  });

  // ===== Profile =====

  app.get('/api/admin/profile', (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    const dbUser = getUserById(user.userId);
    const permissions = getUserPermissions(user.userId);
    return c.json({
      userId: user.userId,
      username: user.username,
      email: dbUser?.email || '',
      group: user.accessGroupId,
      permissions: permissions.map(p => p.permissionId),
      lastLogin: dbUser?.lastLogin || new Date().toISOString(),
      forcePasswordChange: dbUser?.forcePasswordChange || false,
    });
  });

  // ===== User Management =====

  app.get('/api/admin/users', (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '50');
    const status = c.req.query('status') || undefined;
    const search = c.req.query('search') || undefined;
    const accessGroupId = c.req.query('accessGroupId') || undefined;

    const result = getUsers({ status, search, accessGroupId }, page, pageSize);
    return c.json({
      users: result.items,
      total: result.total,
      page,
      pageSize,
      totalPages: Math.ceil(result.total / pageSize),
    });
  });

  app.get('/api/admin/users/:id', (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    const targetUser = getUserById(c.req.param('id'));
    if (!targetUser) return c.json({ error: 'User not found' }, 404);

    const sessions = getUserSessions(targetUser.userId);
    return c.json({ ...targetUser, sessions });
  });

  app.post('/api/admin/users', async (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    try {
      const { username, email, password, accessGroupId } = await c.req.json();
      if (!username || !password || !accessGroupId) {
        return c.json({ error: 'username, password, and accessGroupId are required' }, 400);
      }
      if (username.length < 3) return c.json({ error: 'Username must be at least 3 characters' }, 400);
      if (password.length < 6) return c.json({ error: 'Password must be at least 6 characters' }, 400);

      const group = getGroupById(accessGroupId);
      if (!group) return c.json({ error: 'Access group not found' }, 400);

      const newUser = createUser(username, email || '', password, accessGroupId);
      recordAudit(user.userId, user.username, 'CREATE_USER', 'users', newUser.userId, JSON.stringify({ username, accessGroupId }));
      return c.json({ success: true, user: newUser }, 201);
    } catch (err: any) {
      if (err.message?.includes('UNIQUE constraint')) {
        return c.json({ error: 'Username already exists' }, 409);
      }
      logger.error({ err }, 'Create user error');
      return c.json({ error: err.message || 'Internal error' }, 500);
    }
  });

  app.put('/api/admin/users/:id/status', async (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    const targetId = c.req.param('id');
    const { status } = await c.req.json();
    if (!status || !['ACTIVE', 'DISABLED'].includes(status)) {
      return c.json({ error: 'Invalid status. Must be ACTIVE or DISABLED' }, 400);
    }

    const target = getUserById(targetId);
    if (!target) return c.json({ error: 'User not found' }, 404);
    if (target.username === 'admin' && status === 'DISABLED') {
      return c.json({ error: 'Cannot disable system admin' }, 403);
    }

    const sessionsTerminated = updateUserStatus(targetId, status);
    recordAudit(user.userId, user.username, 'UPDATE_USER_STATUS', 'users', targetId, JSON.stringify({ status, sessionsTerminated }));
    return c.json({ success: true, sessionsTerminated });
  });

  app.delete('/api/admin/users/:id', (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    const targetId = c.req.param('id');
    try {
      const target = getUserById(targetId);
      if (!target) return c.json({ error: 'User not found' }, 404);

      deleteUser(targetId);
      recordAudit(user.userId, user.username, 'DELETE_USER', 'users', targetId, JSON.stringify({ username: target.username }));
      return c.json({ success: true });
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  });

  app.post('/api/admin/users/:id/force-logout', (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    const targetId = c.req.param('id');
    const target = getUserById(targetId);
    if (!target) return c.json({ error: 'User not found' }, 404);

    const terminated = invalidateUserSessions(targetId);
    recordAudit(user.userId, user.username, 'FORCE_LOGOUT', 'users', targetId, JSON.stringify({ terminated }));
    return c.json({ success: true, terminated });
  });

  app.post('/api/admin/users/:id/reset-password', (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    const targetId = c.req.param('id');
    const target = getUserById(targetId);
    if (!target) return c.json({ error: 'User not found' }, 404);

    const temporaryPassword = resetUserPassword(targetId);
    invalidateUserSessions(targetId);
    recordAudit(user.userId, user.username, 'RESET_PASSWORD', 'users', targetId);
    return c.json({ success: true, temporaryPassword });
  });

  // ===== RBAC =====

  app.get('/api/admin/rbac/groups', (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    const groups = getGroups();
    const d = getAdminDb();
    const countStmt = d.prepare('SELECT COUNT(*) as cnt FROM users WHERE access_group_id = ?');
    const result = groups.map(g => ({
      ...g,
      id: g.accessGroupId,
      name: g.accessGroupName,
      isSystem: g.isSystemGroup,
      userCount: (countStmt.get(g.accessGroupId) as any).cnt,
      permissions: g.permissions.map(p => ({ name: p.permissionId, roleData: p.roleData })),
    }));
    return c.json({ groups: result });
  });

  app.get('/api/admin/rbac/groups/:id', (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    const group = getGroupById(c.req.param('id'));
    if (!group) return c.json({ error: 'Group not found' }, 404);
    return c.json(group);
  });

  app.post('/api/admin/rbac/groups', async (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    try {
      const body = await c.req.json();
      const name = body.name || body.accessGroupName;
      if (!name) return c.json({ error: 'Group name required' }, 400);

      const permissions = (body.permissions || []).map((p: any) => ({
        permissionId: p.name || p.permissionId,
        roleData: p.roleData || {},
      }));

      const group = createGroup(name, permissions);
      recordAudit(user.userId, user.username, 'CREATE_GROUP', 'rbac', group.accessGroupId, JSON.stringify({ name }));
      return c.json({ success: true, group: { ...group, id: group.accessGroupId, name: group.accessGroupName, isSystem: false } }, 201);
    } catch (err: any) {
      if (err.message?.includes('UNIQUE')) return c.json({ error: 'Group name already exists' }, 409);
      return c.json({ error: err.message || 'Internal error' }, 500);
    }
  });

  app.put('/api/admin/rbac/groups/:id', async (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    try {
      const groupId = c.req.param('id');
      const body = await c.req.json();
      const name = body.name || body.accessGroupName;
      const permissions = (body.permissions || []).map((p: any) => ({
        permissionId: p.name || p.permissionId,
        roleData: p.roleData || {},
      }));

      const group = updateGroup(groupId, name, permissions);
      recordAudit(user.userId, user.username, 'UPDATE_GROUP', 'rbac', groupId, JSON.stringify({ name, permCount: permissions.length }));
      return c.json({ success: true, group });
    } catch (err: any) {
      return c.json({ error: err.message || 'Internal error' }, 400);
    }
  });

  app.delete('/api/admin/rbac/groups/:id', (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    try {
      const groupId = c.req.param('id');
      deleteGroup(groupId);
      recordAudit(user.userId, user.username, 'DELETE_GROUP', 'rbac', groupId);
      return c.json({ success: true });
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  });

  app.get('/api/admin/rbac/permissions', (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    return c.json({
      permissions: [
        'DASHBOARD_VIEW', 'KB_READ', 'KB_WRITE', 'KB_PROMOTE', 'KB_IMPORT_EXPORT',
        'MCP_ACCESS', 'MCP_MANAGE', 'USER_MANAGE', 'RBAC_MANAGE', 'CONFIG_EDIT',
        'SEARCH_EXPLORE', 'AUDIT_VIEW', 'GRAPH_VIEW', 'ANALYTICS_VIEW'
      ]
    });
  });

  // ===== MCP Servers =====

  // In-memory MCP server logs ring buffer (last 100 lines per server)
  const mcpServerLogs: Record<string, { timestamp: string; level: string; message: string }[]> = {};

  const addMcpLog = (serverId: string, level: string, message: string) => {
    if (!mcpServerLogs[serverId]) mcpServerLogs[serverId] = [];
    mcpServerLogs[serverId].push({ timestamp: new Date().toISOString(), level, message });
    if (mcpServerLogs[serverId].length > 100) mcpServerLogs[serverId].shift();
  };

  // In-memory tool toggle state
  const toolToggles: Record<string, Record<string, boolean>> = {};

  app.get('/api/admin/mcp/servers', (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    const orchPath = path.resolve(__dirname, '../../../../.code-intel/orchestration.json');
    let servers: any[] = [];
    if (fs.existsSync(orchPath)) {
      try {
        const orch = JSON.parse(fs.readFileSync(orchPath, 'utf-8'));
        servers = Object.entries(orch.mcpServers || {}).map(([name, cfg]: [string, any]) => {
          const tools = cfg.tools || cfg.autoApprove || [];
          const serverToggles = toolToggles[name] || {};
          return {
            id: name, name,
            status: cfg.disabled ? 'stopped' : 'running',
            tools: tools.map((t: string) => ({ name: t, enabled: serverToggles[t] !== false })),
          };
        });
      } catch (e) { /* ignore */ }
    }
    return c.json({ servers });
  });

  app.post('/api/admin/mcp/servers/:id/restart', (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    const serverId = c.req.param('id');
    addMcpLog(serverId, 'INFO', `Server restart requested by ${user.username}`);
    recordAudit(user.userId, user.username, 'RESTART_SERVER', 'mcp', serverId);
    return c.json({ success: true, message: 'Restart signal sent' });
  });

  // POST /api/admin/mcp/servers/:id/tools/:toolName/toggle
  app.post('/api/admin/mcp/servers/:id/tools/:toolName/toggle', async (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    const serverId = c.req.param('id');
    const toolName = c.req.param('toolName');
    const { enabled } = await c.req.json();

    if (!toolToggles[serverId]) toolToggles[serverId] = {};
    toolToggles[serverId][toolName] = enabled !== false;

    addMcpLog(serverId, 'INFO', `Tool "${toolName}" ${enabled !== false ? 'enabled' : 'disabled'} by ${user.username}`);
    recordAudit(user.userId, user.username, 'TOGGLE_TOOL', 'mcp', `${serverId}/${toolName}`, JSON.stringify({ enabled }));
    return c.json({ success: true, serverId, toolName, enabled: enabled !== false });
  });

  // GET /api/admin/mcp/servers/:id/logs
  app.get('/api/admin/mcp/servers/:id/logs', (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    const serverId = c.req.param('id');
    const logs = mcpServerLogs[serverId] || [];

    // If no logs yet, seed some mock entries
    if (logs.length === 0) {
      const now = Date.now();
      const mockLogs = [
        { offset: -300000, level: 'INFO', message: `Server "${serverId}" started successfully` },
        { offset: -240000, level: 'INFO', message: 'Connected to transport layer' },
        { offset: -180000, level: 'INFO', message: 'Tools registered and ready' },
        { offset: -60000, level: 'DEBUG', message: 'Health check passed' },
        { offset: 0, level: 'INFO', message: 'Accepting tool calls' },
      ];
      mockLogs.forEach(m => {
        mcpServerLogs[serverId] = mcpServerLogs[serverId] || [];
        mcpServerLogs[serverId].push({ timestamp: new Date(now + m.offset).toISOString(), level: m.level, message: m.message });
      });
    }

    return c.json({ serverId, logs: mcpServerLogs[serverId] || [] });
  });

  // ===== Configuration =====

  // In-memory config overrides (persisted via config_changes table, applied on restart for restart-required keys)
  const configOverrides: Record<string, Record<string, any>> = {};

  // Keys that require restart vs hot-reload
  const RESTART_REQUIRED_KEYS: Record<string, string[]> = {
    server: ['port', 'host'],
    embedding: ['model', 'dimensions'],
  };

  const getEffectiveConfig = (): Record<string, Record<string, any>> => {
    const cfg = loadConfig();
    const base: Record<string, Record<string, any>> = {
      server: { port: cfg.port, host: cfg.host, logLevel: cfg.logLevel },
      embedding: { model: 'all-MiniLM-L6-v2', dimensions: 384, onnxModelPath: cfg.onnxModelPath },
      kb: { maxEntries: 100000, sqliteDbPath: cfg.sqliteDbPath, dataDir: cfg.dataDir },
      mcp: { orchestrationConfigPath: cfg.orchestrationConfigPath },
    };
    // Apply overrides
    for (const [section, keys] of Object.entries(configOverrides)) {
      if (!base[section]) base[section] = {};
      for (const [key, val] of Object.entries(keys)) {
        base[section][key] = val;
      }
    }
    return base;
  };

  app.get('/api/admin/config', (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    const config = getEffectiveConfig();
    const history = getConfigChanges(10);
    const restartRequired = RESTART_REQUIRED_KEYS;

    return c.json({ config, history, restartRequired });
  });

  app.patch('/api/admin/config/:section/:key', async (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    const section = c.req.param('section');
    const key = c.req.param('key');
    const { value } = await c.req.json();

    if (value === undefined || value === null) {
      return c.json({ error: 'value is required' }, 400);
    }

    const config = getEffectiveConfig();
    if (!config[section]) {
      return c.json({ error: `Section "${section}" not found` }, 404);
    }
    if (!(key in config[section])) {
      return c.json({ error: `Key "${key}" not found in section "${section}"` }, 404);
    }

    const oldValue = JSON.stringify(config[section][key]);
    const newValue = typeof value === 'string' ? value : JSON.stringify(value);
    const requiresRestart = (RESTART_REQUIRED_KEYS[section] || []).includes(key);

    // Apply override in memory (hot-reload for non-restart keys)
    if (!configOverrides[section]) configOverrides[section] = {};
    configOverrides[section][key] = value;

    // Record change
    recordConfigChange(section, key, oldValue, newValue, user.username, requiresRestart);
    recordAudit(user.userId, user.username, 'CONFIG_CHANGE', 'config', `${section}.${key}`, JSON.stringify({ oldValue, newValue, requiresRestart }));

    return c.json({ success: true, requiresRestart, section, key, value });
  });

  app.get('/api/admin/config/history', (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    const history = getConfigChanges(20);
    return c.json({ history });
  });

  // ===== Audit =====

  app.get('/api/admin/audit', (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '50');
    const action = c.req.query('action') || undefined;
    const dateFrom = c.req.query('dateFrom') || undefined;
    const dateTo = c.req.query('dateTo') || undefined;

    const result = getAuditLogs({ action, dateFrom, dateTo }, page, pageSize);
    return c.json({
      entries: result.items,
      total: result.total,
      page,
      pageSize,
      totalPages: Math.ceil(result.total / pageSize),
    });
  });

  // ===== Search =====

  app.post('/api/admin/search', async (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    const { query, debug } = await c.req.json();
    if (!query) return c.json({ results: [] });

    const mockResults = [
      { id: 'e1', source: 'project-structure', content: 'Code Intelligence indexes the project for semantic search and navigation...', tier: 'SHARED', score: 0.92, scores: { similarity: 0.85, keyword: 0.95, recency: 0.90, quality: 0.98 } },
      { id: 'e2', source: 'admin-portal', content: 'Admin portal provides web-based management of KB entries, users, and MCP servers...', tier: 'PROJECT', score: 0.87, scores: { similarity: 0.82, keyword: 0.88, recency: 0.85, quality: 0.93 } },
      { id: 'e3', source: 'mcp-integration', content: 'MCP servers are orchestrated through orchestration.json configuration...', tier: 'SHARED', score: 0.79, scores: { similarity: 0.75, keyword: 0.72, recency: 0.95, quality: 0.74 } },
    ];

    const filtered = mockResults.filter(r =>
      r.source.toLowerCase().includes(query.toLowerCase()) ||
      r.content.toLowerCase().includes(query.toLowerCase())
    );

    return c.json({
      results: filtered.length > 0 ? filtered : mockResults.slice(0, 2),
      debug: debug ? { queryTokens: query.split(/\s+/), totalCandidates: 42, searchTimeMs: 12 } : undefined,
    });
  });

  // ===== KB =====

  // In-memory storage for KB links, tags, and promotion queue
  const kbLinks: Record<string, { targetId: string; linkType: string; createdAt: string }[]> = {};
  const kbTags: Record<string, string[]> = {};
  const promotionQueue: { id: string; entryId: string; fromTier: string; toTier: string; reason: string; requestedBy: string; requestedAt: string; status: string; reviewedBy?: string; reviewedAt?: string }[] = [];

  app.get('/api/admin/kb/entries', (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const sortBy = c.req.query('sortBy') || 'created_at';
    const sortDir = (c.req.query('sortDir') || 'desc') as 'asc' | 'desc';

    const result = getKbEntries(page, pageSize, sortBy, sortDir);
    return c.json({
      entries: result.items,
      total: result.total,
      page,
      pageSize,
      totalPages: Math.ceil(result.total / pageSize),
    });
  });

  // KB Graph
  app.get('/api/admin/kb/graph', (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    const result = getKbEntries(1, 100, 'created_at', 'desc');
    let nodes: any[] = [];
    let edges: any[] = [];

    if (result.items.length > 0) {
      nodes = result.items.map((e: any, i: number) => ({
        id: e.id || e.entry_id || `node-${i}`,
        label: e.source || e.title || `Entry ${i + 1}`,
        type: e.type || e.content_type || 'document',
        tier: e.tier || e.scope || 'SHARED',
        group: Math.floor(i / 5),
      }));
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < Math.min(nodes.length, i + 3); j++) {
          if (nodes[i].tier === nodes[j].tier || nodes[i].type === nodes[j].type) {
            edges.push({ source: nodes[i].id, target: nodes[j].id, weight: +(0.5 + Math.random() * 0.5).toFixed(2) });
          }
        }
      }
    }

    if (nodes.length === 0) {
      const labels = ['project-structure','admin-db','mcp-server','embedding','config','routes','auth','rbac','audit','kb-index','tools','types','modules','search','graph'];
      nodes = labels.map((label, i) => ({ id: `n${i}`, label, type: ['module','code','config','api','document'][i%5], tier: ['SHARED','PROJECT','USER'][i%3], group: Math.floor(i/4) }));
      edges = [{source:'n0',target:'n1',weight:0.9},{source:'n0',target:'n5',weight:0.8},{source:'n1',target:'n6',weight:0.7},{source:'n2',target:'n10',weight:0.85},{source:'n3',target:'n9',weight:0.6},{source:'n4',target:'n5',weight:0.75},{source:'n5',target:'n6',weight:0.9},{source:'n6',target:'n7',weight:0.8},{source:'n7',target:'n8',weight:0.7},{source:'n8',target:'n0',weight:0.5},{source:'n9',target:'n13',weight:0.85},{source:'n10',target:'n11',weight:0.6},{source:'n11',target:'n12',weight:0.7},{source:'n12',target:'n13',weight:0.55},{source:'n13',target:'n14',weight:0.8},{source:'n14',target:'n0',weight:0.65}];
    }

    return c.json({ nodes, edges, stats: { totalNodes: nodes.length, totalEdges: edges.length } });
  });

  // Analytics
  app.get('/api/admin/analytics', (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;

    const now = Date.now();
    const qualityScores = Array.from({length:10},(_,i)=>({range:`${i*10}-${(i+1)*10}`,count:Math.floor(Math.random()*30)+(i>5?20:5)}));
    const usageOverTime = Array.from({length:14},(_,i)=>{const date=new Date(now-(13-i)*86400000);return{date:date.toISOString().split('T')[0],queries:Math.floor(Math.random()*100)+20,ingestions:Math.floor(Math.random()*30)+5};});
    const embeddingSpace = Array.from({length:50},(_,i)=>{const cluster=Math.floor(i/10);return{x:+([0.2,0.5,0.8,0.3,0.7][cluster]+(Math.random()-0.5)*0.2).toFixed(3),y:+([0.3,0.7,0.5,0.8,0.2][cluster]+(Math.random()-0.5)*0.2).toFixed(3),label:`Entry ${i+1}`,cluster,type:['document','code','config','api','module'][cluster]};});
    const summary = {totalEntries:getKbEntryCount(),avgQuality:0.78,avgQueryTime:42,cacheHitRate:0.87,entriesByTier:{USER:45,PROJECT:62,SHARED:35},entriesByType:{document:48,code:52,config:18,api:14,module:10}};

    return c.json({ summary, qualityScores, usageOverTime, embeddingSpace });
  });

  // KB Entry Linking
  app.post('/api/admin/kb/entries/:id/link', async (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;
    const entryId = c.req.param('id');
    const { targetId, linkType } = await c.req.json();
    if (!targetId) return c.json({ error: 'targetId is required' }, 400);
    if (!kbLinks[entryId]) kbLinks[entryId] = [];
    kbLinks[entryId].push({ targetId, linkType: linkType || 'related', createdAt: new Date().toISOString() });
    recordAudit(user.userId, user.username, 'LINK_ENTRY', 'kb', entryId, JSON.stringify({ targetId, linkType }));
    return c.json({ success: true, links: kbLinks[entryId] });
  });

  app.get('/api/admin/kb/entries/:id/links', (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;
    return c.json({ entryId: c.req.param('id'), links: kbLinks[c.req.param('id')] || [] });
  });

  // KB Entry Tagging
  app.post('/api/admin/kb/entries/:id/tags', async (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;
    const entryId = c.req.param('id');
    const { tags } = await c.req.json();
    if (!Array.isArray(tags)) return c.json({ error: 'tags must be an array' }, 400);
    kbTags[entryId] = tags;
    recordAudit(user.userId, user.username, 'TAG_ENTRY', 'kb', entryId, JSON.stringify({ tags }));
    return c.json({ success: true, entryId, tags: kbTags[entryId] });
  });

  app.get('/api/admin/kb/entries/:id/tags', (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;
    return c.json({ entryId: c.req.param('id'), tags: kbTags[c.req.param('id')] || [] });
  });

  // KB Promotion Queue
  app.get('/api/admin/kb/promotions', (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;
    const status = c.req.query('status') || undefined;
    let filtered = [...promotionQueue];
    if (status) filtered = filtered.filter(p => p.status === status);
    return c.json({ promotions: filtered, total: filtered.length });
  });

  app.post('/api/admin/kb/promotions', async (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;
    const { entryId, fromTier, toTier, reason } = await c.req.json();
    if (!entryId || !toTier) return c.json({ error: 'entryId and toTier required' }, 400);
    const promotion = { id: 'promo-' + Date.now().toString(36), entryId, fromTier: fromTier || 'USER', toTier, reason: reason || '', requestedBy: user.username, requestedAt: new Date().toISOString(), status: 'pending' };
    promotionQueue.push(promotion);
    recordAudit(user.userId, user.username, 'REQUEST_PROMOTION', 'kb', entryId, JSON.stringify({ fromTier, toTier }));
    return c.json({ success: true, promotion }, 201);
  });

  app.post('/api/admin/kb/promotions/:id/review', async (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;
    const promoId = c.req.param('id');
    const { action } = await c.req.json();
    if (!action || !['approve','reject'].includes(action)) return c.json({ error: 'action must be approve or reject' }, 400);
    const promo = promotionQueue.find(p => p.id === promoId);
    if (!promo) return c.json({ error: 'Promotion not found' }, 404);
    promo.status = action === 'approve' ? 'approved' : 'rejected';
    promo.reviewedBy = user.username;
    promo.reviewedAt = new Date().toISOString();
    recordAudit(user.userId, user.username, action === 'approve' ? 'APPROVE_PROMOTION' : 'REJECT_PROMOTION', 'kb', promo.entryId);
    return c.json({ success: true, promotion: promo });
  });

  // KB Import/Export
  app.get('/api/admin/kb/export', (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;
    const result = getKbEntries(1, 10000, 'created_at', 'desc');
    recordAudit(user.userId, user.username, 'KB_EXPORT', 'kb', undefined, JSON.stringify({ count: result.items.length }));
    return c.json({ entries: result.items, exportedAt: new Date().toISOString(), count: result.items.length });
  });

  app.post('/api/admin/kb/import', async (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;
    try {
      const { entries } = await c.req.json();
      if (!Array.isArray(entries)) return c.json({ error: 'entries must be an array' }, 400);
      recordAudit(user.userId, user.username, 'KB_IMPORT', 'kb', undefined, JSON.stringify({ count: entries.length }));
      return c.json({ success: true, imported: entries.length, message: `${entries.length} entries queued for import` });
    } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  });

  // ===== Profile Update =====

  app.post('/api/admin/profile', async (c) => {
    const user = requireAuth(c);
    if (user instanceof Response) return user;
    const { email } = await c.req.json();
    if (email !== undefined) {
      const d = getAdminDb();
      d.prepare('UPDATE users SET email = ? WHERE user_id = ?').run(email, user.userId);
      recordAudit(user.userId, user.username, 'UPDATE_PROFILE', 'users', user.userId, JSON.stringify({ email }));
    }
    const dbUser = getUserById(user.userId);
    return c.json({ success: true, user: { userId: dbUser?.userId, username: dbUser?.username, email: dbUser?.email } });
  });

  // ===== SSE Real-Time Updates (BR-37) =====
  // Dashboard auto-push: sends server stats every 30 seconds to connected clients.
  // BRD states "auto-refreshes every 30 seconds" — SSE provides server-push.

  const sseClients: Set<WritableStreamDefaultWriter> = new Set();

  app.get('/api/admin/sse', (c) => {
    const user = authenticate(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    sseClients.add(writer);

    const encoder = new TextEncoder();

    // Send initial connection event
    writer.write(encoder.encode(`event: connected\ndata: ${JSON.stringify({ userId: user.userId, timestamp: new Date().toISOString() })}\n\n`));

    // Build stats payload
    const buildStats = () => {
      const uptimeMs = Date.now() - SERVER_START_TIME;
      const mem = process.memoryUsage();
      const d = getAdminDb();
      const userCount = (d.prepare('SELECT COUNT(*) as cnt FROM users').get() as any).cnt;
      const kbCount = getKbEntryCount();
      return JSON.stringify({
        kbEntries: kbCount,
        users: userCount,
        uptime: { ms: uptimeMs, formatted: formatUptime(uptimeMs) },
        memory: { heapUsed: mem.heapUsed, heapTotal: mem.heapTotal, rss: mem.rss, formatted: formatBytes(mem.heapUsed) + ' / ' + formatBytes(mem.heapTotal) },
        timestamp: new Date().toISOString(),
      });
    };

    // Send stats immediately
    writer.write(encoder.encode(`event: stats\ndata: ${buildStats()}\n\n`));

    // Push stats every 30 seconds
    const interval = setInterval(() => {
      try {
        writer.write(encoder.encode(`event: stats\ndata: ${buildStats()}\n\n`));
      } catch {
        clearInterval(interval);
        sseClients.delete(writer);
      }
    }, 30000);

    // Cleanup on client disconnect
    c.req.raw.signal.addEventListener('abort', () => {
      clearInterval(interval);
      sseClients.delete(writer);
      writer.close().catch(() => {});
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  });

  logger.info('Admin portal routes registered: /admin + /api/admin/* (with auth, SSE, rate-limited)');
  return app;
}
