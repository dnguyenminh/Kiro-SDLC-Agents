# User Guide (UG)

## Code Intelligence Extension — KSA-292: Refactor Extension to Light Client of Remote Backend Server

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-292 |
| Title | Refactor Extension to Light Client of Remote Backend Server |
| Author | DEV Agent |
| Reviewer | BA Agent |
| Version | 1.0 |
| Date | 2025-07-15 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-292.docx |
| Related FSD | FSD-v1-KSA-292.docx |
| Related TDD | TDD-v1-KSA-292.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-15 | DEV Agent | Initial document |

---

## 1. Introduction

### 1.1 Purpose

This guide describes how to install, configure, and use the **Code Intelligence VS Code Extension v2.0.0** — a lightweight client that connects to a remote Code Intelligence backend server. The extension provides AI-assisted development tools, knowledge base access, workspace indexing, and an AI chat interface, all powered by a remote backend.

### 1.2 Audience

| Audience | What They Need |
|----------|---------------|
| Developer (End User) | How to install, connect, and use all extension features |
| System Administrator | How to configure backend URL, SSO, and manage settings |
| AI Tool User (MCP Clients) | How tools are exposed and can be called via Kiro/Copilot |

### 1.3 Prerequisites

| Prerequisite | Version | Required |
|-------------|---------|----------|
| VS Code | 1.85+ | Yes |
| Remote Backend Server | Running and accessible | Yes |
| Network connectivity | HTTP/HTTPS to backend | Yes |
| SSO Provider | OAuth 2.0 compatible | Only if SSO enabled |

---

## 2. Getting Started

### 2.1 Quick Start

```
# Step 1: Install the extension
Install "Code Intelligence" from VS Code Extensions marketplace
(or install from .vsix file: code --install-extension code-intel-extension-2.0.0.vsix)

# Step 2: Configure backend URL
Open VS Code Settings > search "codeIntel.backend.url"
Set to your backend URL (e.g., https://backend.company.com)

# Step 3: Login
Command Palette (Ctrl+Shift+P) > "Code Intel: Login"
Enter username + password, or click "SSO Login"

# Step 4: Verify
Check status bar — green "Connected" indicator means success
Command Palette > "Code Intel: Show Connection Status"
```

### 2.2 System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| VS Code | 1.85.0 | Latest stable |
| OS | Windows 10 / macOS 12 / Linux (glibc 2.17+) | Any VS Code-supported OS |
| Memory | 100MB (extension only) | 200MB |
| Network | 1 Mbps to backend | 10 Mbps |
| Disk | 5MB (extension bundle) | 10MB |

### 2.3 Distribution Formats

| Format | How to Get | Use Case |
|--------|-----------|----------|
| VS Code Marketplace | Search "Code Intelligence" in Extensions | Standard install |
| .vsix file | Download from release page | Offline / air-gapped install |

### 2.4 Configuration Methods

| Method | Priority | Best For |
|--------|----------|----------|
| VS Code Settings (User) | 1 (lowest) | Global defaults |
| VS Code Settings (Workspace) | 2 (highest) | Per-project backend override |

All settings are under the `codeIntel.backend.*` namespace.

### 2.5 Verify Configuration

After configuring and logging in:

1. **Status bar shows green "Connected"** — extension connected to backend
2. **Command Palette > "Code Intel: Show Connection Status"** — shows version + auth status
3. **Open Output panel** (View > Output > select "Code Intelligence") — check for:
   ```
   [ConnectionManager] State: DISCONNECTED -> CONNECTING
   [ConnectionManager] Connected to Backend v1.5.0 (52 tools)
   [ToolProxy] Registered 52 tools
   [WorkspaceSync] Workspace synced: 1234 files
   ```

**Common issues:**

| Symptom | Cause | Fix |
|---------|-------|-----|
| Status bar shows red "Disconnected" | Backend URL wrong or server down | Verify backend URL, check backend is running |
| "Authentication required" error | Token expired or not logged in | Run "Code Intel: Login" |
| "Cannot connect" after 5 retries | Network issue or firewall | Check network, try curl {url}/health |

---

## 3. Configuration

### 3.1 Configuration File

