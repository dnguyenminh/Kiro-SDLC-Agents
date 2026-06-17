# Technical Design Document (TDD)

## Kiro SDLC Agents — KSA-293: Refactor kiro-sdlc-agents Extension to Light Client

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-293 |
| Title | Refactor kiro-sdlc-agents Extension to Light Client |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-293.docx |
| Related FSD | FSD-v1-KSA-293.docx |

---

## 1. Introduction

### 1.1 Purpose

Technical design for refactoring kiro-sdlc-agents from monolithic to thin client. Reuses KSA-292 patterns.

### 1.2 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | VS Code Extension Host (Node.js 18+) | 1.85+ |
| Language | TypeScript | 5.4+ |
| HTTP | Native fetch | Node 18+ |
| Build | esbuild | 0.21+ |
| UI | VS Code Webview API | N/A |
| Auth | VS Code SecretStorage | N/A |
| Streaming | ReadableStream / SSE | N/A |
| Testing | Vitest + Mocha | latest |

### 1.3 Design Principles

1. No local state — all data on backend
2. Fail gracefully — limited use without backend
3. Async-first — no blocking in activate()
4. Minimal deps — bundle < 500KB
5. Security by default — SecretStorage, HTTPS
6. Reuse KSA-292 patterns

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-293.docx |
| FSD | FSD-v1-KSA-293.docx |
| KSA-292 TDD | documents/KSA-292/TDD.md |


---

## 2. System Architecture

### 2.1 Architecture Overview

![Architecture Diagram](diagrams/architecture.png)

The extension follows a layered thin-client architecture with clear separation between local operations and remote proxy. All heavy computation (indexing, KB queries, LLM, tool execution) is delegated to the remote backend.

### 2.2 Component Diagram

![Component Diagram](diagrams/component.png)

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| ConnectionManager | Backend connectivity state machine | Native fetch |
| HealthChecker | Periodic /health polling | setInterval + fetch |
| AuthManager | Token lifecycle, login/logout state | SecretStorage API |
| TokenRefreshTimer | Auto-refresh before expiry | setInterval |
| PkceService | PKCE code_verifier/challenge generation | crypto.subtle |
| HttpClient | Auth-injecting HTTP wrapper | Native fetch |
| ToolProxy | Local/remote tool routing | Dispatch logic |
| FileProxyHandler | Local tool execution (embed_images) | fs API |
| WorkspaceSyncService | File tree scan and upload | workspace.findFiles |
| IndexingService | Document/source upload | FormData + fetch |
| WebviewPanelManager | Panel lifecycle and data fetching | Webview API |
| ChatPanel | SSE streaming chat UI | ReadableStream |
| Injector | Copy agents/steering to .kiro/ | fs.copyFile |
| ConfigWatcher | Watch orchestration.json changes | FileSystemWatcher |
| TreeViewProvider | Sidebar tree UI | TreeDataProvider |
| StatusBarManager | Connection status indicator | StatusBarItem |

---

## 3. Module Architecture

### 3.1 Directory Structure (Target)

```
kiro-sdlc-agents/src/
+-- extension.ts              # Entry point (activate/deactivate)
+-- auth/
|   +-- AuthManager.ts        # Auth state machine + SecretStorage
|   +-- TokenRefreshTimer.ts  # Auto-refresh every 5min check
|   +-- PkceService.ts        # PKCE verifier/challenge generation
+-- connection/
|   +-- ConnectionManager.ts  # URL-based state machine
|   +-- HealthChecker.ts      # /health polling
+-- proxy/
|   +-- HttpClient.ts         # Auth-injecting fetch wrapper
|   +-- ToolProxy.ts          # Local/remote routing
|   +-- FileProxyHandler.ts   # Local embed_images
+-- services/
|   +-- WorkspaceSyncService.ts  # File tree sync
|   +-- IndexingService.ts       # Upload indexing
+-- panels/
|   +-- base-panel.ts         # REFACTORED: fetch from remote
|   +-- dashboard-panel.ts    # /api/dashboard
|   +-- graph-panel.ts        # /api/graph
|   +-- quality-panel.ts      # /api/quality
|   +-- tags-panel.ts         # /api/tags
|   +-- analytics-panel.ts    # /api/analytics
|   +-- security-panel.ts     # /api/security
|   +-- workflow-panel.ts     # /api/workflow
|   +-- settings-panel.ts     # KEEP
+-- chat-panel/
|   +-- chat-panel-provider.ts   # REFACTORED: SSE to /api/chat
|   +-- context-usage-tracker.ts # KEEP
|   +-- conversation-manager.ts  # REFACTORED: backend sessions
|   +-- message-handler.ts       # REFACTORED: remote
|   +-- message-protocol.ts      # KEEP
+-- sidebar/
|   +-- tree-view-provider.ts    # REFACTORED
+-- config/
|   +-- config-watcher.ts     # KEEP
|   +-- config.ts             # KEEP
+-- local/
|   +-- injector.ts           # KEEP
|   +-- mcp-injector.ts       # REFACTOR
|   +-- checksum.ts           # KEEP
|   +-- file-utils.ts         # KEEP
+-- ui/
|   +-- status-bar.ts         # NEW
|   +-- notifications.ts      # NEW
+-- diagnostics-provider.ts   # KEEP
+-- symbol-search.ts          # REFACTOR: forward to remote
+-- ai-context-commands.ts    # REFACTOR: forward to remote
+-- types.ts                  # REFACTOR
```

