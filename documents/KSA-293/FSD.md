# Functional Specification Document (FSD)

## Kiro SDLC Agents — KSA-293: Refactor kiro-sdlc-agents Extension to Light Client of Remote Backend

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-293 |
| Title | Refactor kiro-sdlc-agents Extension to Light Client of Remote Backend |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-293.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-14 | BA + TA Agent | Initial document |

---

## 1. Introduction

### 1.1 Purpose

Specifies the functional behavior of the refactored `kiro-sdlc-agents` VS Code extension as a light client of the remote Kiro backend.

### 1.2 Scope

All user-facing functionality: connection, auth, tool forwarding, indexing, workspace sync, panels, chat, local ops.

### 1.3 Definitions

| Term | Definition |
|------|------------|
| Light Client | Extension proxying to remote backend |
| MCP | Model Context Protocol |
| PKCE | Proof Key for Code Exchange |
| SSE | Server-Sent Events |
| JWT | JSON Web Token |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-293.docx |
| KSA-292 TDD | documents/KSA-292/TDD.md |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

**External Actors:**
- Developer (VS Code user)
- Remote Kiro Backend (HTTP API)
- SSO Provider (OAuth2/PKCE)

**System Boundary:** The extension operates within VS Code Extension Host, communicating externally only with the remote backend and (optionally) an SSO provider.

### 2.2 System Architecture

The extension is structured as a thin client with:
- **Connection Layer** — manages backend connectivity and health
- **Auth Layer** — manages JWT tokens and SSO flows
- **Proxy Layer** — forwards MCP tool calls to backend
- **Service Layer** — workspace sync, indexing upload
- **UI Layer** — webview panels, chat, status bar, tree view
- **Local Layer** — inject, config watch, diagnostics (unchanged)

---

## 3. Functional Requirements

### 3.1 Feature: Remote Backend Connection

**Source:** BRD Story 4

#### 3.1.1 Use Case: UC-01 Connect to Remote Backend

**Actor:** Developer
**Preconditions:** Extension activated, backend URL configured
**Postconditions:** Connection established, tools available

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Extension | Read `kiroSdlc.backend.url` from settings |
| 2 | | Extension | Check if valid auth token exists in SecretStorage |
| 3 | | Extension | If token exists: call `/health` with Bearer token |
| 4 | | Backend | Return health status (version, uptime, tools count) |
| 5 | | Extension | Transition state: CONNECTING → CONNECTED |
| 6 | | Extension | Update status bar: green "Connected" |
| 7 | | Extension | Start health check polling (interval from settings) |
| 8 | | Extension | Trigger WorkspaceSyncService |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | No auth token | Show login panel, wait for auth, then retry connect |
| AF-02 | Token expired | Attempt refresh, if fails show login panel |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Backend unreachable | Transition to DISCONNECTED, start reconnect timer |
| EF-02 | Invalid URL format | Show error notification, prompt to configure |
| EF-03 | Health check returns 401 | Clear tokens, show login panel |

---

#### 3.1.2 Use Case: UC-02 Auto-Reconnect

**Actor:** System (automatic)
**Preconditions:** Connection previously established, now lost
**Postconditions:** Connection re-established or max retries exhausted

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Extension | Health check fails |
| 2 | | Extension | Transition: CONNECTED → DISCONNECTED |
| 3 | | Extension | Update status bar: red "Disconnected" |
| 4 | | Extension | Wait exponential delay (1s, 2s, 4s, 8s, 16s) |
| 5 | | Extension | Retry health check |
| 6 | | Backend | Return healthy |
| 7 | | Extension | Transition: DISCONNECTED → CONNECTED |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Max 5 retries exhausted | Show "Cannot connect" notification |
| EF-02 | Auth expired during reconnect | Show login panel |

---

### 3.2 Feature: Authentication

**Source:** BRD Story 5

#### 3.2.1 Use Case: UC-03 Login with Credentials

