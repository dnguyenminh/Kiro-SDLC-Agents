# Technical Design Document — NodeJS Orchestration Port

## KSA-63 Extension: Port Orchestration Module to NodeJS/TypeScript

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-63 (Extension) |
| Title | NodeJS Orchestration Module — Technical Design |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2025-07-15 |
| Status | Draft |
| Reference TDD | TDD-v1-KSA-63.docx (Kotlin) |
| Reference BRD | BRD-port-v1-KSA-63.docx |

---

## 1. Introduction

### 1.1 Purpose

Technical design for porting the Kotlin orchestration module to NodeJS/TypeScript. Covers all 15 modules from BRD-port Section 2.1, mapped to Node.js async/await + child_process patterns.

### 1.2 Technology Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict mode) |
| Runtime | Node.js 18+ |
| Process | child_process.spawn |
| File Watch | fs.watchFile (stdlib) |
| JSON | Built-in JSON.parse/stringify |
| Concurrency | Promises, async/await |

### 1.3 Constraints

- Max 200 lines per `.ts` file
- Max 20 lines per function
- Zero new external dependencies
- camelCase naming throughout
- Same `orchestration.json` config format as Kotlin

---

## 2. Package Structure

```
mcp-code-intelligence-nodejs/src/orchestration/
├── index.ts                 ← Public API: OrchestrationEngine export
├── config.ts                ← OrchestrationConfig interfaces + loader
├── engine.ts                ← OrchestrationEngine coordinator
├── registry/
│   ├── index.ts             ← Re-exports
│   ├── tokenizer.ts         ← Text tokenization (camelCase, stopwords)
│   ├── grouper.ts           ← SemanticGrouper (Jaccard + chain building)
│   └── registry.ts          ← UnifiedRegistry (search, toggles, hits)
├── routing/
│   ├── index.ts             ← Re-exports
│   ├── table.ts             ← RoutingTable (O(1) tool→server)
│   └── router.ts            ← SmartRouter (timeout propagation)
├── local/
│   ├── index.ts             ← Re-exports
│   ├── manager.ts           ← LocalServerManager (start/stop/health)
│   ├── process.ts           ← ServerProcess (spawn, init, state machine)
│   ├── rpc.ts               ← StdioJsonRpc (JSON-RPC 2.0 over pipes)
│   └── watcher.ts           ← ConfigWatcher (fs.watchFile)
├── meta/
│   ├── index.ts             ← Re-exports + META_TOOL_DEFINITIONS
│   ├── dispatcher.ts        ← MetaToolDispatcher (route meta-tool calls)
│   ├── find-tools.ts        ← FindToolsTool (semantic search)
│   ├── execute-dynamic.ts   ← ExecuteDynamicTool (fallback chain)
│   ├── toggle.ts            ← ToggleToolTool
│   ├── reset.ts             ← ResetToolsTool
│   ├── auto-approve.ts      ← ManageAutoApproveTool
│   ├── status.ts            ← OrchestrationStatusTool
│   └── agent-log.ts         ← AgentLogTool
└── logging/
    ├── index.ts             ← Re-exports
    └── auto-logger.ts       ← AutoLogger (audit trail)
```

**Total: 22 files, each ≤ 200 lines.**

---

## 3. Data Models (config.ts)

```typescript
export interface ServerEntry {
  command: string;
  args: string[];
  env: Record<string, string>;
  disabled: boolean;
  timeout: number;
  autoApprove: string[];
}

export interface AutoLogSettings {
  enabled: boolean;
  excludeTools: string[];
  maxArgLength: number;
}

export interface OrchestrationSettings {
  autoLog: AutoLogSettings;
  healthCheckIntervalMs: number;
  maxRestartRetries: number;
  similarityThreshold: number;
  maxRecursionDepth: number;
  discoveryTimeoutMs: number;
  kbSearchTimeoutMs: number;
}

export interface OrchestrationConfig {
  mcpServers: Record<string, ServerEntry>;
  settings: OrchestrationSettings;
}
```

### 3.1 Config Loading

```typescript
export function loadConfig(configPath: string): OrchestrationConfig | null;
export function enabledServers(config: OrchestrationConfig): Map<string, ServerEntry>;
```

**Defaults applied during load** — missing fields get same defaults as Kotlin.

---

## 4. Module Design

### 4.1 Tokenizer (registry/tokenizer.ts, ~50 lines)

```typescript
const STOPWORDS: Set<string>;  // Same 20 words as Kotlin
const SPLIT_RE = /[^a-zA-Z0-9]+/;
const CAMEL_RE = /(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/;

export function tokenize(text: string): Set<string>;
```

**Behavioral parity:** Identical output to Kotlin `Tokenizer.tokenize()` for same input.