### 3.2 Files to Remove

| File/Directory | Size Impact | Reason |
|----------------|-------------|--------|
| src/mcp-server-manager.ts | ~50 lines | Re-export of in-process server |
| src/mcp-server-inprocess.ts | ~500 lines | In-process MCP server |
| src/mcp-server-manager-legacy.ts | ~300 lines | Child process spawner |
| src/kb-event-bus.ts | ~100 lines | SSE to local server |
| src/indexer.ts | ~400 lines | Local SQLite indexing |
| src/model-downloader.ts | ~200 lines | ONNX model download |
| src/converter.ts | ~150 lines | File-to-markdown |
| src/native-addon-manager.ts | ~300 lines | Native binary resolution |
| src/onnx-addon-manager.ts | ~200 lines | ONNX runtime resolution |
| src/sf-indexer.ts | ~150 lines | Salesforce indexer |
| src/langgraph/ (entire) | ~2000 lines | Local LLM engine |
| src/anthropic/ (entire) | ~300 lines | Direct Anthropic calls |
| src/chat-panel/chat-models.ts | ~100 lines | Local model routing |
| src/chat-panel/token-counter.ts | ~50 lines | Local token counting |
| **TOTAL** | **~4800 lines** | |

---

## 4. Detailed Design

### 4.1 ConnectionManager

**Pattern:** State Machine (DISCONNECTED, CONNECTING, CONNECTED)
**Reuses:** KSA-292 ConnectionManager pattern

```typescript
interface RemoteBackendConfig {
  url: string;            // Full URL: "https://backend.company.com"
  healthCheckInterval: number;  // ms, default 30000
  toolCallTimeout: number;      // ms, default 300000
  chatTimeout: number;          // ms, default 120000
}

type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';

class ConnectionManager implements vscode.Disposable {
  private state: ConnectionState = 'DISCONNECTED';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelays = [1000, 2000, 4000, 8000, 16000];
  private healthTimer: NodeJS.Timeout | null = null;
  private readonly onStateChange = new vscode.EventEmitter<ConnectionState>();

  constructor(
    private config: RemoteBackendConfig,
    private authManager: AuthManager,
    private httpClient: HttpClient
  ) {}

  async connect(): Promise<void> {
    this.transitionTo('CONNECTING');
    const healthy = await this.healthChecker.checkOnce();
    if (healthy) {
      this.transitionTo('CONNECTED');
      this.reconnectAttempts = 0;
      this.startHealthPolling();
    } else {
      this.transitionTo('DISCONNECTED');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      vscode.window.showErrorMessage('Cannot connect to backend. Check URL.');
      return;
    }
    const delay = this.reconnectDelays[this.reconnectAttempts] || 16000;
    this.reconnectAttempts++;
    setTimeout(() => this.connect(), delay);
  }
}
```

### 4.2 HttpClient

**Pattern:** Decorator (adds auth headers to every request)

```typescript
class HttpClient {
  constructor(
    private baseUrl: string,
    private authManager: AuthManager
  ) {}

  private async getHeaders(): Promise<Record<string, string>> {
    const token = await this.authManager.getAccessToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  }

  async get<T>(path: string, timeout?: number): Promise<T> {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(timeout || 10000),
    });
    if (response.status === 401) {
      await this.authManager.refreshToken();
      return this.get(path, timeout); // retry once
    }
    if (!response.ok) throw new HttpError(response.status, await response.text());
    return response.json();
  }

  async post<T>(path: string, body: unknown, timeout?: number): Promise<T> {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout || 10000),
    });
    if (response.status === 401) {
      await this.authManager.refreshToken();
      return this.post(path, body, timeout);
    }
    if (!response.ok) throw new HttpError(response.status, await response.text());
    return response.json();
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    return this.post('/mcp/tools/call', { name, arguments: args }, 300000);
  }

  async stream(path: string, body: unknown, timeout?: number): Promise<ReadableStream> {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout || 120000),
    });
    if (!response.ok) throw new HttpError(response.status, await response.text());
    return response.body!;
  }
}
```

