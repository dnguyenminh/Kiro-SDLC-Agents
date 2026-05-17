# Technical Design Document — Orchestration Proxy (Stdio Recursive)

## Document Info

| Field | Value |
|-------|-------|
| Document | TDD-ORCH-PROXY |
| Version | 1.0 |
| Status | Draft |
| Author | SA Agent |
| Created | 2025-01-20 |
| Related BRD | BRD-ORCH-PROXY v2.0 |
| Target | mcp-code-intelligence-kotlin |

---

## 1. Architecture Overview

### 1.1 Design Philosophy

- **Stdio-only** — all child communication via stdin/stdout pipes (no HTTP)
- **Recursive by nature** — a child with `--config` spawns its own children automatically
- **Zero new dependencies** — uses JDK Process API + existing kotlinx libraries
- **Additive integration** — extends McpServer.kt dispatch chain, no breaking changes
- **Optional activation** — no `--config` arg = server behaves exactly as before

### 1.2 High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ McpServer (existing)                                         │
│  ├── handleToolsList() ──→ UnifiedRegistry.getAll()          │
│  ├── dispatchTool()                                          │
│  │    ├── memoryDispatcher.dispatch()  (native mem_*)        │
│  │    ├── when(name) { code_* }       (native code_*)       │
│  │    ├── metaToolDispatcher.dispatch() (meta-tools) ← NEW  │
│  │    └── orchestrationRouter.route()  (child servers) ← NEW│
│  └── handleInitialize() ──→ OrchestrationEngine.start()      │
├─────────────────────────────────────────────────────────────┤
│ orchestration/ package (NEW)                                 │
│  ├── OrchestrationEngine     ← coordinator                   │
│  ├── OrchestrationConfig     ← config loading                │
│  ├── local/                                                  │
│  │    ├── LocalServerManager ← manages all children          │
│  │    ├── ServerProcess      ← single child lifecycle        │
│  │    └── StdioJsonRpc       ← JSON-RPC over pipes           │
│  ├── routing/                                                │
│  │    ├── SmartRouter        ← tool→server resolution        │
│  │    └── RoutingTable       ← O(1) lookup table             │
│  ├── registry/                                               │
│  │    └── UnifiedRegistry    ← merge native+child tools      │
│  ├── meta/                                                   │
│  │    ├── FindToolsTool                                      │
│  │    ├── ExecuteDynamicTool                                 │
│  │    ├── ToggleToolTool                                     │
│  │    ├── ResetToolsTool                                     │
│  │    └── ManageAutoApproveTool                              │
│  └── logging/                                                │
│       └── AutoLogger         ← audit trail for proxied calls │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Process Tree Model

```
Process Tree (OS-level):
  PID 1000: java -jar server.jar --config ./orch1.conf --depth 0
    PID 1001: java -jar server.jar --config ./orch2.conf --depth 1
      PID 1002: node dist/mcp-a.js
      PID 1003: python -m mcp_b
    PID 1004: node jira-mcp/dist/index.js
    PID 1005: python -m export_tools
```

Each level increments `--depth`. Max depth (default 5) prevents infinite recursion.


---

## 2. Package Structure

```
com.codeintel/
├── orchestration/                          ← NEW PACKAGE
│   ├── OrchestrationEngine.kt             ← Main coordinator (wires everything)
│   ├── OrchestrationConfig.kt             ← Config file parsing + validation
│   ├── local/
│   │   ├── LocalServerManager.kt          ← Manage multiple child processes
│   │   ├── ServerProcess.kt               ← Single child process lifecycle
│   │   ├── StdioJsonRpc.kt                ← JSON-RPC over stdio pipes
│   │   └── ConfigWatcher.kt               ← Hot-reload config file changes
│   ├── routing/
│   │   ├── SmartRouter.kt                 ← Route tool calls to correct server
│   │   └── RoutingTable.kt                ← O(1) tool→server mapping
│   ├── registry/
│   │   └── UnifiedRegistry.kt             ← Merge native + child tool lists
│   ├── meta/
│   │   ├── MetaToolDispatcher.kt          ← Dispatch meta-tool calls
│   │   ├── FindToolsTool.kt               ← Fuzzy search tools by description
│   │   ├── ExecuteDynamicTool.kt          ← Execute any tool by name
│   │   ├── ToggleToolTool.kt              ← Enable/disable tools at runtime
│   │   ├── ResetToolsTool.kt              ← Reset all toggles
│   │   └── ManageAutoApproveTool.kt       ← Persist auto-approve list
│   └── logging/
│       └── AutoLogger.kt                  ← Log proxied calls to memory audit
├── (existing packages unchanged)
│   ├── McpServer.kt                       ← MODIFIED (add orchestration dispatch)
│   ├── Config.kt                          ← MODIFIED (add --config, --depth args)
│   ├── Main.kt                            ← UNCHANGED
│   ├── db/
│   ├── http/
│   ├── indexer/
│   ├── memory/
│   ├── ollama/
│   ├── query/
│   ├── scanner/
│   └── tools/
```

---

## 3. Config File Schema

