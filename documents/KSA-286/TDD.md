# Technical Design Document (TDD)

## Code Intelligence Extension — KSA-286: Web Admin Portal - Server Operations Dashboard and RBAC

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-286 |
| Title | Web Admin Portal - Server Operations Dashboard and RBAC |
| Author | SA Agent |
| Version | 2.1 |
| Date | 2025-07-23 |
| Status | Draft |
| Architecture Pattern | Plugin (extends existing Backend MCP Server) |
| Related FSD | FSD-v2-KSA-286.docx |
| Tech Stack | TypeScript, Node.js, Hono, SQLite (better-sqlite3), React 18 (Babel standalone CDN) |

---

## 1. Architecture Overview

### 1.1 Design Principles

1. **Plugin Architecture** — Portal is a module within the existing Backend MCP Server (KSA-284)
2. **Shared Infrastructure** — Reuses HTTP server (port 48721), SQLite, JWT auth
3. **Modular Backend** — Each feature is an independent service with its own router
4. **SPA Frontend** — React 18 app using Babel standalone CDN (no build step), served as single HTML file
5. **Permission-First** — RBAC middleware enforces access before any handler

### 1.2 High-Level Architecture

![Architecture](diagrams/architecture.png)

The admin portal integrates as a module within the Backend MCP Server:
- Hono routes under `/api/admin/*` and `/admin/*` (single port 48721)
- RBAC middleware chain: JWT Validate → Permission Check → Rate Limit → Handler → Audit
- Service layer modules for each feature domain
- Shared SQLite database with new admin tables

### 1.3 Module Integration

| Module | Integrates With | Method |
|--------|----------------|--------|
| AdminRouter | Hono app (KSA-284) | `app.route('/', adminRoute)` |
| Static Server | Hono app | `c.html(fs.readFileSync(spaPath))` |
| RBACMiddleware | JWT Auth (KSA-285) | `jwtService.validate(token)` |
| KBAdminService | KB Engine (KSA-285) | Direct function calls |
| MCPAdminService | MCP Orchestrator (KSA-284) | Direct function calls |
| SSEManager | Hono response | Long-lived HTTP connections |

---

## 2. Module Design

### 2.1 Backend Modules

```
backend/src/server/routes/
├── admin.ts                  # All admin API routes + SPA serving (Hono)
├── api.ts                    # Core API routes
├── health.ts                 # Health check route
└── tools.ts                  # MCP tools route

backend/src/admin-ui/dist/
└── index.html                # React 18 SPA (Babel standalone CDN, no build step)
```

### 2.2 Frontend Structure

```
backend/src/admin-ui/dist/
└── index.html                # Single-file React 18 SPA
                              # Uses Babel standalone CDN for JSX transform
                              # All components inline — no build step, no node_modules
                              # CDN deps: React 18, ReactDOM, Babel standalone
```

---

## 3. API Design (Key Endpoints)

### 3.1 Authentication

```typescript
// GET /api/admin/me
// Response 200:
interface MeResponse {
  userId: string;
  username: string;
  email: string;
  accessGroup: { id: string; name: string };
  permissions: Array<{ permissionId: string; roleData: Record<string, boolean | number | string[]> }>;
  allowedModules: string[];  // Derived from permissions for UI rendering
}
```

### 3.2 Dashboard

```typescript
// GET /api/admin/dashboard/health
interface HealthResponse {
  uptime: number;
  memoryUsageMB: number;
  cpuPercent: number;
  sqliteFileSizeMB: number;
  mcpServers: { online: number; total: number; servers: ServerStatus[] };
  kbEntryCount: { user: number; project: number; shared: number };
  activeUsers: number;
  alerts: Array<{ severity: 'info'|'warning'|'critical'; message: string; since: string }>;
}
```

### 3.3 Users CRUD

```typescript
// POST /api/admin/users
interface CreateUserRequest {
  username: string;   // 3-50 chars, alphanum + . + -
  email: string;      // Valid email format
  password: string;   // Min 8, 1 upper, 1 lower, 1 number
  accessGroupId: string;
}
// Response 201: { userId, username, email, status, accessGroupId, createdAt }

// PATCH /api/admin/users/:id/status
interface UpdateStatusRequest {
  status: 'ACTIVE' | 'DISABLED';
}
// Response 200: { userId, status, sessionsTerminated: number }
```

