# Functional Specification Document (FSD)

## Code Intelligence Extension — KSA-292: Refactor Extension to Light Client of Remote Backend Server

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-292 |
| Title | Refactor Extension to Light Client of Remote Backend Server |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-292.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-14 | BA Agent | Initial — Use Cases, Business Rules, Data Specs |
| 1.0 | 2025-07-14 | TA Agent | Enriched — API Contracts, Integration Specs, Pseudocode |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the refactored VS Code extension operating as a light client to a remote Code Intelligence backend server.

### 1.2 Scope

Covers all user-facing functionality: connection management, authentication, workspace sync, tool forwarding, webview panels, chat box, and configuration.

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| Light Client | Extension acting as thin proxy with no local backend |
| MCP | Model Context Protocol — tool communication standard |
| PKCE | Proof Key for Code Exchange (OAuth 2.0 extension) |
| SSE | Server-Sent Events — streaming protocol |
| JWT | JSON Web Token — auth token format |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-292.docx |
| Backend API | backend/README.md |
| Extension v1.1.0 | src/extension/src/ |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

The extension operates as a thin client within VS Code, communicating with:
- **Remote Backend Server** - HTTP/HTTPS for all tool calls, data queries, and chat
- **SSO Provider** - OAuth 2.0 PKCE flow for enterprise authentication
- **Local Filesystem** - Only for local tools (embed_images) and workspace scanning
- **MCP Clients** - Kiro, Copilot, or other AI tools that call MCP tools through the extension

---

## 3. Functional Requirements

### 3.1 Feature: Remote Backend Connection

**Source:** BRD Story 1

#### UC-1: Connect to Remote Backend

**Actor:** Developer
**Preconditions:** Extension activated, backend URL configured
**Postconditions:** Connected, status bar green

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Extension | Read codeIntel.backend.url from settings |
| 2 | | Extension | GET {url}/health with Bearer token |
| 3 | | Backend | Return health response (status, version, tools_loaded) |
| 4 | | Extension | State: CONNECTING -> CONNECTED |
| 5 | | Extension | Update status bar green, start health polling (5s) |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | Backend unreachable | DISCONNECTED, reconnect (exponential backoff 1s/2s/4s/8s/16s, max 5) |
| AF-2 | Auth token expired | Refresh token, retry connection |
| AF-3 | Health check fails mid-session | CONNECTED->DISCONNECTED, start reconnect |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Max reconnect (5) reached | Notification: Cannot connect. Stop retrying |
| EF-2 | Invalid URL | Error message, open settings |

#### Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-1 | Extension activate < 2 seconds | BRD Story 10 |
| BR-2 | All requests include Bearer token | BRD Story 1 |
| BR-3 | Reconnect: exponential backoff (1s base, 16s max, 5 attempts) | BRD Story 1 |
| BR-4 | Health check interval = 5000ms configurable | BRD Story 1 |
| BR-5 | Extension MUST NOT spawn any local process | BRD Story 2 |
| BR-6 | Local tools work without backend connection | BRD Story 6 |
| BR-7 | Workspace sync respects .gitignore | BRD Story 4 |
| BR-8 | Chat requires authentication | BRD Story 8 |
| BR-9 | PKCE uses S256 code challenge | BRD Story 9 |
| BR-10 | Tokens stored in VS Code SecretStorage only | BRD Story 9 |
| BR-11 | Extension bundle < 500KB | BRD NFR |

#### API Contract: Health Check

**Endpoint:** `GET {baseUrl}/health`
**Headers:** Authorization: Bearer {accessToken}

**Response 200:**
```json
{ "status": "healthy", "version": "1.5.0", "tools_loaded": 52, "uptime_seconds": 3600 }
```

| Error | Action |
|-------|--------|
| 401 | Refresh token, retry |
| 503 | Wait 2s, retry |
| Connection refused | Schedule reconnect |

---

### 3.2 Feature: Authentication (Login + SSO PKCE)

**Source:** BRD Story 9

#### UC-2: Login with Username/Password

