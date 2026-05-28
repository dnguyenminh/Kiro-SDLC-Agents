# Functional Specification Document (FSD)

## Code Intelligence MCP — KSA-182: httpStream Transport Support

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-182 |
| Title | [Bug] httpStream Transport Not Supported |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-182.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-14 | BA + TA | Initial FSD with technical enrichment |

---

## 1. Introduction

### 1.1 Purpose

Specifies functional behavior for httpStream transport support in the MCP orchestration engine across Node.js, Kotlin, and Python.

### 1.2 Scope

- Config parser: recognize `url` + `transportType` fields
- Transport abstraction (Strategy pattern)
- HttpStream client (HTTP POST + SSE responses)
- Health checks for HTTP-based servers
- Feature parity across 3 implementations

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| httpStream | MCP transport: HTTP POST requests, SSE server push |
| stdio | MCP transport: stdin/stdout pipes |
| SSE | Server-Sent Events |
| JSON-RPC | JSON Remote Procedure Call (MCP wire format) |
| Mcp-Session-Id | Optional session header for httpStream |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-182.docx |
| MCP Spec 2024-11-05 | spec.modelcontextprotocol.io |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

**Actors:**
- **IDE Extension** — sends tool call requests to orchestrator
- **Orchestrator** — routes requests to appropriate child server
- **Stdio Child Server** — connected via stdin/stdout pipes (existing)
- **httpStream Child Server** — connected via HTTP POST (new)

### 2.2 Current Architecture (Before Fix)

```
orchestration.json → ConfigParser → ServerEntry(command, args)
                                         ↓
                              LocalServerManager.startAll()
                                         ↓
                              ServerProcess.spawnProcess()  ← ONLY stdio
                                         ↓
                              StdioJsonRpc.attach(process)
```

### 2.3 Target Architecture (After Fix)

```
orchestration.json → ConfigParser → ServerEntry(command?, url?, transportType?)
                                         ↓
                              LocalServerManager.startAll()
                                         ↓
                         ┌─── TransportDetector.detect(entry) ───┐
                         ↓                                       ↓
              StdioServerProcess                      HttpStreamServerProcess
              (spawn + StdioJsonRpc)                  (HTTP POST + HttpJsonRpc)
```

---

## 3. Functional Requirements

### 3.1 Feature: Config Parser Extension

**Source:** BRD Story 1, Story 2

#### 3.1.1 Description

The config parser must recognize httpStream server entries alongside existing stdio entries. Transport type is determined by field presence and explicit `transportType` declaration.

#### 3.1.2 Use Case

**Use Case ID:** UC-01
**Actor:** Orchestration Engine (startup)
**Preconditions:** `orchestration.json` exists with server entries
**Postconditions:** Each server entry has a resolved transport type

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | ConfigParser | Read orchestration.json |
| 2 | | ConfigParser | For each server entry, detect transport type |
| 3 | | ConfigParser | Create ServerEntry with transport metadata |
| 4 | | LocalServerManager | Receive parsed entries |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Entry has both `command` and `url` | Use `transportType` field; default httpStream |
| AF-02 | Entry has `url` without explicit `transportType` | Default to httpStream |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Entry has neither `command` nor `url` | Log warning, skip server |
| EF-02 | `url` is malformed | Log error, mark invalid, skip |

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-01 | `url` field present → httpStream transport | BRD Story 1 |
| BR-02 | `command` field present → stdio transport | BRD Story 2 |
| BR-03 | Both present → `transportType` decides (default: httpStream) | BRD Story 2 |
| BR-04 | Neither present → skip with warning | BRD Story 2 |
| BR-05 | `disabled: true` → skip regardless of transport | BRD Story 1 |
| BR-06 | Existing stdio configs must work without modification | BRD Story 2 |

#### 3.1.4 Data Specifications

**Input Data — httpStream Server Entry:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| url | string | Yes (for httpStream) | Valid URL (http/https) | Endpoint URL |
| transportType | string | No | "httpStream" or "stdio" | Explicit transport type |
| disabled | boolean | No | — | Default: false |
| timeout | number | No | > 0 | Request timeout ms. Default: 30000 |
| autoApprove | string[] | No | — | Auto-approved tools |