**Actor:** Developer
**Preconditions:** Extension activated, no valid token
**Postconditions:** JWT stored in SecretStorage

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Extension | Show Login Panel webview |
| 2 | User | | Enter username and password |
| 3 | User | | Click "Login" |
| 4 | | Extension | POST `/api/admin/auth/login` with credentials |
| 5 | | Backend | Return { access_token, refresh_token, expires_in } |
| 6 | | Extension | Store tokens in SecretStorage |
| 7 | | Extension | Start TokenRefreshTimer |
| 8 | | Extension | Close login panel, trigger connect |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Invalid credentials (401) | Show error in login panel |
| EF-02 | Backend unreachable | Show "Cannot reach server" |

---

#### 3.2.2 Use Case: UC-04 SSO Login (PKCE)

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | User | | Click "Login with SSO" |
| 2 | | Extension | Generate code_verifier (32 bytes → base64url) |
| 3 | | Extension | Compute code_challenge = SHA-256(verifier) → base64url |
| 4 | | Extension | Open browser with authorize URL + challenge |
| 5 | User | | Authenticate in browser |
| 6 | | SSO | Redirect with auth_code |
| 7 | | Extension | Receive code via URI handler |
| 8 | | Extension | POST /api/auth/token with code + verifier |
| 9 | | Backend | Return tokens |
| 10 | | Extension | Store, start timer, connect |

---

#### 3.2.3 Use Case: UC-05 Token Auto-Refresh

**Main Flow:** Every 5min check expiry → if < 5min remaining → POST /api/auth/refresh → update SecretStorage

---

### 3.3 Feature: MCP Tool Forwarding

**Source:** BRD Story 8

#### 3.3.1 Use Case: UC-06 Forward Tool Call

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | MCP Client | | Call tool (name, arguments) |
| 2 | | ToolProxy | Check if local (embed_images) |
| 3 | | ToolProxy | Remote → HttpClient |
| 4 | | HttpClient | POST /mcp/tools/call with Bearer |
| 5 | | Backend | Execute, return result |
| 6 | | ToolProxy | Return to caller |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | 401 | Refresh token, retry once |
| EF-02 | Timeout (300s) | Return timeout error |
| EF-03 | 500 | Return error with details |

---

### 3.4 Feature: Workspace Sync

**Source:** BRD Story 7

#### 3.4.1 Use Case: UC-08 Sync Workspace

**Main Flow:** On connect → findFiles → build tree → POST /api/workspace/sync

**Business Rules:**

| ID | Rule |
|----|------|
| BR-01 | Respect .gitignore |
| BR-02 | Max 10,000 files per sync |
| BR-03 | Only relative paths |
| BR-04 | Re-sync on folder change |

---

### 3.5 Feature: Indexing Upload

**Source:** BRD Story 6

#### 3.5.1 Use Case: UC-09 Index Documents

**Main Flow:** Command → scan .md → progress → POST multipart /api/index/documents → notification

#### 3.5.2 Use Case: UC-10 Index Source

**Main Flow:** Command → scan source → POST multipart /api/index/source → notification

---

### 3.6 Feature: Webview Panels

**Source:** BRD Story 9

#### 3.6.1 Use Case: UC-11 Open Panel

**Panel Endpoints:**

| Panel | Endpoint |
|-------|----------|
| Dashboard | /api/dashboard |
| KB Graph | /api/graph |
| Quality | /api/quality |
| Tags | /api/tags |
| Analytics | /api/analytics |
| Security | /api/security |
| Workflow | /api/workflow |

---

### 3.7 Feature: Chat Panel

**Source:** BRD Story 10

#### 3.7.1 Use Case: UC-12 Send Chat Message

**Main Flow:** User types → POST /api/chat with context → SSE stream → render chunks in webview

---

### 3.8 Feature: Local Operations

**Source:** BRD Story 11

#### UC-13 Inject Agents — unchanged local file copy to .kiro/

---

## 4. Data Model

