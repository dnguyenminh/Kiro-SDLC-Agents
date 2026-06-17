# Software Test Cases (STC)

## Code Intelligence Extension — KSA-284: Split Extension: Lightweight Proxy + Backend MCP Server

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-284 |
| Title | Split Extension: Lightweight Proxy + Backend MCP Server |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-07-11 |
| Status | Draft |
| Related STP | STP-v1-KSA-284.docx |
| Related FSD | FSD-v1-KSA-284.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-11 | QA Agent | Initiate document — auto-generated from FSD use cases and business rules |

---

## Test Case Summary

| Level | ID Prefix | Count | Automated |
|-------|-----------|-------|-----------|
| PBT (Property-Based) | PBT-01..PBT-08 | 8 | All |
| UT (Unit) | UT-01..UT-18 | 18 | All |
| IT (Integration) | IT-01..IT-15 | 15 | All |
| E2E-API | E2E-API-01..E2E-API-12 | 12 | All |
| E2E-UI | E2E-UI-01..E2E-UI-08 | 8 | All |
| SIT (Manual) | SIT-01..SIT-06 | 6 | Manual |
| **Total** | | **67** | **61 (91%)** |

---

## 1. Property-Based Tests (PBT)

### PBT-01: Proxy Transparency - Any Valid Tool Call Returns Identical Response

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-01 |
| **Priority** | High |
| **Type** | Automated (vitest + fast-check) |
| **Requirement** | BR-7, BR-9 |
| **Property** | For any tool_name in tool-list.txt and any valid arguments, proxy(tool_name, args) === direct_backend(tool_name, args) |

**Generator:** Random tool name from 52-tool list x random valid arguments matching tool schema
**Runs:** 200 iterations

---

### PBT-02: Proxy Latency - Overhead Always Below 50ms

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-02 |
| **Priority** | High |
| **Type** | Automated (vitest + fast-check) |
| **Requirement** | BR-8 |
| **Property** | For any tool call, (proxy_response_time - direct_response_time) < 50ms |

**Generator:** Random tool call with random arguments
**Runs:** 100 iterations

---

### PBT-03: Exponential Backoff - Delay Never Exceeds 30s

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-03 |
| **Priority** | High |
| **Type** | Automated (vitest + fast-check) |
| **Requirement** | BR-17 |
| **Property** | For any N attempts (1..200), delay(N) <= 30000ms AND delay(N) = min(1000 * 2^(N-1), 30000) |

**Generator:** Random attempt count 1..200
**Runs:** 200 iterations

---

### PBT-04: Configuration Validation - Port Always 1024-65535

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-04 |
| **Priority** | Medium |
| **Type** | Automated (vitest + fast-check) |
| **Requirement** | BR-4, TDD S7.4 |
| **Property** | For any random integer, validatePort(n) returns true IFF 1024 <= n <= 65535 |

**Generator:** Random integer -100000..100000
**Runs:** 500 iterations

---

### PBT-05: Tool Name Validation - Only Registered Names Accepted

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-05 |
| **Priority** | High |
| **Type** | Automated (vitest + fast-check) |
| **Requirement** | BR-6, BR-10 |
| **Property** | For any string S, callTool(S) returns TOOL_NOT_FOUND error IFF S not in 52 tool names |

**Generator:** Random alphanumeric strings + random tool names from registry
**Runs:** 300 iterations

---

### PBT-06: JSON Response Validation - Backend Response Always Valid JSON

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-06 |
| **Priority** | Medium |
| **Type** | Automated (vitest + fast-check) |
| **Requirement** | BR-38 |
| **Property** | For any tool call that succeeds, JSON.parse(response.body) does NOT throw |

**Generator:** All 52 tools with various argument combinations
**Runs:** 100 iterations

---

### PBT-07: Connection State Machine - All Transitions Valid

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-07 |
| **Priority** | High |
| **Type** | Automated (vitest + fast-check) |
| **Requirement** | BR-15, TDD S5.5 |
| **Property** | For any sequence of events, resulting state is always valid with valid transitions only |

**Generator:** Random event sequences (health_ok, health_fail, spawn, timeout) of length 1..50
**Runs:** 200 iterations

---

### PBT-08: Health Check Interval - Always Within Configured Range

| Attribute | Value |
|-----------|-------|
| **ID** | PBT-08 |
| **Priority** | Low |
| **Type** | Automated (vitest + fast-check) |
| **Requirement** | BR-13, FSD S3.1.4 |
| **Property** | For any healthInterval config value, validated range is 1000-60000ms |

**Generator:** Random integers 0..120000
**Runs:** 200 iterations


---

## 2. Unit Tests (UT)

### UT-01: ConnectionManager - Initial State is DISCONNECTED

| Attribute | Value |
|-----------|-------|
| **ID** | UT-01 |
| **Priority** | High |
| **Type** | Automated (vitest) |
| **Requirement** | UC-1, BR-15 |
| **Preconditions** | Fresh ConnectionManager instance |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create new ConnectionManager() | Instance created |
| 2 | Read state property | state === 'DISCONNECTED' |
| 3 | Read reconnectAttempts | reconnectAttempts === 0 |
| 4 | Read backendVersion | backendVersion === null |

---

### UT-02: ConnectionManager - Transitions to CONNECTED on Health Success

