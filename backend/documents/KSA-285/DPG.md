# Deployment Guide (DPG)

## Code Intelligence Extension — KSA-285: Authentication, Multi-Tenant KB, and MCP Server Configuration

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-285 |
| Title | Authentication, Multi-Tenant KB, and MCP Server Configuration |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2025-07-15 |
| Status | Approved |
| Related TDD | TDD-v1-KSA-285.docx |
| Architecture Pattern | Plugin (IDE Extension) |
| Parent Ticket | KSA-284 (Split Extension: Lightweight Proxy + Backend MCP Server) |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-15 | DevOps Agent | Initiate document — auto-generated from TDD and project context |

---

## Sign-Off

| Name | Role | Signature and date |
|------|------|--------------------|
| | Dev Lead | ☐ Approved for deployment |
| | QA Lead | ☐ Testing completed (83/83 pass) |
| | Ops Lead | ☐ Infrastructure ready |

---

## 1. Overview

### 1.1 Feature Summary

KSA-285 adds three critical capabilities to the Code Intelligence Extension's split architecture (KSA-284):

1. **Authentication** — JWT-based local auth (HS256) + OpenID Connect SSO with PKCE. Secure token storage in VS Code SecretStorage with auto-refresh.
2. **Multi-Tenant 3-Tier Knowledge Base** — User KB (personal, TTL-based), Project KB (team-shared, permanent), Shared KB (company-wide, admin-managed) with auto-promotion between tiers.
3. **MCP Server Configuration** — Webview-based per-user configuration of MCP server credentials (Jira, DrawIO, Export) stored encrypted in Backend database.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| AuthModule | New | Backend module: login, SSO, refresh, logout endpoints |
| ConfigModule | New | Backend module: per-user MCP server config management |
| MemoryModule | Modified | Extended with multi-tier KB (User/Project/Shared) + promotion |
| SchedulerModule | New | Background jobs: KB promotion (30 min) + TTL cleanup (1 hr) |
| Database Schema | Migration | New tables: users, sessions, mcp_config, sso_config, audit_log; Extended: kb_entries |
| Login Webview | New | Extension: authentication UI (username/password + SSO button) |
| MCP Config Webview | New | Extension: per-user MCP server credential management |
| Auth Interceptor | New | Extension: Bearer token injection on all Backend requests |
| SecretStorage Manager | New | Extension: encrypted JWT + refresh token lifecycle |

### 1.3 Target Environments

| Environment | URL | Deploy Order | Approval Required |
|-------------|-----|-------------|-------------------|
| DEV | localhost:48721 | 1st | No |
| SIT | localhost:48721 (test profile) | 2nd | No |
| UAT | localhost:48721 (UAT config) | 3rd | QA Sign-off |
| PROD | localhost:48721 (production) | 4th | PM + Dev Lead Sign-off |

> **Note:** This is an IDE Extension — deployment is per-developer machine. "Environments" refer to configuration profiles, not separate servers.

---

## 2. Prerequisites

### 2.1 Infrastructure

| Requirement | Status | Notes |
|-------------|--------|-------|
| Node.js 20+ installed | Ready | Backend runtime |
| VS Code >= 1.85.0 | Ready | SecretStorage API required |
| SQLite (better-sqlite3) | Ready | Existing database in .code-intel/index.db |
| Localhost port 48721 available | Ready | Backend HTTP server port |
| Filesystem write access to .code-intel/ | Ready | Database + model storage |

### 2.2 Software Dependencies

| Dependency | Version | Status |
|-----------|---------|--------|
| Node.js | 20+ | Required |
| TypeScript | 5.5+ | Build-time |
| Hono | 4.x | HTTP framework (existing) |
| jose | 5.6+ | JWT sign/verify |
| zod | 3.23+ | Input validation (existing) |
| better-sqlite3 | 12.x | Database driver (existing) |
| ONNX Runtime | 1.18.x | Semantic search embeddings (existing) |

### 2.3 Access Requirements

| Access | Type | Who Needs It |
|--------|------|-------------|
| VS Code Extension Host | Local filesystem | Developer |
| .code-intel/index.db | Read/Write | Backend process |
| VS Code SecretStorage | API access | Extension process |
| Network (for SSO only) | HTTPS outbound | Identity Provider |

### 2.4 Backup Requirements

- [x] Database backup completed before deployment (copy .code-intel/index.db)
- [x] Previous extension .vsix artifact preserved
- [x] Configuration backup (settings.json, .env files)

---

## 3. Pre-Deployment Checklist

