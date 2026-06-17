# User Guide (UG)

## Code Intelligence Extension — KSA-293: VS Code Extension Thin Client

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-293 |
| Title | Code Intelligence Extension — Thin Client User Guide |
| Author | DEV Agent |
| Reviewer | BA Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-293.docx |
| Related FSD | FSD-v1-KSA-293.docx |
| Related TDD | TDD-v1-KSA-293.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-14 | DEV Agent | Initial document |

---

## 1. Introduction

### 1.1 Purpose

The Code Intelligence extension is a lightweight VS Code extension that connects to a remote Code Intelligence Backend server. It provides AI-powered tools, knowledge base management, workspace indexing, and chat capabilities — all processed remotely while keeping the extension fast and responsive.

This guide covers installation, configuration, daily usage, and troubleshooting.

### 1.2 Audience

| Audience | What They Need |
|----------|---------------|
| Developers | How to install, configure, login, and use features (chat, indexing, tools) |
| Team Leads / Admins | How to configure backend URL for teams, manage SSO |
| AI/MCP Tool Users | How MCP tools are registered and called through the extension |

### 1.3 Prerequisites

| Prerequisite | Version | Required |
|-------------|---------|----------|
| VS Code | 1.85+ | Yes |
| Remote Code Intelligence Backend | Running and accessible | Yes |
| Network connectivity | HTTP/HTTPS to backend | Yes |
| Backend user account | (username/password or SSO) | Yes |

---

## 2. Getting Started

### 2.1 Quick Start

```
Step 1: Install the extension
  Open VS Code → Extensions → Search "Code Intelligence" → Install
  Or: code --install-extension code-intel-extension-2.0.0.vsix

Step 2: Configure backend URL (if not default)
  Open Command Palette (Ctrl+Shift+P)
  "Code Intel: Configure Backend"
  Set URL to your backend (e.g., https://backend.company.com)

Step 3: Login
  Extension shows Login panel automatically on first activation
  Enter username + password → Click Login
  Or use SSO button if configured

Step 4: Verify connection
  Status bar shows green icon = Connected
  Command Palette → "Code Intel: Show Connection Status"
  Should show: State: CONNECTED | Version: x.y.z | Auth: Authenticated
```

### 2.2 System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| VS Code | 1.85.0 | Latest stable |
| OS | Windows 10 / macOS 12 / Linux (any) | Any |
| Memory | 50 MB (extension only) | 100 MB |
| Network | HTTP to backend | HTTPS to backend |

### 2.3 Distribution Formats

| Format | How to Get | Use Case |
|--------|-----------|----------|
| VSIX file | Download `code-intel-extension-2.0.0.vsix` from releases | Manual install |
| Marketplace | Search "Code Intelligence" in VS Code | Auto-update |

### 2.4 Configuration Methods

Configuration is managed via VS Code Settings under `codeIntel.backend.*`:

| Method | Priority | Best For |
|--------|----------|----------|
| VS Code Workspace Settings (`.vscode/settings.json`) | Highest | Per-project backend URL |
| VS Code User Settings | Default | Personal defaults |
| Command Palette ("Configure Backend") | Shortcut | Quick URL change |

### 2.5 Verify Configuration

After install and login:

- **Check 1:** Status bar (bottom) shows green plug icon = Connected
- **Check 2:** Command Palette → "Code Intel: Show Connection Status" → State: CONNECTED
- **Check 3:** Command Palette → "Code Intel: Open Dashboard" → Should show backend data

| Symptom | Cause | Fix |
|---------|-------|-----|
| Status bar shows red/yellow | Backend unreachable | Check URL in settings, verify backend is running |
| Login panel keeps appearing | Invalid credentials or token expired | Re-enter credentials, check backend logs |
| "Backend not connected" on commands | No connection established | Run "Code Intel: Reconnect to Backend" |

---

## 3. Configuration

### 3.1 Settings Location

VS Code Settings → search `codeIntel.backend`

