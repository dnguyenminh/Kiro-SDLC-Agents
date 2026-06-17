# Business Requirements Document — Orchestration Proxy Feature

## Document Info

| Field | Value |
|-------|-------|
| Document | BRD-ORCH-PROXY |
| Version | 2.0 |
| Status | Draft |
| Author | SM Agent |
| Created | 2025-01-18 |
| Updated | 2025-01-20 |
| Project | mcp-code-intelligence-kotlin |

---

## 1. Executive Summary

### 1.1 Purpose

Transform the existing `mcp-code-intelligence-kotlin` MCP server into a **unified orchestration proxy** that uses **stdio recursive spawning** to manage downstream MCP servers. Each orchestrator receives a `--config <file>` argument pointing to a config file (same format as Kiro `mcp.json`). Entries in the config are spawned as stdio child processes. If a child is itself an orchestrator (has `--config` arg), it recursively spawns its own children — forming a natural process tree.

### 1.2 Problem Statement

Currently, the MCP ecosystem requires users to configure each MCP server separately in their IDE's `mcp.json`. This creates:
1. **Configuration sprawl** — 10+ servers = 10+ entries in IDE config
2. **No tool aggregation** — each server's tools are isolated, no unified discovery
3. **No audit trail** — tool calls are not logged centrally
4. **No hierarchy** — cannot group related servers under a single orchestrator

### 1.3 Vision

A single MCP server entry in IDE config that:
- Retains ALL existing code-intelligence + memory capabilities (19 tools)
- Spawns and manages downstream MCP servers via stdio (child processes)
- Routes tool calls to the correct child based on tool name
- Supports **recursive orchestration** via process tree: `IDE → Orch1 → [Orch2 → [MCP-A, MCP-B], MCP1, MCP2]`
- Auto-logs every proxied tool call to local memory (audit trail)
- Provides meta-tools for dynamic tool discovery and execution

### 1.4 Key Design Decision: Stdio Recursive (NOT HTTP Remote)

**Approach:** Every downstream server is spawned as a stdio child process. There is NO HTTP remote proxy.

**Why:**
- Simpler architecture — no HTTP client, no session management, no reconnection logic
- Natural recursion — if a child has `--config`, it spawns its own children automatically
- Process tree gives natural lifecycle management — kill parent = kill all children
- Same config format as IDE (`mcpServers` in JSON) — familiar to users
- No network overhead — stdio pipes are faster than HTTP

**Process Tree Example:**
```
IDE (Kiro)
└── Orch1 (java -jar orchestrator.jar --config ./orch1.conf)
    ├── Orch2 (java -jar orchestrator.jar --config ./orch2.conf)
    │   ├── MCP-A (node dist/index.js)
    │   └── MCP-B (python -m mcp_server)
    ├── MCP1 (node jira-mcp/dist/index.js)
    └── MCP2 (python -m export_tools)
```

### 1.5 Scope

| In Scope | Out of Scope |
|----------|-------------|
| Local MCP server spawning (stdio child processes) | HTTP remote proxy (removed) |
| `--config <file>` argument for config loading | Authentication/authorization (JWT) |
| Recursive orchestration via process tree | UI dashboard for orchestration |
| Tool routing (native vs child servers) | Load balancing |
| Auto-logging to memory | Kubernetes/Docker deployment |
| Cycle detection via process tree depth | |
| Timeout propagation via stdio | |
| Config hot-reload | |
| Meta-tools (find_tools, execute_dynamic_tool) | |
| Health monitoring of child processes | |

---

## 2. Stakeholders

| Role | Interest |
|------|----------|
| Developer (IDE user) | Single MCP server entry that provides all tools |
| Agent (AI) | Unified tool discovery via find_tools, seamless execution |
| DevOps | Single JAR to deploy, single config to manage per level |
| Platform team | Extensible — add new MCP servers by editing config file |

---

## 3. Business Requirements

### BR-1: Unified Tool Registry

**As** an AI agent, **I want** a single `tools/list` response that includes tools from ALL sources (native + all child servers recursively), **so that** I can discover all available capabilities in one call.

**Acceptance Criteria:**
- AC-1.1: `tools/list` returns merged tools from: native (19 existing) + all spawned child servers
- AC-1.2: Tool names are unique — conflicts resolved by priority (native > first-registered child)
- AC-1.3: Tool source metadata available via `find_tools` query
- AC-1.4: Child orchestrators contribute their aggregated tools (recursive merge)