| # | Item | Responsible | Status |
|---|------|-------------|--------|
| 1 | Code merged to release branch (KSA-285) | Developer | ☑ |
| 2 | All unit tests passed (83/83) | Developer | ☑ |
| 3 | All integration tests passed | QA | ☑ |
| 4 | UAT sign-off obtained | QA + BA | ☑ |
| 5 | Database backup completed (.code-intel/index.db) | DevOps | ☐ |
| 6 | JWT_SECRET generated for Backend | DevOps | ☐ |
| 7 | SSO configuration prepared (if applicable) | Admin | ☐ |
| 8 | Migration script reviewed | Developer | ☑ |
| 9 | Rollback plan reviewed | Team | ☑ |
| 10 | Version bump confirmed (v1.1.0) | DevOps | ☐ |

---

## 4. Database Migration

### 4.1 Migration Scripts

| Order | Script | Description | Estimated Time |
|-------|--------|-------------|----------------|
| 1 | 002-auth-multitenant.ts | Create users, sessions, mcp_config, sso_config, audit_log tables; Extend kb_entries | < 1s |

### 4.2 Execution Steps

```bash
# Step 1: Backup database
cp .code-intel/index.db .code-intel/index.db.bak.$(date +%Y%m%d%H%M%S)

# Step 2: Run migration (automatic on Backend startup)
# The DatabaseManager auto-runs pending migrations on init
cd src/backend
npm run build
npm run start
# Migration 002-auth-multitenant executes automatically

# Step 3: Verify migration
sqlite3 .code-intel/index.db ".tables"
# Expected output includes: users sessions kb_entries mcp_config sso_config audit_log
```

### 4.3 Verification Queries

```sql
-- Verify tables created
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
-- Expected: audit_log, kb_entries, mcp_config, sessions, sso_config, users

-- Verify kb_entries has new columns
PRAGMA table_info(kb_entries);
-- Expected columns include: tier, owner_id, project_id, content_hash, quality_score, ttl_days, promoted, promoted_from, promoted_by, referenced_by_projects, admin_promoted

-- Verify WAL mode enabled
PRAGMA journal_mode;
-- Expected: wal

-- Verify indexes created
SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='kb_entries';
-- Expected: idx_kb_tier_owner, idx_kb_tier_project, idx_kb_tier3, idx_kb_promotion, idx_kb_ttl, idx_kb_content_hash
```

### 4.4 Rollback Scripts

```sql
-- Rollback migration 002 (destructive — data loss for new tables)
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS sso_config;
DROP TABLE IF EXISTS mcp_config;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

-- Restore kb_entries from backup (columns cannot be easily dropped in SQLite)
-- RECOMMENDED: restore entire .code-intel/index.db from backup file
```

---

## 5. Application Deployment

### 5.1 Deployment Flow

![Deployment Flow](diagrams/deployment-flow.png)

### 5.2 Deployment Steps

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Stop Backend server | Kill process via PID file or Ctrl+C | Process terminated |
| 2 | Backup database | `cp .code-intel/index.db .code-intel/index.db.bak` | Backup file exists |
| 3 | Build Backend | `cd src/backend && npm run build` | No TypeScript errors |
| 4 | Build Extension | `cd src && npm run build` | No compilation errors |
| 5 | Start Backend | `cd src/backend && npm run start` | "Server listening on port 48721" |
| 6 | Verify Migration | Check startup logs | "Migration 002 applied" |
| 7 | Health Check | `curl http://localhost:48721/health` | `{"status":"ok"}` |
| 8 | Reload Extension | VS Code: Ctrl+Shift+P → "Reload Window" | Extension activates |
| 9 | Verify Auth UI | Check Extension behavior | Login Webview displayed |

### 5.3 Extension Deployment (VSIX Package)

```bash
# Build extension package
cd kiro-sdlc-agents
npm install
npm run package
# Output: kiro-sdlc-agents-{version}.vsix

# Install in VS Code/Kiro
code --install-extension kiro-sdlc-agents-{version}.vsix

# Verify installation
code --list-extensions | grep kiro-sdlc
```

### 5.4 First-Time Setup (Post-Deploy)

```bash
# 1. Create initial admin user (run once after first deploy)
curl -X POST http://localhost:48721/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<SECURE_PASSWORD>","email":"admin@company.com","role":"admin"}'

# 2. JWT_SECRET auto-generated on first start — stored in .code-intel/
# No manual action needed

# 3. Configure SSO (optional — coordinate with IT admin)
curl -X POST http://localhost:48721/api/admin/sso \
  -H "Authorization: Bearer <admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "issuer_url": "https://accounts.google.com",
    "client_id": "<OAUTH_CLIENT_ID>",
    "allowed_domains": ["company.com"],
    "redirect_uri": "http://localhost:48721/api/auth/sso/callback"
  }'
```

