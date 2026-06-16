# Business Requirements Document (BRD)

## Code Intelligence Extension — KSA-292: Refactor Extension to Light Client of Remote Backend Server

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-292 |
| Title | Refactor Extension to Light Client of Remote Backend Server |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-292.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-14 | BA Agent | Initial document — generated from Jira ticket KSA-292 |

---

## 1. Introduction

### 1.1 Scope

This document defines the business requirements for refactoring the Code Intelligence VS Code extension from a self-contained monolithic extension (that spawns and manages a local backend process) into a lightweight client that connects to a **remote** backend server. The extension will no longer bundle or manage a backend process; instead, it will act as a thin proxy/UI layer communicating with a configurable remote backend via HTTP/REST.

**Key transformation:**
- FROM: Extension spawns `BackendProcess`, manages lifecycle, accesses filesystem directly
- TO: Extension connects to remote backend URL, forwards tool calls, syncs workspace data via upload

### 1.2 Out of Scope

- Backend server modifications (backend stays as-is, already supports HTTP API)
- Admin portal changes
- New MCP tools on the backend
- Mobile or web-based clients
- Multi-user concurrent editing
- Backend deployment infrastructure (Docker, K8s)

### 1.3 Preliminary Requirements

- Remote backend server must be running and accessible via HTTP
- Backend must expose `/health`, `/mcp/tools/list`, `/mcp/tools/call`, and `/api/*` endpoints
- Network connectivity from user's VS Code to backend server
- Backend must support token-based authentication (JWT)

---

## 2. Business Requirements

### 2.1 High Level Process Map

The refactored extension operates as a **light client** with the following core flow:

1. User activates extension in VS Code
2. Extension reads remote backend configuration (URL, auth settings)
3. Extension authenticates (local login or SSO/PKCE)
4. Extension establishes connection to remote backend
5. Extension syncs workspace structure to backend
6. User interacts with panels (dashboard, graph, quality, tags, chat)
7. All data requests forwarded to remote backend
8. Local tools (embed_images) execute locally
9. Extension displays results from backend in webview panels

![Business Flow](diagrams/business-flow.png)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | Remote Backend Connection | MUST HAVE | KSA-292 |
| 2 | Remove Backend Process Spawn | MUST HAVE | KSA-292 |
| 3 | File/Source Indexing via Upload | MUST HAVE | KSA-292 |
| 4 | Workspace Structure Sync | MUST HAVE | KSA-292 |
| 5 | MCP Tool Call Forwarding | MUST HAVE | KSA-292 |
| 6 | Local Tool Execution | MUST HAVE | KSA-292 |
| 7 | Webview Panels Remote Data | MUST HAVE | KSA-292 |
| 8 | Chat Box UI | MUST HAVE | KSA-292 |
| 9 | Auth: Local Login + SSO PKCE | MUST HAVE | KSA-292 |
| 10 | Extension Fast Activation | MUST HAVE | KSA-292 |
| 11 | Remote Backend Config UI | SHOULD HAVE | KSA-292 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Extension activates on VS Code startup (< 2 seconds)

**Step 2:** Extension reads configuration (remote backend URL, port, auth mode)

**Step 3:** If user has stored credentials → attempt token refresh; else → show login panel

**Step 4:** After successful auth → establish connection to remote backend

**Step 5:** On connection → sync workspace file tree structure to backend

**Step 6:** User interacts with panels, chat box, or triggers tool calls

**Step 7:** All requests forwarded to remote backend (except local tools)

**Step 8:** Backend processes requests and returns results

**Step 9:** Extension renders results in webview panels

---

#### STORY 1: Remote Backend Connection

> As a developer, I want the extension to connect to a configurable remote backend server so that I can use code intelligence services without running a local server.

**Requirement Details:**

1. Extension configuration must support `codeIntel.backend.url` (full URL, e.g., `https://backend.company.com`)
2. Extension must support both HTTP and HTTPS connections
3. Connection must include authentication headers (Bearer token)
4. Health check polling to detect connection loss
5. Auto-reconnect with exponential backoff on connection failure
6. Visual indicator of connection status in status bar

**Acceptance Criteria:**

