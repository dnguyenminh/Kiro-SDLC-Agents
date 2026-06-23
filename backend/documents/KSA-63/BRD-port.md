# Business Requirements Document — KSA-63 Extension

## Port Orchestration Module to Python & NodeJS

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-63 (Extension) |
| Title | Port Orchestration Module to Python and NodeJS |
| Author | SM Agent |
| Version | 1.0 |
| Date | 2025-07-15 |
| Status | Draft |
| Reference Implementation | mcp-code-intelligence-kotlin/src/main/kotlin/com/codeintel/orchestration/ |

---

## 1. Introduction

### 1.1 Background

The Kotlin orchestration module (KSA-63 Phase 5 DONE) provides a complete MCP orchestration layer: child server process management, tool discovery with semantic search, fallback chain execution, config hot-reload, and auto-logging. This extension ports the entire orchestration module to Python and NodeJS so all three language implementations of mcp-code-intelligence can serve as orchestrators.

### 1.2 Scope

Port ALL orchestration features from Kotlin to:
- **Python** (`mcp-code-intelligence-python/src/mcp_code_intel/orchestration/`)
- **NodeJS/TypeScript** (`mcp-code-intelligence-nodejs/src/orchestration/`)

### 1.3 Out of Scope

- Changes to the Kotlin implementation
- New features not in the Kotlin reference
- Changes to the MCP protocol
- UI/frontend changes
- Changes to existing code intelligence features (indexer, memory, etc.)

---

## 2. Business Requirements

### 2.1 Core Capabilities to Port

| # | Capability | Kotlin Source | Description |
|---|-----------|---------------|-------------|
| 1 | Text Tokenization | `Tokenizer.kt` | Split text into normalized tokens (camelCase, underscore, stopwords) |
| 2 | Semantic Grouping | `SemanticGrouper.kt` | Jaccard similarity + chain building for fallback |
| 3 | Unified Registry | `UnifiedRegistry.kt` | Tool index + tokenized search + hits tracking + decay |
| 4 | Find Tools | `FindToolsTool.kt` | Meta-tool: semantic search across all registered tools |
| 5 | Execute Dynamic Tool | `ExecuteDynamicTool.kt` | Meta-tool: execute with fallback chain |
| 6 | Smart Router | `SmartRouter.kt` | Route to server with timeout propagation |
| 7 | Routing Table | `RoutingTable.kt` | O(1) tool→server mapping |
| 8 | Orchestration Engine | `OrchestrationEngine.kt` | Coordinator + lifecycle + recursive discovery |
| 9 | Local Server Manager | `LocalServerManager.kt` | Child MCP server process management (stdio JSON-RPC) |
| 10 | Config Watcher | `ConfigWatcher.kt` | File watcher for hot-reload |
| 11 | Auto Logger | `AutoLogger.kt` | Auto-log tool calls to memory audit |
| 12 | Meta Tool Dispatcher | `MetaToolDispatcher.kt` | Dispatch meta-tool calls |
| 13 | Orchestration Config | `OrchestrationConfig.kt` | Config data classes |
| 14 | Stdio JSON-RPC | `StdioJsonRpc.kt` | JSON-RPC 2.0 over stdio pipes |
| 15 | Server Process | `ServerProcess.kt` | Single child server lifecycle (spawn, init, health) |

### 2.2 User Stories

#### STORY 1: Python Orchestration — Same Behavior as Kotlin

> As a developer using the Python MCP server, I want the same orchestration capabilities (find_tools, execute_dynamic_tool, fallback chains, config hot-reload) so that Python can serve as a full orchestrator.

**Acceptance Criteria:**
1. Python server reads `orchestration.json` from `.code-intel/` directory
2. Python server spawns child MCP servers as subprocesses
3. `find_tools` returns same results as Kotlin for same query + same registered tools
4. `execute_dynamic_tool` follows same fallback chain logic
5. Config hot-reload works (file change → rebuild routing)
6. Health monitoring restarts crashed child servers
7. All meta-tools available: find_tools, execute_dynamic_tool, toggle_tool, reset_tools, manage_auto_approve, orchestration_status, agent_log

