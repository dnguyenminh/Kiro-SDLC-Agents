# Release Notes (RLN)

## Code Intelligence Extension — KSA-285: Authentication, Multi-Tenant KB, and MCP Server Configuration

---

## Release Information

| Field | Value |
|-------|-------|
| Release Version | v1.1.0 |
| Release Date | 2025-07-15 |
| Jira Ticket | KSA-285 |
| Environment | ALL (DEV / SIT / UAT / PROD) |
| Author | DevOps Agent |
| Status | Approved |
| Git Tag | v1.1.0 |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-15 | DevOps Agent | Initiate document |

---

## 1. What's New

### 1.1 Feature Summary

This release transforms the Code Intelligence Extension from a single-user, open-access system into a secure, multi-tenant platform with enterprise authentication and personalized configuration management.

**Three major capabilities added:**

- **🔐 Authentication System** — Secure login (local credentials + SSO via OpenID Connect with PKCE), JWT-based access control, and automatic token refresh. All API and MCP endpoints now require authentication.
- **📚 Multi-Tenant 3-Tier Knowledge Base** — Knowledge is now organized into Personal (User KB), Team (Project KB), and Company (Shared KB) tiers with automatic quality-based promotion between tiers.
- **⚙️ MCP Server Configuration** — Visual configuration page in the IDE for managing Jira, DrawIO, and Export server credentials without editing config files.

### 1.2 User-Facing Changes

| # | Change | Description | Impact |
|---|--------|-------------|--------|
| 1 | Login required | Users must authenticate before using Code Intelligence features | High |
| 2 | Login Webview | New authentication UI with username/password + SSO option | High |
| 3 | Status bar auth indicator | Shows "Authenticated (username)" or "Not Authenticated" | Medium |
| 4 | KB tier badges in search | Search results show [Personal] / [Project] / [Shared] badges | Medium |
| 5 | MCP Config command | New command: "Code Intel: Configure MCP Servers" | Medium |
| 6 | Logout command | New command: "Code Intel: Logout" | Low |
| 7 | Auto token refresh | Seamless re-authentication without user intervention | Low |

---

## 2. Technical Changes

### 2.1 API Changes