### 3.4 RBAC

```typescript
// GET /api/admin/rbac/rule-definitions
// Returns the complete Permission Rules Registry (read-only)
// Response: { permissionId, rules: [{ ruleName, ruleType, allowedValues, defaultValue, isLocked, description }] }[]

// POST /api/admin/rbac/groups
interface CreateGroupRequest {
  accessGroupName: string;  // 3-100 chars, unique
  permissions: Array<{
    permissionId: string;
    roleData: {
      // Keys = rule names from PermissionRuleDefinition
      // Values must match rule type + allowed values
      [ruleName: string]: boolean | number | string[];
    };
  }>;
}
// Validation: each roleData key must exist in rule definitions for that permission
// Validation: each value must pass type check + allowed values check
// Locked rules (e.g., canDeleteSystemGroups) are ignored if submitted — always use default

// PUT /api/admin/rbac/groups/:id
// Same body as POST — full replacement of permissions + roleData
// Returns 400 if roleData contains invalid rule names or out-of-range values
```

### 3.6 Impersonation

```typescript
// GET /api/admin/impersonate/:userId
// Permission Required: RBAC_MANAGE
// Response 200:
interface ImpersonateResponse {
  userId: string;
  username: string;
  permissions: string[];  // All permission IDs for target user's access group
}
// Response 403: { error: "Access denied" } — caller lacks RBAC_MANAGE
// Response 404: { error: "User not found" } — target userId invalid

// X-Impersonate Header Support:
// Any API request can include X-Impersonate: {userId} header
// RBAC middleware checks: if header present AND caller has RBAC_MANAGE
//   → resolves permissions from target user instead of caller
//   → returns {impersonating: true} in auth context
```

### 3.7 KB Quality

```typescript
// GET /api/admin/kb/quality
// Permission Required: KB_READ
// Response 200:
interface KBQualityResponse {
  distribution: Record<string, number>;  // Score bucket → count
  averageScore: number;
  totalEntries: number;
  good: number;   // score >= 80
  fair: number;   // score 60-79
  poor: number;   // score < 60
}
```

### 3.8 KB Tags CRUD

```typescript
// GET /api/admin/kb/tags — List all tags with counts
// Permission Required: KB_READ
// Response 200: { tags: Array<{name: string, count: number, lastUsed: string}> }

// POST /api/admin/kb/tags — Create tag
// Permission Required: KB_WRITE
// Body: { name: string }
// Response 201: { success: true, tag: string }
// Response 409: { error: "Tag already exists" }

// PUT /api/admin/kb/tags/:name — Rename tag
// Permission Required: KB_WRITE
// Body: { newName: string }
// Response 200: { success: true, renamed: number }

// DELETE /api/admin/kb/tags/:name — Delete tag
// Permission Required: KB_WRITE
// Response 200: { success: true, removed: number }

// POST /api/admin/kb/tags/merge — Merge source into target
// Permission Required: KB_WRITE
// Body: { sourceTag: string, targetTag: string }
// Response 200: { success: true, merged: number }

// GET /api/admin/kb/tags/:name/entries — List entries with tag
// Permission Required: KB_READ
// Response 200: { tag: string, entryIds: string[] }
```

### 3.5 KB Operations

```typescript
// POST /api/admin/kb/promotion/review
interface PromotionReviewRequest {
  entryId: string;
  decision: 'APPROVE' | 'REJECT';
  comment: string;         // Min 10 chars
  targetTier?: 'PROJECT' | 'SHARED';  // Required if APPROVE
  additionalTags?: string[];
}
```

---

## 4. Database Schema

### 4.1 New Tables DDL

