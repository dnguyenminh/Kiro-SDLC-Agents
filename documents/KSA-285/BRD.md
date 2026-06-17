# Business Requirements Document (BRD)

## Code Intelligence Extension — KSA-285: Authentication, Multi-Tenant KB, and MCP Server Configuration

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-285 |
| Title | Authentication, Multi-Tenant KB, and MCP Server Configuration |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Draft |
| Architecture Pattern | Plugin (IDE Extension) |
| Parent Ticket | KSA-284 (Split Extension: Lightweight Proxy + Backend MCP Server) |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | SA Agent – Solution Architect | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-14 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-285 |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

This change request adds three critical capabilities to the split architecture (KSA-284) of the Code Intelligence Extension:

1. **Authentication** — Enforce identity verification for all API/MCP interactions between Extension and Backend. Backend self-issues JWT (HS256) for standalone mode; delegates to external Identity Provider via OpenID Connect + PKCE when SSO is configured. The Extension provides a Login Webview, stores tokens securely in VS Code SecretStorage API, and auto-refreshes before expiry.

2. **Multi-Tenant 3-Tier Knowledge Base** — Transform the single-user KB into a hierarchical, multi-tenant system with three levels:
   - **USER KB** (short-term, personal) — session/days scope, current task context
   - **PROJECT KB** (long-term, cross-team) — permanent, API docs, architecture decisions, domain knowledge
   - **SHARED KB** (long-term, cross-company) — permanent, coding standards, best practices, reusable patterns
   
   With automatic promotion rules between tiers based on quality scoring, usage patterns, and review.

3. **MCP Server Configuration Page** — A Webview-based configuration UI in the Extension that allows users to personalize MCP server connection parameters (Jira credentials, DrawIO settings, Export server tokens) stored per-user in the Backend database.

### 1.2 Out of Scope

- External IdP setup/provisioning (customers configure their own IdP)
- Role-Based Access Control (RBAC) beyond KB tier visibility — all authenticated users are equal within their tier
- KB content moderation or manual curation workflows
- MCP server provisioning/deployment (only configuration of existing servers)
- Multi-machine Backend deployment (still single-machine per KSA-284)
- Custom KB schema extensions
- KB data export/import between tenants
- Audit logging of KB access (future ticket)

### 1.3 Preliminary Requirement

- KSA-284 split architecture MUST be implemented (Backend HTTP server running, Extension proxy functional)
- Backend database (SQLite) operational with user table support
- Extension Webview infrastructure functional (from KSA-284 Story 5)
- Backend health check endpoint available (Extension→Backend communication established)
- VS Code SecretStorage API accessible from Extension context

---

## 2. Business Requirements

### 2.1 High Level Process Map

Currently (post KSA-284), the Extension communicates with the Backend over localhost HTTP with **no authentication** — any local process could access the Backend APIs. The KB is a single flat store with no user separation, and MCP server credentials are stored in static configuration files.

KSA-285 transforms this into a secure, multi-tenant system:

**Authentication Flow:**
- Extension activates → checks for stored JWT in SecretStorage
- If valid JWT exists → attach to all requests → proceed normally
- If no JWT / expired → show Login Webview → user authenticates → Backend issues JWT → store in SecretStorage
- All subsequent requests include `Authorization: Bearer {token}` header
- Token auto-refreshes 5 minutes before expiry

**Multi-Tenant KB Flow:**
- User ingests knowledge → stored in USER KB (personal, ephemeral)
- Knowledge reaches quality threshold + tagged project-relevant + team review → auto-promotes to PROJECT KB
- Project KB knowledge referenced by 3+ projects OR admin-promoted → auto-promotes to SHARED KB
- Search merges results from all 3 tiers (USER > PROJECT > SHARED priority)

**MCP Configuration Flow:**
- User opens MCP Config page in Extension
- Extension fetches current config from Backend (`GET /api/config/mcp-servers`)
- User updates credentials/URLs for Jira, DrawIO, Export servers
- Extension saves config to Backend (`PUT /api/config/mcp-servers`)
- Backend stores per-user config in database
- Next MCP tool call uses updated credentials

