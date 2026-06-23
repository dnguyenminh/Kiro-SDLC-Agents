# Technical Design Document (TDD)

## Kiro SDLC Agents Extension — KSA-120: Bundle MCP NodeJS Server + Native VS Code Webview KB Panels

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-120 |
| Title | Bundle MCP NodeJS Server + Native VS Code Webview KB Panels |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2025-05-24 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-120.docx |
| Related FSD | FSD-v1-KSA-120.docx |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | SA Agent – Solution Architect | Create document |
| Peer Reviewer | TA Agent – Technical Analyst | Review technical feasibility |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-05-24 | SA Agent | Initial TDD — architecture, component design, API design |
| 1.1 | 2025-05-24 | BA Agent | Updated for HTTP transport, port 9180, Stop/Start/Change Port commands |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm the technical design in this TDD |
| | ☐ I agree and confirm the technical design in this TDD |

---

## 1. Introduction

> **Scope Boundary:** This TDD specifies HOW to implement the requirements defined in the FSD. It does NOT repeat functional requirements, business rules, use cases, or UI specifications — refer to the FSD for those. This document focuses on: technology choices, architecture decisions, implementation patterns, and deployment concerns.

### 1.1 Purpose

This TDD provides the technical design for upgrading the `kiro-sdlc-agents` VS Code extension from v1.8.1 to v2.0.0. The upgrade introduces two major capabilities:
1. Bundled MCP NodeJS server with automatic lifecycle management
2. Five native VS Code Webview panels replacing the iframe-based KB viewer

### 1.2 Scope

| In Scope | Out of Scope |
|----------|-------------|
| McpServerManager — spawn, monitor, restart child process | MCP server internal logic (32 tools unchanged) |
| WebviewPanelManager — factory for 5 native panels | Agent prompt modifications |
| TreeViewProvider — sidebar Activity Bar | Python/Kotlin MCP variants |
| Extension packaging with native addons | Mobile/web extension support |
| postMessage communication protocol | Backend API changes |
| CSP and security hardening for webviews | Database schema changes |

### 1.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | 5.4+ |
| Runtime | Node.js (VS Code built-in) | 20+ |
| Platform | VS Code Extension API | ^1.85.0 |
| Build Tool | tsc + vsce | 5.4 / 2.24 |
| 3D Rendering | Three.js + 3d-force-graph | Latest |
| Charts | Chart.js | 4.x |
| Database | SQLite (via better-sqlite3 in MCP server) | 3.x |
| HTTP Server | Node.js built-in `http` module (MCP server) | — |
| Communication | JSON-RPC 2.0 over HTTP | — |
| Packaging | VSIX (platform-specific) | — |

### 1.4 Design Principles

- **Process Isolation** — MCP server runs as separate child process; crash doesn't affect extension host
- **Singleton Pattern** — One McpServerManager, one instance per panel type
- **Lazy Loading** — Heavy assets (Three.js, Chart.js) loaded only when panel opens
- **Graceful Degradation** — Core commands work without MCP server; panels show clear error states
- **Zero Configuration** — Bundled server auto-starts; no user setup required
- **Backward Compatibility** — All v1.8.1 features preserved unchanged

### 1.5 Constraints

- Extension package size MUST be < 50MB including native addons
- `better-sqlite3` requires platform-specific pre-built binaries (no compile at install)
- Webview panels cannot make network requests (CSP restriction)
- VS Code limits one extension host process — all extension code shares one thread
- `retainContextWhenHidden` increases memory usage per panel (~20-50MB for Graph panel)

### 1.6 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-120.docx |
| FSD | FSD-v1-KSA-120.docx |
| VS Code Webview API | https://code.visualstudio.com/api/extension-guides/webview |
| VS Code TreeView API | https://code.visualstudio.com/api/extension-guides/tree-view |
| MCP Protocol Spec | https://modelcontextprotocol.io/specification |

---

## 2. System Architecture

### 2.1 Architecture Overview

The extension operates as a VS Code Extension Host plugin that manages a child Node.js process (MCP server) and renders native Webview panels. Communication flows through two channels:
1. **Extension ↔ MCP Server**: JSON-RPC 2.0 over HTTP (POST to localhost:9180)
2. **Extension ↔ Webview Panels**: VS Code postMessage API (no network)

![Architecture Diagram](diagrams/architecture.png)

### 2.2 Component Diagram

![Component Diagram](diagrams/component.png)

| Component | Responsibility | Technology | Source File |
|-----------|---------------|------------|-------------|
| **McpServerManager** | Spawn/kill/restart MCP server, health monitoring, HTTP tool invocation | Node.js child_process + http | `src/mcp-server-manager.ts` |
| **WebviewPanelManager** | Create/reveal/dispose webview panels, singleton enforcement | VS Code Webview API | `src/webview-panel-manager.ts` |
| **BasePanel** | Abstract base class — HTML generation, message handling, lifecycle | VS Code Webview API | `src/panels/base-panel.ts` |
| **GraphPanel** | 3D force-directed graph with Three.js | Three.js + 3d-force-graph | `src/panels/graph-panel.ts` |
| **DashboardPanel** | Health gauge, charts, metrics, auto-refresh | Chart.js | `src/panels/dashboard-panel.ts` |
| **TagsPanel** | Tag cloud, taxonomy tree, tag CRUD | DOM manipulation | `src/panels/tags-panel.ts` |
| **QualityPanel** | Quality histogram, low-quality table, bulk actions | Chart.js + DOM | `src/panels/quality-panel.ts` |
| **AnalyticsPanel** | Search volume, popular queries, gaps, recommendations | Chart.js + DOM | `src/panels/analytics-panel.ts` |
| **TreeViewProvider** | Sidebar Activity Bar tree with KB panels + server status | VS Code TreeView API | `src/sidebar/tree-view-provider.ts` |
| **MessageHandler** | Route messages between webview and MCP server | TypeScript | `src/webview/message-handler.ts` |
| **HtmlTemplateEngine** | Generate CSP-compliant HTML for each panel type | TypeScript | `src/webview/html-templates.ts` |
| **CommandRegistry** | Register and handle all 16 commands | VS Code Commands API | `src/extension.ts` (enhanced) |
| **StatusBarManager** | Display server status in VS Code status bar | VS Code StatusBar API | `src/extension.ts` (enhanced) |

