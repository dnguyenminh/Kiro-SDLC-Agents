# Release Notes (RLN)

## Kiro SDLC Agents — KSA-293: Extension v2.0.0 — Light Client Architecture

---

## Release Information

| Field | Value |
|-------|-------|
| Version | 2.0.0 |
| Release Date | 2025-07-14 |
| Jira Ticket | KSA-293 |
| Type | Major (Breaking Architecture Change) |
| Previous Version | 1.26.0 |

---

## Summary

**Complete architectural refactor** of the `kiro-sdlc-agents` VS Code extension from a self-contained monolith (local MCP server, SQLite, ONNX embeddings, native binaries) into a **lightweight thin client** that connects to a remote Kiro backend server. All heavy computation (indexing, KB, tool execution, LLM inference) is now delegated to the remote backend.

**Impact:** Bundle size reduced from ~150MB → < 500KB. Activation time reduced from 5-10s → < 2s.

---

## Breaking Changes

### Removed Components

| Component | Replacement |
|-----------|-------------|
| Local MCP server (in-process + child-process) | Remote backend at configurable URL |
| SQLite databases (`.code-intel/*.db`) | Remote backend handles all storage |
| ONNX embedding models (90-470MB) | Remote backend runs embeddings |
| Native binary addons (better-sqlite3, onnxruntime) | Zero native dependencies |
| LangGraph / Anthropic SDK | Remote backend handles LLM |
| KbEventBus (local SSE) | Remote SSE streaming |

### Removed Settings

| Setting | Reason |
|---------|--------|
| `kiroSdlc.enableMcpServer` | No local server |
| `kiroSdlc.mcpServerPort` | No local port |

### Removed Commands

| Command | Reason |
|---------|--------|
| Restart MCP Server | No local server |
| Stop MCP Server | No local server |
| Change Port | No local port |
| Download Embedding Model | Remote backend handles |

---

## New Features

### Remote Backend Connection Manager
- Configurable backend URL (`kiroSdlc.backend.url`)
- Health check polling with status bar indicator (green/red/yellow)
- Auto-reconnect with exponential backoff (1s, 2s, 4s, 8s, 16s)
- Connection state machine: DISCONNECTED → CONNECTING → CONNECTED

### Authentication (JWT + SSO)
- Login panel webview (username + password)
- SSO via PKCE OAuth flow (browser redirect)
- Tokens stored securely in VS Code SecretStorage
- Automatic token refresh before expiry
- Logout clears all credentials

### Remote Indexing via Upload
- "Index Documents" — uploads .md files to backend
- "Index Source Code" — uploads source files to backend
- Multipart/form-data with progress bar
- Respects `.gitignore`

### Workspace Sync
- Automatic file tree sync on connection
- Re-syncs on workspace folder changes
- Lightweight (paths only, no file content)

### MCP Tool Call Forwarding
- All 52+ backend tools accessible via HTTP forwarding
- Bearer token auth on all requests
- 5-minute timeout for tool calls
- Local tools (embed_images, inject) still execute locally
- Auto-retry on 401 (token refresh)

### Remote Webview Panels
- All 7 panels (Dashboard, Graph, Quality, Tags, Analytics, Security, Workflow) fetch from remote `/api/*`
- Loading spinners and error states
- Auto-refresh on reconnect

### Remote Chat (SSE Streaming)
- Messages sent to remote `/api/chat`
- SSE streaming responses from remote LLM
- Context attachment via "#" trigger
- No local LLM SDK dependencies

---

## Technical Details

- **Architecture**: VS Code Extension (Thin Client) → Remote Backend (HTTP/SSE)
- **Language**: TypeScript 5.4+
- **Runtime**: VS Code Extension Host (Node.js 18+)
- **HTTP Client**: Native `fetch` (Node 18+)
- **Auth**: VS Code SecretStorage + JWT
- **Streaming**: ReadableStream / Server-Sent Events
- **Build**: esbuild (< 500KB bundle)
- **Testing**: Vitest + Mocha

---

## Performance Improvements

| Metric | Before (v1.26.0) | After (v2.0.0) |
|--------|-------------------|-----------------|
| Bundle size | ~150MB (with native addons) | < 500KB |
| Activation time | 5-10s (server spawn) | < 2s |
| Dependencies | 200+ (incl. native) | ~20 (pure JS) |
| Platform binaries | 6 platforms x 2 addons | None |
| Disk usage (.code-intel) | ~500MB | 0 (remote) |

---

## Known Limitations

- Requires network connectivity to remote backend for most features
- Local-only operations: agent/steering injection, embed_images, config editing
- Backend must be running and accessible
- SSO requires browser access for PKCE flow
- First workspace sync may take 5-10s for large projects

---

## Dependencies

| Dependency | Version | Purpose |
|-----------|---------|---------|
| Remote Kiro Backend | Running | All heavy computation |
| VS Code / Kiro IDE | >= 1.85 | Extension host |
| Node.js | >= 18 | Native fetch support |

---

## Upgrade Instructions

1. Build new extension: `cd kiro-sdlc-agents && npm install && npm run package`
2. Install: `code --install-extension kiro-sdlc-agents-2.0.0.vsix`
3. Configure backend URL in settings
4. Login via "Kiro SDLC: Login" command
5. Optional: Delete `.code-intel/models/` to reclaim disk space

See Deployment Guide (DPG-v1-KSA-293.docx) for complete step-by-step instructions.