1. Extension connects to backend at configured URL on activation
2. Connection status shows "Connected" with green indicator when successful
3. Connection status shows "Disconnected" with red indicator on failure
4. Extension automatically retries connection on failure (max 5 retries, exponential backoff)
5. User can manually trigger reconnect via command palette
6. Extension works with both `http://` and `https://` URLs

---

#### STORY 2: Remove Backend Process Spawn

> As a developer, I want the extension to not spawn any local backend process so that resource usage is minimal and the extension is lightweight.

**Requirement Details:**

1. Remove `BackendProcess.ts` completely
2. Remove `autoStart` configuration option
3. Remove process management (spawn, kill, restart) logic
4. Remove `ContextResolverProvider.ts` and all heavy providers in `providers/` folder
5. Remove `ContextMessageHandler` from `message-handler/`
6. Remove filesystem-access-dependent providers: FileTreeProvider, GitDiffProvider, SpecProvider, SteeringProvider, TerminalProvider, CurrentFileProvider, DiagnosticsProvider

**Files to Remove:**
- `src/extension/src/connection/BackendProcess.ts`
- `src/extension/providers/ContextResolverProvider.ts`
- `src/extension/providers/FileTreeProvider.ts`
- `src/extension/providers/GitDiffProvider.ts`
- `src/extension/providers/SpecProvider.ts`
- `src/extension/providers/SteeringProvider.ts`
- `src/extension/providers/TerminalProvider.ts`
- `src/extension/providers/CurrentFileProvider.ts`
- `src/extension/providers/DiagnosticsProvider.ts`
- `src/extension/message-handler/ContextMessageHandler.ts`

**Acceptance Criteria:**

1. No `child_process.spawn` or `child_process.exec` calls in extension code
2. No `BackendProcess` class or reference exists
3. Extension activates without attempting to start any local process
4. `codeIntel.backend.autoStart` and `codeIntel.backend.backendPath` settings removed
5. Extension package size reduced (no bundled backend)

---

#### STORY 3: File/Source Indexing via Upload

> As a developer, I want to index my workspace documents and source code by uploading them to the remote backend so that the backend can build its knowledge base.

**Requirement Details:**

1. "Index Documents" command collects markdown files from workspace and uploads to backend
2. "Index Source Code" command collects source files and uploads to backend
3. Upload uses multipart/form-data or chunked streaming for large files
4. Progress indicator shows upload progress
5. Backend returns indexing status (queued, processing, complete)
6. User can trigger re-index manually

**Acceptance Criteria:**

1. User can trigger "Code Intel: Index Documents" from command palette
2. Extension scans workspace for `.md` files and uploads to backend `/api/index/documents`
3. User can trigger "Code Intel: Index Source Code" from command palette
4. Extension scans workspace for source files (respecting `.gitignore`) and uploads to backend `/api/index/source`
5. Progress bar shows during upload
6. Notification shown on completion with file count

---

#### STORY 4: Workspace Structure Sync

> As a developer, I want the extension to automatically send my workspace structure to the remote backend on connection so that the backend knows about my project layout.

**Requirement Details:**

1. On successful connection, extension scans workspace file tree
2. File tree (paths only, no content) sent to backend via `/api/workspace/sync`
3. Sync happens on connect and on workspace folder change
4. Respects `.gitignore` patterns (no `node_modules`, `dist`, `.git`)
5. Lightweight — only paths and metadata, not file contents

**Acceptance Criteria:**

1. Workspace structure sent to backend within 5 seconds of connection
2. Backend receives JSON structure with file paths, types, sizes
3. File tree re-synced when workspace folders change (add/remove)
4. `.gitignore` patterns respected
5. Sync does not block extension activation

---

#### STORY 5: MCP Tool Call Forwarding

> As a developer, I want all MCP tool calls to be forwarded to the remote backend so that I can use all 52 tools through the extension.

**Requirement Details:**

1. `ToolProxy` intercepts tool calls from MCP clients (Kiro, Copilot, etc.)
2. Tool calls forwarded to backend `/mcp/tools/call` with proper auth headers
3. Tool results returned to calling client
4. Timeout handling (30s default, configurable)
5. Error responses properly mapped to MCP error format

**Acceptance Criteria:**

