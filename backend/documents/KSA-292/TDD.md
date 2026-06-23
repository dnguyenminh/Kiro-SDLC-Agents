# Technical Design Document (TDD)

## Code Intelligence Extension — KSA-292: Refactor Extension to Light Client of Remote Backend Server

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-292 |
| Title | Refactor Extension to Light Client of Remote Backend Server |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-292.docx |
| Related BRD | BRD-v1-KSA-292.docx |

---

## 1. Architecture Overview

### 1.1 Architecture Pattern: Plugin (Thin Client)

The extension follows the thin-client pattern where all heavy computation lives on the remote backend. Extension responsibilities: UI, auth, request proxying, local file ops.

### 1.2 High-Level Architecture

![Architecture Diagram](diagrams/architecture.png)

### 1.3 Design Principles

1. **No local state** - All persistent data on backend
2. **Fail gracefully** - Extension usable (limited) without backend
3. **Async-first** - No blocking in activate()
4. **Minimal deps** - Bundle < 500KB
5. **Security by default** - SecretStorage, HTTPS, no path leaks

---

## 2. Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Runtime | VS Code Extension Host (Node.js) | VS Code extension requirement |
| Language | TypeScript 5.5+ | Type safety, VS Code native |
| HTTP Client | Native fetch (Node 18+) | Zero dependencies, built-in |
| Build | esbuild | Fast bundling, tree-shaking |
| UI | VS Code Webview API | Native panel rendering |
| Auth | VS Code SecretStorage | OS-encrypted credential storage |
| Streaming | EventSource / SSE | Chat streaming from backend |
| Testing | Vitest + @vscode/test-electron | Unit + integration |

---

## 3. Module Architecture

### 3.1 Component Diagram

![Component Diagram](diagrams/component.png)

### 3.2 Module Breakdown

```
src/extension/src/
+-- extension.ts              # Entry point (activate/deactivate)
+-- auth/
|   +-- AuthManager.ts        # KEEP - Auth state machine
|   +-- TokenRefreshTimer.ts  # KEEP - Auto-refresh timer
|   +-- PkceService.ts        # NEW - PKCE code gen/verify
+-- config/
|   +-- ConfigurationManager.ts  # REFACTOR - Add URL config
+-- connection/
|   +-- ConnectionManager.ts  # REFACTOR - Remove BackendProcess dep
|   +-- HealthChecker.ts      # KEEP - Health polling
|   +-- (BackendProcess.ts)   # REMOVE
+-- proxy/
|   +-- HttpClient.ts         # REFACTOR - Add auth headers, configurable URL
|   +-- ToolProxy.ts          # REFACTOR - Add local/remote routing
|   +-- ToolRegistry.ts       # KEEP
|   +-- FileProxyHandler.ts   # KEEP - Local tool execution
+-- services/
|   +-- WorkspaceSyncService.ts  # NEW - Workspace file tree sync
|   +-- IndexingService.ts       # NEW - Document/source upload
+-- webview/
|   +-- WebviewManager.ts     # REFACTOR - Remote data fetching
|   +-- panels/
|       +-- LoginPanel.ts     # KEEP
|       +-- McpConfigPanel.ts # KEEP
|       +-- ChatPanel.ts      # NEW - AI Chat webview
|       +-- RemoteConfigPanel.ts  # NEW - Backend URL config
+-- ui/
|   +-- StatusBarManager.ts   # KEEP
|   +-- NotificationManager.ts # KEEP
+-- types/
    +-- config.ts             # REFACTOR - Add URL types
    +-- connection.ts         # REFACTOR - Remove process types
```

---

## 4. Detailed Design

### 4.1 ConnectionManager (Refactored)

**Changes from current:**
- Remove `BackendProcess` import and dependency
- Remove `this.backendProcess.spawn()` logic
- Remove `STARTING` state (no local process to start)
- `connect()` only does health check → CONNECTED or DISCONNECTED
- Constructor accepts `baseUrl` (full URL string) instead of host+port