| Attribute | Value |
|-----------|-------|
| **ID** | UT-02 |
| **Priority** | High |
| **Type** | Automated (vitest) |
| **Requirement** | UC-1 Step 5-7, BR-15 |
| **Preconditions** | ConnectionManager in CONNECTING state |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock health response: {status: "healthy", version: "1.0.0", tools_loaded: 52} | - |
| 2 | Trigger health check | - |
| 3 | Read state | state === 'CONNECTED' |
| 4 | Read backendVersion | backendVersion === '1.0.0' |

---

### UT-03: ConnectionManager - Transitions to DISCONNECTED on Health Failure

| Attribute | Value |
|-----------|-------|
| **ID** | UT-03 |
| **Priority** | High |
| **Type** | Automated (vitest) |
| **Requirement** | UC-3, BR-13 |
| **Preconditions** | ConnectionManager in CONNECTED state |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock health response: ECONNREFUSED | - |
| 2 | Trigger health check | - |
| 3 | Read state | state === 'DISCONNECTED' |
| 4 | Verify reconnect timer started | reconnectDelay === 1000 |

---

### UT-04: ToolProxy - Register 52 Tools Successfully

| Attribute | Value |
|-----------|-------|
| **ID** | UT-04 |
| **Priority** | High |
| **Type** | Automated (vitest) |
| **Requirement** | BR-6, BR-11 |
| **Preconditions** | Mock IDE registerTool API, tool list loaded |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call registerTools(toolDefinitions) with 52 tools | - |
| 2 | Verify IDE registerTool called 52 times | callCount === 52 |
| 3 | Verify each tool has name, description, inputSchema | All present |
| 4 | Read getRegisteredTools().length | 52 |

---

### UT-05: ToolProxy - Forward Request to Backend

| Attribute | Value |
|-----------|-------|
| **ID** | UT-05 |
| **Priority** | High |
| **Type** | Automated (vitest) |
| **Requirement** | UC-2, BR-7 |
| **Preconditions** | Mock HttpClient, tools registered |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call callTool("mem_search", {query: "test"}) | - |
| 2 | Verify HttpClient.post called with correct body | {tool_name: "mem_search", arguments: {query: "test"}} |
| 3 | Mock response: {content: [{type:"text", text:"results"}], isError: false} | - |
| 4 | Verify return value matches mock response exactly | Identical |

---

### UT-06: ToolProxy - Return Error When Backend Disconnected

| Attribute | Value |
|-----------|-------|
| **ID** | UT-06 |
| **Priority** | High |
| **Type** | Automated (vitest) |
| **Requirement** | UC-2 EF-1, BR-5 |
| **Preconditions** | ConnectionState = DISCONNECTED |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call callTool("mem_search", {query: "test"}) | - |
| 2 | Verify error returned: "Backend is not connected" | isError: true |
| 3 | Verify NO HTTP request was made | HttpClient.post NOT called |

---

### UT-07: ToolProxy - Forward Error Response As-Is (No Wrapping)

| Attribute | Value |
|-----------|-------|
| **ID** | UT-07 |
| **Priority** | High |
| **Type** | Automated (vitest) |
| **Requirement** | BR-9 |
| **Preconditions** | Backend returns tool error |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock Backend returns {content: [{type:"text", text:"Entry not found"}], isError: true} | - |
| 2 | Call callTool("mem_crud", {action:"get", id:"x"}) | - |
| 3 | Verify return matches Backend response exactly (no wrapping) | Identical |

---

### UT-08: HealthChecker - Poll at Configured Interval

| Attribute | Value |
|-----------|-------|
| **ID** | UT-08 |
| **Priority** | Medium |
| **Type** | Automated (vitest) |
| **Requirement** | BR-13 |
| **Preconditions** | HealthChecker configured with interval=5000ms |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start HealthChecker with fake timers | - |
| 2 | Advance timers by 5000ms | Health check fired once |
| 3 | Advance timers by 5000ms again | Health check fired twice |
| 4 | Verify GET /health called exactly 2 times | callCount === 2 |

---

### UT-09: HealthChecker - 3s Timeout on Health Request

| Attribute | Value |
|-----------|-------|
| **ID** | UT-09 |
| **Priority** | Medium |
| **Type** | Automated (vitest) |
| **Requirement** | TDD S6.1 |
| **Preconditions** | Mock HTTP that never responds |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger health check with never-resolving mock | - |
| 2 | Advance fake timers by 3000ms | - |
| 3 | Verify health check reported as failed (timeout) | Status: failed |

---

### UT-10: BackendProcess - Spawn Process Correctly

| Attribute | Value |
|-----------|-------|
| **ID** | UT-10 |
| **Priority** | High |
| **Type** | Automated (vitest) |
| **Requirement** | UC-1 AF-1, BR-4 |
| **Preconditions** | Mock child_process.spawn |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call BackendProcess.spawn(config) | - |
| 2 | Verify spawn called with correct path and args | Matches config.backendPath |
| 3 | Verify process event listeners attached (exit, error) | Events registered |
| 4 | Verify state transitions to STARTING | state === 'STARTING' |

---

### UT-11: BackendProcess - Detect Process Exit (Crash)

| Attribute | Value |
|-----------|-------|
| **ID** | UT-11 |
| **Priority** | High |
| **Type** | Automated (vitest) |
| **Requirement** | UC-3, BR-12 |
| **Preconditions** | Backend process running (mocked) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Emit 'exit' event on mock process with code=1 | - |
| 2 | Verify ConnectionManager notified | onProcessExit called |
| 3 | Verify state changes to DISCONNECTED | state === 'DISCONNECTED' |
| 4 | Verify reconnect loop started | reconnect timer scheduled |