### 3.1 CLI Arguments (New)

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--config <path>` | String? | null | Path to orchestration config file |
| `--depth <N>` | Int | 0 | Current recursion depth (internal, auto-incremented) |
| `--max-depth <N>` | Int | 5 | Maximum allowed recursion depth |

### 3.2 Config File Format (`*.conf` or `*.json`)

```json
{
  "mcpServers": {
    "<server-name>": {
      "command": "<executable>",
      "args": ["<arg1>", "<arg2>", ...],
      "env": { "<KEY>": "<VALUE>" },
      "disabled": false,
      "timeout": 30000
    }
  },
  "settings": {
    "autoLog": {
      "enabled": true,
      "excludeTools": ["mem_audit", "mem_status"],
      "maxArgLength": 200
    },
    "healthCheckIntervalMs": 30000,
    "maxRestartRetries": 3
  }
}
```

### 3.3 Config Data Classes

```kotlin
@Serializable
data class OrchestrationConfig(
    val mcpServers: Map<String, ServerEntry> = emptyMap(),
    val settings: OrchSettings = OrchSettings()
)

@Serializable
data class ServerEntry(
    val command: String,
    val args: List<String> = emptyList(),
    val env: Map<String, String> = emptyMap(),
    val disabled: Boolean = false,
    val timeout: Long = 30_000
)

@Serializable
data class OrchSettings(
    val autoLog: AutoLogConfig = AutoLogConfig(),
    val healthCheckIntervalMs: Long = 30_000,
    val maxRestartRetries: Int = 3
)

@Serializable
data class AutoLogConfig(
    val enabled: Boolean = true,
    val excludeTools: List<String> = emptyList(),
    val maxArgLength: Int = 200
)
```


---

## 4. Class Diagrams

### 4.1 Core Orchestration Classes

```
┌─────────────────────────────────────────────────────────────────┐
│ OrchestrationEngine                                              │
├─────────────────────────────────────────────────────────────────┤
│ - config: OrchestrationConfig                                    │
│ - serverManager: LocalServerManager                              │
│ - router: SmartRouter                                            │
│ - registry: UnifiedRegistry                                      │
│ - autoLogger: AutoLogger                                         │
│ - scope: CoroutineScope                                          │
├─────────────────────────────────────────────────────────────────┤
│ + start(): Unit                                                  │
│ + stop(): Unit                                                   │
│ + route(toolName: String, args: JsonObject): String               │
│ + getAllTools(): List<JsonObject>                                 │
│ + getStatus(): JsonObject                                        │
│ + isEnabled(): Boolean                                           │
└─────────────────────────────────────────────────────────────────┘
         │ uses                    │ uses                │ uses
         ▼                        ▼                     ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ LocalServerManager│  │ SmartRouter      │  │ UnifiedRegistry  │
├──────────────────┤  ├──────────────────┤  ├──────────────────┤
│ - servers: Map   │  │ - table: Routing │  │ - native: List   │
│ - scope: Corout  │  │ - manager: Local │  │ - child: List    │
│ - healthJob: Job │  │ - metrics: Map   │  │ - merged: List   │
├──────────────────┤  ├──────────────────┤  ├──────────────────┤
│ + startAll()     │  │ + route(name,arg)│  │ + setNative(t)   │
│ + stopAll()      │  │ + getMetrics()   │  │ + setChild(t)    │
│ + callTool(...)  │  │                  │  │ + getAll()       │
│ + getAllTools()   │  │                  │  │ + find(name)     │
└──────────────────┘  └──────────────────┘  └──────────────────┘
         │ manages
         ▼
┌──────────────────────────────────────────────────────────────┐
│ ServerProcess                                                 │
├──────────────────────────────────────────────────────────────┤
│ - name: String                                                │
│ - config: ServerEntry                                         │
│ - rpc: StdioJsonRpc                                           │
│ - process: Process?                                           │
│ - state: ServerState                                          │
│ - tools: List<ToolDef>                                        │
│ - retryCount: Int                                             │
├──────────────────────────────────────────────────────────────┤
│ + start(): Boolean                                            │
│ + stop(): Unit                                                │
│ + restart(): Boolean                                          │
│ + callTool(name, args): JsonElement?                          │
│ + healthCheck(): Boolean                                      │
└──────────────────────────────────────────────────────────────┘
         │ uses
         ▼
┌──────────────────────────────────────────────────────────────┐
│ StdioJsonRpc                                                  │
├──────────────────────────────────────────────────────────────┤
│ - requestId: AtomicLong                                       │
│ - pending: ConcurrentHashMap<Long, CompletableDeferred>       │
│ - outputStream: OutputStream?                                 │
│ - readerJob: Job?                                             │
├──────────────────────────────────────────────────────────────┤
│ + attach(output, input, scope): Unit                          │
│ + detach(): Unit                                              │
│ + sendRequest(method, params, timeout): JsonElement?           │
│ + sendNotification(method, params): Unit                      │
│ + rejectAll(reason): Unit                                     │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 State Machine — ServerProcess