```typescript
// Pseudocode: Refactored ConnectionManager
class ConnectionManager {
  constructor(config: RemoteBackendConfig, authManager: AuthManager) {
    this.baseUrl = config.url; // e.g., "https://backend.company.com"
    this.client = new HttpClient({ baseUrl: this.baseUrl, authManager });
    this.healthChecker = new HealthChecker(this.client, config);
    // NO BackendProcess reference
  }

  async connect(): Promise<void> {
    this.transitionTo('CONNECTING');
    const result = await this.healthChecker.checkOnce();
    if (result.success) {
      this.handleHealthSuccess(result.response);
      this.startHealthPolling();
    } else {
      this.transitionTo('DISCONNECTED');
      this.scheduleReconnect(); // exponential backoff
    }
  }
}
```

### 4.2 HttpClient (Refactored)

**Changes:**
- Accept configurable `baseUrl` (full URL, not just host:port)
- Inject auth token from AuthManager into every request
- Support both HTTP and HTTPS

```typescript
class HttpClient {
  constructor(config: { baseUrl: string; authManager: AuthManager }) {
    this.baseUrl = config.baseUrl;
    this.authManager = config.authManager;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const token = await this.authManager.getAccessToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
  }

  async callTool(name: string, args: object): Promise<ToolResult> {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.baseUrl}/mcp/tools/call`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, arguments: args }),
      signal: AbortSignal.timeout(300000), // 5min for tool calls
    });
    return response.json();
  }
}
```

### 4.3 ToolProxy (Refactored)

**Changes:**
- Add local/remote tool routing
- Local tools: embed_images (executed via FileProxyHandler)
- Remote tools: everything else (forwarded via HttpClient)

```typescript
class ToolProxy {
  private localTools = new Set(['embed_images']);
  
  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    if (this.localTools.has(name)) {
      return this.fileProxyHandler.execute(name, args);
    }
    return this.httpClient.callTool(name, args);
  }
}
```

### 4.4 WorkspaceSyncService (NEW)

```typescript
class WorkspaceSyncService implements vscode.Disposable {
  private watcher: vscode.FileSystemWatcher;

  async syncOnConnect(): Promise<void> {
    const tree = await this.scanWorkspace();
    await this.httpClient.post('/api/workspace/sync', tree);
  }

  private async scanWorkspace(): Promise<WorkspaceTree> {
    const gitignore = await this.loadGitignore();
    const files = await vscode.workspace.findFiles('**/*', gitignore);
    return {
      workspace_name: vscode.workspace.name,
      files: files.map(f => ({
        path: vscode.workspace.asRelativePath(f),
        type: 'file',
        size: (await vscode.workspace.fs.stat(f)).size
      })),
    };
  }
}
```

### 4.5 ChatPanel (NEW)

```typescript
class ChatPanel extends BasePanel {
  private eventSource: EventSource | null = null;

  async sendMessage(text: string, context: ResolvedContext[]): Promise<void> {
    const body = { message: text, context, session_id: this.sessionId };
    
    // SSE streaming response
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(body),
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      this.webview.postMessage({ type: 'chat:chunk', content: chunk });
    }
  }
}
```

### 4.6 IndexingService (NEW)

```typescript
class IndexingService {
  async indexDocuments(): Promise<void> {
    const mdFiles = await vscode.workspace.findFiles('**/*.md');
    const formData = new FormData();
    
    for (const file of mdFiles) {
      const content = await vscode.workspace.fs.readFile(file);
      formData.append('files', new Blob([content]), 
        vscode.workspace.asRelativePath(file));
    }

    await this.httpClient.postMultipart('/api/index/documents', formData, {
      onProgress: (pct) => this.progress.report({ increment: pct })
    });
  }
}
```

### 4.7 PkceService (NEW)

```typescript
class PkceService {
  generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array); // 43 chars
  }

  async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(hash));
  }
}
```

---

## 5. Configuration Changes

### 5.1 Settings (package.json contributes.configuration)

**Remove:**
- `codeIntel.backend.host` (replaced by URL)
- `codeIntel.backend.port` (replaced by URL)
- `codeIntel.backend.backendPath` (no local process)
- `codeIntel.backend.autoStart` (no local process)
- `codeIntel.backend.startupTimeout` (no local process)

**Add:**
- `codeIntel.backend.url` (string, default: "http://127.0.0.1:48721")
- `codeIntel.backend.ssoEnabled` (boolean, default: false)
- `codeIntel.backend.ssoProviderUrl` (string, optional)
- `codeIntel.backend.toolCallTimeout` (number, default: 300000)
- `codeIntel.backend.chatTimeout` (number, default: 120000)

**Keep:**
- `codeIntel.backend.healthCheckInterval` (unchanged)

### 5.2 Commands (package.json contributes.commands)

**Add:**
- `codeIntel.indexDocuments` — "Code Intel: Index Documents"
- `codeIntel.indexSource` — "Code Intel: Index Source Code"
- `codeIntel.openChat` — "Code Intel: Open Chat"
- `codeIntel.configureBackend` — "Code Intel: Configure Backend"

**Keep all existing commands.**

---

## 6. API Integration Design

### 6.1 Request Pipeline

```
MCP Client → ToolProxy → HttpClient → Remote Backend
                ↓ (local)
          FileProxyHandler → Local FS