### 2.3 Deployment Architecture

![Deployment Diagram](diagrams/deployment.png)

**VSIX Package Structure (platform-specific):**

```
kiro-sdlc-agents-2.0.0-{platform}.vsix
├── extension/
│   ├── out/                          # Compiled TypeScript → JavaScript
│   │   ├── extension.js
│   │   ├── mcp-server-manager.js
│   │   ├── webview-panel-manager.js
│   │   ├── panels/
│   │   ├── sidebar/
│   │   └── webview/
│   ├── mcp-server/                   # Bundled MCP NodeJS server
│   │   ├── index.js                  # Server entry point
│   │   ├── node_modules/             # Server dependencies (tree-shaken)
│   │   │   ├── better-sqlite3/      # Platform-specific native addon
│   │   │   │   └── prebuilds/
│   │   │   │       └── {platform}/  # win32-x64, darwin-arm64, linux-x64
│   │   │   ├── onnxruntime-node/    # ONNX inference (platform-specific)
│   │   │   └── ...
│   │   └── ...
│   ├── webview-assets/               # Static assets for webview panels
│   │   ├── three.min.js             # Three.js (lazy-loaded)
│   │   ├── 3d-force-graph.min.js    # Force graph library
│   │   ├── chart.min.js             # Chart.js
│   │   ├── ui-tokens.css            # Design tokens
│   │   ├── ux-components.css        # Shared components
│   │   └── panel-specific/          # Per-panel JS/CSS
│   ├── resources/
│   │   ├── icon.png                  # Extension icon
│   │   ├── sidebar-icon.svg          # Activity Bar icon
│   │   └── agents/                   # Bundled agent definitions
│   ├── package.json
│   └── README.md
└── [Content_Types].xml
```

**Platform Variants:**

| Platform | Native Addons | Target |
|----------|--------------|--------|
| `win32-x64` | better-sqlite3 (win32-x64-napi), onnxruntime-node (win32-x64) | Windows 10+ x64 |
| `darwin-arm64` | better-sqlite3 (darwin-arm64-napi), onnxruntime-node (darwin-arm64) | macOS 12+ Apple Silicon |
| `linux-x64` | better-sqlite3 (linux-x64-napi), onnxruntime-node (linux-x64) | Ubuntu 20.04+ x64 |

### 2.4 Communication Patterns

| From | To | Protocol | Pattern | Description |
|------|----|----------|---------|-------------|
| Extension Host | MCP Server | JSON-RPC 2.0 / HTTP | Request-Response | Tool invocations via HTTP POST to localhost:9180 |
| MCP Server | Extension Host | JSON-RPC 2.0 / HTTP | Response | Tool results |
| MCP Server | Extension Host | stderr pipe | Stream | Server logs → Output Channel |
| Extension Host | Webview Panel | postMessage | Push | Data updates, status changes |
| Webview Panel | Extension Host | postMessage | Request | User actions (filter, refresh, create) |
| Extension Host | TreeView | Event emitter | Push | Server status changes → tree refresh |
| Extension Host | StatusBar | Direct API | Push | Server state → status bar text |

---

## 3. API Design

> **Prerequisite:** Functional API contracts (message types, data flows) are defined in FSD §3.2.4. This section specifies the technical implementation: TypeScript interfaces, message routing, error handling, and timeout management.

### 3.1 API Overview — Internal Message Protocol

This extension has NO external HTTP APIs. All communication is internal:

| # | Interface | Direction | Protocol | Description | Source |
|---|-----------|-----------|----------|-------------|--------|
| 1 | MCP Tool Invocation | Ext → Server | JSON-RPC 2.0 / HTTP | Invoke any of 32 MCP tools | UC-01 to UC-12 |
| 2 | Webview Ready | Webview → Ext | postMessage | Panel loaded, ready for data | UC-05 to UC-09 |
| 3 | Webview Data Push | Ext → Webview | postMessage | Send data to render | UC-05 to UC-09 |
| 4 | Webview User Action | Webview → Ext | postMessage | Filter, refresh, create, bulk action | UC-05 to UC-09 |
| 5 | Server Status Broadcast | Ext → Webview(s) | postMessage | Server connected/disconnected/failed | UC-12 |

### 3.2 MCP Tool Invocation Interface

**TypeScript Interface:**

```typescript
interface McpRequest {
  jsonrpc: "2.0";
  id: number;
  method: "tools/call";
  params: {
    name: string;       // Tool name (e.g., "mem_search", "mem_graph")
    arguments: Record<string, unknown>;
  };
}

interface McpResponse {
  jsonrpc: "2.0";
  id: number;
  result?: {
    content: Array<{ type: "text"; text: string }>;
  };
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}
```

**Invocation Flow:**

```typescript
class McpServerManager {
  private requestId = 0;
  private pendingRequests = new Map<number, PendingRequest>();
  private readonly TIMEOUT_MS = 30_000;

  async invokeTool(name: string, args: Record<string, unknown>): Promise<string> {
    if (this.status !== "running") {
      throw new McpServerNotRunningError();
    }

    const id = ++this.requestId;
    const request: McpRequest = {
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: args }
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new McpTimeoutError(name, this.TIMEOUT_MS));
      }, this.TIMEOUT_MS);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      // HTTP POST to MCP server
      const postData = JSON.stringify(request);
      const req = http.request({
        hostname: "localhost",
        port: this.port, // default 9180
        path: "/",
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) }
      }, (res) => {
        let body = "";
        res.on("data", (chunk) => body += chunk);
        res.on("end", () => this.handleResponse(body));
      });
      req.on("error", (err) => reject(new McpInternalError(err.message)));
      req.write(postData);
      req.end();
    });
  }
}
```

**Error Handling:**

| Error Type | HTTP-equiv | Error Code | Recovery |
|-----------|-----------|------------|----------|
| McpServerNotRunningError | 503 | `MCP_NOT_RUNNING` | Auto-start server, retry once |
| McpTimeoutError | 504 | `MCP_TIMEOUT` | Show timeout message, user can retry |
| McpToolNotFoundError | 404 | `MCP_TOOL_NOT_FOUND` | Show error, no retry |
| McpInternalError | 500 | `MCP_INTERNAL` | Log error, show generic message |

### 3.3 Webview Message Protocol Interface

**TypeScript Interfaces:**