---

### UT-12: HttpClient - Serialize Tool Call Request Correctly

| Attribute | Value |
|-----------|-------|
| **ID** | UT-12 |
| **Priority** | Medium |
| **Type** | Automated (vitest) |
| **Requirement** | UC-2 Step 2-3 |
| **Preconditions** | Mock fetch |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call HttpClient.callTool("mem_search", {query: "x", limit: 5}) | - |
| 2 | Verify URL: http://127.0.0.1:48721/mcp/tools/call | Correct URL |
| 3 | Verify method: POST, Content-Type: application/json | Headers correct |
| 4 | Verify body serialized correctly | JSON matches |

---

### UT-13: HttpClient - Handle 5-Minute Timeout

| Attribute | Value |
|-----------|-------|
| **ID** | UT-13 |
| **Priority** | Medium |
| **Type** | Automated (vitest) |
| **Requirement** | UC-2 AF-3, TDD S6.1 |
| **Preconditions** | Mock fetch with AbortController |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call HttpClient.callTool with never-resolving mock | - |
| 2 | Advance timers to 300000ms (5 min) | - |
| 3 | Verify AbortController.abort() called | Request aborted |
| 4 | Verify TIMEOUT error returned | Error code: TIMEOUT |

---

### UT-14: StatusBarManager - Display Correct State Icons

| Attribute | Value |
|-----------|-------|
| **ID** | UT-14 |
| **Priority** | Medium |
| **Type** | Automated (vitest) |
| **Requirement** | BR-15, BR-30 |
| **Preconditions** | Mock VS Code StatusBarItem |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | updateState({state: 'CONNECTED', backendVersion: '1.0.0'}) | Green, tooltip has v1.0.0 |
| 2 | updateState({state: 'DISCONNECTED'}) | Red, "Backend Offline" |
| 3 | updateState({state: 'CONNECTING'}) | Spinning, "Connecting..." |
| 4 | updateState({state: 'STARTING'}) | Loading, "Starting Backend..." |

---

### UT-15: ConfigurationManager - Read and Validate Settings

| Attribute | Value |
|-----------|-------|
| **ID** | UT-15 |
| **Priority** | Medium |
| **Type** | Automated (vitest) |
| **Requirement** | UC-1 Step 3, FSD S3.1.4 |
| **Preconditions** | Mock VS Code workspace.getConfiguration |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock config: {backendPort: 48721, autoStart: true} | - |
| 2 | Call ConfigurationManager.load() | Config returned |
| 3 | Verify port=48721, autoStart=true | Values correct |
| 4 | Mock config: {backendPort: 999} | Throws validation error |

---

### UT-16: ToolRouter - Route Tool to Correct Module

| Attribute | Value |
|-----------|-------|
| **ID** | UT-16 |
| **Priority** | High |
| **Type** | Automated (vitest) |
| **Requirement** | TDD S5.2 ToolRouter |
| **Preconditions** | ToolRouter with registered modules |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Register MemoryModule with ["mem_search", "mem_ingest"] | - |
| 2 | Call route("mem_search", {query: "test"}) | MemoryModule handler invoked |
| 3 | Call route("code_search", {query: "fn"}) | CodeIntelModule handler invoked |
| 4 | Call route("nonexistent_tool", {}) | TOOL_NOT_FOUND error |

---

### UT-17: ToolValidator - Validate Arguments Against Schema

| Attribute | Value |
|-----------|-------|
| **ID** | UT-17 |
| **Priority** | High |
| **Type** | Automated (vitest) |
| **Requirement** | TDD S7.4 |
| **Preconditions** | Tool schema loaded (mem_search requires "query" string) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Validate {query: "test"} against mem_search schema | Valid |
| 2 | Validate {} (missing query) | VALIDATION_ERROR |
| 3 | Validate {query: 123} (wrong type) | VALIDATION_ERROR |

---

### UT-18: WebviewManager - Create Panel and Load HTML

| Attribute | Value |
|-----------|-------|
| **ID** | UT-18 |
| **Priority** | Medium |
| **Type** | Automated (vitest) |
| **Requirement** | UC-5, BR-22 |
| **Preconditions** | Mock VS Code Webview API |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call openPanel('dashboard') | createWebviewPanel called |
| 2 | Verify HTML loaded from local bundle (not HTTP) | BR-22 satisfied |
| 3 | Verify panel.onDidDispose cleanup registered | Cleanup present |


---

## 3. Integration Tests (IT)

### IT-01: GET /health - Returns Healthy Status

| Attribute | Value |
|-----------|-------|
| **ID** | IT-01 |
| **Priority** | High |
| **Type** | Automated (vitest + supertest) |
| **Requirement** | UC-1 Step 5, UC-3, BR-13, BR-27 |
| **Preconditions** | Hono app with all modules initialized |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET /health | Status 200 |
| 2 | Verify response body | {status: "healthy", version: "1.0.0", uptime: >0, tools_loaded: 52} |
| 3 | Verify all module statuses = "ready" | All 5 modules ready |

---

### IT-02: GET /health - Returns 503 During Initialization

