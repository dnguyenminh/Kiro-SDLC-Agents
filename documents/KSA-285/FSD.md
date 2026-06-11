# Functional Specification Document (FSD)

> **Revision Note:** FSD updated to v1.1 based on SA discrepancy report v1. See DISCREPANCY.md for details. DISC-2 (port 9180→48721) was already correct in FSD.

## Code Intelligence Extension — KSA-285: Authentication, Multi-Tenant KB, and MCP Server Configuration

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-285 |
| Title | Authentication, Multi-Tenant KB, and MCP Server Configuration |
| Author | BA Agent |
| Version | 1.1 |
| Date | 2025-07-14 |
| Status | Draft |
| Architecture Pattern | Plugin (IDE Extension) |
| Related BRD | BRD-v1-KSA-285.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.1 | 2025-07-15 | BA Agent | Fix discrepancies: BR-5 bcrypt→scrypt, add reviewed_by to kb_entries (DISC-1, DISC-3) |
| 1.0 | 2025-07-14 | BA Agent | Initiate document from BRD KSA-285 |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of three interconnected capabilities for the Code Intelligence Extension (KSA-284 split architecture):

1. **Authentication** — JWT-based local auth + OpenID Connect SSO with PKCE, secure token storage and auto-refresh
2. **Multi-Tenant 3-Tier Knowledge Base** — User (personal), Project (team), and Shared (company) knowledge tiers with auto-promotion
3. **MCP Server Configuration** — Webview-based per-user configuration of MCP server credentials

This document details use cases, business rules, data model, API contracts, processing logic, and security requirements that developers will implement.

### 1.2 Scope

**In Scope:**
- Local username/password authentication with JWT issuance
- SSO via OpenID Connect Authorization Code + PKCE flow
- Token storage in VS Code SecretStorage, auto-refresh lifecycle
- 3-tier KB: User (Tier 1), Project (Tier 2), Shared (Tier 3)
- Auto-promotion between tiers based on quality/usage criteria
- Unified search across all accessible tiers with relevance ranking
- MCP server configuration Webview (Jira, DrawIO, Export)
- Secure logout with token revocation
- Per-user data isolation

**Out of Scope:**
- External IdP provisioning
- RBAC beyond tier visibility
- KB content moderation workflows
- MCP server deployment/provisioning
- Multi-machine Backend deployment
- KB data export/import
- Audit logging (future ticket)

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| JWT | JSON Web Token — compact URL-safe claims token (RFC 7519) |
| HS256 | HMAC-SHA256 symmetric signing algorithm |
| PKCE | Proof Key for Code Exchange — OAuth2 extension (RFC 7636) |
| OIDC | OpenID Connect — identity layer on OAuth 2.0 |
| IdP | Identity Provider (Google, Azure AD, Okta, Keycloak) |
| SecretStorage | VS Code API for OS-level encrypted credential storage |
| KB | Knowledge Base — semantic search database |
| Tier | KB access level: 1=User, 2=Project, 3=Shared |
| TTL | Time To Live — auto-expiry duration |
| Quality Score | Numeric metric (0.0–1.0) measuring entry usefulness |
| MCP | Model Context Protocol — AI agent tool integration standard |
| Bearer Token | HTTP auth scheme: `Authorization: Bearer {JWT}` |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | documents/KSA-285/BRD.md |
| KSA-284 TDD | documents/KSA-284/TDD.md |
| VS Code SecretStorage API | https://code.visualstudio.com/api/references/vscode-api#SecretStorage |
| OpenID Connect Core 1.0 | https://openid.net/specs/openid-connect-core-1_0.html |
| OAuth 2.0 PKCE RFC 7636 | https://datatracker.ietf.org/doc/html/rfc7636 |
| JWT RFC 7519 | https://datatracker.ietf.org/doc/html/rfc7519 |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)
*[Edit in draw.io](diagrams/system-context.drawio)*

The system extends the KSA-284 split architecture (Extension Proxy + Backend Server) with authentication, multi-tenant KB, and configuration management. External actors and systems:

- **Developer** — IDE user who authenticates, manages KB, configures MCP servers
- **Identity Provider (IdP)** — External OIDC provider for SSO authentication
- **Backend Server** — Hono HTTP server on localhost handling auth, KB, and config
- **SQLite Database** — Persistent storage for users, KB entries, sessions, MCP config
- **VS Code SecretStorage** — OS-encrypted token storage in Extension
- **Child MCP Servers** — Jira, DrawIO, Export servers consuming user-specific config

### 2.2 System Architecture

The system extends the KSA-284 split architecture with authentication, multi-tenant KB, and configuration management. See the System Context diagram for the full visual representation:

![System Context](diagrams/system-context.png)
*[Edit in draw.io](diagrams/system-context.drawio)*

**Key Components:**