Settings are managed through VS Code's built-in settings system:
- **User settings**: `%APPDATA%/Code/User/settings.json` (Windows) or `~/.config/Code/User/settings.json` (Linux)
- **Workspace settings**: `.vscode/settings.json` in your project root

### 3.2 Configuration Reference

#### Connection Settings

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `codeIntel.backend.url` | string | `http://127.0.0.1:48721` | Full URL of remote backend server |
| `codeIntel.backend.healthCheckInterval` | number | `5000` | Health check polling interval in milliseconds (1000-60000) |
| `codeIntel.backend.toolCallTimeout` | number | `300000` | Timeout for tool calls in milliseconds (10000-900000) |
| `codeIntel.backend.chatTimeout` | number | `120000` | Timeout for AI chat responses in milliseconds (10000-600000) |

#### Authentication Settings

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `codeIntel.backend.ssoEnabled` | boolean | `false` | Enable SSO authentication via PKCE flow |
| `codeIntel.backend.ssoProviderUrl` | string | `""` | SSO provider URL (required when ssoEnabled is true) |

### 3.3 Environment Variables

The extension does not read environment variables directly. All configuration is via VS Code settings.

### 3.4 Configuration Examples

#### Minimal Configuration (Local Backend)

```json
{
  "codeIntel.backend.url": "http://127.0.0.1:48721"
}
```

#### Remote Backend (Enterprise)

```json
{
  "codeIntel.backend.url": "https://codeintel.company.com",
  "codeIntel.backend.ssoEnabled": true,
  "codeIntel.backend.ssoProviderUrl": "https://sso.company.com/realms/dev",
  "codeIntel.backend.healthCheckInterval": 10000,
  "codeIntel.backend.toolCallTimeout": 300000,
  "codeIntel.backend.chatTimeout": 120000
}
```

#### Per-Project Override (.vscode/settings.json)

```json
{
  "codeIntel.backend.url": "https://staging-codeintel.company.com"
}
```

---

## 4. Usage

### 4.1 Connection Management

**Description:** The extension automatically connects to the remote backend on startup. If the connection drops, it auto-reconnects with exponential backoff (1s, 2s, 4s, 8s, 16s — max 5 attempts).

**Commands:**

| Command | Description |
|---------|-------------|
| `Code Intel: Reconnect to Backend` | Force reconnect (disconnect + connect) |
| `Code Intel: Disconnect from Backend` | Disconnect (stops health polling) |
| `Code Intel: Show Connection Status` | Show current state, version, auth status |
| `Code Intel: Configure Backend` | Open VS Code settings for backend URL |

**Connection States:**

| State | Status Bar | Description |
|-------|-----------|-------------|
| DISCONNECTED | Red | No connection to backend |
| CONNECTING | Yellow | Attempting connection |
| CONNECTED | Green | Active connection, tools available |

### 4.2 Authentication

**Description:** The extension requires authentication to access backend services. Two methods are supported: local login (username/password) and SSO (PKCE).

#### Local Login

1. Command Palette > **"Code Intel: Login"**
2. Login panel opens in editor
3. Enter username and password
4. Click "Login"
5. On success: panel closes, status bar turns green

#### SSO Login (PKCE)

1. Enable SSO in settings: `codeIntel.backend.ssoEnabled = true`
2. Set provider URL: `codeIntel.backend.ssoProviderUrl = "https://sso.company.com/..."`
3. Command Palette > **"Code Intel: Login"**
4. Click "SSO Login" button
5. Browser opens — authenticate with your company credentials
6. Browser redirects back to VS Code automatically
7. Extension receives token via callback URI

#### Logout

- Command Palette > **"Code Intel: Logout"**
- Clears stored tokens locally and invalidates refresh token on backend

#### Token Management

- Tokens stored securely in VS Code's SecretStorage (OS-encrypted keychain)
- Access token auto-refreshes 5 minutes before expiry (no user interruption)
- If refresh fails, login panel shows automatically

### 4.3 MCP Tool Calls (AI Assistant Integration)

**Description:** The extension exposes 50+ code intelligence tools to MCP clients (Kiro, GitHub Copilot, etc.). Tools are registered with VS Code's Language Model API and can be called by AI assistants.