### 4.2 SemanticGrouper (registry/grouper.ts, ~100 lines)

```typescript
export interface RegisteredTool {
  name: string;
  definition: Record<string, any>;
  source: string;
  priority: number;
  nameTokens: Set<string>;
  descTokens: Set<string>;
}

export interface ChainEntry {
  serverName: string;
  priority: number;
  toolName: string | null;
}

export interface ToolChain {
  toolName: string;
  entries: ChainEntry[];
  groupingReason: string;
  similarNames: Set<string>;
}

export class SemanticGrouper {
  constructor(private threshold: number = 0.7) {}
  buildChains(tools: RegisteredTool[]): Map<string, ToolChain>;
  computeSimilarity(a: RegisteredTool, b: RegisteredTool): number;
}
```

**Algorithm:** Same as Python/Kotlin — exact name grouping first, then pairwise Jaccard.

### 4.3 UnifiedRegistry (registry/registry.ts, ~150 lines)

```typescript
export class UnifiedRegistry {
  constructor(private similarityThreshold: number = 0.7) {}
  setServerOrder(order: string[]): void;
  setChildTools(serverName: string, tools: Record<string, any>[]): void;
  search(query: string): RegisteredTool[];
  find(name: string): RegisteredTool | null;
  getChain(toolName: string): ToolChain | null;
  recordHit(toolName: string): void;
  toggle(toolName: string, enabled: boolean): void;
  resetToggles(): void;
  isEnabled(toolName: string): boolean;
  childToolsByServer(): Map<string, string[]>;
  allChildTools(): RegisteredTool[];
}
```

**Search scoring:** Same formula — `combined = relevance * 0.7 + normalizedHits * 0.3`

### 4.4 RoutingTable (routing/table.ts, ~60 lines)

```typescript
export interface RouteEntry {
  serverName: string;
  isNative: boolean;
}

export class RoutingTable {
  rebuild(nativeNames: Set<string>, childByServer: Map<string, string[]>): void;
  resolve(toolName: string): RouteEntry | null;
}
```

### 4.5 SmartRouter (routing/router.ts, ~80 lines)

```typescript
export interface ToolMetrics {
  callCount: number;
  errorCount: number;
  totalLatencyMs: number;
  lastCallAt: number | null;
}

export class SmartRouter {
  requestStartTime: number = 0;
  constructor(private serverManager: LocalServerManager, private routingTable: RoutingTable) {}
  async route(toolName: string, args: Record<string, any>, timeoutMs?: number): Promise<string>;
  getMetrics(): Map<string, ToolMetrics>;
}
```

**Timeout propagation:** `remaining = originalTimeout - (Date.now() - requestStartTime)`. Throw if ≤ 0.

### 4.6 StdioJsonRpc (local/rpc.ts, ~120 lines)

```typescript
export class StdioJsonRpc {
  attach(proc: ChildProcess): void;
  detach(): void;
  async sendRequest(method: string, params: any, timeoutMs: number): Promise<any>;
  sendNotification(method: string, params: any): void;
  rejectAll(reason: string): void;
}
```

**Implementation details:**
- `_pending`: Map<number, { resolve, reject, timer }> for correlating responses
- `_nextId`: incrementing counter
- Write: `proc.stdin.write(JSON.stringify(msg) + '\n')`
- Read: readline interface on `proc.stdout`, parse each line
- Timeout: `setTimeout` per request, clear on response

### 4.7 ServerProcess (local/process.ts, ~150 lines)

```typescript
export enum ServerState {
  STARTING = 'STARTING',
  READY = 'READY',
  ACTIVE = 'ACTIVE',
  CRASHED = 'CRASHED',
  RESTARTING = 'RESTARTING',
  STOPPING = 'STOPPING',
  DEAD = 'DEAD',
  FAILED = 'FAILED',
}

export class ServerProcess {
  readonly name: string;
  state: ServerState;
  tools: Record<string, any>[];
  
  constructor(name: string, entry: ServerEntry) {}
  async start(): Promise<boolean>;
  stop(): void;
  async restart(maxRetries: number): Promise<boolean>;
  async callTool(toolName: string, args: Record<string, any>, timeoutMs: number): Promise<any>;
  async healthCheck(): Promise<boolean>;
  isAlive(): boolean;
}
```

**Process spawning:**
```typescript
private spawn(): ChildProcess | null {
  const cmd = this.resolveCommand(this.entry.command);
  const args = this.buildArgs();
  const env = { ...process.env, ...this.entry.env };
  return spawn(cmd[0], [...cmd.slice(1), ...args], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
    shell: process.platform === 'win32',
  });
}
```

**Windows support:**
- `resolveCommand()`: on Windows, use `shell: true` in spawn options (handles .cmd/.bat resolution)
- `destroyProcess()`: use `taskkill /T /F /PID` via `execSync` on Windows

