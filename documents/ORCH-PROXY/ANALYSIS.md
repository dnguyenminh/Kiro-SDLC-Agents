# Technical Analysis — Orchestration Proxy Integration

## 1. Source Code Mapping

### What exists in orchestrator-bridge (to port/adapt)

| Component | Source File | Purpose | Adaptation Needed |
|-----------|------------|---------|-------------------|
| `BridgeServer` | BridgeServer.kt | MCP server + proxy setup | Merge into existing McpServer.kt |
| `SmartRouter` | routing/SmartRouter.kt | Route tool calls local/remote | Port directly, adapt to our dispatch |
| `RoutingTable` | routing/RoutingTable.kt | Tool→destination mapping | Simplify (no ETag, local config only) |
| `UnifiedRegistry` | registry/UnifiedRegistry.kt | Merge tool lists | Port directly |
| `LocalServerManager` | local/LocalServerManager.kt | Spawn/manage child MCPs | Port directly |
| `ServerProcess` | local/ServerProcess.kt | Single child process lifecycle | Port directly |
| `StdioJsonRpc` | local/StdioJsonRpc.kt | JSON-RPC over stdio to child | Port directly |
| `ConfigWatcher` | local/ConfigWatcher.kt | Hot-reload config | Port directly |
| `HttpStreamableClient` | HttpStreamableClient.kt | HTTP to remote orchestrator | Port directly (Ktor already in deps) |
| `BridgeToolPromoter` | BridgeToolPromoter.kt | Meta-tools registration | Adapt to our tool system |
| `HealthCheckManager` | HealthCheckManager.kt | Ping remote orchestrator | Port directly |
| `ReconnectionManager` | ReconnectionManager.kt | Exponential backoff reconnect | Port directly |

### What we already have (keep as-is)

| Component | Our File | Tools |
|-----------|----------|-------|
| McpServer | McpServer.kt | stdio JSON-RPC dispatch |
| ToolDefinitions | tools/ToolDefinitions.kt | 7 code_* tools |
| MemoryToolDefinitions | memory/tools/MemoryToolDefinitions.kt | 12 mem_* tools |
| MemoryToolDispatcher | memory/tools/MemoryToolDispatcher.kt | Dispatch mem_* calls |
| IndexingEngine | indexer/IndexingEngine.kt | Code indexing |
| MemoryEngine | memory/MemoryEngine.kt | Memory system |
| ViewerServer | http/ViewerServer.kt | HTTP UI + API |
| IngestApiRoutes | http/IngestApiRoutes.kt | POST /api/memory/ingest |

---

## 2. Integration Strategy

### Option A: Merge into McpServer (RECOMMENDED)

Extend `McpServer.dispatchTool()` to check orchestration layer before returning "Unknown tool":

```kotlin
// Current flow:
dispatchTool(name, args) → memoryDispatcher?.dispatch() → when(name) { code_* } → "Unknown tool"

// New flow:
dispatchTool(name, args) → memoryDispatcher?.dispatch() → when(name) { code_* } 
  → orchestrationRouter?.route(name, args)  // NEW
  → "Unknown tool"
```

### Key Changes to McpServer.kt

1. **handleInitialize** — also load `orchestration.json`, start LocalServerManager, connect remote
2. **handleToolsList** — merge native + orchestrated tools via UnifiedRegistry
3. **dispatchTool** — add orchestration routing as fallback before "Unknown tool"
4. **New: handleToolsCall** — add auto-logging wrapper around all calls

### New Package Structure

```
com.codeintel/
├── orchestration/           ← NEW PACKAGE
│   ├── OrchestrationEngine.kt    ← Main orchestration coordinator
│   ├── OrchestrationConfig.kt    ← Config loading (orchestration.json)
│   ├── local/
│   │   ├── LocalServerManager.kt
│   │   ├── ServerProcess.kt
│   │   ├── StdioJsonRpc.kt
│   │   └── ConfigWatcher.kt
│   ├── remote/
│   │   ├── HttpStreamableClient.kt
│   │   ├── HealthCheckManager.kt
│   │   └── ReconnectionManager.kt
│   ├── routing/
│   │   ├── SmartRouter.kt
│   │   ├── RoutingTable.kt
│   │   └── UnifiedRegistry.kt
│   ├── meta/
│   │   ├── FindToolsTool.kt
│   │   ├── ExecuteDynamicTool.kt
│   │   ├── ToggleToolTool.kt
│   │   └── OrchestrationStatusTool.kt
│   └── logging/
│       └── AutoLogger.kt
├── (existing packages unchanged)
```

---

## 3. Key Design Decisions

### D-1: No MCP SDK dependency

The orchestrator-bridge uses `io.modelcontextprotocol.kotlin.sdk` (official MCP SDK). Our server uses **raw JSON-RPC parsing** (no SDK). We will NOT add the SDK — instead, port the logic using our existing JSON-RPC approach. This keeps the dependency footprint minimal.

### D-2: Orchestration is OPTIONAL

If `orchestration.json` doesn't exist, the server behaves exactly as before. Zero overhead when orchestration is disabled.

### D-3: Native tools have highest priority

Routing priority: native (code_* + mem_*) > local spawned > remote. This ensures our core tools are never shadowed.

### D-4: Auto-logging uses existing audit system

We already have `memoryEngine.audit.log()`. Auto-logging for proxied calls will use the same mechanism — no new storage needed.

### D-5: Recursive proxy via timeout propagation

Each proxy hop subtracts elapsed time from the remaining timeout. If timeout reaches 0, the call fails with a clear error indicating which hop timed out.

---

## 4. Risk Assessment

### Breaking Changes: NONE

- All 19 existing tools unchanged
- McpServer.kt changes are additive (new else-branch in dispatch)
- Config format unchanged (.code-intel/config.json still works)
- New config is separate file (orchestration.json)

### Performance Impact: MINIMAL

- Native tool calls: +1 null check (orchestrationRouter == null → skip)
- tools/list: merge operation only if orchestration enabled
- Memory: only if child processes spawned

---

## 5. Implementation Order

1. **OrchestrationConfig.kt** — Parse orchestration.json
2. **StdioJsonRpc.kt** — JSON-RPC communication with child processes
3. **ServerProcess.kt** — Single child process lifecycle
4. **LocalServerManager.kt** — Manage multiple child processes
5. **UnifiedRegistry.kt** — Merge tool lists
6. **SmartRouter.kt** — Route tool calls
7. **AutoLogger.kt** — Log proxied calls to memory
8. **OrchestrationEngine.kt** — Coordinator (wires everything together)
9. **McpServer.kt changes** — Integrate orchestration into dispatch
10. **HttpStreamableClient.kt** — Remote orchestrator connection
11. **Meta-tools** — find_tools, execute_dynamic_tool, etc.
12. **ConfigWatcher.kt** — Hot-reload support
