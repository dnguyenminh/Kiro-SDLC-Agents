# Technical Design Document (TDD)

## Kiro SDLC Agents — KSA-180: Settings & Configuration

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-180 |
| Title | Settings & Configuration — Technical Design |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-25 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-180.docx |
| Related FSD | FSD-v1-KSA-180.docx |
| Related TDD | TDD-v1-KSA-180.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-25 | SA Agent | Initial — reverse-engineered from source code |

---

## 1. Architecture Overview

### 1.1 Component Architecture

The Settings & Configuration subsystem consists of 4 core modules within the VS Code extension:

```
kiro-sdlc-agents/src/
├── config.ts              # Static configuration (variants, components)
├── config-watcher.ts      # File system watcher for mcp.json
├── mcp-server-manager.ts  # Server lifecycle management
├── extension.ts           # Entry point, command registration
└── types.ts               # Shared types and constants
```

### 1.2 Design Principles

1. **Separation of Concerns**: Config definition (config.ts) is separate from config watching (config-watcher.ts) and server management (mcp-server-manager.ts)
2. **Event-Driven**: Uses VS Code EventEmitter for status changes, FileSystemWatcher for config changes
3. **Defensive Programming**: Port conflict detection, crash recovery, self-suppression
4. **Disposable Pattern**: All components implement `vscode.Disposable` for clean shutdown

### 1.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| IDE Platform | VS Code Extension API | 1.85+ |
| Language | TypeScript | 5.4+ |
| Runtime | Node.js | 20+ |
| Process Management | child_process (spawn) | Built-in |
| Network | net (TCP), fetch (HTTP) | Built-in |
| File System | fs (sync), vscode.FileSystemWatcher | Built-in |

---

## 2. Detailed Design

### 2.1 Module: config.ts

**Purpose:** Static configuration definitions — component list, MCP variants, constants.

**Key Types:**

```typescript
interface Component {
  id: string;           // "agents" | "steering" | "hooks" | "templates"
  label: string;        // Display name
  description: string;  // Short description
  sourcePath: string;   // Path in extension bundle
  targetPath: string;   // Path in workspace
  filter?: string[];    // Optional file filter
}

type McpDelivery = "registry" | "download";

interface McpVariant {
  id: string;           // "python" | "nodejs" | "kotlin"
  label: string;        // Display name
  description: string;  // Runtime requirements
  delivery: McpDelivery;
  config: McpServerConfig;
  downloadUrl?: string;
  downloadAsset?: string;
}

interface McpServerConfig {
  command: string;      // "uvx" | "npx" | "java"
  args: string[];       // Command arguments with ${workspaceFolder} placeholders
  cwd?: string;
  env?: Record<string, string>;
  transportType?: string;
}
```

**Constants:**
- `MCP_SERVERS_DIR = ".code-intel/servers"` — downloaded server storage
- `GITHUB_RELEASE_REPO = "dnguyenminh/Kiro-SDLC-Agents"` — release source
- `CORE_COMPONENTS` — array of 4 injectable components
- `MCP_VARIANTS` — array of 3 server variants

**Design Decision:** Config is purely static (no runtime state). This allows tree-shaking and makes testing trivial.

---

### 2.2 Module: config-watcher.ts

**Purpose:** Monitor `.kiro/settings/mcp.json` for external changes and trigger server restart.

**Class: ConfigWatcher**

```typescript
class ConfigWatcher implements vscode.Disposable {
  // State
  private watcher: vscode.FileSystemWatcher | undefined;
  private debounceTimer: NodeJS.Timeout | undefined;
  private lastConfigHash: string = "";
  private suppressUntil: number = 0;

  // Constants
  private static readonly DEBOUNCE_MS = 500;
  private static readonly SUPPRESS_MS = 2000;

  // Constructor initializes watcher and computes initial hash
  constructor(workspaceFolder, mcpManager, outputChannel);

  // Public: suppress self-triggered changes
  suppressNextChange(): void;

  // Public: read code-intelligence config section
  readCodeIntelConfig(): CodeIntelConfig | null;
}
```

**Key Algorithms:**

1. **Debouncing:** Uses `setTimeout` with 500ms delay. Each new change event resets the timer.
2. **Hash Comparison:** `JSON.stringify(config)` of the `code-intelligence` section only. Ignores changes to other servers.
3. **Self-Suppression:** `suppressUntil = Date.now() + 2000`. Any events within this window are ignored.

**File Watched:** `.kiro/settings/mcp.json` (relative pattern via `vscode.RelativePattern`)

**Events Handled:**
- `onDidChange` → debounced restart
- `onDidCreate` → debounced restart
- `onDidDelete` → debounced stop

---

### 2.3 Module: mcp-server-manager.ts

**Purpose:** Full lifecycle management of the MCP Code Intelligence server process.

**Class: McpServerManager**