```sql
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','DISABLED','PENDING')),
  access_group_id TEXT NOT NULL REFERENCES access_groups(access_group_id),
  force_password_change INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT
);

CREATE TABLE IF NOT EXISTS access_groups (
  access_group_id TEXT PRIMARY KEY,
  access_group_name TEXT NOT NULL UNIQUE,
  is_system_group INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS permissions (
  permission_id TEXT PRIMARY KEY,
  permission_name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS permission_rule_definitions (
  permission_id TEXT NOT NULL REFERENCES permissions(permission_id),
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK(rule_type IN ('boolean','number','enum[]')),
  allowed_values TEXT NOT NULL,  -- JSON: boolean→[true,false], number→{min,max}, enum[]→["val1","val2"]
  default_value TEXT NOT NULL,   -- JSON-encoded default
  is_locked INTEGER NOT NULL DEFAULT 0,  -- 1 = cannot be changed via UI
  description TEXT,
  PRIMARY KEY (permission_id, rule_name)
);

CREATE TABLE IF NOT EXISTS group_permissions (
  access_group_id TEXT NOT NULL REFERENCES access_groups(access_group_id),
  permission_id TEXT NOT NULL REFERENCES permissions(permission_id),
  role_data TEXT NOT NULL DEFAULT '{}',  -- JSON: {ruleName: value} validated against permission_rule_definitions
  PRIMARY KEY (access_group_id, permission_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id),
  device TEXT,
  ip_address TEXT,
  login_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

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

CREATE TABLE IF NOT EXISTS config_history (
  history_id TEXT PRIMARY KEY,
  section TEXT NOT NULL,
  key TEXT NOT NULL,
  old_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  changed_by TEXT NOT NULL
);

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
```

### 4.2 Indexes

```sql
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_access_group ON users(access_group_id);
CREATE INDEX idx_sessions_user_active ON sessions(user_id, is_active);
CREATE INDEX idx_audit_timestamp ON audit_entries(timestamp DESC);
CREATE INDEX idx_audit_user ON audit_entries(user_id);
CREATE INDEX idx_audit_action ON audit_entries(action);
CREATE INDEX idx_config_history_key ON config_history(section, key, changed_at DESC);
CREATE INDEX idx_promotion_status ON kb_promotion_queue(status);
```

---

## 5. Class/Interface Design

### 5.1 Core Types

```typescript
// types/rbac.types.ts
interface User {
  userId: string;
  username: string;
  email: string;
  status: 'ACTIVE' | 'DISABLED' | 'PENDING';
  accessGroupId: string;
  forcePasswordChange: boolean;
  createdAt: string;
  lastLogin?: string;
}

interface AccessGroup {
  accessGroupId: string;
  accessGroupName: string;
  isSystemGroup: boolean;
  permissions: GroupPermission[];
}

interface GroupPermission {
  permissionId: string;
  roleData: Record<string, boolean | number | string[]>;  // Structured: keys from rule definitions
}

interface Permission {
  permissionId: string;
  permissionName: string;
  description?: string;
  rules: PermissionRuleDefinition[];  // Fixed rules for this permission
}

interface PermissionRuleDefinition {
  permissionId: string;
  ruleName: string;
  ruleType: 'boolean' | 'number' | 'enum[]';
  allowedValues: boolean[] | { min: number; max: number } | string[];
  defaultValue: boolean | number | string[];
  isLocked: boolean;
  description?: string;
}

type PermissionId = 
  | 'DASHBOARD_VIEW' | 'KB_READ' | 'KB_WRITE' | 'KB_PROMOTE'
  | 'KB_IMPORT_EXPORT' | 'MCP_ACCESS' | 'MCP_MANAGE' | 'USER_MANAGE'
  | 'RBAC_MANAGE' | 'CONFIG_EDIT' | 'SEARCH_EXPLORE' | 'AUDIT_VIEW'
  | 'GRAPH_VIEW' | 'ANALYTICS_VIEW';
```

### 5.2 Service Interfaces