```
                    ┌──────────┐
                    │ STARTING │
                    └────┬─────┘
                         │ spawnProcess() + initialize()
                    ┌────▼─────┐
              ┌─────│  READY   │
              │     └────┬─────┘
              │          │ fetchTools() success
              │     ┌────▼─────┐
              │     │  ACTIVE  │◄────────────────┐
              │     └────┬─────┘                 │
              │          │ process exits         │ restart() success
              │     ┌────▼─────┐           ┌────┴──────┐
              │     │ CRASHED  │──────────→│RESTARTING │
              │     └──────────┘           └────┬──────┘
              │                                  │ retries > max
              │     ┌──────────┐           ┌────▼──────┐
              │     │ STOPPING │           │   DEAD    │
              │     └──────────┘           └───────────┘
              │          ▲
              └──────────┘ stop() called
                    
    FAILED ← initialize() or fetchTools() fails on first start
```


---

## 5. API Contracts (JSON-RPC Messages)

### 5.1 Parent → Child: Initialize

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "mcp-orchestrator",
      "version": "1.0.0"
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": { "tools": { "listChanged": false } },
    "serverInfo": { "name": "child-server", "version": "0.1.0" }
  }
}
```

**Follow-up notification:**
```json
{ "jsonrpc": "2.0", "method": "notifications/initialized", "params": {} }
```

### 5.2 Parent → Child: tools/list

**Request:**
```json
{ "jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {} }
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "jira_get_issue",
        "description": "Get issue details from Jira",
        "inputSchema": {
          "type": "object",
          "properties": {
            "issue_key": { "type": "string", "description": "Jira issue key" }
          },
          "required": ["issue_key"]
        }
      }
    ]
  }
}
```

### 5.3 Parent → Child: tools/call

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "jira_get_issue",
    "arguments": { "issue_key": "KSA-14" }
  }
}
```

**Response (success):**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      { "type": "text", "text": "{\"key\":\"KSA-14\",\"summary\":\"...\"}" }
    ]
  }
}
```

**Response (error):**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "error": {
    "code": -32603,
    "message": "Tool execution failed: connection timeout"
  }
}
```

### 5.4 Health Check (via tools/list as ping)

Parent sends `tools/list` periodically. If no response within 5s → mark unhealthy.

### 5.5 Timeout Propagation

Each hop calculates remaining timeout:
```
remainingTimeout = originalTimeout - elapsedSinceStart
if (remainingTimeout <= 0) → return TimeoutError immediately
else → pass remainingTimeout to child's sendRequest()
```

For recursive calls through multiple orchestrators:
```
IDE → Orch1 (timeout=30s) → Orch2 (timeout=28s) → MCP-A (timeout=26s)
```


---

## 6. Sequence Diagrams

### 6.1 Startup Sequence

```
Main                Config              Engine              LocalServerMgr       ServerProcess
 │                    │                   │                      │                    │
 │──parse --config──→│                   │                      │                    │
 │                    │──load file──→     │                      │                    │
 │                    │←─OrchConfig──     │                      │                    │
 │──create engine(config)───────────────→│                      │                    │
 │                    │                   │──startAll()─────────→│                    │
 │                    │                   │                      │──for each server──→│
 │                    │                   │                      │                    │──spawn process
 │                    │                   │                      │                    │──attach stdio
 │                    │                   │                      │                    │──initialize()
 │                    │                   │                      │                    │──fetchTools()
 │                    │                   │                      │←─tools list────────│
 │                    │                   │←─all started─────────│                    │
 │                    │                   │──buildRegistry()     │                    │
 │                    │                   │──startHealthMonitor()│                    │
 │←─engine ready──────────────────────────│                      │                    │
```

### 6.2 Tool Call Routing (Single Hop)

```
IDE/Agent          McpServer           Engine            SmartRouter         ServerProcess
 │                    │                  │                    │                    │
 │──tools/call────→  │                  │                    │                    │
 │  {name:"jira_*"}  │                  │                    │                    │
 │                    │──dispatchTool()  │                    │                    │
 │                    │  (not native)    │                    │                    │
 │                    │──route(name,args)────────────────────→│                    │
 │                    │                  │                    │──resolve(name)     │
 │                    │                  │                    │  → server="jira"   │
 │                    │                  │                    │──callTool()───────→│
 │                    │                  │                    │                    │──rpc.sendRequest()
 │                    │                  │                    │                    │←─result
 │                    │                  │                    │←─RouteResult───────│
 │                    │                  │──autoLog(call)     │                    │
 │                    │←─result──────────│                    │                    │
 │←─response─────────│                  │                    │                    │
```

### 6.3 Recursive Tool Call (Multi-Hop)

```
IDE        Orch1              Orch1.Router       Orch2(child)        Orch2.Router       MCP-A(child)
 │           │                    │                  │                    │                  │
 │──call──→ │                    │                  │                    │                  │
 │           │──route("tool_a")─→│                  │                    │                  │
 │           │                    │──resolve→Orch2   │                    │                  │
 │           │                    │──callTool()────→│                    │                  │
 │           │                    │  (via stdio)    │──route("tool_a")─→│                  │
 │           │                    │                  │                    │──resolve→MCP-A   │
 │           │                    │                  │                    │──callTool()────→│
 │           │                    │                  │                    │  (via stdio)    │──execute
 │           │                    │                  │                    │←─result─────────│
 │           │                    │                  │←─result────────────│                  │
 │           │                    │←─result──────────│                    │                  │
 │           │──autoLog()         │                  │                    │                  │
 │←─result──│                    │                  │                    │                  │
```