```typescript
// Messages FROM Webview TO Extension
type WebviewToExtMessage =
  | { type: "ready" }
  | { type: "refresh" }
  | { type: "filterByType"; types: string[] }
  | { type: "filterByTier"; tiers: string[] }
  | { type: "filterByTag"; tag: string }
  | { type: "nodeClick"; entryId: number }
  | { type: "createTag"; tag: string; category?: string }
  | { type: "searchNodes"; query: string }
  | { type: "bulkAction"; action: "archive" | "delete" | "review"; entryIds: number[] }
  | { type: "createEntry"; title: string; content: string; type: string }
  | { type: "manualRetry" };

// Messages FROM Extension TO Webview
type ExtToWebviewMessage =
  | { type: "graphData"; nodes: GraphNode[]; edges: GraphEdge[] }
  | { type: "dashboardData"; health: number; types: Record<string, number>; tiers: Record<string, number>; trend: TrendPoint[]; recent: RecentEntry[] }
  | { type: "tagsData"; taxonomy: TagTaxonomy; popular: PopularTag[] }
  | { type: "qualityData"; stats: QualityStats; lowQuality: QualityEntry[]; confidence: ConfidenceStats; unreliable: QualityEntry[] }
  | { type: "analyticsData"; volume: VolumePoint[]; popular: PopularQuery[]; gaps: GapEntry[]; recommendations: Recommendation[] }
  | { type: "filteredEntries"; entries: KbEntry[] }
  | { type: "entryDetail"; entry: KbEntry }
  | { type: "serverStatus"; status: "connected" | "disconnected" | "failed" }
  | { type: "error"; message: string; retryable: boolean };
```

**Message Routing (Extension Side):**

```typescript
class MessageHandler {
  constructor(
    private mcpManager: McpServerManager,
    private panel: vscode.WebviewPanel,
    private dataLoader: DataLoader
  ) {}

  async handleMessage(msg: WebviewToExtMessage): Promise<void> {
    switch (msg.type) {
      case "ready":
      case "refresh":
        const data = await this.dataLoader.loadAll();
        this.panel.webview.postMessage(data);
        break;
      case "filterByType":
        const filtered = await this.dataLoader.loadFiltered({ types: msg.types });
        this.panel.webview.postMessage({ type: "filteredEntries", entries: filtered });
        break;
      case "nodeClick":
        const entry = await this.mcpManager.invokeTool("mem_crud", { action: "get", id: msg.entryId });
        this.panel.webview.postMessage({ type: "entryDetail", entry: JSON.parse(entry) });
        break;
      case "bulkAction":
        await this.executeBulkAction(msg.action, msg.entryIds);
        break;
      case "manualRetry":
        await this.mcpManager.restart();
        break;
    }
  }
}
```

---

## 4. Database Design

> **Note:** This extension does NOT manage its own database. The SQLite database (`.code-intel/index.db`) is managed entirely by the MCP server. The extension interacts with it only through MCP tool invocations.

### 4.1 Data Storage Overview

| Storage | Owner | Location | Access Method |
|---------|-------|----------|---------------|
| KB SQLite Database | MCP Server | `{workspace}/.code-intel/index.db` | MCP tools (mem_*) |
| ONNX Model | MCP Server | `{workspace}/.code-intel/models/model.onnx` | MCP server internal |
| Orchestration Config | MCP Server | `{workspace}/.code-intel/orchestration.json` | File read (extension passes path) |
| MCP Config | Extension | `{workspace}/.kiro/settings/mcp.json` | Direct file R/W |
| Server PID | Extension | `{workspace}/.code-intel/server.pid` | Direct file R/W |

### 4.2 Extension-Managed Files

#### File: `.kiro/settings/mcp.json`

```json
{
  "mcpServers": {
    "code-intelligence": {
      "command": "node",
      "args": [
        "${extensionPath}/mcp-server/index.js",
        "--config",
        "${workspaceFolder}/.code-intel/orchestration.json"
      ],
      "cwd": "${workspaceFolder}",
      "env": {
        "CODE_INTEL_WORKSPACE": "${workspaceFolder}"
      },
      "port": 9180,
      "transportType": "http"
    }
  }
}
```

#### File: `.code-intel/server.pid`

```
12345
```

Single line containing the PID of the running MCP server process. Used for orphan cleanup on next activation.

### 4.3 No Migration Required

The extension upgrade from v1.8.1 to v2.0.0 requires NO database migrations. The MCP server's SQLite schema is unchanged. The extension only adds new files:
- `mcp-server/` directory (bundled server)
- `webview-assets/` directory (panel assets)
- `.code-intel/server.pid` (runtime state)

---

## 5. Class / Module Design

### 5.1 Package Structure

```
kiro-sdlc-agents/src/
├── extension.ts                    # Entry point — activate/deactivate, command registration
├── types.ts                        # Shared TypeScript interfaces and types
├── config.ts                       # Extension configuration (existing, enhanced)
├── checksum.ts                     # Version/upgrade detection (existing, unchanged)
├── file-utils.ts                   # File system utilities (existing, unchanged)
├── injector.ts                     # Agent injection logic (existing, unchanged)
├── mcp-injector.ts                 # MCP config injection (existing, enhanced)
├── indexer.ts                      # Workspace indexing (existing, unchanged)
├── model-downloader.ts             # ONNX model download (existing, unchanged)
│
├── mcp-server-manager.ts           # NEW — Server lifecycle management
├── webview-panel-manager.ts        # NEW — Panel factory and singleton registry
│
├── panels/                         # NEW — Webview panel implementations
│   ├── base-panel.ts              # Abstract base class
│   ├── graph-panel.ts             # 3D knowledge graph
│   ├── dashboard-panel.ts         # Health metrics dashboard
│   ├── tags-panel.ts              # Tag cloud and taxonomy
│   ├── quality-panel.ts           # Quality scores
│   └── analytics-panel.ts         # Search analytics
│
├── sidebar/                        # NEW — Activity Bar tree view
│   └── tree-view-provider.ts      # TreeDataProvider implementation
│
└── webview/                        # NEW — Webview utilities
    ├── html-templates.ts           # HTML generation with CSP
    └── message-handler.ts          # Message routing
```

### 5.2 Key Interfaces