#### STORY 2: NodeJS Orchestration — Same Behavior as Kotlin

> As a developer using the NodeJS MCP server, I want the same orchestration capabilities so that NodeJS can serve as a full orchestrator.

**Acceptance Criteria:**
- Same as STORY 1 but for NodeJS/TypeScript implementation.

#### STORY 3: Config Compatibility

> As a user, I want all three implementations (Kotlin, Python, NodeJS) to read the same `orchestration.json` format so I can switch between them without config changes.

**Acceptance Criteria:**
1. Same JSON schema: `{ "mcpServers": {...}, "settings": {...} }`
2. Same server entry fields: command, args, env, disabled, timeout, autoApprove
3. Same settings fields: autoLog, healthCheckIntervalMs, maxRestartRetries, similarityThreshold, maxRecursionDepth, discoveryTimeoutMs, kbSearchTimeoutMs
4. Default values identical across all three implementations

#### STORY 4: Meta-Tool Interface Compatibility

> As an AI agent, I want the same meta-tool interface regardless of which language implementation is running, so my prompts work universally.

**Acceptance Criteria:**
1. `find_tools` input schema identical: `{ query: string }`
2. `find_tools` output format identical: JSON array of tool definitions
3. `execute_dynamic_tool` input schema identical: `{ tool_name: string, arguments: object }`
4. `execute_dynamic_tool` output: pass-through from child server
5. `toggle_tool` input/output identical
6. `reset_tools` input/output identical
7. `manage_auto_approve` input/output identical
8. `orchestration_status` output format identical
9. `agent_log` input/output identical

---

## 3. Technical Constraints

### 3.1 Python Constraints

| Constraint | Details |
|-----------|---------|
| Python version | 3.11+ (match existing project) |
| Async framework | asyncio (already used in project) |
| External deps | NONE beyond stdlib + existing project deps |
| Process management | asyncio.subprocess |
| File watching | watchdog (if already a dep) OR asyncio + polling |
| JSON parsing | stdlib json module |
| Concurrency | asyncio tasks, no threading |
| File size | Max 200 lines per .py file |
| Function size | Max 20 lines per function |

### 3.2 NodeJS/TypeScript Constraints

| Constraint | Details |
|-----------|---------|
| Node version | 18+ (match existing project) |
| TypeScript | Strict mode (match existing tsconfig) |
| External deps | NONE beyond existing project deps |
| Process management | child_process.spawn |
| File watching | fs.watch / fs.watchFile (stdlib) |
| JSON parsing | Built-in JSON.parse |
| Concurrency | Promises, async/await |
| File size | Max 200 lines per .ts file |
| Function size | Max 20 lines per function |