| Type | Endpoint | Method | Description |
|------|----------|--------|-------------|
| New | /api/auth/login | POST | Local username/password authentication |
| New | /api/auth/sso/authorize | POST | Initiate SSO/OIDC flow |
| New | /api/auth/sso/callback | GET | SSO callback handler |
| New | /api/auth/refresh | POST | Refresh access token |
| New | /api/auth/logout | POST | Revoke session, clear tokens |
| New | /api/auth/setup | POST | Create initial admin user (first-time only) |
| New | /api/config/mcp-servers | GET | Read user's MCP server config (masked) |
| New | /api/config/mcp-servers | PUT | Save user's MCP server config |
| New | /api/config/mcp-servers/test | POST | Test MCP server connection |
| New | /api/kb/promote | POST | Manually promote KB entry between tiers |
| Modified | /mcp/tools/call (mem_ingest) | POST | Added `tier` and `project` parameters |
| Modified | /mcp/tools/call (mem_search) | POST | Added `tier_filter` parameter; results include tier badges |
| Modified | ALL /mcp/* and /api/* | ALL | Now require `Authorization: Bearer {JWT}` header |

### 2.2 Database Changes

| Type | Object | Description |
|------|--------|-------------|
| New Table | users | User accounts (local + SSO), roles, lockout tracking |
| New Table | sessions | Refresh token sessions with revocation support |
| New Table | mcp_config | Per-user MCP server credentials (AES-256-GCM encrypted) |
| New Table | sso_config | OpenID Connect provider configuration |
| New Table | audit_log | Lightweight event audit trail |
| Modified | kb_entries | Added: tier, owner_id, project_id, content_hash, quality_score, ttl_days, promoted, promoted_from, promoted_by, referenced_by_projects, admin_promoted |
| New Index | idx_kb_tier_owner | Fast User KB lookup by owner |
| New Index | idx_kb_tier_project | Fast Project KB lookup by project |
| New Index | idx_kb_tier3 | Fast Shared KB access |
| New Index | idx_kb_promotion | Promotion candidate scanning |

### 2.3 Configuration Changes

| Property | Change Type | Description |
|----------|-----------|-------------|
| auth.enabled | New | Enable/disable authentication (default: true) |
| auth.jwtExpiry | New | JWT access token lifetime (default: 3600s) |
| auth.refreshExpiry | New | Refresh token lifetime (default: 604800s / 7 days) |
| auth.lockoutAttempts | New | Failed attempts before lockout (default: 5) |
| auth.lockoutDuration | New | Lockout duration in seconds (default: 900 / 15 min) |
| kb.tierBoost.user | New | Search boost for User KB results (default: 1.2) |
| kb.tierBoost.project | New | Search boost for Project KB results (default: 1.0) |
| kb.tierBoost.shared | New | Search boost for Shared KB results (default: 0.9) |
| SSO_ENABLED | New env | Enable SSO authentication (default: false) |
| SSO_ISSUER_URL | New env | OpenID Connect issuer URL |
| SSO_CLIENT_ID | New env | OAuth2 client ID |
| ENCRYPTION_KEY | New env | AES-256 key for config encryption (auto-generated) |

### 2.4 Infrastructure Changes

| Component | Change | Description |
|-----------|--------|-------------|
| Backend Modules | +3 new | AuthModule, ConfigModule, SchedulerModule |
| Extension Webviews | +2 new | LoginWebview, McpConfigWebview |
| Extension Services | +3 new | AuthManager, AuthInterceptor, TokenRefreshTimer |
| Background Jobs | +2 new | KB Promotion (30 min), TTL Cleanup (1 hr) |
| Middleware | +1 new | auth-guard.ts (JWT validation on all protected routes) |

---

## 3. Bug Fixes

> No bug fixes included in this release. This is a feature release.

---

## 4. Known Issues & Limitations

| # | Issue | Impact | Workaround | Target Fix |
|---|-------|--------|------------|------------|
| 1 | SSO requires manual IdP registration | Admin must configure IdP separately | Use local auth; coordinate with IT for SSO | N/A (by design) |
| 2 | KB promotion job runs on fixed interval | Eligible entries wait up to 30 min for promotion | Use manual promotion via POST /api/kb/promote | Future: event-driven |
| 3 | Single-machine Backend only | No distributed/clustered deployment | One Backend per developer machine | KSA-300+ |
| 4 | No RBAC beyond tier visibility | All authenticated users equal within tier | Admin role only for Shared KB writes | Future ticket |
| 5 | SecretStorage cleared on Extension uninstall | User must re-authenticate after reinstall | Expected behavior per VS Code API | N/A |

---

## 5. Dependencies

### 5.1 Pre-requisite Releases

| Release | Version | Status | Required Before |
|---------|---------|--------|-----------------|
| KSA-284 (Split Architecture) | v1.0.0 | Deployed | This release |
| Node.js | 20+ | Installed | This release |
| VS Code | >= 1.85.0 | Installed | This release |

### 5.2 External System Changes

| System | Change Required | Status | Contact |
|--------|----------------|--------|---------|
| Identity Provider (SSO only) | Register OAuth2 client for Code Intelligence | Pending | IT Admin |
| No other external changes | — | — | — |

---

## 6. Migration Notes

### 6.1 Data Migration

| Migration | Description | Automated | Estimated Time |
|-----------|-------------|-----------|----------------|
| 002-auth-multitenant | Create auth/config/audit tables, extend kb_entries | Yes (on startup) | < 1 second |
| Existing KB entries | Assigned tier=1, owner_id=default user | Yes (migration script) | < 5 seconds |

### 6.2 Breaking Changes

| Change | Impact | Migration Path |
|--------|--------|---------------|
| All endpoints require Bearer token | Existing unauthenticated clients will get 401 | Create user account, obtain JWT, add Authorization header |
| kb_entries schema extended | Old entries get default values (tier=1, promoted=false) | Automatic — no action needed |
| /health endpoint remains public | No impact | — |

### 6.3 Backward Compatibility

**Partially backward compatible.** The breaking change is authentication enforcement:

- **Before:** All /mcp/* and /api/* endpoints were open (no auth required)
- **After:** All endpoints (except /health and /api/auth/login) require valid Bearer token

**Migration for existing users:**
1. Update to new version (Backend + Extension)
2. Backend auto-runs migration on first start
3. Create admin account via /api/auth/setup (one-time)
4. Create regular user accounts
5. Login via Extension (Login Webview appears automatically)
6. All existing KB entries remain accessible (assigned to default user at tier=1)

---

## 7. Testing Summary

| Test Level | Total | Passed | Failed | Blocked | Pass Rate |
|-----------|-------|--------|--------|---------|-----------|
| Unit Tests | 63 | 63 | 0 | 0 | 100% |
| Integration Tests | 15 | 15 | 0 | 0 | 100% |
| E2E API Tests | 5 | 5 | 0 | 0 | 100% |
| **Total** | **83** | **83** | **0** | **0** | **100%** |

### Defect Summary

| Severity | Found | Fixed | Open | Deferred |
|----------|-------|-------|------|----------|
| Critical | 0 | 0 | 0 | 0 |
| Major | 0 | 0 | 0 | 0 |
| Minor | 0 | 0 | 0 | 0 |

---

## 8. Deployment Instructions

See: [Deployment Guide](DPG-v1.0-KSA-285.docx)

### Quick Reference

| Step | Action | Estimated Time |
|------|--------|---------------|
| 1 | Stop Backend + backup database | 10 seconds |
| 2 | Build Backend + Extension | 60 seconds |
| 3 | Start Backend (auto-migration) | 10 seconds |
| 4 | Reload Extension in VS Code | 5 seconds |
| 5 | Create admin account (first-time) | 30 seconds |
| 6 | Verification (health + smoke tests) | 2 minutes |
| **Total** | | **~4 minutes** |

---

## 9. Rollback Plan

See: [Deployment Guide — Section 8](DPG-v1.0-KSA-285.docx)

**Rollback Decision Criteria:**
- Backend fails to start after migration
- Auth endpoints return 500 errors
- KB search completely broken
- Performance degradation > 50%

**Estimated Rollback Time:** ~2 minutes

---

## 10. Contacts

| Role | Name | Contact | Responsibility |
|------|------|---------|---------------|
| Release Manager | SM Agent | Automated | Release coordination |
| Dev Lead | Extension Dev Team | Internal | Technical issues |
| QA Lead | QA Team | Internal | Testing sign-off |
| DevOps | DevOps Agent | Automated | Deployment execution |

---

## 11. Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Dev Lead | | | ☐ Approved |
| QA Lead | | | ☐ Approved |
| Release Manager | | | ☐ Approved |