```typescript
class McpServerManager implements IServerManager, vscode.Disposable {
  // State
  private _status: ServerStatus = "stopped";
  private _port: number | null = null;
  private _pid: number | null = null;
  private childProc: ChildProcess | null = null;
  private restartCount = 0;
  private isDisposing = false;
  private externalServer = false;

  // Events
  private readonly _onStatusChange = new vscode.EventEmitter<ServerStatus>();
  readonly onStatusChange = this._onStatusChange.event;

  // Public API
  spawn(): Promise<void>;
  kill(): Promise<void>;
  restart(): Promise<void>;
  invokeTool(name: string, args: Record<string, unknown>): Promise<string>;
}
```

**Spawn Algorithm:**

```
1. IF status == "running" THEN return (idempotent)
2. SET status = "starting"
3. port = getConfiguredPort() // from VS Code settings
4. IF isPortListening(port) THEN
     // External server mode
     SET externalServer = true
     SET _port = port
     SET status = "running"
     updateMcpJson()
     RETURN
5. Verify http-entry.js exists
6. configPath = getConfigPath() // from VS Code settings
7. child = spawn("node", [entryPath, "--port", port, "--config", configPath])
8. Write PID file
9. port = waitForPort(child, fallbackPort) // regex on stderr
10. SET status = "running"
11. updateMcpJson()
12. Register exit handler
```

**Kill Algorithm:**

```
1. IF externalServer THEN
     SET _port = null
     SET status = "stopped"
     RETURN
2. IF no childProc AND no _pid THEN
     SET status = "stopped"
     RETURN
3. IF windows THEN taskkill /PID {pid} /T /F
   ELSE childProc.kill("SIGTERM")
4. Clear childProc, _pid, _port
5. Remove PID file
6. SET status = "stopped"
```

**Crash Recovery Algorithm:**

```
ON child.exit(code, signal):
  IF isDisposing THEN return
  Clear state (pid, port, childProc)
  Remove PID file
  IF restartCount < MAX_RESTARTS THEN
    SET status = "crashed"
    backoff = BACKOFF_MS[restartCount]
    restartCount++
    setTimeout(spawn, backoff)
  ELSE
    SET status = "crashed"
    Log "Max restarts reached"
```

**Port Detection:**

```
waitForPort(child, fallbackPort):
  Listen on child.stderr for pattern: /\[mcp-http\] Listening on port (\d+)/
  Timeout: STARTUP_TIMEOUT_MS
  IF pattern found THEN return captured port
  IF timeout AND process alive THEN return fallbackPort
  IF timeout AND process dead THEN throw McpSpawnError
```

**invokeTool (HTTP JSON-RPC):**

```
1. IF status != "running" THEN throw McpServerNotRunningError
2. Build JSON-RPC request: { jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: {name, arguments} }
3. POST to http://127.0.0.1:{port}/mcp
4. Timeout: REQUEST_TIMEOUT_MS (AbortController)
5. Parse response
6. IF response.error THEN throw Error
7. RETURN response.result.content[0].text
```

---

### 2.4 Module: extension.ts (Settings-related parts)

**Activation Flow:**

```typescript
export function activate(context: vscode.ExtensionContext) {
  // 1. Create status bar
  // 2. Get workspace root
  // 3. Create OutputChannel
  // 4. Create McpServerManager
  // 5. Create WebviewPanelManager
  // 6. Create TreeView
  // 7. Create ConfigWatcher
  // 8. Wire status change events
  // 9. Auto-spawn if enabled
  // 10. Register commands
  // 11. Update status bar
  // 12. Check for upgrade
}
```

**Command Handlers:**

| Handler | Logic |
|---------|-------|
| `handleChangePort()` | showInputBox → validate → update setting → restart |
| `handleEditConfig()` | resolve path → check exists → create if needed → openTextDocument |
| `handleChangeConfig()` | showOpenDialog → compute relative path → update setting → restart |
| `handleRestartServer()` | mcpManager.restart() |
| `handleStopServer()` | suppressNextChange → kill → removeBundledMcpConfig |

---

### 2.5 Module: types.ts (Settings-related)

```typescript
type ServerStatus = "stopped" | "starting" | "running" | "crashed";

interface IServerManager {
  readonly status: ServerStatus;
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

// Error classes
class McpServerNotRunningError extends Error;
class McpTimeoutError extends Error;
class McpBundleMissingError extends Error;
class McpSpawnError extends Error;

// Constants
const SERVER_CONSTANTS = {
  MAX_RESTARTS: 3,
  BACKOFF_MS: [2000, 5000, 10000],
  STARTUP_TIMEOUT_MS: 15000,
  REQUEST_TIMEOUT_MS: 30000,
  KILL_TIMEOUT_MS: 5000,
};
```

---

## 3. Security Design

### 3.1 Threat Model