```

### 6.2 Auth Header Injection

Every HTTP request to backend MUST include:
```
Authorization: Bearer {access_token}
```

HttpClient uses AuthManager.getAccessToken() which:
1. Returns cached token if valid
2. Refreshes token if expired
3. Throws AuthenticationRequiredError if no token

### 6.3 Error Handling Strategy

| Error Type | HTTP Status | Extension Action |
|-----------|-------------|-----------------|
| Auth expired | 401 | Refresh token, retry once |
| Auth invalid | 403 | Clear tokens, show login |
| Server error | 500 | Show error notification |
| Timeout | - | Show timeout notification + retry |
| Network error | - | Transition to DISCONNECTED, reconnect |
| Rate limited | 429 | Back off, retry after Retry-After header |

### 6.4 Timeout Configuration

| Request Type | Timeout | Rationale |
|-------------|---------|-----------|
| Health check | 3,000ms | Fast detection of connectivity |
| Tool call | 300,000ms | Some tools (code indexing) take minutes |
| Webview data | 10,000ms | Panel data should load quickly |
| Chat | 120,000ms | Long AI responses |
| Upload | 600,000ms | Large file uploads |

---

## 7. Security Design

### 7.1 Token Lifecycle

```
Login/SSO → access_token (JWT, 1h) + refresh_token (opaque, 30d)
   ↓
Store in SecretStorage (OS-encrypted keychain)
   ↓
TokenRefreshTimer checks every 5min:
  if (access_token expires in < 5min) → POST /api/auth/refresh
   ↓
On 401 from any request → try refresh → if fail → UNAUTHENTICATED → show login
```

### 7.2 PKCE Implementation

| Step | Data | Storage |
|------|------|---------|
| Generate code_verifier | 32 random bytes → base64url (43 chars) | In-memory only |
| Compute code_challenge | SHA-256(code_verifier) → base64url | Sent to SSO provider |
| Exchange code | auth_code + code_verifier → tokens | code_verifier discarded after use |

### 7.3 Data Protection

- No filesystem absolute paths sent to backend (use relative paths)
- File content for indexing: sent via HTTPS, Bearer auth
- No tokens logged (OutputChannel redacts)
- Workspace sync: paths only, no file content

---

## 8. Error Handling & Resilience

### 8.1 Connection Resilience

```
Reconnect strategy:
  attempts: 0..5
  delays: [1s, 2s, 4s, 8s, 16s]
  
  on health_fail:
    if attempts < max:
      wait(delay[attempts])
      attempts++
      retry connect()
    else:
      stop, notify user "Cannot connect"
```

### 8.2 Graceful Degradation

| Backend Status | Available Features | Unavailable |
|---------------|-------------------|-------------|
| Connected + Authenticated | ALL | None |
| Connected + NOT Authenticated | Login panel only | All other features |
| Disconnected | Local tools (embed_images), Settings | Remote tools, panels, chat |

---

## 9. Performance Design

### 9.1 Activation Performance (< 2s)

```
activate():
  t=0ms   Create OutputChannel
  t=5ms   Create ConfigManager (sync, reads settings)
  t=10ms  Create StatusBar (sync, creates UI element)
  t=15ms  Create AuthManager (sync, just state machine init)
  t=20ms  Register commands (sync, 15 commands)
  t=25ms  RETURN (activate complete)
  
  // Everything below is async, non-blocking
  t=30ms  AuthManager.initialize() → check SecretStorage
  t=100ms If token valid → ConnectionManager.connect()
  t=200ms If connected → WorkspaceSyncService.sync()
  t=300ms ToolProxy.refreshTools()