**Input Data — stdio Server Entry (unchanged):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| command | string | Yes (for stdio) | Non-empty | Executable command |
| args | string[] | No | — | Command arguments |
| env | object | No | — | Environment variables |
| disabled | boolean | No | — | Default: false |
| timeout | number | No | > 0 | Default: 30000 |
| autoApprove | string[] | No | — | Auto-approved tools |

#### 3.1.5 Transport Detection Pseudocode

```
function detectTransport(entry):
    if entry.url AND NOT entry.command:
        return HTTP_STREAM
    if entry.command AND NOT entry.url:
        return STDIO
    if entry.url AND entry.command:
        return entry.transportType == "stdio" ? STDIO : HTTP_STREAM
    log.warn("No command or url — skipping")
    return INVALID
```

#### 3.1.6 API Contract (Functional View)

> Config parsing is internal — no external API. See §3.2 for httpStream wire protocol.

---

### 3.2 Feature: httpStream Transport Client

**Source:** BRD Story 1, Story 3

#### 3.2.1 Description

HTTP-based JSON-RPC client for upstream MCP servers. Sends requests via HTTP POST, receives JSON responses or SSE streams.

#### 3.2.2 Use Case

**Use Case ID:** UC-02
**Actor:** Orchestration Engine
**Preconditions:** Server entry has `url`, server is reachable
**Postconditions:** Server is ACTIVE with tools registered

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | HttpStreamProcess | Validate URL reachable |
| 2 | | HttpStreamProcess | Send `initialize` via HTTP POST |
| 3 | | HttpStreamProcess | Receive response, extract session ID |
| 4 | | HttpStreamProcess | Send `notifications/initialized` |
| 5 | | HttpStreamProcess | Send `tools/list` request |
| 6 | | HttpStreamProcess | Parse tools from response |
| 7 | | HttpStreamProcess | Mark state = ACTIVE |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Server returns Mcp-Session-Id | Store and include in subsequent requests |
| AF-02 | No session ID returned | Continue without session header |
| AF-03 | Empty tools list | Mark ACTIVE with 0 tools (valid) |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Connection refused | Mark FAILED, log error with URL |
| EF-02 | HTTP timeout | Mark FAILED, log timeout |
| EF-03 | HTTP 4xx | Mark FAILED, log status + body |
| EF-04 | HTTP 5xx | Mark FAILED, eligible for retry |
| EF-05 | Invalid JSON | Mark FAILED, log parse error |
| EF-06 | JSON-RPC error | Mark FAILED, log error code |

#### 3.2.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-07 | HTTP POST to `url` with Content-Type: application/json | MCP Spec |
| BR-08 | Accept: application/json, text/event-stream | MCP Spec |
| BR-09 | Include Mcp-Session-Id if server provided one | MCP Spec |
| BR-10 | JSON-RPC 2.0 envelope: jsonrpc, id, method, params | MCP Spec |
| BR-11 | Timeout per request = entry.timeout (default 30s) | BRD NFR |
| BR-12 | No process spawning for httpStream servers | BRD Story 1 |

#### 3.2.4 HTTP Wire Protocol

**Request Format:**

```http
POST {url} HTTP/1.1
Content-Type: application/json
Accept: application/json, text/event-stream
Mcp-Session-Id: {sessionId}

{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_get_issue","arguments":{"issue_key":"KSA-1"}}}
```

**Response Format (synchronous JSON):**

```http
HTTP/1.1 200 OK
Content-Type: application/json
Mcp-Session-Id: {sessionId}

{"jsonrpc":"2.0","id":1,"result":{...}}
```

**Response Format (SSE streaming):**

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream

event: message
data: {"jsonrpc":"2.0","id":1,"result":{...}}
```

#### 3.2.5 API Contract — httpStream JSON-RPC

**Endpoint:** `POST {configured_url}`
**Purpose:** Send MCP JSON-RPC request to upstream server

**Input Parameters:**

| Parameter | Type | Required | Rule | Description |
|-----------|------|----------|------|-------------|
| method | string | Yes | BR-10 | JSON-RPC method |
| params | object | No | BR-10 | Method parameters |
| id | number | Yes | BR-10 | Correlation ID |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| result | any | Success payload |
| error | object | Error code + message |

**Error Scenarios:**

| Scenario | Message | Trigger |
|----------|---------|---------|
| Unreachable | "httpStream server at {url} not reachable" | Connection refused |
| Auth required | "Server requires authentication (401)" | 401 response |
| Server error | "Server error: {message}" | 5xx or JSON-RPC error |

---

### 3.3 Feature: Health Check for httpStream Servers

**Source:** BRD Story 3

#### 3.3.1 Description

Health monitoring for httpStream servers uses HTTP POST `tools/list` as ping, replacing process-alive check used for stdio.

#### 3.3.2 Use Case

**Use Case ID:** UC-03
**Actor:** Health Monitor (background timer)
**Preconditions:** httpStream server in ACTIVE state
**Postconditions:** Server state updated based on health result

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | HealthMonitor | Timer fires (healthCheckIntervalMs) |
| 2 | | HealthMonitor | HTTP POST `tools/list` to server URL |
| 3 | | HealthMonitor | Receive 200 within 5s |
| 4 | | HealthMonitor | Server remains ACTIVE |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Was FAILED, now succeeds | Re-initialize, fetch tools, mark ACTIVE |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Timeout (>5s) | Mark CRASHED, attempt restart |
| EF-02 | Connection refused | Mark CRASHED, attempt restart |
| EF-03 | Max retries exceeded | Mark DEAD |

#### 3.3.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-13 | Health = POST `tools/list`, expect 200 in 5s | BRD Story 3 |
| BR-14 | Interval = healthCheckIntervalMs (default 30s) | BRD NFR |
| BR-15 | Recovery: success after failure → re-fetch tools | BRD Story 3 |
| BR-16 | No `isAlive()` for httpStream (no OS process) | Design |
| BR-17 | Max retries same as stdio | Design |

#### 3.3.4 Health Check Pseudocode

```
function healthCheck(server):
    if server.transport == HTTP_STREAM:
        try:
            response = httpPost(server.url, toolsListReq, timeout=5s)
            return response.status == 200 ? HEALTHY : UNHEALTHY
        catch:
            return UNHEALTHY
    else:  // stdio
        return process.isAlive() AND rpc.ping() ? HEALTHY : UNHEALTHY