```typescript
interface IUserService {
  listUsers(filters: UserFilters, pagination: PaginationParams): Promise<PaginatedResult<User>>;
  createUser(data: CreateUserRequest): Promise<User>;
  updateStatus(userId: string, status: 'ACTIVE' | 'DISABLED'): Promise<{ sessionsTerminated: number }>;
  deleteUser(userId: string): Promise<void>;
  forceLogout(userId: string, sessionId?: string): Promise<{ terminated: number }>;
  resetPassword(userId: string): Promise<{ temporaryPassword: string }>;
}

interface IRBACService {
  checkPermission(userId: string, required: PermissionId, context?: any): Promise<boolean>;
  getUserPermissions(userId: string): Promise<GroupPermission[]>;
  getRuleDefinitions(permissionId?: PermissionId): Promise<PermissionRuleDefinition[]>;
  validateRoleData(permissionId: PermissionId, roleData: Record<string, any>): { valid: boolean; errors: string[] };
  createGroup(data: CreateGroupRequest): Promise<AccessGroup>;
  updateGroup(groupId: string, data: UpdateGroupRequest): Promise<AccessGroup>;
  deleteGroup(groupId: string): Promise<void>;
  invalidateCache(userId?: string): void;
}

interface IKBAdminService {
  listEntries(filters: KBFilters, pagination: PaginationParams): Promise<PaginatedResult<KBEntry>>;
  createLink(sourceId: string, targetId: string, linkType: string): Promise<void>;
  removeLink(sourceId: string, targetId: string): Promise<void>;
  updateTags(entryId: string, tags: string[]): Promise<void>;
  reviewPromotion(data: PromotionReviewRequest, reviewerId: string): Promise<void>;
  importEntries(data: Buffer, conflictPolicy: string): Promise<ImportResult>;
  exportEntries(filters: ExportFilters): Promise<Buffer>;
  getGraphData(filters: GraphFilters): Promise<GraphData>;
}

interface IAuditService {
  record(entry: Omit<AuditEntry, 'auditId' | 'timestamp'>): Promise<void>;
  list(filters: AuditFilters, pagination: PaginationParams): Promise<PaginatedResult<AuditEntry>>;
  export(format: 'csv' | 'json', dateRange: DateRange): Promise<Buffer>;
}

interface IConfigService {
  getAll(allowedSections?: string[]): Promise<ConfigSection[]>;
  update(section: string, key: string, value: any, userId: string): Promise<ConfigUpdateResult>;
  getHistory(section?: string, key?: string): Promise<ConfigHistoryEntry[]>;
  resetToDefault(section: string, key?: string): Promise<void>;
}

interface ISSEManager {
  addClient(userId: string, response: Response): void;
  removeClient(userId: string): void;
  broadcast(event: string, data: any): void;
  sendToUser(userId: string, event: string, data: any): void;
}
```

---

## 6. Security Design

### 6.1 RBAC Middleware Implementation

```typescript
// Route → Permission mapping
const ROUTE_PERMISSIONS: Record<string, PermissionId> = {
  'GET:/api/admin/dashboard': 'DASHBOARD_VIEW',
  'GET:/api/admin/kb': 'KB_READ',
  'POST:/api/admin/kb': 'KB_WRITE',
  'GET:/api/admin/mcp': 'MCP_ACCESS',
  'POST:/api/admin/mcp/*/restart': 'MCP_MANAGE',
  // ... etc
};

// roleData validation per permission — uses PermissionRuleDefinition registry
// Each rule type has a specific validation strategy:
const RULE_VALIDATORS: Record<string, (req: Request, ruleName: string, ruleValue: any) => boolean> = {
  // boolean rules: check if action requires the rule to be true
  'boolean': (req, ruleName, value) => {
    if (ruleName === 'exportAllowed' && req.path.includes('/export')) return value === true;
    if (ruleName === 'allowImport' && req.method === 'POST' && req.path.includes('/import')) return value === true;
    if (ruleName === 'canDelete' && req.method === 'DELETE') return value === true;
    if (ruleName === 'canForceLogout' && req.path.includes('/force-logout')) return value === true;
    if (ruleName === 'canDisable' && req.path.includes('/status')) return value === true;
    if (ruleName === 'allowRestart' && req.path.includes('/restart')) return value === true;
    if (ruleName === 'allowStop' && req.path.includes('/stop')) return value === true;
    if (ruleName === 'readOnly') return value === false || req.method === 'GET';
    if (ruleName === 'allowDebugMode' && req.query.debug) return value === true;
    return true; // rule not relevant to this request
  },
  // number rules: enforcement delegated to service layer (needs DB for current counts)
  'number': (req, ruleName, value) => true,
  // enum[] rules: check requested resource is in allowed list
  'enum[]': (req, ruleName, value) => {
    if (value.includes('*')) return true;
    if (ruleName === 'allowedServers') return value.includes(req.params.serverId);
    if (ruleName === 'allowedTiers') return !req.query.tier || value.includes(req.query.tier);
    if (ruleName === 'allowedSections') return !req.params.section || value.includes(req.params.section);
    if (ruleName === 'allowedOperations') return value.includes(mapMethodToOperation(req.method));
    if (ruleName === 'allowedFormats') return !req.query.format || value.includes(req.query.format);
    if (ruleName === 'allowedMetrics') return !req.params.metric || value.includes(req.params.metric);
    return true;
  }
};
```