| Component | Location | Responsibility |
|-----------|----------|----------------|
| Login Webview | Extension | Username/password form + SSO button |
| MCP Config Webview | Extension | Per-user MCP server credential management |
| SecretStorage | Extension | Encrypted JWT + refresh token storage |
| Auth Interceptor | Extension | Injects Bearer token on all requests |
| Token Refresh Timer | Extension | Auto-refresh at expiry - 5min |
| Auth Module | Backend | /api/auth/* endpoints (login, SSO, refresh, logout) |
| KB Module | Backend | Multi-tenant tier-aware mem_* tools + promotion |
| Config Module | Backend | /api/config/* per-user MCP server config |
| SQLite Database | Backend | users, sessions, kb_entries, mcp_config tables |
| External IdP | External | OpenID Connect provider for SSO |
| Child MCP Servers | Backend | Jira, DrawIO, Export (use per-user config) |

---

## 3. Functional Requirements

### 3.1 Feature: Local Authentication (Username/Password)

**Source:** BRD Story 1

#### 3.1.1 Description

The Extension displays a Login Webview with username/password fields. The Backend validates credentials against its local user store (bcrypt hashed), issues a JWT (HS256, 1h expiry) and refresh token (7d expiry). Account lockout activates after 5 consecutive failed attempts.

#### 3.1.2 Use Case: UC-1 — Local Login

**Use Case ID:** UC-1
**Actor:** Developer
**Preconditions:** Backend server running, user account exists in database
**Postconditions:** JWT stored in SecretStorage, all requests include Bearer token

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Opens IDE / Extension activates | Extension checks SecretStorage | Look for existing valid JWT |
| 2 | | Extension detects no valid JWT | Opens Login Webview panel |
| 3 | Enters username and password | | User fills form fields |
| 4 | Clicks "Login" button | | Triggers auth request |
| 5 | | Extension sends POST /api/auth/login | Body: {username, password} |
| 6 | | Backend validates credentials (bcrypt compare) | Match against users table |
| 7 | | Backend generates JWT + refresh token | JWT: HS256, 1h; Refresh: 7d |
| 8 | | Backend returns tokens in response | 200 OK with token payload |
| 9 | | Extension stores JWT + refresh in SecretStorage | OS-level encrypted storage |
| 10 | | Extension closes Login Webview | Transition to authenticated state |
| 11 | | Extension updates status bar | Shows "Authenticated (username)" |
| 12 | | Extension attaches Bearer token to all requests | Auth interceptor active |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | Valid JWT exists in SecretStorage on activation | Skip Login Webview, go directly to Step 12. Validate JWT expiry first. |
| AF-2 | JWT expired but refresh token valid | Extension calls POST /api/auth/refresh → new JWT → update SecretStorage → Step 12 |
| AF-3 | User clicks "Login with SSO" instead | Redirect to UC-2 (SSO flow) |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Invalid credentials (wrong password) | Backend returns 401 → Extension shows error "Invalid username or password." → Stay on Login Webview |
| EF-2 | Account locked (5+ failed attempts) | Backend returns 403 → Extension shows "Account locked. Try again in {minutes} minutes." |
| EF-3 | Backend unreachable | Extension shows "Cannot connect to Backend. Please ensure the server is running." |
| EF-4 | Server error (500) | Extension shows "Authentication failed. Please try again later." |

![Sequence - Local Auth](diagrams/sequence-auth-local.png)
*[Edit in draw.io](diagrams/sequence-auth-local.drawio)*

---

### 3.2 Feature: SSO Authentication (OpenID Connect + PKCE)

**Source:** BRD Story 2

#### 3.2.1 Description

For organizations with centralized identity, the Extension supports OpenID Connect Authorization Code flow with PKCE. The Extension generates a code_verifier/challenge, opens the IdP in the system browser, receives the callback, and the Backend exchanges the authorization code for tokens. New users are auto-provisioned from IdP claims.

#### 3.2.2 Use Case: UC-2 — SSO Login

**Use Case ID:** UC-2
**Actor:** Developer
**Preconditions:** SSO configured in Backend (issuer_url, client_id), IdP accessible
**Postconditions:** JWT stored in SecretStorage, user auto-provisioned if new

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Clicks "Login with SSO" on Login Webview | | Initiates SSO flow |
| 2 | | Extension generates code_verifier (43-128 random chars) | PKCE preparation |
| 3 | | Extension computes code_challenge = base64url(SHA256(code_verifier)) | PKCE challenge |
| 4 | | Extension calls POST /api/auth/sso/authorize | Body: {code_challenge, redirect_uri} |
| 5 | | Backend constructs authorization URL with OIDC discovery | Uses issuer_url/.well-known/openid-configuration |
| 6 | | Backend returns authorization_url + state parameter | For browser redirect |
| 7 | | Extension opens system browser with authorization_url | External browser window |
| 8 | Authenticates with IdP (enters corporate credentials) | | IdP handles login |
| 9 | | IdP redirects to callback URL with auth code + state | http://localhost:48721/api/auth/sso/callback |
| 10 | | Backend receives callback, validates state | Anti-CSRF check |
| 11 | | Backend exchanges code + code_verifier for IdP tokens | POST to IdP token endpoint |
| 12 | | Backend validates IdP token, extracts claims (email, name) | Standard OIDC claims |
| 13 | | Backend auto-provisions user if not exists | Maps email → local user |
| 14 | | Backend issues own JWT + refresh token | Same as local auth tokens |
| 15 | | Backend notifies Extension via polling/callback | Token ready signal |
| 16 | | Extension stores tokens in SecretStorage | Same flow as UC-1 Step 9 |
| 17 | | Extension closes Login Webview, updates status bar | Authenticated state |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | User already has IdP session (cookie) | IdP skips login screen → immediate callback → Steps 9-17 |
| AF-2 | Embedded Webview mode (config flag) | Steps 7-8 happen in VS Code Webview instead of system browser |
| AF-3 | User exists locally but never used SSO | Link IdP claims to existing user by email match |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | IdP unreachable | Backend returns error → Extension shows "SSO provider unavailable. Please try local login or contact admin." |
| EF-2 | IdP rejects user | Callback with error → Extension shows "SSO authentication failed. Check with your administrator." |
| EF-3 | Callback timeout (30s) | Extension shows "SSO login timed out. Please try again." |
| EF-4 | Domain not in allowed list | Backend rejects → "Your organization is not configured for SSO access." |
| EF-5 | PKCE validation fails | Backend rejects code exchange → "Authentication failed. Please try again." |

![Sequence - SSO Auth](diagrams/sequence-auth-sso.png)
*[Edit in draw.io](diagrams/sequence-auth-sso.drawio)*

---

### 3.3 Feature: Secure Token Storage and Auto-Refresh

**Source:** BRD Story 3

#### 3.3.1 Description

JWT and refresh tokens are persisted in VS Code SecretStorage (OS-level encryption). The Extension monitors token expiry and triggers refresh 5 minutes before expiration, ensuring uninterrupted authenticated access without user interaction.

#### 3.3.2 Use Case: UC-3 — Token Auto-Refresh

**Use Case ID:** UC-3
**Actor:** System (Extension Timer)
**Preconditions:** User authenticated, JWT stored in SecretStorage, refresh token valid
**Postconditions:** New JWT stored, user remains authenticated

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Extension timer fires at (JWT expiry - 5 min) | Scheduled check |
| 2 | | Extension reads refresh_token from SecretStorage | Retrieve credential |
| 3 | | Extension calls POST /api/auth/refresh | Body: {refresh_token} |
| 4 | | Backend validates refresh token (not revoked, not expired) | Check sessions table |
| 5 | | Backend issues new JWT (1h) + optionally rotates refresh token | Token renewal |
| 6 | | Extension stores new JWT in SecretStorage | Replace old token |
| 7 | | Extension resets refresh timer for new expiry | Schedule next refresh |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | Multiple tabs/windows open | Only one instance refreshes (mutex via SecretStorage key lock) |
| AF-2 | IDE was suspended (laptop sleep) | On wake, immediately check expiry → refresh if needed |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Refresh token expired (7d) | 401 from Backend → show Login Webview → user re-authenticates |
| EF-2 | Refresh token revoked (logout elsewhere) | 401 from Backend → show Login Webview |
| EF-3 | Network error during refresh | Retry once after 30s → if still fails, show Login Webview |

---

### 3.4 Feature: Personal User KB (Tier 1)

**Source:** BRD Story 4

#### 3.4.1 Description

Every knowledge ingestion defaults to Tier 1 (User KB), which is personal and isolated. Only the owning user can see, search, or modify their entries. Entries have configurable TTL (default 7 days) with auto-cleanup.

#### 3.4.2 Use Case: UC-4 — Ingest to User KB

**Use Case ID:** UC-4
**Actor:** Developer
**Preconditions:** User authenticated
**Postconditions:** Knowledge entry stored in User KB with TTL

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Calls mem_ingest (no tier specified) | | Default behavior |
| 2 | | Extension forwards to Backend with Bearer token | POST /mcp/tools/call |
| 3 | | Backend extracts userId from JWT | Identity resolution |
| 4 | | Backend stores entry: tier=1, owner_id=userId | Insert into kb_entries |
| 5 | | Backend computes embedding vector | ONNX model inference |
| 6 | | Backend sets TTL = user preference (default 7d) | created_at + ttl_days |
| 7 | | Backend returns success with entry ID | Confirmation |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | User explicitly specifies tier=1 | Same as main flow (explicit confirmation) |
| AF-2 | User specifies tier=2 (project) | Route to UC-5 instead |
| AF-3 | User sets TTL=0 (no expiry) | Entry persists until manual delete |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Content empty or too short (<10 chars) | Return error "Content too short for meaningful knowledge entry" |
| EF-2 | User KB at capacity (10,000 entries) | Return error "User KB full. Delete old entries or promote to Project KB." |

---

### 3.5 Feature: Project KB (Tier 2)

**Source:** BRD Story 5

#### 3.5.1 Description

Project KB is shared among all members of a project (determined by JWT `projects[]` claim). Content is permanent (no TTL). Any project member can directly ingest or read. Entries promoted from User KB are linked via `promoted_from` reference.

#### 3.5.2 Use Case: UC-5 — Ingest to Project KB

**Use Case ID:** UC-5
**Actor:** Developer (Project Member)
**Preconditions:** User authenticated, user is member of at least one project
**Postconditions:** Entry stored in Project KB, visible to all project members

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Calls mem_ingest with tier=2, project=projectId | | Explicit project ingest |
| 2 | | Backend verifies userId belongs to projectId | Check JWT projects[] claim |
| 3 | | Backend stores entry: tier=2, project_id=projectId | Insert into kb_entries |
| 4 | | Backend computes embedding, sets quality_score | ONNX + scoring algorithm |
| 5 | | Backend returns success | Entry ID + tier confirmation |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | User belongs to multiple projects, no project specified | Return error requesting project specification |
| AF-2 | Entry promoted from User KB (auto-promotion) | Automated: system creates copy in tier=2 with promoted_from link |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | User not member of specified project | 403 "You are not a member of project {projectId}" |
| EF-2 | Project KB at capacity (100,000 entries) | Error "Project KB full. Contact admin." |

---

### 3.6 Feature: Shared KB (Tier 3)

**Source:** BRD Story 6

#### 3.6.1 Description

Shared KB is visible to ALL authenticated users. Only admins can directly ingest. Content auto-promotes from Project KB when referenced by 3+ projects or tagged "best-practice". Read-only for non-admin users.

#### 3.6.2 Use Case: UC-6 — Admin Ingest to Shared KB

**Use Case ID:** UC-6
**Actor:** Admin
**Preconditions:** User authenticated with role=admin
**Postconditions:** Entry stored in Shared KB, visible to all authenticated users

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Admin calls mem_ingest with tier=3 | | Requires admin role |
| 2 | | Backend verifies role=admin from JWT | Authorization check |
| 3 | | Backend stores entry: tier=3 | Insert into kb_entries |
| 4 | | Backend computes embedding, quality_score | ONNX + scoring |
| 5 | | Backend returns success | Visible to all users |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Non-admin attempts tier=3 ingest | 403 "Only administrators can ingest directly to Shared KB" |

---

### 3.7 Feature: Auto-Promotion Between KB Tiers

**Source:** BRD Story 7

#### 3.7.1 Description

A background job evaluates promotion criteria every 30 minutes. Eligible entries are copied (not moved) to the next tier. The original remains with a "promoted" flag. Promotion is auditable and reversible by admin.

#### 3.7.2 Use Case: UC-7 — Auto-Promote User→Project

**Use Case ID:** UC-7
**Actor:** System (Background Job)
**Preconditions:** KB entries exist in User KB, promotion job scheduled
**Postconditions:** Qualifying entries copied to Project KB

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Background job triggers (every 30 min) | Scheduled task |
| 2 | | Query all User KB entries not yet promoted | WHERE tier=1 AND promoted=false |
| 3 | | For each entry, evaluate criteria: | Three-condition check |
| 3a | | - quality_score > 0.8 | Quality threshold |
| 3b | | - tag contains "project-relevant" | Relevance tag |
| 3c | | - reviewed_by has at least 1 team member | Peer review check |
| 4 | | If ALL criteria met: create copy in tier=2 | New entry with promoted_from link |
| 5 | | Mark original entry promoted=true | Prevent re-evaluation |
| 6 | | Log promotion event (who, when, why) | Audit trail |

**Use Case: UC-8 — Auto-Promote Project→Shared**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Background job triggers (every 30 min) | Same scheduler |
| 2 | | Query all Project KB entries not yet promoted | WHERE tier=2 AND promoted=false |
| 3 | | For each entry, evaluate criteria (ANY one): | OR-condition check |
| 3a | | - referenced_by_projects.count >= 3 | Cross-project usage |
| 3b | | - tag contains "best-practice" | Admin-flagged quality |
| 3c | | - admin_promoted = true | Explicit admin action |
| 4 | | If ANY criterion met: create copy in tier=3 | Copy to Shared KB |
| 5 | | Mark original promoted=true | Prevent re-evaluation |
| 6 | | Log promotion event | Audit trail |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | Admin manually promotes via POST /api/kb/promote | Immediate promotion (skip wait for background job) |
| AF-2 | Admin reverses promotion (demote) | Delete copy from target tier, reset promoted flag on source |

---

### 3.8 Feature: MCP Server Configuration Page

**Source:** BRD Story 8

#### 3.8.1 Description

A Webview-based configuration UI allows users to set credentials/URLs for each MCP child server (Jira, DrawIO, Export). Configuration is per-user (isolated by JWT userId) and stored encrypted in the Backend database.

#### 3.8.2 Use Case: UC-9 — Configure MCP Servers

**Use Case ID:** UC-9
**Actor:** Developer
**Preconditions:** User authenticated, Backend running
**Postconditions:** MCP server credentials saved, subsequent tool calls use new credentials

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Opens "Code Intel: Configure MCP Servers" (command palette) | | Triggers config page |
| 2 | | Extension opens MCP Config Webview | Tab-based form (Jira/DrawIO/Export) |
| 3 | | Extension calls GET /api/config/mcp-servers | Fetch existing config |
| 4 | | Backend returns user config (passwords masked) | Sensitive fields: "configured" flag only |
| 5 | | Extension pre-fills form with existing values | Passwords shown as "••••••••" |
| 6 | Modifies fields (URL, username, token) | | User edits form |
| 7 | Clicks "Save" | | Submit changes |
| 8 | | Extension validates inputs (URL format, required fields) | Client-side validation |
| 9 | | Extension calls PUT /api/config/mcp-servers | Body: updated config object |
| 10 | | Backend encrypts sensitive fields (AES-256) | Encryption at rest |
| 11 | | Backend stores per-user config | Keyed by userId from JWT |
| 12 | | Backend returns 200 OK | Save confirmation |
| 13 | | Extension shows success notification | "Configuration saved" |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | User clicks "Test Connection" for Jira | Extension calls POST /api/config/mcp-servers/test {server:"jira"} → Backend attempts Jira API call → returns success/failure |
| AF-2 | User clicks "Reset" | Form reverts to last saved values (re-fetch from Backend) |
| AF-3 | No existing config (first time) | Form shows empty with placeholders |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Test Connection fails | Show "Connection failed: {error}. Check URL and credentials." |
| EF-2 | Save fails (Backend down) | Show "Could not save configuration. Backend unavailable." |
| EF-3 | Invalid URL format | Client-side: "Please enter a valid URL (https://...)" |
| EF-4 | Required field missing | Client-side: disable Save button, highlight missing field |

---

### 3.9 Feature: Secure Logout

**Source:** BRD Story 9

#### 3.9.1 Description

Logout clears all authentication state from both client (SecretStorage) and server (session revocation). Post-logout, the Extension returns to unauthenticated state and shows the Login Webview.

#### 3.9.2 Use Case: UC-10 — Logout

**Use Case ID:** UC-10
**Actor:** Developer
**Preconditions:** User currently authenticated
**Postconditions:** Tokens cleared, session revoked, Login Webview shown

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Executes "Code Intel: Logout" (command palette or status bar) | | Triggers logout |
| 2 | | Extension calls POST /api/auth/logout | Body: {refresh_token} |
| 3 | | Backend revokes refresh token in sessions table | Mark as revoked |
| 4 | | Backend returns 200 OK | Confirmation |
| 5 | | Extension clears JWT from SecretStorage | Remove access_token key |
| 6 | | Extension clears refresh token from SecretStorage | Remove refresh_token key |
| 7 | | Extension clears cached user data (KB entries in memory) | Clean local state |
| 8 | | Extension stops auto-refresh timer | Cancel scheduled refresh |
| 9 | | Extension opens Login Webview | Return to unauthenticated state |
| 10 | | Extension updates status bar to "Not Authenticated" | Visual indicator |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Backend unreachable during logout | Still clear local tokens (SecretStorage) → show Login Webview. Server-side token will expire naturally (1h). |

---

### 3.10 Feature: Unified KB Search Across Tiers

**Source:** BRD Story 10

#### 3.10.1 Description

`mem_search` queries all accessible tiers simultaneously, merges results by combined relevance score (semantic similarity × tier boost), and deduplicates. Each result includes a tier badge indicating its source.

#### 3.10.2 Use Case: UC-11 — Multi-Tier KB Search

**Use Case ID:** UC-11
**Actor:** Developer
**Preconditions:** User authenticated, KB entries exist
**Postconditions:** Merged, ranked, deduplicated results returned

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Calls mem_search(query) | | Search request |
| 2 | | Backend extracts userId + projects[] from JWT | Determine access scope |
| 3 | | Backend queries User KB: owner_id=userId | Personal entries |
| 4 | | Backend queries Project KB: project_id IN user's projects | Team entries |
| 5 | | Backend queries Shared KB: all tier=3 entries | Company entries |
| 6 | | Backend computes semantic similarity for each result | Cosine similarity with query embedding |
| 7 | | Backend applies tier boost: User×1.2, Project×1.0, Shared×0.9 | Weighted ranking |
| 8 | | Backend deduplicates (same content in multiple tiers → keep highest tier) | Content hash comparison |
| 9 | | Backend sorts by combined score descending | Final ranking |
| 10 | | Backend returns results with tier badges | [Personal] / [Project: name] / [Shared] |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | No results in one or more tiers | Return results from available tiers (empty tiers contribute nothing) |
| AF-2 | User specifies tier filter (search only Project KB) | Query only specified tier(s) |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Search exceeds 500ms timeout | Return partial results (whatever completed) with warning |
| EF-2 | Embedding model not loaded | Fallback to keyword/token search only |

![Sequence - KB Search](diagrams/sequence-kb-search.png)
*[Edit in draw.io](diagrams/sequence-kb-search.drawio)*

---

### 3.11 Business Rules

| Rule ID | Rule | Source | Applies To |
|---------|------|--------|------------|
| BR-1 | All /mcp/* and /api/* endpoints (except /health) require valid Bearer token | BRD §2.1 | All APIs |
| BR-2 | JWT signed with HS256, expiry = 1 hour | BRD Story 1 | Auth Module |
| BR-3 | Refresh token expiry = 7 days, revocable | BRD Story 3 | Auth Module |
| BR-4 | Account lockout after 5 failed login attempts, 15 min cooldown | BRD Story 1 | POST /api/auth/login |
| BR-5 | Passwords hashed with scrypt (N=16384, r=8, p=1, keyLen=64) | BRD §6 NFR | Users table |
| BR-6 | SSO requires PKCE (code_verifier + code_challenge) | BRD Story 2 | SSO flow |
| BR-7 | New SSO users auto-provisioned from IdP claims (email, name) | BRD Story 2 | UC-2 Step 13 |
| BR-8 | Token auto-refresh triggers at (expiry - 5 minutes) | BRD Story 3 | Extension timer |
| BR-9 | User KB (Tier 1): owner-only access, TTL default 7 days | BRD Story 4 | KB Module |
| BR-10 | Project KB (Tier 2): all project members can read/write, permanent | BRD Story 5 | KB Module |
| BR-11 | Shared KB (Tier 3): all authenticated users can read, admin-only write | BRD Story 6 | KB Module |
| BR-12 | User→Project promotion: quality_score>0.8 AND tag="project-relevant" AND reviewed_by≥1 | BRD Story 7 | Promotion Job |
| BR-13 | Project→Shared promotion: referenced_by≥3 OR tag="best-practice" OR admin_promoted | BRD Story 7 | Promotion Job |
| BR-14 | Promotion is non-destructive (copy, not move). Original marked promoted=true | BRD Story 7 | Promotion Job |
| BR-15 | Promotion background job runs every 30 minutes | BRD Story 7 | Scheduler |
| BR-16 | MCP config stored per-user, sensitive fields encrypted AES-256 at rest | BRD Story 8 | Config Module |
| BR-17 | GET /api/config/mcp-servers NEVER returns plaintext passwords/tokens | BRD Story 8 | Config API |
| BR-18 | Logout revokes refresh token server-side AND clears SecretStorage client-side | BRD Story 9 | Logout flow |
| BR-19 | Search tier boost factors: User=1.2, Project=1.0, Shared=0.9 | BRD Story 10 | Search |
| BR-20 | Search deduplication: same content in multiple tiers → show highest-tier version | BRD Story 10 | Search |
| BR-21 | Multi-tier search must complete within 500ms | BRD §6 NFR | Search |
| BR-22 | User A cannot access User B's Tier 1 entries under any circumstance | BRD Story 4 | KB isolation |
| BR-23 | User KB capacity: max 10,000 entries per user | BRD §6 NFR | KB Module |
| BR-24 | Project KB capacity: max 100,000 entries per project | BRD §6 NFR | KB Module |
| BR-25 | Shared KB capacity: max 50,000 entries | BRD §6 NFR | KB Module |
| BR-26 | SSO callback timeout: 30 seconds | BRD Story 2 | SSO flow |
| BR-27 | SSO allowed domains configured in Backend (reject unlisted domains) | BRD Story 2 | SSO validation |
| BR-28 | Concurrent users supported: up to 100 | BRD §6 NFR | System-wide |
| BR-29 | Auth failure does NOT block IDE — Extension remains active, tools unavailable | BRD §6 NFR | Extension |

---

## 4. Data Model

### 4.1 Entity Relationship Diagram

![ER Diagram](diagrams/er-diagram.png)
*[Edit in draw.io](diagrams/er-diagram.drawio)*

### 4.2 Logical Entities

#### Entity: users

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| id | UUID | Yes | — | Primary key, unique user identifier |
| username | VARCHAR(100) | Yes | — | Login identifier (alphanumeric + dots + underscores) |
| email | VARCHAR(255) | Yes | — | User email (unique, used for SSO matching) |
| display_name | VARCHAR(255) | No | — | Human-readable name |
| password_hash | VARCHAR(255) | No | BR-5 | scrypt hash (null for SSO-only users) |
| role | VARCHAR(20) | Yes | BR-11 | "user" or "admin" |
| sso_provider | VARCHAR(100) | No | BR-7 | OIDC issuer if SSO-provisioned |
| sso_subject | VARCHAR(255) | No | BR-7 | IdP subject claim (sub) |
| projects | JSON | Yes | BR-10 | Array of project IDs user belongs to |
| failed_attempts | INTEGER | Yes | BR-4 | Current consecutive failed login count |
| locked_until | TIMESTAMP | No | BR-4 | Account lockout expiry (null if not locked) |
| created_at | TIMESTAMP | Yes | — | Account creation time |
| updated_at | TIMESTAMP | Yes | — | Last modification time |

#### Entity: sessions

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| id | UUID | Yes | — | Primary key |
| user_id | UUID (FK→users) | Yes | — | Session owner |
| refresh_token | VARCHAR(255) | Yes | BR-3 | Hashed refresh token |
| issued_at | TIMESTAMP | Yes | — | Token issue time |
| expires_at | TIMESTAMP | Yes | BR-3 | Refresh token expiry (7d from issue) |
| revoked | BOOLEAN | Yes | BR-18 | True if logout/admin revoked |
| revoked_at | TIMESTAMP | No | BR-18 | When token was revoked |
| user_agent | VARCHAR(500) | No | — | Client identifier for session tracking |

#### Entity: kb_entries

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| id | UUID | Yes | — | Primary key |
| tier | INTEGER | Yes | BR-9,10,11 | 1=User, 2=Project, 3=Shared |
| owner_id | UUID (FK→users) | Yes | BR-22 | Entry creator (isolation key for Tier 1) |
| project_id | UUID | No | BR-10 | Associated project (required for Tier 2) |
| content | TEXT | Yes | — | Knowledge content (full text) |
| embedding | BLOB | Yes | — | Vector embedding (384-dim float32) |
| tags | JSON | No | BR-12,13 | Array of classification tags |
| quality_score | REAL | No | BR-12 | Quality metric 0.0–1.0 |
| ttl_days | INTEGER | No | BR-9 | Days before auto-delete (Tier 1 only) |
| promoted | BOOLEAN | Yes | BR-14 | True if promoted to higher tier |
| promoted_from | UUID (FK→kb_entries) | No | BR-14 | Source entry ID (null if original) |
| promoted_by | UUID (FK→users) | No | BR-14 | Who reviewed/approved promotion |
| referenced_by_projects | JSON | No | BR-13 | Array of project IDs that referenced this entry |
| reviewed_by | JSON | No | BR-12 | Array of user IDs who peer-reviewed this entry (required for Tier 1→2 promotion) |
| created_at | TIMESTAMP | Yes | — | Creation time |
| updated_at | TIMESTAMP | Yes | — | Last modification |

#### Entity: mcp_config

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| id | UUID | Yes | — | Primary key |
| user_id | UUID (FK→users) | Yes | BR-16 | Config owner (per-user isolation) |
| server_name | VARCHAR(50) | Yes | — | "jira", "drawio", "export" |
| config_data | TEXT | Yes | BR-16 | JSON config (sensitive fields AES-256 encrypted) |
| created_at | TIMESTAMP | Yes | — | First save time |
| updated_at | TIMESTAMP | Yes | — | Last modification |

#### Entity: sso_config

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| id | UUID | Yes | — | Primary key |
| issuer_url | VARCHAR(500) | Yes | BR-6 | OIDC issuer URL |
| client_id | VARCHAR(255) | Yes | BR-6 | OAuth2 client ID |
| allowed_domains | JSON | Yes | BR-27 | Array of allowed email domains |
| redirect_uri | VARCHAR(500) | Yes | — | Callback URL |
| enabled | BOOLEAN | Yes | — | SSO active/inactive flag |
| created_at | TIMESTAMP | Yes | — | Configuration time |

**Relationships:**

| From Entity | To Entity | Cardinality | Description |
|-------------|-----------|-------------|-------------|
| users | sessions | 1:N | User has multiple sessions (devices/instances) |
| users | kb_entries | 1:N | User owns multiple KB entries |
| users | mcp_config | 1:N | User has config per MCP server (max 3) |
| kb_entries | kb_entries | 1:1 | promoted_from self-reference for promotion chain |

---

## 5. Integration Specifications

### 5.1 External System: Identity Provider (OIDC)

| Attribute | Value |
|-----------|-------|
| Purpose | Authenticate users via corporate identity (SSO) |
| Direction | Outbound (Backend → IdP) |
| Data Format | JSON (OIDC tokens + discovery document) |
| Frequency | On-demand (per SSO login attempt) |
| Protocol | HTTPS |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| code_challenge (PKCE) | authorization_code | Send/Receive | BR-6 |
| code_verifier | access_token + id_token | Send/Receive | BR-6 |
| — | email, name, sub (claims) | Receive | BR-7 |

### 5.2 External System: VS Code SecretStorage

| Attribute | Value |
|-----------|-------|
| Purpose | OS-encrypted storage for JWT and refresh tokens |
| Direction | Bidirectional (Extension ↔ OS keychain) |
| Data Format | String key-value pairs |
| Frequency | On auth events (login, refresh, logout) |

**Data Exchange:**

| Our Data | Storage Key | Direction | Business Rule |
|----------|-------------|-----------|---------------|
| JWT access token | "codeintel.accessToken" | Read/Write | BR-8 |
| Refresh token | "codeintel.refreshToken" | Read/Write | BR-3 |
| User profile JSON | "codeintel.userProfile" | Read/Write | — |

### 5.3 External System: Child MCP Servers (Jira, DrawIO, Export)

| Attribute | Value |
|-----------|-------|
| Purpose | Execute domain-specific tools using per-user credentials |
| Direction | Outbound (Backend → Child Servers via stdio) |
| Data Format | JSON-RPC 2.0 |
| Frequency | On-demand (per tool call) |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| User's Jira credentials (from mcp_config) | Jira API responses | Send/Receive | BR-16 |
| User's DrawIO CLI path | Export results | Send | BR-16 |
| User's Export config | Generated files | Send/Receive | BR-16 |

---

## 6. Processing Logic

### 6.1 Token Refresh Process

**Trigger:** Timer fires at JWT_expiry - 5 minutes
**Schedule:** Continuous (active while Extension running and user authenticated)
**Input:** refresh_token from SecretStorage
**Output:** New JWT stored in SecretStorage

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Read refresh_token from SecretStorage | If missing → show Login Webview |
| 2 | POST /api/auth/refresh {refresh_token} | If network error → retry once in 30s |
| 3 | Backend validates: token not revoked, not expired | If invalid → 401 → show Login Webview |
| 4 | Backend generates new JWT (1h expiry) | — |
| 5 | Backend optionally rotates refresh token | If rotated, return new refresh_token |
| 6 | Extension stores new JWT (+ new refresh if rotated) | If SecretStorage fails → log error, retry |
| 7 | Reset timer for new JWT's expiry - 5 min | — |

### 6.2 KB TTL Cleanup Process

**Trigger:** Background job
**Schedule:** Every 1 hour
**Input:** All Tier 1 entries with ttl_days > 0
**Output:** Expired entries deleted

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Query: SELECT * FROM kb_entries WHERE tier=1 AND ttl_days>0 AND created_at + ttl_days < NOW() | If DB error → retry next cycle |
| 2 | For each expired entry: DELETE from kb_entries | Log each deletion |
| 3 | Update embeddings index (remove deleted vectors) | Rebuild incrementally |
| 4 | Log summary: "Cleaned {n} expired User KB entries" | — |

### 6.3 Auto-Promotion Process

**Trigger:** Background job
**Schedule:** Every 30 minutes (BR-15)
**Input:** Non-promoted entries in Tier 1 and Tier 2
**Output:** Promoted copies in higher tiers

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | **Tier 1 → Tier 2 scan:** Query tier=1, promoted=false entries | Skip on error, retry next cycle |
| 2 | For each: check quality_score > 0.8 | Skip entries below threshold |
| 3 | Check tags contains "project-relevant" | Skip entries without tag |
| 4 | Check reviewed_by array has ≥ 1 entry | Skip unreviewed entries |
| 5 | If ALL criteria met: INSERT copy into tier=2 with promoted_from link | On insert error → log, continue with next |
| 6 | UPDATE original: promoted=true | — |
| 7 | **Tier 2 → Tier 3 scan:** Query tier=2, promoted=false entries | Same error handling |
| 8 | For each: check referenced_by_projects.length ≥ 3 OR tags contains "best-practice" OR admin_promoted=true | — |
| 9 | If ANY criterion met: INSERT copy into tier=3 | On insert error → log, continue |
| 10 | UPDATE original: promoted=true | — |
| 11 | Log summary: "Promoted {n} entries: {x} User→Project, {y} Project→Shared" | — |

### 6.4 Multi-Tier Search Process

**Trigger:** mem_search tool call
**Schedule:** On-demand
**Input:** Search query string + user JWT (userId, projects[])
**Output:** Merged, ranked, deduplicated result list

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Compute embedding for search query | If ONNX fails → fallback to keyword search |
| 2 | Query Tier 1: cosine_similarity(query_embedding, entry.embedding) WHERE owner_id=userId | Return empty if error |
| 3 | Query Tier 2: same similarity WHERE project_id IN user's projects[] | Return empty if error |
| 4 | Query Tier 3: same similarity (all entries) | Return empty if error |
| 5 | Apply tier boost: score × 1.2 (Tier1), × 1.0 (Tier2), × 0.9 (Tier3) | — |
| 6 | Merge all results into single list | — |
| 7 | Deduplicate: group by content_hash, keep highest-tier version | — |
| 8 | Sort by boosted score descending | — |
| 9 | Limit to top N results (default 10) | — |
| 10 | Attach tier badge: [Personal] / [Project: name] / [Shared] | — |
| 11 | Return results within 500ms SLA | If timeout → return partial results |

---

## 7. Security Requirements

### 7.1 Authentication & Authorization

| Role | Permissions | Features |
|------|-------------|----------|
| user | Read/write own User KB, read/write Project KB (own projects), read Shared KB, manage own MCP config | All except admin functions |
| admin | All user permissions + write to Shared KB + promote/demote entries + manage SSO config + view all users | Admin panel, promotion management |

### 7.2 Data Sensitivity Classification

| Data Type | Classification | Business Requirement |
|-----------|---------------|---------------------|
| Passwords (user login) | Restricted | Stored as bcrypt hash only, never in logs or responses |
| JWT tokens | Confidential | Short-lived (1h), stored in SecretStorage, transmitted only via HTTPS-equivalent localhost |
| Refresh tokens | Confidential | Stored hashed in DB, revocable, 7-day expiry |
| MCP credentials (Jira tokens) | Restricted | AES-256 encrypted at rest, never returned in plaintext via API |
| User KB content | Internal | Owner-only access, TTL auto-cleanup |
| Project KB content | Internal | Project-member access only |
| Shared KB content | Internal | All authenticated users |
| SSO client_id | Confidential | Backend-only, not exposed to Extension |
| PKCE code_verifier | Confidential | Single-use, generated per flow, never stored persistently |

### 7.3 Audit Trail

| Event | Logged Fields | Retention | Business Reason |
|-------|--------------|-----------|-----------------|
| Login success | userId, timestamp, method (local/SSO), IP | 90 days | Security monitoring |
| Login failure | username attempted, timestamp, IP, reason | 90 days | Brute-force detection |
| Account lockout | username, lockout_until, failed_count | 90 days | Security incident tracking |
| Logout | userId, timestamp | 30 days | Session management |
| KB promotion | entry_id, from_tier, to_tier, triggered_by, criteria_met | Permanent | Knowledge governance |
| KB deletion (TTL) | entry_id, owner_id, age_days | 30 days | Data lifecycle tracking |
| MCP config change | userId, server_name, timestamp (NOT credentials) | 90 days | Configuration audit |
| Token refresh | userId, timestamp | 7 days | Access monitoring |

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | Local login feels instant | Complete in < 3 seconds end-to-end |
| Performance | SSO login depends on IdP | Complete within 30 seconds (Extension timeout) |
| Performance | Token refresh is invisible | Complete in < 500ms, no user interaction |
| Performance | KB search returns fast results | All 3 tiers queried + merged in < 500ms |
| Performance | MCP Config save is responsive | Database write in < 1 second |
| Availability | Auth failure doesn't crash IDE | Extension remains active, shows Login Webview |
| Availability | Backend restart doesn't lose sessions | Refresh tokens in DB survive restart |
| Scalability | Concurrent users | Support 100 simultaneous authenticated users |
| Scalability | User KB per user | Up to 10,000 entries per user |
| Scalability | Project KB per project | Up to 100,000 entries per project |
| Scalability | Shared KB total | Up to 50,000 entries system-wide |
| Security | Token lifetime | JWT: 1h, Refresh: 7d (configurable by admin) |
| Security | Password strength | bcrypt cost=12, minimum 8 characters |
| Security | Encryption at rest | MCP credentials AES-256 encrypted in SQLite |
| Security | Brute-force protection | 5 attempts → 15 min lockout |
| Security | PKCE mandatory | All OAuth2 flows require PKCE |
| Reliability | Token expiry handling | Graceful degradation → Login Webview, never hang |
| Reliability | KB tier isolation | Database-level enforcement, not API-only |
| Compatibility | OIDC providers supported | Google, Azure AD, Okta, Keycloak (standard OIDC) |
| Compatibility | VS Code version | >= 1.85.0 (SecretStorage API available) |

---

## 9. Error Handling (User-Facing)

### 9.1 Error Scenarios

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| Invalid credentials | Warning | "Invalid username or password." | Stay on Login Webview, clear password field |
| Account locked | Warning | "Account locked. Try again in {minutes} minutes." | Disable Login button, show countdown |
| Backend unreachable | Critical | "Cannot connect to Backend. Please ensure the server is running." | Show retry button, check Backend health |
| SSO provider unavailable | Warning | "SSO provider unavailable. Please try local login or contact admin." | Show local login option |
| SSO callback timeout | Warning | "SSO login timed out. Please try again." | Return to Login Webview with SSO button |
| SSO domain rejected | Warning | "Your organization is not configured for SSO access." | Show contact admin message |
| Token refresh failed | Warning | "Session expired. Please log in again." | Show Login Webview |
| KB ingest — content too short | Info | "Content too short for meaningful knowledge entry (min 10 chars)." | Reject ingest, no side effects |
| KB ingest — capacity full | Warning | "KB storage full. Delete old entries or promote to higher tier." | Suggest cleanup actions |
| KB search timeout | Info | "Search is taking longer than expected. Partial results shown." | Return available results |
| MCP Config — invalid URL | Info | "Please enter a valid URL (https://...)" | Highlight field, disable Save |
| MCP Config — test connection failed | Warning | "Connection failed: {specific error}. Check URL and credentials." | Show error details |
| MCP Config — save failed | Warning | "Could not save configuration. Backend unavailable." | Retry button |
| Unauthorized request (expired token) | Warning | "Session expired. Please log in again." | Trigger re-auth flow |
| Permission denied (wrong tier) | Warning | "You do not have permission to perform this action." | Explain required permission |
| Server internal error | Critical | "An unexpected error occurred. Please try again later." | Log error, show retry |

### 9.2 Error Codes

| Code | HTTP Status | Meaning | Recovery Action |
|------|-------------|---------|-----------------|
| AUTH_INVALID_CREDENTIALS | 401 | Wrong username/password | Re-enter credentials |
| AUTH_ACCOUNT_LOCKED | 403 | Too many failed attempts | Wait for lockout period |
| AUTH_TOKEN_EXPIRED | 401 | JWT past expiry | Refresh or re-login |
| AUTH_REFRESH_INVALID | 401 | Refresh token revoked/expired | Re-login required |
| AUTH_SSO_TIMEOUT | 408 | IdP callback not received in 30s | Retry SSO flow |
| AUTH_SSO_DOMAIN_REJECTED | 403 | Email domain not in allowed list | Contact admin |
| AUTH_SSO_PROVIDER_ERROR | 502 | IdP returned error | Try local login |
| KB_CONTENT_TOO_SHORT | 422 | Content < 10 characters | Provide longer content |
| KB_CAPACITY_EXCEEDED | 507 | Tier at max entries | Delete entries or promote |
| KB_ACCESS_DENIED | 403 | Accessing other user's KB | Use own KB or Shared |
| KB_PROJECT_NOT_MEMBER | 403 | User not in specified project | Join project or use correct project |
| CONFIG_INVALID_URL | 422 | URL format validation failed | Fix URL format |
| CONFIG_TEST_FAILED | 502 | Test connection unsuccessful | Check credentials/URL |
| CONFIG_SAVE_FAILED | 500 | Backend storage error | Retry later |
| BACKEND_UNAVAILABLE | 503 | Backend not responding | Start Backend, retry |

### 9.3 Notification Requirements

| Event | Who is Notified | Channel | Timing |
|-------|----------------|---------|--------|
| Login success | Current user | Status bar update | Immediate |
| Login failure | Current user | Webview error message | Immediate |
| Account lockout | Current user + audit log | Webview message + log entry | Immediate |
| Token refresh success | None (silent) | — | Background |
| Token refresh failure | Current user | Login Webview appears | Immediate |
| KB entry promoted | Entry owner | VS Code notification (info) | On next search or within 5 min |
| KB TTL deletion warning | Entry owner | VS Code notification (warning) | 24h before deletion |
| MCP Config saved | Current user | Webview success toast | Immediate |

---

## 10. Testing Considerations

### 10.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-1 | Valid local login | username:"john", password:"valid123" | JWT returned, stored in SecretStorage, status bar updated | High |
| TC-2 | Invalid password | username:"john", password:"wrong" | 401 error, "Invalid username or password." shown | High |
| TC-3 | Account lockout after 5 failures | 5× wrong password | 403, "Account locked" message, lockout 15 min | High |
| TC-4 | SSO login happy path | Click SSO → authenticate with IdP | JWT returned via callback, auto-provisioned user | High |
| TC-5 | SSO timeout | Click SSO → no callback in 30s | Timeout error, return to Login Webview | Medium |
| TC-6 | Token auto-refresh | Wait until expiry-5min | New JWT stored silently, no user interruption | High |
| TC-7 | Refresh token expired | Wait 7 days, attempt refresh | 401, Login Webview shown | High |
| TC-8 | Ingest to User KB (default) | mem_ingest("test content") | Entry stored tier=1, owner=current user | High |
| TC-9 | Search across tiers | mem_search("auth") with entries in all 3 tiers | Merged results, correct tier badges, sorted by score | High |
| TC-10 | User A cannot see User B's KB | User B searches for User A's content | Zero results from User A's tier 1 | Critical |
| TC-11 | Project KB access for member | Project member searches project KB | Results returned for their project | High |
| TC-12 | Project KB denied for non-member | Non-member ingests to foreign project | 403 error | High |
| TC-13 | Auto-promotion User→Project | Entry with score>0.8, tagged, reviewed | Promoted within 30 min cycle | Medium |
| TC-14 | Auto-promotion Project→Shared | Entry referenced by 3+ projects | Promoted within 30 min cycle | Medium |
| TC-15 | MCP Config save and retrieve | Set Jira URL + token, save, re-open page | Config persisted, password masked | High |
| TC-16 | MCP Config test connection | Valid Jira credentials | "Connection successful" | Medium |
| TC-17 | Logout clears everything | Execute logout command | SecretStorage empty, Login Webview shown, 401 on next request | High |
| TC-18 | Search performance | Large KB (5000 entries across tiers) | Results returned in < 500ms | High |
| TC-19 | Concurrent users isolation | 2 users with same search | Each sees only their own User KB | Critical |
| TC-20 | PKCE flow security | Intercept auth code without verifier | Token exchange fails (PKCE enforcement) | High |

---

## 11. API Contracts (Functional View)

### 11.1 POST /api/auth/login

**Purpose:** Authenticate user with local credentials

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| username | string | Yes | — | User identifier (max 100 chars) |
| password | string | Yes | — | User password (8-128 chars) |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| access_token | string | JWT (HS256, 1h expiry) |
| refresh_token | string | Refresh token (7d expiry) |
| token_type | string | Always "Bearer" |
| expires_in | number | Seconds until access_token expires (3600) |
| user | object | {id, username, email, display_name, role, projects[]} |

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| Invalid credentials | "Invalid username or password." | bcrypt compare fails (BR-5) |
| Account locked | "Account locked. Try again in {N} minutes." | failed_attempts >= 5 (BR-4) |
| User not found | "Invalid username or password." | Same message (don't reveal user existence) |

---

### 11.2 POST /api/auth/sso/authorize

**Purpose:** Initiate SSO authorization flow, return authorization URL

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| code_challenge | string | Yes | BR-6 | base64url(SHA256(code_verifier)) |
| code_challenge_method | string | Yes | BR-6 | Always "S256" |
| redirect_uri | string | Yes | — | Callback URL for auth code |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| authorization_url | string | Full IdP authorization URL with PKCE params |
| state | string | CSRF protection token (stored in Backend) |

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| SSO not configured | "SSO is not configured for this instance." | sso_config.enabled = false |
| IdP discovery failed | "SSO provider unavailable." | Cannot fetch .well-known/openid-configuration |

---

### 11.3 POST /api/auth/sso/callback

**Purpose:** Handle IdP callback, exchange code for tokens

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| code | string | Yes | BR-6 | Authorization code from IdP |
| state | string | Yes | — | Must match stored state (CSRF) |
| code_verifier | string | Yes | BR-6 | Original PKCE verifier |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| access_token | string | JWT (same format as local auth) |
| refresh_token | string | Refresh token |
| token_type | string | "Bearer" |
| expires_in | number | 3600 |
| user | object | User profile (auto-provisioned if new) |
| is_new_user | boolean | True if user was just auto-provisioned |

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| Invalid state | "Authentication failed. Please try again." | State mismatch (possible CSRF) |
| Code exchange failed | "SSO authentication failed." | IdP rejects code+verifier |
| Domain not allowed | "Your organization is not configured for SSO access." | Email domain not in allowed_domains (BR-27) |

---

### 11.4 POST /api/auth/refresh

**Purpose:** Exchange refresh token for new access token

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| refresh_token | string | Yes | BR-3 | Valid, non-revoked refresh token |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| access_token | string | New JWT (1h expiry) |
| refresh_token | string | Optionally rotated refresh token |
| token_type | string | "Bearer" |
| expires_in | number | 3600 |

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| Token revoked | "Session expired. Please log in again." | sessions.revoked = true (BR-18) |
| Token expired | "Session expired. Please log in again." | Past 7-day expiry (BR-3) |
| Token not found | "Invalid session." | No matching session in DB |

---

### 11.5 POST /api/auth/logout

**Purpose:** Revoke refresh token and end session

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| refresh_token | string | Yes | BR-18 | Token to revoke |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Always true if request processed |
| message | string | "Logged out successfully" |

---

### 11.6 GET /api/auth/me

**Purpose:** Return current authenticated user's profile

**Input Parameters:** None (user identified by Bearer token)

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | User ID |
| username | string | Login name |
| email | string | Email address |
| display_name | string | Human name |
| role | string | "user" or "admin" |
| projects | array | Project IDs and names |
| auth_method | string | "local" or "sso" |

---

### 11.7 POST /mcp/tools/call (with Auth Header)

**Purpose:** Execute MCP tool with authentication context

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| tool_name | string | Yes | — | Tool to execute (e.g., "mem_search") |
| arguments | object | Yes | — | Tool-specific arguments |
| _header_ Authorization | string | Yes | BR-1 | "Bearer {JWT}" |

**Output Data:** Same as KSA-284 tool call response (passthrough)

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| No auth header | "Authentication required." | Missing Authorization header (BR-1) |
| Invalid token | "Session expired. Please log in again." | JWT validation fails |
| Token expired | "Session expired. Please log in again." | JWT past expiry |

---

### 11.8 GET /api/config/mcp-servers

**Purpose:** Retrieve current user's MCP server configuration

**Input Parameters:** None (user from Bearer token)

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| servers | array | Array of server configs |
| servers[].name | string | "jira", "drawio", "export" |
| servers[].configured | boolean | Whether credentials are set |
| servers[].url | string | Server URL (if set) |
| servers[].username | string | Username (if set, for display) |
| servers[].has_token | boolean | Whether token/password is configured (never returns actual value, BR-17) |
| servers[].extra | object | Non-sensitive config (format, paths) |

---

### 11.9 PUT /api/config/mcp-servers

**Purpose:** Save MCP server configuration for current user

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| servers | array | Yes | BR-16 | Array of server config objects |
| servers[].name | string | Yes | — | Server name ("jira"/"drawio"/"export") |
| servers[].url | string | Conditional | — | Server URL (HTTPS for Jira) |
| servers[].username | string | Conditional | — | Username/email |
| servers[].token | string | Conditional | BR-16 | Password/API token (will be encrypted) |
| servers[].extra | object | No | — | Additional config (format, paths) |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Save confirmation |
| message | string | "Configuration saved successfully" |

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| Invalid URL format | "Please enter a valid URL (https://...)" | URL validation failed |
| Missing required field | "Jira username is required." | Required field empty |

---

### 11.10 POST /api/config/mcp-servers/test

**Purpose:** Test connectivity to an MCP server with provided credentials

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| server_name | string | Yes | — | "jira", "drawio", "export" |
| url | string | Yes | — | Server URL to test |
| username | string | Conditional | — | Credentials for test |
| token | string | Conditional | — | Token/password for test |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Connection test result |
| message | string | Success or error details |
| response_time_ms | number | How long the test took |

---

### 11.11 GET /api/kb/promote/status

**Purpose:** Get promotion status and pending candidates

**Input Parameters:** None

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| last_run | timestamp | Last promotion job execution time |
| next_run | timestamp | Next scheduled execution |
| pending_user_to_project | number | Entries eligible for User→Project promotion |
| pending_project_to_shared | number | Entries eligible for Project→Shared promotion |
| recent_promotions | array | Last 10 promotions with details |

---

### 11.12 POST /api/kb/promote

**Purpose:** Manually promote a KB entry (admin or entry owner)

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| entry_id | UUID | Yes | BR-14 | Entry to promote |
| target_tier | integer | Yes | — | 2 (Project) or 3 (Shared) |
| project_id | UUID | Conditional | — | Required if promoting to Tier 2 |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Promotion result |
| new_entry_id | UUID | ID of the new entry in target tier |
| message | string | Confirmation message |

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| Not authorized | "You cannot promote this entry." | Not owner (Tier1→2) or not admin (→Tier3) |
| Already promoted | "This entry has already been promoted." | promoted=true |
| Invalid tier transition | "Cannot promote directly from User to Shared." | Tier 1 → Tier 3 attempted |

---

## 12. Authentication State Machine

![Authentication State Machine](diagrams/state-auth.png)
*[Edit in draw.io](diagrams/state-auth.drawio)*

**States:**

| State | Description | Status Bar Display |
|-------|-------------|-------------------|
| UNAUTHENTICATED | No valid token, Login Webview shown | "Not Authenticated" (red) |
| AUTHENTICATING | Login in progress (local or SSO) | "Logging in..." (yellow) |
| AUTHENTICATED | Valid JWT, all APIs accessible | "Authenticated ({username})" (green) |
| REFRESHING | Token refresh in progress (background) | "Authenticated ({username})" (green, unchanged) |
| LOGGING_OUT | Logout in progress | "Logging out..." (yellow) |

**Transitions:**

| From | To | Trigger | Action |
|------|-----|---------|--------|
| UNAUTHENTICATED | AUTHENTICATING | User submits credentials / clicks SSO | Send auth request |
| AUTHENTICATING | AUTHENTICATED | Successful auth response | Store tokens, close Login, update status bar |
| AUTHENTICATING | UNAUTHENTICATED | Auth failed (invalid credentials, timeout) | Show error on Login Webview |
| AUTHENTICATED | REFRESHING | Timer fires (expiry - 5min) | Send refresh request |
| REFRESHING | AUTHENTICATED | New token received | Update SecretStorage, reset timer |
| REFRESHING | UNAUTHENTICATED | Refresh failed (revoked/expired) | Clear tokens, show Login Webview |
| AUTHENTICATED | LOGGING_OUT | User triggers logout | Send logout request |
| LOGGING_OUT | UNAUTHENTICATED | Logout complete | Clear all tokens, show Login Webview |
| AUTHENTICATED | UNAUTHENTICATED | 401 response from any API call | Clear tokens, show Login Webview |

---

## 13. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence — Local Auth | [sequence-auth-local.png](diagrams/sequence-auth-local.png) | [sequence-auth-local.drawio](diagrams/sequence-auth-local.drawio) |
| 3 | Sequence — SSO Auth | [sequence-auth-sso.png](diagrams/sequence-auth-sso.png) | [sequence-auth-sso.drawio](diagrams/sequence-auth-sso.drawio) |
| 4 | Sequence — KB Search | [sequence-kb-search.png](diagrams/sequence-kb-search.png) | [sequence-kb-search.drawio](diagrams/sequence-kb-search.drawio) |
| 5 | State — Authentication | [state-auth.png](diagrams/state-auth.png) | [state-auth.drawio](diagrams/state-auth.drawio) |
| 6 | ER Diagram | [er-diagram.png](diagrams/er-diagram.png) | [er-diagram.drawio](diagrams/er-diagram.drawio) |

### Change Log from BRD

- FSD adds formal Use Case IDs (UC-1 through UC-11) not present in BRD
- FSD adds Business Rule IDs (BR-1 through BR-29) consolidating requirements
- FSD specifies complete API contracts for all 12 endpoints
- FSD adds authentication state machine diagram
- FSD details processing logic for background jobs (TTL cleanup, auto-promotion)
- FSD adds error code table with HTTP status codes and recovery actions
- All requirements traced back to BRD Story references