> **Note:** Authentication is mandatory — there is NO anonymous mode. Every request to `/mcp/*` and `/api/*` requires a valid Bearer token.

![Business Flow](diagrams/business-flow.png)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a developer, I want to log in via username/password so that I can access the system securely | MUST HAVE | KSA-285 |
| 2 | As a developer, I want to log in via SSO (OpenID Connect) so that I can use my corporate identity | MUST HAVE | KSA-285 |
| 3 | As a developer, I want my JWT stored securely and auto-refreshed so that I stay authenticated without manual intervention | MUST HAVE | KSA-285 |
| 4 | As a developer, I want a personal User KB that only I can access so that my work-in-progress is private | MUST HAVE | KSA-285 |
| 5 | As a team member, I want a Project KB shared with my team so that we have a common knowledge repository | MUST HAVE | KSA-285 |
| 6 | As an organization member, I want a Shared KB with company-wide best practices so that all teams benefit | MUST HAVE | KSA-285 |
| 7 | As a developer, I want knowledge to auto-promote from User→Project→Shared based on quality and usage so that valuable knowledge propagates naturally | SHOULD HAVE | KSA-285 |
| 8 | As a developer, I want to configure MCP server credentials from a UI in my IDE so that I don't need to edit config files manually | MUST HAVE | KSA-285 |
| 9 | As a developer, I want to logout and have my token cleared so that another user on the same machine cannot access my data | MUST HAVE | KSA-285 |
| 10 | As a developer, I want KB search to merge results from all 3 tiers ranked by relevance so that I get the most useful answers | MUST HAVE | KSA-285 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Authentication:**

**Step 1:** Extension activates → retrieves JWT from VS Code SecretStorage

**Step 2:** If JWT valid (not expired) → attach `Authorization: Bearer {token}` to all Backend requests

**Step 3:** If JWT missing/expired → Extension opens Login Webview panel

**Step 4:** User enters credentials OR clicks "Login with SSO"

**Step 5a (Local Auth):** Extension sends `POST /api/auth/login` {username, password} → Backend validates → issues JWT (HS256) + refresh token

**Step 5b (SSO):** Extension opens OAuth2 authorization URL (PKCE) → user authenticates with IdP → callback with auth code → Extension sends code to Backend → Backend exchanges code for tokens with IdP → issues own JWT

**Step 6:** Extension stores JWT + refresh token in SecretStorage

**Step 7:** Auto-refresh: Extension schedules token refresh 5 minutes before expiry → `POST /api/auth/refresh` {refresh_token} → new JWT

**Step 8:** Logout: User clicks Logout → Extension calls `POST /api/auth/logout` → clears SecretStorage → shows Login Webview

**Multi-Tenant KB:**

**Step 1:** User calls `mem_ingest` → Backend identifies user from JWT → stores in USER KB (tier=1, owner=userId)

**Step 2:** Quality scoring runs periodically → if entry quality_score > 0.8 AND tagged "project-relevant" AND reviewed by team member → promote to PROJECT KB (tier=2, project=projectId)

**Step 3:** Cross-project usage detection: if PROJECT KB entry referenced by 3+ projects OR tagged "best-practice" OR admin-promoted → promote to SHARED KB (tier=3)

**Step 4:** User calls `mem_search` → Backend merges results from: USER KB (user's own) + PROJECT KB (user's project) + SHARED KB (all) → ranks by relevance + tier priority

**Step 5:** User A CANNOT see User B's USER KB entries. All project members CAN see PROJECT KB. All authenticated users CAN see SHARED KB.

**MCP Server Configuration:**

**Step 1:** User opens MCP Configuration page (command palette or sidebar icon)

**Step 2:** Extension fetches current config: `GET /api/config/mcp-servers` (with Bearer token)

**Step 3:** Backend returns user-specific config (username, token, URL per MCP server)

**Step 4:** User modifies fields (e.g., Jira username, password, URL)

**Step 5:** Extension sends: `PUT /api/config/mcp-servers` with updated config

**Step 6:** Backend stores config per-user in database (encrypted sensitive fields)

**Step 7:** Next `execute_dynamic_tool` call for Jira/DrawIO/Export uses updated credentials

---

#### STORY 1: Local Authentication (Username/Password)