1. All 52 backend tools accessible via extension proxy
2. Tool call latency < 500ms overhead (network excluded)
3. Timeout errors properly reported to calling client
4. Auth token included in all forwarded requests
5. Tool list refreshed on reconnect

---

#### STORY 6: Local Tool Execution

> As a developer, I want certain tools (embed_images) to execute locally so that operations requiring local file access work without round-trip to backend.

**Requirement Details:**

1. `embed_images` tool executes locally (reads local files, embeds base64)
2. Local tools registered separately from remote tools
3. `FileProxyHandler` handles local file operations
4. Clear separation: local tools never forwarded to backend

**Acceptance Criteria:**

1. `embed_images` works when backend is disconnected
2. Local tool execution does not require auth token
3. Local tools clearly marked in tool list response
4. No local filesystem paths leaked to remote backend

---

#### STORY 7: Webview Panels Remote Data

> As a developer, I want all webview panels (dashboard, graph, quality, tags) to fetch data from the remote backend so that I see up-to-date information.

**Requirement Details:**

1. Dashboard panel fetches data from `/api/dashboard`
2. KB Graph panel fetches from `/api/graph`
3. Quality panel fetches from `/api/quality`
4. Tags panel fetches from `/api/tags`
5. Analytics panel fetches from `/api/analytics`
6. All panel data requests include auth token
7. Loading states shown while fetching
8. Error states shown on failure with retry option

**Acceptance Criteria:**

1. All 5 panels display data from remote backend
2. Panels show loading spinner while fetching
3. Panels show error message with "Retry" button on failure
4. Panel data refreshes on manual trigger or on reconnect
5. No local database queries from panels

---

#### STORY 8: Chat Box UI

> As a developer, I want a chat box panel in VS Code so that I can interact with the AI assistant directly within the extension.

**Requirement Details:**

1. New webview panel: Chat Box (similar to Copilot Chat)
2. Input field for user messages
3. Markdown rendering for AI responses
4. Context menu ("#" trigger) for attaching files, specs, git diff, etc.
5. Message history (session-based, stored in backend)
6. Streaming response support (SSE from backend)
7. Code block syntax highlighting in responses

**Acceptance Criteria:**

1. Chat box opens via command palette "Code Intel: Open Chat"
2. User can type message and receive AI response
3. Chat supports markdown rendering with code highlighting
4. "#" trigger shows context menu for file/spec/git attachment
5. Responses stream in real-time (character by character or chunk)
6. Chat history persists during VS Code session
7. Chat respects auth (requires login)

---

#### STORY 9: Auth: Local Login + SSO PKCE

> As a developer, I want to authenticate via local login or SSO (PKCE) so that my access to the backend is secure.

**Requirement Details:**

1. Login panel webview with username/password fields
2. SSO button initiates PKCE OAuth flow (opens browser)
3. Token storage in VS Code SecretStorage (secure)
4. Automatic token refresh before expiry
5. Logout clears tokens locally and invalidates on backend
6. Auth state change triggers UI updates (panels reload, etc.)

**Acceptance Criteria:**

1. User can login with username/password via login panel
2. User can login via SSO (redirects to browser, callback to extension)
3. Tokens stored securely (not in plaintext settings)
4. Token auto-refreshes before expiry (no user interruption)
5. Logout clears all stored credentials
6. Unauthenticated state shows login panel automatically
7. PKCE flow uses random code_verifier and code_challenge (S256)

---

#### STORY 10: Extension Fast Activation

> As a developer, I want the extension to activate in under 2 seconds so that it doesn't slow down VS Code startup.

**Requirement Details:**

1. Activation creates UI elements synchronously (status bar, command registrations)
2. All network operations (auth, connect, sync) are async/non-blocking
3. No heavy imports at top level
4. Lazy loading for webview panels
5. No local process spawn on activation

**Acceptance Criteria:**

1. `activate()` function returns in < 2 seconds (measured)
2. Status bar visible immediately on activation
3. Commands registered immediately (even before connection)
4. Panels lazy-loaded on first open
5. No user-visible delay on VS Code startup

---

#### STORY 11: Remote Backend Config UI

> As a developer, I want a settings UI to configure the remote backend URL so that I can easily switch between environments.

**Requirement Details:**

