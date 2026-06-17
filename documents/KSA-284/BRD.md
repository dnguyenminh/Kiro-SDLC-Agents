# Business Requirements Document (BRD)

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
| Architecture Pattern | Plugin (IDE Extension) |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | SA Agent – Solution Architect | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-11 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-284 |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

This change request restructures the existing monolithic code-intelligence VS Code/Kiro extension into a two-part architecture:

1. **Lightweight Extension (Thin Proxy)** — A minimal IDE extension (~2MB) that registers MCP tools with the IDE, forwards ALL requests to the Backend, renders Webview UIs (Dashboard, KB Graph, Analytics), manages VS Code/Kiro API bindings, and handles connection lifecycle. Contains **zero business logic**.

2. **Backend MCP Server (Heavy Logic)** — A standalone process exposing an HTTP endpoint that handles all heavy operations: Memory management (SQLite + ONNX embeddings), Code Intelligence (indexing, symbols, search), Orchestration (child servers: Jira, Draw.io, Export), Knowledge Graph operations, Analytics/Quality scoring, and Agent logging.

The goal is to decouple IDE-specific concerns from core business logic, dramatically reducing extension size (200MB → less than 5MB), improving startup time (10s → less than 2s), enabling crash-proof operation, multi-IDE support, and independent update cycles.

### 1.2 Out of Scope

- Rewriting backend business logic (stays as-is, just re-hosted)
- Adding new MCP tools or features (functional parity with current monolith)
- Multi-machine deployment (Backend runs on same machine initially)
- Authentication/authorization between Extension and Backend (localhost trust)
- Supporting IDEs other than VS Code/Kiro in this phase (architecture enables it, but only VS Code/Kiro delivered)
- Cloud/remote Backend deployment

### 1.3 Preliminary Requirement

- Current monolithic extension must be fully functional (baseline for parity testing)
- All existing MCP tools documented (tool-list.txt serves as inventory)
- Existing Webview panels (Dashboard, KB Graph, Analytics) functional
- Backend process management strategy agreed upon (OS process, Docker, or embedded)

---

## 2. Business Requirements

### 2.1 High Level Process Map

The current extension runs everything in a single VS Code extension host process — ONNX model (~180MB), SQLite database, code indexer, MCP orchestrator, and Webview rendering all compete for resources within the same process. This causes:

- **Slow startup** (~10s to load ONNX model)
- **Large install size** (~200MB including native binaries)
- **Crash propagation** (ONNX failure kills entire extension)
- **IDE lock** (heavy operations block UI responsiveness)
- **Update friction** (backend logic changes require full extension republish)

The new architecture splits concerns:

**Step 1:** User installs Lightweight Extension from marketplace (~2MB)

**Step 2:** Extension starts → detects Backend availability via health check endpoint

**Step 3:** If Backend not running → Extension auto-starts Backend process (or prompts user)

**Step 4:** Extension registers MCP tool proxies with IDE (same tool names, same schemas)

**Step 5:** IDE/Agent calls MCP tool → Extension forwards request to Backend via HTTP

**Step 6:** Backend processes request (memory, code intel, orchestration) → returns response

**Step 7:** Extension relays response back to IDE/Agent

**Step 8:** For Webview UIs, Extension fetches data from Backend APIs, renders in VS Code panels

> **Note:** The proxy is fully transparent — callers (IDE, agents, users) see no behavioral difference. All existing tool names, parameters, and responses remain identical.

![Business Flow](diagrams/business-flow.png)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a developer, I want the extension to install in less than 5s and activate in less than 2s so that my IDE starts quickly | MUST HAVE | KSA-284 |
| 2 | As a developer, I want all existing MCP tools to work transparently through the proxy so that my workflow is unchanged | MUST HAVE | KSA-284 |
| 3 | As a developer, I want the Backend to crash without killing my IDE extension so that I maintain IDE stability | MUST HAVE | KSA-284 |
| 4 | As a developer, I want the extension to auto-reconnect when Backend restarts so that I don't need manual intervention | MUST HAVE | KSA-284 |
| 5 | As a developer, I want Dashboard/KB Graph/Analytics/Tags/Quality UIs to work via the proxy so that all visual features remain available | MUST HAVE | KSA-284 |
| 6 | As a platform maintainer, I want to update Backend independently from Extension so that I can ship fixes without marketplace review | SHOULD HAVE | KSA-284 |
| 7 | As a platform maintainer, I want the architecture to support multiple IDE frontends so that we can expand to other editors in the future | SHOULD HAVE | KSA-284 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Extension activates → checks Backend health endpoint (`GET /health`)