| Attribute | Value |
|-----------|-------|
| **ID** | IT-02 |
| **Priority** | High |
| **Type** | Automated (vitest + supertest) |
| **Requirement** | TDD S3.2 |
| **Preconditions** | Hono app with modules still initializing |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET /health before init completes | Status 503 |
| 2 | Verify body.status === "starting" | Correct status |

---

### IT-03: GET /mcp/tools/list - Returns 52 Tool Definitions

| Attribute | Value |
|-----------|-------|
| **ID** | IT-03 |
| **Priority** | High |
| **Type** | Automated (vitest + supertest) |
| **Requirement** | UC-2, UC-7, BR-6, BR-7, BR-11 |
| **Preconditions** | Hono app fully initialized |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET /mcp/tools/list | Status 200 |
| 2 | Verify response.tools.length === 52 | Count correct |
| 3 | Verify each tool has name, description, inputSchema | All fields present |
| 4 | Verify categories: memory=17, code=25, orchestration=6, utility=4 | Distribution correct |

---

### IT-04: POST /mcp/tools/call - Successful Tool Execution

| Attribute | Value |
|-----------|-------|
| **ID** | IT-04 |
| **Priority** | High |
| **Type** | Automated (vitest + supertest) |
| **Requirement** | UC-2, BR-6, BR-9 |
| **Preconditions** | Hono app, MemoryModule with test data |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /mcp/tools/call {tool_name: "mem_search", arguments: {query: "test"}} | Status 200 |
| 2 | Verify response.content is array | Content blocks present |
| 3 | Verify response.isError === false | No error |

---

### IT-05: POST /mcp/tools/call - Unknown Tool Returns 404

| Attribute | Value |
|-----------|-------|
| **ID** | IT-05 |
| **Priority** | High |
| **Type** | Automated (vitest + supertest) |
| **Requirement** | TDD S3.4, BR-6 |
| **Preconditions** | Hono app initialized |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST {tool_name: "nonexistent_tool"} | Status 404 |
| 2 | Verify error.code === "TOOL_NOT_FOUND" | Correct code |
| 3 | Verify message contains tool name | "Tool 'nonexistent_tool' not found" |

---

### IT-06: POST /mcp/tools/call - Invalid Arguments Returns 422

| Attribute | Value |
|-----------|-------|
| **ID** | IT-06 |
| **Priority** | High |
| **Type** | Automated (vitest + supertest) |
| **Requirement** | TDD S3.4 |
| **Preconditions** | Hono app initialized |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST {tool_name: "mem_search", arguments: {}} (missing query) | Status 422 |
| 2 | Verify error.code === "VALIDATION_ERROR" | Correct code |

---

### IT-07: POST /mcp/tools/call - Missing tool_name Returns 400

| Attribute | Value |
|-----------|-------|
| **ID** | IT-07 |
| **Priority** | Medium |
| **Type** | Automated (vitest + supertest) |
| **Requirement** | TDD S3.4 |
| **Preconditions** | Hono app initialized |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST {} (no tool_name) | Status 400 |
| 2 | Verify error.code === "INVALID_REQUEST" | Correct code |

---

### IT-08: POST /mcp/tools/call - Module Unavailable Returns 503

| Attribute | Value |
|-----------|-------|
| **ID** | IT-08 |
| **Priority** | Medium |
| **Type** | Automated (vitest + supertest) |
| **Requirement** | TDD S3.4 |
| **Preconditions** | MemoryModule in "initializing" state |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST {tool_name: "mem_search", arguments: {query: "x"}} | Status 503 |
| 2 | Verify error.code === "MODULE_UNAVAILABLE" | Correct code |

---

### IT-09: Localhost-Only Middleware - Reject Non-Localhost

| Attribute | Value |
|-----------|-------|
| **ID** | IT-09 |
| **Priority** | High |
| **Type** | Automated (vitest + supertest) |
| **Requirement** | BR-35, BR-37 |
| **Preconditions** | Hono app with localhost-only middleware |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Request from 127.0.0.1 | Status 200 (allowed) |
| 2 | Request with X-Forwarded-For: 192.168.1.100 | Status 403 (rejected) |

---

### IT-10: GET /api/dashboard/summary - Returns Dashboard Data

| Attribute | Value |
|-----------|-------|
| **ID** | IT-10 |
| **Priority** | Medium |
| **Type** | Automated (vitest + supertest) |
| **Requirement** | UC-5, BR-23, BR-24 |
| **Preconditions** | Hono app, test data loaded |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET /api/dashboard/summary | Status 200 |
| 2 | Verify envelope: {data: {...}, timestamp: "..."} | Correct format |
| 3 | Verify data has totalEntries, recentCount | Fields present |

---

### IT-11: GET /api/kb/graph - Returns Graph Data

| Attribute | Value |
|-----------|-------|
| **ID** | IT-11 |
| **Priority** | Medium |
| **Type** | Automated (vitest + supertest) |
| **Requirement** | UC-5, BR-24 |
| **Preconditions** | KBGraphModule with test data |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET /api/kb/graph | Status 200 |
| 2 | Verify data.nodes is array | Nodes present |
| 3 | Verify data.edges is array | Edges present |

---

### IT-12: POST /api/tags - Create Tag

| Attribute | Value |
|-----------|-------|
| **ID** | IT-12 |
| **Priority** | Medium |
| **Type** | Automated (vitest + supertest) |
| **Requirement** | UC-5 AF-3, BR-24 |
| **Preconditions** | Hono app initialized |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /api/tags {name: "test-tag"} | Status 201 |
| 2 | Verify response.data.id exists | ID generated |
| 3 | GET /api/tags/list - verify new tag | Tag found |