### 6.4 Crash Recovery Sequence

```
HealthMonitor       LocalServerMgr       ServerProcess        StdioJsonRpc
 │                      │                    │                    │
 │──healthCheck()──────→│                    │                    │
 │                      │──healthCheck()────→│                    │
 │                      │                    │──sendRequest()────→│
 │                      │                    │                    │──timeout (5s)
 │                      │                    │←─exception─────────│
 │                      │                    │──2nd check────────→│
 │                      │                    │←─exception─────────│
 │                      │←─unhealthy─────────│                    │
 │                      │──handleCrash()     │                    │
 │                      │──restart()────────→│                    │
 │                      │                    │──killProcess()     │
 │                      │                    │──delay(backoff)    │
 │                      │                    │──spawnProcess()    │
 │                      │                    │──initialize()      │
 │                      │                    │──fetchTools()      │
 │                      │←─restarted─────────│                    │
 │                      │──onToolsChanged()  │                    │
```


---

## 7. Detailed Class Design

### 7.1 OrchestrationConfig.kt

```kotlin
package com.codeintel.orchestration

import kotlinx.serialization.*
import kotlinx.serialization.json.*
import java.io.File

@Serializable
data class OrchestrationConfig(
    val mcpServers: Map<String, ServerEntry> = emptyMap(),
    val settings: OrchSettings = OrchSettings()
) {
    companion object {
        private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

        /** Load config from file path. Returns null if file doesn't exist. */
        fun load(path: String): OrchestrationConfig? {
            val file = File(path)
            if (!file.exists()) return null
            val text = file.readText()
            return json.decodeFromString(text)
        }
    }
}

@Serializable
data class ServerEntry(
    val command: String,
    val args: List<String> = emptyList(),
    val env: Map<String, String> = emptyMap(),
    val disabled: Boolean = false,
    val timeout: Long = 30_000
)

@Serializable
data class OrchSettings(
    val autoLog: AutoLogConfig = AutoLogConfig(),
    val healthCheckIntervalMs: Long = 30_000,
    val maxRestartRetries: Int = 3
)

@Serializable
data class AutoLogConfig(
    val enabled: Boolean = true,
    val excludeTools: List<String> = emptyList(),
    val maxArgLength: Int = 200
)
```

### 7.2 StdioJsonRpc.kt

Port from orchestrator-bridge with adaptations:
- Remove SLF4J logger → use `log()` stderr function (existing pattern)
- Keep: `attach()`, `detach()`, `sendRequest()`, `sendNotification()`, `rejectAll()`
- Keep: `ConcurrentHashMap<Long, CompletableDeferred>` for pending requests
- Keep: `AtomicLong` for request ID generation
- Add: timeout parameter propagation support

### 7.3 ServerProcess.kt

Port from orchestrator-bridge with adaptations:
- States: STARTING, READY, ACTIVE, CRASHED, RESTARTING, STOPPING, DEAD, FAILED
- Remove SLF4J → use `log()` stderr
- Keep: spawn, initialize, fetchTools, healthCheck, restart logic
- Add: `--depth` increment when spawning child orchestrators
- Add: Windows process tree kill via `taskkill /T /F /PID`

### 7.4 LocalServerManager.kt

Port from orchestrator-bridge with adaptations:
- Remove SLF4J → use `log()`
- Keep: startAll, stopAll, callTool, getAllTools, findServerForTool
- Keep: health monitoring loop, crash handling, config hot-reload
- Add: depth validation before spawning

### 7.5 SmartRouter.kt

Simplified from orchestrator-bridge (no remote routing):

```kotlin
package com.codeintel.orchestration.routing

import com.codeintel.orchestration.local.LocalServerManager
import kotlinx.serialization.json.*
import java.util.concurrent.ConcurrentHashMap

data class ToolMetrics(
    var callCount: Long = 0,
    var errorCount: Long = 0,
    var totalLatencyMs: Long = 0,
    var lastCallAt: Long? = null
)

class SmartRouter(private val serverManager: LocalServerManager) {
    private val metrics = ConcurrentHashMap<String, ToolMetrics>()

    /** Route a tool call to the correct child server. */
    suspend fun route(toolName: String, args: JsonObject, timeoutMs: Long = 30_000): String {
        val start = System.currentTimeMillis()
        val serverName = serverManager.findServerForTool(toolName)
            ?: throw RuntimeException("Tool '$toolName' not found in any child server")

        return try {
            val result = serverManager.callTool(serverName, toolName, args, timeoutMs)
            recordMetric(toolName, System.currentTimeMillis() - start, false)
            extractText(result)
        } catch (e: Exception) {
            recordMetric(toolName, System.currentTimeMillis() - start, true)
            throw e
        }
    }

    fun getMetrics(): Map<String, ToolMetrics> = metrics.toMap()

    private fun extractText(result: JsonElement?): String {
        val content = result?.jsonObject?.get("content")?.jsonArray ?: return "{}"
        return content.firstOrNull()?.jsonObject?.get("text")
            ?.jsonPrimitive?.content ?: "{}"
    }

    private fun recordMetric(tool: String, latencyMs: Long, isError: Boolean) {
        val m = metrics.getOrPut(tool) { ToolMetrics() }
        m.callCount++
        if (isError) m.errorCount++
        m.totalLatencyMs += latencyMs
        m.lastCallAt = System.currentTimeMillis()
    }
}
```