1. VS Code settings: `codeIntel.backend.url` (string, full URL)
2. Settings UI panel with URL input, test connection button
3. Support for environment-specific configs (dev, staging, prod)
4. Connection test validates URL and auth before saving

**Acceptance Criteria:**

1. User can set backend URL in VS Code settings
2. "Test Connection" button validates URL accessibility
3. Invalid URL shows error message
4. Changed URL triggers reconnect to new backend
5. Default URL configurable via workspace settings (per-project)

---

## 3. Dependencies

| Dependency | Type | Description |
|------------|------|-------------|
| Remote Backend Server | Infrastructure | Backend must be running and accessible at configured URL |
| VS Code API v1.85+ | System | Required for SecretStorage, Webview, StatusBar APIs |
| Network Connectivity | Infrastructure | User must have network access to backend server |
| Auth Server (SSO) | External | For PKCE flow, requires OAuth provider configured on backend |
| Backend API Stability | System | Backend API endpoints must remain stable (v1 contract) |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | Development Team Lead | Approve requirements, accept UAT |
| Developer | Extension Team | Implement refactoring |
| DevOps | Infrastructure Team | Backend server hosting |
| End Users | All developers using the extension | Use the refactored extension |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Network latency degrades UX | High | Medium | Implement caching, optimistic UI, streaming |
| Backend unavailability | High | Low | Graceful degradation, clear error messages, retry logic |
| Auth token leak | High | Low | Use SecretStorage, never log tokens, HTTPS enforced |
| Breaking change in backend API | Medium | Low | Version API contracts, backward compatibility |
| Large workspace sync timeout | Medium | Medium | Chunked upload, background sync, progress feedback |

### 5.2 Assumptions

- Backend server is already deployed and accessible (infrastructure managed separately)
- Backend API contract (`/health`, `/mcp/tools/call`, `/api/*`) is stable
- Users have sufficient network bandwidth (>1 Mbps) to backend
- SSO provider is pre-configured on backend side
- Extension will NOT support offline mode (backend required for all features except local tools)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Extension activation < 2s | No blocking operations in activate() |
| Performance | Tool call overhead < 500ms | Proxy adds minimal latency |
| Performance | Workspace sync < 5s | For projects up to 10,000 files |
| Security | Token stored in SecretStorage | VS Code encrypted secret store |
| Security | HTTPS supported | All remote communication encrypted |
| Security | PKCE with S256 | OAuth flow uses SHA-256 code challenge |
| Reliability | Auto-reconnect | Exponential backoff, max 5 retries |
| Reliability | Graceful degradation | Extension usable (limited) without backend |
| Usability | Clear connection status | StatusBar shows connected/disconnected |
| Usability | Error messages actionable | Include retry/reconfigure options |
| Compatibility | VS Code 1.85+ | Minimum supported version |
| Maintainability | Extension bundle < 500KB | No bundled backend, minimal dependencies |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-292 | Refactor Extension to Light Client of Remote Backend Server | In Progress | Story | Main ticket |
| KSA-285 | Auth Manager + Login Panel + MCP Config | Done | Story | Predecessor (auth system) |

---

## 8. Appendix

### Architecture Comparison

| Aspect | Current (v1.1.0) | Target (v2.0.0) |
|--------|-------------------|-----------------|
| Backend location | Local (spawned by extension) | Remote (configurable URL) |
| Backend lifecycle | Extension manages (start/stop) | External (always running) |
| Data access | Direct filesystem | Upload/API |
| Auth | Not required (localhost) | Required (JWT + SSO) |
| Extension size | ~5MB (includes backend) | < 500KB (client only) |
| Offline capability | Full | Local tools only |
| Multi-user | No (single user) | Yes (shared backend) |

### Glossary

| Term | Definition |
|------|------------|
| Light Client | Extension that acts as thin proxy, no heavy processing |
| MCP | Model Context Protocol — tool communication standard |
| PKCE | Proof Key for Code Exchange — OAuth security extension |
| SSO | Single Sign-On — authenticate via external provider |
| Tool Proxy | Component that forwards tool calls to backend |
| Workspace Sync | Sending file tree structure to backend for context |

### Use Case Diagram

![Use Case Diagram](diagrams/use-case.png)

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