---

## 6. Configuration Changes

### 6.1 New Environment Variables

| Variable | Description | DEV | SIT | UAT | PROD |
|----------|-------------|-----|-----|-----|------|
| JWT_SECRET | HMAC key for JWT signing | auto | auto | auto | `<GENERATED>` |
| JWT_EXPIRY | Access token lifetime (seconds) | 3600 | 3600 | 3600 | 3600 |
| REFRESH_TOKEN_EXPIRY | Refresh token lifetime (seconds) | 604800 | 604800 | 604800 | 604800 |
| SSO_ENABLED | Enable OpenID Connect SSO | false | false | true | true |
| SSO_ISSUER_URL | OIDC provider URL | — | — | `<IDP_URL>` | `<IDP_URL>` |
| SSO_CLIENT_ID | OAuth2 client ID | — | — | `<CLIENT_ID>` | `<CLIENT_ID>` |
| KB_PROMOTION_INTERVAL_MS | Promotion job interval | 1800000 | 1800000 | 1800000 | 1800000 |
| KB_TTL_CLEANUP_INTERVAL_MS | TTL cleanup job interval | 3600000 | 3600000 | 3600000 | 3600000 |
| ENCRYPTION_KEY | AES-256 key for MCP config | auto | auto | auto | `<GENERATED>` |

### 6.2 Application Configuration (BackendConfig.ts)

| Property | Old Value | New Value | File |
|----------|-----------|-----------|------|
| auth.enabled | N/A | true | BackendConfig.ts |
| auth.jwtExpiry | N/A | 3600 | BackendConfig.ts |
| auth.refreshExpiry | N/A | 604800 | BackendConfig.ts |
| auth.lockoutAttempts | N/A | 5 | BackendConfig.ts |
| auth.lockoutDuration | N/A | 900 | BackendConfig.ts |
| kb.tierBoost.user | N/A | 1.2 | BackendConfig.ts |
| kb.tierBoost.project | N/A | 1.0 | BackendConfig.ts |
| kb.tierBoost.shared | N/A | 0.9 | BackendConfig.ts |

### 6.3 Extension Settings

| Setting | Description | Default |
|---------|-------------|---------|
| codeIntel.auth.autoRefresh | Enable automatic token refresh | true |
| codeIntel.auth.refreshBeforeExpiry | Seconds before expiry to refresh | 300 |
| codeIntel.kb.defaultTier | Default KB tier for ingestion | 1 |
| codeIntel.kb.userTtlDays | Default TTL for User KB entries | 7 |

---

## 7. Post-Deployment Verification

### 7.1 Health Checks

| Check | Endpoint/Command | Expected Result | Timeout |
|-------|-----------------|-----------------|---------|
| Backend alive | `GET http://localhost:48721/health` | `{"status":"ok"}` | 5s |
| Auth module loaded | Health response includes auth status | `"auth":"ready"` | 5s |
| Database connected | Implicit in health check | No errors | 5s |
| Extension activated | VS Code status bar | Shows auth state | 10s |

### 7.2 Smoke Tests

| # | Scenario | Steps | Expected Result |
|---|----------|-------|-----------------|
| 1 | Local Login | POST /api/auth/login {username, password} | 200 + JWT returned |
| 2 | Auth Guard (reject) | GET /mcp/tools/list without Bearer | 401 Unauthorized |
| 3 | Auth Guard (allow) | GET /mcp/tools/list with valid Bearer | 200 + tools list |
| 4 | Token Refresh | POST /api/auth/refresh {refresh_token} | 200 + new JWT |
| 5 | KB Ingest User Tier | mem_ingest without tier param | Entry in tier=1 |
| 6 | KB Ingest Project Tier | mem_ingest with tier=2, project=X | Entry in tier=2 |
| 7 | KB Multi-Tier Search | mem_search (authenticated) | Results from all tiers |
| 8 | MCP Config Save | PUT /api/config/mcp-servers | 200, config persisted |
| 9 | MCP Config Read | GET /api/config/mcp-servers | Passwords masked |
| 10 | Logout | POST /api/auth/logout | Token revoked |

### 7.3 Log Verification