**Actor:** Developer
**Preconditions:** Extension activated, not authenticated
**Postconditions:** Tokens stored, connected to backend

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | | Extension shows Login panel (webview) |
| 2 | Developer | Enter username + password, click Login |
| 3 | | Extension POST /api/auth/login with credentials |
| 4 | | Backend returns {access_token, refresh_token, expires_in} |
| 5 | | Extension stores tokens in SecretStorage |
| 6 | | Extension fires auth state AUTHENTICATED |
| 7 | | Extension connects to backend |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | Invalid credentials | Show error in login panel, allow retry |
| AF-2 | Account locked | Show message with lockout duration |

#### UC-3: Login with SSO (PKCE)

**Actor:** Developer
**Preconditions:** Extension activated, SSO configured on backend

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | Developer | Click SSO Login button in Login panel |
| 2 | | Extension generates code_verifier (43-128 chars, URL-safe) |
| 3 | | Extension computes code_challenge = BASE64URL(SHA256(code_verifier)) |
| 4 | | Extension opens browser: {sso_url}/authorize?response_type=code&code_challenge={}&... |
| 5 | Developer | Authenticate in browser, authorize app |
| 6 | | Browser redirects to vscode://codeintel/callback?code={auth_code} |
| 7 | | Extension handles URI callback |
| 8 | | Extension POST /api/auth/token with code + code_verifier |
| 9 | | Backend returns {access_token, refresh_token, expires_in} |
| 10 | | Extension stores tokens, fires AUTHENTICATED |

#### UC-4: Token Refresh

**Trigger:** Token expires in < 5 minutes (timer-based)

| Step | System |
|------|--------|
| 1 | TokenRefreshTimer detects expiry approaching |
| 2 | POST /api/auth/refresh with refresh_token |
| 3 | Backend returns new access_token + refresh_token |
| 4 | Store new tokens in SecretStorage |

**Exception:** If refresh fails (401) -> clear tokens, show Login panel

#### API Contract: Authentication

**POST {baseUrl}/api/auth/login**
```json
Request:  { "username": "string", "password": "string" }
Response: { "access_token": "jwt", "refresh_token": "string", "expires_in": 3600, "user": { "id": "string", "username": "string", "roles": ["string"] } }
```

**POST {baseUrl}/api/auth/token** (PKCE exchange)
```json
Request:  { "grant_type": "authorization_code", "code": "string", "code_verifier": "string", "redirect_uri": "vscode://codeintel/callback" }
Response: { "access_token": "jwt", "refresh_token": "string", "expires_in": 3600 }
```

**POST {baseUrl}/api/auth/refresh**
```json
Request:  { "refresh_token": "string" }
Response: { "access_token": "jwt", "refresh_token": "string", "expires_in": 3600 }
```

**POST {baseUrl}/api/auth/logout**
```json
Request:  { "refresh_token": "string" }
Response: 204 No Content
```

---

### 3.3 Feature: Workspace Structure Sync

**Source:** BRD Story 4

#### UC-5: Sync Workspace on Connect

**Actor:** System (automatic)
**Trigger:** Connection established (state = CONNECTED)

**Main Flow:**

| Step | System |
|------|--------|
| 1 | Scan workspace folders (respect .gitignore) |
| 2 | Build file tree JSON (paths, types, sizes - no content) |
| 3 | POST /api/workspace/sync with file tree |
| 4 | Backend acknowledges (200 OK) |

**Alternative:** Workspace folder added/removed -> re-sync

#### API Contract: Workspace Sync

**POST {baseUrl}/api/workspace/sync**
```json
Request: {
  "workspace_name": "my-project",
  "files": [
    { "path": "src/index.ts", "type": "file", "size": 1234 },
    { "path": "src/", "type": "directory" }
  ],
  "total_files": 500,
  "total_size_bytes": 5242880
}
Response: { "status": "synced", "files_received": 500 }
```

---

### 3.4 Feature: File/Source Indexing via Upload

**Source:** BRD Story 3

#### UC-6: Index Documents

**Actor:** Developer
**Trigger:** Command palette: "Code Intel: Index Documents"

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | Developer | Trigger index documents command |
| 2 | | Extension scans workspace for .md files |
| 3 | | Extension shows progress bar |
| 4 | | POST /api/index/documents (multipart, chunked) |
| 5 | | Backend processes files, returns status |
| 6 | | Extension shows completion notification |