---

### IT-13: PUT /api/tags/:id - Update Tag

| Attribute | Value |
|-----------|-------|
| **ID** | IT-13 |
| **Priority** | Medium |
| **Type** | Automated (vitest + supertest) |
| **Requirement** | UC-5 AF-3 |
| **Preconditions** | Tag exists |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | PUT /api/tags/{id} {name: "updated-tag"} | Status 200 |
| 2 | Verify response.data.name === "updated-tag" | Updated |

---

### IT-14: DELETE /api/tags/:id - Delete Tag

| Attribute | Value |
|-----------|-------|
| **ID** | IT-14 |
| **Priority** | Medium |
| **Type** | Automated (vitest + supertest) |
| **Requirement** | UC-5 AF-3 |
| **Preconditions** | Tag exists |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | DELETE /api/tags/{id} | Status 200/204 |
| 2 | GET /api/tags/list - verify removed | Tag absent |

---

### IT-15: Error Handler Middleware - Internal Error Returns 500

| Attribute | Value |
|-----------|-------|
| **ID** | IT-15 |
| **Priority** | Medium |
| **Type** | Automated (vitest + supertest) |
| **Requirement** | TDD S5.6 |
| **Preconditions** | Module that throws |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger tool that throws Error | Status 500 |
| 2 | Verify error.code === "INTERNAL_ERROR" | Correct code |
| 3 | Verify NO stack trace in response | Secure |


---

## 4. E2E-API Tests

### E2E-API-01: Full Tool Lifecycle - List and Call All 52 Tools

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-01 |
| **Priority** | High |
| **Type** | Automated (vitest + node fetch) |
| **Requirement** | BR-6, BR-7, BR-10 |
| **Preconditions** | Backend server running on port 48721 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET http://127.0.0.1:48721/mcp/tools/list | 200, tools.length === 52 |
| 2 | For each tool, POST /mcp/tools/call with valid args | 200, isError===false |
| 3 | Verify response.content is array | Content present |

---

### E2E-API-02: Health Check - Full Response Validation

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-02 |
| **Priority** | High |
| **Type** | Automated (vitest + node fetch) |
| **Requirement** | UC-1, UC-3, BR-13, BR-27, BR-30 |
| **Preconditions** | Backend running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET /health | 200 |
| 2 | Verify status === "healthy" | Match |
| 3 | Verify version matches semver | Valid |
| 4 | Verify tools_loaded === 52 | Correct |
| 5 | Verify all 5 module statuses === "ready" | All ready |

---

### E2E-API-03: Proxy Latency - p99 Below 50ms

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-03 |
| **Priority** | High |
| **Type** | Automated (vitest + node fetch) |
| **Requirement** | BR-8 |
| **Preconditions** | Backend running, 100 sequential calls |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call POST /mcp/tools/call 100 times | Record times |
| 2 | Calculate p99 latency | p99 < 50ms |
| 3 | Calculate median | median < 20ms |

---

### E2E-API-04: Backend Startup - Healthy Within 10s

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-04 |
| **Priority** | High |
| **Type** | Automated (vitest + node fetch) |
| **Requirement** | BRD NFR, TDD S8.1 |
| **Preconditions** | Backend not running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Spawn Backend process | Started |
| 2 | Poll GET /health every 500ms | - |
| 3 | First "healthy" response within 10000ms | Startup < 10s |

---

### E2E-API-05: Error Forwarding - 404, 422, 400

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-05 |
| **Priority** | High |
| **Type** | Automated (vitest + node fetch) |
| **Requirement** | BR-9, TDD S3.4 |
| **Preconditions** | Backend running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST {tool_name: "fake"} | 404, TOOL_NOT_FOUND |
| 2 | POST {tool_name: "mem_search", arguments: {}} | 422, VALIDATION_ERROR |
| 3 | POST {} (no tool_name) | 400, INVALID_REQUEST |

---

### E2E-API-06: Webview APIs - Dashboard + KB Graph + Analytics

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-06 |
| **Priority** | Medium |
| **Type** | Automated (vitest + node fetch) |
| **Requirement** | UC-5, BR-23, BR-24 |
| **Preconditions** | Backend running with test data |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET /api/dashboard/summary | 200, data present |
| 2 | GET /api/kb/graph | 200, nodes+edges |
| 3 | GET /api/analytics/overview | 200, summary |
| 4 | GET /api/quality/summary | 200, scores |

---

### E2E-API-07: Tags CRUD - Full Lifecycle

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-07 |
| **Priority** | Medium |
| **Type** | Automated (vitest + node fetch) |
| **Requirement** | UC-5 AF-3, BR-24 |
| **Preconditions** | Backend running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /api/tags {name: "e2e-tag"} | 201, id returned |
| 2 | GET /api/tags/list - find tag | Present |
| 3 | PUT /api/tags/{id} {name: "updated"} | 200 |
| 4 | DELETE /api/tags/{id} | 200/204 |
| 5 | GET /api/tags/list - verify gone | Absent |

---