**State machine:** Same as Kotlin — STARTING → READY → ACTIVE → CRASHED → RESTARTING → DEAD

### 4.8 LocalServerManager (local/manager.ts, ~120 lines)

```typescript
export class LocalServerManager {
  constructor(private config: OrchestrationConfig) {}
  async startAll(): Promise<number>;
  stopAll(): void;
  async callTool(serverName: string, toolName: string, args: Record<string, any>, timeoutMs: number): Promise<any>;
  findServerForTool(toolName: string): string | null;
  getAllTools(): Array<[string, Record<string, any>]>;
  getStatus(): Map<string, ServerState>;
  getServerStatusInfo(): Array<{ name: string; state: string; toolCount: number }>;
}
```

**Health monitoring:** `setInterval` running every `healthCheckIntervalMs`. On failure → restart with backoff.

### 4.9 ConfigWatcher (local/watcher.ts, ~60 lines)

```typescript
export class ConfigWatcher {
  constructor(private configPath: string, private onReload: (config: OrchestrationConfig) => void) {}
  start(): void;
  stop(): void;
}
```

**Implementation:** `fs.watchFile(configPath, { interval: 2000 }, callback)`. On change → re-parse → call `onReload`. If parse fails → log, keep current.

### 4.10 OrchestrationEngine (engine.ts, ~150 lines)

```typescript
export class OrchestrationEngine {
  readonly metaToolDispatcher: MetaToolDispatcher;
  
  constructor(config: OrchestrationConfig, memoryEngine: MemoryEngine | null, appConfig: AppConfig) {}
  async start(): Promise<void>;
  stop(): void;
  async route(toolName: string, args: Record<string, any>): Promise<string>;
  getRegistry(): UnifiedRegistry;
  getMemoryEngine(): MemoryEngine | null;
  getStatus(): Record<string, any>;
  getServerStatus(): Array<{ name: string; state: string; toolCount: number }>;
  getMetrics(): Map<string, ToolMetrics>;
  async callChild(serverName: string, toolName: string, args: Record<string, any>): Promise<string>;
  getWorkspace(): string;
}
```

**Lifecycle:** Same as Python — start → startAll → buildRoutingTable → ingestToKb → startWatcher.

### 4.11 MetaToolDispatcher (meta/dispatcher.ts, ~80 lines)

```typescript
export const META_TOOL_DEFINITIONS: Array<Record<string, any>>;

export class MetaToolDispatcher {
  constructor(private engine: OrchestrationEngine) {}
  async dispatch(toolName: string, args: Record<string, any>): Promise<string | null>;
  getDefinitions(): Array<Record<string, any>>;
}
```

### 4.12 FindToolsTool (meta/find-tools.ts, ~60 lines)

```typescript
export async function execute(engine: OrchestrationEngine, args: Record<string, any>): Promise<string>;
```

### 4.13 ExecuteDynamicTool (meta/execute-dynamic.ts, ~80 lines)

```typescript
export async function execute(engine: OrchestrationEngine, args: Record<string, any>): Promise<string>;
```

### 4.14 AutoLogger (logging/auto-logger.ts, ~50 lines)

```typescript
export class AutoLogger {
  constructor(private memoryEngine: MemoryEngine | null, private settings: AutoLogSettings) {}
  logCall(tool: string, args: string, result: string, latencyMs: number, source: string, isError?: boolean): void;
}
```

---

## 5. Integration with Existing Server

### 5.1 index.ts Modifications

```typescript
// After memEngine initialization in 'initialize' handler:
import { OrchestrationEngine } from './orchestration/index.js';
import { loadOrchestrationConfig } from './orchestration/config.js';

const orchConfig = loadOrchestrationConfig(config.workspace);
let orchestration: OrchestrationEngine | null = null;
if (orchConfig) {
  orchestration = new OrchestrationEngine(orchConfig, memEngine, config);
  await orchestration.start();
}

// In tools/list handler:
const tools = getToolDefinitions();
if (orchestration) {
  tools.push(...orchestration.metaToolDispatcher.getDefinitions());
}

// In tools/call handler (BEFORE existing dispatch):
if (orchestration) {
  const metaResult = await orchestration.metaToolDispatcher.dispatch(params.name, params.arguments ?? {});
  if (metaResult !== null) {
    return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: metaResult }] } };
  }
}
```

### 5.2 Async Considerations

The existing `index.ts` already uses `for await (const line of rl)` which is async-compatible. Orchestration integrates naturally — `await orchestration.start()` after initialize, `await dispatch()` in tools/call.

No architectural changes needed to the main loop.

---

## 6. Error Handling