**How it works:**
1. Extension connects to backend — fetches tool list from `/mcp/tools/list`
2. Each tool is registered with VS Code's `vscode.lm.registerTool()`
3. AI assistants (Kiro, Copilot) can call tools through the VS Code LM API
4. Extension forwards tool calls to backend `/mcp/tools/call`

**Local vs Remote Tools:**

| Tool | Execution | Backend Required |
|------|-----------|-----------------|
| `embed_images` | Local (extension) | No |
| All other tools (52) | Remote (backend) | Yes |

**Error Codes:**

| Code | Description |
|------|-------------|
| BACKEND_UNAVAILABLE | Backend not connected — reconnect |
| AUTH_REQUIRED | Token expired — login again |
| RATE_LIMITED | Too many requests — wait and retry |
| TIMEOUT | Tool call exceeded timeout — increase `toolCallTimeout` |
| TOOL_NOT_FOUND | Tool doesn't exist on backend |

### 4.4 Workspace Sync

**Description:** On connection, the extension automatically scans your workspace and sends the file tree structure (paths only, no file content) to the backend. This enables the backend to understand your project layout.

**Behavior:**
- Triggers automatically when connection is established
- Scans up to 10,000 files
- Respects exclusions: `node_modules`, `.git`, `dist`, `build`, `.gradle`, `__pycache__`
- Re-syncs when workspace folders are added/removed
- Incremental updates on file create/delete/change (debounced 1s)

**No user action required** — this is fully automatic.

### 4.5 Document Indexing

**Description:** Upload workspace documents (markdown) or source code to the remote backend for knowledge base indexing.

**Commands:**

| Command | What it does |
|---------|-------------|
| `Code Intel: Index Documents` | Scans `**/*.md` files, uploads to backend |
| `Code Intel: Index Source Code` | Scans source files (.ts, .js, .kt, .java, .py, .go, .rs), uploads in batches of 20 |

**Usage:**
1. Command Palette > **"Code Intel: Index Documents"** (or "Index Source Code")
2. Progress bar shows in notification area
3. Cancellable — click Cancel button on progress notification
4. On completion: "Indexed N documents" notification

**Notes:**
- Requires active backend connection
- Excludes: `node_modules`, `.git`, `dist`, `build`
- Source indexing uses batch upload (20 files per request) for efficiency
- Progress shows file-by-file status

### 4.6 AI Chat

**Description:** Interactive AI chat panel for asking questions about your codebase, getting explanations, and code assistance.

**How to use:**
1. Command Palette > **"Code Intel: Open Chat"**
2. Chat panel opens beside your editor
3. Type a message and press Enter (or click Send)
4. AI response streams in real-time (character by character)

**Features:**
- Real-time streaming responses (SSE)
- Markdown rendering in responses
- Context attachment (file content, selections)
- Session-based history (persists during VS Code session)
- Shift+Enter for multi-line input

**Context Attachment:**
- Select code in editor > open chat > selected code is available as context
- Attach file/terminal/git-diff context via the context menu

**Requirements:**
- Must be authenticated (login first)
- Backend must be connected

### 4.7 Webview Panels

**Description:** Data visualization panels that fetch information from the remote backend.

| Command | Panel | Data Source |
|---------|-------|-------------|
| `Code Intel: Open Dashboard` | Dashboard | `/api/dashboard` |
| `Code Intel: Open KB Graph` | Knowledge Base Graph | `/api/graph` |
| `Code Intel: Open Analytics` | Analytics | `/api/analytics` |
| `Code Intel: Open Tags` | Tags | `/api/tags` |
| `Code Intel: Open Quality` | Quality Metrics | `/api/quality` |

**Behavior:**
- Panels lazy-load on first open (no memory cost until used)
- Loading spinner shown while fetching data
- Error state with "Retry" button on failure
- Auto-refreshes on reconnect

### 4.8 MCP Server Configuration

**Description:** Configure which MCP servers are connected to the backend.

- Command Palette > **"Code Intel: Configure MCP Servers"**
- Requires authentication
- Opens configuration panel for managing MCP server connections

---

## 5. User Interface Guide