> As a developer, I want to log in via username/password so that I can access the system securely.

**Requirement Details:**

1. Extension shows Login Webview with username and password fields
2. Backend exposes `POST /api/auth/login` endpoint
3. Backend validates credentials against local user store
4. On success: returns JWT (HS256, 1h expiry) + refresh token (7d expiry)
5. On failure: returns 401 with error message
6. Password stored as bcrypt hash in Backend database
7. Account lockout after 5 failed attempts (15 min cooldown)

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| username | string | Yes | User identifier | "john.doe" |
| password | string | Yes | User password (min 8 chars) | "••••••••" |

**Acceptance Criteria:**

1. Login Webview renders with username/password fields and "Login" button
2. Valid credentials → JWT returned → stored in SecretStorage → Webview closes → status bar shows "Authenticated"
3. Invalid credentials → error message displayed in Webview → no token stored
4. After 5 failed attempts → account locked → "Account locked" message shown
5. All `/mcp/*` and `/api/*` requests without valid Bearer token return 401

**UI Specifications:**

| No. | Name | Type | Required | Description | Note |
|-----|------|------|----------|-------------|------|
| 1 | Username | Input (text) | Yes | User identifier field | Placeholder: "Enter username" |
| 2 | Password | Input (password) | Yes | Password field with toggle visibility | Placeholder: "Enter password" |
| 3 | Login Button | Button (primary) | Yes | Submit credentials | Disabled until both fields filled |
| 4 | SSO Button | Button (secondary) | No | "Login with SSO" redirect | Only shown if SSO configured |
| 5 | Error Message | Alert (error) | No | Shows authentication errors | Red text below form |
| 6 | Loading Spinner | Spinner | No | Shows during auth request | Replaces Login button |

**Validation Rules:**

- Username: non-empty, max 100 chars, alphanumeric + dots + underscores
- Password: min 8 chars, max 128 chars

**Error Handling:**

- Network error (Backend unreachable): "Cannot connect to Backend. Please ensure the server is running."
- Invalid credentials: "Invalid username or password."
- Account locked: "Account locked. Try again in {minutes} minutes."
- Server error: "Authentication failed. Please try again later."

---

#### STORY 2: SSO Authentication (OpenID Connect + PKCE)

> As a developer, I want to log in via SSO (OpenID Connect) so that I can use my corporate identity.

**Requirement Details:**

1. Backend supports OpenID Connect discovery (`.well-known/openid-configuration`)
2. OAuth2 Authorization Code flow with PKCE (code_verifier + code_challenge)
3. Extension opens system browser for IdP login (or embedded Webview if configured)
4. Backend handles callback, exchanges code for IdP tokens
5. Backend issues its own JWT after validating IdP token (maps IdP claims to local user)
6. If user doesn't exist locally → auto-provision from IdP claims (email, name)
7. SSO configuration stored in Backend (issuer URL, client ID, allowed domains)

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| issuer_url | string | Yes | OpenID Connect issuer | "https://accounts.google.com" |
| client_id | string | Yes | OAuth2 client ID | "abc123.apps.googleusercontent.com" |
| redirect_uri | string | Yes | Callback URI | "http://localhost:9180/api/auth/callback" |
| code_verifier | string | Yes | PKCE verifier (generated) | random 43-128 chars |
| code_challenge | string | Yes | SHA256(code_verifier) base64url | derived |

**Acceptance Criteria:**

1. "Login with SSO" button triggers OpenID Connect flow
2. System browser opens IdP login page (or Webview based on config)
3. After IdP authentication → callback received → Backend exchanges code → JWT issued
4. New users auto-provisioned from IdP claims (no manual registration needed)
5. SSO flow completes within 30s of user authenticating with IdP
6. PKCE prevents authorization code interception attacks

**Error Handling:**

- IdP unreachable: "SSO provider unavailable. Please try local login or contact admin."
- IdP rejects credentials: "SSO authentication failed. Check with your administrator."
- Callback timeout (30s): "SSO login timed out. Please try again."
- Domain not allowed: "Your organization is not configured for SSO access."

---

#### STORY 3: Secure Token Storage and Auto-Refresh