### 3.3 Shared Config Format

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["package-name", "--flag"],
      "env": { "KEY": "value" },
      "disabled": false,
      "timeout": 30000,
      "autoApprove": ["tool1", "tool2"]
    }
  },
  "settings": {
    "autoLog": {
      "enabled": true,
      "excludeTools": ["mem_audit"],
      "maxArgLength": 200
    },
    "healthCheckIntervalMs": 30000,
    "maxRestartRetries": 3,
    "similarityThreshold": 0.7,
    "maxRecursionDepth": 3,
    "discoveryTimeoutMs": 10000,
    "kbSearchTimeoutMs": 2000
  }
}
```

---

## 4. Module Mapping (Kotlin → Python / NodeJS)

### 4.1 Python Package Structure

```
mcp-code-intelligence-python/src/mcp_code_intel/orchestration/
├── __init__.py
├── config.py              ← OrchestrationConfig.kt
├── engine.py              ← OrchestrationEngine.kt
├── registry/
│   ├── __init__.py
│   ├── tokenizer.py       ← Tokenizer.kt
│   ├── grouper.py         ← SemanticGrouper.kt
│   └── registry.py        ← UnifiedRegistry.kt
├── routing/
│   ├── __init__.py
│   ├── table.py           ← RoutingTable.kt
│   └── router.py          ← SmartRouter.kt
├── local/
│   ├── __init__.py
│   ├── manager.py         ← LocalServerManager.kt
│   ├── process.py         ← ServerProcess.kt
│   ├── rpc.py             ← StdioJsonRpc.kt
│   └── watcher.py         ← ConfigWatcher.kt
├── meta/
│   ├── __init__.py
│   ├── dispatcher.py      ← MetaToolDispatcher.kt
│   ├── find_tools.py      ← FindToolsTool.kt
│   ├── execute_dynamic.py ← ExecuteDynamicTool.kt
│   ├── toggle.py          ← ToggleToolTool.kt
│   ├── reset.py           ← ResetToolsTool.kt
│   ├── auto_approve.py    ← ManageAutoApproveTool.kt
│   ├── status.py          ← OrchestrationStatusTool.kt
│   └── agent_log.py       ← AgentLogTool.kt
└── logging/
    ├── __init__.py
    └── auto_logger.py     ← AutoLogger.kt
```

### 4.2 NodeJS Package Structure

```
mcp-code-intelligence-nodejs/src/orchestration/
├── index.ts
├── config.ts              ← OrchestrationConfig.kt
├── engine.ts              ← OrchestrationEngine.kt
├── registry/
│   ├── index.ts
│   ├── tokenizer.ts       ← Tokenizer.kt
│   ├── grouper.ts         ← SemanticGrouper.kt
│   └── registry.ts        ← UnifiedRegistry.kt
├── routing/
│   ├── index.ts
│   ├── table.ts           ← RoutingTable.kt
│   └── router.ts          ← SmartRouter.kt
├── local/
│   ├── index.ts
│   ├── manager.ts         ← LocalServerManager.kt
│   ├── process.ts         ← ServerProcess.kt
│   ├── rpc.ts             ← StdioJsonRpc.kt
│   └── watcher.ts         ← ConfigWatcher.kt
├── meta/
│   ├── index.ts
│   ├── dispatcher.ts      ← MetaToolDispatcher.kt
│   ├── find-tools.ts      ← FindToolsTool.kt
│   ├── execute-dynamic.ts ← ExecuteDynamicTool.kt
│   ├── toggle.ts          ← ToggleToolTool.kt
│   ├── reset.ts           ← ResetToolsTool.kt
│   ├── auto-approve.ts    ← ManageAutoApproveTool.kt
│   ├── status.ts          ← OrchestrationStatusTool.kt
│   └── agent-log.ts       ← AgentLogTool.kt
└── logging/
    ├── index.ts
    └── auto-logger.ts     ← AutoLogger.kt