```

### 9.2 Lazy Loading

- WebviewManager: panels created only on first open
- ChatPanel: loaded on "Open Chat" command
- IndexingService: instantiated only when command triggered

---

## 10. Implementation Checklist

### 10.1 Files to Remove

| File | Impact |
|------|--------|
| src/extension/src/connection/BackendProcess.ts | Remove class + all references |
| src/extension/providers/ (ALL 9 files) | Remove entire directory |
| src/extension/message-handler/ | Remove if exists |

### 10.2 Files to Refactor

| File | Changes |
|------|---------|
| extension.ts | Remove BackendProcess, add WorkspaceSync, ChatPanel, IndexingService |
| ConnectionManager.ts | Remove BackendProcess dep, accept URL config |
| HttpClient.ts | Add auth header injection, configurable baseUrl |
| ToolProxy.ts | Add local/remote routing |
| ConfigurationManager.ts | New settings schema (URL, SSO, timeouts) |
| WebviewManager.ts | Add ChatPanel, data fetching via HttpClient |
| package.json | Update settings, add commands, remove autoStart/backendPath |
| types/config.ts | New RemoteBackendConfig interface |
| types/connection.ts | Remove STARTING state, process types |

### 10.3 Files to Create

| File | Purpose |
|------|---------|
| services/WorkspaceSyncService.ts | Workspace file tree scanning + upload |
| services/IndexingService.ts | Document/source file upload |
| auth/PkceService.ts | PKCE code_verifier/challenge generation |
| webview/panels/ChatPanel.ts | AI Chat panel with SSE streaming |
| webview/panels/RemoteConfigPanel.ts | Backend URL configuration UI |

### 10.4 Implementation Order

1. Remove BackendProcess + providers (clean slate)
2. Refactor ConfigurationManager (new settings)
3. Refactor HttpClient (auth headers, URL)
4. Refactor ConnectionManager (URL-based, no process)
5. Refactor ToolProxy (local/remote routing)
6. Create WorkspaceSyncService
7. Create IndexingService
8. Create PkceService
9. Create ChatPanel
10. Update extension.ts (wire everything)
11. Update package.json (settings, commands)
12. Integration testing

---

## 11. Testing Strategy

### 11.1 Unit Tests

| Module | Key Tests |
|--------|-----------|
| ConnectionManager | State transitions, reconnect logic |
| HttpClient | Auth header injection, timeout handling |
| ToolProxy | Local/remote routing |
| WorkspaceSyncService | .gitignore respect, tree building |
| PkceService | Verifier generation, challenge computation |
| AuthManager | State machine transitions |

### 11.2 Integration Tests

| Test | Method |
|------|--------|
| Connection to mock backend | Vitest + MSW (Mock Service Worker) |
| Tool call forwarding | Mock HTTP server |
| Auth flow | Mock OAuth endpoints |
| Workspace sync | Real filesystem + mock backend |

### 11.3 E2E Tests

| Test | Method |
|------|--------|
| Extension activation < 2s | @vscode/test-electron + timer |
| Panel rendering | Webview snapshot tests |
| Full auth flow | Test extension + real backend |

---

## 12. Migration Plan

### 12.1 Breaking Changes

| Change | Impact | Mitigation |
|--------|--------|------------|
| Remove autoStart | Users relying on auto-start | Document: backend must run externally |
| Remove host+port settings | Users with custom host/port | Auto-migrate to URL format |
| Require auth | Users currently unauthenticated | First-run setup wizard |

### 12.2 Settings Migration

```typescript
// On first activation after update:
if (settings.has('codeIntel.backend.host') && !settings.has('codeIntel.backend.url')) {
  const host = settings.get('codeIntel.backend.host');
  const port = settings.get('codeIntel.backend.port');
  await settings.update('codeIntel.backend.url', `http://${host}:${port}`);
}
```

---

## 13. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