> As a developer, I want my JWT stored securely and auto-refreshed so that I stay authenticated without manual intervention.

**Requirement Details:**

1. JWT stored in VS Code SecretStorage API (OS-level encrypted storage)
2. Refresh token also stored in SecretStorage (separate key)
3. Auto-refresh triggers 5 minutes before JWT expiry
4. If refresh fails → show Login Webview (don't block IDE operations silently)
5. Token includes: userId, email, projects[], issuedAt, expiresAt
6. JWT signed with HS256 using Backend secret key
7. On Extension activation: check stored JWT validity before proceeding

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| access_token | JWT string | Yes | Short-lived access token | "eyJ..." (1h expiry) |
| refresh_token | string | Yes | Long-lived refresh token | "rt_abc123..." (7d expiry) |
| token_type | string | Yes | Always "Bearer" | "Bearer" |
| expires_in | number | Yes | Seconds until access token expires | 3600 |

**Acceptance Criteria:**

1. JWT stored in SecretStorage → survives IDE restart → auto-used on next activation
2. Token refreshes automatically at (expiry - 5min) → no user interruption
3. Refresh token expired → Login Webview shown → user re-authenticates
4. SecretStorage cleared on Logout → token not recoverable
5. Token payload contains userId and project membership → Backend uses for KB tier access

**Validation Rules:**

- JWT must have valid HS256 signature (Backend verifies on every request)
- JWT must not be expired (Backend rejects expired tokens with 401)
- Refresh token must be valid and not revoked (Backend maintains revocation list)

---

#### STORY 4: Personal User KB (Tier 1)

> As a developer, I want a personal User KB that only I can access so that my work-in-progress is private.

**Requirement Details:**

1. Every `mem_ingest` call creates entry in USER KB by default (tier=1)
2. USER KB entries have: owner=userId (from JWT), lifetime=session/days (configurable TTL)
3. USER KB contains: current task context, drafts, experiments, WIP notes
4. Only the owner can read/write/delete their USER KB entries
5. Other users CANNOT see, search, or access another user's USER KB
6. TTL-based auto-cleanup: entries older than configured days are auto-deleted (default 7 days)
7. User can explicitly promote entries to PROJECT KB via `mem_promote` tool

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| id | UUID | Yes | Entry unique ID | "550e8400-e29b-..." |
| owner_id | UUID | Yes | User who created the entry | from JWT userId |
| tier | integer | Yes | Always 1 for USER KB | 1 |
| content | text | Yes | Knowledge content | "API endpoint pattern..." |
| tags | string[] | No | Classification tags | ["wip", "experiment"] |
| quality_score | float | No | Computed quality (0-1) | 0.65 |
| ttl_days | integer | No | Days before auto-delete | 7 |
| created_at | timestamp | Yes | Creation time | "2025-07-14T10:00:00Z" |
| project_id | UUID | No | Associated project | null (personal) |

**Acceptance Criteria:**

1. `mem_ingest` with no tier specification → creates USER KB entry (owner = current user)
2. `mem_search` by User A → returns User A's USER KB + PROJECT KB + SHARED KB (never User B's USER KB)
3. Entries older than TTL auto-deleted by background cleanup job
4. User can view/edit/delete only their own USER KB entries
5. Admin cannot see individual user's USER KB (privacy guarantee)

---

#### STORY 5: Project KB (Tier 2)

> As a team member, I want a Project KB shared with my team so that we have a common knowledge repository.

**Requirement Details:**

1. PROJECT KB entries visible to ALL members of the same project
2. Project membership defined by: JWT claims `projects[]` array
3. Content: API docs, architecture decisions, BRD/FSD/TDD, domain knowledge
4. Lifetime: permanent (no TTL auto-delete)
5. Any project member can ingest directly to PROJECT KB: `mem_ingest(tier=2, project=projectId)`
6. Auto-promote from USER KB: quality_score > 0.8 AND tagged "project-relevant" AND reviewed by ≥1 team member
7. Project KB entries have project_id field linking to specific project

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| id | UUID | Yes | Entry unique ID | "550e8400-e29b-..." |
| project_id | UUID | Yes | Owning project | "proj-abc123" |
| tier | integer | Yes | Always 2 for PROJECT KB | 2 |
| content | text | Yes | Knowledge content | "Architecture decision: use event sourcing..." |
| tags | string[] | No | Classification tags | ["architecture", "decision"] |
| quality_score | float | Yes | Quality metric (0-1) | 0.85 |
| promoted_from | UUID | No | Original USER KB entry ID | "550e8400-..." or null |
| promoted_by | UUID | No | User who reviewed/approved | "user-xyz" |
| created_at | timestamp | Yes | Creation time | "2025-07-14T10:00:00Z" |