Or edit directly in `.vscode/settings.json` (workspace) or `settings.json` (user).

### 3.2 Configuration Reference

#### Backend Connection

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `codeIntel.backend.url` | string | `http://127.0.0.1:48721` | URL for the remote Backend server |
| `codeIntel.backend.healthCheckInterval` | number | `5000` | Health check polling interval (ms). Range: 1000-60000 |
| `codeIntel.backend.toolCallTimeout` | number | `300000` | Timeout for tool calls (ms). Range: 10000-900000 |
| `codeIntel.backend.chatTimeout` | number | `120000` | Timeout for AI chat responses (ms). Range: 10000-600000 |

#### Authentication (SSO)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `codeIntel.backend.ssoEnabled` | boolean | `false` | Enable SSO authentication via PKCE flow |
| `codeIntel.backend.ssoProviderUrl` | string | `""` | SSO provider URL (required when ssoEnabled is true) |

### 3.3 Environment Variables

No environment variables are used. All configuration is via VS Code settings.

### 3.4 Configuration Examples

#### Minimal Configuration (local backend)

```json
{
  "codeIntel.backend.url": "http://127.0.0.1:48721"
}
```

#### Remote Backend with SSO

```json
{
  "codeIntel.backend.url": "https://code-intel.company.com",
  "codeIntel.backend.ssoEnabled": true,
  "codeIntel.backend.ssoProviderUrl": "https://auth.company.com/realms/dev",
  "codeIntel.backend.healthCheckInterval": 10000,
  "codeIntel.backend.toolCallTimeout": 600000,
  "codeIntel.backend.chatTimeout": 180000
}
```

#### Team Workspace Configuration (`.vscode/settings.json`)

```json
{
  "codeIntel.backend.url": "https://team-backend.internal:48721",
  "codeIntel.backend.ssoEnabled": false
}
```

---

## 4. Usage

### 4.1 Authentication — Login / Logout

**Login (Username + Password):**

1. Extension automatically shows Login panel when unauthenticated
2. Enter username and password
3. Click "Login"
4. On success: panel closes, status bar turns green, tools registered

**Login (SSO / PKCE):**

1. Enable SSO in settings (`codeIntel.backend.ssoEnabled: true`)
2. Set SSO provider URL
3. Click "Login with SSO" button in Login panel
4. Browser opens for identity provider authentication
5. After approval, extension receives token automatically

**Logout:**

- Command Palette → "Code Intel: Logout"
- Clears stored tokens from VS Code SecretStorage
- Login panel reappears

**Token Management:**

- Tokens stored encrypted in VS Code SecretStorage (OS keychain)
- Auto-refresh before expiry (no manual action needed)
- On 401 response: automatic token refresh then retry request

### 4.2 Connection Management

**Commands:**

| Command | Description |
|---------|-------------|
| `Code Intel: Reconnect to Backend` | Disconnect + reconnect (useful after URL change) |
| `Code Intel: Disconnect from Backend` | Manually disconnect |
| `Code Intel: Show Connection Status` | Show current state, version, auth status |

**Connection States:**

| State | Status Bar | Meaning |
|-------|-----------|---------|
| CONNECTED | Green plug | Backend reachable, authenticated |
| CONNECTING | Yellow sync | Attempting connection |
| DISCONNECTED | Red plug | Backend unreachable or not authenticated |

**Auto-Reconnect:**

- On connection loss, extension attempts reconnection with exponential backoff
- Delays: 1s → 2s → 4s → 8s → 16s (max 5 attempts)
- After max attempts, stops. Use "Reconnect" command to retry manually.

### 4.3 Workspace Indexing

**Index Documents (Markdown files):**

1. Command Palette → "Code Intel: Index Documents"
2. Extension scans all `.md` files in workspace (respects `.gitignore`)
3. Files uploaded one-by-one to backend `/api/index/document`
4. Progress notification shows current file
5. Cancellable via notification cancel button

**Index Source Code:**

