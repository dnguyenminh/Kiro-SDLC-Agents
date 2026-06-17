# User Guide

## Code Intelligence Extension — KSA-285: Authentication, Multi-Tenant KB, and MCP Server Configuration

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-285 |
| Title | Authentication, Multi-Tenant KB, and MCP Server Configuration |
| Author | DEV Agent |
| Version | 1.0 |
| Date | 2025-07-15 |
| Status | Draft |

---

## Table of Contents

1. [Installation / Quick Start](#1-installation--quick-start)
2. [Configuration Reference](#2-configuration-reference)
3. [Authentication Usage](#3-authentication-usage)
4. [Multi-Tenant KB Usage](#4-multi-tenant-kb-usage)
5. [MCP Server Configuration](#5-mcp-server-configuration)
6. [Administration](#6-administration)
7. [Troubleshooting](#7-troubleshooting)
8. [Error Codes Reference](#8-error-codes-reference)
9. [API Reference](#9-api-reference)

---

## 1. Installation / Quick Start

### 1.1 Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| VS Code | >= 1.85.0 | SecretStorage API required |
| Node.js | >= 20.0.0 | Backend server runtime |
| OS | Windows / macOS / Linux | Localhost-only binding |

### 1.2 Install the Extension

1. Open VS Code
2. Go to **Extensions** panel (Ctrl+Shift+X)
3. Search for **"Code Intelligence"**
4. Click **Install**

Or install from VSIX:

```bash
code --install-extension code-intelligence-*.vsix
```

### 1.3 Start the Backend Server

The Backend server runs on localhost and handles all auth, KB, and MCP operations.

```bash
# From project root
cd src/backend
npm install
npm run build
npm start
```

Expected output:

```
[INFO] Backend server starting...
[INFO] Database migrations applied (version 2: auth-multitenant-kb)
[INFO] JWT secret loaded from .code-intel/jwt-secret.key
[INFO] Modules registered: auth, memory, config, scheduler
[INFO] Server listening on http://127.0.0.1:48721
[INFO] Health check: http://127.0.0.1:48721/health
```

### 1.4 First-Time Setup

On first start, the Backend automatically:

1. Runs database migration (creates `users`, `sessions`, `kb_entries`, `mcp_config`, `sso_config` tables)
2. Generates JWT secret and saves to `.code-intel/jwt-secret.key`
3. Generates encryption key and saves to `.code-intel/encryption.key`
4. Creates a default admin user (username: `admin`, password: `ChangeMe123!`)

> **Security:** Change the default admin password immediately after first login.

### 1.5 Quick Verification

```bash
# Check Backend health
curl http://127.0.0.1:48721/health
```

Expected response:

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "modules": {
    "auth": "ready",
    "memory": "ready",
    "config": "ready",
    "scheduler": "ready"
  },
  "database": {
    "status": "connected",
    "wal_mode": true
  }
}
```

### 1.6 Login Flow

1. Activate the Extension in VS Code (automatic on startup)
2. If no stored token, the **Login Webview** appears
3. Enter username + password, click **Login**
4. Status bar shows: **"Authenticated (username)"**
5. All MCP tools and KB operations are now available

---

## 2. Configuration Reference

### 2.1 Environment Variables

All configuration is via environment variables. Set them before starting the Backend.

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `BACKEND_PORT` | number | `48721` | HTTP server port |
| `BACKEND_HOST` | string | `127.0.0.1` | Bind address (keep localhost for security) |
| `DB_PATH` | string | `.code-intel/index.db` | SQLite database file path |
| `MODELS_PATH` | string | `.code-intel/models` | ONNX embedding model directory |
| `ORCHESTRATION_CONFIG` | string | `.code-intel/orchestration.json` | MCP orchestration config |
| `LOG_LEVEL` | enum | `info` | Logging level: `debug`, `info`, `warn`, `error` |
| `JWT_SECRET` | string | *(auto-generated)* | HS256 signing key (64+ chars recommended) |
| `JWT_EXPIRY` | number | `3600` | Access token lifetime in seconds (1 hour) |
| `REFRESH_EXPIRY_DAYS` | number | `7` | Refresh token lifetime in days |
| `ENCRYPTION_KEY` | string | *(auto-generated)* | AES-256 key for encrypting MCP config secrets |
| `SSO_ENABLED` | boolean | `false` | Enable OpenID Connect SSO |
| `SSO_ISSUER_URL` | string | — | OIDC provider URL (e.g., `https://accounts.google.com`) |
| `SSO_CLIENT_ID` | string | — | OAuth2 client ID from your IdP |
| `SSO_ALLOWED_DOMAINS` | string | `[]` | Comma-separated email domains allowed for SSO |

### 2.2 Example: Minimal Configuration

```bash
# .env file (minimal - uses defaults)
BACKEND_PORT=48721
LOG_LEVEL=info
```

### 2.3 Example: Production Configuration

```bash
# .env file (production)
BACKEND_PORT=48721
BACKEND_HOST=127.0.0.1
DB_PATH=.code-intel/index.db
LOG_LEVEL=warn
JWT_SECRET=your-64-char-random-secret-change-this-in-production-please-now
JWT_EXPIRY=3600
REFRESH_EXPIRY_DAYS=7
ENCRYPTION_KEY=your-32-char-encryption-key-here!

# SSO Configuration (optional)
SSO_ENABLED=true
SSO_ISSUER_URL=https://accounts.google.com
SSO_CLIENT_ID=123456789.apps.googleusercontent.com
SSO_ALLOWED_DOMAINS=company.com,subsidiary.com
```

### 2.4 Auto-Generated Secrets

If `JWT_SECRET` or `ENCRYPTION_KEY` are not set, the Backend generates them on first start:

| File | Content | Permissions |
|------|---------|-------------|
| `.code-intel/jwt-secret.key` | 128-char hex string (64 bytes) | Owner-only (600) |
| `.code-intel/encryption.key` | 64-char hex string (32 bytes) | Owner-only (600) |

> **Do NOT delete these files** — all existing tokens and encrypted configs will become invalid.

### 2.5 Scheduler Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| Promotion interval | 30 minutes | How often KB auto-promotion job runs |
| TTL cleanup interval | 1 hour | How often expired User KB entries are deleted |
| Lockout attempts | 5 | Failed logins before account lock |
| Lockout duration | 15 minutes | How long account stays locked |

---

## 3. Authentication Usage

### 3.1 Local Login (Username/Password)

**From VS Code:**

1. Extension activates and checks for stored JWT
2. If no valid token, Login Webview opens automatically
3. Enter credentials:
   - **Username:** alphanumeric, dots, underscores (max 100 chars)
   - **Password:** min 8 chars, max 128 chars
4. Click **Login**
5. On success, status bar shows "Authenticated (username)"

**Login Webview fields:**

| Field | Validation | Example |
|-------|-----------|---------|
| Username | `^[a-zA-Z0-9._]+$`, 1-100 chars | `john.doe` |
| Password | 8-128 chars | `securePass123` |

### 3.2 SSO Login (OpenID Connect + PKCE)

**Prerequisites:** SSO must be configured in Backend (see Section 2.3).

1. On the Login Webview, click **"Login with SSO"**
2. System browser opens your IdP login page
3. Authenticate with your corporate credentials
4. Browser redirects to Backend callback
5. Backend issues JWT, Extension stores token, Login Webview closes
6. Status bar shows "Authenticated (username)"

**SSO Flow (technical):**

```
Extension  -> generates PKCE code_verifier + code_challenge
Extension  -> POST /api/auth/sso/authorize {code_challenge, redirect_uri}
Backend    -> returns authorization_url + state
Extension  -> opens browser with authorization_url
User       -> authenticates with IdP
IdP        -> redirects to http://localhost:48721/api/auth/sso/callback?code=...&state=...
Backend    -> exchanges code for IdP tokens, validates, issues own JWT
Extension  -> polls for token, stores in SecretStorage
```

> **Note:** New SSO users are automatically provisioned from IdP claims (email, display name). No manual registration needed.

### 3.3 Token Auto-Refresh

Tokens refresh automatically — no user action needed.

| Token | Lifetime | Behavior |
|-------|----------|----------|
| Access Token (JWT) | 1 hour | Auto-refreshes 5 minutes before expiry |
| Refresh Token | 7 days | Used to obtain new access token |

**What happens when refresh fails:**

- Refresh token expired (7+ days inactive): Login Webview appears, re-authenticate
- Backend unreachable: retry once after 30s, if still fails show Login Webview

### 3.4 Token Storage

Tokens are stored in **VS Code SecretStorage** (OS-level encryption):

- Windows: Windows Credential Manager
- macOS: Keychain
- Linux: libsecret / GNOME Keyring

Tokens survive IDE restarts and are automatically used on next activation.

### 3.5 Logout

**Option 1:** Command Palette (Ctrl+Shift+P) -> `Code Intel: Logout`

**Option 2:** Click status bar auth indicator -> Logout

**What happens:**

1. Backend revokes refresh token (server-side)
2. Extension clears JWT + refresh token from SecretStorage
3. Extension clears cached data
4. Extension stops auto-refresh timer
5. Login Webview appears
6. Status bar shows "Not Authenticated"

> If Backend is unreachable during logout, tokens are still cleared locally. Server-side token expires naturally (1h).

### 3.6 Account Lockout

After **5 consecutive failed login attempts**, the account is locked for **15 minutes**.

- Error message: `"Account locked. Try again in {X} minutes."`
- Lockout resets automatically after the cooldown period
- Successful login resets the failed attempt counter

---

## 4. Multi-Tenant KB Usage

### 4.1 Overview: 3-Tier Architecture

| Tier | Name | Visibility | Lifetime | Who Can Write |
|------|------|-----------|----------|---------------|
| **Tier 1** | User KB (Personal) | Only you | TTL-based (default 7 days) | You |
| **Tier 2** | Project KB | All project members | Permanent | Any project member |
| **Tier 3** | Shared KB | All authenticated users | Permanent | Admin only |

### 4.2 Ingesting Knowledge

#### Tier 1 — Personal (default)

```json
{
  "name": "mem_ingest",
  "arguments": {
    "title": "My API pattern notes",
    "content": "JWT-based auth with refresh tokens...",
    "tags": "notes,wip"
  }
}
```

- No `tier` specified defaults to Tier 1 (personal)
- Only you can see this entry
- Auto-deleted after TTL (default 7 days)

#### Tier 2 — Project

```json
{
  "name": "mem_ingest",
  "arguments": {
    "title": "Architecture Decision: Event Sourcing",
    "content": "We chose event sourcing for the order service...",
    "tags": "architecture,decision,project-relevant",
    "tier": 2,
    "project": "proj-frontend"
  }
}
```

- Requires `tier: 2` + `project` ID
- You must be a member of the specified project
- Visible to all project members
- Permanent (no auto-delete)

#### Tier 3 — Shared (Admin only)

```json
{
  "name": "mem_ingest",
  "arguments": {
    "title": "Best Practice: Parameterized Queries",
    "content": "Always use parameterized queries to prevent SQL injection...",
    "tags": "best-practice,security",
    "tier": 3
  }
}
```

- Requires admin role
- Visible to all authenticated users
- Permanent

### 4.3 Searching Knowledge

```json
{
  "name": "mem_search",
  "arguments": {
    "query": "authentication pattern",
    "limit": 10
  }
}
```

**Search behavior:**

1. Queries all accessible tiers simultaneously
2. Computes semantic similarity (cosine distance)
3. Applies tier boost: User x1.2, Project x1.0, Shared x0.9
4. Deduplicates (same content in multiple tiers shows highest tier)
5. Returns results with tier badges

**Example output:**

```
Found 5 results across 3 tiers:

[Personal] API Auth Pattern (score: 0.92)
  JWT-based auth with refresh tokens...

[Project: frontend] JWT Refresh Flow (score: 0.87)
  Token refresh implementation using interceptor pattern...

[Shared] OAuth2 Best Practices (score: 0.81)
  Always use PKCE for public clients...
```

**Filtering by tier:**

```json
{
  "name": "mem_search",
  "arguments": {
    "query": "design patterns",
    "tier_filter": [2, 3]
  }
}
```

### 4.4 Auto-Promotion Rules

Knowledge automatically promotes between tiers based on quality and usage:

#### User -> Project (ALL criteria must be met)

| Criteria | Threshold |
|----------|-----------|
| Quality score | > 0.8 |
| Tag | Contains "project-relevant" |
| Peer review | At least 1 team member reviewed |

#### Project -> Shared (ANY one criterion)

| Criteria | Threshold |
|----------|-----------|
| Cross-project references | >= 3 different projects |
| Tag | Contains "best-practice" |
| Admin promotion | Admin explicitly promoted |

**How it works:**

- Background job runs every **30 minutes**
- Evaluates all unpromoted entries against criteria
- Promotion is **non-destructive** — original stays (marked `promoted=true`), copy goes to target tier
- Promotion history is tracked (who, when, why)

### 4.5 Manual Promotion

Admins (or entry owners for Tier 1 to 2) can manually promote:

```bash
curl -X POST http://127.0.0.1:48721/api/kb/promote \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entry_id": "550e8400-e29b-41d4-a716-446655440000",
    "target_tier": 2,
    "project_id": "proj-frontend"
  }'
```

### 4.6 TTL and Cleanup

| Tier | Default TTL | Can Override | Cleanup Frequency |
|------|-------------|-------------|-------------------|
| Tier 1 (User) | 7 days | Yes (set `ttl_days`) | Every 1 hour |
| Tier 2 (Project) | No expiry | N/A | Never |
| Tier 3 (Shared) | No expiry | N/A | Never |

Set custom TTL on ingest:

```json
{
  "name": "mem_ingest",
  "arguments": {
    "content": "Temporary debugging notes...",
    "tags": "debug",
    "ttl_days": 1
  }
}
```

Set `ttl_days: 0` for no auto-delete (entry persists until manual delete).

### 4.7 Capacity Limits

| Tier | Max Entries | Scope |
|------|------------|-------|
| Tier 1 (User) | 10,000 | Per user |
| Tier 2 (Project) | 100,000 | Per project |
| Tier 3 (Shared) | 50,000 | Global |

If capacity is reached, you receive error: `"User KB full. Delete old entries or promote to Project KB."`

---

## 5. MCP Server Configuration

### 5.1 Opening the Configuration Page

**Command Palette** (Ctrl+Shift+P) -> `Code Intel: Configure MCP Servers`

This opens a Webview with tabs for each MCP server:

- **Jira** — Issue tracker integration
- **DrawIO** — Diagram generation
- **Export** — Document export (Markdown to DOCX)

### 5.2 Configuring Jira

| Field | Required | Format | Example |
|-------|----------|--------|---------|
| URL | Yes | HTTPS URL | `https://company.atlassian.net` |
| Username | Yes | Email | `john.doe@company.com` |
| API Token | Yes | min 10 chars | `ATATT3xFfGF0...` |
| Project Key | No | Uppercase letters | `KSA` |

**Getting a Jira API Token:**

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **Create API token**
3. Copy the token and paste into the Token field

### 5.3 Configuring DrawIO

| Field | Required | Format | Example |
|-------|----------|--------|---------|
| CLI Path | No | File path | `C:\Program Files\draw.io\draw.io.exe` |
| Format | No | png/svg/pdf | `png` |

### 5.4 Configuring Export

| Field | Required | Format | Example |
|-------|----------|--------|---------|
| Output Directory | No | Relative path | `./documents` |

### 5.5 Test Connection

Click **"Test Connection"** next to any server to verify credentials:

- Success: `"Connected to Jira (version 9.x). User: john.doe@company.com"`
- Failure: `"Connection failed: 401 Unauthorized. Check API token."`

### 5.6 Security

- Passwords/tokens are **never shown** after save (displayed as `********`)
- Sensitive fields encrypted with **AES-256-GCM** at rest in the database
- `GET /api/config/mcp-servers` returns `"token_configured": true/false` — never plaintext
- Configuration is **per-user** — your credentials are isolated from other users

### 5.7 Save and Apply

1. Modify fields
2. Click **Save**
3. Next MCP tool call (Jira, DrawIO, Export) uses the new credentials immediately
4. No server restart needed

---

## 6. Administration

### 6.1 User Management

#### Create a User

```bash
# Direct database insert (admin bootstrap)
sqlite3 .code-intel/index.db "INSERT INTO users (id, username, email, display_name, password_hash, role, projects) VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-a' || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))), 'new.user', 'new.user@company.com', 'New User', NULL, 'user', '[\"proj-frontend\"]');"
```

> **Recommended:** Use SSO auto-provisioning instead of manual user creation.

#### Assign Projects to a User

```bash
sqlite3 .code-intel/index.db \
  "UPDATE users SET projects = '[\"proj-frontend\",\"proj-backend\"]' WHERE username = 'john.doe';"
```

#### Promote User to Admin

```bash
sqlite3 .code-intel/index.db \
  "UPDATE users SET role = 'admin' WHERE username = 'john.doe';"
```

#### Unlock a Locked Account

```bash
sqlite3 .code-intel/index.db \
  "UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE username = 'john.doe';"
```

### 6.2 SSO Setup

1. Register your application with your IdP (Google, Azure AD, Okta, Keycloak)
2. Set redirect URI to: `http://localhost:48721/api/auth/sso/callback`
3. Get the **Client ID** and **Issuer URL**
4. Configure environment variables:

```bash
SSO_ENABLED=true
SSO_ISSUER_URL=https://accounts.google.com
SSO_CLIENT_ID=123456789.apps.googleusercontent.com
SSO_ALLOWED_DOMAINS=company.com
```

5. Insert SSO config into database:

```bash
sqlite3 .code-intel/index.db "INSERT INTO sso_config (id, issuer_url, client_id, allowed_domains, redirect_uri, enabled) VALUES (lower(hex(randomblob(16))), 'https://accounts.google.com', '123456789.apps.googleusercontent.com', '[\"company.com\"]', 'http://localhost:48721/api/auth/sso/callback', 1);"
```

6. Restart Backend
7. Users see "Login with SSO" button on Login Webview

### 6.3 Background Jobs

| Job | Interval | Purpose | Impact |
|-----|----------|---------|--------|
| KB Promotion | Every 30 min | Auto-promote entries between tiers | Minimal (< 5s) |
| TTL Cleanup | Every 1 hour | Delete expired User KB entries | Minimal (< 2s) |

Jobs start automatically with the Backend. Monitor via logs:

```bash
# Check promotion activity
grep "promotion" backend.log | tail -20

# Check cleanup activity
grep "ttl_cleanup" backend.log | tail -20
```

### 6.4 Database Maintenance

```bash
# Check database size
ls -la .code-intel/index.db

# Run VACUUM to reclaim space (stop server first)
sqlite3 .code-intel/index.db "VACUUM;"

# Check table sizes
sqlite3 .code-intel/index.db "SELECT 'users', COUNT(*) FROM users UNION ALL SELECT 'kb_entries', COUNT(*) FROM kb_entries UNION ALL SELECT 'sessions', COUNT(*) FROM sessions;"
```

### 6.5 Rotating Secrets

**JWT Secret rotation:**

1. Stop Backend
2. Delete `.code-intel/jwt-secret.key`
3. Start Backend (new secret auto-generated)
4. All existing tokens become invalid — users must re-login

**Encryption Key rotation:**

> **Destructive** — all stored MCP config secrets become unreadable.

1. Stop Backend
2. Delete `.code-intel/encryption.key`
3. Start Backend (new key auto-generated)
4. Users must re-enter MCP server credentials

---

## 7. Troubleshooting

### 7.1 Common Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| Login Webview keeps appearing | Backend not running | Start Backend: `npm start` in `src/backend/` |
| "Cannot connect to Backend" | Wrong port or Backend crashed | Check `BACKEND_PORT=48721`, restart Backend |
| "Invalid username or password" | Wrong credentials | Verify username/password. Check if account locked. |
| "Account locked" | 5+ failed attempts | Wait 15 minutes, or admin unlocks account |
| "Token expired or invalid" | JWT expired and refresh failed | Click Login again. Check Backend is running. |
| SSO button not showing | SSO not configured | Set `SSO_ENABLED=true` + IdP config |
| SSO login times out | IdP unreachable or callback failure | Check `SSO_ISSUER_URL`, verify network access |
| KB search returns no results | No entries ingested or wrong tier filter | Ingest data first; check tier_filter parameter |
| "User KB full" | 10,000 entries reached | Delete old entries or promote to Project KB |
| MCP config "Save" fails | Backend unreachable | Restart Backend, check logs |
| "Connection failed" (Jira test) | Wrong URL, username, or token | Regenerate Jira API token, verify URL |
| Status bar shows "Not Authenticated" | Token expired, could not refresh | Click Login Webview, re-authenticate |

### 7.2 Checking Backend Logs

```bash
# Live tail logs
tail -f backend.log

# Filter by error level
grep "\[ERROR\]" backend.log

# Filter by module
grep "AuthService" backend.log
grep "MemoryService" backend.log
grep "ConfigService" backend.log
```

### 7.3 Database Diagnostics

```bash
# Check if database is locked
sqlite3 .code-intel/index.db "PRAGMA journal_mode;"
# Should return: wal

# Check active (non-revoked) sessions
sqlite3 .code-intel/index.db "SELECT COUNT(*) FROM sessions WHERE revoked = 0 AND expires_at > datetime('now');"

# Check user's KB entry count
sqlite3 .code-intel/index.db "SELECT tier, COUNT(*) FROM kb_entries WHERE owner_id = 'USER_ID' GROUP BY tier;"
```

### 7.4 Extension Diagnostics

1. **Output Panel** -> select "Code Intelligence" channel
2. Check for connection errors, auth state transitions
3. **Developer Tools** (Ctrl+Shift+I) -> Console tab for Webview errors

### 7.5 Reset Authentication State

If auth gets stuck:

```
# VS Code Command Palette
> Code Intel: Logout
```

If that fails (SecretStorage issue):

```
# Clear VS Code extension global state
> Developer: Reset Extension Global State
```

---

## 8. Error Codes Reference

### 8.1 Authentication Errors (AUTH_*)

| Code | HTTP | Message | Recovery |
|------|------|---------|----------|
| `AUTH_INVALID_CREDENTIALS` | 401 | Invalid username or password. | Re-enter correct credentials |
| `AUTH_ACCOUNT_LOCKED` | 403 | Account locked. Try again in {X} minutes. | Wait for lockout to expire |
| `AUTH_REQUIRED` | 401 | Authentication required. | Include `Authorization: Bearer` header |
| `AUTH_TOKEN_INVALID` | 401 | Invalid or expired token. | Refresh token or re-login |
| `AUTH_REFRESH_INVALID` | 401 | Refresh token expired or revoked. Please log in again. | Re-login required |
| `AUTH_SSO_TIMEOUT` | 408 | SSO login timed out. Please try again. | Retry SSO flow |
| `AUTH_SSO_DOMAIN_REJECTED` | 403 | Your organization is not configured for SSO access. | Contact admin to add domain |
| `AUTH_SSO_PROVIDER_ERROR` | 502 | SSO provider unavailable. | Try local login or contact admin |
| `AUTH_FORBIDDEN` | 403 | Admin access required. | Request admin role from admin |

### 8.2 Knowledge Base Errors (KB_*)

| Code | HTTP | Message | Recovery |
|------|------|---------|----------|
| `KB_CONTENT_TOO_SHORT` | 422 | Content too short for meaningful knowledge entry. | Provide content with 10+ characters |
| `KB_CAPACITY_EXCEEDED` | 507 | User KB full. Delete old entries or promote to Project KB. | Delete entries or promote |
| `KB_ACCESS_DENIED` | 403 | Access denied to this KB tier. | Use appropriate tier for your role |
| `KB_PROJECT_NOT_MEMBER` | 403 | You are not a member of project {projectId}. | Join project or use correct project ID |
| `PROMOTION_FAILED` | 400 | Promotion failed: {reason}. | Check promotion prerequisites |
| `NOT_FOUND` | 404 | Entry not found. | Verify entry ID exists |

### 8.3 Configuration Errors (CONFIG_*)

| Code | HTTP | Message | Recovery |
|------|------|---------|----------|
| `CONFIG_INVALID_URL` | 422 | Please enter a valid URL (https://...). | Fix URL format |
| `CONFIG_TEST_FAILED` | 200* | Connection failed: {error}. Check URL and credentials. | Verify server URL and credentials |
| `CONFIG_SAVE_FAILED` | 500 | Could not save configuration. Backend unavailable. | Retry, check Backend |
| `VALIDATION_ERROR` | 400 | Invalid input / Invalid configuration. | Check request format against API spec |

> *Note: Test connection returns HTTP 200 with `status: "failed"` in body (not HTTP error).

### 8.4 System Errors

| Code | HTTP | Message | Recovery |
|------|------|---------|----------|
| `BACKEND_UNAVAILABLE` | 503 | Cannot connect to Backend. | Start Backend server |
| `INTERNAL_ERROR` | 500 | An unexpected error occurred. | Check Backend logs, restart |

---

## 9. API Reference

### 9.1 Authentication Endpoints

#### POST /api/auth/login

Login with username/password. **Public endpoint** (no Bearer token required).

```bash
curl -X POST http://127.0.0.1:48721/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "john.doe", "password": "securePassword123"}'
```

**Response (200):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "rt_a1b2c3d4e5f6...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "john.doe",
    "email": "john.doe@company.com",
    "display_name": "John Doe",
    "role": "user",
    "projects": ["proj-frontend", "proj-backend"]
  }
}
```

---

#### POST /api/auth/sso/authorize

Initiate SSO flow. **Public endpoint.**

```bash
curl -X POST http://127.0.0.1:48721/api/auth/sso/authorize \
  -H "Content-Type: application/json" \
  -d '{
    "code_challenge": "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    "redirect_uri": "http://localhost:48721/api/auth/sso/callback"
  }'
```

**Response (200):**

```json
{
  "authorization_url": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "state": "xyz123"
}
```

---

#### POST /api/auth/refresh

Refresh access token. **Public endpoint.**

```bash
curl -X POST http://127.0.0.1:48721/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "rt_a1b2c3d4e5f6..."}'
```

**Response (200):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...(new)",
  "refresh_token": "rt_newtoken...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

---

#### POST /api/auth/logout

Revoke refresh token. **Requires Bearer token.**

```bash
curl -X POST http://127.0.0.1:48721/api/auth/logout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "rt_a1b2c3d4e5f6..."}'
```

**Response (200):**

```json
{"message": "Logged out successfully"}
```

---

### 9.2 Knowledge Base Endpoints

#### POST /mcp/tools/call — mem_ingest

```bash
curl -X POST http://127.0.0.1:48721/mcp/tools/call \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "mem_ingest",
    "arguments": {
      "title": "API Pattern",
      "content": "JWT-based auth with refresh tokens...",
      "tags": "pattern,project-relevant",
      "tier": 1
    }
  }'
```

---

#### POST /mcp/tools/call — mem_search

```bash
curl -X POST http://127.0.0.1:48721/mcp/tools/call \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "mem_search",
    "arguments": {
      "query": "authentication pattern",
      "limit": 10,
      "tier_filter": [1, 2, 3]
    }
  }'
```

---

#### POST /api/kb/promote

Manual promotion. **Requires Bearer token.** Admin required for target Tier 3.

```bash
curl -X POST http://127.0.0.1:48721/api/kb/promote \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entry_id": "550e8400-e29b-41d4-a716-446655440000",
    "target_tier": 2,
    "project_id": "proj-frontend"
  }'
```

**Response (200):**

```json
{
  "promoted_entry_id": "new-uuid-in-target-tier",
  "source_entry_id": "550e8400-...",
  "from_tier": 1,
  "to_tier": 2,
  "promoted_at": "2025-07-14T10:00:00Z"
}
```

---

### 9.3 Configuration Endpoints

#### GET /api/config/mcp-servers

Get current user's MCP server config. **Requires Bearer token.**

```bash
curl http://127.0.0.1:48721/api/config/mcp-servers \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200):**

```json
{
  "servers": {
    "jira": {
      "url": "https://company.atlassian.net",
      "username": "john.doe@company.com",
      "token_configured": true,
      "project_key": "KSA"
    },
    "drawio": {
      "path": "C:\\Program Files\\draw.io\\draw.io.exe",
      "format": "png"
    },
    "export": {
      "output_dir": "./documents"
    }
  },
  "last_updated": "2025-07-14T09:00:00Z"
}
```

> **Note:** Sensitive fields return `*_configured: true/false` — never plaintext values.

---

#### PUT /api/config/mcp-servers

Save MCP server config. **Requires Bearer token.**

```bash
curl -X PUT http://127.0.0.1:48721/api/config/mcp-servers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jira": {
      "url": "https://company.atlassian.net",
      "username": "john.doe@company.com",
      "token": "ATATT3xFfGF0...",
      "project_key": "KSA"
    },
    "drawio": {"path": "C:\\Program Files\\draw.io\\draw.io.exe", "format": "png"},
    "export": {"output_dir": "./documents"}
  }'
```

**Response (200):**

```json
{"message": "Configuration saved", "updated_at": "2025-07-14T10:00:00Z"}
```

---

#### POST /api/config/mcp-servers/test

Test connection to an MCP server. **Requires Bearer token.**

```bash
curl -X POST http://127.0.0.1:48721/api/config/mcp-servers/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"server": "jira"}'
```

**Response (200 - success):**

```json
{"server": "jira", "status": "success", "message": "Connected to Jira (version 9.x). User: john.doe@company.com"}
```

**Response (200 - failure):**

```json
{"server": "jira", "status": "failed", "message": "Connection failed: 401 Unauthorized. Check API token."}
```

---

### 9.4 Health Check

#### GET /health

**Public endpoint** (no auth required).

```bash
curl http://127.0.0.1:48721/health
```

**Response (200):**

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "modules": {"auth": "ready", "memory": "ready", "config": "ready", "scheduler": "ready"},
  "database": {"status": "connected", "wal_mode": true, "users_count": 5, "kb_entries_count": 12500, "active_sessions": 3},
  "uptime_seconds": 3600
}
```

---

## 10. FAQ

**Q: Can I use the Extension without authentication?**
A: No. All `/mcp/*` and `/api/*` endpoints require a valid Bearer token. The Extension will show the Login Webview until you authenticate.

**Q: What happens if the Backend goes down while I'm working?**
A: The Extension remains active (IDE not blocked). MCP tools become unavailable until Backend returns. Your existing JWT remains valid — no re-login needed once Backend is back.

**Q: Can another user see my User KB entries?**
A: Never. User KB (Tier 1) entries are strictly isolated by `owner_id`. Even admins cannot see individual user's personal KB entries.

**Q: How do I share knowledge with my team?**
A: Either ingest directly to Project KB (`tier: 2, project: "your-project"`) or let auto-promotion handle it (tag entries "project-relevant" and get a peer review).

**Q: Can I change the JWT expiry time?**
A: Yes. Set `JWT_EXPIRY=7200` (seconds) as environment variable before starting Backend. Default is 3600 (1 hour).

**Q: What happens when I rotate the JWT secret?**
A: All existing tokens become invalid immediately. All users must re-login. Refresh tokens also stop working.

**Q: How do I add a user to a project?**
A: Update the user's `projects` JSON array in the database: `UPDATE users SET projects = '["proj-a","proj-b"]' WHERE username = 'user';`

**Q: Is data transmitted over the network?**
A: No. The Backend binds to `127.0.0.1` (localhost only). All communication stays on the loopback interface — no external network exposure.

---

*End of User Guide — KSA-285 v1.0*