### 6.2 Password Security

- Hashing: bcrypt with cost factor 10
- Reset: crypto.randomBytes(12).toString('base64url') → 16-char password
- Force change flag set on reset

### 6.3 Rate Limiting

```typescript
// Using sliding window counter in SQLite
const RATE_LIMITS = {
  read: { max: 100, windowMs: 60000 },
  write: { max: 30, windowMs: 60000 },
  search: { max: 20, windowMs: 60000 },
  import: { max: 5, windowMs: 3600000 },
};
```

---

## 7. Frontend Architecture

### 7.1 Permission-Based Rendering

```typescript
// components/guards/PermissionGate.tsx
function PermissionGate({ permission, children }: Props) {
  const { hasPermission } = usePermission();
  if (!hasPermission(permission)) return null;
  return <>{children}</>;
}

// Usage in Sidebar
<PermissionGate permission="KB_READ">
  <NavItem to="/admin/kb">KB Management</NavItem>
</PermissionGate>
```

### 7.2 State Management

- **React Query** — Server state (API data), automatic refetch, cache invalidation
- **Zustand** — Client state (auth token, UI preferences, sidebar state)
- **SSE Hook** — Real-time updates pushed to UI state

### 7.3 SPA Architecture

The admin UI is a **single HTML file** (`backend/src/admin-ui/dist/index.html`) using:
- React 18 via CDN (`unpkg.com/react@18`)
- ReactDOM via CDN (`unpkg.com/react-dom@18`)
- Babel standalone via CDN (in-browser JSX transform)
- No build step, no bundler, no `node_modules` for frontend

```html
<!-- backend/src/admin-ui/dist/index.html -->
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script type="text/babel">
  // All React components defined inline
  // Routing via hash-based SPA router
  // API calls via fetch() to /api/admin/*
</script>
```

The Hono server serves this file for all `/admin*` routes via `c.html(fs.readFileSync(spaPath))`.

### 7.4 PortalInstance Component (Multi-tab Comparison View)

**Architecture Change (v2.1):** Multi-tab comparison redesigned from shared content area to independent `PortalInstance` components. Old approach (single shared content, switch tabs = switch props) caused shared graph state and shared camera issues. New approach: each tab is a full `PortalInstance` rendered in parallel, with `display:none` when inactive.

```typescript
// PortalInstance — independent portal instance per impersonated user
interface PortalInstanceProps {
  permissions: string[];    // Permission IDs for this user's access group
  username: string;         // Display name in tab header
  isActive: boolean;        // true = display:flex, false = display:none
  impersonateUserId: string; // User ID for X-Impersonate header on API calls
}

function PortalInstance({ permissions, username, isActive, impersonateUserId }: PortalInstanceProps) {
  const [page, setPage] = useState('dashboard');
  const hasPerm = (p: string) => !p || permissions.includes(p);
  const visiblePages = PAGES.filter(p => hasPerm(p.perm));
  
  // Set global impersonation context on navigation click
  const navigate = (pageId: string) => {
    window.__impersonateUserId = impersonateUserId;
    setPage(pageId);
  };

  return (
    <div style={{ display: isActive ? 'flex' : 'none', flex: 1, minHeight: 0 }}>
      {/* Own Sidebar (200px) — filtered by target user's permissions */}
      <div style={{ width: 200, background: '#f8fafc', borderRight: '1px solid #e2e8f0' }}>
        <div>{username} — {permissions.length} perms</div>
        {visiblePages.map(p => (
          <div key={p.id} className="nav-item" onClick={() => navigate(p.id)}>{p.label}</div>
        ))}
      </div>
      {/* Own Content Area — independent page rendering, own graph instance */}
      <div className="main" style={{ flex: 1, padding: 16, overflow: 'auto' }}>
        {renderPage(page, permissions, impersonateUserId)}
      </div>
    </div>
  );
}
```

**Multi-tab Layout (all PortalInstances rendered in parallel):**
```
[Tab Bar: Admin (14) | editor1 (7) | + ]                [Logout]
├── PortalInstance(admin)    ← display:flex when active
│   ├── Sidebar (200px, own nav, className="nav-item")
│   └── Content (own page rendering, own graph instance, className="main")
├── PortalInstance(editor1)  ← display:none when inactive
│   ├── Sidebar (200px, filtered by permissions)
│   └── Content (own page rendering, own graph instance)
```

**Key Architecture Decisions:**
- **Independent state per tab**: Each PortalInstance has own `page` state, own graph instance, own camera position — no shared state between tabs
- **Switch tab = toggle visibility only**: `display:none` / `display:flex` — no remount, no data loss, graph state preserved
- **Tab Bar always visible at top** (dark background #1e293b): Shows all open tabs with permission count badge
- **"+" button opens dropdown** to add users (only visible with RBAC_MANAGE)
- **`__impersonateUserId` global** set on navigation click to route API calls to correct user context
- **Sidebar items have `className="nav-item"`** for Playwright test compatibility
- **Content div has `className="main"`** for test compatibility
- Each PortalInstance calls `GET /api/admin/impersonate/:userId` to get target permissions on creation
- Tabs removed via close button (X) — PortalInstance unmounts only when explicitly closed

### 7.5 Impersonation Middleware Integration

```typescript
// In requireAuth() function (admin.ts):
const impersonateId = c.req.header('X-Impersonate') || '';
if (impersonateId && impersonateId !== session.userId) {
  const { has } = checkPermission(session.userId, 'RBAC_MANAGE');
  if (has) {
    const target = getUserById(impersonateId);
    if (target) {
      return { userId: target.userId, username: target.username, 
               accessGroupId: target.accessGroupId, impersonating: true };
    }
  }
}
```

### 7.6 Force Password Change Flow

```typescript
// App component checks forcePasswordChange on mount:
useEffect(() => {
  if (userInfo.forcePasswordChange) setForceChange(true);
}, []);

// When forceChange=true, renders password change form instead of main portal
// After successful change: setForceChange(false), update localStorage
```

### 7.7 Global 403 Error Handler

```typescript
// api() function wraps fetch() with 403 handling:
async function api(path: string, opts?: RequestInit) {
  const r = await fetch(API + path, { headers: { Authorization: 'Bearer ' + token }, ...opts });
  if (r.status === 401) { /* logout */ }
  if (r.status === 403) {
    return r.json().then(d => { showForbidden(d.error || 'Access denied'); return { __error: true, ...d }; });
  }
  // ... normal response handling
}
```

---

## 8. Error Handling

### 8.1 Error Codes

```typescript
enum AdminErrorCode {
  // Auth
  UNAUTHORIZED = 'UNAUTHORIZED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  ROLE_DATA_DENIED = 'ROLE_DATA_DENIED',
  USER_DISABLED = 'USER_DISABLED',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DUPLICATE_USERNAME = 'DUPLICATE_USERNAME',
  DUPLICATE_EMAIL = 'DUPLICATE_EMAIL',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  INVALID_ROLE_DATA = 'INVALID_ROLE_DATA',
  
  // Business logic
  LAST_SYSTEM_OWNER = 'LAST_SYSTEM_OWNER',
  CIRCULAR_LINK = 'CIRCULAR_LINK',
  ENTRY_NOT_FOUND = 'ENTRY_NOT_FOUND',
  GROUP_HAS_USERS = 'GROUP_HAS_USERS',
  PERMISSION_IN_USE = 'PERMISSION_IN_USE',
  IMPORT_TOO_LARGE = 'IMPORT_TOO_LARGE',
  CONCURRENT_EDIT = 'CONCURRENT_EDIT',
  
  // System
  SERVER_UNRESPONSIVE = 'SERVER_UNRESPONSIVE',
  RESTART_FAILED = 'RESTART_FAILED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
```

---

## 9. Performance Design

### 9.1 Caching Strategy

| Data | Cache Type | TTL | Invalidation |
|------|-----------|-----|--------------|
| User permissions | In-memory Map | None | On group update, user reassign |
| Config values | In-memory object | None | On config update (hot-reload) |
| Dashboard health | Computed | 30s | Auto-refresh timer |
| KB entry count | SQLite query cache | 60s | On KB write |

### 9.2 Database Optimization

- WAL mode enabled for concurrent reads
- Prepared statements for all queries
- Batch insert for audit entries (flush every 1s or 10 entries)
- Pagination via `LIMIT/OFFSET` with count cache
- Audit purge job: daily, delete entries older than retention days

### 9.3 SSE Optimization

- Single EventSource per client (multiplexed events)
- Server-side filtering: only send events relevant to user's permissions
- Connection limit: 1 SSE per user (close previous on new connection)
- Heartbeat: 15s keepalive to detect dead connections

---

## 10. Implementation Checklist

| # | Task | Priority | Effort |
|---|------|----------|--------|
| 1 | Database migration (create tables + indexes + seed) | P0 | 2h |
| 2 | RBAC middleware + route-permission map | P0 | 4h |
| 3 | User repository + service + router | P0 | 4h |
| 4 | Access Group CRUD (repository + service + router) | P0 | 3h |
| 5 | Audit middleware + service + repository | P0 | 3h |
| 6 | JWT integration (validate, extract user context) | P0 | 2h |
| 7 | Dashboard health endpoint | P1 | 2h |
| 8 | KB Admin service (list, link, tag, promote) | P1 | 6h |
| 9 | MCP Admin service (list, toggle, restart, logs) | P1 | 4h |
| 10 | Config service (get, update, history, hot-reload) | P1 | 4h |
| 11 | Search explorer endpoint | P2 | 2h |
| 12 | Analytics/embeddings endpoints | P2 | 3h |
| 13 | SSE manager (events stream) | P1 | 3h |
| 14 | Rate limiting middleware | P1 | 2h |
| 15 | Import/Export KB endpoints | P2 | 4h |
| 16 | React SPA (single HTML, Babel standalone CDN) | P0 | 3h |
| 17 | Login page + auth store | P0 | 2h |
| 18 | Dashboard page (widgets, charts) | P1 | 4h |
| 19 | KB Management pages (list, detail, link, promote) | P1 | 8h |
| 20 | KB Graph page (ForceGraph3D, 3D WebGL) | P2 | 6h |
| 21 | MCP Management page | P1 | 4h |
| 22 | User Management page | P1 | 4h |
| 23 | RBAC Management page (groups, permissions) | P1 | 6h |
| 24 | Configuration page | P2 | 4h |
| 25 | Audit Trail page | P2 | 3h |
| 26 | Analytics page (charts, embedding visualizer) | P2 | 6h |
| 27 | Search Explorer page | P3 | 3h |
| 28 | Permission-based sidebar + route guards | P0 | 2h |
| 29 | SSE hook + real-time updates | P1 | 3h |
| 30 | SPA served by Hono (no build pipeline) | P0 | 1h |

**Total estimated effort: ~100 hours**

---

## 11. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |

### Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| HTTP Framework | Hono | Lightweight, TypeScript-first, Web Standard APIs |
| Frontend framework | React 18 (CDN) | No build step, Babel standalone in-browser JSX |
| Bundler | None | Single HTML file, CDN dependencies |
| State (client) | React useState/useReducer | No external state lib needed for single-file SPA |
| Graph visualization | ForceGraph3D (CDN) | 3D WebGL rendering via Three.js, no build required |
| HTTP client | fetch() | Native browser API, no dependency needed |
| Password hashing | bcrypt | Industry standard |
| UUID generation | crypto.randomUUID() | Native Node.js |
| Validation | Zod | TypeScript-first schemas |
| CSS | Tailwind CSS | Utility-first, rapid UI |
| UI Components | shadcn/ui | Accessible, customizable |
