# Functional Specification Document (FSD)

## Kiro SDLC Agents — KSA-180: Settings & Configuration

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-180 |
| Title | Settings & Configuration — Functional Specification |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-05-25 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-180.docx |
| Related FSD | FSD-v1-KSA-180.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-25 | BA + TA Agent | Initial — inferred from source code analysis |

---

## 1. Overview

### 1.1 Purpose

This FSD specifies the functional behavior of the Settings & Configuration subsystem for the Kiro SDLC Agents VS Code extension. It covers VS Code settings registration, MCP server lifecycle management, config file watching, and user-facing commands.

### 1.2 System Context

The extension acts as a bridge between VS Code IDE settings and the MCP Code Intelligence server process. It reads user preferences, manages server lifecycle, and keeps the IDE's MCP configuration in sync.

---

## 2. Functional Requirements

### 2.1 Use Cases

---

#### UC-01: Extension Activation with Settings

**Actor:** Developer (implicit — VS Code activates extension)

**Preconditions:**
- Workspace folder is open
- Extension is installed

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | VS Code | Triggers extension activation |
| 2 | | Extension reads `kiroSdlc.*` settings via `vscode.workspace.getConfiguration("kiroSdlc")` |
| 3 | | Creates status bar item (right-aligned, priority 100) |
| 4 | | Creates OutputChannel "Kiro MCP Server" |
| 5 | | Instantiates McpServerManager(extensionPath, workspaceRoot, outputChannel) |
| 6 | | Instantiates ConfigWatcher(workspaceRoot, mcpManager, outputChannel) |
| 7 | | Reads `enableMcpServer` setting |
| 8 | | If true: calls `mcpManager.spawn()` |
| 9 | | If false: logs "[MCP] Server disabled by setting" |
| 10 | | Registers all commands |
| 11 | | Updates status bar |

**Alternative Flow — No Workspace:**

| Step | System |
|------|--------|
| 2a | No workspace folders detected |
| 2b | Shows error: "No workspace folder open." |
| 2c | Status bar shows "$(circle-slash) SDLC" |

**Postconditions:**
- Extension is active
- MCP server is running (if enabled) or stopped (if disabled)
- Status bar reflects current state

---

#### UC-02: Spawn MCP Server

**Actor:** Extension (automatic) or Developer (manual restart)

**Preconditions:**
- Workspace root is available
- `enableMcpServer` is true (for auto-spawn)

**Main Flow:**

| Step | System |
|------|--------|
| 1 | Set status = "starting" |
| 2 | Read configured port from settings (`mcpServerPort`, default 9181) |
| 3 | TCP connect test to 127.0.0.1:{port} with 2000ms timeout |
| 4 | If port NOT in use: verify bundle exists at `{extensionPath}/mcp-server/http-entry.js` |
| 5 | Read config path from settings (`configPath`) |
| 6 | Spawn child process: `node http-entry.js --port {port} --config {configPath}` |
| 7 | Write PID to `.code-intel/server.pid` |
| 8 | Wait for stderr pattern: `[mcp-http] Listening on port (\d+)` (timeout: STARTUP_TIMEOUT_MS) |
| 9 | Set status = "running", store detected port |
| 10 | Write httpStream URL to `.kiro/settings/mcp.json` |
| 11 | Register exit handler for crash recovery |

**Alternative Flow — Port Already In Use:**

| Step | System |
|------|--------|
| 3a | TCP connect succeeds (port is listening) |
| 3b | Log: "Port {port} already in use — connecting to existing server." |
| 3c | Set externalServer = true, store port |
| 3d | Set status = "running" |
| 3e | Update mcp.json |

**Alternative Flow — Bundle Missing:**

| Step | System |
|------|--------|
| 4a | `http-entry.js` not found |
| 4b | Set status = "stopped" |
| 4c | Throw McpBundleMissingError |

**Exception Flow — Spawn Failure:**

| Step | System |
|------|--------|
| 8a | Timeout waiting for port pattern |
| 8b | If process still alive: use fallback port |
| 8c | If process exited: throw McpSpawnError |

---

#### UC-03: Change Port

**Actor:** Developer