### 4.3 AuthManager

**Pattern:** State Machine (UNAUTHENTICATED, AUTHENTICATING, AUTHENTICATED)

```typescript
type AuthState = 'UNAUTHENTICATED' | 'AUTHENTICATING' | 'AUTHENTICATED';

class AuthManager implements vscode.Disposable {
  private state: AuthState = 'UNAUTHENTICATED';
  private refreshTimer: TokenRefreshTimer;
  private readonly onStateChange = new vscode.EventEmitter<AuthState>();

  constructor(private secrets: vscode.SecretStorage, private baseUrl: string) {
    this.refreshTimer = new TokenRefreshTimer(this);
  }

  async initialize(): Promise<void> {
    const token = await this.secrets.get('kiroSdlc.accessToken');
    if (token && !this.isExpired(token)) {
      this.transitionTo('AUTHENTICATED');
      this.refreshTimer.start();
    }
  }

  async getAccessToken(): Promise<string | null> {
    if (this.state !== 'AUTHENTICATED') return null;
    const token = await this.secrets.get('kiroSdlc.accessToken');
    if (token && this.isExpired(token)) {
      await this.refreshToken();
      return this.secrets.get('kiroSdlc.accessToken');
    }
    return token;
  }

  async login(username: string, password: string): Promise<void> {
    this.transitionTo('AUTHENTICATING');
    const response = await fetch(`${this.baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      this.transitionTo('UNAUTHENTICATED');
      throw new AuthError('Invalid credentials');
    }
    const { access_token, refresh_token } = await response.json();
    await this.secrets.store('kiroSdlc.accessToken', access_token);
    await this.secrets.store('kiroSdlc.refreshToken', refresh_token);
    this.transitionTo('AUTHENTICATED');
    this.refreshTimer.start();
  }

  async refreshToken(): Promise<void> {
    const refreshToken = await this.secrets.get('kiroSdlc.refreshToken');
    if (!refreshToken) { this.transitionTo('UNAUTHENTICATED'); return; }
    const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) { this.transitionTo('UNAUTHENTICATED'); return; }
    const { access_token } = await response.json();
    await this.secrets.store('kiroSdlc.accessToken', access_token);
  }

  async logout(): Promise<void> {
    await this.secrets.delete('kiroSdlc.accessToken');
    await this.secrets.delete('kiroSdlc.refreshToken');
    this.refreshTimer.stop();
    this.transitionTo('UNAUTHENTICATED');
  }
}
```

### 4.4 ToolProxy

```typescript
class ToolProxy {
  private localTools = new Set(['embed_images']);
  private toolRegistry: Map<string, ToolDefinition> = new Map();

  constructor(
    private httpClient: HttpClient,
    private fileProxyHandler: FileProxyHandler
  ) {}

  async refreshTools(): Promise<void> {
    const tools = await this.httpClient.get<ToolDefinition[]>('/mcp/tools/list');
    this.toolRegistry.clear();
    for (const tool of tools) {
      this.toolRegistry.set(tool.name, tool);
    }
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    if (this.localTools.has(name)) {
      return this.fileProxyHandler.execute(name, args);
    }
    return this.httpClient.callTool(name, args);
  }

  getAvailableTools(): ToolDefinition[] {
    return [...this.toolRegistry.values()];
  }
}
```

### 4.5 WorkspaceSyncService

```typescript
class WorkspaceSyncService implements vscode.Disposable {
  private watcher: vscode.Disposable;

  constructor(private httpClient: HttpClient) {
    this.watcher = vscode.workspace.onDidChangeWorkspaceFolders(() => this.sync());
  }

  async sync(): Promise<void> {
    const files = await vscode.workspace.findFiles('**/*', '{node_modules,dist,.git,build}/**');
    const tree = {
      workspace_name: vscode.workspace.name || 'unknown',
      files: await Promise.all(files.slice(0, 10000).map(async (f) => ({
        path: vscode.workspace.asRelativePath(f),
        type: 'file' as const,
        size: (await vscode.workspace.fs.stat(f)).size,
      }))),
    };
    await this.httpClient.post('/api/workspace/sync', tree, 30000);
  }
}
```

### 4.6 IndexingService

```typescript
class IndexingService {
  constructor(private httpClient: HttpClient) {}