**Acceptance Criteria:**

1. Project member calls `mem_search` → sees PROJECT KB entries for their project(s)
2. Non-project-member CANNOT see PROJECT KB entries of other projects
3. Multi-project user sees all PROJECT KBs for all their projects in search results
4. Direct ingest to PROJECT KB works for any project member
5. Auto-promotion triggers when criteria met (quality + tag + review)
6. PROJECT KB entries persist indefinitely (no auto-delete)

---

#### STORY 6: Shared KB (Tier 3)

> As an organization member, I want a Shared KB with company-wide best practices so that all teams benefit.

**Requirement Details:**

1. SHARED KB visible to ALL authenticated users across ALL projects
2. Content: coding standards, best practices, reusable patterns, onboarding docs
3. Lifetime: permanent (no TTL)
4. Auto-promote from PROJECT KB: referenced by 3+ projects OR tagged "best-practice" OR admin-promoted
5. Only admin can directly ingest to SHARED KB or manually promote
6. SHARED KB entries are read-only for non-admin users (suggest edits via comments)

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| id | UUID | Yes | Entry unique ID | "550e8400-e29b-..." |
| tier | integer | Yes | Always 3 for SHARED KB | 3 |
| content | text | Yes | Knowledge content | "Best practice: always use parameterized queries..." |
| tags | string[] | No | Classification tags | ["best-practice", "security"] |
| quality_score | float | Yes | Quality metric (0-1) | 0.92 |
| promoted_from | UUID | No | Original PROJECT KB entry | "550e8400-..." or null |
| referenced_by_projects | UUID[] | No | Projects using this entry | ["proj-1", "proj-2", "proj-3"] |
| created_at | timestamp | Yes | Creation time | "2025-07-14T10:00:00Z" |

**Acceptance Criteria:**

1. Any authenticated user can search and read SHARED KB
2. Only admin can directly ingest to SHARED KB
3. Auto-promotion from PROJECT KB when 3+ projects reference the entry
4. Admin can manually promote any PROJECT KB entry to SHARED KB
5. Non-admin users see SHARED KB entries in search results alongside their USER and PROJECT entries
6. SHARED KB entries persist indefinitely

---

#### STORY 7: Auto-Promotion Between KB Tiers

> As a developer, I want knowledge to auto-promote from User→Project→Shared based on quality and usage so that valuable knowledge propagates naturally.

**Requirement Details:**

1. **User → Project promotion criteria (ALL must be met):**
   - quality_score > 0.8 (computed by existing scoring algorithm)
   - Entry tagged "project-relevant" (explicit tag or auto-detected)
   - Reviewed/approved by at least 1 team member (via `mem_review` tool)

2. **Project → Shared promotion criteria (ANY one met):**
   - Referenced by 3+ different projects (cross-project search hits)
   - Tagged "best-practice" by project admin
   - Explicitly promoted by system admin

3. Promotion is non-destructive: original entry remains in source tier (with "promoted" flag)
4. Promoted entry gets new ID in target tier (copy, not move)
5. Promotion audit trail: who triggered, when, why (criteria met)
6. Promotion can be reversed by admin (demote back to source tier)

**Acceptance Criteria:**

1. USER KB entry meeting all 3 criteria → auto-promoted to PROJECT KB within 1 hour
2. PROJECT KB entry referenced by 3 projects → auto-promoted to SHARED KB within 1 hour
3. Original entry in source tier marked as "promoted" (not deleted)
4. Promotion history visible in entry metadata
5. Admin can manually trigger or reverse promotions
6. Background job runs promotion check every 30 minutes

---

#### STORY 8: MCP Server Configuration Page