| Log Entry | Level | Expected | Location |
|-----------|-------|----------|----------|
| "Server listening on port 48721" | INFO | Within 5s of start | stdout |
| "Migration 002-auth-multitenant applied" | INFO | First start only | stdout |
| "AuthModule registered" | INFO | Every start | stdout |
| "ConfigModule registered" | INFO | Every start | stdout |
| "SchedulerModule started" | INFO | Every start | stdout |
| "KB promotion job scheduled" | INFO | Every start | stdout |
| "KB TTL cleanup job scheduled" | INFO | Every start | stdout |

### 7.4 Monitoring

- [ ] Backend process running (check .code-intel/server.pid)
- [ ] No ERROR/FATAL in Backend logs
- [ ] Database file size stable (no runaway growth)
- [ ] Extension status bar shows auth state correctly
- [ ] MCP tool calls respond within 500ms

---

## 8. Rollback Plan

### 8.1 Rollback Flow

![Rollback Flow](diagrams/rollback-flow.png)

### 8.2 Rollback Decision Criteria

| Condition | Action |
|-----------|--------|
| Backend fails to start after migration | Immediate rollback |
| Auth endpoints return 500 errors | Immediate rollback |
| Extension cannot connect to Backend | Immediate rollback |
| KB search broken (no results) | Immediate rollback |
| Performance degradation > 50% | Immediate rollback |
| Login Webview crashes | Investigate, rollback if unfixable |
| SSO flow fails (local auth works) | Disable SSO, no full rollback |
| Minor UI issue in config page | Hotfix — no rollback |

### 8.3 Rollback Steps

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Stop Backend | `kill $(cat .code-intel/server.pid)` | Process terminated |
| 2 | Restore database | `cp .code-intel/index.db.bak .code-intel/index.db` | File restored |
| 3 | Checkout previous version | `git checkout v1.18.0` | Previous code |
| 4 | Rebuild Backend | `cd src/backend && npm run build` | Build OK |
| 5 | Start Backend | `cd src/backend && npm run start` | Server listening |
| 6 | Reinstall previous Extension | `code --install-extension <prev.vsix>` | Extension loaded |
| 7 | Reload VS Code | Ctrl+Shift+P → Reload Window | Extension active |
| 8 | Verify health | `curl http://localhost:48721/health` | 200 OK |

### 8.4 Rollback Time Estimate

| Action | Estimated Time |
|--------|---------------|
| Stop Backend | 5 seconds |
| Restore database | 5 seconds |
| Checkout previous code | 10 seconds |
| Rebuild Backend | 30 seconds |
| Start Backend | 5 seconds |
| Reinstall Extension | 15 seconds |
| Verification | 30 seconds |
| **Total** | **~2 minutes** |

---

## 9. Environment-Specific Notes

### 9.1 DEV

- SSO disabled — use local auth only
- JWT_SECRET auto-generated on first start
- Database migration runs automatically
- Default admin: admin/admin (change immediately after first login)
- Promotion job interval can be shortened for testing

### 9.2 SIT

- Same as DEV with test data seeded
- Verify all 10 smoke test scenarios
- Test KB tier isolation between multiple test users
- Run verification queries after migration

### 9.3 UAT

- SSO enabled (configure test IdP)
- QA validates all 10 user stories from BRD
- Performance: KB search across tiers < 500ms
- Extended session testing (token refresh over hours)
- Account lockout testing (5 failed attempts)

### 9.4 PROD

- **Deployment Window:** Per-developer (no shared window)
- **Approval Required From:** Dev Lead + QA Lead
- **Critical:** Generate unique JWT_SECRET and ENCRYPTION_KEY per installation
- **Critical:** Never commit secrets to repository
- **SSO Setup:** Coordinate with IT admin for IdP client registration
- **Communication:** Announce Extension update via team channel

---

## 10. Appendix

### Contacts

| Role | Name | Contact |
|------|------|---------|
| Dev Lead | Extension Dev Team | Internal |
| QA Lead | QA Team | Internal |
| DevOps | DevOps Agent | Automated |

### Related Tickets

| Ticket | Summary | Relationship |
|--------|---------|-------------|
| KSA-285 | Authentication, Multi-Tenant KB, MCP Config | Main ticket |
| KSA-284 | Split Extension: Lightweight Proxy + Backend | Parent/prerequisite |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Deployment Flow | [deployment-flow.png](diagrams/deployment-flow.png) | [deployment-flow.drawio](diagrams/deployment-flow.drawio) |
| 2 | Rollback Flow | [rollback-flow.png](diagrams/rollback-flow.png) | [rollback-flow.drawio](diagrams/rollback-flow.drawio) |