```

---

### 3.4 Feature: Tool Call Routing via httpStream

**Source:** BRD Story 1

#### 3.4.1 Use Case

**Use Case ID:** UC-04
**Actor:** IDE Extension (via orchestrator)
**Preconditions:** httpStream server ACTIVE, tool registered
**Postconditions:** Tool result returned to caller

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Extension | | Sends `tools/call` to orchestrator |
| 2 | | RoutingTable | Find server owning tool |
| 3 | | HttpStreamProcess | HTTP POST to upstream |
| 4 | | HttpStreamProcess | Parse JSON response |
| 5 | | Orchestrator | Return result to extension |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Server unreachable mid-call | Return error, trigger health check |
| EF-02 | Timeout | Return timeout error |
| EF-03 | JSON-RPC error | Forward error to caller |

#### 3.4.2 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-18 | Routing is transport-agnostic | Design |
| BR-19 | Caller unaware of transport type | Design |
| BR-20 | Timeout = entry.timeout | BRD NFR |

---

### 3.5 Feature: Feature Parity (3 Implementations)

**Source:** BRD Story 4

#### 3.5.1 Implementation Matrix

| Component | Node.js | Kotlin | Python |
|-----------|---------|--------|--------|
| Config | `config.ts` | `OrchestrationConfig.kt` | `config.py` |
| Transport interface | new | new | new |
| httpStream impl | `HttpStreamProcess` | `HttpStreamProcess` | `HttpStreamProcess` |
| HTTP client | `fetch` | `java.net.http` | `aiohttp` |
| Manager | Updated | Updated | Updated |

#### 3.5.2 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-21 | Same config format across all 3 | BRD Story 4 |
| BR-22 | Same state machine | BRD Story 4 |
| BR-23 | Same error handling | BRD Story 4 |
| BR-24 | Same health check logic | BRD Story 4 |

---

## 4. Data Model

### 4.1 Logical Entities

#### Entity: ServerEntry (Extended)

| Attribute | Type | Required | Rule | Description |
|-----------|------|----------|------|-------------|
| command | string | Conditional | BR-02 | Stdio command |
| args | string[] | No | — | Command arguments |
| url | string | Conditional | BR-01 | httpStream endpoint |
| transportType | enum | No | BR-03 | STDIO / HTTP_STREAM |
| env | map | No | — | Environment vars |
| disabled | boolean | No | BR-05 | Skip flag |
| timeout | long | No | BR-11 | Timeout ms |
| autoApprove | string[] | No | — | Auto-approved tools |

#### Entity: ServerState (Unchanged)

STARTING → READY → ACTIVE → CRASHED → RESTARTING → DEAD / FAILED

#### Entity: HttpSession (New)

| Attribute | Type | Description |
|-----------|------|-------------|
| sessionId | string? | Mcp-Session-Id from server |
| url | string | Server endpoint |
| lastRequestId | int | Auto-incrementing ID |
| connected | boolean | Initialize succeeded |

---

## 5. Integration Specifications

### 5.1 Upstream httpStream MCP Server

| Attribute | Value |
|-----------|-------|
| Purpose | Provide tools via HTTP MCP protocol |
| Direction | Outbound (orchestrator → upstream) |
| Format | JSON-RPC 2.0 over HTTP |
| Frequency | On-demand + periodic health |

**Data Exchange:**

| Our Data | External | Direction | Rule |
|----------|----------|-----------|------|
| JSON-RPC request | — | Send | BR-07 |
| — | JSON-RPC response | Receive | BR-08 |
| — | Mcp-Session-Id | Receive | BR-09 |
| Mcp-Session-Id | — | Send | BR-09 |

---

## 6. Processing Logic

### 6.1 Server Startup Process

**Trigger:** Engine starts or config hot-reload

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Parse config, detect transport | Skip invalid entries |
| 2 | STDIO: spawn process, attach RPC | Mark FAILED |
| 3 | HTTP_STREAM: create HTTP client | Mark FAILED on bad URL |
| 4 | Send `initialize` handshake | Mark FAILED on timeout |
| 5 | Send `tools/list` | Mark FAILED on error |
| 6 | Register tools in routing table | — |
| 7 | Start health monitor | — |

### 6.2 httpStream Request/Response Pseudocode

```
function sendRequest(method, params, timeoutMs):
    id = nextId++
    body = {jsonrpc:"2.0", id, method, params}
    headers = {"Content-Type":"application/json",
               "Accept":"application/json, text/event-stream"}
    if sessionId: headers["Mcp-Session-Id"] = sessionId
    response = httpPost(url, body, headers, timeout=timeoutMs)
    if response.header("Mcp-Session-Id"):
        sessionId = response.header("Mcp-Session-Id")
    if response.contentType startsWith "text/event-stream":
        return parseSSE(response.body)
    return parseJson(response.body).result
```

### 6.3 Restart Logic (httpStream)

```
function restart(maxRetries):
    if retryCount >= maxRetries: state=DEAD; return false
    retryCount++; sleep(min(1000*retryCount, 10000))
    return initialize() AND fetchTools()  // no process kill