  async indexDocuments(): Promise<{ indexed: number }> {
    const mdFiles = await vscode.workspace.findFiles('**/*.md', '{node_modules,dist,.git}/**');
    return this.uploadFiles(mdFiles, '/api/index/documents');
  }

  async indexSource(): Promise<{ indexed: number }> {
    const srcFiles = await vscode.workspace.findFiles(
      '**/*.{ts,js,kt,java,py,go,rs,tsx,jsx}',
      '{node_modules,dist,.git,build}/**'
    );
    return this.uploadFiles(srcFiles, '/api/index/source');
  }

  private async uploadFiles(files: vscode.Uri[], endpoint: string): Promise<{ indexed: number }> {
    const formData = new FormData();
    for (const file of files) {
      const content = await vscode.workspace.fs.readFile(file);
      const stat = await vscode.workspace.fs.stat(file);
      if (stat.size > 1_000_000) continue; // Skip > 1MB
      const relativePath = vscode.workspace.asRelativePath(file);
      formData.append('files', new Blob([content]), relativePath);
    }
    const headers = await this.httpClient.getAuthHeaders();
    const response = await fetch(`${this.httpClient.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { ...headers }, // No Content-Type (FormData sets boundary)
      body: formData,
      signal: AbortSignal.timeout(600000),
    });
    return response.json();
  }
}
```

### 4.7 PkceService

```typescript
class PkceService {
  generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  async generateCodeChallenge(verifier: string): Promise<string> {
    const data = new TextEncoder().encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(hash));
  }

  private base64UrlEncode(bytes: Uint8Array): string {
    return Buffer.from(bytes)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}
```

### 4.8 ChatPanel (Refactored)

```typescript
class ChatPanelProvider implements vscode.WebviewViewProvider {
  private httpClient: HttpClient;
  private sessionId: string = crypto.randomUUID();

  async sendMessage(text: string, context: ChatContext[]): Promise<void> {
    const body = { message: text, context, session_id: this.sessionId };
    const stream = await this.httpClient.stream('/api/chat', body, 120000);
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      this.postToWebview({ type: 'chat:chunk', content: chunk });
    }
    this.postToWebview({ type: 'chat:done' });
  }
}
```

---

## 5. Configuration Changes

### 5.1 package.json — Settings

**Remove:**

```json
{
  "kiroSdlc.enableMcpServer": "(removed)",
  "kiroSdlc.mcpServerPort": "(removed)",
  "kiroSdlc.llmProvider": "(removed)",
  "kiroSdlc.llmModel": "(removed)",
  "kiroSdlc.anthropicBaseUrl": "(removed)",
  "kiroSdlc.openaiBaseUrl": "(removed)",
  "kiroSdlc.ollamaUrl": "(removed)",
  "kiroSdlc.kiroModel": "(removed)",
  "kiroSdlc.kiroRegion": "(removed)"
}
```

**Add:**

```json
{
  "kiroSdlc.backend.url": {
    "type": "string",
    "default": "http://127.0.0.1:48721",
    "description": "Remote Kiro backend server URL"
  },
  "kiroSdlc.backend.ssoEnabled": {
    "type": "boolean",
    "default": false,
    "description": "Enable SSO/PKCE authentication"
  },
  "kiroSdlc.backend.ssoProviderUrl": {
    "type": "string",
    "default": "",
    "description": "OAuth2 SSO provider URL for PKCE flow"
  },
  "kiroSdlc.backend.toolCallTimeout": {
    "type": "number",
    "default": 300000,
    "description": "Timeout for MCP tool calls (ms)"
  },
  "kiroSdlc.backend.chatTimeout": {
    "type": "number",
    "default": 120000,
    "description": "Timeout for chat responses (ms)"
  }
}
```

**Keep unchanged:** `kiroSdlc.configPath`, `kiroSdlc.backend.healthCheckInterval`

### 5.2 package.json — Dependencies

**Remove:**

```json
{
  "@anthropic-ai/sdk": "remove",
  "@langchain/core": "remove",
  "@langchain/langgraph": "remove",
  "3d-force-graph": "remove (CDN in webview)",
  "chart.js": "remove (CDN in webview)",
  "three": "remove (CDN in webview)",
  "filetomarkdown": "remove"
}
```

**Keep:**

```json
{
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "typescript": "^5.4.0",
    "esbuild": "^0.21.0",
    "@vscode/vsce": "^2.24.0",
    "vitest": "^4.1.8",
    "mocha": "^10.7.3"
  }
}
```

**Result:** Zero production dependencies. All handled by Node.js built-ins and VS Code API.

---

## 6. Security Design

### 6.1 Token Lifecycle

```
Login → access_token (JWT, 1h) + refresh_token (opaque, 30d)
  ↓
Store in SecretStorage (OS keychain)
  ↓
TokenRefreshTimer (every 5min):
  if access_token expires in < 5min → POST /api/auth/refresh
  ↓
On 401 → refresh → if fail → UNAUTHENTICATED → login panel
```

### 6.2 PKCE Flow Security

| Step | Data | Storage |
|------|------|---------|
| Generate verifier | 32 random bytes → base64url | In-memory only |
| Compute challenge | SHA-256(verifier) → base64url | Sent to SSO |
| Exchange code | auth_code + verifier → tokens | Verifier discarded |

### 6.3 Data Protection

- No absolute filesystem paths sent to backend (relative only)
- File content for indexing: sent via HTTPS with Bearer auth
- Tokens never logged (OutputChannel redacts)
- No tokens in settings (SecretStorage only)
- Workspace sync: paths only, no content

### 6.4 Input Validation

| Input | Validation |
|-------|-----------|
| Backend URL | Must be valid URL (http:// or https://) |
| Username | Non-empty, max 256 chars |
| Password | Non-empty, not logged |
| Tool args | Passed through (backend validates) |
| File paths | Relative only, no .. traversal |

---

## 7. Error Handling and Resilience

### 7.1 Connection Resilience

```
Reconnect strategy:
  attempts: 0..5
  delays: [1s, 2s, 4s, 8s, 16s]

  on health_fail:
    if attempts < max: wait(delay[attempts]), retry
    else: notify user "Cannot connect"
```

### 7.2 HTTP Error Handling

| HTTP Status | Action |
|-------------|--------|
| 200 | Return result |
| 401 | Refresh token, retry once. If still 401: logout |
| 403 | Show "Access denied" notification |
| 404 | Tool not found: refresh tool list |
| 429 | Back off per Retry-After header |
| 500 | Show error notification with message |
| Timeout | Show "Request timed out", offer retry |
| Network error | Transition to DISCONNECTED, reconnect |

### 7.3 Graceful Degradation

| Backend Status | Available | Unavailable |
|---------------|-----------|-------------|
| Connected + Auth | ALL features | None |
| Connected + No Auth | Login panel | Everything else |
| Disconnected | Inject, config, diagnostics | Remote tools, panels, chat |

---

## 8. Performance Design

### 8.1 Activation Sequence (< 100ms sync)

```
activate():
  t=0ms   Create OutputChannel (sync)
  t=2ms   Create StatusBarManager (sync)
  t=5ms   Register commands (sync, ~20 commands)
  t=10ms  Create AuthManager (sync, just state init)
  t=12ms  Register TreeView (sync)
  t=15ms  RETURN (activate complete)

  // Async, non-blocking:
  t=20ms  AuthManager.initialize() → check SecretStorage
  t=50ms  If token valid → ConnectionManager.connect()
  t=200ms If connected → WorkspaceSyncService.sync()
  t=300ms ToolProxy.refreshTools()
```

### 8.2 Lazy Loading

| Component | Loaded When |
|-----------|------------|
| WebviewPanelManager | First panel opened |
| ChatPanel | "Open Chat" command |
| IndexingService | "Index Documents/Source" command |
| LoginPanel | Auth required |
| PkceService | SSO login initiated |

### 8.3 Bundle Size Target

| Component | Estimated Size |
|-----------|---------------|
| Extension code (esbuild) | ~150KB |
| Bundled resources (agents, steering) | ~200KB |
| HTML/CSS for webviews | ~50KB |
| **Total** | **~400KB** |

---

## 9. Testing Strategy

### 9.1 Unit Tests (Vitest)

| Module | Key Tests |
|--------|-----------|
| ConnectionManager | State transitions, reconnect backoff |
| HttpClient | Auth injection, 401 retry, timeout |
| ToolProxy | Local/remote routing |
| AuthManager | Login, refresh, logout state machine |
| PkceService | Verifier generation, challenge computation |
| WorkspaceSyncService | .gitignore respect, tree building |
| IndexingService | File filtering, size limits |

### 9.2 Integration Tests

| Test | Method |
|------|--------|
| Connection to mock backend | Vitest + mock fetch |
| Tool call forwarding | Mock HTTP responses |
| Auth flow | Mock /api/auth endpoints |
| Workspace sync | Real fs + mock backend |

### 9.3 E2E Tests

| Test | Method |
|------|--------|
| Extension activation < 2s | @vscode/test-electron + timer |
| Full auth + connect flow | Real backend |
| Panel data loading | Real backend + webview |

---

## 10. Implementation Checklist

### 10.1 Phase 1: Remove (Day 1-2)

| # | Task | Files |
|---|------|-------|
| 1 | Delete MCP server files | mcp-server-*.ts, kb-event-bus.ts |
| 2 | Delete indexing files | indexer.ts, model-downloader.ts, converter.ts |
| 3 | Delete native addon files | native-addon-manager.ts, onnx-addon-manager.ts |
| 4 | Delete LangGraph directory | src/langgraph/ (entire) |
| 5 | Delete Anthropic directory | src/anthropic/ (entire) |
| 6 | Delete sf-indexer.ts | sf-indexer.ts |
| 7 | Remove heavy dependencies | package.json cleanup |
| 8 | Fix compilation errors | Update imports in extension.ts |

### 10.2 Phase 2: Core Infrastructure (Day 3-5)

| # | Task | Files |
|---|------|-------|
| 9 | Create AuthManager | src/auth/AuthManager.ts |
| 10 | Create TokenRefreshTimer | src/auth/TokenRefreshTimer.ts |
| 11 | Create PkceService | src/auth/PkceService.ts |
| 12 | Create HttpClient | src/proxy/HttpClient.ts |
| 13 | Create ConnectionManager | src/connection/ConnectionManager.ts |
| 14 | Create HealthChecker | src/connection/HealthChecker.ts |
| 15 | Update package.json settings | Remove old, add new settings |

### 10.3 Phase 3: Services (Day 6-7)

| # | Task | Files |
|---|------|-------|
| 16 | Create WorkspaceSyncService | src/services/WorkspaceSyncService.ts |
| 17 | Create IndexingService | src/services/IndexingService.ts |
| 18 | Refactor ToolProxy | src/proxy/ToolProxy.ts |
| 19 | Update mcp-injector | Write remote URL to mcp.json |

### 10.4 Phase 4: UI Layer (Day 8-10)

| # | Task | Files |
|---|------|-------|
| 20 | Refactor base-panel | Fetch from HttpClient |
| 21 | Refactor all panel files | Use remote endpoints |
| 22 | Refactor ChatPanelProvider | SSE streaming |
| 23 | Remove chat-models.ts, token-counter.ts | Dead code |
| 24 | Refactor tree-view-provider | Remote status |
| 25 | Refactor symbol-search | Forward to remote |
| 26 | Refactor ai-context-commands | Forward to remote |
| 27 | Create StatusBar module | Connection indicators |

### 10.5 Phase 5: Integration (Day 11-12)

| # | Task | Files |
|---|------|-------|
| 28 | Rewrite extension.ts | Wire all components |
| 29 | Update package.json commands | Add/remove commands |
| 30 | Update esbuild config | Exclude removed modules |
| 31 | Write unit tests | All new modules |
| 32 | Integration testing | Mock backend |
| 33 | Bundle size verification | < 500KB check |

---

## 11. Migration Plan

### 11.1 Settings Migration

```typescript
// In activate(), check for legacy settings and migrate:
async function migrateSettings(): Promise<void> {
  const config = vscode.workspace.getConfiguration('kiroSdlc');
  // Legacy: host + port → new: url
  const legacyHost = config.get<string>('backend.host');
  const legacyPort = config.get<number>('backend.port') || config.get<number>('mcpServerPort');
  if (legacyHost && !config.has('backend.url')) {
    const url = `http://${legacyHost}:${legacyPort || 48721}`;
    await config.update('backend.url', url, vscode.ConfigurationTarget.Workspace);
  }
}
```

### 11.2 Breaking Changes

| Change | Impact | Mitigation |
|--------|--------|------------|
| No local MCP server | Users relying on autoStart | Document: backend must run externally |
| Remove LLM settings | Users with custom providers | All LLM via backend now |
| Require auth | Previously unauthenticated | First-run login prompt |
| Remove model download | Users with offline ONNX | Backend handles models |

---

## 12. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