### E2E-API-08: Security - Localhost Only Binding

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-08 |
| **Priority** | High |
| **Type** | Automated (vitest + node fetch) |
| **Requirement** | BR-35, BR-37 |
| **Preconditions** | Backend running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Connect to 127.0.0.1:48721 | Success |
| 2 | Verify NOT listening on 0.0.0.0 | Refused |
| 3 | Check netstat shows 127.0.0.1 only | Confirmed |

---

### E2E-API-09: Version Compatibility - Health Version Field

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-09 |
| **Priority** | Medium |
| **Type** | Automated (vitest + node fetch) |
| **Requirement** | UC-6, BR-26, BR-27, BR-30 |
| **Preconditions** | Backend running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET /health | 200 |
| 2 | Extract version field | Valid semver |
| 3 | Verify satisfies compatRange | Compatible |

---

### E2E-API-10: Multi-IDE Readiness - No IDE-Specific Data

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-10 |
| **Priority** | Medium |
| **Type** | Automated (vitest + node fetch) |
| **Requirement** | UC-7, BR-31, BR-32 |
| **Preconditions** | Backend running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET /mcp/tools/list | 200 |
| 2 | Scan all tool schemas for "vscode", "TextEditor", "Uri" | None found |
| 3 | Verify Content-Type: application/json | Standard HTTP |

---

### E2E-API-11: Crash Recovery - Restart Restores Service

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-11 |
| **Priority** | High |
| **Type** | Automated (vitest + node fetch) |
| **Requirement** | UC-3, UC-4, BR-12, BR-18 |
| **Preconditions** | Backend running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET /health - verify healthy | 200 |
| 2 | Kill Backend process | ECONNREFUSED |
| 3 | Restart Backend | - |
| 4 | Poll /health until OK (max 10s) | Healthy |
| 5 | POST /mcp/tools/call mem_search | 200, works |

---

### E2E-API-12: Concurrent Tool Calls - No Interference

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-12 |
| **Priority** | Medium |
| **Type** | Automated (vitest + node fetch) |
| **Requirement** | BR-8 |
| **Preconditions** | Backend running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Fire 10 concurrent tool calls (different tools) | - |
| 2 | Await all responses | All 10 succeed |
| 3 | Verify no cross-contamination | Responses isolated |


---

## 5. E2E-UI Tests

### E2E-UI-01: Extension Activation - Completes Within 2s

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-UI-01 |
| **Priority** | High |
| **Type** | Automated (@vscode/test-electron) |
| **Requirement** | UC-1, BR-1 |
| **Preconditions** | Extension installed, Backend running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Launch VS Code with extension | Activates |
| 2 | Measure activate() duration | < 2000ms |
| 3 | Verify status bar shows "Connected" | Green |
| 4 | Verify 52 tools registered | Tool count = 52 |

---

### E2E-UI-02: Extension Package - Size and No Native Binaries

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-UI-02 |
| **Priority** | High |
| **Type** | Automated (vitest + fs) |
| **Requirement** | BR-2, BR-3 |
| **Preconditions** | .vsix packaged |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Measure .vsix file size | < 5MB |
| 2 | Scan for .node, .dll, .so, .dylib | Zero found |
| 3 | Scan for onnxruntime, better-sqlite3 | Not present |

---

### E2E-UI-03: Status Bar - Connection State Indicator

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-UI-03 |
| **Priority** | High |
| **Type** | Automated (@vscode/test-electron) |
| **Requirement** | BR-15, BR-30 |
| **Preconditions** | Extension running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Backend running - check status | "Connected" with version |
| 2 | Kill Backend - wait 5s | "Disconnected" (red) |
| 3 | Start Backend - wait 5s | "Connected" again |

---

### E2E-UI-04: Dashboard Panel - Opens and Shows Data

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-UI-04 |
| **Priority** | Medium |
| **Type** | Automated (@vscode/test-electron + Playwright) |
| **Requirement** | UC-5, BR-22, BR-24 |
| **Preconditions** | Extension connected, test data available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Execute command: "codeIntel.openDashboard" | Panel opens |
| 2 | Wait for Webview load (max 5s) | HTML rendered |
| 3 | Verify metrics displayed | Data from API shown |

---

### E2E-UI-05: KB Graph Panel - Renders Nodes and Edges

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-UI-05 |
| **Priority** | Medium |
| **Type** | Automated (@vscode/test-electron + Playwright) |
| **Requirement** | UC-5, BR-24 |
| **Preconditions** | Extension connected, KB has entries |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Execute "codeIntel.openKBGraph" | Panel opens |
| 2 | Wait for graph data | - |
| 3 | Verify nodes rendered | Elements visible |
| 4 | Verify edges connect nodes | Graph structure |

---

### E2E-UI-06: Tool Call via Extension - mem_search Returns Result

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-UI-06 |
| **Priority** | High |
| **Type** | Automated (@vscode/test-electron) |
| **Requirement** | UC-2, BR-6, BR-7 |
| **Preconditions** | Extension connected, tools registered |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke "mem_search" via Extension API | - |
| 2 | Verify response received | Non-null |
| 3 | Verify response.content is array | Present |
| 4 | Verify response.isError === false | No error |

---

### E2E-UI-07: Crash Isolation - Backend Kill Does Not Crash Extension

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-UI-07 |
| **Priority** | High |
| **Type** | Automated (@vscode/test-electron) |
| **Requirement** | UC-3, BR-12, BR-16 |
| **Preconditions** | Extension connected |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Kill Backend process | - |
| 2 | Wait 5s | Extension still running |
| 3 | Verify Extension Host alive | No crash |
| 4 | Verify status bar "Disconnected" | Correct |
| 5 | Call tool - verify error (not hang) | Error within 10s |