**Step 2:** If healthy → register all MCP tool proxies with IDE

**Step 3:** If unhealthy/unavailable → spawn Backend process → wait for health → register tools

**Step 4:** Agent/User invokes MCP tool (e.g., `mem_search`, `code_search`, `find_tools`)

**Step 5:** Extension serializes request → HTTP POST to Backend (`/mcp/tools/call`)

**Step 6:** Backend executes tool → returns JSON response

**Step 7:** Extension deserializes response → returns to IDE/Agent

**Step 8:** For Webview requests (Dashboard, KB Graph, Analytics) → Extension fetches from Backend REST APIs → renders HTML in Webview panel

**Step 9:** If Backend connection lost → Extension shows degraded state → retries with exponential backoff → auto-reconnects when Backend available

---

#### STORY 1: Fast Extension Install and Activation

> As a developer, I want the extension to install in less than 5s and activate in less than 2s so that my IDE starts quickly.

**Requirement Details:**

1. Extension package size MUST be less than 5MB (excludes Backend)
2. Extension activation MUST complete within 2 seconds
3. Extension MUST NOT bundle ONNX models, SQLite binaries, or heavy native dependencies
4. Extension MUST only contain: proxy logic, Webview HTML/JS/CSS, VS Code API bindings, connection management code
5. Backend can start asynchronously (extension activates before Backend is ready)

**Acceptance Criteria:**

1. Extension .vsix file is less than 5MB
2. `activate()` function returns in less than 2 seconds (measured via VS Code Extension Host profiler)
3. No ONNX, SQLite, or native binary files present in extension bundle
4. Extension shows "Connecting to Backend..." status while Backend starts

---

#### STORY 2: Transparent MCP Tool Proxying

> As a developer, I want all existing MCP tools to work transparently through the proxy so that my workflow is unchanged.

**Requirement Details:**

1. ALL tools listed in `tool-list.txt` MUST be available through the proxy
2. Tool names, parameter schemas, and response formats MUST be identical to current behavior
3. Proxy adds less than 50ms latency per tool call (excluding Backend processing time)
4. Tools forwarded include:
   - Memory tools: `mem_search`, `mem_ingest`, `mem_ingest_file`, `mem_pin`, `mem_map`, `mem_crud`, `mem_graph`, `mem_consolidate`, `mem_lifecycle`, `mem_templates`, `mem_attachments`, `mem_discover`, `mem_tags`, `mem_citations`, `mem_conversation`, `mem_scoring`, `mem_admin`
   - Code Intelligence tools: `code_search`, `code_symbols`, `code_context`, `code_modules`, `code_index_status`, `code_kb_export`, `code_callers`, `code_callees`, `code_dependencies`, `code_impact`, `code_traverse`, `complexity_analysis`, `find_entry_points`, `find_circular_deps`, `find_related_tests`, `find_hot_paths`, `find_dead_imports`, `module_summary`, `get_ai_context`, `get_edit_context`, `get_curated_context`, `find_duplicates`, `find_dead_code`, `git_search`, `git_index`
   - Orchestration tools: `find_tools`, `execute_dynamic_tool`, `toggle_tool`, `reset_tools`, `manage_auto_approve`, `orchestration_status`
   - Utility tools: `agent_log`, `stream_write_file`, `drawio_auto_layout`, `drawio_export_png`

5. Error responses from Backend MUST be forwarded as-is (no wrapping or transformation)

**Acceptance Criteria:**

1. All 52 tools from tool-list.txt return identical responses via proxy vs direct Backend call
2. Proxy latency overhead less than 50ms (measured p99)
3. Tool discovery (`find_tools`) returns same results through proxy
4. Error codes and messages preserved exactly

---

#### STORY 3: Crash Isolation

> As a developer, I want the Backend to crash without killing my IDE extension so that I maintain IDE stability.

**Requirement Details:**

1. Backend runs as a separate OS process (not in extension host)
2. Backend crash MUST NOT trigger VS Code extension error/reload
3. Extension detects Backend crash within 5 seconds (health check polling)
4. Extension shows clear status indicator when Backend is down
5. Queued/in-flight requests receive timeout error (not hang indefinitely)

**Acceptance Criteria:**