#### UC-7: Index Source Code

**Same flow as UC-6 but:** scans source files (.ts, .js, .py, etc.), uploads to /api/index/source

#### API Contract: Indexing

**POST {baseUrl}/api/index/documents** (multipart/form-data)
- Field: files[] (multiple file uploads)
- Field: workspace_name (string)
- Response: { "status": "queued", "job_id": "uuid", "files_count": 25 }

**POST {baseUrl}/api/index/source** (same format)

---

### 3.5 Feature: MCP Tool Call Forwarding

**Source:** BRD Story 5

#### UC-8: Forward Tool Call to Backend

**Actor:** MCP Client (Kiro/Copilot)
**Preconditions:** Extension connected, authenticated

**Main Flow:**

| Step | System |
|------|--------|
| 1 | MCP client calls tool via extension proxy |
| 2 | ToolProxy checks: is this a local tool? |
| 3 | If remote -> POST /mcp/tools/call with {name, arguments} + Bearer token |
| 4 | Backend executes tool, returns result |
| 5 | ToolProxy returns result to MCP client |

**Alternative:** If local tool -> execute locally (UC-9)

#### UC-9: Execute Local Tool

**Trigger:** Tool call for `embed_images` or other local tools

| Step | System |
|------|--------|
| 1 | ToolProxy identifies tool as local |
| 2 | FileProxyHandler executes tool locally |
| 3 | Result returned to MCP client directly |

#### API Contract: Tool Call

**POST {baseUrl}/mcp/tools/call**
```json
Request: { "name": "mem_search", "arguments": { "query": "auth", "limit": 5 } }
Response: { "content": [{ "type": "text", "text": "..." }], "isError": false }
```

**GET {baseUrl}/mcp/tools/list**
```json
Response: { "tools": [{ "name": "string", "description": "string", "inputSchema": {...} }] }
```

---

### 3.6 Feature: Webview Panels (Remote Data)

**Source:** BRD Story 7

#### UC-10: View Dashboard Panel

**Actor:** Developer
**Trigger:** Command "Code Intel: Open Dashboard"

**Main Flow:**

| Step | System |
|------|--------|
| 1 | WebviewManager creates/reveals panel |
| 2 | Panel webview sends fetch request to extension host |
| 3 | Extension forwards GET /api/dashboard with Bearer token |
| 4 | Backend returns dashboard data |
| 5 | Panel renders data |

**Same pattern for:** KB Graph (/api/graph), Quality (/api/quality), Tags (/api/tags), Analytics (/api/analytics)

**Error Handling:**
- Loading state while fetching
- Error state with Retry button on failure
- Auto-refresh on reconnect

---

### 3.7 Feature: Chat Box

**Source:** BRD Story 8

#### UC-11: Chat with AI Assistant