> As a developer, I want to configure MCP server credentials from a UI in my IDE so that I don't need to edit config files manually.

**Requirement Details:**

1. Backend exposes `GET /api/config/mcp-servers` — returns current user's MCP config
2. Backend exposes `PUT /api/config/mcp-servers` — saves user's MCP config
3. Extension renders Webview with form for each MCP server:
   - **Jira**: URL, username, password/token, project key
   - **DrawIO**: CLI path, export format preferences
   - **Export (Markdown-Exporter)**: output directory, template preferences
4. Sensitive fields (passwords, tokens) encrypted at rest in Backend database
5. Config is per-user (User A's Jira credentials ≠ User B's)
6. Form validates inputs before saving (URL format, required fields)
7. "Test Connection" button per server to verify credentials work

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| jira_url | string | Yes | Jira instance URL | "https://company.atlassian.net" |
| jira_username | string | Yes | Jira username/email | "john.doe@company.com" |
| jira_token | string | Yes | Jira API token | "ATATT3x..." (encrypted) |
| jira_project_key | string | No | Default Jira project | "KSA" |
| drawio_path | string | No | DrawIO CLI path | "C:\\Program Files\\draw.io\\draw.io.exe" |
| drawio_format | string | No | Default export format | "png" |
| export_output_dir | string | No | Export output directory | "./documents" |

**UI Specifications:**

| No. | Name | Type | Required | Description | Note |
|-----|------|------|----------|-------------|------|
| 1 | Server Tabs | Tab Group | Yes | One tab per MCP server (Jira, DrawIO, Export) | Default: Jira tab active |
| 2 | URL Input | Input (url) | Yes | Server URL | Validates URL format |
| 3 | Username Input | Input (text) | Yes | Username/email | Auto-fills from last save |
| 4 | Password/Token Input | Input (password) | Yes | Secret credential | Never sent back in GET (masked) |
| 5 | Test Connection Button | Button (secondary) | No | Verify credentials | Shows success/failure result |
| 6 | Save Button | Button (primary) | Yes | Save configuration | Disabled until changes made |
| 7 | Reset Button | Button (ghost) | No | Revert to saved values | Restores last saved state |

**Acceptance Criteria:**

1. MCP Config page opens from command palette ("Code Intel: Configure MCP Servers")
2. Form pre-fills with existing config (passwords masked as "••••••••")
3. "Test Connection" for Jira → attempts API call → shows success/failure
4. Save → stores per-user in Backend → next MCP tool call uses new credentials
5. Different users on same machine see their own config (isolated by JWT userId)
6. Sensitive fields never returned in plaintext via GET API (only "configured" flag)

**Validation Rules:**

- Jira URL: must be valid HTTPS URL
- Jira username: non-empty, valid email format
- Jira token: non-empty, min 10 chars
- DrawIO path: must point to existing executable (validated client-side if possible)

**Error Handling:**

- Test Connection fails: "Connection failed: {specific error}. Check URL and credentials."
- Save fails: "Could not save configuration. Backend unavailable."
- Invalid URL format: "Please enter a valid URL (https://...)"

---

#### STORY 9: Secure Logout

> As a developer, I want to logout and have my token cleared so that another user on the same machine cannot access my data.

**Requirement Details:**

1. Extension provides "Logout" command (command palette + status bar)
2. Logout calls `POST /api/auth/logout` (invalidates refresh token server-side)
3. Extension clears JWT and refresh token from SecretStorage
4. Extension clears any cached user data (KB entries in memory)
5. Extension shows Login Webview after logout
6. Status bar transitions from "Authenticated (username)" to "Not Authenticated"

**Acceptance Criteria:**

1. Logout command clears all tokens from SecretStorage
2. After logout, all `/mcp/*` and `/api/*` requests return 401
3. Login Webview appears after logout
4. Status bar shows "Not Authenticated" state
5. Backend refresh token marked as revoked (cannot be reused)

---

#### STORY 10: Unified KB Search Across Tiers

> As a developer, I want KB search to merge results from all 3 tiers ranked by relevance so that I get the most useful answers.

**Requirement Details:**