### BR-2: Config-Driven Server Spawning

**As** a developer, **I want** the server to read a `--config <file>` argument and spawn child MCP processes defined in that config, **so that** I can compose tool networks by editing JSON files.

**Acceptance Criteria:**
- AC-2.1: Server accepts `--config <path>` CLI argument
- AC-2.2: Config file uses same format as Kiro `mcp.json`: `{"mcpServers": {...}}`
- AC-2.3: Each entry in `mcpServers` is spawned as a stdio child process
- AC-2.4: Health monitoring with auto-restart on crash (max 3 retries, exponential backoff)
- AC-2.5: Config hot-reload — adding/removing servers without restart
- AC-2.6: Graceful shutdown — all child processes terminated on exit (process tree kill)
- AC-2.7: If no `--config` argument, server works exactly as before (no orchestration)

### BR-3: Recursive Orchestration via Process Tree

**As** a platform architect, **I want** a child server that is itself an orchestrator (has `--config` arg) to recursively spawn its own children, **so that** I can build hierarchical tool networks naturally.

**Acceptance Criteria:**
- AC-3.1: Recursion is natural — child orchestrator spawns its children, no special handling needed
- AC-3.2: Cycle detection via max depth limit (configurable, default 5)
- AC-3.3: Timeout propagation — each hop subtracts elapsed time from remaining timeout
- AC-3.4: Error propagation — downstream errors bubble up with source context (server name chain)
- AC-3.5: Process tree depth tracked via `--depth <N>` internal argument (incremented per level)

### BR-4: Smart Tool Routing

**As** the system, **I want** to route each tool call to the correct destination (native or specific child server), **so that** tools are executed by the appropriate provider.

**Acceptance Criteria:**
- AC-4.1: O(1) lookup by tool name in routing table
- AC-4.2: Routing priority: native (code_* + mem_*) > child servers (first-registered wins)
- AC-4.3: Metrics collection per tool (call count, error count, latency)
- AC-4.4: If tool not found anywhere, return clear error with available tool list hint

### BR-5: Auto-Logging to Memory

**As** a developer, **I want** every proxied tool call automatically logged to the memory system, **so that** I have a complete audit trail of all agent interactions.

**Acceptance Criteria:**
- AC-5.1: Every tool call (native + proxied) logged to audit table
- AC-5.2: Log includes: tool name, args (truncated), result summary, latency, source server
- AC-5.3: Configurable: can disable auto-logging per tool or globally
- AC-5.4: Memory entries created for significant events (errors, slow calls >5s)

### BR-6: Meta-Tools (find_tools, execute_dynamic_tool, toggle_tool, reset_tools)

**As** an AI agent, **I want** meta-tools that let me discover and execute tools dynamically, **so that** I can work with tools not known at compile time.

**Acceptance Criteria:**
- AC-6.1: `find_tools(query)` — fuzzy search across all registered tools by description
- AC-6.2: `execute_dynamic_tool(tool_name, arguments)` — execute any registered tool by name
- AC-6.3: `toggle_tool(tool_name, enabled)` — enable/disable tools at runtime (session-scoped)
- AC-6.4: `reset_tools()` — reset all toggles to default
- AC-6.5: `manage_auto_approve(tool_name, auto_approve)` — manage auto-approve list (persisted)

---

## 4. Non-Functional Requirements

### NFR-1: Performance

| Metric | Target |
|--------|--------|
| Native tool call latency | < 5ms overhead |
| Stdio proxy overhead per hop | < 10ms |
| Tool registry lookup | O(1) |
| Memory footprint per spawned server | < 50MB |
| Startup time (spawn all children) | < 5s for 5 servers |

### NFR-2: Reliability

| Metric | Target |
|--------|--------|
| Auto-restart on child crash | Within 5s, max 3 retries |
| Graceful degradation | If child dies, other tools still work |
| Config hot-reload | No downtime, < 2s to apply |
| Process tree cleanup on exit | All children killed within 3s |

### NFR-3: Compatibility

- MUST maintain backward compatibility with existing 19 tools (code_* + mem_*)
- MUST work with existing `.code-intel/config.json` format
- MUST support stdio JSON-RPC transport (existing protocol)
- Config file format MUST match Kiro `mcp.json` schema (`{"mcpServers": {...}}`)
- `--config` argument is OPTIONAL — server works without it (no orchestration)

### NFR-4: Observability

- All tool calls logged to audit (existing audit system)
- Metrics exposed via `orchestration_status` meta-tool
- Process tree visible via meta-tool query