### 5.1 Screen Overview

| # | Screen | Access | Purpose |
|---|--------|--------|---------|
| 1 | Status Bar | Always visible (bottom) | Connection status indicator |
| 2 | Login Panel | "Code Intel: Login" command | Authentication |
| 3 | Chat Panel | "Code Intel: Open Chat" command | AI chat assistant |
| 4 | Dashboard | "Code Intel: Open Dashboard" command | Project overview |
| 5 | KB Graph | "Code Intel: Open KB Graph" command | Knowledge base visualization |

### 5.2 Status Bar

The status bar item (bottom of VS Code) shows:
- Green **Connected** — Backend reachable, tools available
- Red **Disconnected** — No connection, only local tools work
- Yellow **Connecting** — Connection attempt in progress

Click the status bar item to show detailed connection info.

### 5.3 Chat Panel

**Key Elements:**

| # | Element | Type | Description |
|---|---------|------|-------------|
| 1 | Message list | Scrollable area | Shows conversation history |
| 2 | Input textarea | Text input | Type messages (Enter to send, Shift+Enter for newline) |
| 3 | Send button | Button | Send current message |

**Message Types:**
- **User messages** — Blue background, right-aligned
- **Assistant messages** — Gray background, left-aligned
- **Error messages** — Red italic text

---

## 6. Administration

### 6.1 Switching Backend Environments

To switch between dev/staging/prod backends:

1. Open VS Code Settings
2. Change `codeIntel.backend.url` to target environment
3. Extension shows "Configuration changed. Reconnect to apply."
4. Command Palette > "Code Intel: Reconnect to Backend"

**Per-project override:**
Create `.vscode/settings.json` in your project with the project-specific backend URL.

### 6.2 Monitoring Connection Health

1. Open Output panel: View > Output
2. Select "Code Intelligence" from dropdown
3. Monitor logs for:
   - `[ConnectionManager]` — connection state transitions, reconnect attempts
   - `[ToolProxy]` — tool registration, call results
   - `[WorkspaceSync]` — sync status
   - `[IndexingService]` — indexing progress
   - `[Auth]` — authentication events

### 6.3 Managing Authentication

- Tokens stored in VS Code's SecretStorage (OS keychain)
- To force re-authentication: `Code Intel: Logout` then `Code Intel: Login`
- Token refresh is automatic — no manual intervention needed
- If SSO session expires on provider side, next refresh fails > login panel shows

### 6.4 Legacy Settings Migration

When upgrading from v1.x to v2.0.0, the extension automatically migrates:
- `codeIntel.backend.host` + `codeIntel.backend.port` > `codeIntel.backend.url`

No manual migration needed. Old settings are preserved but ignored after migration.

---

## 7. Troubleshooting

### 7.1 Common Issues

| # | Symptom | Cause | Solution |
|---|---------|-------|----------|
| 1 | Status bar stays red after startup | Backend not running or URL incorrect | Verify backend URL, check backend is running |
| 2 | "Authentication required" for every tool call | Token expired and refresh failed | Logout and login again |
| 3 | "Rate limited" errors | Too many requests to backend | Wait for retry period |
| 4 | Tools not showing in Kiro/Copilot | Extension not connected or tools not registered | Reconnect, check tool count in status |
| 5 | Chat not streaming | SSE connection blocked by proxy | Check corporate proxy/firewall allows SSE |
| 6 | Workspace sync failed | Network timeout with large workspace | Will auto-retry on next connect |
| 7 | Extension activated but not connecting | Not authenticated | Run "Code Intel: Login" first |
| 8 | SSO login callback not received | URI handler blocked | Ensure VS Code handles `vscode://` URIs |
| 9 | Tool call timeout | Tool takes too long | Increase `codeIntel.backend.toolCallTimeout` |
| 10 | "Cannot connect" repeating | Max reconnect attempts (5) reached | Check network, reconnect manually |

### 7.2 Error Codes

