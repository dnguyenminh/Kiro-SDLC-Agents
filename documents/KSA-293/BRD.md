# Business Requirements Document (BRD)

## Kiro SDLC Agents — KSA-293: Refactor kiro-sdlc-agents Extension to Light Client of Remote Backend

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-293 |
| Title | Refactor kiro-sdlc-agents Extension to Light Client of Remote Backend |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Draft |
| Architecture Pattern | Plugin (VS Code Extension Thin Client) |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-14 | BA Agent | Initial document — generated from Jira ticket KSA-293 |

---

## 1. Introduction

### 1.1 Scope

Refactor the `kiro-sdlc-agents` VS Code extension (v1.26.0, publisher: dnguyenminh) from a self-contained monolithic extension that spawns a bundled MCP server, runs local workspace indexing (SQLite + ONNX embeddings), and manages LLM integrations locally — into a **lightweight client** that connects to a remote Kiro backend server. The extension will keep its local workspace operations (agent/steering injection) and UI (webview panels, chat, activity bar) but delegate all heavy computation (indexing, KB, tool execution, LLM inference) to the remote backend.

**Key transformation:**
- FROM: Extension spawns local MCP server (port 9181), downloads ONNX models, manages SQLite DBs, runs LangGraph locally
- TO: Extension connects to configurable remote backend URL, forwards tool calls via HTTP, uploads files for remote indexing

### 1.2 Out of Scope