1. Command Palette → "Code Intel: Index Source Code"
2. Extension scans `.ts`, `.js`, `.kt`, `.java`, `.py`, `.go`, `.rs` files
3. Files uploaded in batches of 20 to backend `/api/index/source`
4. Progress notification shows progress
5. Excludes: `node_modules/`, `.git/`, `dist/`, `build/`

**Notes:**
- Requires active connection (backend must be connected)
- Large workspaces may take several minutes
- Can be cancelled at any time

### 4.4 AI Chat

1. Command Palette → "Code Intel: Open Chat"
2. Type message in chat input
3. Use `#` to attach context (files, symbols)
4. Messages sent to remote backend for AI processing
5. Responses streamed back via SSE (Server-Sent Events)
6. Timeout: 120s (configurable via `codeIntel.backend.chatTimeout`)

**Requirements:**
- Must be authenticated
- Backend must be connected

### 4.5 Webview Panels

| Panel | Command | Data Source |
|-------|---------|-------------|
| Dashboard | `Code Intel: Open Dashboard` | `/api/dashboard` |
| KB Graph | `Code Intel: Open KB Graph` | `/api/kb/graph` |
| Analytics | `Code Intel: Open Analytics` | `/api/analytics` |
| Tags | `Code Intel: Open Tags` | `/api/tags` |
| Quality | `Code Intel: Open Quality` | `/api/quality` |

All panels:
- Fetch data from remote backend API
- Show loading spinners during fetch
- Display error + retry button on failure
- Auto-refresh data when reconnecting after disconnect
- Disabled (show auth prompt) when not authenticated

### 4.6 MCP Tool Proxy

The extension registers 52+ MCP tools from the backend into VS Code's Language Model Tool API. This allows AI assistants (Kiro, Copilot, etc.) to call these tools.

**How it works:**
1. On connection, extension fetches tool list from `/mcp/tools/list`
2. Each tool registered with VS Code's `vscode.lm.registerTool()`
3. When an AI calls a tool, extension forwards to `/mcp/tools/call`
4. Response returned to the AI caller

**Local Tools (work without backend):**
- `embed_images` — processes image embedding locally via FileProxyHandler

**Tool Call Flow:**

```
AI Agent → vscode.lm.registerTool callback → ToolProxy.callTool()
  → LOCAL_TOOLS? → FileProxyHandler (local execution)
  → Remote tool? → HttpClient.callTool() → Backend /mcp/tools/call
  → Response returned to AI
```

**Timeouts:** Tool calls timeout after 300s (5 minutes) by default.

### 4.7 Configure MCP Servers

Command Palette → "Code Intel: Configure MCP Servers"

Opens a panel to manage MCP server configurations on the backend. Requires authentication.

### 4.8 Workspace Sync

**Automatic** — no user action needed:
- On successful connection, extension sends workspace file tree to backend
- File changes (create/delete/modify) are notified to backend with 1s debounce
- Only file paths and metadata sent (not file content)
- Excludes: `node_modules/`, `.git/`, `dist/`, `build/`, `.gradle/`, `__pycache__/`

---

## 5. User Interface Guide

### 5.1 Status Bar

The status bar item (bottom-left area) shows real-time connection state:

| Icon | Color | Meaning |
|------|-------|---------|
| Plug | Green | Connected to backend |
| Sync | Yellow | Connecting... |
| Plug | Red | Disconnected |

Click status bar item → runs "Show Connection Status" command.

### 5.2 Login Panel

Shown automatically when unauthenticated. Contains:

| Element | Type | Description |
|---------|------|-------------|
| Username field | Input | Backend username |
| Password field | Input (masked) | Backend password |
| Login button | Button | Submit credentials |
| SSO Login button | Button | Opens browser for SSO (if enabled) |
| Status message | Text | Shows login errors |

### 5.3 Webview Panels

All webview panels open in a VS Code editor tab. They display data from the remote backend with loading/error states.

---

## 6. Administration

