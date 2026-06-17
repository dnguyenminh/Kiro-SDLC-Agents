# Technical Design Document (TDD)

## Code Intelligence Extension — KSA-285: Authentication, Multi-Tenant KB, and MCP Server Configuration

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-285 |
| Title | Authentication, Multi-Tenant KB, and MCP Server Configuration |
| Author | SA Agent |
| Version | 2.0 |
| Date | 2025-07-15 |
| Status | Final |
| Architecture Pattern | Plugin (IDE Extension) |
| Related BRD | BRD-v1-KSA-285.docx |
| Related FSD | FSD-v1.1-KSA-285.docx |
| Parent TDD | TDD-v1.1-KSA-284.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 2.0 | 2025-07-15 | SA Agent | Re-generated TDD aligned with actual implemented codebase (post-implementation verification) |
| 1.0 | 2025-07-14 | SA Agent | Initial TDD from BRD and FSD |

---

## 1. Introduction

### 1.1 Purpose

This TDD specifies the technical design for adding Authentication, Multi-Tenant Knowledge Base, and MCP Server Configuration to the Code Intelligence Extension split architecture (KSA-284). It documents the implemented architecture as verified against the actual codebase.

### 1.2 Scope

| Component | Coverage |
|-----------|----------|
| Backend Auth Module | AuthService, TokenService, PasswordService, SsoService, UserRepository, SessionRepository |
| Backend KB Module | KbRepository, PromotionService, TierAccessControl (multi-tier extensions to existing MemoryModule) |
| Backend Config Module | ConfigService, ConfigRepository, EncryptionService |
| Backend Scheduler Module | SchedulerModule (promotion job 30min, TTL cleanup 1h) |
| Extension Auth | AuthManager, LoginWebview, McpConfigWebview, AuthInterceptor, TokenRefreshTimer |
| Database | Migration 002: users, sessions, kb_entries, mcp_config, sso_config, audit_log tables |
| APIs | 12 new endpoints under /api/auth/*, /api/config/*, /api/kb/*, auth guard on /mcp/* |

### 1.3 Technology Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Language | TypeScript | ^5.5.0 | Match existing codebase (KSA-284) |
| Runtime | Node.js | >= 18.0 | LTS, native crypto (scrypt, AES), performance |
| Backend HTTP | Hono | ^4.0 | Already used in KSA-284 |
| JWT Library | jose | ^5.6.0 | Pure JS, no native deps, HS256 support |
| Database | better-sqlite3 | ^12.10.0 | Already used in KSA-284 |
| Schema Validation | zod | ^3.23 | Already used in KSA-284 |
| Password Hashing | Node.js crypto (scrypt) | Built-in | Zero dependencies, BR-5 compliant |
| Encryption | Node.js crypto (AES-256-GCM) | Built-in | Zero dependencies, BR-16 compliant |
| SSO | openid-client (future) | — | OIDC discovery + PKCE (currently manual) |
| Extension Host | VS Code Extension API | >= 1.85.0 | SecretStorage API required |
| Build | esbuild | ^0.21 | Match existing (KSA-284) |
| Test | Vitest | ^4.1.8 | Match existing (KSA-284) |
| Logging | pino | ^9.2 | Already in codebase |

### 1.4 Design Principles

1. **Extend, don't rewrite** — Build on KSA-284 architecture (Hono server, module registry pattern)
2. **Zero new native dependencies** — Use Node.js built-in crypto for scrypt + AES-256-GCM
3. **jose over jsonwebtoken** — Pure JS, ESM-native, already in package.json
4. **Database-level isolation** — Multi-tenant KB enforced at SQL level, not just API layer
5. **Graceful degradation** — Auth failure shows Login Webview; IDE tools remain registered (unavailable, not crashed)
6. **Symmetric JWT (HS256)** — Single-machine deployment, no need for asymmetric keys

### 1.5 Constraints

- Single-machine deployment (Backend + Extension on same localhost)
- SQLite database (no connection pooling, WAL mode for concurrent reads)
- JWT secret must be configurable via environment variable (default insecure for dev)
- Extension .vsix remains < 5MB (auth adds ~10KB bundled code)
- All tokens stored in VS Code SecretStorage (OS keychain)

### 1.6 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-285.docx |
| FSD | FSD-v1.1-KSA-285.docx |
| KSA-284 TDD | TDD-v1.1-KSA-284.docx |
| jose Documentation | https://github.com/panva/jose |
| VS Code SecretStorage | https://code.visualstudio.com/api/references/vscode-api#SecretStorage |
| OIDC Core 1.0 | https://openid.net/specs/openid-connect-core-1_0.html |

---

## 2. System Architecture

### 2.1 Architecture Overview

The system extends KSA-284's split architecture by adding three cross-cutting layers:

1. **Authentication Layer** — JWT-based auth guard on all protected routes, with SSO via OIDC+PKCE
2. **Multi-Tenant KB Layer** — 3-tier (User/Project/Shared) knowledge base with auto-promotion
3. **Configuration Layer** — Per-user MCP server credential management with AES-256 encryption

![Architecture Diagram](diagrams/architecture.png)
*[Edit in draw.io](diagrams/architecture.drawio)*

`mermaid
graph TB
    subgraph Extension["VS Code Extension"]
        LW[Login Webview]
        MCW[MCP Config Webview]
        AM[AuthManager]
        AI[AuthInterceptor]
        TRT[Token Refresh Timer]
        SS[SecretStorage]
        TP[ToolProxy]
        CM[ConnectionManager]
    end

    subgraph Backend["Backend Server :48721"]
        AG[Auth Guard Middleware]
        subgraph AuthMod["Auth Module"]
            AS[AuthService]
            TS[TokenService]
            PS[PasswordService]
            SSO[SsoService]
            UR[UserRepository]
            SR[SessionRepository]
        end
        subgraph KBMod["KB Module"]
            KR[KbRepository]
            PrS[PromotionService]
            TAC[TierAccessControl]
        end
        subgraph ConfMod["Config Module"]
            CS[ConfigService]
            CR[ConfigRepository]
            ES[EncryptionService]
        end
        subgraph SchedMod["Scheduler Module"]
            SM[SchedulerModule]
        end
        DB[(SQLite DB)]
    end

    subgraph External["External Systems"]
        IdP[Identity Provider]
        MCP[Child MCP Servers]
    end

    LW -->|POST /api/auth/login| AG
    MCW -->|PUT /api/config/mcp-servers| AG
    AI -->|Bearer JWT| AG
    AM --> SS
    TRT -->|POST /api/auth/refresh| AG
    AG --> AuthMod
    AG --> KBMod
    AG --> ConfMod
    SM --> KR
    SM --> PrS
    SSO --> IdP
    CS --> MCP
    AuthMod --> DB
    KBMod --> DB
    ConfMod --> DB
`

### 2.2 Component Diagram

![Component Diagram](diagrams/component.png)
*[Edit in draw.io](diagrams/component.drawio)*

| Component | Location | Responsibility | Implements |
|-----------|----------|----------------|------------|
| AuthManager | Extension | Login/logout orchestration, SecretStorage CRUD | UC-1, UC-2, UC-10 |
| AuthInterceptor | Extension | Inject Bearer header on all HTTP requests | BR-1 |
| TokenRefreshTimer | Extension | Auto-refresh at expiry-5min | UC-3, BR-8 |
| LoginWebview | Extension | HTML form for username/password + SSO button | UC-1, UC-2 |
| McpConfigWebview | Extension | Tabbed form for MCP server config | UC-9 |
| Auth Guard | Backend | Middleware: validate JWT on protected routes | BR-1 |
| AuthService | Backend | Login, refresh, logout business logic | UC-1, UC-3, UC-10 |
| TokenService | Backend | JWT sign/verify (jose HS256), refresh token gen | BR-2, BR-3 |
| PasswordService | Backend | scrypt hash/verify (N=16384, r=8, p=1) | BR-5 |
| SsoService | Backend | OIDC discovery, PKCE state management | UC-2, BR-6, BR-7 |
| KbRepository | Backend | Multi-tier CRUD for kb_entries | UC-4..UC-8 |
| PromotionService | Backend | Auto-promotion logic (User→Project→Shared) | UC-7, UC-8, BR-12..BR-14 |
| TierAccessControl | Backend | Tier visibility/permission checks | BR-9..BR-11, BR-22 |
| ConfigService | Backend | MCP config CRUD with encryption | UC-9, BR-16, BR-17 |
| EncryptionService | Backend | AES-256-GCM encrypt/decrypt | BR-16 |
| SchedulerModule | Backend | setInterval: promotion (30min), TTL cleanup (1h) | BR-15, UC-7 |

### 2.3 Deployment Architecture

Both components run on same machine (unchanged from KSA-284):

| Process | Port | Memory Delta | New Disk |
|---------|------|-------------|----------|
| Extension (in VS Code) | N/A | +5MB (auth state, webviews) | +10KB bundled |
| Backend MCP Server | 48721 | +50MB (auth + scheduler) | +2MB (db growth) |

### 2.4 Communication Patterns

| From | To | Protocol | Auth | Description |
|------|----|----------|------|-------------|
| Extension.AuthManager | Backend /api/auth/login | HTTP POST | None (login endpoint) | Authenticate |
| Extension.AuthInterceptor | Backend /mcp/tools/call | HTTP POST | Bearer JWT | Tool execution |
| Extension.TokenRefreshTimer | Backend /api/auth/refresh | HTTP POST | None (uses refresh_token body) | Token renewal |
| Extension.McpConfigWebview | Backend /api/config/* | HTTP GET/PUT | Bearer JWT | Config CRUD |
| Backend.SsoService | External IdP | HTTPS | OAuth2 | OIDC token exchange |
| Backend.SchedulerModule | Backend.KbRepository | In-process | N/A | Background jobs |

---

## 3. API Design

### 3.1 API Overview

| # | Endpoint | Method | Auth | Description | Source |
|---|----------|--------|------|-------------|--------|
| 1 | /api/auth/login | POST | None | Local username/password login | UC-1 |
| 2 | /api/auth/sso/authorize | POST | None | Initiate SSO PKCE flow | UC-2 |
| 3 | /api/auth/sso/callback | GET | None | IdP redirect callback | UC-2 |
| 4 | /api/auth/refresh | POST | None | Refresh access token | UC-3 |
| 5 | /api/auth/logout | POST | Bearer | Revoke refresh token | UC-10 |
| 6 | /api/auth/me | GET | Bearer | Get current user profile | — |
| 7 | /api/config/mcp-servers | GET | Bearer | Retrieve user's MCP config | UC-9 |
| 8 | /api/config/mcp-servers | PUT | Bearer | Save user's MCP config | UC-9 |
| 9 | /api/config/mcp-servers/test | POST | Bearer | Test MCP server connection | UC-9 |
| 10 | /api/kb/promote/status | GET | Bearer | Promotion status & candidates | UC-7 |
| 11 | /api/kb/promote | POST | Bearer | Manual promotion | UC-7 |
| 12 | /mcp/tools/call | POST | Bearer | MCP tool execution (existing, now auth-protected) | BR-1 |

### 3.2 API: POST /api/auth/login

**Implements:** UC-1, BR-2, BR-4, BR-5

**Request:**
`json
{
  "username": "john.doe",
  "password": "secureP4ss!"
}
`

**Validation (zod):**
`	ypescript
const LoginSchema = z.object({
  username: z.string().min(1).max(100).regex(/^[a-zA-Z0-9._]+$/),
  password: z.string().min(8).max(128),
});
`

**Response — 200 OK:**
`json
{
  "access_token": "eyJhbGciOiJIUzI1NiJ9...",
  "refresh_token": "rt_a1b2c3d4e5f6...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "john.doe",
    "email": "john@company.com",
    "display_name": "John Doe",
    "role": "user",
    "projects": ["proj-abc", "proj-xyz"]
  }
}
`

**Error Responses:**

| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 400 | VALIDATION_ERROR | "Invalid input." | Malformed request body |
| 401 | AUTH_INVALID_CREDENTIALS | "Invalid username or password." | Wrong credentials |
| 403 | AUTH_ACCOUNT_LOCKED | "Account locked. Try again in {N} minutes." | 5+ failed attempts (BR-4) |

### 3.3 API: POST /api/auth/sso/authorize

**Implements:** UC-2, BR-6

**Request:**
`json
{
  "code_challenge": "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  "redirect_uri": "http://localhost:48721/api/auth/sso/callback"
}
`

**Response — 200 OK:**
`json
{
  "authorization_url": "https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=...&code_challenge=...&state=...",
  "state": "abc123def456"
}
`

**Error Responses:**

| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 400 | SSO_ERROR | "SSO is not configured on this server." | sso_config.enabled = false |

### 3.4 API: GET /api/auth/sso/callback

**Implements:** UC-2 (Step 9-15)

**Query Parameters:** ?code={auth_code}&state={state} (from IdP redirect)

**Response:** HTML page instructing user to close browser window. Backend stores auth code for Extension polling.

### 3.5 API: POST /api/auth/refresh

**Implements:** UC-3, BR-3

**Request:**
`json
{
  "refresh_token": "rt_a1b2c3d4e5f6..."
}
`

**Response — 200 OK:**
`json
{
  "access_token": "eyJhbGciOiJIUzI1NiJ9...(new)",
  "refresh_token": "rt_new_token...",
  "token_type": "Bearer",
  "expires_in": 3600
}
`

**Error Responses:**

| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 401 | AUTH_REFRESH_INVALID | "Refresh token expired or revoked." | Token revoked or past 7d |

**Note:** Refresh uses token rotation — old session revoked, new session created.

### 3.6 API: POST /api/auth/logout

**Implements:** UC-10, BR-18

**Request:**
`json
{
  "refresh_token": "rt_a1b2c3d4e5f6..."
}
`

**Response — 200 OK:**
`json
{
  "message": "Logged out successfully"
}
`

### 3.7 API: GET /api/auth/me

**Implements:** User profile retrieval

**Headers:** Authorization: Bearer {JWT}

**Response — 200 OK:**
`json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "john.doe",
  "email": "john@company.com",
  "display_name": "John Doe",
  "role": "user",
  "projects": ["proj-abc", "proj-xyz"],
  "auth_method": "local"
}
`

### 3.8 API: GET /api/config/mcp-servers

**Implements:** UC-9, BR-17

**Headers:** Authorization: Bearer {JWT}

**Response — 200 OK:**
`json
{
  "servers": [
    {
      "name": "jira",
      "configured": true,
      "url": "https://company.atlassian.net",
      "username": "john.doe@company.com",
      "has_token": true,
      "extra": {}
    },
    {
      "name": "drawio",
      "configured": true,
      "url": null,
      "username": null,
      "has_token": false,
      "extra": { "cli_path": "C:\\Program Files\\draw.io\\draw.io.exe", "format": "png" }
    },
    {
      "name": "export",
      "configured": false,
      "url": null,
      "username": null,
      "has_token": false,
      "extra": {}
    }
  ]
}
`

**Note:** Token/password values NEVER returned (BR-17). Only has_token: boolean.

### 3.9 API: PUT /api/config/mcp-servers

**Implements:** UC-9, BR-16

**Request:**
`json
{
  "servers": [
    {
      "name": "jira",
      "url": "https://company.atlassian.net",
      "username": "john.doe@company.com",
      "token": "ATATT3xAbcDef...",
      "extra": {}
    }
  ]
}
`

**Response — 200 OK:**
`json
{
  "success": true,
  "message": "Configuration saved successfully"
}
`

### 3.10 API: POST /api/config/mcp-servers/test

**Implements:** UC-9 AF-1

**Request:**
`json
{
  "server_name": "jira",
  "url": "https://company.atlassian.net",
  "username": "john.doe@company.com",
  "token": "ATATT3xAbcDef..."
}
`

**Response — 200 OK:**
`json
{
  "success": true,
  "message": "Connection successful",
  "response_time_ms": 230
}
`

### 3.11 API: GET /api/kb/promote/status

**Implements:** UC-7/UC-8 monitoring

**Response — 200 OK:**
`json
{
  "last_run": "2025-07-15T10:30:00Z",
  "next_run": "2025-07-15T11:00:00Z",
  "pending_user_to_project": 3,
  "pending_project_to_shared": 1,
  "recent_promotions": [
    {
      "promoted_entry_id": "uuid-new",
      "source_entry_id": "uuid-old",
      "from_tier": 1,
      "to_tier": 2,
      "promoted_at": "2025-07-15T10:30:05Z"
    }
  ]
}
`

### 3.12 API: POST /api/kb/promote

**Implements:** UC-7 AF-1 (manual promotion)

**Request:**
`json
{
  "entry_id": "550e8400-e29b-41d4-a716-446655440000",
  "target_tier": 2,
  "project_id": "proj-abc"
}
`

**Response — 200 OK:**
`json
{
  "success": true,
  "new_entry_id": "660f9500-...",
  "message": "Entry promoted to Project KB"
}
`

---

## 4. Database Design

### 4.1 Migration Strategy

All schema changes are in a single migration file: `src/backend/src/database/migrations/002-auth-multitenant.ts`

**Approach:** `CREATE TABLE IF NOT EXISTS` — idempotent, safe to re-run.

### 4.2 DDL Scripts

**Verified against actual codebase** — the following DDL is extracted from the implemented migration:

`sql
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (uuid()),
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

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY DEFAULT (uuid()),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  revoked_at TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- KB entries (multi-tier)
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

-- MCP configuration (per-user)
CREATE TABLE IF NOT EXISTS mcp_config (
  id TEXT PRIMARY KEY DEFAULT (uuid()),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  server_name TEXT NOT NULL CHECK (server_name IN ('jira', 'drawio', 'export')),
  config_data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, server_name)
);

-- SSO configuration (singleton)
CREATE TABLE IF NOT EXISTS sso_config (
  id TEXT PRIMARY KEY DEFAULT (uuid()),
  issuer_url TEXT NOT NULL,
  client_id TEXT NOT NULL,
  allowed_domains TEXT NOT NULL DEFAULT '[]',
  redirect_uri TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  user_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`

### 4.3 Index Strategy

| Index | Table | Columns | Rationale |
|-------|-------|---------|-----------|
| idx_users_username | users | username | Login lookup |
| idx_users_email | users | email | SSO email matching |
| idx_users_sso | users | sso_provider, sso_subject | SSO user resolution |
| idx_sessions_user_id | sessions | user_id | User's active sessions |
| idx_sessions_refresh_token | sessions | refresh_token_hash | Token refresh validation |
| idx_kb_tier_owner | kb_entries | tier, owner_id | User KB queries (Tier 1) |
| idx_kb_tier_project | kb_entries | tier, project_id | Project KB queries (Tier 2) |
| idx_kb_tier3 | kb_entries | tier WHERE tier=3 | Shared KB queries |
| idx_kb_promotion | kb_entries | tier, promoted WHERE promoted=0 | Promotion candidate scan |
| idx_kb_ttl | kb_entries | tier, ttl_days, created_at WHERE tier=1 | TTL cleanup query |
| idx_kb_content_hash | kb_entries | content_hash | Deduplication check |
| idx_mcp_config_user | mcp_config | user_id | Per-user config lookup |
| idx_audit_event_type | audit_log | event_type, created_at | Audit queries |
| idx_audit_user | audit_log | user_id, created_at | Per-user audit trail |

### 4.4 Key Query Patterns

**Login (UserRepository):**
`sql
SELECT * FROM users WHERE username = ?
-- Uses: idx_users_username (unique index, O(1))
`

**Token Refresh (SessionRepository):**
`sql
SELECT * FROM sessions WHERE refresh_token_hash = ? AND revoked = 0 AND expires_at > datetime('now')
-- Uses: idx_sessions_refresh_token
`

**Multi-Tier Search (KbRepository):**
`sql
-- Tier 1 (User KB)
SELECT * FROM kb_entries WHERE tier = 1 AND owner_id = ? ORDER BY created_at DESC LIMIT ?
-- Tier 2 (Project KB)
SELECT * FROM kb_entries WHERE tier = 2 AND project_id IN (?,?,?) ORDER BY created_at DESC LIMIT ?
-- Tier 3 (Shared KB)
SELECT * FROM kb_entries WHERE tier = 3 ORDER BY created_at DESC LIMIT ?
`

**TTL Cleanup:**
`sql
DELETE FROM kb_entries
WHERE tier = 1 AND ttl_days IS NOT NULL
AND datetime(created_at, '+' || ttl_days || ' days') < datetime('now')
-- Uses: idx_kb_ttl (partial index)
`

**Promotion Candidates:**
`sql
SELECT * FROM kb_entries WHERE tier = ? AND promoted = 0 AND quality_score > ?
-- Uses: idx_kb_promotion (partial index)
`

---

## 5. Class / Module Design

### 5.1 Backend Package Structure (KSA-285 additions)

`
backend/src/
├── config/
│   └── BackendConfig.ts          # Added jwtSecret, encryptionKey
├── database/
│   └── migrations/
│       └── 002-auth-multitenant.ts  # Full DDL for auth + KB + config tables
├── modules/
│   ├── auth/                     # NEW MODULE
│   │   ├── __tests__/
│   │   ├── AuthModule.ts         # IModule implementation (no MCP tools)
│   │   ├── AuthService.ts        # Login, refresh, logout logic
│   │   ├── PasswordService.ts    # scrypt hash/verify
│   │   ├── SsoService.ts         # OIDC + PKCE flow
│   │   ├── TokenService.ts       # JWT sign/verify (jose)
│   │   ├── UserRepository.ts     # users table CRUD
│   │   ├── SessionRepository.ts  # sessions table CRUD
│   │   └── types.ts              # AuthPayload, TokenPair, etc.
│   ├── config/                   # NEW MODULE
│   │   ├── __tests__/
│   │   ├── ConfigModule.ts       # IModule implementation
│   │   ├── ConfigService.ts      # MCP config business logic
│   │   ├── ConfigRepository.ts   # mcp_config table CRUD
│   │   ├── EncryptionService.ts  # AES-256-GCM encrypt/decrypt
│   │   └── types.ts              # McpServerConfig types
│   ├── memory/                   # EXTENDED (existing)
│   │   ├── KbRepository.ts       # Multi-tier CRUD (NEW)
│   │   ├── PromotionService.ts   # Auto-promotion logic (NEW)
│   │   ├── TierAccessControl.ts  # Permission checks (NEW)
│   │   ├── types.ts              # KbEntry, PromoteResponse
│   │   └── MemoryModule.ts       # Existing (unchanged)
│   └── scheduler/                # NEW MODULE
│       └── SchedulerModule.ts    # setInterval-based job scheduler
├── server/
│   ├── middleware/
│   │   └── auth-guard.ts         # NEW: JWT Bearer validation
│   └── routes/
│       ├── auth.ts               # NEW: /api/auth/* endpoints
│       ├── config.ts             # NEW: /api/config/* endpoints
│       └── kb.ts                 # NEW: /api/kb/* endpoints
└── index.ts                      # Updated: register new modules
`

### 5.2 Extension Package Structure (KSA-285 additions)

`
extension/src/
├── auth/                         # NEW
│   ├── AuthManager.ts            # Login/logout orchestration
│   ├── AuthInterceptor.ts        # Inject Bearer header on requests
│   └── TokenRefreshTimer.ts      # Auto-refresh at expiry-5min
├── webview/
│   ├── panels/
│   │   ├── LoginPanel.ts         # NEW: Login Webview
│   │   └── McpConfigPanel.ts     # NEW: MCP Config Webview
│   └── WebviewManager.ts         # Updated: add login + config panels
├── types/
│   └── auth.ts                   # NEW: AuthState, StoredTokens
└── extension.ts                  # Updated: integrate AuthManager
`

### 5.3 Key Interfaces and Class Diagram

![Class Diagram — Auth](diagrams/class-auth.png)
*[Edit in draw.io](diagrams/class-auth.drawio)*

`mermaid
classDiagram
    class AuthModule {
        +name: string
        +status: ModuleStatus
        +authService: AuthService
        +tokenService: TokenService
        +ssoService: SsoService
        +userRepo: UserRepository
        +initialize(): Promise~void~
        +shutdown(): Promise~void~
        +getToolHandlers(): Map
        +getToolDefinitions(): ToolDefinition[]
    }

    class AuthService {
        -userRepo: UserRepository
        -sessionRepo: SessionRepository
        -tokenService: TokenService
        -passwordService: PasswordService
        +login(username, password, userAgent?): Promise~LoginResponse~
        +refresh(refreshToken): Promise~TokenPair~
        +logout(refreshToken): void
        +verifyToken(token): Promise~AuthPayload~
    }

    class TokenService {
        -secretKey: Uint8Array
        +generateAccessToken(payload): Promise~string~
        +generateRefreshToken(): string
        +hashRefreshToken(token): string
        +getRefreshTokenExpiry(): Date
        +verifyAccessToken(token): Promise~AuthPayload~
        +generateTokenPair(payload): Promise~TokenPair~
    }

    class PasswordService {
        +hash(password): Promise~string~
        +verify(password, storedHash): Promise~boolean~
    }

    class SsoService {
        -pendingFlows: Map
        +getConfig(): SsoConfig
        +authorize(codeChallenge, redirectUri): Promise~SsoAuthorizeResponse~
        +validateState(state): PendingSsoFlow
        +isDomainAllowed(email): boolean
    }

    class UserRepository {
        +findByUsername(username): UserRecord
        +findById(id): UserRecord
        +findByEmail(email): UserRecord
        +create(user): UserRecord
        +incrementFailedAttempts(id): void
        +resetFailedAttempts(id): void
        +lockAccount(id, until): void
    }

    class SessionRepository {
        +create(session): void
        +findByRefreshTokenHash(hash): SessionRecord
        +revoke(id): void
        +revokeByRefreshTokenHash(hash): void
        +revokeAllForUser(userId): void
    }

    AuthModule --> AuthService
    AuthModule --> TokenService
    AuthModule --> SsoService
    AuthModule --> UserRepository
    AuthService --> UserRepository
    AuthService --> SessionRepository
    AuthService --> TokenService
    AuthService --> PasswordService
`

![Class Diagram — KB](diagrams/class-kb.png)
*[Edit in draw.io](diagrams/class-kb.drawio)*

`mermaid
classDiagram
    class KbRepository {
        -db: IDatabase
        +create(entry): KbEntry
        +findById(id): KbEntry
        +findUserEntries(userId, limit): KbEntry[]
        +findProjectEntries(projectIds, limit): KbEntry[]
        +findSharedEntries(limit): KbEntry[]
        +findPromotionCandidates(tier, threshold): KbEntry[]
        +markPromoted(entryId): void
        +deleteExpiredEntries(): number
        +countUserEntries(userId): number
        +countProjectEntries(projectId): number
        +countSharedEntries(): number
        +findByContentHash(hash): KbEntry[]
    }

    class PromotionService {
        -kbRepo: KbRepository
        +promoteUserToProject(): PromoteResponse[]
        +promoteProjectToShared(): PromoteResponse[]
        +manualPromote(entryId, targetTier, projectId, promotedBy): PromoteResponse
    }

    class TierAccessControl {
        +canRead(userId, projects, entry): boolean
        +canWrite(userId, role, tier, projectId): boolean
        +canPromote(userId, role, entry, targetTier): boolean
    }

    class SchedulerModule {
        -promotionTimer: Timer
        -ttlCleanupTimer: Timer
        +initialize(): Promise~void~
        +shutdown(): Promise~void~
        -runPromotionJob(): void
        -runTtlCleanup(): void
    }

    PromotionService --> KbRepository
    SchedulerModule --> PromotionService
    SchedulerModule --> KbRepository
`

### 5.4 Design Patterns

| Pattern | Where Used | Rationale |
|---------|-----------|-----------|
| **Module** | AuthModule, ConfigModule, SchedulerModule | IModule interface from KSA-284 — consistent lifecycle |
| **Repository** | UserRepository, SessionRepository, KbRepository, ConfigRepository | Data access encapsulation, SQLite statements |
| **Service** | AuthService, PromotionService, ConfigService | Business logic separation from data access |
| **Guard** | auth-guard middleware | Cross-cutting auth concern, Hono middleware pattern |
| **Observer** | Extension AuthManager → StatusBarManager | UI updates on auth state change |
| **Strategy** | EncryptionService (AES-256-GCM) | Swappable encryption algorithm |
| **Scheduler** | SchedulerModule (setInterval) | Simple periodic job execution |
| **Token Rotation** | AuthService.refresh() | Revoke old + create new on each refresh (security) |

### 5.5 Authentication State Machine

`mermaid
stateDiagram-v2
    [*] --> UNAUTHENTICATED: Extension activates, no stored token
    UNAUTHENTICATED --> AUTHENTICATING: User submits credentials
    AUTHENTICATING --> AUTHENTICATED: Login success (tokens stored)
    AUTHENTICATING --> UNAUTHENTICATED: Login failed
    AUTHENTICATED --> REFRESHING: Timer fires (expiry - 5min)
    REFRESHING --> AUTHENTICATED: New token received
    REFRESHING --> UNAUTHENTICATED: Refresh failed (revoked/expired)
    AUTHENTICATED --> LOGGING_OUT: User triggers logout
    LOGGING_OUT --> UNAUTHENTICATED: Tokens cleared
    AUTHENTICATED --> UNAUTHENTICATED: 401 from any API call
    
    note right of AUTHENTICATED
        Status bar: "Authenticated (username)" (green)
        All requests include Bearer header
    end note
    
    note right of UNAUTHENTICATED
        Status bar: "Not Authenticated" (red)
        Login Webview shown
    end note
`

---

## 6. Security Design

### 6.1 JWT Implementation

| Aspect | Design Decision | Rationale |
|--------|----------------|-----------|
| Algorithm | HS256 (symmetric) | Single-machine deployment, simple key management |
| Library | jose (v5.6+) | Pure JS, ESM-native, maintained, no native deps |
| Expiry | 1 hour (access token) | Balance security vs UX — frequent refresh OK on localhost |
| Secret | Env var `JWT_SECRET` | Configurable, default for dev |
| Claims | userId, username, email, role, projects[] | Minimum needed for auth + authorization |
| Storage | VS Code SecretStorage (Extension) | OS-level encryption (Keychain/DPAPI/libsecret) |

### 6.2 Password Hashing

| Aspect | Value | Rationale |
|--------|-------|-----------|
| Algorithm | scrypt | Node.js built-in, memory-hard, no native deps |
| N (CPU/memory cost) | 16384 | OWASP recommended minimum |
| r (block size) | 8 | Standard |
| p (parallelization) | 1 | Single-threaded OK for localhost |
| keyLen | 64 bytes | Sufficient entropy |
| Salt | 32 bytes random | Per-password unique salt |
| Storage format | `{salt_hex}:{hash_hex}` | Simple, parseable |
| Timing attack protection | `crypto.timingSafeEqual` | Constant-time comparison |

### 6.3 Encryption at Rest (MCP Config)

| Aspect | Value | Rationale |
|--------|-------|-----------|
| Algorithm | AES-256-GCM | Authenticated encryption (integrity + confidentiality) |
| Key | 32 bytes from env `ENCRYPTION_KEY` | Separate from JWT secret |
| IV | 12 bytes random per encryption | GCM recommended IV length |
| Auth tag | 16 bytes | Full 128-bit authentication |
| Storage format | `{iv_hex}:{ciphertext_hex}:{tag_hex}` | Compact, parseable |

### 6.4 PKCE Flow Security

| Aspect | Value |
|--------|-------|
| code_verifier | 43-128 cryptographically random characters |
| code_challenge | `base64url(SHA-256(code_verifier))` |
| code_challenge_method | S256 (always) |
| State parameter | 16 bytes random hex (CSRF protection) |
| Flow timeout | 30 seconds (BR-26) |
| Pending flow storage | In-memory Map (cleared on timeout) |

### 6.5 Account Lockout (BR-4)

| Aspect | Value |
|--------|-------|
| Max failed attempts | 5 |
| Lockout duration | 15 minutes |
| Reset condition | Successful login OR lockout expiry |
| Storage | `users.failed_attempts` + `users.locked_until` |
| Attack surface | Username not revealed (same error for wrong user/wrong password) |

### 6.6 Token Lifecycle Security

`mermaid
sequenceDiagram
    participant E as Extension
    participant SS as SecretStorage
    participant B as Backend
    participant DB as SQLite

    Note over E,DB: Login Flow
    E->>B: POST /api/auth/login {username, password}
    B->>DB: SELECT user WHERE username=?
    B->>B: scrypt.verify(password, hash)
    B->>B: jose.sign(JWT, HS256, 1h)
    B->>B: crypto.randomBytes(32) → refresh_token
    B->>DB: INSERT session (SHA256(refresh_token), expires_at=+7d)
    B-->>E: {access_token, refresh_token, expires_in}
    E->>SS: store("codeintel.accessToken", jwt)
    E->>SS: store("codeintel.refreshToken", rt)
    E->>E: schedule timer at (now + 55min)

    Note over E,DB: Auto-Refresh Flow (at expiry - 5min)
    E->>SS: read("codeintel.refreshToken")
    E->>B: POST /api/auth/refresh {refresh_token}
    B->>DB: SELECT session WHERE hash=SHA256(rt) AND !revoked
    B->>DB: UPDATE session SET revoked=1
    B->>B: generate new JWT + new refresh_token
    B->>DB: INSERT new session
    B-->>E: {new_access_token, new_refresh_token}
    E->>SS: update tokens
    E->>E: reschedule timer

    Note over E,DB: Logout Flow
    E->>B: POST /api/auth/logout {refresh_token}
    B->>DB: UPDATE sessions SET revoked=1 WHERE hash=SHA256(rt)
    B-->>E: 200 OK
    E->>SS: delete("codeintel.accessToken")
    E->>SS: delete("codeintel.refreshToken")
    E->>E: cancel timer, show Login Webview
`

---

## 7. Background Job Design

### 7.1 Scheduler Architecture

The `SchedulerModule` uses simple `setInterval` (no external scheduler library):

| Job | Interval | Function | Error Handling |
|-----|----------|----------|----------------|
| Promotion | 30 min (BR-15) | `runPromotionJob()` | try/catch, log error, continue next cycle |
| TTL Cleanup | 1 hour | `runTtlCleanup()` | try/catch, log error, continue next cycle |

### 7.2 Promotion Job Logic

**User→Project (BR-12) — ALL criteria:**
1. `quality_score > 0.8`
2. `tags` includes "project-relevant"
3. `promoted_by IS NOT NULL` (at least 1 reviewer)
4. `project_id IS NOT NULL` (has associated project)

**Project→Shared (BR-13) — ANY criterion:**
1. `referenced_by_projects.length >= 3`
2. `tags` includes "best-practice"
3. `admin_promoted = 1`

**Promotion action:**
- CREATE copy in target tier (new UUID, `promoted_from` = source ID)
- UPDATE source: `promoted = 1`
- Log result

### 7.3 TTL Cleanup Logic

`sql
DELETE FROM kb_entries
WHERE tier = 1
  AND ttl_days IS NOT NULL
  AND datetime(created_at, '+' || ttl_days || ' days') < datetime('now')
`

Returns count of deleted entries for logging.

---

## 8. Performance & Scalability

### 8.1 Performance Targets

| Operation | Target | Measured Approach |
|-----------|--------|-------------------|
| Local login | < 3s end-to-end | scrypt ~100ms + JWT sign ~5ms + DB write ~5ms |
| Token refresh | < 500ms | DB read + JWT sign + DB write |
| KB search (3 tiers) | < 500ms | Parallel SQLite queries + in-memory merge |
| Config save | < 1s | AES encrypt + DB upsert |
| Promotion job | < 10s per run | Batch scan with partial index |

### 8.2 Caching Strategy

| Data | Cache Location | TTL | Invalidation |
|------|---------------|-----|--------------|
| JWT payload (decoded) | Hono context per-request | Request lifetime | N/A |
| SSO config | SsoService.getConfig() per-call | None (DB read) | Config change |
| Pending SSO flows | In-memory Map | 30s (BR-26) | Auto-cleanup |
| User permissions | From JWT claims | Token lifetime (1h) | Token refresh |

### 8.3 SQLite Optimizations

- **WAL mode** — Concurrent readers don't block writer
- **Busy timeout 5000ms** — Retry on lock instead of immediate fail
- **Partial indexes** — `idx_kb_promotion` only indexes non-promoted entries
- **Content hash** — Deduplication without comparing full text

### 8.4 Scalability Limits

| Dimension | Limit | Enforcement |
|-----------|-------|-------------|
| Concurrent users | 100 | SQLite WAL handles reads; write serialization OK for 100 users |
| User KB entries | 10,000/user (BR-23) | Check count before insert |
| Project KB entries | 100,000/project (BR-24) | Check count before insert |
| Shared KB entries | 50,000 total (BR-25) | Check count before insert |
| Sessions per user | Unlimited (old auto-revoked on refresh) | Token rotation cleans up |

---

## 9. Monitoring & Observability

### 9.1 Logging Standards

All logging uses pino (existing) with structured JSON:

`	ypescript
logger.info({ userId, method: 'local' }, 'Login success');
logger.warn({ username, attempts: 5 }, 'Account locked');
logger.error({ err, entryId }, 'Promotion failed');
`

### 9.2 Audit Log Events

| Event | Logged To | Fields |
|-------|-----------|--------|
| login_success | audit_log table | userId, method, timestamp |
| login_failure | audit_log table | username, reason, timestamp |
| account_locked | audit_log table | username, locked_until |
| logout | audit_log table | userId, timestamp |
| kb_promoted | audit_log table | entry_id, from_tier, to_tier, by |
| kb_ttl_deleted | audit_log table | entry_id, owner_id, age |
| config_changed | audit_log table | userId, server_name (no secrets) |

### 9.3 Health Check Extension

The existing `GET /health` endpoint now includes auth module status:

`json
{
  "status": "healthy",
  "version": "1.2.0",
  "modules": {
    "memory": "ready",
    "codeIntel": "ready",
    "orchestration": "ready",
    "analytics": "ready",
    "kbGraph": "ready",
    "auth": "ready",
    "config": "ready",
    "scheduler": "ready"
  }
}
`

---

## 10. Deployment

### 10.1 Environment Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | `code-intel-default-jwt-secret-change-in-production` | HS256 signing key (MUST change for production) |
| `ENCRYPTION_KEY` | `code-intel-default-enc-key-change-me` | AES-256 key for MCP config encryption |
| `BACKEND_PORT` | 48721 | HTTP server port |
| `BACKEND_HOST` | 127.0.0.1 | Bind address (localhost only) |
| `DB_PATH` | .code-intel/index.db | SQLite database path |

### 10.2 Migration Execution

Migration runs automatically on server start:
`	ypescript
MIGRATION_002.up(db); // Idempotent (CREATE TABLE IF NOT EXISTS)
`

No manual migration step required. Database schema is auto-created on first start.

### 10.3 Rollback Strategy

1. **Code rollback** — Revert to pre-KSA-285 branch (removes auth modules)
2. **Database** — Migration 002 is additive (new tables). Old code ignores new tables.
3. **Extension** — Revert to pre-KSA-285 .vsix (no auth code, no SecretStorage usage)
4. **Data** — User/session/config data in new tables is non-critical (can be recreated)

### 10.4 Feature Flags

No feature flags needed — auth is always-on once deployed. The `/health` endpoint remains unauthenticated for connection checks.

---

## 11. Implementation Checklist

### Phase 1: Backend Auth Module

| # | Task | File(s) | Priority |
|---|------|---------|----------|
| 1.1 | Migration 002 DDL | `database/migrations/002-auth-multitenant.ts` | P0 |
| 1.2 | AuthModule + types | `modules/auth/AuthModule.ts`, `types.ts` | P0 |
| 1.3 | TokenService (jose HS256) | `modules/auth/TokenService.ts` | P0 |
| 1.4 | PasswordService (scrypt) | `modules/auth/PasswordService.ts` | P0 |
| 1.5 | UserRepository | `modules/auth/UserRepository.ts` | P0 |
| 1.6 | SessionRepository | `modules/auth/SessionRepository.ts` | P0 |
| 1.7 | AuthService (login, refresh, logout) | `modules/auth/AuthService.ts` | P0 |
| 1.8 | Auth guard middleware | `server/middleware/auth-guard.ts` | P0 |
| 1.9 | Auth routes (/api/auth/*) | `server/routes/auth.ts` | P0 |
| 1.10 | SsoService (OIDC+PKCE) | `modules/auth/SsoService.ts` | P1 |

### Phase 2: Backend KB Multi-Tier

| # | Task | File(s) | Priority |
|---|------|---------|----------|
| 2.1 | KbRepository (multi-tier CRUD) | `modules/memory/KbRepository.ts` | P0 |
| 2.2 | TierAccessControl | `modules/memory/TierAccessControl.ts` | P0 |
| 2.3 | PromotionService | `modules/memory/PromotionService.ts` | P1 |
| 2.4 | SchedulerModule | `modules/scheduler/SchedulerModule.ts` | P1 |
| 2.5 | KB routes (/api/kb/*) | `server/routes/kb.ts` | P1 |

### Phase 3: Backend Config Module

| # | Task | File(s) | Priority |
|---|------|---------|----------|
| 3.1 | EncryptionService (AES-256-GCM) | `modules/config/EncryptionService.ts` | P0 |
| 3.2 | ConfigRepository | `modules/config/ConfigRepository.ts` | P0 |
| 3.3 | ConfigService + ConfigModule | `modules/config/ConfigService.ts`, `ConfigModule.ts` | P0 |
| 3.4 | Config routes (/api/config/*) | `server/routes/config.ts` | P0 |

### Phase 4: Extension Auth

| # | Task | File(s) | Priority |
|---|------|---------|----------|
| 4.1 | AuthManager (SecretStorage CRUD) | `extension/src/auth/AuthManager.ts` | P0 |
| 4.2 | AuthInterceptor (Bearer header) | `extension/src/auth/AuthInterceptor.ts` | P0 |
| 4.3 | TokenRefreshTimer | `extension/src/auth/TokenRefreshTimer.ts` | P0 |
| 4.4 | LoginPanel (Webview HTML/JS) | `extension/src/webview/panels/LoginPanel.ts` | P0 |
| 4.5 | McpConfigPanel (Webview) | `extension/src/webview/panels/McpConfigPanel.ts` | P1 |
| 4.6 | Extension.ts integration | `extension/src/extension.ts` | P0 |
| 4.7 | package.json (new commands) | `extension/package.json` | P0 |

### Phase 5: Integration & Testing

| # | Task | Priority |
|---|------|----------|
| 5.1 | Unit tests for AuthService (login, lockout, refresh) | P0 |
| 5.2 | Unit tests for PasswordService (hash, verify) | P0 |
| 5.3 | Unit tests for TokenService (sign, verify, expiry) | P0 |
| 5.4 | Unit tests for EncryptionService (encrypt, decrypt) | P0 |
| 5.5 | Unit tests for KbRepository (CRUD, tier queries) | P0 |
| 5.6 | Unit tests for PromotionService (both directions) | P1 |
| 5.7 | Integration tests for auth routes (login → use → refresh → logout) | P0 |
| 5.8 | Integration tests for auth guard (protected routes) | P0 |
| 5.9 | Integration tests for KB tier isolation | P0 |
| 5.10 | Integration tests for config encryption round-trip | P1 |

---

## 12. Discrepancy Notes

**FSD vs Actual Implementation:**

| # | Area | FSD Says | Actual Code | Resolution |
|---|------|----------|-------------|------------|
| 1 | Password hashing | BR-5 says "scrypt (N=16384, r=8, p=1, keyLen=64)" | PasswordService uses exactly these params | ✅ Consistent |
| 2 | JWT library | FSD references "jsonwebtoken" | Code uses `jose` (pure JS, same HS256) | jose is superior (ESM, no native deps) |
| 3 | Port | FSD §1.4 shows "http://localhost:9180" in redirect_uri | Backend runs on port 48721 | 48721 is correct (per KSA-284 TDD) |
| 4 | kb_entries.reviewed_by | FSD §4.2 shows reviewed_by JSON column | Actual schema uses promoted_by (single user) | PromotionService checks promoted_by != null instead |
| 5 | Refresh token storage | FSD says "hashed in DB" | SessionRepository stores SHA-256 hash | ✅ Consistent |

---

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
| 3 | Class — Auth | [class-auth.png](diagrams/class-auth.png) | [class-auth.drawio](diagrams/class-auth.drawio) |
| 4 | Class — KB | [class-kb.png](diagrams/class-kb.png) | [class-kb.drawio](diagrams/class-kb.drawio) |
| 5 | Sequence — Token Lifecycle | [sequence-token-lifecycle.png](diagrams/sequence-token-lifecycle.png) | [sequence-token-lifecycle.drawio](diagrams/sequence-token-lifecycle.drawio) |