1. `mem_search` queries all accessible tiers simultaneously:
   - USER KB: only current user's entries
   - PROJECT KB: entries from user's project(s)
   - SHARED KB: all entries
2. Results merged and ranked by: semantic relevance score × tier boost factor
3. Tier boost factors (configurable): USER=1.2, PROJECT=1.0, SHARED=0.9
4. Results include tier indicator so user knows source
5. Deduplication: if same content exists in multiple tiers, show highest-tier version
6. Performance: search across all tiers must complete within 500ms

**Acceptance Criteria:**

1. `mem_search("auth pattern")` returns results from USER + PROJECT + SHARED KBs
2. Results sorted by combined relevance score (semantic + tier boost)
3. Each result shows tier badge: [Personal] / [Project: {name}] / [Shared]
4. Duplicate content deduplicated (highest tier wins)
5. Search completes within 500ms for typical queries
6. User B's USER KB entries never appear in User A's search results

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| KSA-284 Split Architecture | System | KSA-284 | Backend HTTP server must be operational |
| VS Code SecretStorage API | System | N/A | Required for encrypted token storage |
| JWT Library (jsonwebtoken) | System | N/A | JWT generation and validation (HS256) |
| bcrypt Library | System | N/A | Password hashing for local auth |
| OpenID Connect Library | System | N/A | OIDC discovery, PKCE flow, token exchange |
| SQLite User/Config tables | Infrastructure | N/A | Database schema extensions for users, config, KB tiers |
| Existing KB (mem_*) tools | System | N/A | Extended to support multi-tier operations |
| Existing MCP Orchestration | System | N/A | MCP servers (Jira, DrawIO, Export) whose config is being personalized |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Product Owner | Extension Team Lead | Approve requirements, define promotion rules | Ticket reporter |
| Backend Developer | Extension Dev Team | Implement auth, multi-tier KB, config API | Ticket assignee |
| Frontend Developer | Extension Dev Team | Implement Login Webview, Config page | Ticket assignee |
| Security Reviewer | Security Team | Review auth implementation, token handling | Related |
| End Users | Developers using IDE | Validate login flow, KB separation, config page | Watchers |
| Admin | Platform Admin | Manage SHARED KB, user provisioning | Related |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| JWT secret key leakage compromises all tokens | Critical | Low | Store secret in environment variable, rotate periodically, short token expiry (1h) |
| Multi-tier search performance degradation with large KB | High | Medium | Index optimization per tier, result limit per tier, caching layer |
| SSO integration complexity varies per IdP | Medium | High | Support standard OIDC only, test with Google/Azure AD/Okta, fallback to local auth |
| User KB auto-delete TTL causes data loss | Medium | Medium | Warn user before deletion, allow explicit "keep" flag, configurable TTL |
| MCP config page credential theft via XSS in Webview | High | Low | CSP headers, input sanitization, never render raw credentials in DOM |
| Quality score gaming to force promotion | Low | Low | Review requirement for User→Project promotion, admin oversight for Shared |
| Token refresh race condition (multiple requests) | Medium | Medium | Mutex on refresh, queue concurrent requests during refresh |

### 5.2 Assumptions