### 6.1 Setting Up for a Team

1. Deploy Code Intelligence Backend server (see backend docs)
2. Create user accounts on backend
3. Share workspace settings:
   ```json
   // .vscode/settings.json (commit to repo)
   {
     "codeIntel.backend.url": "https://your-backend-url.com"
   }
   ```
4. Each team member installs extension + logs in with their account

### 6.2 SSO Configuration

1. Set up OIDC provider (Keycloak, Auth0, Azure AD, etc.)
2. Create client for Code Intelligence (PKCE public client)
3. Configure extension:
   ```json
   {
     "codeIntel.backend.ssoEnabled": true,
     "codeIntel.backend.ssoProviderUrl": "https://auth.company.com/realms/dev"
   }
   ```
4. Users click "Login with SSO" → redirected to provider

### 6.3 Monitoring Connection Health

- Health check polls backend every 5s (configurable)
- Output Channel "Code Intelligence" shows detailed logs:
  ```
  [ConnectionManager] State: DISCONNECTED -> CONNECTING
  [ConnectionManager] Connected to Backend v2.1.0 (52 tools)
  [Auth] Authenticated as john.doe
  [WorkspaceSync] Workspace synced: 342 files
  ```
- Open: View → Output → select "Code Intelligence"

---

## 7. Troubleshooting

### 7.1 Common Issues

| # | Symptom | Cause | Solution |
|---|---------|-------|----------|
| 1 | Status bar stays red after config change | Need to reconnect | Command Palette → "Code Intel: Reconnect to Backend" |
| 2 | "Authentication required" on every tool call | Token expired, auto-refresh failed | Logout → Login again |
| 3 | "Backend not connected" warning | Backend server down or URL wrong | Check URL in settings, verify backend is running |
| 4 | Login panel keeps reappearing | Invalid credentials or backend auth endpoint down | Verify credentials, check backend logs |
| 5 | Tool call timeout | Backend processing takes too long | Increase `codeIntel.backend.toolCallTimeout` |
| 6 | Chat not responding | SSE stream timeout | Increase `codeIntel.backend.chatTimeout` |
| 7 | "Rate limited" error | Too many requests | Wait and retry (auto-retry after Retry-After header) |
| 8 | Indexing fails midway | Network interruption or backend OOM | Retry; for large workspaces, index in smaller batches |
| 9 | Extension slow to activate | Unrelated extensions or VS Code issue | Extension itself activates in less than 100ms; check other extensions |
| 10 | SSO login does not complete | Browser popup blocked or redirect URI mismatch | Allow popups, verify SSO provider config |

### 7.2 Error Codes

| Code | Message | Description | Action |
|------|---------|-------------|--------|
| AUTH_REQUIRED | Authentication required | Token missing or expired | Login again |
| BACKEND_UNAVAILABLE | Backend is not connected | No connection to backend | Check connection, reconnect |
| TOOL_NOT_FOUND | Tool not found | Tool not in registry | Reconnect to refresh tool list |
| TIMEOUT | Tool call timed out | Request exceeded timeout | Increase timeout or check backend load |
| RATE_LIMITED | Rate limited | Too many requests in window | Wait N seconds and retry |
| INTERNAL_ERROR | Tool execution failed | Backend returned 5xx | Check backend logs |
| LOCAL_TOOL_ERROR | Local tool error | embed_images or file operation failed | Check file paths and permissions |

### 7.3 Logs

| Log Location | Content | Useful For |
|-------------|---------|------------|
| Output Channel "Code Intelligence" | Connection state changes, auth events, tool registration, sync status | General debugging |
| VS Code Developer Tools (Help → Toggle Developer Tools) | Extension host errors, stack traces | Deep debugging |

### 7.4 FAQ

**Q: Does the extension work offline?**
A: Partially. Local operations (inject agents/steering) work without backend. But tools, chat, indexing, and panels require backend connection.