1. Kill Backend process → Extension remains active, shows "Backend disconnected" status
2. In-flight tool calls return error within 10 seconds (not hang)
3. No VS Code error dialogs triggered by Backend crash
4. Extension status bar shows connection state (Connected / Disconnected)

---

#### STORY 4: Auto-Reconnect

> As a developer, I want the extension to auto-reconnect when Backend restarts so that I don't need manual intervention.

**Requirement Details:**

1. Extension polls health endpoint with exponential backoff (1s, 2s, 4s, 8s, max 30s)
2. When Backend becomes healthy again, Extension automatically re-registers tools
3. No manual user action required to restore functionality
4. Extension logs reconnection events for debugging
5. Optional: Extension can auto-restart Backend if configured

**Acceptance Criteria:**

1. Stop Backend → wait 10s → start Backend → Extension auto-reconnects within 5 seconds
2. All tools functional again after reconnection without IDE restart
3. Status indicator transitions: Connected → Disconnected → Connected automatically
4. Reconnection logged in Extension output channel

---

#### STORY 5: Webview UI Proxying

> As a developer, I want Dashboard/KB Graph/Analytics/Tags/Quality UIs to work via the proxy so that all visual features remain available.

**Requirement Details:**

1. Extension renders Webview panels using data fetched from Backend REST APIs
2. APIs forwarded:
   - KB Graph: `GET /api/kb/graph`
   - Analytics: `GET /api/analytics/*`
   - Dashboard: `GET /api/dashboard/*`
   - Tags: `GET /api/tags/*`
   - Quality: `GET /api/quality/*`
3. Webview HTML/JS/CSS remains in the Extension (rendering is frontend concern)
4. Backend only provides JSON data endpoints
5. Real-time updates via polling or WebSocket (from Backend events)

**Acceptance Criteria:**

1. Dashboard panel shows same data as current monolithic version
2. KB Graph visualization renders correctly with data from Backend API
3. Analytics charts populate from Backend API responses
4. Tags management CRUD operations work through proxy
5. Quality scores display correctly

---

#### STORY 6: Independent Backend Updates

> As a platform maintainer, I want to update Backend independently from Extension so that I can ship fixes without marketplace review.

**Requirement Details:**

1. Backend is a separate distributable (binary, JAR, or npm package)
2. Backend version can differ from Extension version (semver compatible)
3. Extension checks Backend version on connect, warns if incompatible
4. Backend update mechanism: auto-download, manual download, or package manager
5. Version compatibility matrix documented

**Acceptance Criteria:**

1. Update Backend binary → restart → Extension reconnects with new version
2. Extension shows Backend version in status/about
3. Incompatible version → Extension shows warning with upgrade instructions
4. No marketplace submission needed for Backend-only changes

---

#### STORY 7: Multi-IDE Architecture Readiness

> As a platform maintainer, I want the architecture to support multiple IDE frontends so that we can expand to other editors in the future.

**Requirement Details:**

1. Backend HTTP API is IDE-agnostic (no VS Code-specific concepts in API)
2. Tool registration protocol is documented and generic
3. Extension-specific code (VS Code APIs) isolated in thin adapter layer
4. Backend does not import or depend on any IDE SDK
5. A new IDE frontend only needs to implement: tool proxy, Webview rendering, connection management

**Acceptance Criteria:**

1. Backend has zero imports from `vscode` or any IDE SDK
2. API documentation sufficient to build alternative frontend
3. Clear separation: `extension/` (IDE-specific) vs `backend/` (IDE-agnostic)
4. Architecture diagram shows pluggable frontend layer

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| VS Code Extension API | System | N/A | Required for tool registration, Webview panels, status bar |
| Node.js runtime | Infrastructure | N/A | Backend MCP Server runtime environment |
| SQLite + better-sqlite3 | System | N/A | Backend data persistence (moved from extension) |
| ONNX Runtime | System | N/A | Backend embedding generation (moved from extension) |
| HTTP framework | System | N/A | Backend HTTP server (Express, Fastify, or Hono) |
| Existing MCP orchestration | System | N/A | Backend orchestrates child MCP servers (Jira, Draw.io, Export) |
| Current extension codebase | System | N/A | Source of business logic to extract into Backend |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Product Owner | Extension Team Lead | Approve requirements, UAT | Ticket reporter |
| Developer | Extension Dev Team | Implement split architecture | Ticket assignee |
| End Users | Developers using IDE | Validate transparent operation | Watchers |
| DevOps | Platform Team | Backend distribution and updates | Related |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Network latency between Extension and Backend adds noticeable delay | Medium | Low | Backend runs on localhost, latency negligible (less than 5ms) |
| Backend process management complexity on different OS | High | Medium | Use well-tested child_process spawn with platform-specific handling |
| Existing tool contracts broken during split | High | Medium | Comprehensive parity testing (all 52 tools) |
| Webview data fetching introduces new failure modes | Medium | Medium | Graceful degradation — show cached data or "Backend unavailable" |
| Backend port conflicts with other local services | Low | Medium | Configurable port with auto-detection fallback |
| Extension marketplace size limit changes | Low | Low | Current limit well above 5MB target |