- All users have unique identifiers (username or email from IdP)
- Backend runs as single instance (no distributed token validation needed)
- ONNX embedding model supports batched queries across tiers efficiently
- VS Code SecretStorage is the most secure local storage option available
- PKCE is supported by all target SSO providers (modern requirement)
- SQLite handles concurrent multi-tier queries without lock contention for expected user count (<100 concurrent)
- Existing quality scoring algorithm is suitable for promotion threshold decisions

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Login flow completes in < 3s | From clicking Login to authenticated state (local auth) |
| Performance | SSO flow completes in < 30s | Depends on IdP speed, but Extension timeout at 30s |
| Performance | Token refresh < 500ms | Background operation, no user-visible delay |
| Performance | Multi-tier search < 500ms | Across all 3 tiers with merge and ranking |
| Performance | MCP Config save < 1s | Write to Backend database |
| Security | JWT expiry: 1 hour | Short-lived access tokens |
| Security | Refresh token expiry: 7 days | Longer-lived but revocable |
| Security | Passwords: bcrypt (cost=12) | Industry standard hashing |
| Security | Sensitive config: AES-256 encrypted at rest | MCP passwords/tokens in database |
| Security | No plaintext credentials in API responses | Masked or omitted in GET responses |
| Security | PKCE mandatory for OAuth2 flows | Prevents code interception |
| Security | Account lockout: 5 attempts / 15 min | Brute-force protection |
| Reliability | Token refresh failure → graceful fallback | Show Login, don't crash or hang |
| Reliability | KB tier isolation enforced at database level | Not just API-level checks |
| Scalability | Support 100 concurrent users | SQLite with WAL mode sufficient |
| Scalability | USER KB: up to 10,000 entries per user | With TTL auto-cleanup |
| Scalability | PROJECT KB: up to 100,000 entries per project | Permanent storage |
| Scalability | SHARED KB: up to 50,000 entries | Company-wide permanent |
| Availability | Auth failure doesn't block IDE | Extension remains active, tools unavailable |
| Compatibility | OIDC providers: Google, Azure AD, Okta, Keycloak | Standard OIDC compliance |
| Compliance | No credentials logged or exposed in error messages | Security best practice |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-285 | Authentication, Multi-Tenant KB, and MCP Server Configuration | To Do | Story | Main ticket |
| KSA-284 | Split Extension: Lightweight Proxy + Backend MCP Server | In Progress | Story | Prerequisite (extends this architecture) |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| JWT | JSON Web Token — compact, URL-safe token for claims between parties |
| HS256 | HMAC-SHA256 — symmetric signing algorithm for JWT |
| PKCE | Proof Key for Code Exchange — OAuth2 extension preventing code interception |
| OIDC | OpenID Connect — identity layer on top of OAuth 2.0 |
| IdP | Identity Provider — external service managing user authentication (Google, Azure AD) |
| SecretStorage | VS Code API for OS-level encrypted credential storage |
| KB | Knowledge Base — the semantic search database for code intelligence |
| Tier | Knowledge Base access level (1=User, 2=Project, 3=Shared) |
| TTL | Time To Live — auto-expiry duration for temporary data |
| Quality Score | Numeric metric (0-1) measuring knowledge entry usefulness |
| Auto-Promote | Automatic elevation of KB entry from lower to higher tier based on criteria |
| MCP | Model Context Protocol — standard for AI agent tool integration |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| KSA-284 BRD | BRD-v1-KSA-284.docx |
| KSA-284 TDD | TDD-v1-KSA-284.docx |
| Current Tool List | .code-intel/tool-list.txt |
| VS Code SecretStorage API | https://code.visualstudio.com/api/references/vscode-api#SecretStorage |
| OpenID Connect Spec | https://openid.net/specs/openid-connect-core-1_0.html |
| OAuth 2.0 PKCE RFC | https://datatracker.ietf.org/doc/html/rfc7636 |
| JWT RFC | https://datatracker.ietf.org/doc/html/rfc7519 |

### JWT Token Structure

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user-uuid",
    "email": "john.doe@company.com",
    "name": "John Doe",
    "projects": ["proj-abc", "proj-xyz"],
    "role": "user",
    "iat": 1720958400,
    "exp": 1720962000
  }
}
```

### KB Tier Access Matrix

| Operation | USER KB (Tier 1) | PROJECT KB (Tier 2) | SHARED KB (Tier 3) |
|-----------|-------------------|---------------------|---------------------|
| Read | Owner only | All project members | All authenticated users |
| Write/Ingest | Owner only | All project members | Admin only |
| Delete | Owner only | Project admin | System admin |
| Search | Owner's entries only | All project entries | All entries |
| Promote (out) | Owner (to Project) | Admin (to Shared) | N/A |
| Promote (in) | N/A | Auto (from User) | Auto (from Project) |

### Auto-Promotion Decision Matrix

| From → To | Criteria | Trigger | Frequency |
|-----------|----------|---------|-----------|
| User → Project | quality_score > 0.8 AND tag="project-relevant" AND reviewed_by >= 1 member | Background job | Every 30 min |
| Project → Shared | referenced_by >= 3 projects OR tag="best-practice" OR admin_promoted=true | Background job | Every 30 min |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