**Actor:** Developer
**Preconditions:** Authenticated, connected

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | Developer | Open Chat panel (command or sidebar) |
| 2 | Developer | Type message, optionally attach context (#) |
| 3 | Developer | Press Enter/Send |
| 4 | | Extension POST /api/chat with message + context |
| 5 | | Backend streams response via SSE |
| 6 | | Extension renders markdown chunks in real-time |
| 7 | Developer | See complete response with code highlighting |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | User attaches file context (#) | Resolve file content locally, include in request |
| AF-2 | User cancels mid-stream | Close SSE connection, show partial response |

#### UC-12: Attach Context to Chat

**Trigger:** User types "#" in chat input

| Step | System |
|------|--------|
| 1 | Show context menu (files, specs, git-diff, terminal, etc.) |
| 2 | User selects context type |
| 3 | Extension resolves context locally (VS Code API) |
| 4 | Context badge shown in input field |
| 5 | Context content included in next message |

#### API Contract: Chat

**POST {baseUrl}/api/chat** (SSE response)
```json
Request: {
  "message": "Explain this function",
  "context": [
    { "type": "file", "path": "src/auth.ts", "content": "..." },
    { "type": "git-diff", "content": "..." }
  ],
  "session_id": "uuid"
}
Response: text/event-stream
  data: {"type": "chunk", "content": "The function "}
  data: {"type": "chunk", "content": "handles auth..."}
  data: {"type": "done", "message_id": "uuid"}
```

---

### 3.8 Feature: Configuration UI

**Source:** BRD Story 11

#### UC-13: Configure Remote Backend

**Actor:** Developer

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | Developer | Open VS Code settings or Config panel |
| 2 | Developer | Enter backend URL |
| 3 | Developer | Click "Test Connection" |
| 4 | | Extension GET {url}/health (no auth first) |
| 5 | | Show success/failure result |
| 6 | Developer | Save configuration |
| 7 | | Extension disconnects from old, connects to new |

---

## 4. Data Model

### 4.1 Extension State (In-Memory)

| Entity | Attributes | Description |
|--------|-----------|-------------|
| ConnectionState | state, backendVersion, connectedAt, reconnectAttempts, lastHealthCheck | Connection lifecycle |
| AuthState | state (AUTHENTICATED/UNAUTHENTICATED), user, tokens | Auth lifecycle |
| ToolRegistry | Map<name, ToolDefinition> | Available tools (remote + local) |
| ChatSession | sessionId, messages[] | Current chat conversation |
| WorkspaceTree | files[], totalSize | Last synced workspace structure |

### 4.2 Persisted Data

| Storage | Data | Mechanism |
|---------|------|-----------|
| VS Code SecretStorage | access_token, refresh_token | Encrypted by VS Code |
| VS Code Settings | backend.url, healthCheckInterval | settings.json |
| VS Code Workspace Settings | backend.url (per-project override) | .vscode/settings.json |

---

## 5. Integration Specifications

### 5.1 Remote Backend Server

| Attribute | Value |
|-----------|-------|
| Purpose | All code intelligence, KB, tool execution, chat AI |
| Protocol | HTTP/HTTPS REST + SSE (for chat streaming) |
| Direction | Bidirectional (Extension -> Backend for requests, Backend -> Extension for SSE) |
| Auth | Bearer JWT token in Authorization header |
| Timeout | Health: 3s, Tools: 300s, Webview: 10s, Chat: 120s |

### 5.2 SSO Provider (OAuth 2.0)

| Attribute | Value |
|-----------|-------|
| Purpose | Enterprise authentication |
| Protocol | OAuth 2.0 Authorization Code + PKCE |
| Direction | Outbound (Extension opens browser -> SSO -> callback) |
| Flow | Extension -> Browser -> SSO -> Browser redirect -> Extension URI handler |

### 5.3 VS Code Host APIs

| API | Purpose |
|-----|---------|
| SecretStorage | Secure token storage |
| WebviewPanel | UI panels (dashboard, chat, etc.) |
| StatusBarItem | Connection status indicator |
| OutputChannel | Debug logging |
| commands.registerCommand | Command palette integration |
| window.registerUriHandler | SSO callback handling |
| workspace.fs | Local file access (indexing, embed_images) |

---

## 6. State Machine

### 6.1 Connection States

![State Diagram](diagrams/state-connection.png)

| State | Description | Transitions |
|-------|-------------|-------------|
| DISCONNECTED | No connection to backend | -> CONNECTING (on connect()) |
| CONNECTING | Attempting connection | -> CONNECTED (health OK) / -> DISCONNECTED (failed) |
| CONNECTED | Active connection | -> DISCONNECTED (health fail) |

### 6.2 Auth States

| State | Description | Transitions |
|-------|-------------|-------------|
| UNAUTHENTICATED | No valid tokens | -> AUTHENTICATING (login/SSO) |
| AUTHENTICATING | Login in progress | -> AUTHENTICATED (success) / -> UNAUTHENTICATED (fail) |
| AUTHENTICATED | Valid tokens stored | -> UNAUTHENTICATED (logout/token invalid) |

---

## 7. Security Requirements

### 7.1 Authentication

| Mechanism | Details |
|-----------|---------|
| Local Login | Username/password -> JWT (access + refresh) |
| SSO PKCE | OAuth 2.0 + PKCE S256 -> JWT |
| Token Storage | VS Code SecretStorage (OS-encrypted) |
| Token Refresh | Auto before expiry (5 min buffer) |
| Logout | Clear local tokens + POST /api/auth/logout (invalidate refresh) |

### 7.2 Data Security

| Rule | Implementation |
|------|---------------|
| No tokens in settings | SecretStorage only |
| No tokens in logs | OutputChannel redacts tokens |
| HTTPS supported | SSL/TLS for remote communication |
| No filesystem paths to backend | Only file content in uploads, not full paths |
| Local tools sandboxed | embed_images only accesses workspace files |

---

## 8. Non-Functional Requirements

| Category | Requirement | Acceptance Criteria |
|----------|-------------|---------------------|
| Performance | Activation < 2s | activate() returns within 2000ms |
| Performance | Tool proxy overhead < 500ms | Measured excluding network RTT |
| Performance | Workspace sync < 5s | For 10,000 files |
| Reliability | Auto-reconnect | 5 attempts, exponential backoff |
| Reliability | Graceful degradation | Local tools work without backend |
| Size | Extension bundle < 500KB | No backend bundled |
| Compatibility | VS Code 1.85+ | SecretStorage, WebviewPanel APIs |

---

## 9. Error Handling

| Scenario | Severity | User Message | Recovery |
|----------|----------|-------------|----------|
| Backend unreachable | Warning | "Cannot connect to backend" | Auto-retry, manual Reconnect button |
| Auth token expired | Info | (Silent refresh) | Auto-refresh, if fail show login |
| Tool call timeout | Warning | "Tool call timed out" | Retry button in notification |
| SSO callback failed | Error | "SSO login failed" | Retry SSO or use password login |
| Workspace sync failed | Warning | "Failed to sync workspace" | Auto-retry on next connect |
| Chat stream interrupted | Info | Show partial response | "Regenerate" button |
| Upload too large | Error | "Files exceed upload limit" | Suggest splitting or excluding files |

---

## 10. Sequence Diagrams

### 10.1 Connection + Auth Flow

![Sequence: Connection](diagrams/sequence-connection.png)

### 10.2 Tool Call Forwarding

![Sequence: Tool Call](diagrams/sequence-tool-call.png)

---

## 11. Appendix

### Files to Remove (from current extension)

| File | Reason |
|------|--------|
| src/extension/src/connection/BackendProcess.ts | No local process spawn |
| src/extension/providers/ContextResolverProvider.ts | Heavy provider, replaced by remote |
| src/extension/providers/FileTreeProvider.ts | Replaced by workspace sync |
| src/extension/providers/GitDiffProvider.ts | Not needed as light client |
| src/extension/providers/SpecProvider.ts | Not needed |
| src/extension/providers/SteeringProvider.ts | Not needed |
| src/extension/providers/TerminalProvider.ts | Not needed |
| src/extension/providers/CurrentFileProvider.ts | Not needed |
| src/extension/providers/DiagnosticsProvider.ts | Not needed |

### Files to Keep (refactored)

| File | Refactoring |
|------|-------------|
| ConnectionManager.ts | Remove BackendProcess dependency, add URL config, add auth headers |
| AuthManager.ts | Keep as-is (already supports remote) |
| TokenRefreshTimer.ts | Keep as-is |
| ToolProxy.ts | Add local/remote routing logic |
| FileProxyHandler.ts | Keep for local tools |
| WebviewManager.ts | Refactor data fetching to remote API |
| StatusBarManager.ts | Keep as-is |
| HttpClient.ts | Add auth header injection, support configurable base URL |

### Files to Add

| File | Purpose |
|------|---------|
| WorkspaceSyncService.ts | Scan workspace, sync to backend |
| ChatPanel.ts | Chat box webview panel |
| RemoteConfigPanel.ts | Backend URL configuration UI |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Connection State Machine | [state-connection.png](diagrams/state-connection.png) | [state-connection.drawio](diagrams/state-connection.drawio) |
| 3 | Sequence: Connection | [sequence-connection.png](diagrams/sequence-connection.png) | [sequence-connection.drawio](diagrams/sequence-connection.drawio) |
| 4 | Sequence: Tool Call | [sequence-tool-call.png](diagrams/sequence-tool-call.png) | [sequence-tool-call.drawio](diagrams/sequence-tool-call.drawio) |