| Error | Handling |
|-------|----------|
| Child process spawn fails | Log, mark FAILED, continue with other servers |
| Initialize handshake timeout | Mark FAILED, don't retry on startup |
| Health check fails | Attempt restart (max_retries with backoff) |
| All chain servers fail | Return aggregated error message |
| KB search timeout | Graceful degradation, return registry-only results |
| Config parse error | Keep current config, log warning |
| Process tree kill fails | Fall back to `proc.kill('SIGKILL')` |

---

## 7. Testing Strategy

| Level | What | How |
|-------|------|-----|
| Unit | Tokenizer | vitest/jest: same input/output as Kotlin |
| Unit | SemanticGrouper | vitest: verify chain building logic |
| Unit | UnifiedRegistry | vitest: search scoring, hits, decay |
| Integration | ServerProcess | Mock child_process, verify state machine |
| Integration | StdioJsonRpc | Mock stdio streams, verify request/response |
| E2E | Full orchestration | Start real child server, verify find_tools + execute |

---

## 8. Implementation Checklist

| # | File | Lines (est.) | Priority |
|---|------|-------------|----------|
| 1 | `orchestration/index.ts` | 10 | P0 |
| 2 | `orchestration/config.ts` | 80 | P0 |
| 3 | `orchestration/registry/index.ts` | 5 | P0 |
| 4 | `orchestration/registry/tokenizer.ts` | 50 | P0 |
| 5 | `orchestration/registry/grouper.ts` | 100 | P0 |
| 6 | `orchestration/registry/registry.ts` | 150 | P0 |
| 7 | `orchestration/routing/index.ts` | 5 | P0 |
| 8 | `orchestration/routing/table.ts` | 60 | P0 |
| 9 | `orchestration/routing/router.ts` | 80 | P0 |
| 10 | `orchestration/local/index.ts` | 5 | P0 |
| 11 | `orchestration/local/rpc.ts` | 120 | P0 |
| 12 | `orchestration/local/process.ts` | 150 | P0 |
| 13 | `orchestration/local/manager.ts` | 120 | P0 |
| 14 | `orchestration/local/watcher.ts` | 60 | P1 |
| 15 | `orchestration/engine.ts` | 150 | P0 |
| 16 | `orchestration/meta/index.ts` | 5 | P0 |
| 17 | `orchestration/meta/dispatcher.ts` | 80 | P0 |
| 18 | `orchestration/meta/find-tools.ts` | 60 | P0 |
| 19 | `orchestration/meta/execute-dynamic.ts` | 80 | P0 |
| 20 | `orchestration/meta/toggle.ts` | 30 | P1 |
| 21 | `orchestration/meta/reset.ts` | 20 | P1 |
| 22 | `orchestration/meta/auto-approve.ts` | 40 | P1 |
| 23 | `orchestration/meta/status.ts` | 40 | P1 |
| 24 | `orchestration/meta/agent-log.ts` | 40 | P1 |
| 25 | `orchestration/logging/index.ts` | 5 | P1 |
| 26 | `orchestration/logging/auto-logger.ts` | 50 | P1 |

**Implementation order:** config → tokenizer → grouper → registry → rpc → process → manager → table → router → engine → dispatcher → find-tools → execute-dynamic → remaining meta-tools → watcher → auto-logger

---

## 9. Behavioral Parity Verification

| Behavior | Kotlin Reference | NodeJS Must Match |
|----------|-----------------|-------------------|
| Tokenize "camelCase" | `{"camel", "case"}` | ✅ Same |
| Tokenize "get_issue_details" | `{"get", "issue", "details"}` | ✅ Same |
| Similarity threshold | 0.7 default | ✅ Same |
| Search scoring formula | `relevance * 0.7 + hits * 0.3` | ✅ Same |
| Decay trigger | hits > 1000 → subtract 500 | ✅ Same |
| Chain priority | Config declaration order (index 0 = highest) | ✅ Same |
| Health check interval | 30s default | ✅ Same |
| Restart backoff | 1s, 2s, 3s... max 10s | ✅ Same |
| Windows cmd wrapper | shell: true in spawn | ✅ Same behavior |
| Meta-tool filtering | 7 meta-tools excluded from child registration | ✅ Same |

---

## 10. Key Differences from Python Port

| Aspect | Python | NodeJS |
|--------|--------|--------|
| Async model | asyncio tasks | Promises + setInterval |
| Process spawn | asyncio.create_subprocess_exec | child_process.spawn |
| File watch | asyncio stat polling | fs.watchFile |
| Concurrency | Single-threaded event loop | Single-threaded event loop |
| Stdin reading | StreamReader protocol | readline interface |
| Timeout | asyncio.wait_for | setTimeout + Promise.race |
| Process kill (Windows) | subprocess taskkill | execSync taskkill |
| Server integration | Needs async conversion | Already async-compatible |