**Preconditions:**
- Extension is active
- Workspace is open

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | Developer | Runs command "Kiro SDLC: Change MCP Server Port" |
| 2 | | Shows InputBox with current port value |
| 3 | Developer | Enters new port number |
| 4 | | Validates: 1 <= port <= 65535, is integer |
| 5 | | If same as current: return (no-op) |
| 6 | | Updates workspace setting `kiroSdlc.mcpServerPort` |
| 7 | | Shows info: "Port changed to {port}. Restarting server..." |
| 8 | | Calls restart() |

**Alternative Flow — Invalid Input:**

| Step | System |
|------|--------|
| 4a | Validation fails |
| 4b | Shows inline error: "Port must be 1-65535" |
| 4c | User can retry or cancel |

---

#### UC-04: Edit Orchestration Config

**Actor:** Developer

**Preconditions:**
- Extension is active

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | Developer | Runs command "Kiro SDLC: Edit Orchestration Config" |
| 2 | | Reads `configPath` setting |
| 3 | | Resolves full path: `{workspaceRoot}/{configPath}` |
| 4 | | If file exists: opens in editor |

**Alternative Flow — File Missing:**

| Step | System |
|------|--------|
| 4a | File does not exist |
| 4b | Shows warning: "Config file not found: {path}. Create it?" with [Create] [Cancel] |
| 4c | If "Create": creates directory + writes `{"servers": [], "routing": {}}` |
| 4d | Opens created file in editor |

---

#### UC-05: Change Config File

**Actor:** Developer

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | Developer | Runs command "Kiro SDLC: Change Config File..." |
| 2 | | Shows file open dialog (filter: JSON files) |
| 3 | Developer | Selects a JSON file |
| 4 | | Computes relative path from workspace root |
| 5 | | Updates workspace setting `kiroSdlc.configPath` |
| 6 | | Shows info: "Config changed to: {relPath}. Restarting server..." |
| 7 | | Calls restart() |

---

#### UC-06: Config File Change Detection

**Actor:** External process or user editing mcp.json

**Preconditions:**
- ConfigWatcher is active
- Server is running

**Main Flow:**

| Step | System |
|------|--------|
| 1 | FileSystemWatcher detects change to `.kiro/settings/mcp.json` |
| 2 | Check suppress window: if `Date.now() < suppressUntil` then ignore |
| 3 | Start/reset debounce timer (500ms) |
| 4 | After 500ms: compute hash of `code-intelligence` section |
| 5 | Compare with lastConfigHash |
| 6 | If same: log "Config unchanged", return |
| 7 | If different: update lastConfigHash |
| 8 | Read `code-intelligence` config |
| 9 | If `disabled: true`: kill server |
| 10 | Else: restart server |

**Alternative Flow — File Deleted:**

| Step | System |
|------|--------|
| 1a | FileSystemWatcher detects deletion |
| 2a | Debounce 500ms |
| 3a | Log "mcp.json deleted. Stopping server." |
| 4a | Reset lastConfigHash to "" |
| 5a | Kill server |

---

#### UC-07: Server Crash Recovery

**Actor:** System (automatic)

**Preconditions:**
- Server was running
- Server process exits unexpectedly

**Main Flow:**

| Step | System |
|------|--------|
| 1 | Child process emits "exit" event with code/signal |
| 2 | If isDisposing: return (intentional shutdown) |
| 3 | Log exit details |
| 4 | Clear PID, port, childProc references |
| 5 | Remove PID file |
| 6 | Check restartCount < MAX_RESTARTS (3) |
| 7 | Set status = "crashed" |
| 8 | Calculate backoff: BACKOFF_MS[restartCount] |
| 9 | Increment restartCount |
| 10 | Schedule spawn() after backoff delay |

**Alternative Flow — Max Restarts Reached:**

| Step | System |
|------|--------|
| 6a | restartCount >= MAX_RESTARTS |
| 6b | Set status = "crashed" |
| 6c | Log "Max restarts reached. Server will not auto-restart." |
| 6d | No further action (user must manually restart) |

---

### 2.2 Business Rules