```

---

## 5. Behavioral Parity Requirements

### 5.1 Tokenizer

| Behavior | Specification |
|----------|--------------|
| Split on non-alphanumeric | Regex: `[^a-zA-Z0-9]+` |
| Split camelCase | `camelCase` → `["camel", "case"]` |
| Lowercase all tokens | `"Search"` → `"search"` |
| Remove stopwords | Set: a, an, the, is, are, was, were, be, been, to, for, and, or, in, on, with, from, by, of, at, as, it, its, this, that, not, no |
| Deduplicate | Return Set (no duplicates) |
| Min length | Tokens with length ≤ 1 are removed |

### 5.2 Semantic Grouper

| Behavior | Specification |
|----------|--------------|
| Exact name grouping | Tools with same name on different servers → single chain |
| Semantic grouping | Jaccard similarity ≥ threshold (default 0.7) → chain |
| Similarity formula | `jaccard(tokensA ∪ descA, tokensB ∪ descB) + nameOverlap * 0.1` |
| Cap at 1.0 | `min(1.0, score)` |
| Priority order | Config declaration order (index 0 = highest) |
| Chain canonical name | Highest-priority tool's name |

### 5.3 Unified Registry

| Behavior | Specification |
|----------|--------------|
| Search scoring | Name token match = 2.0, desc token partial match = 1.0 |
| Combined score | `relevance * 0.7 + normalizedHits * 0.3` |
| Hit tracking | Increment on successful execution |
| Decay trigger | When hits > 1000, subtract 500 from group, floor at -2000 |
| Toggle | Per-session enable/disable per tool name |
| Meta-tool filtering | find_tools, execute_dynamic_tool, toggle_tool, etc. excluded from child registration |

### 5.4 Fallback Chain Execution

| Behavior | Specification |
|----------|--------------|
| Chain lookup | O(1) by tool name |
| Execution order | Priority ascending (0 first) |
| Server-specific name | ChainEntry.toolName overrides canonical name |
| Error aggregation | Collect all server errors, return combined message |
| Fallback on any error | Exception/timeout → try next server |
| Hit recording | Only on success |

### 5.5 Process Management

| Behavior | Specification |
|----------|--------------|
| Spawn | command + args, with env vars |
| Initialize | Send MCP `initialize` request, await response |
| Fetch tools | Send `tools/list`, parse response |
| Health check | Send `tools/list` with 5s timeout |
| Restart | Exponential backoff: 1s, 2s, 3s... max 10s |
| Max retries | Configurable (default 3) |
| State machine | STARTING → READY → ACTIVE → CRASHED → RESTARTING → DEAD |
| Windows support | `cmd /c` wrapper for non-exe commands |
| Process tree kill | Windows: `taskkill /T /F /PID` |

### 5.6 Config Hot-Reload

| Behavior | Specification |
|----------|--------------|
| Watch target | orchestration.json file |
| On change | Re-parse config, stop all servers, restart with new config |
| Invalid config | Keep current config, log warning |
| Debounce | Not required (WatchService/fs.watch handles) |

### 5.7 Timeout Propagation

| Behavior | Specification |
|----------|--------------|
| Per-request start time | Recorded when request enters router |
| Remaining timeout | `originalTimeout - elapsed` |
| Exhausted | Throw error before routing if remaining ≤ 0 |

---

## 6. Integration Points

### 6.1 With Existing Server (server.py / index.ts)

Both ports must integrate with their respective existing MCP server:
- Register meta-tools in `tools/list` response
- Dispatch meta-tool calls before other tool handlers
- Start orchestration engine after `initialize` completes
- Stop orchestration on shutdown

### 6.2 With Memory Engine

- Auto-logger writes to memory audit (if memory engine available)
- find_tools searches KB as secondary source (graceful degradation if unavailable)
- Tool definitions ingested to KB on startup

---

## 7. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | find_tools < 200ms for 500 tools |
| Performance | Startup discovery < 15s for 10 servers |
| Reliability | Graceful degradation if child server crashes |
| Reliability | No data loss on config hot-reload |
| Compatibility | Same orchestration.json format across all 3 implementations |
| Maintainability | Max 200 lines/file, max 20 lines/function |
| Dependencies | Zero new external dependencies |

---

## 8. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Platform differences (Windows process management) | High | Test on Windows; use platform-specific spawn logic |
| Async model differences (coroutines vs asyncio vs Promises) | Medium | Map patterns carefully; test concurrent scenarios |
| JSON-RPC edge cases (partial reads, buffering) | Medium | Line-based protocol; buffer until newline |
| Performance gap (Python GIL for CPU-bound tokenization) | Low | Tokenization is fast for short strings; not a bottleneck |

---

## 9. Success Criteria

1. Both Python and NodeJS implementations pass the same behavioral test suite
2. Same `orchestration.json` works across all three implementations
3. `find_tools("search issues")` returns identical results (same tools registered)
4. Fallback chain executes in same order
5. Config hot-reload works on all platforms
6. No new external dependencies added
