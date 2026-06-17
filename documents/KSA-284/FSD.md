# Functional Specification Document (FSD)

## Code Intelligence Extension — KSA-284: Split Extension: Lightweight Proxy + Backend MCP Server

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-284 |
| Title | Split Extension: Lightweight Proxy + Backend MCP Server |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-07-11 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-284.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-11 | BA Agent | Initiate document from BRD — auto-generated |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the split architecture for the Code Intelligence VS Code/Kiro extension. It defines how the Lightweight Extension (Proxy) communicates with the Backend MCP Server, covering all use cases, API contracts, state management, error handling, and processing logic required for implementation.

### 1.2 Scope

- **Lightweight Extension**: Minimal IDE extension (~2MB) that proxies MCP tool calls, renders Webview UIs, and manages Backend connection lifecycle
- **Backend MCP Server**: Standalone HTTP process handling all business logic (Memory, Code Intelligence, Orchestration, KB Graph, Analytics)
- **Communication Protocol**: HTTP/JSON between Extension and Backend on localhost
- **Connection Management**: Health checks, auto-reconnect, crash isolation
- **Tool Proxying**: Transparent forwarding of all 52 MCP tools
- **Webview Proxying**: Data fetching from Backend REST APIs for Dashboard, KB Graph, Analytics, Tags, Quality panels

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| MCP | Model Context Protocol — standard for AI tool integration |
| Extension Host | VS Code process that runs extensions in isolation |
| Backend | Standalone Node.js process exposing HTTP API for all business logic |
| Proxy | Pattern where Extension forwards requests without processing |
| Health Check | HTTP GET /health endpoint to verify Backend availability |
| Exponential Backoff | Retry strategy: delay doubles each attempt (1s, 2s, 4s, 8s... max 30s) |
| ONNX | Open Neural Network Exchange — ML model format for text embeddings |
| Webview | VS Code panel rendering HTML/JS/CSS content |
| Tool Registration | Process of declaring MCP tools to the IDE runtime |
| Connection State | FSM tracking Backend connectivity (Connected/Disconnected/Connecting/Starting) |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | documents/KSA-284/BRD.md |
| Tool List | .code-intel/tool-list.txt |
| Orchestration Config | .code-intel/orchestration.json |
| VS Code Extension API | https://code.visualstudio.com/api |
| MCP Specification | https://modelcontextprotocol.io |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)
*[Edit in draw.io](diagrams/system-context.drawio)*

The split architecture introduces a clear boundary between IDE-specific concerns (Extension) and business logic (Backend). External actors and systems:

- **Developer (IDE User)**: Interacts with MCP tools via IDE agent and Webview panels
- **IDE Agent (AI)**: Calls MCP tools registered by the Extension
- **VS Code/Kiro IDE**: Host environment providing Extension Host, Webview API, Status Bar
- **Backend MCP Server**: Standalone process handling all heavy operations
- **Child MCP Servers**: Orchestrated by Backend (Jira, Draw.io, Export servers)
- **SQLite Database**: Backend data persistence (memory, indexes)
- **ONNX Runtime**: Backend embedding generation for semantic search
- **Filesystem**: Workspace files accessed by Backend for code intelligence

### 2.2 System Architecture

The system consists of two main components communicating over HTTP on localhost:

**Extension (Thin Proxy):**
- Tool Proxy Module — registers MCP tools, forwards calls to Backend
- Connection Manager — health checks, reconnect logic, Backend process spawning
- Webview Manager — renders panels using Backend API data
- Status Bar — shows connection state indicator
- Configuration — port, Backend path, auto-start settings