| ID | Rule | Source |
|----|------|--------|
| BR-01 | Default port is 9181 | package.json configuration |
| BR-02 | Port must be integer 1-65535 | UC-03 validation |
| BR-03 | Config path is relative to workspace root | UC-04, UC-05 |
| BR-04 | Max 3 auto-restarts before giving up | UC-07 |
| BR-05 | Debounce window for config changes is 500ms | UC-06 |
| BR-06 | Self-suppression window is 2000ms | UC-06 |
| BR-07 | External server mode: no PID, no crash recovery | UC-02 alt flow |
| BR-08 | Manual restart resets restartCount to 0 | McpServerManager.restart() |
| BR-09 | Server startup timeout is configurable (SERVER_CONSTANTS) | UC-02 |
| BR-10 | Only `code-intelligence` section changes trigger restart | UC-06 step 5 |

---

### 2.3 Data Specifications

#### VS Code Settings Schema

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `kiroSdlc.enableMcpServer` | boolean | true | Enable/disable auto-spawn |
| `kiroSdlc.mcpServerPort` | number | 9181 | TCP port for MCP server |
| `kiroSdlc.configPath` | string | `.code-intel/orchestration.json` | Orchestration config path (relative) |

#### mcp.json Schema (`.kiro/settings/mcp.json`)

```json
{
  "mcpServers": {
    "code-intelligence": {
      "type": "httpStream",
      "url": "http://127.0.0.1:9181/mcp",
      "disabled": false
    }
  }
}
```

#### MCP Variant Config

| Variant | Command | Args | Delivery |
|---------|---------|------|----------|
| Python | `uvx` | `["mcp-code-intelligence@latest", "--config", "{configPath}"]` | registry (PyPI) |
| Node.js | `npx` | `["mcp-code-intelligence@latest", "--config", "{configPath}"]` | registry (npm) |
| Kotlin | `java` | `["-jar", "{jarPath}", "--config", "{configPath}"]` | download (GitHub) |

#### Server Constants

| Constant | Value | Description |
|----------|-------|-------------|
| MAX_RESTARTS | 3 | Maximum auto-restart attempts |
| BACKOFF_MS | [2000, 5000, 10000] | Exponential backoff delays |
| STARTUP_TIMEOUT_MS | 15000 | Max wait for port detection |
| REQUEST_TIMEOUT_MS | 30000 | Max wait for tool invocation |
| KILL_TIMEOUT_MS | 5000 | Max wait for process kill |

---

## 3. API Specifications

### 3.1 VS Code Commands

| Command ID | Title | Handler | Description |
|-----------|-------|---------|-------------|
| `kiroSdlc.changePort` | Change MCP Server Port | `handleChangePort()` | Shows input box, validates, updates setting, restarts |
| `kiroSdlc.editConfig` | Edit Orchestration Config | `handleEditConfig()` | Opens config file in editor |
| `kiroSdlc.changeConfig` | Change Config File... | `handleChangeConfig()` | File picker for new config |
| `kiroSdlc.restartMcpServer` | Restart MCP Server | `handleRestartServer()` | Kill + spawn |
| `kiroSdlc.stopMcpServer` | Stop MCP Server | `handleStopServer()` | Kill + remove mcp.json entry |

### 3.2 McpServerManager Public API

```typescript
interface IServerManager {
  readonly status: ServerStatus;  // "stopped" | "starting" | "running" | "crashed"
  readonly port: number | null;
  readonly pid: number | null;
  readonly viewerPort: number | null;
  readonly onStatusChange: vscode.Event<ServerStatus>;

  spawn(): Promise<void>;
  kill(): Promise<void>;
  restart(): Promise<void>;
  invokeTool(name: string, args: Record<string, unknown>): Promise<string>;
  dispose(): void;
}
```

### 3.3 ConfigWatcher Public API

```typescript
class ConfigWatcher implements vscode.Disposable {
  constructor(workspaceFolder: string, mcpManager: McpServerManager, outputChannel: vscode.OutputChannel);
  suppressNextChange(): void;
  readCodeIntelConfig(): CodeIntelConfig | null;
  dispose(): void;
}

interface CodeIntelConfig {
  url?: string;
  port?: number;
  transportType?: string;
  command?: string;
  args?: string[];
  disabled?: boolean;
}
```