| Code | Message | Description | Action |
|------|---------|-------------|--------|
| BACKEND_UNAVAILABLE | Backend is not connected | No active connection to remote server | Check URL, reconnect |
| AUTH_REQUIRED | Authentication required | Token expired or invalid | Login again |
| RATE_LIMITED | Rate limited | Backend rate-limiting requests | Wait retryAfterSeconds, retry |
| TIMEOUT | Tool call timed out | Request exceeded configured timeout | Increase timeout setting |
| TOOL_NOT_FOUND | Tool not found | Requested tool not registered on backend | Check tool name, refresh tools |
| LOCAL_TOOL_ERROR | Local tool execution failed | Error in embed_images or local tool | Check file paths and permissions |
| INTERNAL_ERROR | Tool execution failed | Backend returned HTTP 5xx | Check backend logs |

### 7.3 Logs

| Log Channel | Content | Useful For |
|-------------|---------|------------|
| Output > "Code Intelligence" | All extension logs | General debugging |
| `[ConnectionManager]` prefix | State transitions, reconnect attempts | Connection issues |
| `[ToolProxy]` prefix | Tool registration, call errors | Tool call failures |
| `[Auth]` prefix | Login/logout, token refresh | Authentication issues |
| `[WorkspaceSync]` prefix | Sync status and errors | Sync problems |
| `[IndexingService]` prefix | Upload progress and errors | Indexing failures |
| `[ChatPanel]` prefix | Chat errors | Chat streaming issues |

### 7.4 FAQ

**Q: Do I need a backend running locally?**
A: No. The extension connects to any remote backend — local or cloud-hosted. The default URL `http://127.0.0.1:48721` is for local development. Change it to your actual backend URL.

**Q: What happens when the backend goes down?**
A: The extension enters "disconnected" state. Local tools (`embed_images`) still work. Remote tools return `BACKEND_UNAVAILABLE`. Extension auto-reconnects when backend comes back (5 attempts with exponential backoff).

**Q: Is my code sent to the backend?**
A: Workspace sync sends only file paths (not content). Document/source indexing commands explicitly upload file content when you trigger them. Tool calls may include file content if the tool requires it.

**Q: Where are my credentials stored?**
A: In VS Code's SecretStorage, which uses the OS-level encrypted keychain (Keychain on macOS, Credential Manager on Windows, libsecret on Linux). Tokens are never stored in plaintext settings or logs.

**Q: Can I use multiple backend servers?**
A: Use workspace settings (`.vscode/settings.json`) to configure per-project backends. The extension connects to one backend at a time per VS Code window.

**Q: Extension takes too long to activate?**
A: Extension activation completes in under 2 seconds. All network operations (auth, connect, sync) are async and non-blocking. If VS Code startup is slow, check other extensions.

**Q: How do I check which tools are available?**
A: After connecting, the Output panel shows `[ToolProxy] Registered N tools`. Or use `Code Intel: Show Connection Status` to see tool count.

---

## 8. API Reference

### 8.1 Backend Health Endpoint

| Attribute | Value |
|-----------|-------|
| Endpoint | `GET {baseUrl}/health` |
| Auth Required | No |
| Timeout | 3 seconds |

**Response:**
```json
{
  "status": "healthy",
  "version": "1.5.0",
  "tools_loaded": 52,
  "uptime_seconds": 3600
}
```

### 8.2 Tool List Endpoint

| Attribute | Value |
|-----------|-------|
| Endpoint | `GET {baseUrl}/mcp/tools/list` |
| Auth Required | Yes (Bearer token) |

**Response:**
```json
{
  "tools": [
    {
      "name": "mem_search",
      "description": "Search knowledge base",
      "inputSchema": { "type": "object", "properties": { "query": { "type": "string" } } }
    }
  ]
}
```

### 8.3 Tool Call Endpoint

| Attribute | Value |
|-----------|-------|
| Endpoint | `POST {baseUrl}/mcp/tools/call` |
| Auth Required | Yes (Bearer token) |
| Timeout | 300 seconds (configurable) |

**Request:**
```json
{
  "tool_name": "mem_search",
  "arguments": { "query": "authentication flow", "limit": 5 }
}
```

**Response:**
```json
{
  "content": [{ "type": "text", "text": "Search results..." }],
  "isError": false
}
```

### 8.4 Chat Endpoint (SSE)