**Backend (Heavy Logic):**
- HTTP Server (Hono/Fastify) — exposes /mcp/tools/call, /health, /api/* endpoints
- Memory Module — SQLite + ONNX embeddings
- Code Intelligence Module — indexing, symbols, search
- Orchestration Module — manages child MCP servers
- Analytics/Quality Module — scoring, metrics
- KB Graph Module — knowledge graph operations

---

## 3. Functional Requirements

### 3.1 Feature: Extension Activation & Startup

**Source:** BRD Story 1 — Fast Extension Install and Activation

#### 3.1.1 Description

The Extension activates within 2 seconds, contains no heavy dependencies (ONNX, SQLite, native binaries), and asynchronously establishes connection to the Backend. Users see immediate IDE responsiveness while Backend loads in background.

#### 3.1.2 Use Case: UC-1 — Extension Activation

**Use Case ID:** UC-1
**Actor:** Developer
**Preconditions:** Extension installed from marketplace (<5MB .vsix)
**Postconditions:** Extension active, tools registered (or registering), status bar visible

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Opens IDE | | Developer launches VS Code/Kiro with extension installed |
| 2 | | Extension.activate() called | IDE triggers extension activation |
| 3 | | Load configuration | Read port, Backend path, auto-start from settings |
| 4 | | Show status bar | Display "Connecting..." in status bar |
| 5 | | Check Backend health | GET /health to configured port |
| 6 | | Register MCP tool proxies | Register all 52 tools with IDE (async, non-blocking) |
| 7 | | Update status bar | Display "Connected" with green indicator |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | Backend not running, auto-start enabled | Step 5 fails → spawn Backend process → poll health → when healthy, continue Step 6 |
| AF-2 | Backend not running, auto-start disabled | Step 5 fails → show "Backend Offline" status → register tools in degraded mode (return errors) |
| AF-3 | Backend starting slowly (>5s) | Show "Starting Backend..." status → continue polling → register tools when ready |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Configuration invalid (bad port/path) | Show error notification → open settings → status "Configuration Error" |
| EF-2 | Backend binary not found | Show "Backend not installed" notification with install instructions |
| EF-3 | Port already in use by another process | Try next port (port+1, port+2) → if all fail, show port conflict error |

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-1 | Extension activate() MUST return within 2 seconds regardless of Backend state | BRD Story 1, AC-2 |
| BR-2 | Extension package MUST be less than 5MB (.vsix file) | BRD Story 1, AC-1 |
| BR-3 | Extension MUST NOT bundle ONNX, SQLite, or native binary files | BRD Story 1, AC-3 |
| BR-4 | Backend startup is asynchronous — extension functional before Backend ready | BRD Story 1 |
| BR-5 | Tools registered in degraded mode if Backend unavailable (return error on call) | BRD Story 1 |

#### 3.1.4 Data Specifications

**Configuration Input:**

| Field | Type | Required | Default | Validation | Description |
|-------|------|----------|---------|------------|-------------|
| backendPort | number | N | 48721 | 1024-65535 | Port for Backend HTTP server |
| backendPath | string | N | (bundled) | Valid file path | Path to Backend executable/script |
| autoStart | boolean | N | true | — | Auto-spawn Backend on activation |
| healthCheckInterval | number | N | 5000 | 1000-60000 ms | Polling interval for health checks |
| startupTimeout | number | N | 30000 | 5000-120000 ms | Max time to wait for Backend startup |

**Health Check Output:**

| Field | Type | Description |
|-------|------|-------------|
| status | string | "healthy" or "unhealthy" |
| version | string | Backend semver (e.g., "1.2.3") |
| uptime | number | Seconds since Backend started |
| tools_loaded | number | Count of tools registered in Backend |

---

### 3.2 Feature: MCP Tool Proxying

**Source:** BRD Story 2 — Transparent MCP Tool Proxying

#### 3.2.1 Description

All 52 MCP tools are registered with the IDE and transparently forwarded to the Backend via HTTP POST. Tool names, parameter schemas, and response formats are identical to the current monolithic implementation. Proxy adds <50ms latency overhead.

#### 3.2.2 Use Case: UC-2 — Proxy Tool Call

**Use Case ID:** UC-2
**Actor:** IDE Agent (AI) or Developer (via command)
**Preconditions:** Extension connected to Backend, tools registered
**Postconditions:** Tool result returned to caller identically to direct Backend call

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Invokes MCP tool | | Agent calls e.g. mem_search(query="...") |
| 2 | | Serialize request | Build JSON payload: {tool_name, arguments} |
| 3 | | HTTP POST /mcp/tools/call | Send to Backend with 30s timeout |
| 4 | | Backend processes | Backend executes tool logic |
| 5 | | Receive response | Backend returns JSON result |
| 6 | | Deserialize & return | Return result object to IDE/Agent unchanged |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | Tool call returns partial/streaming result | Backend streams response → Extension buffers → returns complete result |
| AF-2 | Tool is orchestration tool (execute_dynamic_tool) | Extension forwards to Backend → Backend calls child server → returns result |
| AF-3 | Tool call takes >5s (long-running) | Extension keeps connection open → no timeout for long operations (up to 5min) |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Backend disconnected during call | Return error: {code: "BACKEND_UNAVAILABLE", message: "Backend is not connected"} |
| EF-2 | Backend returns HTTP 5xx | Forward error response as-is to caller (no wrapping) |
| EF-3 | Request timeout (>5min) | Return error: {code: "TIMEOUT", message: "Tool call timed out"} |
| EF-4 | Backend returns malformed JSON | Return error: {code: "PARSE_ERROR", message: "Invalid response from Backend"} |

#### 3.2.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-6 | ALL 52 tools from tool-list.txt MUST be proxied | BRD Story 2 |
| BR-7 | Tool names, parameter schemas, and response formats MUST be identical | BRD Story 2 |
| BR-8 | Proxy latency overhead MUST be <50ms (p99) | BRD Story 2, AC-2 |
| BR-9 | Error responses from Backend MUST be forwarded as-is (no wrapping) | BRD Story 2 |
| BR-10 | find_tools() MUST return same results through proxy | BRD Story 2, AC-3 |
| BR-11 | Tool discovery schema from Backend used for IDE registration | BRD Story 2 |

#### 3.2.4 File Proxy Protocol (Extension as File Gateway)

Since the Backend runs as a separate process with NO direct filesystem access to the workspace, the Extension acts as a **File Gateway** for tools that read or write files.

**Three Proxy Patterns:**

| Pattern | Direction | Tools | Description |
|---------|-----------|-------|-------------|
| 1. File Input | Extension → Backend | mem_ingest_file, drawio_auto_layout | Extension reads file content, sends to Backend with content |
| 2. File Output | Backend → Extension | stream_write_file | Backend returns file data, Extension writes to workspace |
| 3. File Input+Output | Bidirectional | drawio_export_png, export_docx | Extension reads input file, sends to Backend; Backend returns output, Extension writes |
| 4. Text Only | Forward as-is | mem_search, code_search, find_tools (44+ tools) | No file handling, simple JSON proxy |
| 5. Extension-Local | No Backend call | embed_images | Runs entirely in Extension — pure filesystem operation, no forwarding |

**Pattern 1 — File Input Protocol:**

| Step | Actor | Action |
|------|-------|--------|
| 1 | Extension | Detect tool has `file_path` parameter |
| 2 | Extension | Resolve relative path → absolute (workspace root + file_path) |
| 3 | Extension | Read file content from workspace filesystem |
| 4 | Extension | Validate file size < 10MB (reject with ERR-011 if exceeded) |
| 5 | Extension | Encode: text files as UTF-8 string, binary files as Base64 |
| 6 | Extension | Inject `__file_content` and `__file_encoding` into arguments |
| 7 | Extension | POST to Backend with enriched arguments |
| 8 | Backend | Process using `__file_content` (no filesystem access needed) |

**Pattern 2 — File Output Protocol:**

| Step | Actor | Action |
|------|-------|--------|
| 1 | Backend | Generate output data (text or binary) |
| 2 | Backend | Return response with `__file_output: {path, data, encoding}` |
| 3 | Extension | Detect `__file_output` in response |
| 4 | Extension | Resolve relative path → absolute (workspace root + path) |
| 5 | Extension | Create directories if needed (recursive) |
| 6 | Extension | Decode data (Base64 → Buffer for binary, UTF-8 for text) |
| 7 | Extension | Write file to workspace |
| 8 | Extension | Return success result to caller |

**Design Rules:**

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-39 | All file paths MUST be relative from workspace root | Design Decision |
| BR-40 | Binary files encoded as Base64 in JSON body (MCP-compatible) | Design Decision |
| BR-41 | Text files encoded as UTF-8 string | Design Decision |
| BR-42 | File size limit: 10MB max; reject with ERR-011 if exceeded | Design Decision |
| BR-43 | Extension resolves relative → absolute path; Backend NEVER accesses filesystem | Design Decision |
| BR-44 | Backend returns `__file_output` for tools that produce file output | Design Decision |
| BR-45 | Chunk upload for >10MB files: future enhancement (v2) | Design Decision |

**Tool Classification:**

| Tool | Pattern | Input File | Output File |
|------|---------|-----------|-------------|
| mem_ingest_file | 1 (Input) | file_path → content | — |
| drawio_auto_layout | 1 (Input) | file_path → .drawio XML | — |
| stream_write_file | 2 (Output) | — | path + content |
| drawio_export_png | 3 (Both) | file_path → .drawio XML | output → .png (base64) |
| export_docx | 3 (Both) | file_path → .md content | output → .docx (base64) |
| embed_images | 5 (Extension-Local) | file_path → reads MD + PNGs | output → embedded MD (no Backend call) |
| All other 46 tools | 4 (Text) | — | — |

#### 3.2.5 Data Specifications

**Proxy Request — Text Only (Extension → Backend):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| tool_name | string | Y | MCP tool name (e.g., "mem_search") |
| arguments | object | Y | Tool arguments matching schema |

**Proxy Request — File Input (Extension → Backend):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| tool_name | string | Y | MCP tool name |
| arguments.file_path | string | Y | Relative path from workspace root |
| arguments.__file_content | string | Y | File content (UTF-8 or Base64) |
| arguments.__file_encoding | string | Y | "utf-8" or "base64" |

**Proxy Response — Text Only (Backend → Extension):**

| Field | Type | Description |
|-------|------|-------------|
| content | array | Tool result content (text, images, etc.) |
| isError | boolean | Whether the result is an error |

**Proxy Response — File Output (Backend → Extension):**

| Field | Type | Description |
|-------|------|-------------|
| content | array | Tool result content |
| isError | boolean | Error flag |
| __file_output.path | string | Relative output path from workspace root |
| __file_output.data | string | File data (UTF-8 or Base64) |
| __file_output.encoding | string | "utf-8" or "base64" |

#### 3.2.5 API Contract (Functional View)

**Endpoint:** POST /mcp/tools/call
**Purpose:** Execute any MCP tool on the Backend

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| tool_name | string | Y | BR-6 | One of 52 registered tool names |
| arguments | object | Y | BR-7 | Arguments matching tool's input schema |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| content | ContentBlock[] | Array of content blocks (text, image, resource) |
| isError | boolean | True if tool execution failed |

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| Unknown tool | "Tool '{name}' not found" | tool_name not in registry |
| Invalid arguments | "Validation failed: {details}" | Arguments don't match schema |
| Internal error | "Tool execution failed: {message}" | Backend processing error |
| Child server down | "Server '{server}' unavailable" | Orchestrated child server crashed |

**Endpoint:** GET /mcp/tools/list
**Purpose:** Return all available tool definitions for IDE registration

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| tools | ToolDefinition[] | Array of {name, description, inputSchema} |

---

### 3.3 Feature: Crash Isolation

**Source:** BRD Story 3 — Crash Isolation

#### 3.3.1 Description

The Backend runs as a separate OS process. If the Backend crashes (ONNX failure, SQLite corruption, unhandled exception), the Extension remains fully operational in the IDE. Users see a status change but experience no IDE disruption.

#### 3.3.2 Use Case: UC-3 — Backend Crash Detection

**Use Case ID:** UC-3
**Actor:** System (automatic)
**Preconditions:** Extension connected to Backend, health check polling active
**Postconditions:** Extension in degraded mode, status shows "Disconnected"

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Backend crashes | Unhandled exception, OOM, or signal kill |
| 2 | | Health check fails | Next periodic GET /health returns connection refused |
| 3 | | Detect crash | Connection Manager marks state = DISCONNECTED |
| 4 | | Update UI | Status bar shows "Backend Disconnected" (red) |
| 5 | | Notify pending calls | All in-flight requests receive BACKEND_UNAVAILABLE error |
| 6 | | Start reconnect | Begin exponential backoff reconnection (UC-4) |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | Backend process exits cleanly (SIGTERM) | Same as crash — detect via health check failure |
| AF-2 | Network timeout (not crash) | Retry health check once → if second fails, treat as disconnected |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Extension itself encounters error during crash handling | Log error, maintain degraded state, do not propagate to IDE |

#### 3.3.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-12 | Backend crash MUST NOT trigger VS Code extension error/reload | BRD Story 3, AC-3 |
| BR-13 | Extension MUST detect Backend crash within 5 seconds | BRD Story 3 |
| BR-14 | In-flight requests MUST receive error within 10 seconds (not hang) | BRD Story 3, AC-2 |
| BR-15 | Extension status bar MUST reflect connection state at all times | BRD Story 3, AC-4 |
| BR-16 | No VS Code error dialogs triggered by Backend crash | BRD Story 3, AC-3 |

---

### 3.4 Feature: Auto-Reconnect

**Source:** BRD Story 4 — Auto-Reconnect

#### 3.4.1 Description

When Backend becomes unavailable, the Extension automatically attempts reconnection using exponential backoff. Upon successful reconnection, all tools are re-registered and full functionality restored without user intervention.

#### 3.4.2 Use Case: UC-4 — Auto-Reconnect

**Use Case ID:** UC-4
**Actor:** System (automatic)
**Preconditions:** Extension in DISCONNECTED state
**Postconditions:** Extension reconnected, tools re-registered, state = CONNECTED

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Start reconnect timer | Initial delay = 1 second |
| 2 | | Poll health endpoint | GET /health |
| 3 | | Health returns OK | Backend is available again |
| 4 | | Verify version compatibility | Check Backend version against Extension requirements |
| 5 | | Re-register tools | Fetch tool list, update IDE registrations |
| 6 | | Update state | DISCONNECTED → CONNECTED |
| 7 | | Update status bar | Show "Connected" (green) |
| 8 | | Log reconnection | Output channel: "Reconnected to Backend v{version}" |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | Health still failing | Double delay (2s, 4s, 8s, 16s, cap at 30s) → retry from Step 2 |
| AF-2 | Auto-restart enabled and Backend not running | Spawn Backend process → wait for health → continue Step 3 |
| AF-3 | Version incompatible after reconnect | Show warning "Backend v{X} incompatible, expected v{Y}" → connect anyway with warning |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Max reconnect attempts (100) reached | Show "Backend unreachable — click to retry" in status bar → stop polling |
| EF-2 | Backend starts but different tool set | Re-register tools with new set → log warning about changed tools |

#### 3.4.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-17 | Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s | BRD Story 4 |
| BR-18 | Auto-reconnect MUST complete within 5s of Backend becoming available | BRD Story 4, AC-1 |
| BR-19 | No manual user action required for reconnection | BRD Story 4 |
| BR-20 | Reconnection events MUST be logged in Extension output channel | BRD Story 4, AC-4 |
| BR-21 | All tools MUST be functional after reconnection without IDE restart | BRD Story 4, AC-2 |

---

### 3.5 Feature: Webview UI Proxying

**Source:** BRD Story 5 — Webview UI Proxying

#### 3.5.1 Description

The Extension renders Webview panels (Dashboard, KB Graph, Analytics, Tags, Quality) using data fetched from Backend REST APIs. HTML/JS/CSS for rendering remains in the Extension; Backend provides only JSON data endpoints.

#### 3.5.2 Use Case: UC-5 — Open Webview Panel

**Use Case ID:** UC-5
**Actor:** Developer
**Preconditions:** Extension connected to Backend
**Postconditions:** Webview panel displayed with live data from Backend

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Opens panel (command/click) | | Developer triggers Dashboard/KB Graph/etc. |
| 2 | | Create Webview panel | VS Code createWebviewPanel() |
| 3 | | Load HTML/JS/CSS | From Extension bundle (local files) |
| 4 | | Fetch data from Backend | GET /api/{panel}/data |
| 5 | | Render data | Webview JS populates UI with JSON response |
| 6 | | Setup polling/events | Periodic refresh or WebSocket for updates |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | Backend disconnected when panel opens | Show "Backend offline" placeholder in Webview → auto-refresh when reconnected |
| AF-2 | Data fetch returns empty | Show "No data available" message in panel |
| AF-3 | User performs CRUD in panel (Tags) | Webview sends command → Extension POSTs to Backend → refresh panel data |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Backend API returns error | Show error banner in Webview: "Failed to load data" with retry button |
| EF-2 | Webview JS crashes | Panel shows blank — user can close and reopen |

#### 3.5.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-22 | Webview HTML/JS/CSS MUST be bundled in Extension (not fetched from Backend) | BRD Story 5 |
| BR-23 | Backend provides only JSON data endpoints for Webviews | BRD Story 5 |
| BR-24 | All 5 panels (Dashboard, KB Graph, Analytics, Tags, Quality) MUST work via proxy | BRD Story 5 |
| BR-25 | Panel data MUST refresh when Backend reconnects after disconnection | BRD Story 5 |

#### 3.5.4 API Contract (Functional View)

**Webview Data Endpoints:**

| Endpoint | Method | Purpose | Panel |
|----------|--------|---------|-------|
| /api/dashboard/summary | GET | Dashboard overview metrics | Dashboard |
| /api/dashboard/recent | GET | Recent activity list | Dashboard |
| /api/kb/graph | GET | Knowledge base graph data (nodes, edges) | KB Graph |
| /api/kb/graph/node/{id} | GET | Single node details | KB Graph |
| /api/analytics/overview | GET | Analytics summary | Analytics |
| /api/analytics/timeline | GET | Time-series data | Analytics |
| /api/tags/list | GET | All tags with counts | Tags |
| /api/tags | POST | Create tag | Tags |
| /api/tags/{id} | PUT | Update tag | Tags |
| /api/tags/{id} | DELETE | Delete tag | Tags |
| /api/quality/scores | GET | Quality scores per entry | Quality |
| /api/quality/summary | GET | Overall quality metrics | Quality |

---

### 3.6 Feature: Independent Backend Updates

**Source:** BRD Story 6 — Independent Backend Updates

#### 3.6.1 Description

The Backend is distributed separately from the Extension, follows independent semver versioning, and can be updated without requiring a marketplace review or Extension reinstall.

#### 3.6.2 Use Case: UC-6 — Backend Version Check

**Use Case ID:** UC-6
**Actor:** System (automatic on connect)
**Preconditions:** Extension connecting to Backend
**Postconditions:** Version compatibility verified, user warned if incompatible

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Connect to Backend | Health check succeeds |
| 2 | | Read Backend version | From /health response.version field |
| 3 | | Check compatibility matrix | Compare Backend version against Extension's required range |
| 4 | | Version compatible | Proceed normally, show version in status tooltip |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | Backend version newer than expected (forward-compat) | Proceed with info log: "Backend v{X} newer than expected" |
| AF-2 | Backend version older but within tolerance | Proceed with warning in output channel |
| AF-3 | User triggers manual Backend update | Download new Backend binary → stop old → start new → reconnect |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Backend version incompatible (breaking change) | Show warning notification: "Backend v{X} incompatible. Please update." with link |
| EF-2 | Cannot determine Backend version | Connect anyway, log warning |

#### 3.6.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-26 | Backend version follows independent semver | BRD Story 6 |
| BR-27 | Extension checks Backend version on every connect | BRD Story 6 |
| BR-28 | Incompatible version shows warning but does NOT block connection | BRD Story 6 |
| BR-29 | Backend update MUST NOT require Extension marketplace submission | BRD Story 6, AC-4 |
| BR-30 | Extension shows Backend version in status bar tooltip | BRD Story 6, AC-2 |

---

### 3.7 Feature: Multi-IDE Architecture Readiness

**Source:** BRD Story 7 — Multi-IDE Architecture Readiness

#### 3.7.1 Description

The Backend HTTP API is completely IDE-agnostic. No VS Code-specific concepts exist in the Backend codebase. A new IDE frontend only needs to implement: tool proxy, Webview rendering, and connection management.

#### 3.7.2 Use Case: UC-7 — IDE-Agnostic Backend API

**Use Case ID:** UC-7
**Actor:** Alternative IDE Frontend (future)
**Preconditions:** Backend running, HTTP API accessible
**Postconditions:** Alternative frontend can discover and call tools

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | New frontend starts | | Any IDE frontend begins connection |
| 2 | | GET /health | Verify Backend available |
| 3 | | GET /mcp/tools/list | Discover available tools and schemas |
| 4 | | Register tools locally | Frontend registers tools in its IDE framework |
| 5 | Frontend calls tool | POST /mcp/tools/call | Execute tool via standard HTTP API |
| 6 | | Return result | Standard JSON response |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | Frontend needs Webview data | Use /api/* REST endpoints — same JSON format regardless of IDE |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Frontend sends IDE-specific headers | Backend ignores unknown headers, processes request normally |

#### 3.7.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-31 | Backend MUST have zero imports from scode or any IDE SDK | BRD Story 7, AC-1 |
| BR-32 | Backend API MUST NOT contain IDE-specific concepts (e.g., TextEditor, Uri) | BRD Story 7 |
| BR-33 | API documentation MUST be sufficient to build alternative frontend | BRD Story 7, AC-2 |
| BR-34 | Clear code separation: extension/ (IDE-specific) vs backend/ (IDE-agnostic) | BRD Story 7, AC-3 |

---

## 4. Data Model

### 4.1 Logical Entities

#### Entity: ConnectionState

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| state | enum | Y | BR-15 | DISCONNECTED, CONNECTING, CONNECTED, STARTING |
| backendVersion | string | N | BR-30 | Semver of connected Backend |
| lastHealthCheck | timestamp | Y | BR-13 | When last health check was performed |
| reconnectAttempts | number | Y | BR-17 | Current count of reconnect attempts |
| reconnectDelay | number | Y | BR-17 | Current backoff delay in ms |
| backendPid | number | N | BR-12 | OS process ID of Backend (if auto-started) |
| connectedAt | timestamp | N | — | When connection was established |

#### Entity: ToolRegistry

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| name | string | Y | BR-6 | MCP tool name (e.g., "mem_search") |
| description | string | Y | BR-11 | Tool description for IDE display |
| inputSchema | object | Y | BR-7 | JSON Schema for tool arguments |
| category | string | Y | — | Tool category (memory, code, orchestration, utility) |
| registered | boolean | Y | — | Whether tool is active in IDE |

#### Entity: ProxyRequest

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| id | string | Y | — | Unique request identifier (UUID) |
| toolName | string | Y | BR-6 | Tool being called |
| arguments | object | Y | BR-7 | Tool arguments |
| timestamp | timestamp | Y | — | When request was created |
| status | enum | Y | — | PENDING, IN_FLIGHT, COMPLETED, FAILED, TIMEOUT |
| responseTime | number | N | BR-8 | Latency in ms |

#### Entity: BackendConfiguration

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| port | number | Y | — | HTTP port for Backend |
| host | string | Y | — | Always "127.0.0.1" (localhost only) |
| backendPath | string | N | — | Path to Backend executable |
| autoStart | boolean | Y | BR-4 | Whether to auto-spawn Backend |
| healthInterval | number | Y | BR-13 | Health check polling interval (ms) |
| compatRange | string | Y | BR-27 | Semver range for compatible Backend versions |

**Relationships:**

| From Entity | To Entity | Cardinality | Description |
|-------------|-----------|-------------|-------------|
| ConnectionState | ToolRegistry | 1:N | One connection manages many tools |
| ConnectionState | ProxyRequest | 1:N | One connection has many in-flight requests |
| ConnectionState | BackendConfiguration | 1:1 | One connection uses one configuration |

---

## 5. Integration Specifications

### 5.1 External System: VS Code Extension Host

| Attribute | Value |
|-----------|-------|
| Purpose | Host runtime for the Lightweight Extension |
| Direction | Bidirectional |
| Data Format | VS Code Extension API (TypeScript) |
| Frequency | Real-time (event-driven) |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| Tool definitions | MCP tool registration | Send | BR-6, BR-7 |
| Tool results | Agent response | Send | BR-9 |
| Connection state | Status bar item | Send | BR-15 |
| Webview HTML | Webview panel content | Send | BR-22 |
| User commands | Command palette actions | Receive | — |

### 5.2 External System: Backend MCP Server (HTTP)

| Attribute | Value |
|-----------|-------|
| Purpose | Execute all business logic (Memory, Code Intel, Orchestration) |
| Direction | Bidirectional |
| Data Format | JSON over HTTP |
| Frequency | Real-time (on-demand per tool call) |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| Tool call request | /mcp/tools/call | Send | BR-6, BR-8 |
| Tool call response | JSON result | Receive | BR-9 |
| Health check | /health response | Receive | BR-13 |
| Tool list request | /mcp/tools/list | Receive | BR-11 |
| Webview data request | /api/* endpoints | Receive | BR-23 |

### 5.3 External System: Child MCP Servers (via Backend Orchestration)

| Attribute | Value |
|-----------|-------|
| Purpose | Jira integration, Draw.io export, Document export |
| Direction | Indirect (Backend manages) |
| Data Format | stdio JSON-RPC (MCP protocol) |
| Frequency | On-demand via execute_dynamic_tool |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| execute_dynamic_tool args | Child server call | Send (via Backend) | BR-6 |
| Child server response | Tool result | Receive (via Backend) | BR-9 |

---

## 6. Processing Logic

### 6.1 Backend Process Lifecycle Management

**Trigger:** Extension activation with autoStart=true and Backend not running
**Input:** BackendConfiguration (port, path)
**Output:** Running Backend process with healthy status

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Check if port is in use (TCP connect test) | If in use → check if it's our Backend via /health → if yes, connect; if no, try next port |
| 2 | Spawn Backend process (child_process.spawn) | If spawn fails → show error notification, enter degraded mode |
| 3 | Capture stdout/stderr for logging | Log to Extension output channel |
| 4 | Poll /health every 500ms | If not healthy after startupTimeout → show "Backend failed to start" error |
| 5 | Health returns OK → transition to CONNECTED | — |
| 6 | Monitor process exit event | On unexpected exit → trigger crash detection (UC-3) |

### 6.2 Tool Proxy Routing

**Trigger:** IDE/Agent invokes any MCP tool
**Input:** tool_name (string), arguments (object)
**Output:** Tool result (content blocks)

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Validate connection state == CONNECTED | If not → return BACKEND_UNAVAILABLE immediately |
| 2 | Create ProxyRequest (UUID, timestamp) | — |
| 3 | Serialize to JSON: {tool_name, arguments} | — |
| 4 | HTTP POST to /mcp/tools/call | Network error → return CONNECTION_ERROR |
| 5 | Await response (timeout: 5 min for long ops) | Timeout → return TIMEOUT error |
| 6 | Parse JSON response | Parse error → return PARSE_ERROR |
| 7 | Record responseTime metric | — |
| 8 | Return content to caller | — |

### 6.3 Health Check Polling

**Trigger:** Timer fires every healthInterval ms
**Schedule:** Every 5000ms (configurable)
**Input:** Current ConnectionState
**Output:** Updated ConnectionState

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | GET /health with 3s timeout | Timeout → mark as failed |
| 2 | If response OK and state==CONNECTED | No action (normal) |
| 3 | If response OK and state==DISCONNECTED | Transition to CONNECTED, re-register tools |
| 4 | If response fails and state==CONNECTED | Transition to DISCONNECTED, start reconnect |
| 5 | If response fails and state==DISCONNECTED | Increment backoff, schedule next retry |

### 6.4 Exponential Backoff Reconnection

**Trigger:** Backend becomes unavailable (health check failure)
**Input:** Current reconnectAttempts, reconnectDelay
**Output:** Reconnection or max-attempts-reached

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Set initial delay = 1000ms, attempts = 0 | — |
| 2 | Wait for current delay | — |
| 3 | GET /health | — |
| 4 | If healthy → reconnect (UC-4 Main Flow Step 4+) | — |
| 5 | If still unhealthy → delay = min(delay * 2, 30000) | — |
| 6 | attempts++ | If attempts >= 100 → stop polling, show "unreachable" |
| 7 | Go to Step 2 | — |

---

## 7. Security Requirements

### 7.1 Authentication & Authorization

| Role | Permissions | Screens/Features |
|------|-------------|-------------------|
| Developer (local user) | Full access | All tools, all panels |
| IDE Agent | Tool execution | All MCP tools via proxy |

**Note:** No authentication between Extension and Backend — trusted localhost communication only. Backend binds to 127.0.0.1 exclusively (BR-35).

### 7.2 Data Sensitivity Classification

| Data Type | Classification | Business Requirement |
|-----------|---------------|---------------------|
| Source code (indexed) | Confidential | Never leaves localhost — Backend processes locally |
| Embeddings (vectors) | Internal | Generated and stored locally in SQLite |
| Tool call arguments | Internal | May contain code snippets — localhost only |
| Health check data | Public | No sensitive info in health response |

### 7.3 Security Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-35 | Backend MUST bind to 127.0.0.1 only (no network exposure) | BRD NFR |
| BR-36 | No authentication required for localhost communication | BRD NFR |
| BR-37 | Backend MUST NOT expose any endpoint on 0.0.0.0 | Security requirement |
| BR-38 | Extension MUST validate Backend response is well-formed JSON | Defense in depth |

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance — Activation | Extension activates instantly | activate() returns in <2s |
| Performance — Proxy Latency | Tool calls feel instant | <50ms overhead (p99) on localhost |
| Performance — Backend Startup | Backend loads quickly | <10s including ONNX model load |
| Size — Extension | Tiny install from marketplace | .vsix < 5MB |
| Size — Backend | Reasonable download | Backend package < 250MB |
| Reliability — Crash Isolation | IDE never crashes from Backend failure | Separate OS process |
| Reliability — Recovery | Auto-recover without user action | Reconnect within 30s |
| Availability — Health Check | Quick failure detection | Poll every 5s |
| Compatibility — VS Code | Support current VS Code | >= 1.85.0 |
| Compatibility — Node.js | Backend runtime | >= 18.0 |
| Compatibility — OS | Cross-platform | Windows, macOS, Linux |
| Observability | User knows connection state | Status bar: Connected/Disconnected/Connecting |

---

## 9. Error Handling (User-Facing)

### 9.1 Error Scenarios

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| Backend not installed | Critical | "Code Intelligence Backend not found. Install it to enable AI tools." | Show install instructions link |
| Backend failed to start | Critical | "Backend failed to start. Check output channel for details." | Open output channel button |
| Backend disconnected | Warning | "Backend disconnected. Reconnecting..." | Status bar yellow, auto-retry |
| Backend unreachable (100 retries) | Critical | "Backend unreachable. Click to retry." | Status bar red, manual retry |
| Tool call timeout | Warning | "Tool call timed out. Backend may be overloaded." | Suggest retry |
| Version incompatible | Warning | "Backend v{X} may be incompatible. Consider updating." | Link to update |
| Port conflict | Critical | "Port {N} in use. Configure a different port in settings." | Open settings link |
| Configuration invalid | Critical | "Invalid configuration: {field}. Check extension settings." | Open settings |

### 9.2 Error Code Table

| Code | Severity | Category | User Message | System Action |
|------|----------|----------|-------------|---------------|
| ERR-001 | Critical | Connection | Backend not installed | Show notification + install link |
| ERR-002 | Critical | Connection | Backend failed to start | Log error + show output channel |
| ERR-003 | Warning | Connection | Backend disconnected | Auto-reconnect with backoff |
| ERR-004 | Critical | Connection | Backend unreachable | Stop polling, offer manual retry |
| ERR-005 | Warning | Proxy | Tool call timeout | Return timeout error to caller |
| ERR-006 | Warning | Proxy | Tool call failed (5xx) | Forward error as-is |
| ERR-007 | Info | Version | Backend version mismatch | Show info notification |
| ERR-008 | Critical | Config | Port conflict | Suggest port change |
| ERR-009 | Critical | Config | Invalid configuration | Highlight bad setting |
| ERR-010 | Warning | Webview | API data fetch failed | Show retry button in panel |

### 9.3 Notification Requirements

| Event | Who is Notified | Channel | Timing |
|-------|----------------|---------|--------|
| Backend crashed | Developer | Status bar + notification | Immediate |
| Backend reconnected | Developer | Status bar + output log | Immediate |
| Version incompatible | Developer | Notification (once per session) | On connect |
| Backend unreachable | Developer | Status bar (persistent) | After 100 retries |

---

## 10. Testing Considerations

### 10.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-1 | Extension activates in <2s | Install extension, measure activation | activate() < 2000ms | High |
| TC-2 | Extension .vsix < 5MB | Build extension package | File size < 5MB | High |
| TC-3 | Proxy forwards tool call correctly | Call mem_search("test") | Same result as direct Backend call | High |
| TC-4 | Proxy latency < 50ms | Measure round-trip for 100 calls | p99 < 50ms | High |
| TC-5 | All 52 tools registered | Check tool list after activation | 52 tools available | High |
| TC-6 | Backend crash doesn't kill extension | Kill Backend PID | Extension stays active, shows "Disconnected" | High |
| TC-7 | In-flight request gets error on crash | Kill Backend during tool call | Error returned within 10s | High |
| TC-8 | Auto-reconnect after Backend restart | Stop Backend, wait 10s, start Backend | Extension reconnects within 5s | High |
| TC-9 | Exponential backoff timing | Observe retry delays | 1s, 2s, 4s, 8s, 16s, 30s, 30s... | Medium |
| TC-10 | Dashboard panel loads data | Open Dashboard | Shows metrics from /api/dashboard | Medium |
| TC-11 | KB Graph renders | Open KB Graph | Visualization with nodes/edges from API | Medium |
| TC-12 | Version compatibility warning | Connect to incompatible Backend | Warning notification shown | Medium |
| TC-13 | Port conflict handling | Start Backend on occupied port | Falls back to next port or shows error | Medium |
| TC-14 | No ONNX/SQLite in extension | Inspect .vsix contents | Zero native binary files | High |
| TC-15 | Backend binds localhost only | Check network listeners | 127.0.0.1 only, not 0.0.0.0 | High |

---

## 11. Appendix

### State Machine: Connection State

![Connection State Machine](diagrams/state-connection.png)
*[Edit in draw.io](diagrams/state-connection.drawio)*

States: DISCONNECTED → CONNECTING → CONNECTED → STARTING (if auto-start)

Transitions:
- DISCONNECTED → CONNECTING: reconnect timer fires
- CONNECTING → CONNECTED: health check succeeds
- CONNECTING → DISCONNECTED: health check fails (increment backoff)
- CONNECTED → DISCONNECTED: health check fails / Backend crash detected
- DISCONNECTED → STARTING: auto-start enabled, Backend not running
- STARTING → CONNECTING: Backend process spawned, waiting for health
- STARTING → DISCONNECTED: Backend failed to start (timeout)

### Sequence: Proxy Call Flow

![Proxy Call Sequence](diagrams/sequence-proxy-call.png)
*[Edit in draw.io](diagrams/sequence-proxy-call.drawio)*

### Sequence: Reconnect Flow

![Reconnect Sequence](diagrams/sequence-reconnect.png)
*[Edit in draw.io](diagrams/sequence-reconnect.drawio)*

### Business Rules Summary

| Rule ID | Rule | Category |
|---------|------|----------|
| BR-1 | activate() returns within 2s | Performance |
| BR-2 | Extension .vsix < 5MB | Size |
| BR-3 | No ONNX/SQLite/native binaries in Extension | Size |
| BR-4 | Backend starts asynchronously | Startup |
| BR-5 | Degraded mode when Backend unavailable | Reliability |
| BR-6 | All 52 tools proxied | Functional |
| BR-7 | Tool schemas identical to monolith | Compatibility |
| BR-8 | Proxy latency < 50ms (p99) | Performance |
| BR-9 | Error responses forwarded as-is | Transparency |
| BR-10 | find_tools returns same results | Compatibility |
| BR-11 | Tool discovery from Backend | Architecture |
| BR-12 | Backend crash doesn't affect Extension | Isolation |
| BR-13 | Crash detected within 5s | Detection |
| BR-14 | In-flight requests error within 10s | Timeout |
| BR-15 | Status bar reflects connection state | Observability |
| BR-16 | No VS Code error dialogs from Backend crash | Isolation |
| BR-17 | Exponential backoff: 1s→2s→4s→8s→max 30s | Recovery |
| BR-18 | Reconnect within 5s of Backend available | Recovery |
| BR-19 | No manual action for reconnection | UX |
| BR-20 | Reconnection logged in output channel | Observability |
| BR-21 | Tools functional after reconnect (no IDE restart) | Recovery |
| BR-22 | Webview HTML/CSS in Extension bundle | Architecture |
| BR-23 | Backend provides JSON-only data endpoints | Architecture |
| BR-24 | All 5 panels work via proxy | Functional |
| BR-25 | Panels refresh after reconnection | Recovery |
| BR-26 | Independent Backend semver | Versioning |
| BR-27 | Version check on every connect | Versioning |
| BR-28 | Incompatible version = warning only | Versioning |
| BR-29 | No marketplace submission for Backend updates | Deployment |
| BR-30 | Backend version in status tooltip | Observability |
| BR-31 | Zero vscode imports in Backend | Architecture |
| BR-32 | No IDE concepts in Backend API | Architecture |
| BR-33 | API docs sufficient for alt frontend | Documentation |
| BR-34 | Clear extension/ vs backend/ separation | Architecture |
| BR-35 | Backend binds 127.0.0.1 only | Security |
| BR-36 | No auth for localhost | Security |
| BR-37 | No 0.0.0.0 binding | Security |
| BR-38 | Validate Backend response JSON | Security |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Proxy Call Sequence | [sequence-proxy-call.png](diagrams/sequence-proxy-call.png) | [sequence-proxy-call.drawio](diagrams/sequence-proxy-call.drawio) |
| 3 | Reconnect Sequence | [sequence-reconnect.png](diagrams/sequence-reconnect.png) | [sequence-reconnect.drawio](diagrams/sequence-reconnect.drawio) |
| 4 | Connection State Machine | [state-connection.png](diagrams/state-connection.png) | [state-connection.drawio](diagrams/state-connection.drawio) |

### Change Log from BRD

- No deviations from BRD. All 7 stories fully specified as Use Cases (UC-1 through UC-7).
- Added Business Rules BR-35 through BR-38 for security hardening (implied by BRD NFRs).
- Explicit error code table added (ERR-001 through ERR-010) for developer implementation guidance.