---

### E2E-UI-08: Auto-Reconnect - Tools Work After Restart

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-UI-08 |
| **Priority** | High |
| **Type** | Automated (@vscode/test-electron) |
| **Requirement** | UC-4, BR-18, BR-21 |
| **Preconditions** | Extension connected |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Kill Backend | Disconnected |
| 2 | Wait 3s, restart Backend | - |
| 3 | Wait up to 10s for Connected | Auto-reconnect < 5s |
| 4 | Call tool "mem_search" | Returns result |
| 5 | No manual action required | Automatic |

---

## 6. SIT Tests (Manual)

### SIT-01: Visual Status Bar Transitions

| Attribute | Value |
|-----------|-------|
| **ID** | SIT-01 |
| **Priority** | Medium |
| **Type** | Manual |
| **Requirement** | BR-15 |
| **Preconditions** | Extension installed, Backend available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open VS Code - observe status bar | Green "Connected" icon, smooth appearance |
| 2 | Kill Backend - observe transition | Smooth color change to red, no flicker |
| 3 | Restart Backend - observe animation | Spinning during reconnect, then green |
| 4 | Hover status bar | Tooltip shows version |

---

### SIT-02: Webview Panel UX - Layout and Responsiveness

| Attribute | Value |
|-----------|-------|
| **ID** | SIT-02 |
| **Priority** | Medium |
| **Type** | Manual |
| **Requirement** | UC-5, BR-24 |
| **Preconditions** | Extension connected |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Dashboard panel | Clean layout, no overflow |
| 2 | Resize VS Code window | Responsive, no cut-off |
| 3 | Open KB Graph - interact with nodes | Smooth drag, no lag |
| 4 | Open Analytics - verify charts | Proper axes, legends |
| 5 | Switch panels rapidly | Stable rendering |

---

### SIT-03: Notification UX - Error Messages Clarity

| Attribute | Value |
|-----------|-------|
| **ID** | SIT-03 |
| **Priority** | Low |
| **Type** | Manual |
| **Requirement** | FSD S9 |
| **Preconditions** | Various error conditions |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Remove Backend binary - activate | Clear "not found" notification |
| 2 | Configure invalid port (99) - reload | "Invalid configuration" message |
| 3 | Kill Backend during tool call | No intrusive dialog |
| 4 | Verify messages match ERR-001..ERR-010 | User-friendly |

---

### SIT-04: Extension Activation Timing - Perceived Speed

| Attribute | Value |
|-----------|-------|
| **ID** | SIT-04 |
| **Priority** | Medium |
| **Type** | Manual |
| **Requirement** | BR-1, BR-4 |
| **Preconditions** | Fresh VS Code launch |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Launch VS Code with workspace | - |
| 2 | Observe status bar appears immediately | No visible delay |
| 3 | Verify IDE responsive while Backend loads | No blocking |
| 4 | "Connected" appears within seconds | Smooth transition |

---

### SIT-05: Cross-Platform Behavior

| Attribute | Value |
|-----------|-------|
| **ID** | SIT-05 |
| **Priority** | Low |
| **Type** | Manual |
| **Requirement** | BRD NFR |
| **Preconditions** | Extension + Backend on each OS |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Test on Windows | All works |
| 2 | Test on macOS | Same behavior |
| 3 | Test on Linux | Same behavior |
| 4 | Verify Backend spawn on each OS | Correct |

---

### SIT-06: Backend Update Flow - User Experience

| Attribute | Value |
|-----------|-------|
| **ID** | SIT-06 |
| **Priority** | Low |
| **Type** | Manual |
| **Requirement** | UC-6, BR-26..BR-30 |
| **Preconditions** | Extension connected to Backend v1.0.0 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Stop Backend v1.0.0 | "Disconnected" shown |
| 2 | Replace with v1.1.0, start | Reconnects, shows new version |
| 3 | Replace with incompatible v2.0.0-beta | Warning shown, still connects |


---

## 7. Requirements Traceability Matrix (RTM)