**Q: Where are my credentials stored?**
A: In VS Code SecretStorage, which uses your OS keychain (Windows Credential Manager, macOS Keychain, Linux libsecret). They are encrypted at rest.

**Q: Can I connect to multiple backends?**
A: Not simultaneously. The extension connects to one backend URL. Switch by changing `codeIntel.backend.url` and reconnecting.

**Q: What happens when the backend goes down?**
A: Status bar turns red. Extension auto-retries connection (5 attempts with exponential backoff). Local operations continue working. Remote features show appropriate error messages.

**Q: How do I update the extension?**
A: If installed from Marketplace: auto-update. If VSIX: download new version, run `code --install-extension new-version.vsix`.

**Q: What data does workspace sync send?**
A: Only file paths, types, and sizes. File content is NOT sent during sync. Content is only sent during explicit "Index" commands.

---

## 8. Command Reference

| Command | ID | Description | Requires Auth | Requires Connection |
|---------|-----|-------------|:---:|:---:|
| Reconnect to Backend | `codeIntel.reconnect` | Disconnect + reconnect | No | No |
| Disconnect from Backend | `codeIntel.disconnect` | Close connection | No | No |
| Show Connection Status | `codeIntel.showConnectionStatus` | Display state info | No | No |
| Login | `codeIntel.login` | Show login panel | No | No |
| Logout | `codeIntel.logout` | Clear tokens | Yes | No |
| Configure MCP Servers | `codeIntel.configureMcpServers` | Manage MCP configs | Yes | No |
| Open Dashboard | `codeIntel.openDashboard` | Dashboard panel | Yes | Yes |
| Open KB Graph | `codeIntel.openKbGraph` | Knowledge Base graph | Yes | Yes |
| Open Analytics | `codeIntel.openAnalytics` | Usage analytics | Yes | Yes |
| Open Tags | `codeIntel.openTags` | Tag management | Yes | Yes |
| Open Quality | `codeIntel.openQuality` | Code quality panel | Yes | Yes |
| Index Documents | `codeIntel.indexDocuments` | Upload .md to backend | Yes | Yes |
| Index Source Code | `codeIntel.indexSource` | Upload source to backend | Yes | Yes |
| Open Chat | `codeIntel.openChat` | AI chat panel | Yes | Yes |
| Configure Backend | `codeIntel.configureBackend` | Open backend settings | No | No |

---

## 9. Appendix

### 9.1 Glossary

| Term | Definition |
|------|------------|
| Thin Client | Extension delegates all heavy processing to remote backend |
| MCP | Model Context Protocol — standard for tool communication between AI and tools |
| PKCE | Proof Key for Code Exchange — secure OAuth flow for public clients |
| SSE | Server-Sent Events — one-way streaming from server to client |
| SecretStorage | VS Code API for encrypted credential storage using OS keychain |
| Health Check | Periodic GET /health to verify backend availability |
| Tool Proxy | Component that routes tool calls between local and remote execution |

### 9.2 Related Documents

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-293.docx |
| FSD | FSD-v1-KSA-293.docx |
| TDD | TDD-v1-KSA-293.docx |
| STP | STP-v1-KSA-293.docx |
| STC | STC-v1-KSA-293.docx |

### 9.3 Version Compatibility

| Extension Version | Backend Version | VS Code Version | Breaking Changes |
|------------------|----------------|-----------------|-----------------|
| 2.0.0 | 1.0+ | 1.85+ | Full rewrite: local to remote. Requires backend server. |

### 9.4 Migration from v1.x

If upgrading from the monolithic extension (v1.26.0):

1. **Settings changed:** `kiroSdlc.*` → `codeIntel.backend.*` (auto-migrated)
2. **No local server:** Extension no longer spawns MCP server on port 9181
3. **No local DB:** `.code-intel/*.db` files no longer created/used by extension
4. **No ONNX models:** `.code-intel/models/` no longer needed
5. **Login required:** Must authenticate to backend (new requirement)
6. **Smaller footprint:** approximately 500KB vs 5MB+ previously