| Attribute | Value |
|-----------|-------|
| Endpoint | `POST {baseUrl}/api/chat` |
| Auth Required | Yes (Bearer token) |
| Response Type | `text/event-stream` (SSE) |
| Timeout | 120 seconds (configurable) |

**Request:**
```json
{
  "message": "Explain the auth module",
  "context": [{ "type": "file", "path": "src/auth.ts", "content": "..." }],
  "session_id": "uuid-or-null"
}
```

**Response:** Streaming text chunks until done.

### 8.5 Workspace Sync Endpoint

| Attribute | Value |
|-----------|-------|
| Endpoint | `POST {baseUrl}/api/workspace/sync` |
| Auth Required | Yes (Bearer token) |

**Request:**
```json
{
  "workspace_name": "my-project",
  "root_path": "/Users/dev/projects/my-project",
  "files": [
    { "path": "src/index.ts", "type": "file", "size": 1234 },
    { "path": "src/", "type": "directory", "size": 0 }
  ],
  "synced_at": "2025-07-15T10:00:00Z"
}
```

### 8.6 Document Indexing Endpoint

| Attribute | Value |
|-----------|-------|
| Endpoint | `POST {baseUrl}/api/index/document` |
| Auth Required | Yes (Bearer token) |

**Request:**
```json
{
  "path": "docs/README.md",
  "content": "# My Project\n...",
  "type": "markdown"
}
```

### 8.7 Source Indexing Endpoint

| Attribute | Value |
|-----------|-------|
| Endpoint | `POST {baseUrl}/api/index/source` |
| Auth Required | Yes (Bearer token) |

**Request:**
```json
{
  "files": [
    { "path": "src/index.ts", "content": "import ..." },
    { "path": "src/auth.ts", "content": "export class ..." }
  ]
}
```

---

## 9. Appendix

### 9.1 Glossary

| Term | Definition |
|------|------------|
| Light Client | Extension acts as thin proxy — no local backend process |
| MCP | Model Context Protocol — standard for AI tool communication |
| PKCE | Proof Key for Code Exchange — OAuth 2.0 security extension |
| SSO | Single Sign-On — authenticate via external identity provider |
| SSE | Server-Sent Events — streaming protocol for chat responses |
| SecretStorage | VS Code encrypted credential storage using OS keychain |
| Tool Proxy | Component that routes tool calls (local vs remote) |
| Workspace Sync | Sending file tree (paths only) to backend for context |

### 9.2 Related Documents

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-292.docx |
| FSD | FSD-v1-KSA-292.docx |
| TDD | TDD-v1-KSA-292.docx |

### 9.3 Version Compatibility

| Extension Version | VS Code Minimum | Backend Minimum | Breaking Changes |
|-------------------|----------------|-----------------|-----------------|
| 2.0.0 | 1.85.0 | 1.5.0 | Removed local backend spawn, requires remote URL config |
| 1.1.0 (legacy) | 1.80.0 | Bundled | N/A — local backend |

### 9.4 All Commands Reference

| Command | ID | Requires Auth | Requires Connection |
|---------|----|---------------|---------------------|
| Reconnect to Backend | `codeIntel.reconnect` | No | No |
| Disconnect from Backend | `codeIntel.disconnect` | No | No |
| Show Connection Status | `codeIntel.showConnectionStatus` | No | No |
| Login | `codeIntel.login` | No | No |
| Logout | `codeIntel.logout` | Yes | No |
| Configure MCP Servers | `codeIntel.configureMcpServers` | Yes | No |
| Index Documents | `codeIntel.indexDocuments` | Yes | Yes |
| Index Source Code | `codeIntel.indexSource` | Yes | Yes |
| Open Chat | `codeIntel.openChat` | Yes | Yes |
| Configure Backend | `codeIntel.configureBackend` | No | No |
| Open Dashboard | `codeIntel.openDashboard` | Yes | Yes |
| Open KB Graph | `codeIntel.openKbGraph` | Yes | Yes |
| Open Analytics | `codeIntel.openAnalytics` | Yes | Yes |
| Open Tags | `codeIntel.openTags` | Yes | Yes |
| Open Quality | `codeIntel.openQuality` | Yes | Yes |