| Threat | Mitigation |
|--------|-----------|
| Malicious config injection | Config path validated as relative, within workspace |
| Port hijacking | TCP connect test before trusting external server |
| Process injection via PID file | PID file in `.code-intel/` (gitignored), not executable |
| Secrets in settings | Only port/path stored, no tokens/credentials |
| Child process escape | `windowsHide: true`, controlled args, no shell |

### 3.2 Security Controls

1. **No shell execution**: `spawn()` with explicit args array (no shell injection)
2. **Localhost only**: Server binds to 127.0.0.1 (not 0.0.0.0)
3. **No secrets in VS Code settings**: Settings are synced/visible, so only non-sensitive data
4. **Process isolation**: Child process runs with same user permissions, no elevation

---

## 4. Error Handling Design

### 4.1 Error Hierarchy

```
Error
├── McpBundleMissingError    // Extension bundle corrupted
├── McpSpawnError            // Server failed to start
├── McpServerNotRunningError // Tool call when server is down
└── McpTimeoutError          // Tool call exceeded timeout
```

### 4.2 Error Recovery Strategy

| Error Type | Auto-Recovery | User Action Required |
|-----------|---------------|---------------------|
| Spawn failure | No | Check Node.js installation |
| Crash (< 3 times) | Yes (backoff restart) | None |
| Crash (>= 3 times) | No | Manual restart command |
| Port conflict | Yes (external mode) | None |
| Config parse error | Yes (returns null, stops) | Fix JSON |
| Bundle missing | No | Reinstall extension |

---

## 5. Testing Strategy

### 5.1 Unit Test Targets

| Module | Test Focus |
|--------|-----------|
| config.ts | Variant definitions, component paths |
| config-watcher.ts | Debounce logic, hash comparison, suppress window |
| mcp-server-manager.ts | State transitions, port detection regex, error handling |
| extension.ts | Command registration, activation flow |

### 5.2 Integration Test Targets

| Scenario | Technique |
|----------|-----------|
| Server spawn + port detection | Real child process with mock server |
| Config change triggers restart | File write + timer verification |
| Port conflict detection | Pre-bind port, verify external mode |
| Crash recovery | Kill child process, verify restart |

### 5.3 Test Framework

- **Unit tests**: Mocha + Sinon (already configured in project)
- **VS Code API mocking**: Sinon stubs for `vscode.workspace.getConfiguration`, `vscode.window.*`
- **Process mocking**: Sinon stubs for `child_process.spawn`

---

## 6. Implementation Checklist

### Files to Create/Modify

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `src/config.ts` | EXISTS | Static config — no changes needed |
| 2 | `src/config-watcher.ts` | EXISTS | Config watcher — no changes needed |
| 3 | `src/mcp-server-manager.ts` | EXISTS | Server manager — no changes needed |
| 4 | `src/extension.ts` | EXISTS | Entry point — no changes needed |
| 5 | `src/types.ts` | EXISTS | Types — no changes needed |
| 6 | `package.json` | EXISTS | contributes.configuration — no changes needed |
| 7 | `src/test/config-watcher.test.ts` | CREATE | Unit tests for ConfigWatcher |
| 8 | `src/test/mcp-server-manager.test.ts` | CREATE | Unit tests for McpServerManager |
| 9 | `src/test/extension.test.ts` | MODIFY | Add settings-related activation tests |

### Implementation Notes

This ticket documents **existing functionality** that is already implemented. The source code analysis confirms all 7 user stories from the BRD are fully implemented:

- STORY 1 (Enable/Disable): `extension.ts` lines 67-73
- STORY 2 (Change Port): `extension.ts` `handleChangePort()`
- STORY 3 (Config Path): `extension.ts` `handleEditConfig()` + `handleChangeConfig()`
- STORY 4 (Port Conflict): `mcp-server-manager.ts` `spawn()` port check
- STORY 5 (Auto-Restart): `config-watcher.ts` full implementation
- STORY 6 (Variants): `config.ts` `MCP_VARIANTS` array
- STORY 7 (Status Bar): `extension.ts` `createStatusBar()` + `updateStatusBar()`

---

## 7. Performance Considerations

| Concern | Design Choice | Impact |
|---------|--------------|--------|
| Extension activation speed | Async spawn (non-blocking) | < 100ms activation |
| Config change storms | 500ms debounce | Max 2 restarts/second |
| Memory usage | Single child process | ~50MB for Node.js MCP server |
| Port detection | Regex on stderr stream | Immediate detection |
| File watcher overhead | Single file pattern | Negligible |

---

## 8. Deployment Considerations

- Extension is packaged as `.vsix` via `vsce package`
- MCP server bundle is included in extension at `mcp-server/`
- No external dependencies at runtime (Node.js assumed available)
- Settings are workspace-scoped (not global) for multi-project support
- PID file and mcp.json are in gitignored directories

---

## Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture Overview | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
| 3 | Class Diagram | [class-diagram.png](diagrams/class-diagram.png) | [class-diagram.drawio](diagrams/class-diagram.drawio) |