```typescript
// === Server Management ===

interface IServerManager {
  readonly status: ServerStatus;
  readonly pid: number | null;
  spawn(): Promise<void>;
  kill(): Promise<void>;
  restart(): Promise<void>;
  invokeTool(name: string, args: Record<string, unknown>): Promise<string>;
  onStatusChange: vscode.Event<ServerStatus>;
}

type ServerStatus = "starting" | "running" | "crashed" | "stopped";

// === Panel Management ===

interface IPanelManager {
  openPanel(type: PanelType): void;
  getPanel(type: PanelType): IKbPanel | undefined;
  disposeAll(): void;
  notifyAllPanels(message: ExtToWebviewMessage): void;
}

type PanelType = "graph" | "dashboard" | "tags" | "quality" | "analytics";

interface IKbPanel {
  readonly viewType: string;
  readonly panel: vscode.WebviewPanel;
  reveal(): void;
  dispose(): void;
  sendMessage(msg: ExtToWebviewMessage): void;
  loadData(): Promise<void>;
}

// === Data Models ===

interface GraphNode {
  id: number;
  title: string;
  type: string;       // DECISION, ERROR_PATTERN, ARCHITECTURE, etc.
  tier: string;       // WORKING, EPISODIC, SEMANTIC, PROCEDURAL
  color: string;      // Hex color based on type
  size: number;       // Based on citation count
}

interface GraphEdge {
  source: number;
  target: number;
  relation: string;   // RELATED, CITES, DEPENDS_ON
}

interface DashboardMetrics {
  health: number;           // 0-100
  types: Record<string, number>;
  tiers: Record<string, number>;
  trend: Array<{ date: string; count: number }>;
  recent: Array<{ id: number; title: string; type: string; createdAt: string }>;
  staleCount: number;
}
```

### 5.3 Class Diagram

![Class Diagram](diagrams/class-diagram.png)

### 5.4 Design Patterns

| Pattern | Where Used | Rationale |
|---------|-----------|-----------|
| **Singleton** | McpServerManager | Only one server process per workspace |
| **Singleton** | Each panel type (via WebviewPanelManager) | VS Code UX — one instance per panel type |
| **Factory Method** | WebviewPanelManager.createPanel() | Different panel types with shared creation logic |
| **Template Method** | BasePanel (abstract) | Common lifecycle (create, load, dispose) with panel-specific data loading |
| **Observer** | McpServerManager.onStatusChange event | TreeView, StatusBar, Panels all react to server status |
| **Strategy** | DataLoader per panel type | Each panel loads different MCP tools |
| **Mediator** | MessageHandler | Routes messages between webview and MCP without direct coupling |

### 5.5 McpServerManager — Detailed Design

```typescript
class McpServerManager implements IServerManager, vscode.Disposable {
  private _status: ServerStatus = "stopped";
  private serverProcess: ChildProcess | null = null;
  private restartCount = 0;
  private lastCrashTime: Date | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, PendingRequest>();

  private readonly MAX_RESTARTS = 3;
  private readonly BACKOFF_MS = [5000, 15000, 30000];
  private readonly STARTUP_TIMEOUT_MS = 5000;
  private readonly REQUEST_TIMEOUT_MS = 30000;
  private readonly KILL_TIMEOUT_MS = 5000;
  private readonly DEFAULT_PORT = 9180;
  private port: number = 9180;

  private readonly _onStatusChange = new vscode.EventEmitter<ServerStatus>();
  readonly onStatusChange = this._onStatusChange.event;

  constructor(
    private readonly extensionPath: string,
    private readonly workspaceFolder: string,
    private readonly outputChannel: vscode.OutputChannel
  ) {}

  get status(): ServerStatus { return this._status; }
  get pid(): number | null { return this.serverProcess?.pid ?? null; }

  async spawn(): Promise<void> {
    const serverPath = path.join(this.extensionPath, "mcp-server", "index.js");
    if (!fs.existsSync(serverPath)) {
      throw new Error("MCP server bundle not found. Reinstall extension.");
    }

    // Check for orphan process
    await this.cleanupOrphan();

    this.setStatus("starting");
    const configPath = path.join(this.workspaceFolder, ".code-intel", "orchestration.json");

    this.serverProcess = spawn("node", [serverPath, "--config", configPath], {
      cwd: this.workspaceFolder,
      env: {
        ...process.env,
        CODE_INTEL_WORKSPACE: this.workspaceFolder,
        CODE_INTEL_HTTP_PORT: String(this.port)
      },
      stdio: ["pipe", "pipe", "pipe"]
    });

    // Write PID file
    this.writePidFile();

    // Setup stderr → output channel
    this.serverProcess.stderr!.on("data", (chunk) => {
      this.outputChannel.appendLine(chunk.toString().trim());
    });

    // Wait for HTTP ready (health check on port)
    const ready = await this.waitForReady();
    if (!ready) {
      this.serverProcess.kill();
      throw new Error("MCP server startup timeout (5s)");
    }

    this.setStatus("running");
    this.restartCount = 0;

    // Monitor for crashes
    this.serverProcess.on("exit", (code, signal) => {
      if (code === 0) { this.setStatus("stopped"); return; }
      this.handleCrash(code, signal);
    });
  }

  async kill(): Promise<void> {
    if (!this.serverProcess) return;

    this.serverProcess.kill("SIGTERM");
    const killed = await this.waitForExit(this.KILL_TIMEOUT_MS);
    if (!killed) {
      this.serverProcess.kill("SIGKILL");
    }

    this.serverProcess = null;
    this.deletePidFile();
    this.setStatus("stopped");
    this.rejectAllPending();
  }

  async restart(): Promise<void> {
    await this.kill();
    this.restartCount = 0;
    await this.spawn();
  }

  private async handleCrash(code: number | null, signal: string | null): Promise<void> {
    this.setStatus("crashed");
    this.lastCrashTime = new Date();
    this.restartCount++;
    this.rejectAllPending();

    if (this.restartCount > this.MAX_RESTARTS) {
      vscode.window.showErrorMessage(
        "MCP server failed after 3 restart attempts. Use 'Restart MCP Server' to retry."
      );
      this.setStatus("stopped");
      return;
    }

    const backoff = this.BACKOFF_MS[this.restartCount - 1];
    vscode.window.showWarningMessage(`MCP server crashed. Restarting in ${backoff / 1000}s...`);

    await new Promise(resolve => setTimeout(resolve, backoff));

    try {
      await this.spawn();
      vscode.window.showInformationMessage("MCP server restarted successfully.");
    } catch {
      this.handleCrash(-1, "spawn_failed");
    }
  }

  private setStatus(status: ServerStatus): void {
    this._status = status;
    this._onStatusChange.fire(status);
  }
}
```