### 7.6 UnifiedRegistry.kt

```kotlin
package com.codeintel.orchestration.registry

import kotlinx.serialization.json.JsonObject

data class RegisteredTool(
    val name: String,
    val description: String?,
    val inputSchema: JsonObject?,
    val source: String,       // "native" | "child:<serverName>"
    val enabled: Boolean = true
)

class UnifiedRegistry {
    private var nativeTools: List<RegisteredTool> = emptyList()
    private var childTools: List<RegisteredTool> = emptyList()
    private var merged: List<RegisteredTool> = emptyList()
    private val toggles = mutableMapOf<String, Boolean>() // session-scoped

    fun setNativeTools(tools: List<RegisteredTool>) {
        nativeTools = tools; rebuild()
    }

    fun setChildTools(tools: List<RegisteredTool>) {
        childTools = tools; rebuild()
    }

    /** Get all enabled tools (respects toggles). */
    fun getAll(): List<RegisteredTool> = merged.filter { isEnabled(it.name) }

    /** Find tool by name. */
    fun find(name: String): RegisteredTool? = merged.firstOrNull { it.name == name }

    /** Fuzzy search by description. */
    fun search(query: String): List<RegisteredTool> {
        val q = query.lowercase()
        return getAll().filter { tool ->
            tool.name.lowercase().contains(q) ||
            (tool.description?.lowercase()?.contains(q) == true)
        }
    }

    fun toggle(toolName: String, enabled: Boolean) { toggles[toolName] = enabled }
    fun resetToggles() { toggles.clear() }
    fun isEnabled(toolName: String): Boolean = toggles[toolName] ?: true

    private fun rebuild() {
        val map = mutableMapOf<String, RegisteredTool>()
        // Child tools first (will be overwritten by native = native wins)
        childTools.forEach { map[it.name] = it }
        nativeTools.forEach { map[it.name] = it }
        merged = map.values.toList()
    }
}
```

### 7.7 AutoLogger.kt

```kotlin
package com.codeintel.orchestration.logging

import com.codeintel.memory.MemoryEngine
import com.codeintel.orchestration.OrchSettings

class AutoLogger(
    private val memoryEngine: MemoryEngine?,
    private val settings: AutoLogConfig
) {
    /** Log a tool call to audit. */
    fun logCall(
        toolName: String,
        args: String,
        result: String,
        latencyMs: Long,
        source: String,
        isError: Boolean = false
    ) {
        if (!settings.enabled) return
        if (toolName in settings.excludeTools) return

        val truncatedArgs = args.take(settings.maxArgLength)
        val truncatedResult = result.take(500)

        memoryEngine?.audit?.log(
            operation = if (isError) "PROXY_ERROR" else "PROXY_CALL",
            sessionId = memoryEngine.currentSessionId,
            details = "$source::$toolName($truncatedArgs) → ${latencyMs}ms"
        )

        // Create memory entry for significant events
        if (isError || latencyMs > 5000) {
            memoryEngine?.audit?.log(
                operation = "PROXY_ALERT",
                sessionId = memoryEngine.currentSessionId,
                details = "ALERT: $toolName from $source — " +
                    if (isError) "ERROR" else "SLOW (${latencyMs}ms)"
            )
        }
    }
}
```

### 7.8 MetaToolDispatcher.kt

```kotlin
package com.codeintel.orchestration.meta

import com.codeintel.orchestration.OrchestrationEngine
import kotlinx.serialization.json.*

class MetaToolDispatcher(private val engine: OrchestrationEngine) {

    /** Try to dispatch a meta-tool. Returns null if not a meta-tool. */
    fun dispatch(name: String, args: JsonObject): String? {
        return when (name) {
            "find_tools" -> findTools(args)
            "execute_dynamic_tool" -> executeDynamicTool(args)
            "toggle_tool" -> toggleTool(args)
            "reset_tools" -> resetTools()
            "manage_auto_approve" -> manageAutoApprove(args)
            else -> null
        }
    }

    /** Tool definitions for meta-tools (added to tools/list). */
    fun getToolDefinitions(): List<JsonObject> = listOf(
        buildFindToolsDef(),
        buildExecuteDynamicToolDef(),
        buildToggleToolDef(),
        buildResetToolsDef(),
        buildManageAutoApproveDef()
    )

    private fun findTools(args: JsonObject): String { /* fuzzy search */ }
    private fun executeDynamicTool(args: JsonObject): String { /* delegate */ }
    private fun toggleTool(args: JsonObject): String { /* toggle */ }
    private fun resetTools(): String { /* reset */ }
    private fun manageAutoApprove(args: JsonObject): String { /* persist */ }
}
```


---

## 8. Integration Points (Changes to Existing Code)

### 8.1 Config.kt Changes