### 3.4 MCP Server HTTP API

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/mcp` | JSON-RPC 2.0 request | JSON-RPC 2.0 response |

**Request format:**
```json
{
  "jsonrpc": "2.0",
  "id": 1716000000000,
  "method": "tools/call",
  "params": {
    "name": "code_search",
    "arguments": { "query": "function" }
  }
}
```

**Response format:**
```json
{
  "jsonrpc": "2.0",
  "id": 1716000000000,
  "result": {
    "content": [{ "type": "text", "text": "..." }]
  }
}
```

---

## 4. Error Handling

| Error | Code | User Message | Recovery |
|-------|------|-------------|----------|
| McpBundleMissingError | BUNDLE_MISSING | "MCP server bundle not found" | Re-install extension |
| McpSpawnError | SPAWN_FAILED | "Server did not start within timeout" | Check Node.js, check port |
| McpServerNotRunningError | NOT_RUNNING | "MCP server not running. Start it first." | Run restart command |
| McpTimeoutError | TIMEOUT | "Tool invocation timed out" | Retry or restart server |
| Port validation error | INVALID_PORT | "Port must be 1-65535" | Enter valid port |
| Config JSON parse error | INVALID_CONFIG | (silent — returns null) | Fix JSON syntax |

---

## 5. State Diagram — Server Lifecycle

States: stopped, starting, running, crashed

Transitions:
- stopped -> starting: spawn() called
- starting -> running: port detected from stderr
- starting -> stopped: spawn error (bundle missing, process exit)
- running -> stopped: kill() called
- running -> crashed: process exits unexpectedly
- crashed -> starting: auto-restart (if restartCount < 3) or manual restart()
- crashed -> crashed: max restarts reached (stays crashed)

---

## 6. Integration Requirements

### 6.1 VS Code Integration Points

| Integration | API | Direction |
|-------------|-----|-----------|
| Settings | `workspace.getConfiguration("kiroSdlc")` | Read |
| File Watcher | `workspace.createFileSystemWatcher` | Read (events) |
| Status Bar | `window.createStatusBarItem` | Write (display) |
| Output Channel | `window.createOutputChannel` | Write (logs) |
| Commands | `commands.registerCommand` | Read (user input) |
| Input Box | `window.showInputBox` | Read (user input) |
| File Dialog | `window.showOpenDialog` | Read (user input) |
| Info Messages | `window.showInformationMessage` | Write (notifications) |

### 6.2 File System Interactions

| File | Operation | When |
|------|-----------|------|
| `.code-intel/server.pid` | Write/Delete | Server spawn/kill |
| `.kiro/settings/mcp.json` | Read/Write | Server start, config change |
| `{configPath}` | Read | Server spawn (passed as arg) |
| `{extensionPath}/mcp-server/http-entry.js` | Read (existence check) | Server spawn |

---

## 7. Non-Functional Requirements

| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR-01 | Performance | Extension activation time | < 100ms (async spawn) |
| NFR-02 | Performance | Server startup time | < 5s to "running" |
| NFR-03 | Performance | Config change to restart | < 1s (500ms debounce + spawn) |
| NFR-04 | Reliability | Crash recovery | 3 attempts with 2s/5s/10s backoff |
| NFR-05 | Reliability | Self-suppression accuracy | No false restarts from own writes |
| NFR-06 | Security | No secrets in VS Code settings | Only port/path, no tokens |
| NFR-07 | Usability | Zero-config experience | Works with all defaults |
| NFR-08 | Compatibility | VS Code version | >= 1.85.0 |
| NFR-09 | Compatibility | Node.js version | >= 20.0.0 |
| NFR-10 | Maintainability | Config schema extensible | New settings without breaking changes |

---

## 8. Open Issues

| # | Issue | Status | Decision Needed |
|---|-------|--------|-----------------|
| 1 | Multi-root workspace support | Deferred | Use first folder only for now |
| 2 | Settings sync across machines | Not planned | VS Code Settings Sync handles this |
| 3 | Variant auto-detection | Future | Could detect installed runtimes |

---

## Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence — Server Spawn | [sequence-spawn.png](diagrams/sequence-spawn.png) | [sequence-spawn.drawio](diagrams/sequence-spawn.drawio) |
| 3 | State — Server Lifecycle | [state-server.png](diagrams/state-server.png) | [state-server.drawio](diagrams/state-server.drawio) |