### 5.6 BasePanel — Abstract Template

```typescript
abstract class BasePanel implements IKbPanel, vscode.Disposable {
  protected _panel: vscode.WebviewPanel | undefined;
  private _disposables: vscode.Disposable[] = [];

  constructor(
    protected readonly viewType: string,
    protected readonly title: string,
    protected readonly mcpManager: McpServerManager,
    protected readonly extensionUri: vscode.Uri
  ) {}

  get panel(): vscode.WebviewPanel { return this._panel!; }

  create(column: vscode.ViewColumn = vscode.ViewColumn.One): void {
    this._panel = vscode.window.createWebviewPanel(
      this.viewType, this.title, column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, "webview-assets"),
          vscode.Uri.joinPath(this.extensionUri, "out")
        ]
      }
    );

    this._panel.webview.html = this.getHtml(this._panel.webview);

    this._panel.webview.onDidReceiveMessage(
      msg => this.handleMessage(msg),
      undefined, this._disposables
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Listen for server status changes
    this.mcpManager.onStatusChange(status => {
      this.sendMessage({ type: "serverStatus", status: status === "running" ? "connected" : "disconnected" });
    }, null, this._disposables);
  }

  reveal(): void { this._panel?.reveal(); }

  sendMessage(msg: ExtToWebviewMessage): void {
    this._panel?.webview.postMessage(msg);
  }

  dispose(): void {
    this._panel?.dispose();
    this._disposables.forEach(d => d.dispose());
    this._disposables = [];
  }

  // Template methods — subclasses implement
  abstract getHtml(webview: vscode.Webview): string;
  abstract loadData(): Promise<void>;
  abstract handleMessage(msg: WebviewToExtMessage): Promise<void>;
}
```

### 5.7 Error Handling

| Exception Class | Trigger | User Message | Recovery |
|----------------|---------|-------------|----------|
| `McpServerNotRunningError` | Tool invoked when server stopped | "MCP Server is not running. Starting..." | Auto-start, retry |
| `McpTimeoutError` | No response within 30s | "Request timed out. Server may be busy." | User retry |
| `McpSpawnError` | Server fails to start | "MCP server failed to start. Check Output panel." | Show output channel |
| `McpBundleMissingError` | Server files not found | "MCP server bundle not found. Reinstall extension." | Reinstall |
| `NodeVersionError` | Node.js < 20 | "Node.js 20+ required for bundled MCP server." | User installs Node |
| `WebviewLoadError` | Panel HTML fails to load | "Failed to load panel. Click refresh." | Retry button |

---

## 6. Integration Design

> **Prerequisite:** Business integration requirements are defined in FSD §5. This section specifies the technical implementation.

### 6.1 External System: MCP NodeJS Server (Child Process)

| Attribute | Value |
|-----------|-------|
| Protocol | JSON-RPC 2.0 over HTTP (POST to localhost:9180) |
| Endpoint | `node {extensionPath}/mcp-server/index.js` |
| Authentication | None (local process, same user) |
| Timeout | 30 seconds per request |
| Retry Policy | 1 retry on timeout, 0 retries on error |
| Circuit Breaker | Server status check — if "crashed"/"stopped", don't send requests |

**Sequence Diagram — Panel Opens:**

![Panel Open Sequence](diagrams/api-sequence-panel-open.png)

**Sequence Diagram — Server Crash Recovery:**

![Server Crash Sequence](diagrams/api-sequence-server-crash.png)

### 6.2 External System: VS Code Extension Host API

| Attribute | Value |
|-----------|-------|
| Protocol | TypeScript API (in-process) |
| Authentication | Extension activation context |
| Timeout | N/A (synchronous API calls) |

**Key API Usage:**

| VS Code API | Our Usage | Error Handling |
|-------------|-----------|----------------|
| `window.createWebviewPanel()` | Create KB panels | Catch, show error notification |
| `window.registerTreeDataProvider()` | Sidebar tree | Fatal if fails (extension broken) |
| `commands.registerCommand()` | 13 commands | Fatal if fails |
| `window.createOutputChannel()` | Server logs | Non-fatal |
| `child_process.spawn()` | Start MCP server | Catch, set status = "stopped" |
| `workspace.fs.writeFile()` | Write mcp.json, PID file | Catch, log warning |

### 6.3 External System: File System

| Path | Operation | Timing | Error Handling |
|------|-----------|--------|----------------|
| `{ext}/mcp-server/index.js` | Read (verify exists) | On activation | Fatal — bundle missing |
| `{ws}/.kiro/settings/mcp.json` | Read/Write | On activation + after server start | Non-fatal — warn user |
| `{ws}/.code-intel/orchestration.json` | Read (pass to server) | On server spawn | Non-fatal — server uses defaults |
| `{ws}/.code-intel/server.pid` | Write/Read/Delete | Spawn/activate/kill | Non-fatal — orphan cleanup best-effort |
| `{ws}/.code-intel/index.db` | N/A (MCP server owns) | — | — |

---

## 7. Security Design

> **Prerequisite:** Business security requirements are defined in FSD §7. This section specifies the technical implementation.

### 7.1 Authentication

No authentication required — this is a local VS Code extension. The MCP server runs as a child process of the extension host, inheriting the user's OS permissions.

### 7.2 Authorization

| Component | Access Level | Restriction |
|-----------|-------------|-------------|
| Extension Host | Full VS Code API | Extension activation context |
| MCP Server | Workspace folder only | `CODE_INTEL_WORKSPACE` env limits scope |
| Webview Panels | No file system, no network | CSP + VS Code sandbox |

### 7.3 Content Security Policy (Webview)

Every webview panel MUST include this CSP meta tag:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'none';
  script-src 'nonce-${nonce}';
  style-src ${webview.cspSource} 'unsafe-inline';
  img-src ${webview.cspSource} data:;
  font-src ${webview.cspSource};
  connect-src 'none';