```kotlin
// Add to Config companion object:
private var configPath: String? = null
private var depth: Int = 0
private var maxDepth: Int = 5

fun setCliArgs(args: Array<String>) {
    // Existing arg parsing...
    // NEW: parse --config, --depth, --max-depth
    val configIdx = args.indexOf("--config")
    if (configIdx >= 0 && configIdx + 1 < args.size) {
        configPath = args[configIdx + 1]
    }
    val depthIdx = args.indexOf("--depth")
    if (depthIdx >= 0 && depthIdx + 1 < args.size) {
        depth = args[depthIdx + 1].toIntOrNull() ?: 0
    }
    val maxDepthIdx = args.indexOf("--max-depth")
    if (maxDepthIdx >= 0 && maxDepthIdx + 1 < args.size) {
        maxDepth = args[maxDepthIdx + 1].toIntOrNull() ?: 5
    }
}

// Add to Config data class:
val orchestrationConfigPath: String? get() = configPath
val currentDepth: Int get() = depth
val maxRecursionDepth: Int get() = maxDepth
```

### 8.2 McpServer.kt Changes

```kotlin
// NEW field:
private var orchestrationEngine: OrchestrationEngine? = null
private var metaToolDispatcher: MetaToolDispatcher? = null

// In handleInitialize(), after existing init:
val orchConfigPath = config.orchestrationConfigPath
if (orchConfigPath != null && config.currentDepth < config.maxRecursionDepth) {
    val orchConfig = OrchestrationConfig.load(orchConfigPath)
    if (orchConfig != null) {
        val engine = OrchestrationEngine(orchConfig, memoryEngine, config)
        engine.start()
        orchestrationEngine = engine
        metaToolDispatcher = MetaToolDispatcher(engine)
        log("Orchestration enabled: ${orchConfig.mcpServers.size} servers configured")
    }
}

// In handleToolsList():
private fun handleToolsList(): JsonObject = buildJsonObject {
    putJsonArray("tools") {
        ToolDefinitions.ALL.forEach { add(it) }
        MemoryToolDefinitions.ALL.forEach { add(it) }
        // NEW: add orchestrated tools
        orchestrationEngine?.getAllTools()?.forEach { add(it) }
        // NEW: add meta-tool definitions
        metaToolDispatcher?.getToolDefinitions()?.forEach { add(it) }
    }
}

// In dispatchTool(), add after existing when block:
private fun dispatchTool(name: String, args: JsonObject): String {
    val ql = queryLayer ?: throw RuntimeException("Not initialized")
    val idx = indexer ?: throw RuntimeException("Not initialized")

    // Try memory tools first
    memoryDispatcher?.dispatch(name, args)?.let { return it }

    // Try native code tools
    val nativeResult = when (name) {
        "code_search" -> CodeSearchTool(ql).execute(args)
        "code_symbols" -> CodeSymbolsTool(ql).execute(args)
        "code_context" -> CodeContextTool(ql, config.workspace).execute(args)
        "code_modules" -> CodeModulesTool(ql).execute(args)
        "code_index_status" -> CodeIndexStatusTool(ql, idx).execute(args)
        "stream_write_file" -> StreamWriteFileTool(config.workspace).execute(args)
        "code_kb_export" -> CodeKbExportTool(ql, config.workspace).execute(args)
        else -> null
    }
    if (nativeResult != null) return nativeResult

    // NEW: Try meta-tools
    metaToolDispatcher?.dispatch(name, args)?.let { return it }

    // NEW: Try orchestration routing (child servers)
    val engine = orchestrationEngine
    if (engine != null) {
        return try {
            engine.route(name, args)
        } catch (e: Exception) {
            """{"error": "${e.message}"}"""
        }
    }

    return "Unknown tool: $name"
}
```

### 8.3 Shutdown Hook

```kotlin
// In McpServer.run(), add shutdown hook:
Runtime.getRuntime().addShutdownHook(Thread {
    runBlocking { orchestrationEngine?.stop() }
    memoryEngine?.endSession()
    db?.close()
})
```


---

## 9. Cycle Detection & Depth Control

### 9.1 Mechanism

Each orchestrator instance tracks its depth via `--depth <N>` CLI argument:
- Root orchestrator: `--depth 0` (default if not specified)
- First child orchestrator: `--depth 1` (parent adds this when spawning)
- Second level: `--depth 2`
- ...