### 5.2 Assumptions

- Backend and Extension run on the same machine (localhost communication)
- Users have sufficient permissions to spawn child processes
- HTTP transport is acceptable (no need for Unix sockets or shared memory)
- Current tool-list.txt is the definitive inventory of tools to proxy
- Backend startup time (including ONNX model load) is acceptable at ~5-10s (async, non-blocking)
- VS Code/Kiro extension host has no restrictions on outbound HTTP to localhost

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Extension activation less than 2s | Measured from `activate()` call to tool registration complete |
| Performance | Proxy latency less than 50ms overhead | HTTP round-trip to localhost Backend (p99) |
| Performance | Backend startup less than 10s | Including ONNX model load and SQLite initialization |
| Size | Extension package less than 5MB | .vsix file size (excludes Backend) |
| Size | Backend package less than 250MB | Includes ONNX model, SQLite, native binaries |
| Reliability | Backend crash does not affect Extension | Process isolation via OS-level separation |
| Reliability | Auto-reconnect within 30s | After Backend restart, Extension reconnects automatically |
| Reliability | Health check interval: 5s | Extension polls Backend health every 5 seconds |
| Compatibility | VS Code >= 1.85.0 | Minimum supported VS Code version |
| Compatibility | Node.js >= 18.0 | Backend runtime requirement |
| Compatibility | Windows, macOS, Linux | All platforms supported |
| Security | Localhost-only binding | Backend binds to 127.0.0.1 only (no network exposure) |
| Security | No auth required | Trusted localhost communication |
| Maintainability | Independent versioning | Backend and Extension follow separate semver |
| Observability | Connection state visible | Status bar indicator: Connected/Disconnected/Connecting |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-284 | Split Extension: Lightweight Proxy + Backend MCP Server | To Do | Story | Main ticket |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| MCP | Model Context Protocol — standard for AI tool integration |
| ONNX | Open Neural Network Exchange — ML model format used for text embeddings |
| Extension Host | VS Code process that runs extensions |
| Webview | VS Code panel that renders HTML content |
| Thin Proxy | Extension pattern where frontend only forwards requests |
| Health Check | HTTP endpoint that reports service availability |
| Exponential Backoff | Retry strategy with increasing wait times |
| Orchestration | Pattern where a parent server manages child MCP servers |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| Current Tool List | .code-intel/tool-list.txt |
| Orchestration Config | .code-intel/orchestration.json |
| VS Code Extension API | https://code.visualstudio.com/api |
| MCP Specification | https://modelcontextprotocol.io |

### Tool Inventory (Complete)

| Category | Tools | Count |
|----------|-------|-------|
| Memory | mem_search, mem_ingest, mem_ingest_file, mem_pin, mem_map, mem_crud, mem_graph, mem_consolidate, mem_lifecycle, mem_templates, mem_attachments, mem_discover, mem_tags, mem_citations, mem_conversation, mem_scoring, mem_admin | 17 |
| Code Intelligence | code_search, code_symbols, code_context, code_modules, code_index_status, code_kb_export, code_callers, code_callees, code_dependencies, code_impact, code_traverse, complexity_analysis, find_entry_points, find_circular_deps, find_related_tests, find_hot_paths, find_dead_imports, module_summary, get_ai_context, get_edit_context, get_curated_context, find_duplicates, find_dead_code, git_search, git_index | 25 |
| Orchestration | find_tools, execute_dynamic_tool, toggle_tool, reset_tools, manage_auto_approve, orchestration_status | 6 |
| Utility | agent_log, stream_write_file, drawio_auto_layout, drawio_export_png | 4 |
| **Total** | | **52** |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