---

## 5. Architecture Overview

### 5.1 Current Architecture

```
IDE (Kiro) ←—stdio—→ mcp-code-intelligence-kotlin
                         ├── Code Intelligence (code_*)
                         ├── Memory Engine (mem_*)
                         └── HTTP Viewer (:3200)
```

### 5.2 Target Architecture (Stdio Recursive)

```
IDE (Kiro) ←—stdio—→ mcp-code-intelligence-kotlin --config ./orch.conf
                         ├── Code Intelligence (code_*) ← native
                         ├── Memory Engine (mem_*) ← native
                         ├── Meta-Tools (find_tools, execute_dynamic_tool, etc.) ← native
                         ├── Orchestration Layer (NEW)
                         │    ├── LocalServerManager → spawns child MCP servers
                         │    │    ├── "Orch2" (java -jar orch.jar --config ./orch2.conf)
                         │    │    │    ├── MCP-A (node dist/a.js)
                         │    │    │    └── MCP-B (python -m b)
                         │    │    ├── "MCP1" (node jira-mcp/dist/index.js)
                         │    │    └── "MCP2" (python -m export_tools)
                         │    ├── SmartRouter → routes tool calls by name
                         │    ├── UnifiedRegistry → merges all tool lists
                         │    └── AutoLogger → logs to memory audit
                         └── HTTP Viewer (:3200) + Ingest API
```

### 5.3 Recursive Tool Call Flow

```
Agent calls "jira_get_issue" →
  SmartRouter resolves → child "Orch2" →
    Orch2's SmartRouter resolves → child "jira-mcp" →
      jira-mcp executes → returns result →
    Orch2 returns to parent →
  our-server returns to Agent
  + AutoLogger writes audit entry at each level
```

### 5.4 Config File Format

```json
{
  "mcpServers": {
    "Orch2": {
      "command": "java",
      "args": ["-jar", "orchestrator.jar", "--config", "./orch2.conf"],
      "env": {}
    },
    "jira-mcp": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": { "JIRA_URL": "https://jira.example.com" }
    },
    "export-tools": {
      "command": "python",
      "args": ["-m", "export_tools"],
      "env": {}
    }
  }
}
```

---

## 6. Dependencies

| Dependency | Type | Description |
|-----------|------|-------------|
| Existing mcp-code-intelligence-kotlin | Internal | Base server to extend |
| kotlinx.coroutines (already in deps) | Library | Async server management |
| kotlinx.serialization (already in deps) | Library | JSON parsing |
| Process API (JDK) | Platform | Spawning child processes |

**No new external dependencies required.** Removed: Ktor Client (no longer needed — no HTTP remote proxy).

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Child process leaks on crash | Medium | Process group kill + shutdown hooks |
| Infinite recursion in process tree | High | Max depth limit (default 5) + `--depth` tracking |
| Memory bloat from auto-logging | Medium | Configurable exclusion list + consolidation |
| Breaking existing tools | Critical | All existing tests must pass, backward compat guaranteed |
| Config file corruption | Low | Validation on load, fallback to no-orchestration mode |
| Zombie processes on Windows | Medium | destroyForcibly() + process tree kill via taskkill |

---

## 8. Success Metrics

| Metric | Target |
|--------|--------|
| Existing 19 tools still work | 100% backward compatible |
| New tools discoverable via find_tools | All child server tools visible |
| Auto-restart on crash | < 5s recovery |
| Recursive proxy depth tested | ≥ 3 levels |
| Config hot-reload | No restart needed |
| Process tree cleanup | All children killed on parent exit |

---

## 9. Implementation Phases

### Phase 1: Core Orchestration (MVP)
- `--config` argument parsing
- Config file loading (mcpServers format)
- LocalServerManager (spawn, health, restart)
- StdioJsonRpc (JSON-RPC over stdio pipes)
- ServerProcess (lifecycle state machine)
- SmartRouter (native + child routing)
- UnifiedRegistry (merge tool lists)
- Auto-logging to memory audit

### Phase 2: Recursive + Meta-tools
- Recursive orchestration support (`--depth` tracking)
- Cycle/depth detection
- Timeout propagation across hops
- find_tools, execute_dynamic_tool, toggle_tool, reset_tools, manage_auto_approve
- Config hot-reload (FileWatcher on config file)

### Phase 3: Polish
- Metrics collection per tool
- orchestration_status meta-tool
- Process tree visualization
- Performance optimization
- Documentation + examples