When spawning a child that has `--config` in its args (indicating it's an orchestrator), the parent **injects** `--depth <currentDepth+1>` into the child's args.

### 9.2 Depth Injection Logic

```kotlin
// In ServerProcess.spawnProcess():
fun buildArgs(config: ServerEntry, parentDepth: Int, maxDepth: Int): List<String> {
    val args = config.args.toMutableList()
    // If child has --config arg, it's an orchestrator → inject depth
    if (args.contains("--config")) {
        // Remove existing --depth if present
        val depthIdx = args.indexOf("--depth")
        if (depthIdx >= 0) args.removeAt(depthIdx + 1).also { args.removeAt(depthIdx) }
        // Inject new depth
        args.addAll(listOf("--depth", "${parentDepth + 1}", "--max-depth", "$maxDepth"))
    }
    return args
}
```

### 9.3 Depth Validation

```kotlin
// In OrchestrationEngine.start():
if (config.currentDepth >= config.maxRecursionDepth) {
    log("⚠️ Max recursion depth reached (${config.currentDepth}/${config.maxRecursionDepth}). Orchestration disabled.")
    return // Don't spawn children
}
```

---

## 10. Error Handling

### 10.1 Error Categories

| Category | Example | Handling |
|----------|---------|----------|
| Config Error | Invalid JSON, missing command | Log error, skip server, continue others |
| Spawn Error | Command not found, permission denied | Mark FAILED, don't retry |
| Initialize Error | Child doesn't respond to initialize | Mark FAILED, retry once |
| Runtime Error | Child crashes mid-call | Return error to caller, trigger restart |
| Timeout Error | Child doesn't respond in time | Return timeout error, mark unhealthy |
| Depth Error | Max recursion exceeded | Disable orchestration at this level |

### 10.2 Error Response Format

When a proxied tool call fails, the error is wrapped with context:

```json
{
  "content": [{
    "type": "text",
    "text": "{\"error\": \"Tool 'jira_get_issue' failed on server 'jira-mcp': connection timeout after 30000ms\", \"server\": \"jira-mcp\", \"tool\": \"jira_get_issue\"}"
  }],
  "isError": true
}
```

### 10.3 Graceful Degradation

- If a child server dies → its tools disappear from `tools/list`, other tools still work
- If config file is invalid → orchestration disabled, native tools still work
- If max depth reached → this instance works as leaf (native tools only)

---

## 11. Security Considerations

### 11.1 Process Isolation

- Each child runs in its own OS process with its own memory space
- Environment variables are explicitly passed (no inheritance of parent env by default)
- Child processes cannot access parent's memory or file handles

### 11.2 Config File Security

- Config file should be readable only by the server process user
- Sensitive env vars (API keys) in config should use file permissions for protection
- No secrets are logged in auto-logger (args are truncated)

### 11.3 Tool Name Validation

- Tool names must match `[a-zA-Z0-9_-]+` pattern
- Prevents injection via crafted tool names in JSON-RPC

---

## 12. Testing Strategy

### 12.1 Unit Tests

| Component | Test Focus |
|-----------|-----------|
| OrchestrationConfig | Parse valid/invalid JSON, missing fields, defaults |
| StdioJsonRpc | Request/response matching, timeout, concurrent requests |
| RoutingTable | O(1) lookup, priority resolution, unknown tool |
| UnifiedRegistry | Merge, conflict resolution, toggle, search |
| SmartRouter | Route to correct server, metrics, error handling |
| AutoLogger | Log format, exclusion list, truncation |

### 12.2 Integration Tests

| Scenario | Setup |
|----------|-------|
| Spawn single child | Start a mock MCP server (echo server), verify tools/list + tools/call |
| Spawn multiple children | 3 mock servers, verify routing to correct one |
| Child crash + restart | Kill child process, verify auto-restart + tool re-discovery |
| Recursive (2 levels) | Orch1 → Orch2 → MockServer, verify end-to-end call |
| Depth limit | Set max-depth=2, verify 3rd level doesn't spawn children |
| Config hot-reload | Modify config file, verify new server spawned |
| Timeout propagation | Set short timeout, verify timeout error propagates |

### 12.3 Mock MCP Server (for testing)

```kotlin
// Simple echo MCP server for integration tests
fun main() {
    val reader = System.`in`.bufferedReader()
    while (true) {
        val line = reader.readLine() ?: break
        val request = Json.parseToJsonElement(line).jsonObject
        val method = request["method"]?.jsonPrimitive?.content
        val id = request["id"]
        val response = when (method) {
            "initialize" -> buildInitResponse(id)
            "tools/list" -> buildToolsListResponse(id)
            "tools/call" -> buildEchoResponse(id, request)
            else -> continue
        }
        println(Json.encodeToString(JsonObject.serializer(), response))
        System.out.flush()
    }
}
```


---

## 13. Implementation Checklist

### Phase 1: Core Orchestration (MVP)

| # | Task | File | Depends On | Est. |
|---|------|------|-----------|------|
| 1 | Config data classes + parser | `orchestration/OrchestrationConfig.kt` | — | 1h |
| 2 | CLI arg parsing (--config, --depth) | `Config.kt` (modify) | — | 30m |
| 3 | StdioJsonRpc (port from bridge) | `orchestration/local/StdioJsonRpc.kt` | — | 2h |
| 4 | ServerProcess (port + adapt) | `orchestration/local/ServerProcess.kt` | #3 | 2h |
| 5 | LocalServerManager (port + adapt) | `orchestration/local/LocalServerManager.kt` | #4 | 2h |
| 6 | RoutingTable (simplified) | `orchestration/routing/RoutingTable.kt` | — | 1h |
| 7 | SmartRouter (stdio-only) | `orchestration/routing/SmartRouter.kt` | #5, #6 | 1.5h |
| 8 | UnifiedRegistry | `orchestration/registry/UnifiedRegistry.kt` | — | 1.5h |
| 9 | AutoLogger | `orchestration/logging/AutoLogger.kt` | — | 1h |
| 10 | OrchestrationEngine (coordinator) | `orchestration/OrchestrationEngine.kt` | #1-#9 | 2h |
| 11 | McpServer integration | `McpServer.kt` (modify) | #10 | 1.5h |
| 12 | Shutdown hook + process cleanup | `McpServer.kt` (modify) | #11 | 30m |
| 13 | Unit tests | `test/orchestration/` | #1-#12 | 3h |
| 14 | Integration test (single child) | `test/orchestration/` | #13 | 2h |

**Phase 1 Total: ~20h**

### Phase 2: Recursive + Meta-tools

| # | Task | File | Depends On | Est. |
|---|------|------|-----------|------|
| 15 | Depth injection logic | `ServerProcess.kt` (modify) | Phase 1 | 1h |
| 16 | Depth validation | `OrchestrationEngine.kt` (modify) | #15 | 30m |
| 17 | Timeout propagation | `SmartRouter.kt` (modify) | Phase 1 | 1h |
| 18 | MetaToolDispatcher | `orchestration/meta/MetaToolDispatcher.kt` | Phase 1 | 1h |
| 19 | FindToolsTool | `orchestration/meta/FindToolsTool.kt` | #18 | 1.5h |
| 20 | ExecuteDynamicTool | `orchestration/meta/ExecuteDynamicTool.kt` | #18 | 1h |
| 21 | ToggleToolTool | `orchestration/meta/ToggleToolTool.kt` | #18 | 1h |
| 22 | ResetToolsTool | `orchestration/meta/ResetToolsTool.kt` | #18 | 30m |
| 23 | ManageAutoApproveTool | `orchestration/meta/ManageAutoApproveTool.kt` | #18 | 1h |
| 24 | ConfigWatcher (hot-reload) | `orchestration/local/ConfigWatcher.kt` | Phase 1 | 2h |
| 25 | Recursive integration test | `test/orchestration/` | #15-#17 | 2h |
| 26 | Meta-tools tests | `test/orchestration/` | #18-#23 | 2h |

**Phase 2 Total: ~14.5h**

### Phase 3: Polish

| # | Task | File | Depends On | Est. |
|---|------|------|-----------|------|
| 27 | Metrics collection | `SmartRouter.kt` (enhance) | Phase 2 | 1h |
| 28 | orchestration_status tool | `orchestration/meta/` | #27 | 1h |
| 29 | Windows process tree kill | `ServerProcess.kt` (enhance) | Phase 1 | 1h |
| 30 | Error message improvements | All orchestration files | Phase 2 | 1h |
| 31 | Documentation + examples | `README.md`, example configs | Phase 2 | 2h |
| 32 | Performance benchmarks | `test/benchmarks/` | Phase 2 | 2h |

**Phase 3 Total: ~8h**

**Grand Total: ~42.5h**

---

## 14. File Size Compliance

Per Kotlin code standards (max 200 lines/file, max 20 lines/function):

| File | Estimated Lines | Compliance |
|------|----------------|-----------|
| OrchestrationConfig.kt | ~60 | ✅ |
| StdioJsonRpc.kt | ~110 | ✅ |
| ServerProcess.kt | ~180 | ✅ (tight) |
| LocalServerManager.kt | ~150 | ✅ |
| SmartRouter.kt | ~80 | ✅ |
| RoutingTable.kt | ~40 | ✅ |
| UnifiedRegistry.kt | ~90 | ✅ |
| AutoLogger.kt | ~50 | ✅ |
| OrchestrationEngine.kt | ~120 | ✅ |
| MetaToolDispatcher.kt | ~60 | ✅ |
| FindToolsTool.kt | ~80 | ✅ |
| ExecuteDynamicTool.kt | ~50 | ✅ |
| ToggleToolTool.kt | ~40 | ✅ |
| ResetToolsTool.kt | ~30 | ✅ |
| ManageAutoApproveTool.kt | ~50 | ✅ |
| ConfigWatcher.kt | ~80 | ✅ |

---

## 15. Migration Notes

### From orchestrator-bridge

| Source Component | Target | Changes |
|-----------------|--------|---------|
| `StdioJsonRpc` | Port directly | Remove SLF4J → stderr log() |
| `ServerProcess` | Port + adapt | Remove SLF4J, add depth injection |
| `LocalServerManager` | Port + adapt | Remove SLF4J, simplify config loading |
| `SmartRouter` | Rewrite (simpler) | Remove remote routing, stdio-only |
| `RoutingTable` | Rewrite (simpler) | Remove ETag/HTTP fetch, local map only |
| `UnifiedRegistry` | Port + adapt | Add toggle support, remove remote concept |
| `HttpStreamableClient` | **NOT PORTED** | No HTTP remote in this design |
| `HealthCheckManager` | Merged into LocalServerManager | Simplified |
| `ReconnectionManager` | **NOT PORTED** | No HTTP remote |
| `BridgeToolPromoter` | → MetaToolDispatcher | Rewritten for meta-tools |
| `ConfigWatcher` | Port directly | Minor adaptations |

### Key Differences from Bridge

1. **No HTTP remote** — all communication is stdio pipes
2. **No MCP SDK** — raw JSON-RPC (matching existing server approach)
3. **No SLF4J** — uses existing `log()` stderr pattern
4. **Recursive via process tree** — not via HTTP chain
5. **Config format = Kiro mcp.json** — not custom orchestration.json with remote section