```

### 6.4 State Diagram

![State Diagram](diagrams/state-httpstream.png)

httpStream differences from stdio:
- No `isAlive()` (no OS process)
- Restart = re-initialize HTTP (no spawn)
- Stop = close HTTP client (no kill)

---

## 7. Security Requirements

### 7.1 Authentication

| Aspect | Requirement |
|--------|-------------|
| Localhost | No auth (current scope) |
| Remote | Future — OAuth/token |
| Session | Mcp-Session-Id (server-provided) |

### 7.2 Data Sensitivity

| Data | Classification | Note |
|------|---------------|------|
| Tool args | Internal | Truncated in logs |
| URLs | Internal | May have ports |
| Session IDs | Confidential | Not logged |

---

## 8. Non-Functional Requirements

| Category | Requirement | Criteria |
|----------|-------------|----------|
| Performance | HTTP < 100ms localhost | Health check timing |
| Reliability | Recovery within 30s | healthCheckIntervalMs |
| Compatibility | No stdio regression | Existing configs unchanged |
| Maintainability | Strategy pattern | New transports without modifying existing |
| Startup | Connect < 5s | Initialize + tools/list |

---

## 9. Error Handling

### 9.1 Error Scenarios

| Scenario | Severity | Message | Recovery |
|----------|----------|---------|----------|
| Unreachable | Warning | "[name] not reachable at {url}" | Auto-retry |
| Init timeout | Warning | "[name] handshake timed out" | Retry |
| Call timeout | Error | "[name] tool call timed out" | Error to caller |
| Invalid JSON | Error | "[name] invalid response" | Mark FAILED |
| Server error | Info | "[name] error: {msg}" | Forward |

### 9.2 Logging

| Event | Level | Content |
|-------|-------|---------|
| Starting | INFO | "Starting httpStream to {url}" |
| Active | INFO | "Active with {N} tools" |
| Health fail | WARN | "Health check failed" |
| Restart | INFO | "Restarting (N/max)" |
| Dead | ERROR | "Dead after {max} retries" |

---

## 10. Testing Considerations

| ID | Scenario | Expected | Priority |
|----|----------|----------|----------|
| TC-01 | httpStream connects | ACTIVE, tools fetched | High |
| TC-02 | stdio unchanged | Works as before | High |
| TC-03 | Auto-detect (url only) | HTTP_STREAM | High |
| TC-04 | Auto-detect (command only) | STDIO | High |
| TC-05 | Both fields + explicit type | Uses declared | Medium |
| TC-06 | Invalid URL | FAILED | High |
| TC-07 | Server unreachable | FAILED | High |
| TC-08 | Health recovery | Auto-recovers | High |
| TC-09 | Tool call via HTTP | Returns result | High |
| TC-10 | Timeout | Error returned | Medium |
| TC-11 | Session ID | Included in requests | Medium |
| TC-12 | Disabled httpStream | Skipped | Low |
| TC-13 | No command no url | Warning, skipped | Low |
| TC-14 | Parity Node.js | Same behavior | High |
| TC-15 | Parity Kotlin | Same behavior | High |
| TC-16 | Parity Python | Same behavior | High |

---

## 11. Appendix

### 11.1 Config Examples

**httpStream:**
```json
{"atlassian":{"url":"http://localhost:3001/mcp","transportType":"httpStream","autoApprove":["jira_get_issue"]}}
```

**stdio (unchanged):**
```json
{"chrome-devtools":{"command":"npx","args":["chrome-devtools-mcp"]}}
```

### 11.2 Files to Modify

| Impl | File | Change |
|------|------|--------|
| Node.js | config.ts | Add url, transportType |
| Node.js | local/process.ts | Extract interface |
| Node.js | local/http-stream-process.ts | NEW |
| Node.js | local/http-json-rpc.ts | NEW |
| Kotlin | OrchestrationConfig.kt | Add url, transportType |
| Kotlin | local/ServerProcess.kt | Extract interface |
| Kotlin | local/HttpStreamProcess.kt | NEW |
| Kotlin | local/HttpJsonRpc.kt | NEW |
| Kotlin | local/LocalServerManager.kt | Transport detection |
| Python | config.py | Add url, transport_type |
| Python | local/process.py | Extract base class |
| Python | local/http_stream_process.py | NEW |
| Python | local/http_json_rpc.py | NEW |

### 11.3 Diagram Index

| # | Diagram | Image | Source |
|---|---------|-------|--------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence Init | [sequence-init.png](diagrams/sequence-init.png) | [sequence-init.drawio](diagrams/sequence-init.drawio) |
| 3 | State httpStream | [state-httpstream.png](diagrams/state-httpstream.png) | [state-httpstream.drawio](diagrams/state-httpstream.drawio) |

### 11.4 Open Issues

| # | Issue | Decision Needed |
|---|-------|-----------------|
| 1 | SSE for long-running tools | Support in v1? |
| 2 | Connection pooling | HTTP client config |
| 3 | Auth for remote servers | Defer to future ticket |