- Backend server modifications (backend already has /health, /mcp/tools/*, /api/*)
- Changes to injected agent/steering files (`.kiro/agents/`, `.kiro/steering/`)
- New MCP tools on the backend
- Mobile or web clients
- Backend deployment infrastructure

### 1.3 Preliminary Requirements

- Remote Kiro backend server running and accessible via HTTP(S)
- Backend exposes: `/health`, `/mcp/tools/list`, `/mcp/tools/call`, `/api/*`, `/api/admin/auth/login`
- Backend has 52+ MCP tools (mem_*, code_*, orchestration, analytics, etc.)
- Network connectivity from user's VS Code to backend
- JWT-based authentication available on backend

---

## 2. Business Requirements

### 2.1 High Level Process Map

The refactored extension operates as a **light client** of the remote Kiro backend:

1. User activates extension in VS Code
2. Extension reads remote backend configuration (URL from settings)
3. Extension authenticates (login panel or SSO/PKCE)
4. Extension connects to remote backend, verifies health
5. Extension syncs workspace file tree to backend
6. User uses features: inject agents, webview panels, chat, symbol search, diagnostics
7. Tool calls forwarded to remote backend (52+ MCP tools)
8. Local operations (inject, embed_images) run locally as before
9. Extension displays results in webview panels / status bar

![Business Flow](diagrams/business-flow.png)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | Remove Local MCP Server Spawn | MUST HAVE | KSA-293 |
| 2 | Remove Local Indexing (SQLite + ONNX) | MUST HAVE | KSA-293 |
| 3 | Remove Native Addon Management | MUST HAVE | KSA-293 |
| 4 | Remote Backend Connection Manager | MUST HAVE | KSA-293 |
| 5 | Auth Manager + Login Panel (JWT/SSO) | MUST HAVE | KSA-293 |
| 6 | IndexingService — Upload to Remote | MUST HAVE | KSA-293 |
| 7 | WorkspaceSyncService — File Tree Sync | MUST HAVE | KSA-293 |
| 8 | MCP Tool Call Forwarding (HttpClient) | MUST HAVE | KSA-293 |
| 9 | Webview Panels — Remote Data Fetching | MUST HAVE | KSA-293 |
| 10 | Chat Panel — Remote LLM via SSE | MUST HAVE | KSA-293 |
| 11 | Keep Local Operations (Inject, Config) | MUST HAVE | KSA-293 |
| 12 | Extension Fast Activation (< 2s) | MUST HAVE | KSA-293 |
| 13 | Remove LangGraph / Anthropic SDK / Heavy Deps | SHOULD HAVE | KSA-293 |
| 14 | Remote Backend Config Panel | SHOULD HAVE | KSA-293 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Extension activates on VS Code startup (< 2 seconds, no process spawn)

**Step 2:** Extension reads configuration (`kiroSdlc.backend.url`, auth mode)

**Step 3:** If credentials stored → attempt token refresh; else → show login panel

**Step 4:** After auth → ConnectionManager establishes connection (health check)

**Step 5:** On connection → WorkspaceSyncService sends file tree to backend

**Step 6:** User injects agents/steering (local operation, unchanged)

**Step 7:** User opens webview panels → data fetched from remote `/api/*`

**Step 8:** User uses Chat Panel → messages sent to remote `/api/chat` (SSE streaming)

**Step 9:** Tool calls (from Kiro IDE / MCP clients) → forwarded to remote `/mcp/tools/call`

---

#### STORY 1: Remove Local MCP Server Spawn

> As the development team, I want the extension to NOT spawn any local MCP server so that it becomes lightweight and all heavy processing happens on the remote backend.

**Requirement Details:**

1. Remove `McpServerManager` (re-export from `mcp-server-inprocess.ts`)
2. Remove `mcp-server-inprocess.ts` — the in-process MCP server
3. Remove `mcp-server-manager-legacy.ts` — the child-process spawner
4. Remove server lifecycle management (spawn, kill, restart, port management)
5. Remove `enableMcpServer` and `mcpServerPort` settings
6. Remove `restartMcpServer`, `stopMcpServer`, `changePort` commands
7. Remove `KbEventBus` SSE connection to local server

**Files to Remove:**
- `src/mcp-server-manager.ts`
- `src/mcp-server-inprocess.ts`
- `src/mcp-server-manager-legacy.ts`
- `src/kb-event-bus.ts`

**Acceptance Criteria:**

1. No `child_process.spawn` or in-process server in extension code
2. No `McpServerManager` class reference exists
3. Extension activates without starting any local server
4. `kiroSdlc.enableMcpServer` and `kiroSdlc.mcpServerPort` settings removed
5. Server management commands removed from command palette
6. Extension package size reduced significantly

---

#### STORY 2: Remove Local Indexing (SQLite + ONNX)

> As the development team, I want local workspace indexing removed so that indexing is done remotely via file upload to the backend.

**Requirement Details:**

1. Remove `indexer.ts` — local SQLite-based workspace indexing
2. Remove `model-downloader.ts` — ONNX embedding model download
3. Remove `converter.ts` — local file-to-markdown conversion
4. Remove SQLite and ONNX runtime dependencies
5. Replace "Index Workspace" command with upload-based indexing

**Files to Remove:**
- `src/indexer.ts`
- `src/model-downloader.ts`
- `src/converter.ts`

**Acceptance Criteria:**

1. No SQLite database files created by extension
2. No ONNX model download triggered
3. "Index Workspace" command uploads files to remote backend instead
4. No `filetomarkdown` package dependency
5. `.code-intel/models/` folder no longer needed

---

#### STORY 3: Remove Native Addon Management

> As the development team, I want native addon management removed so the extension has zero native binary dependencies.

**Requirement Details:**

1. Remove `native-addon-manager.ts` — prebuilt binary resolution
2. Remove `onnx-addon-manager.ts` — ONNX Runtime resolution
3. Remove platform-specific binary handling

**Files to Remove:**
- `src/native-addon-manager.ts`
- `src/native-addon-manager.test.ts`
- `src/onnx-addon-manager.ts`

**Acceptance Criteria:**

1. No native `.node` binary resolution
2. No platform-specific download logic
3. Extension works identically on all platforms without native addons
4. Package deps reduced (no better-sqlite3, no onnxruntime-node)

---

#### STORY 4: Remote Backend Connection Manager

> As a developer, I want the extension to connect to a configurable remote backend so that I can use Kiro services from any network.

**Requirement Details:**

1. New `ConnectionManager` class — URL-based, no process dependency
2. Health check polling to remote `/health` endpoint
3. Auto-reconnect with exponential backoff (1s, 2s, 4s, 8s, 16s, max 5)
4. Connection state machine: DISCONNECTED → CONNECTING → CONNECTED
5. Status bar indicator: green/red/yellow
6. No `STARTING` state (no local process)

**Acceptance Criteria:**

1. Extension connects to backend at `kiroSdlc.backend.url` on activation
2. Status bar shows connection state
3. Auto-reconnect on connection loss
4. Manual reconnect via command palette
5. Health check interval configurable
6. Works with HTTP and HTTPS

---

#### STORY 5: Auth Manager + Login Panel (JWT/SSO)

> As a developer, I want to authenticate securely to the remote backend.

**Requirement Details:**

1. Login panel webview (username + password)
2. SSO button for PKCE OAuth flow
3. Token storage in VS Code SecretStorage
4. Automatic token refresh (TokenRefreshTimer)
5. Logout clears tokens, triggers UI update

**Acceptance Criteria:**

1. Login with username/password → JWT
2. SSO via PKCE → browser redirect → token
3. Tokens in SecretStorage (encrypted)
4. Auto-refresh before expiry
5. Logout clears credentials
6. Unauthenticated → login panel shown
7. PKCE: code_verifier (43 chars) + code_challenge (SHA-256)

---

#### STORY 6: IndexingService — Upload to Remote

> As a developer, I want to index my workspace by uploading files to the remote backend.

**Requirement Details:**

1. "Index Documents" → scans .md files, uploads to `/api/index/documents`
2. "Index Source Code" → scans source files, uploads to `/api/index/source`
3. Multipart/form-data with progress
4. Respects `.gitignore`
5. Timeout: 600s

**Acceptance Criteria:**

1. "Kiro SDLC: Index Documents" uploads .md files
2. "Kiro SDLC: Index Source Code" uploads source files
3. Progress bar during upload
4. `.gitignore` respected
5. Completion notification
6. Requires auth

---

#### STORY 7: WorkspaceSyncService — File Tree Sync

> As a developer, I want the extension to sync workspace structure to the backend.

**Requirement Details:**

1. On connection → scan workspace file tree
2. Send to `/api/workspace/sync` (paths, types, sizes)
3. Re-sync on folder change
4. Respects `.gitignore`
5. Paths-only (lightweight)

**Acceptance Criteria:**

1. File tree sent within 5s of connection
2. JSON structure with relative paths
3. Re-syncs on workspace folder change
4. `.gitignore` respected
5. Does not block activation

---

#### STORY 8: MCP Tool Call Forwarding (HttpClient)

> As a developer, I want all MCP tool calls forwarded to the remote backend.

**Requirement Details:**

1. HttpClient with configurable baseUrl and auth injection
2. Tool calls → `POST /mcp/tools/call` with Bearer token
3. Tool list refresh from `/mcp/tools/list`
4. Timeout: 300s for tool calls
5. Local tools (embed_images) execute locally

**Acceptance Criteria:**

1. All 52+ backend tools accessible
2. Auth token in all requests
3. 5-minute timeout
4. Local tools work when disconnected
5. 401 → refresh token, retry once
6. Tool list refreshed on reconnect

---

#### STORY 9: Webview Panels — Remote Data Fetching

> As a developer, I want webview panels to fetch data from the remote backend.

**Requirement Details:**

1. All panels (Dashboard, Graph, Quality, Tags, Analytics, Security, Workflow) fetch from `/api/*`
2. Auth token included
3. Loading/error states

**Acceptance Criteria:**

1. All 7 panels display remote data
2. Loading spinners
3. Error + Retry on failure
4. Refresh on reconnect
5. No local SQLite queries
6. Panels disabled when unauthenticated

---

#### STORY 10: Chat Panel — Remote LLM via SSE

> As a developer, I want chat to use the remote backend for AI processing.

**Requirement Details:**

1. Messages → `POST /api/chat` with context
2. SSE streaming response
3. Context attachment via "#" trigger
4. Remove local LangGraph/Anthropic SDK
5. 120s timeout

**Files to Remove:**
- `src/langgraph/` (entire directory)
- `src/anthropic/` (entire directory)
- `src/chat-panel/chat-models.ts`

**Acceptance Criteria:**

1. Chat sends to remote `/api/chat`
2. Streaming responses via SSE
3. "#" context trigger works
4. No @anthropic-ai/sdk dependency
5. Requires auth
6. 120s timeout

---

#### STORY 11: Keep Local Operations

> As the development team, I want local ops (inject, config) to continue unchanged.

**KEEP files:**
- `src/injector.ts`, `src/mcp-injector.ts`
- `src/config-watcher.ts`, `src/config.ts`
- `src/diagnostics-provider.ts`
- `src/symbol-search.ts` (forward to remote)
- `src/ai-context-commands.ts` (forward to remote)
- `src/sidebar/tree-view-provider.ts`
- `src/checksum.ts`

**Acceptance Criteria:**

1. "Inject All" works identically
2. Config watcher works
3. Symbol search forwards to remote
4. Tree view adapted for remote status

---

#### STORY 12: Extension Fast Activation (< 2s)

> As a developer, I want < 2s activation with no blocking.

**Acceptance Criteria:**

1. `activate()` returns in < 100ms
2. No server spawn, no model download
3. Panels lazy-loaded
4. Total ready time < 2s

---

#### STORY 13: Remove Heavy Dependencies

> As the development team, I want heavy deps removed for small bundle.

**Remove from package.json:**
- `@anthropic-ai/sdk`
- `@langchain/core`, `@langchain/langgraph`
- `3d-force-graph`, `three` (→ CDN)
- `chart.js` (→ CDN)
- `filetomarkdown`

**Acceptance Criteria:**

1. Zero AI SDK dependencies
2. `.vsix` < 1MB
3. Webview libs from CDN
4. esbuild output < 500KB

---

#### STORY 14: Remote Backend Config Panel

> As a developer, I want a UI to configure backend URL.

**Acceptance Criteria:**

1. "Kiro SDLC: Configure Backend" opens panel
2. URL input with validation
3. "Test Connection" button
4. Save triggers reconnect

---

## 3. Dependencies

| Dependency | Type | Description |
|------------|------|-------------|
| Remote Kiro Backend | Infrastructure | Must be running with 52+ MCP tools |
| VS Code API v1.85+ | System | SecretStorage, Webview, StatusBar |
| Network Connectivity | Infrastructure | HTTP(S) to backend |
| Backend Auth (JWT) | External | `/api/admin/auth/login` |
| KSA-292 Patterns | Reference | ConnectionManager, HttpClient, AuthManager architecture |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | dnguyenminh | Approve, publish extension |
| Developer | Extension Team | Implement refactoring |
| End Users | Developers using Kiro SDLC | Use refactored extension |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Network latency degrades UX | High | Medium | Caching, optimistic UI, streaming |
| Backend unavailability | High | Low | Graceful degradation, retry |
| LangGraph removal breaks chat | Medium | Medium | Phase out, test thoroughly |
| Token leak | High | Low | SecretStorage, HTTPS, no logging |
| Large workspace upload timeout | Medium | Medium | Chunked upload, progress |

### 5.2 Assumptions

- Backend server deployed and accessible
- Backend API contract stable
- Users have network access to backend
- No fully offline mode (backend required)
- KSA-292 patterns reusable

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Activation < 2s | No blocking, no spawn |
| Performance | Tool call overhead < 500ms | Minimal proxy latency |
| Performance | Bundle < 500KB | Remove heavy deps |
| Security | SecretStorage tokens | OS-encrypted |
| Security | HTTPS support | Encrypted communication |
| Security | PKCE S256 | OAuth security |
| Reliability | Auto-reconnect | Exponential backoff, 5 retries |
| Reliability | Graceful degradation | Local ops without backend |
| Compatibility | VS Code 1.85+ | Minimum version |
| Compatibility | All platforms | No native addons |

---

## 7. Related Tickets

| Ticket Key | Summary | Type | Relationship |
|------------|---------|------|--------------|
| KSA-293 | Refactor kiro-sdlc-agents to Light Client | Story | Main ticket |
| KSA-292 | Refactor Code Intelligence Extension to Light Client | Story | Reference pattern |

---

## 8. Appendix

### Architecture Comparison

| Aspect | Current (v1.26.0) | Target (v2.0.0) |
|--------|-------------------|-----------------|
| MCP Server | Local (spawned, port 9181) | Remote (configurable URL) |
| Indexing | Local SQLite + ONNX | Upload to remote |
| LLM | Local (Anthropic, LangGraph, Ollama) | Remote (/api/chat) |
| Native Addons | better-sqlite3, onnxruntime | None |
| Package Size | ~5MB+ | < 500KB |
| Offline | Full | Local inject only |
| Auth | Not required | Required (JWT + SSO) |
| Chat | Local LangGraph | Remote SSE |
| Panels | Local SQLite | Remote /api/* |

### Glossary

| Term | Definition |
|------|------------|
| Light Client | Thin proxy extension — no heavy local processing |
| MCP | Model Context Protocol — tool communication |
| PKCE | Proof Key for Code Exchange — OAuth security |
| SSE | Server-Sent Events — streaming protocol |
| LangGraph | LangChain graph agent framework (removed) |
| ONNX | Open Neural Network Exchange (removed) |

### Use Case Diagram

![Use Case Diagram](diagrams/use-case.png)

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