">
```

**CSP Rules:**

| Directive | Value | Rationale |
|-----------|-------|-----------|
| `default-src` | `'none'` | Deny everything by default |
| `script-src` | `'nonce-${nonce}'` | Only scripts with matching nonce execute |
| `style-src` | `${webview.cspSource} 'unsafe-inline'` | Allow VS Code theme styles + inline |
| `img-src` | `${webview.cspSource} data:` | Allow local images + data URIs (charts) |
| `connect-src` | `'none'` | NO network requests from webview |

**Nonce Generation:**

```typescript
function getNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, "0")).join("");
}
```

### 7.4 Input Validation

| Input Source | Validation | Sanitization |
|-------------|-----------|--------------|
| Webview messages (postMessage) | Type-check message.type against allowed enum | Reject unknown types |
| MCP server responses (stdout) | JSON.parse with try/catch, validate jsonrpc field | Discard malformed |
| File paths (mcp.json) | Verify within workspace folder | Reject paths with `..` |
| User input (tag names) | Max 100 chars, alphanumeric + hyphens | Trim whitespace |

### 7.5 Process Isolation

| Concern | Mitigation |
|---------|-----------|
| MCP server crash affects extension | Separate process — crash triggers restart, extension continues |
| Webview XSS | CSP blocks all inline scripts except nonce-tagged |
| Webview data exfiltration | `connect-src 'none'` — no network from webview |
| Orphan processes | PID file + cleanup on activation + SIGKILL on deactivate |
| Path traversal | `CODE_INTEL_WORKSPACE` env + server-side validation |

---

## 8. Performance and Scalability

> **Prerequisite:** Business NFR targets are defined in FSD §8. This section specifies how to achieve those targets.

### 8.1 Performance Targets

| Operation | Target | Measurement | Strategy |
|-----------|--------|-------------|----------|
| Extension activation | < 3s | Time from activate() to commands registered | Server spawn is async (non-blocking) |
| MCP server startup | < 5s | Time from spawn() to ready signal | Minimal initialization, lazy DB operations |
| Panel open (first time) | < 2s | Time from command to rendered content | Lazy-load heavy JS (Three.js, Chart.js) |
| Panel open (subsequent) | < 500ms | Time from command to panel visible | retainContextWhenHidden — no re-render |
| Graph render (500 nodes) | 60fps | Frame rate during rotation/zoom | WebGL + level-of-detail |
| MCP tool invocation | < 1s | Round-trip time for simple queries | HTTP to localhost, minimal overhead |
| Dashboard auto-refresh | < 500ms | Time to fetch + render updated metrics | Incremental updates |

### 8.2 Lazy Loading Strategy

| Asset | Size (approx) | When Loaded | Trigger |
|-------|--------------|-------------|---------|
| Three.js + 3d-force-graph | ~500KB | Graph panel opens | `kiroSdlc.openKbGraph` command |
| Chart.js | ~200KB | Dashboard/Quality/Analytics opens | First chart panel command |
| Panel-specific JS | ~20-50KB each | Panel opens | Panel create |
| ui-tokens.css | ~5KB | Any panel opens | First panel create |

**Implementation:**

```typescript
// In HTML template — lazy load via nonce-tagged script
function getGraphHtml(webview: vscode.Webview, nonce: string): string {
  const threeUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "webview-assets", "three.min.js")
  );
  const forceGraphUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "webview-assets", "3d-force-graph.min.js")
  );

  return `<!DOCTYPE html>
    <html>
    <head>
      <meta http-equiv="Content-Security-Policy" content="...nonce-${nonce}...">
    </head>
    <body>
      <div id="graph-container"></div>
      <script nonce="${nonce}" src="${threeUri}"></script>
      <script nonce="${nonce}" src="${forceGraphUri}"></script>
      <script nonce="${nonce}" src="${panelScriptUri}"></script>
    </body>
    </html>`;
}
```

### 8.3 Memory Management

| Component | Expected Memory | Mitigation |
|-----------|----------------|-----------|
| MCP Server process | 100-200MB (SQLite + ONNX model) | Separate process, can be killed |
| Graph Panel (500 nodes) | 50-100MB (WebGL context + Three.js) | retainContextWhenHidden, dispose on close |
| Dashboard Panel | 20-30MB (Chart.js + data) | Auto-refresh replaces data (no accumulation) |
| Other Panels | 10-20MB each | Lightweight DOM |
| Extension Host overhead | 5-10MB | Minimal — delegates to server |

**Total worst case (all panels open):** ~400-500MB (server + 5 panels + extension)

### 8.4 Bundle Size Optimization

| Strategy | Savings | Applied To |
|----------|---------|-----------|
| Tree-shaking (esbuild) | ~40% | MCP server node_modules |
| .vscodeignore | ~60% | Exclude: tests, docs, source maps, .git |
| Platform-specific VSIX | ~30% | Only include native addons for target platform |
| Minification | ~20% | Webview JS assets |
| No source maps in prod | ~50% | All compiled JS |

**Target breakdown:**

| Component | Size Target |
|-----------|------------|
| Extension compiled JS (out/) | < 500KB |
| MCP server bundle (mcp-server/) | < 30MB |
| Webview assets (webview-assets/) | < 2MB |
| Resources (icons, agents) | < 5MB |
| Native addons (per platform) | < 10MB |
| **Total VSIX** | **< 48MB** |

---

## 9. Monitoring and Observability

### 9.1 Logging

| Log Event | Level | Channel | Fields |
|-----------|-------|---------|--------|
| Server spawned | INFO | Output Channel | pid, serverPath, configPath |
| Server ready | INFO | Output Channel | startupTime (ms) |
| Server crashed | ERROR | Output Channel + Notification | exitCode, signal, restartCount |
| Server restarted | WARN | Output Channel + Notification | attempt, backoffMs |
| Max restarts exceeded | ERROR | Output Channel + Notification | totalAttempts |
| Tool invocation | DEBUG | Output Channel | toolName, requestId, duration |
| Tool timeout | WARN | Output Channel | toolName, requestId, timeoutMs |
| Panel created | INFO | Output Channel | viewType |
| Panel disposed | INFO | Output Channel | viewType |
| mcp.json written | INFO | Output Channel | filePath |
| Orphan process cleaned | WARN | Output Channel | pid |

**Output Channel:** `"Kiro SDLC: MCP Server"` — visible via View → Output → select channel.

### 9.2 Status Indicators

| Indicator | Location | States |
|-----------|----------|--------|
| Status Bar Item | Bottom-right | `$(check) MCP Running` / `$(warning) MCP Crashed` / `$(circle-slash) MCP Stopped` |
| Tree View Status | Sidebar | `Status: Running ✅` / `Status: Stopped ❌` / `Status: Crashed ⚠️` |
| Panel Overlay | Each webview | Connected (hidden) / "Reconnecting..." / "Server unavailable" |

### 9.3 Diagnostics Command

Future enhancement: `Kiro SDLC: Diagnostics` command that outputs:
- Extension version
- MCP server version (from package.json in bundle)
- Server status + PID + uptime
- Platform + Node.js version
- DB size + entry count
- Memory usage (process.memoryUsage())
- Open panels list

---

## 10. Deployment Considerations

### 10.1 Build Pipeline

![Deployment Architecture](diagrams/deployment.png)

**Build Steps (GitHub Actions CI/CD):**

1. Checkout code
2. `npm install` (extension)
3. `npm run compile` (tsc)
4. `npm run copy-resources` (agents, steering, hooks, templates)
5. `npm run bundle-mcp-server` (copy dist/ + tree-shake)
6. `npm run bundle-webview-assets` (minify + copy)
7. For each platform (win32-x64, darwin-arm64, linux-x64):
   - Copy platform-specific native addons
   - `vsce package --target {platform}`
   - Upload VSIX artifact
8. Publish to VS Code Marketplace (on tag push)

### 10.2 Platform-Specific Packaging

```json
// package.json additions for v2.0.0
{
  "scripts": {
    "bundle-mcp-server": "node scripts/bundle-mcp-server.js",
    "bundle-webview-assets": "node scripts/bundle-webview-assets.js",
    "package:win32-x64": "vsce package --target win32-x64",
    "package:darwin-arm64": "vsce package --target darwin-arm64",
    "package:linux-x64": "vsce package --target linux-x64"
  }
}
```

**Bundle MCP Server Script (`scripts/bundle-mcp-server.js`):**

```javascript
// 1. Copy mcp-code-intelligence-nodejs/dist/ → mcp-server/
// 2. Copy required node_modules (better-sqlite3, onnxruntime-node, etc.)
// 3. Remove unnecessary files (tests, docs, source maps)
// 4. Copy platform-specific prebuilds only for target platform
```

### 10.3 Environment Configuration

| Setting | Development | Production (VSIX) |
|---------|------------|-------------------|
| MCP server path | `../mcp-code-intelligence-nodejs/dist/index.js` | `{extensionPath}/mcp-server/index.js` |
| Webview assets | `../shared/viewer/` (symlink) | `{extensionPath}/webview-assets/` |
| Source maps | Enabled | Disabled |
| Logging level | DEBUG | INFO |
| Native addons | Local build | Pre-built for platform |

### 10.4 Feature Flags

| Flag | Default | Description | Implementation |
|------|---------|-------------|----------------|
| `kiroSdlc.enableBundledServer` | `true` | Use bundled MCP server vs external | Extension setting |
| `kiroSdlc.enableKbPanels` | `true` | Show KB panel commands | Extension setting |
| `kiroSdlc.enableSidebar` | `true` | Show Activity Bar icon | Extension setting |
| `kiroSdlc.serverLogLevel` | `"info"` | MCP server log verbosity | Passed as env var |
| `kiroSdlc.dashboardRefreshInterval` | `60` | Dashboard auto-refresh (seconds) | Extension setting |
| `kiroSdlc.graphMaxNodes` | `500` | Max nodes in graph panel | Extension setting |

### 10.5 Rollback Strategy

| Scenario | Rollback Action |
|----------|----------------|
| v2.0.0 has critical bug | User installs v1.8.1 from Marketplace (previous version) |
| Bundled server crashes repeatedly | User disables bundled server (`enableBundledServer: false`), uses external npx/uvx |
| Native addon incompatible | User switches to Python/Kotlin MCP variant via "Inject MCP Config" |
| Panel causes VS Code slowdown | User disables panels (`enableKbPanels: false`) |

### 10.6 Migration from v1.8.1

| Step | Action | Automatic? |
|------|--------|-----------|
| 1 | VS Code auto-updates extension | Yes |
| 2 | Extension activates with new code | Yes |
| 3 | Bundled MCP server spawns | Yes |
| 4 | mcp.json updated (with user prompt if custom config exists) | Semi-auto |
| 5 | New commands available in palette | Yes |
| 6 | Sidebar icon appears | Yes |
| 7 | Existing commands work unchanged | Yes |

**No breaking changes. No data migration. Purely additive upgrade.**

---

## 11. Implementation Checklist

### 11.1 Files to Create

| # | File | Component | Priority | Estimated LOC |
|---|------|-----------|----------|---------------|
| 1 | `src/types.ts` | Shared interfaces | P0 | 150 |
| 2 | `src/mcp-server-manager.ts` | Server lifecycle | P0 | 350 |
| 3 | `src/webview-panel-manager.ts` | Panel factory | P0 | 150 |
| 4 | `src/panels/base-panel.ts` | Abstract base | P0 | 200 |
| 5 | `src/panels/graph-panel.ts` | Graph panel | P1 | 250 |
| 6 | `src/panels/dashboard-panel.ts` | Dashboard panel | P1 | 200 |
| 7 | `src/panels/tags-panel.ts` | Tags panel | P2 | 180 |
| 8 | `src/panels/quality-panel.ts` | Quality panel | P2 | 180 |
| 9 | `src/panels/analytics-panel.ts` | Analytics panel | P2 | 180 |
| 10 | `src/sidebar/tree-view-provider.ts` | Sidebar tree | P1 | 200 |
| 11 | `src/webview/html-templates.ts` | HTML generation | P0 | 300 |
| 12 | `src/webview/message-handler.ts` | Message routing | P0 | 150 |
| 13 | `webview-assets/graph.js` | Graph panel JS | P1 | 400 |
| 14 | `webview-assets/dashboard.js` | Dashboard panel JS | P1 | 300 |
| 15 | `webview-assets/tags.js` | Tags panel JS | P2 | 250 |
| 16 | `webview-assets/quality.js` | Quality panel JS | P2 | 250 |
| 17 | `webview-assets/analytics.js` | Analytics panel JS | P2 | 250 |
| 18 | `webview-assets/ui-tokens.css` | Design tokens | P1 | 100 |
| 19 | `webview-assets/panel-common.css` | Shared panel styles | P1 | 150 |
| 20 | `scripts/bundle-mcp-server.js` | Build script | P0 | 100 |
| 21 | `scripts/bundle-webview-assets.js` | Build script | P1 | 80 |

### 11.2 Files to Modify

| # | File | Changes | Priority |
|---|------|---------|----------|
| 1 | `src/extension.ts` | Add 7 new commands, spawn server on activate, register tree view, kill on deactivate | P0 |
| 2 | `src/mcp-injector.ts` | Update to use bundled server path, add user prompt for existing config | P0 |
| 3 | `package.json` | Add 7 commands, viewsContainers, views, activationEvents, scripts | P0 |
| 4 | `.vscodeignore` | Add exclusions for dev files, include mcp-server/ and webview-assets/ | P0 |
| 5 | `tsconfig.json` | Add `src/panels/`, `src/sidebar/`, `src/webview/` to includes | P0 |

### 11.3 Implementation Order (Phases)

**Phase A: Foundation (P0)**
1. `types.ts` — Define all interfaces
2. `mcp-server-manager.ts` — Server spawn/kill/restart/invoke
3. `extension.ts` — Integrate server manager, register new commands
4. `package.json` — Add commands, contributions
5. Test: Server spawns on activate, kills on deactivate, restart command works

**Phase B: Panel Infrastructure (P0)**
1. `webview/html-templates.ts` — CSP-compliant HTML generation
2. `webview/message-handler.ts` — Message routing
3. `panels/base-panel.ts` — Abstract base class
4. `webview-panel-manager.ts` — Singleton factory
5. Test: Can create/reveal/dispose a basic panel

**Phase C: Core Panels (P1)**
1. `panels/dashboard-panel.ts` + `webview-assets/dashboard.js`
2. `panels/graph-panel.ts` + `webview-assets/graph.js`
3. `sidebar/tree-view-provider.ts`
4. Test: Dashboard shows metrics, Graph renders nodes, Sidebar works

**Phase D: Additional Panels (P2)**
1. `panels/tags-panel.ts` + `webview-assets/tags.js`
2. `panels/quality-panel.ts` + `webview-assets/quality.js`
3. `panels/analytics-panel.ts` + `webview-assets/analytics.js`
4. Test: All 5 panels functional

**Phase E: Packaging and Polish (P0)**
1. `scripts/bundle-mcp-server.js` — Bundle server with native addons
2. `scripts/bundle-webview-assets.js` — Minify and copy assets
3. Platform-specific VSIX builds
4. Test: Install VSIX on all 3 platforms, verify < 50MB

---

## 12. Appendix

### 12.1 Glossary

| Term | Definition |
|------|------------|
| Extension Host | VS Code's process that runs extensions (single-threaded) |
| Child Process | OS process spawned by extension, runs MCP server independently |
| stdio | Standard I/O — communication via stdin/stdout pipes (used for process spawn) |
| HTTP transport | JSON-RPC over HTTP to localhost:port — primary extension↔server protocol |
| JSON-RPC 2.0 | Remote procedure call protocol using JSON messages |
| postMessage | VS Code API for extension ↔ webview communication |
| CSP | Content Security Policy — restricts what webview can load/execute |
| Nonce | Cryptographic random value for CSP script authorization |
| VSIX | VS Code extension package format (ZIP with metadata) |
| Native Addon | Platform-specific compiled binary (e.g., better-sqlite3) |
| retainContextWhenHidden | VS Code option to keep webview state when tab not visible |
| WebGL | Web Graphics Library — hardware-accelerated 3D rendering |
| Tree-shaking | Build optimization that removes unused code |

### 12.2 Open Questions

| # | Question | Status | Answer |
|---|----------|--------|--------|
| 1 | How to handle better-sqlite3 platform builds in CI? | Open | Options: prebuild-install, manual platform packages, or GitHub Actions matrix |
| 2 | Should graph panel use Web Workers for layout? | Open | Recommended for 500+ nodes to avoid UI freeze |
| 3 | How to handle VS Code version < 1.85? | Resolved | Show error on activation, disable new features, keep existing commands |
| 4 | Single MCP connection shared across panels? | Resolved | Yes — McpServerManager singleton, all panels share |
| 5 | PID file location for orphan cleanup? | Resolved | `{workspace}/.code-intel/server.pid` |
| 6 | How to test native addons across platforms? | Open | GitHub Actions matrix with win/mac/linux runners |

### 12.3 Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture Overview | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
| 3 | Deployment Architecture | [deployment.png](diagrams/deployment.png) | [deployment.drawio](diagrams/deployment.drawio) |
| 4 | Class Diagram | [class-diagram.png](diagrams/class-diagram.png) | [class-diagram.drawio](diagrams/class-diagram.drawio) |
| 5 | Sequence: Panel Open | [api-sequence-panel-open.png](diagrams/api-sequence-panel-open.png) | [api-sequence-panel-open.drawio](diagrams/api-sequence-panel-open.drawio) |
| 6 | Sequence: Server Crash | [api-sequence-server-crash.png](diagrams/api-sequence-server-crash.png) | [api-sequence-server-crash.drawio](diagrams/api-sequence-server-crash.drawio) |

### 12.4 Change Log from FSD

| FSD Item | TDD Technical Decision |
|----------|----------------------|
| UC-01: Auto-spawn server | McpServerManager.spawn() with 5s timeout, PID file for orphan cleanup |
| UC-03: Auto-restart on crash | Exponential backoff [5s, 15s, 30s], max 3 attempts, event-driven (not polling) |
| UC-05-09: Webview panels | BasePanel abstract class + Factory pattern, lazy-loaded assets, CSP enforced |
| UC-10: Sidebar tree view | TreeDataProvider with event-driven refresh on server status change |
| UC-12: Crash recovery | Observer pattern — McpServerManager fires events, all panels subscribe |
| BR-09: Package < 50MB | Platform-specific VSIX, tree-shaking, .vscodeignore, no source maps |
| BR-14: No HTTP in webview | CSP `connect-src 'none'`, all data via postMessage |
| BR-15: retainContextWhenHidden | Set on panel creation, increases memory but preserves state |
| FSD §13.4: MCP invocation | Async request/response with Map<id, Promise>, 30s timeout |