| Requirement | Source | Test Cases | Coverage |
|-------------|--------|------------|----------|
| UC-1 (Extension Activation) | FSD 3.1 | PBT-04, PBT-08, UT-01, UT-02, UT-10, UT-15, IT-01, E2E-API-02, E2E-API-04, E2E-UI-01, SIT-04 | Covered |
| UC-2 (Proxy Tool Call) | FSD 3.2 | PBT-01, PBT-02, PBT-05, UT-04..07, UT-12..13, UT-16..17, IT-03..08, E2E-API-01, E2E-API-03, E2E-API-05, E2E-UI-06 | Covered |
| UC-3 (Crash Detection) | FSD 3.3 | UT-03, UT-11, E2E-API-11, E2E-UI-07, SIT-01 | Covered |
| UC-4 (Auto-Reconnect) | FSD 3.4 | PBT-03, PBT-07, UT-02, UT-03, E2E-API-11, E2E-UI-03, E2E-UI-08 | Covered |
| UC-5 (Webview UI) | FSD 3.5 | UT-18, IT-10..14, E2E-API-06, E2E-API-07, E2E-UI-04, E2E-UI-05, SIT-02 | Covered |
| UC-6 (Version Check) | FSD 3.6 | E2E-API-09, SIT-06 | Covered |
| UC-7 (Multi-IDE API) | FSD 3.7 | IT-03, E2E-API-10 | Covered |
| BR-1 (activate <2s) | FSD 3.1.3 | E2E-UI-01, SIT-04 | Covered |
| BR-2 (.vsix <5MB) | FSD 3.1.3 | E2E-UI-02 | Covered |
| BR-3 (no native binaries) | FSD 3.1.3 | E2E-UI-02 | Covered |
| BR-4 (async start) | FSD 3.1.3 | UT-10, E2E-API-04, SIT-04 | Covered |
| BR-5 (degraded mode) | FSD 3.1.3 | UT-06 | Covered |
| BR-6 (52 tools) | FSD 3.2.3 | PBT-01, PBT-05, UT-04, IT-03, E2E-API-01 | Covered |
| BR-7 (schemas identical) | FSD 3.2.3 | PBT-01, UT-05, IT-03, E2E-API-01 | Covered |
| BR-8 (latency <50ms) | FSD 3.2.3 | PBT-02, E2E-API-03 | Covered |
| BR-9 (errors as-is) | FSD 3.2.3 | UT-07, IT-04, E2E-API-05 | Covered |
| BR-10 (find_tools same) | FSD 3.2.3 | PBT-05, E2E-API-01 | Covered |
| BR-11 (discovery) | FSD 3.2.3 | UT-04, IT-03 | Covered |
| BR-12 (crash isolation) | FSD 3.3.3 | UT-11, E2E-UI-07 | Covered |
| BR-13 (detect <5s) | FSD 3.3.3 | UT-08, UT-09, IT-01, E2E-UI-03 | Covered |
| BR-14 (in-flight <10s) | FSD 3.3.3 | UT-13, E2E-UI-07 | Covered |
| BR-15 (status bar) | FSD 3.3.3 | PBT-07, UT-14, E2E-UI-03, SIT-01 | Covered |
| BR-16 (no error dialogs) | FSD 3.3.3 | E2E-UI-07 | Covered |
| BR-17 (backoff) | FSD 3.4.3 | PBT-03, PBT-07 | Covered |
| BR-18 (reconnect <5s) | FSD 3.4.3 | E2E-UI-08 | Covered |
| BR-19 (no manual action) | FSD 3.4.3 | E2E-UI-08 | Covered |
| BR-20 (reconnect logged) | FSD 3.4.3 | E2E-UI-08 | Covered |
| BR-21 (tools after reconnect) | FSD 3.4.3 | E2E-UI-08 | Covered |
| BR-22 (HTML in Extension) | FSD 3.5.3 | UT-18, E2E-UI-04 | Covered |
| BR-23 (JSON only) | FSD 3.5.3 | IT-10, E2E-API-06 | Covered |
| BR-24 (5 panels) | FSD 3.5.3 | IT-10..14, E2E-API-06, E2E-UI-04, E2E-UI-05, SIT-02 | Covered |
| BR-25 (refresh reconnect) | FSD 3.5.3 | E2E-UI-08 | Covered |
| BR-26 (independent semver) | FSD 3.6.3 | E2E-API-09 | Covered |
| BR-27 (version check) | FSD 3.6.3 | IT-01, E2E-API-02, E2E-API-09 | Covered |
| BR-28 (warning only) | FSD 3.6.3 | SIT-06 | Covered |
| BR-29 (no marketplace) | FSD 3.6.3 | SIT-06 | Covered |
| BR-30 (version tooltip) | FSD 3.6.3 | UT-14, E2E-UI-03, SIT-06 | Covered |
| BR-31 (zero vscode) | FSD 3.7.3 | E2E-API-10 | Covered |
| BR-32 (no IDE concepts) | FSD 3.7.3 | E2E-API-10 | Covered |
| BR-33 (API docs) | FSD 3.7.3 | E2E-API-10 | Covered |
| BR-34 (separation) | FSD 3.7.3 | E2E-API-10 | Covered |
| BR-35 (127.0.0.1) | FSD 7.3 | IT-09, E2E-API-08 | Covered |
| BR-36 (no auth) | FSD 7.3 | E2E-API-08 | Covered |
| BR-37 (no 0.0.0.0) | FSD 7.3 | IT-09, E2E-API-08 | Covered |
| BR-38 (validate JSON) | FSD 7.3 | PBT-06 | Covered |
| ERR-001..ERR-010 | FSD 9.2 | SIT-03 | Covered |

**Coverage Summary:**

| Category | Total | Covered | Coverage |
|----------|-------|---------|----------|
| Use Cases (UC-1..UC-7) | 7 | 7 | 100% |
| Business Rules (BR-1..BR-38) | 38 | 38 | 100% |
| Error Codes (ERR-001..ERR-010) | 10 | 10 | 100% |
| BRD Stories (1-7) | 7 | 7 | 100% |
| **Overall** | **62** | **62** | **100%** |

---

## 8. Appendix

### Test Data Setup

**Backend Test Fixtures:**
- Pre-seeded SQLite with 10 KB entries (for mem_search testing)
- Pre-configured orchestration.json with 4 child servers
- Mock ONNX model (lightweight, for CI speed)

### Environment Configuration

- Backend port: 48721 (default) or random port for CI isolation
- Extension test workspace: test-fixtures/workspace/
- Timeout overrides for CI: startupTimeout=30000ms

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |
