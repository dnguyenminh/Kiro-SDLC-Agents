# Deployment Guide (DPG)

## Code Intelligence Extension — KSA-286: Web Admin Portal

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-286 |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2025-07-14 |

---

## 1. Overview

This guide covers deploying the Web Admin Portal module (KSA-286) as part of the Backend MCP Server (KSA-284). The portal is **not a separate service** — it's a module registered within the existing server.

---

## 2. Prerequisites

| Prerequisite | Version | Verification |
|-------------|---------|--------------|
| Node.js | >= 18.0 | `node --version` |
| Backend MCP Server (KSA-284) | Running | `curl http://localhost:48721/health` |
| JWT Auth (KSA-285) | Configured | Token issuance working |
| SQLite | Bundled (better-sqlite3) | Included in dependencies |

---

## 3. Deployment Steps

### Step 1: Install Dependencies

```bash
npm install bcrypt
```

### Step 2: Run Database Migration

The database migrations are applied automatically on server startup. Migration SQL files are embedded in the backend source code. No manual migration step needed.

### Step 3: Seed Permissions & Default User

Seeding is done automatically on first server start. The admin routes at `backend/src/server/routes/admin.ts` handle initial setup.

### Step 3b: Seed Permission Rule Definitions (32 Rules)

Permission rule definitions are seeded automatically on startup from the backend configuration.

This seeds the `permission_rule_definitions` table with 32 fixed rules across 14 permissions. Each rule defines:
- `rule_type`: boolean, number, or enum[]
- `allowed_values`: valid options (JSON)
- `default_value`: applied when not explicitly set
- `is_locked`: 1 for RBAC_MANAGE.canDeleteSystemGroups (cannot be changed via UI)

**⚠️ Migration from freeform JSON roleData:**
If upgrading from a version with freeform `roleData` (pre-Permission Rules):
1. Existing `role_data` in `group_permissions` must be validated against new rule definitions
2. Invalid keys (not matching any rule name) are stripped
3. Values outside allowed ranges are reset to defaults
4. Run: migrations are applied automatically on server restart

**Migration script handles:**
- Drops `role_data_schema` column from `permissions` (no longer needed)
- Creates `permission_rule_definitions` table
- Validates existing `role_data` JSON in `group_permissions` against new definitions
- Logs any coerced values for admin review

### Step 4: Admin Route Registration

Admin routes are automatically registered via `createAdminRoute()` in `backend/src/server/HttpServer.ts`:
```typescript
const adminRoute = createAdminRoute(this.logger);
app.route('/', adminRoute);
```
No manual registration needed — routes are part of the Hono app initialization.

### Step 5: SPA Deployment

The React SPA is a single HTML file at `backend/src/admin-ui/dist/index.html`. No build step required — it uses React 18 + Babel standalone via CDN. The file is served by the Hono admin route handler.

### Step 6: Verify Deployment

```bash
# Health check
curl http://localhost:48721/api/admin/dashboard/health

# Login
curl -X POST http://localhost:48721/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin123!"}'

# Access portal
open http://localhost:48721/admin/
```

---

## 4. Pre-Deployment Checklist

| # | Item | Done |
|---|------|------|
| 1 | Backend MCP Server running | ☐ |
| 2 | JWT authentication working | ☐ |
| 3 | SQLite database accessible | ☐ |
| 4 | Migration SQL executed successfully | ☐ |
| 5 | Seed data loaded (permissions + admin user) | ☐ |
| 6 | Admin module registered in server | ☐ |
| 7 | React SPA built (if applicable) | ☐ |
| 8 | Default admin login tested | ☐ |
| 9 | RBAC verified (non-admin gets 403) | ☐ |

---

## 5. Post-Deployment Verification

| # | Test | Expected Result |
|---|------|----------------|
| 1 | `GET /api/admin/dashboard/health` with valid JWT | 200 + health metrics |
| 2 | `GET /api/admin/dashboard/health` without JWT | 401 |
| 3 | `GET /admin/` in browser | React SPA loads |
| 4 | Login as admin | Dashboard visible |
| 5 | Create test user with "Viewer" group | Success |
| 6 | Login as test user → try user management | 403 (no USER_MANAGE permission) |

---

## 6. Rollback Plan

### Immediate Rollback (< 5 minutes)

1. Remove admin module registration from server entry point
2. Restart server
3. Portal routes become 404 — no impact on existing MCP functionality

### Data Rollback (if needed)

```sql
-- Drop all admin tables (CAUTION: destroys all admin data)
DROP TABLE IF EXISTS config_history;
DROP TABLE IF EXISTS config_entries;
DROP TABLE IF EXISTS kb_promotion_queue;
DROP TABLE IF EXISTS audit_entries;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS group_permissions;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS permission_rule_definitions;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS access_groups;
```

### Rollback Considerations for Permission Rules Migration

| Scenario | Action | Risk |
|----------|--------|------|
| Rolling back after 002-migrate-roledata.sql | Restore `role_data_schema` column to `permissions` | Low — seed data can be re-applied |
| Groups have structured roleData | Old code expects freeform JSON — may fail validation | Medium — backup `group_permissions` before migration |
| LOCKED rules (canDeleteSystemGroups) | Old code has no concept of locked rules | Low — behavior same (always false) |

### Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Rollback removes audit data | Low | Export audit before rollback |
| Rollback removes user accounts | Medium | Document user list before rollback |
| SQLite corruption | Low | Backup .db file before migration |

---

## 7. Monitoring

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Memory usage | Dashboard /health | > 80% of system RAM |
| SQLite file size | Dashboard /health | > 1GB |
| Active sessions | Dashboard /health | > 100 concurrent |
| API response time | Audit trail | p95 > 500ms |
| Failed logins | Audit (LOGIN_FAILED) | > 10 in 5 minutes |

---

## 8. Configuration

See User Guide Section 3 for full configuration reference. Key deployment configs:

```yaml
admin:
  session.ttlHours: 1
  audit.retentionDays: 90
  rateLimit.read: 100
  rateLimit.write: 30
```
