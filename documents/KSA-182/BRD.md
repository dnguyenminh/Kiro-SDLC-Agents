# Business Requirements Document (BRD)

## Code Intelligence MCP — KSA-182: [Bug] httpStream Transport Not Supported for Upstream MCP Servers

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-182 |
| Title | [Bug] httpStream Transport Not Supported for Upstream MCP Servers |
| Author | BA Agent (SM-delegated) |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Draft |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-14 | SM Agent | Initiate document — bug report from user observation |

---

## 1. Introduction

### 1.1 Scope

The MCP orchestration engine in all 3 implementations (Node.js extension, Kotlin server, Python server) currently only supports **stdio** transport for connecting to upstream/child MCP servers. When a server is configured with `transportType: "httpStream"` and a `url` field (instead of `command`/`args`), the orchestrator fails to connect — resulting in `state: FAILED, toolCount: 0`.

This bug blocks integration with any MCP server that exposes an HTTP Streamable endpoint (e.g., Atlassian MCP server at `http://localhost:3001/mcp`).

**Fix scope:**
1. **Config parser** — recognize `transportType: "httpStream"` and `url` fields
2. **Server process abstraction** — introduce transport strategy (stdio vs httpStream)
3. **httpStream client** — implement HTTP-based MCP JSON-RPC client (POST requests, SSE responses)
4. **All 3 implementations** — Node.js, Kotlin, Python must have feature parity

### 1.2 Out of Scope

- WebSocket transport (future consideration)
- Server-side httpStream hosting (already implemented in `http-entry.js`)
- Authentication/OAuth for upstream httpStream servers (future ticket)
- Load balancing or failover between multiple httpStream endpoints

### 1.3 Preliminary Requirement

- MCP protocol spec 2024-11-05 (HTTP Streamable transport section)
- Existing orchestration engine architecture (LocalServerManager, ServerProcess, StdioJsonRpc)
- Understanding of JSON-RPC 2.0 over HTTP

---

## 2. Business Requirements

### 2.1 High Level Process Map

Currently, the orchestration engine:
1. Reads `orchestration.json` — parses server entries
2. For each enabled server — spawns a child process (stdio)
3. Sends JSON-RPC over stdin/stdout pipes
4. Registers discovered tools in the routing table

**After fix**, the engine must:
1. Reads `orchestration.json` — parses server entries
2. **Detect transport type** from config (`command` = stdio, `url` + `transportType: "httpStream"` = httpStream)
3. For stdio servers — spawn process (existing behavior)
4. **For httpStream servers — connect via HTTP POST to the configured URL**
5. Sends JSON-RPC over the appropriate transport
6. Registers discovered tools in the routing table (same as before)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source |
|---|------------------|----------|--------|
| 1 | As a developer, I want to configure upstream MCP servers with httpStream transport so that I can connect to HTTP-based MCP servers (e.g., Atlassian) | MUST HAVE | KSA-182 |
| 2 | As a developer, I want the orchestrator to auto-detect transport type from config so that I don't need to change existing stdio configs | MUST HAVE | KSA-182 |
| 3 | As a developer, I want httpStream servers to support health checks so that the orchestrator can detect and recover from failures | SHOULD HAVE | KSA-182 |
| 4 | As a developer, I want all 3 MCP implementations to have httpStream parity so that any implementation can orchestrate httpStream servers | MUST HAVE | KSA-142 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** User configures an upstream MCP server in `orchestration.json` with `url` and `transportType: "httpStream"`

**Step 2:** Orchestration engine starts — reads config — detects httpStream transport type

**Step 3:** Engine creates an HttpStreamTransport client (instead of spawning a process)

**Step 4:** Engine sends `initialize` request via HTTP POST to the configured URL

**Step 5:** Engine sends `tools/list` request to discover available tools

**Step 6:** Tools are registered in the routing table (same as stdio servers)

**Step 7:** When a tool is called, the engine routes the request via HTTP POST to the upstream server

**Step 8:** Health checks are performed via HTTP POST to verify server availability

---

#### STORY 1: Configure httpStream Upstream Server

> As a developer, I want to configure upstream MCP servers with httpStream transport so that I can connect to HTTP-based MCP servers.

**Requirement Details:**

1. Config parser must recognize `url` field as indicator of httpStream transport
2. Config parser must recognize `transportType: "httpStream"` as explicit transport declaration
3. If `url` is present but `command` is absent — use httpStream transport
4. If both `url` and `command` are present — `transportType` field determines which to use (default: httpStream if `url` present)

**Config Format (httpStream server):**

```json
{
  "atlassian": {
    "url": "http://localhost:3001/mcp",
    "transportType": "httpStream",
    "disabled": false,
    "timeout": 30000,
    "autoApprove": ["jira_get_issue", "jira_search"]
  }
}
```

**Config Format (stdio server — unchanged):**

```json
{
  "chrome-devtools-mcp": {
    "command": "npx",
    "args": ["chrome-devtools-mcp"],
    "autoApprove": ["navigate_page"]
  }
}
```

**Acceptance Criteria:**

1. Server with `url` + `transportType: "httpStream"` connects successfully via HTTP
2. Server with `command` + `args` continues to work via stdio (no regression)
3. Server with `url` but no `transportType` defaults to httpStream
4. Server with invalid `url` (unreachable) — state = FAILED with clear error message
5. `disabled: true` servers are skipped regardless of transport type

---

#### STORY 2: Auto-Detect Transport Type

> As a developer, I want the orchestrator to auto-detect transport type from config so that I don't need to change existing stdio configs.

**Requirement Details:**

1. Detection logic:
   - Has `command` field — stdio transport
   - Has `url` field (no `command`) — httpStream transport
   - Has both — use `transportType` field to decide (default: httpStream)
2. No changes required to existing stdio server configs
3. Error if neither `command` nor `url` is present — log warning, skip server

**Acceptance Criteria:**

1. All existing stdio configs work without modification
2. New httpStream configs work with just `url` field
3. Invalid config (no command, no url) — graceful skip with warning log

---

#### STORY 3: httpStream Health Checks

> As a developer, I want httpStream servers to support health checks so that the orchestrator can detect and recover from failures.

**Requirement Details:**

1. Health check for httpStream: send `tools/list` via HTTP POST, expect 200 response within 5s
2. If health check fails — mark server as FAILED
3. Periodic health check interval same as stdio servers (configurable via `healthCheckIntervalMs`)
4. Recovery: when health check succeeds after failure — re-fetch tools, mark ACTIVE

**Acceptance Criteria:**

1. httpStream server that goes down — detected within healthCheckIntervalMs
2. httpStream server that comes back up — auto-recovered
3. Health check timeout configurable (default 5s)

---

#### STORY 4: Feature Parity Across 3 Implementations

> As a developer, I want all 3 MCP implementations to have httpStream parity so that any implementation can orchestrate httpStream servers.

**Requirement Details:**

1. Node.js (`kiro-sdlc-agents/mcp-server/orchestration/local/`) — add HttpStreamProcess
2. Kotlin (`mcp-code-intelligence-kotlin/src/main/kotlin/com/codeintel/orchestration/local/`) — add HttpStreamProcess
3. Python (`mcp-code-intelligence-python/src/mcp_code_intel/orchestration/local/`) — add HttpStreamProcess
4. All implementations must pass the same integration test scenarios

**Acceptance Criteria:**

1. Node.js implementation connects to httpStream server successfully
2. Kotlin implementation connects to httpStream server successfully
3. Python implementation connects to httpStream server successfully
4. All 3 implementations handle the same error scenarios identically

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| MCP Protocol Spec | External | N/A | HTTP Streamable transport specification (2024-11-05) |
| Atlassian MCP Server | External | N/A | Test target — httpStream server at localhost:3001 |
| KSA-142 | Internal | KSA-142 | Feature Parity Sync across 3 implementations |
| KSA-12 | Internal | KSA-12 | Extension architecture (orchestrator source) |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Developer | Dev Team | Implement httpStream transport in all 3 servers |
| QA | QA Team | Verify httpStream connectivity and feature parity |
| User | Extension Users | Report bug, validate fix |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| HTTP connection instability (network issues) | Medium | Medium | Implement retry with exponential backoff |
| SSE stream parsing complexity | Medium | Low | Use well-tested HTTP client libraries |
| Breaking existing stdio configs | High | Low | Auto-detection logic preserves backward compatibility |
| Performance overhead of HTTP vs stdio | Low | Medium | HTTP keep-alive, connection pooling |

### 5.2 Assumptions

- Upstream httpStream servers implement MCP protocol spec 2024-11-05 correctly
- HTTP POST is used for requests, responses are JSON (not SSE streaming for tool calls)
- No authentication required for localhost httpStream servers (auth is future scope)
- All 3 implementations have access to HTTP client libraries (fetch/ktor/aiohttp)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | HTTP request latency < 100ms for localhost | Same-machine communication should be fast |
| Reliability | Auto-recovery within 30s of server restart | Health check interval = 30s default |
| Compatibility | No regression on existing stdio servers | All existing configs must continue working |
| Maintainability | Transport abstraction (Strategy pattern) | Easy to add new transport types in future |

---

## 7. Related Tickets

| Ticket Key | Summary | Type | Relationship |
|------------|---------|------|--------------|
| KSA-182 | [Bug] httpStream transport not supported | Bug | Main ticket |
| KSA-142 | Feature Parity Sync (3 MCP implementations) | Story | Related — parity requirement |
| KSA-12 | Extension architecture | Story | Related — extension source |

---

## 8. Appendix

### Root Cause Analysis

**Current code flow (Node.js `process.js`):**
```javascript
spawnProcess() {
    return spawn(this.entry.command, this.entry.args, { stdio: ['pipe', 'pipe', 'pipe'] });
}
```

**Problem:** When `entry.command` is undefined (httpStream server has `url` instead), `spawn(undefined, ...)` fails — FAILED state.

**Current config parser (`config.js`):**
```javascript
servers[name] = {
    command: e.command,      // only extracts stdio fields
    args: e.args ?? [],
    env: e.env ?? {},
    // MISSING: url, transportType fields are IGNORED
};
```

### MCP HTTP Streamable Protocol

Per MCP spec 2024-11-05, HTTP Streamable transport:
- Client sends JSON-RPC request via `POST {url}`
- Content-Type: `application/json`
- Server responds with JSON-RPC response (Content-Type: `application/json`)
- For notifications/streaming: Server-Sent Events (SSE) on same endpoint
- Session management via `Mcp-Session-Id` header (optional)

### Glossary

| Term | Definition |
|------|------------|
| httpStream | MCP transport type using HTTP POST for requests and SSE for server-initiated messages |
| stdio | MCP transport type using stdin/stdout pipes of a child process |
| Orchestrator | The MCP server that manages and routes calls to multiple child MCP servers |
| Upstream server | A child MCP server that the orchestrator connects to |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow — Transport Selection | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case — httpStream Integration | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