### 4.1 Configuration Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `kiroSdlc.backend.url` | string | `http://127.0.0.1:48721` | Backend URL |
| `kiroSdlc.backend.ssoEnabled` | boolean | false | Enable SSO |
| `kiroSdlc.backend.ssoProviderUrl` | string | "" | OAuth URL |
| `kiroSdlc.backend.healthCheckInterval` | number | 30000 | Health poll ms |
| `kiroSdlc.backend.toolCallTimeout` | number | 300000 | Tool timeout ms |
| `kiroSdlc.backend.chatTimeout` | number | 120000 | Chat timeout ms |

### 4.2 Settings to Remove

`enableMcpServer`, `mcpServerPort`, `llmProvider`, `llmModel`, `anthropicBaseUrl`, `openaiBaseUrl`, `ollamaUrl`, `kiroModel`, `kiroRegion`

### 4.3 Connection States

DISCONNECTED → CONNECTING → CONNECTED (cycle on failure)

### 4.4 Auth States

UNAUTHENTICATED → AUTHENTICATING → AUTHENTICATED → TOKEN_EXPIRED → (refresh → AUTHENTICATED | UNAUTHENTICATED)

---

## 5. Integration Requirements

### 5.1 Backend API Contract

| Endpoint | Method | Auth | Timeout | Purpose |
|----------|--------|------|---------|---------|
| /health | GET | Bearer | 3s | Health check |
| /mcp/tools/list | GET | Bearer | 10s | Tool discovery |
| /mcp/tools/call | POST | Bearer | 300s | Tool execution |
| /api/admin/auth/login | POST | None | 10s | Login |
| /api/auth/refresh | POST | None | 10s | Token refresh |
| /api/auth/token | POST | None | 10s | PKCE exchange |
| /api/workspace/sync | POST | Bearer | 30s | Workspace sync |
| /api/index/documents | POST | Bearer | 600s | Doc upload |
| /api/index/source | POST | Bearer | 600s | Source upload |
| /api/chat | POST | Bearer | 120s | Chat (SSE) |
| /api/{panel} | GET | Bearer | 10s | Panel data |

---

## 6. UI Specifications

### 6.1 Status Bar States

| State | Icon | Color |
|-------|------|-------|
| Connected | $(check) | Green |
| Disconnected | $(warning) | Red |
| Connecting | $(sync~spin) | Yellow |
| Unauthenticated | $(lock) | Orange |

### 6.2 Commands to Add/Remove

**Add:** connect, disconnect, login, logout, indexDocuments, indexSource, openChat, configureBackend

**Remove:** restartMcpServer, stopMcpServer, changePort, downloadModel, testLanguageModels, setLlmApiKey, clearLlmApiKey

---

## 7. Business Rules

| ID | Rule |
|----|------|
| BR-01 | No absolute paths to backend |
| BR-02 | Tokens never logged |
| BR-03 | Extension works (limited) without backend |
| BR-04 | All remote calls require auth |
| BR-05 | .gitignore respected |
| BR-06 | Max 1MB per indexed file |
| BR-07 | Max 10,000 files in sync |
| BR-08 | Token refresh max 3 attempts |
| BR-09 | Reconnect max 5 attempts |
| BR-10 | Local tools: embed_images only |

---

## 8. Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| Performance | Activation | < 2s |
| Performance | Proxy overhead | < 500ms |
| Performance | Bundle size | < 500KB |
| Security | Token storage | SecretStorage |
| Security | PKCE | S256 |
| Reliability | Reconnection | 5 retries, exponential |
| Compatibility | VS Code | 1.85+ |
| Compatibility | Platforms | Win/Mac/Linux |

---

## 9. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Connection State | [state-connection.png](diagrams/state-connection.png) | [state-connection.drawio](diagrams/state-connection.drawio) |
| 3 | Auth State | [state-auth.png](diagrams/state-auth.png) | [state-auth.drawio](diagrams/state-auth.drawio) |
| 4 | Tool Call Sequence | [sequence-tool-call.png](diagrams/sequence-tool-call.png) | [sequence-tool-call.drawio](diagrams/sequence-tool-call.drawio) |
| 5 | Auth Sequence | [sequence-auth.png](diagrams/sequence-auth.png) | [sequence-auth.drawio](diagrams/sequence-auth.drawio) |
