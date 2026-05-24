# Functional Specification Document (FSD)

## Kiro SDLC Agents Extension — KSA-120: Bundle MCP NodeJS Server + Native VS Code Webview KB Panels

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-120 |
| Title | Bundle MCP NodeJS Server + Native VS Code Webview KB Panels |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-05-23 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-120.docx |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create FSD draft (business sections) |
| Technical Reviewer | TA Agent – Technical Analyst | Enrich with API contracts, technical depth |
| Peer Reviewer | SA Agent – Solution Architect | Review technical feasibility |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-05-23 | BA Agent + TA Agent | Initial FSD — business flows + technical enrichment |
| 1.1 | 2025-05-24 | BA Agent | Updated for HTTP transport, port 9180, Stop/Start/Change Port commands |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the v2.0.0 upgrade to the `kiro-sdlc-agents` VS Code extension. It details:
- How the bundled MCP NodeJS server is managed (lifecycle, communication, error recovery)
- How native VS Code Webview panels replace the iframe-based KB viewer
- How the sidebar Activity Bar provides navigation
- How backward compatibility is maintained for all existing features

### 1.2 Scope

**In Scope:**
- MCP server bundling, spawning, lifecycle management
- 5 native Webview panels (Graph, Dashboard, Tags, Quality, Analytics)
- Sidebar tree view with Activity Bar icon
- 7 new commands + preservation of 6 existing commands
- Auto-inject mcp.json configuration
- Graceful error handling and crash recovery

**Out of Scope:**
- MCP server internal logic changes (32 tools unchanged)
- Agent prompt modifications
- Python/Kotlin MCP variant changes
- Mobile/web extension support

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| MCP | Model Context Protocol — standard for AI tool communication |
| KB | Knowledge Base — local SQLite database managed by MCP server |
| Webview | VS Code API for rendering custom HTML/JS/CSS panels |
| stdio | Standard I/O — communication via stdin/stdout pipes |
| HTTP transport | JSON-RPC over HTTP to localhost:port |
| WAL | Write-Ahead Logging — SQLite journaling mode |
| FTS5 | SQLite Full-Text Search extension version 5 |
| ELK | Eclipse Layout Kernel — graph layout algorithm |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-120.docx |
| Extension Source | kiro-sdlc-agents/src/ |
| MCP Server Source | mcp-code-intelligence-nodejs/ |
| VS Code Webview API | https://code.visualstudio.com/api/extension-guides/webview |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

The extension operates within VS Code's extension host process and manages a child MCP server process. External actors:
- **Developer (User)** — interacts via commands, sidebar, webview panels
- **VS Code Extension Host** — provides APIs for commands, webview, tree view, output channels
- **MCP Server (Child Process)** — provides 32 KB/code intelligence tools via HTTP (localhost:9180)
- **File System** — workspace files, .kiro config, .code-intel database
- **Kiro IDE Agents** — consume MCP tools via mcp.json configuration

### 2.2 System Architecture (High-Level)

![Architecture Overview](diagrams/architecture.png)

---

## 3. Functional Requirements

### 3.1 Feature: MCP Server Lifecycle Management

**Source:** BRD Stories 1, 2, 3, 4, 11

#### 3.1.1 Description

The extension bundles the MCP NodeJS server (`mcp-code-intelligence-nodejs/dist/`) and manages its complete lifecycle: spawn on activation, monitor health, auto-restart on crash, kill on deactivation, and manual restart via command.

#### 3.1.2 Use Cases

---

**Use Case ID:** UC-01
**Name:** Auto-Spawn MCP Server on Activation
**Actor:** VS Code (system trigger)
**Preconditions:** Extension installed, workspace folder open
**Postconditions:** MCP server running, mcp.json configured

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | VS Code | | Extension activates (workspace open or command invoked) |
| 2 | | Extension | Verify bundled server exists at `{extensionPath}/mcp-server/index.js` |
| 3 | | Extension | Spawn child process: `node {extensionPath}/mcp-server/index.js --config {workspace}/.code-intel/orchestration.json` |
| 4 | | Extension | Set env: `CODE_INTEL_WORKSPACE={workspace}`, server starts HTTP on port 9180 |
| 5 | | Extension | Capture stdout/stderr → Output channel "Kiro SDLC: MCP Server" |
| 6 | | Extension | Wait for server ready signal (HTTP health check on port 9180 within 5s) |
| 7 | | Extension | Update serverStatus = "running", update status bar |
| 8 | | Extension | Write/update `.kiro/settings/mcp.json` with bundled server config |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01a | Server already running (extension re-activated) | Skip spawn, verify existing process alive via PID |
| AF-01b | User has custom mcp.json with different server | Prompt user: "Update MCP config to use bundled server?" — if No, skip mcp.json write |
| AF-01c | Workspace has no .code-intel folder | Create `.code-intel/` directory, proceed with spawn |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01a | Bundled server files missing | Show error: "MCP server bundle not found. Reinstall extension." Set serverStatus = "stopped" |
| EF-01b | Node.js not available or < v20 | Show error: "Node.js 20+ required for bundled MCP server." Set serverStatus = "stopped" |
| EF-01c | Server fails to start within 5s | Log error, set serverStatus = "crashed", trigger auto-restart (UC-03) |
| EF-01d | Port/resource conflict | Log specific error, show notification with details |

---

**Use Case ID:** UC-02
**Name:** Manual Restart/Stop/Start MCP Server
**Actor:** Developer
**Preconditions:** Extension active
**Postconditions:** MCP server in requested state (running or stopped)

**Main Flow (Restart):**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Execute command "Kiro SDLC: Restart MCP Server" |
| 2 | | Extension | Show progress notification "Restarting MCP Server..." |
| 3 | | Extension | Send SIGTERM to current server process |
| 4 | | Extension | Wait up to 5s for graceful shutdown |
| 5 | | Extension | If still alive after 5s → send SIGKILL |
| 6 | | Extension | Reset restartCount = 0 |
| 7 | | Extension | Spawn new server process (same as UC-01 steps 3-7) |
| 8 | | Extension | Notify all open webview panels to reconnect |
| 9 | | Extension | Show success notification "MCP Server restarted" |

**Alternative Flow (Stop):**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Execute command "Kiro SDLC: Stop MCP Server" |
| 2 | | Extension | Send SIGTERM → wait 5s → SIGKILL if needed |
| 3 | | Extension | Set serverStatus = "stopped" (no auto-restart) |
| 4 | | Extension | Notify panels: serverStatus = "disconnected" |
| 5 | | Extension | Update sidebar tree: show ▶️ Start Server |

**Alternative Flow (Start):**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Execute command "Kiro SDLC: Start MCP Server" |
| 2 | | Extension | If server already running → show info "Server already running" |
| 3 | | Extension | Spawn new server process (UC-01 steps 3-7) |
| 4 | | Extension | Notify panels: serverStatus = "connected" |

**Alternative Flow (Change Port):**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Execute command "Kiro SDLC: Change MCP Port..." |
| 2 | | Extension | Show input box with current port as placeholder |
| 3 | Developer | | Enter new port number |
| 4 | | Extension | Validate: numeric, range 1024-65535 |
| 5 | | Extension | Write new port to `.kiro/settings/mcp.json` |
| 6 | | Extension | Restart server with new port (UC-02 Restart flow) |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-02a | New process fails to start | Show error notification, set serverStatus = "crashed" |
| EF-02b | Kill fails (process already dead) | Skip kill, proceed to spawn |

---

**Use Case ID:** UC-03
**Name:** Auto-Restart on Crash
**Actor:** System (health monitor)
**Preconditions:** Server was running, process exited unexpectedly
**Postconditions:** Server restarted or max retries reached

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Extension | Detect process exit (exit event on ChildProcess) |
| 2 | | Extension | Check exit code — if 0 (graceful), do not restart |
| 3 | | Extension | Set serverStatus = "crashed", record lastCrashTime |
| 4 | | Extension | Increment restartCount |
| 5 | | Extension | Calculate backoff: attempt 1 = 5s, attempt 2 = 15s, attempt 3 = 30s |
| 6 | | Extension | Wait backoff duration |
| 7 | | Extension | Spawn new server process (UC-01 steps 3-7) |
| 8 | | Extension | If success → reset restartCount, show warning "MCP server restarted" |
| 9 | | Extension | Notify webview panels to reconnect |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-03a | restartCount >= 3 | Stop retrying, show error "MCP server failed after 3 restart attempts. Use 'Restart MCP Server' command to retry manually." Set serverStatus = "stopped" |

---

**Use Case ID:** UC-04
**Name:** Auto-Inject mcp.json Configuration
**Actor:** System (on activation)
**Preconditions:** Extension activated, workspace folder exists
**Postconditions:** `.kiro/settings/mcp.json` contains bundled server config

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Extension | Check if `.kiro/settings/mcp.json` exists |
| 2 | | Extension | If not exists → create with bundled server config |
| 3 | | Extension | If exists → read and parse JSON |
| 4 | | Extension | Check if `mcpServers.code-intelligence` key exists |
| 5 | | Extension | If key doesn't exist → add bundled server entry |
| 6 | | Extension | If key exists with bundled server path → no-op |
| 7 | | Extension | Write updated mcp.json |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-04a | Key exists with different command (npx/uvx/java) | Prompt user: "Update MCP config to use bundled server? (Current: {command})" If Yes → overwrite. If No → keep existing. |
| AF-04b | mcp.json has other servers (not code-intelligence) | Preserve all other entries, only add/update `code-intelligence` |

---

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-01 | Server MUST start within 5 seconds of extension activation (HTTP ready on port 9180) | BRD Story 2 AC-1 |
| BR-02 | Max 3 auto-restart attempts with exponential backoff (5s, 15s, 30s) | BRD Story 2 |
| BR-03 | Extension deactivate MUST kill server (SIGTERM → 5s → SIGKILL) | BRD Story 2 AC-5 |
| BR-04 | No orphan processes after VS Code closes | BRD Story 2 AC-6 |
| BR-05 | NEVER overwrite user's custom mcp.json without confirmation | BRD Story 4 AC-2 |
| BR-06 | Core inject/update/status commands MUST work without MCP server | BRD Story 11 AC-5 |
| BR-07 | Server process tied to extension lifecycle — deactivate = kill | BRD Story 2 |
| BR-08 | Manual restart resets auto-restart counter | BRD Story 3 |
| BR-09 | Extension package size MUST be < 50MB including native addons | BRD Story 1 AC-4 |
| BR-10 | better-sqlite3 native addon MUST work on win-x64, mac-arm64, linux-x64 | BRD Story 1 AC-3 |
| BR-10a | Default port is 9180, configurable in `.kiro/settings/mcp.json` | BRD Story 2 |
| BR-10b | If configured port is busy → show error, do NOT fallback to random port | BRD Story 2 |
| BR-10c | Extension monitors `.kiro/settings/mcp.json` — auto-restart on config change | BRD Story 2 |
| BR-10d | Invalid config or missing server entry → warning badge on Activity Bar icon | BRD Story 2 |

#### 3.1.4 Data Specifications

**Server State Model:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| serverProcess | ChildProcess | null | No | — | Reference to spawned Node.js process |
| serverStatus | enum | Yes | One of: "starting", "running", "crashed", "stopped" | Current server state |
| restartCount | number | Yes | 0-3 | Number of restart attempts since last success |
| lastCrashTime | Date | null | No | Valid ISO date | Timestamp of last crash |
| serverPid | number | null | No | > 0 | Process ID for orphan cleanup |
| outputChannel | OutputChannel | Yes | — | VS Code output channel for server logs |

**mcp.json Configuration Schema:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| mcpServers | object | Yes | Non-empty | Map of server configurations |
| mcpServers.code-intelligence.command | string | Yes | "node" | Executable to run |
| mcpServers.code-intelligence.args | string[] | Yes | Non-empty array | Arguments: [server path, --config, config path] |
| mcpServers.code-intelligence.cwd | string | Yes | Valid directory | Working directory (workspace root) |
| mcpServers.code-intelligence.env | object | No | — | Environment variables |
| mcpServers.code-intelligence.port | number | No | 1024-65535, default 9180 | HTTP port for server communication |
| mcpServers.code-intelligence.transportType | string | No | "http" (default) | Transport protocol |

---

#### 3.1.5 API Contract (Internal Message Protocol)

> **Note:** The MCP server communicates via HTTP (JSON-RPC over HTTP on localhost:9180). This section defines the message protocol between extension host and MCP server.

**Protocol:** JSON-RPC 2.0 over HTTP (POST to `http://localhost:{port}/`)

**Request Format:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| jsonrpc | string | Yes | Must be "2.0" | Protocol version |
| id | number | Yes | Auto-increment | Request identifier |
| method | string | Yes | Valid MCP tool name | Tool to invoke |
| params | object | No | Tool-specific | Tool parameters |

**Response Format:**

| Field | Type | Description |
|-------|------|-------------|
| jsonrpc | string | "2.0" |
| id | number | Matching request ID |
| result | object | Tool response data |
| error | object | null | Error details if failed |

**Tool Invocation Examples:**

```json
// Request: Search KB
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"mem_search","arguments":{"query":"architecture","limit":10}}}

// Response
{"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"...results..."}]}}
```

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| Server not running | "MCP Server is not running. Starting..." | Tool invoked when serverStatus != "running" |
| Tool timeout | "Request timed out. Server may be busy." | No response within 30s |
| Invalid tool name | "Unknown tool: {name}" | Method not in 32 registered tools |
| Server crash during request | "Server disconnected. Reconnecting..." | Process exit during pending request |

---

### 3.2 Feature: Native KB Webview Panels

**Source:** BRD Stories 5, 6, 7, 8, 9

#### 3.2.1 Description

Five native VS Code Webview panels replace the iframe-based KB viewer. Each panel renders interactive visualizations using data from MCP server tools. Panels communicate with the extension host via VS Code's `postMessage` API (no HTTP).

#### 3.2.2 Use Cases

---

**Use Case ID:** UC-05
**Name:** Open KB Graph Panel
**Actor:** Developer
**Preconditions:** Extension active, MCP server running (or will auto-start)
**Postconditions:** 3D knowledge graph displayed in webview panel

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Execute "Kiro SDLC: Open KB Graph" (command or sidebar click) |
| 2 | | Extension | Check if Graph panel already open → if yes, reveal existing panel |
| 3 | | Extension | Create WebviewPanel with `viewType: "kiroKbGraph"` |
| 4 | | Extension | Set panel options: `enableScripts: true`, `retainContextWhenHidden: true` |
| 5 | | Extension | Load HTML template with Three.js + 3d-force-graph bundle |
| 6 | | Webview | Send message to extension: `{ type: "ready" }` |
| 7 | | Extension | Invoke MCP: `mem_crud(action: "list", limit: 500)` → get all entries |
| 8 | | Extension | Invoke MCP: `mem_graph(action: "ego", node_id: 1, radius: 10)` → get relationships |
| 9 | | Extension | Send data to webview: `{ type: "graphData", nodes: [...], edges: [...] }` |
| 10 | | Webview | Render 3D force-directed graph with color-coded nodes |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-05a | MCP server not running | Show "Starting MCP server..." → auto-start → then load data |
| AF-05b | KB is empty (no entries) | Show empty state: "No knowledge entries yet. Use mem_ingest to add entries." |
| AF-05c | Panel was hidden, now revealed | Restore previous state (retainContextWhenHidden) |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-05a | MCP request fails | Show error in panel: "Failed to load graph data. Click to retry." |
| EF-05b | WebGL not supported | Show fallback 2D graph using Canvas API |

---

**Use Case ID:** UC-06
**Name:** Open KB Dashboard Panel
**Actor:** Developer
**Preconditions:** Extension active
**Postconditions:** Dashboard with health metrics displayed

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Execute "Kiro SDLC: Open KB Dashboard" |
| 2 | | Extension | Create/reveal WebviewPanel `viewType: "kiroKbDashboard"` |
| 3 | | Extension | Load HTML template with Chart.js bundle |
| 4 | | Webview | Send `{ type: "ready" }` |
| 5 | | Extension | Invoke MCP: `mem_admin(action: "dashboard")` |
| 6 | | Extension | Invoke MCP: `mem_scoring(action: "quality_stats")` |
| 7 | | Extension | Invoke MCP: `mem_admin(action: "analytics")` |
| 8 | | Extension | Send aggregated data to webview |
| 9 | | Webview | Render health gauge, pie chart, bar chart, trend line, activity list |
| 10 | | Extension | Set auto-refresh timer (60s interval) |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-06a | KB empty | Show empty state with "Get Started" guide |
| AF-06b | Auto-refresh while panel hidden | Skip refresh, resume when panel visible |

---

**Use Case ID:** UC-07
**Name:** Open KB Tags Panel
**Actor:** Developer
**Preconditions:** Extension active
**Postconditions:** Tag cloud and taxonomy tree displayed

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Execute "Kiro SDLC: Open KB Tags" |
| 2 | | Extension | Create/reveal WebviewPanel `viewType: "kiroKbTags"` |
| 3 | | Extension | Load HTML template |
| 4 | | Webview | Send `{ type: "ready" }` |
| 5 | | Extension | Invoke MCP: `mem_tags(action: "taxonomy")` |
| 6 | | Extension | Invoke MCP: `mem_tags(action: "popular", limit: 50)` |
| 7 | | Extension | Send data to webview |
| 8 | | Webview | Render tag cloud (font size ∝ usage count) + taxonomy tree |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-07a | User clicks a tag | Webview sends `{ type: "filterByTag", tag: "..." }` → Extension invokes `mem_tags(action: "search", tags: "...")` → sends filtered entries back |
| AF-07b | User creates new tag | Webview sends `{ type: "createTag", tag: "...", category: "..." }` → Extension invokes `mem_tags(action: "create", tag: "...", category: "...")` → refresh |

---

**Use Case ID:** UC-08
**Name:** Open KB Quality Panel
**Actor:** Developer
**Preconditions:** Extension active
**Postconditions:** Quality distribution and low-quality entries displayed

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Execute "Kiro SDLC: Open KB Quality" |
| 2 | | Extension | Create/reveal WebviewPanel `viewType: "kiroKbQuality"` |
| 3 | | Extension | Load HTML template with Chart.js |
| 4 | | Webview | Send `{ type: "ready" }` |
| 5 | | Extension | Invoke MCP: `mem_scoring(action: "quality_stats")` |
| 6 | | Extension | Invoke MCP: `mem_scoring(action: "low_quality", threshold: 40)` |
| 7 | | Extension | Invoke MCP: `mem_scoring(action: "confidence_stats")` |
| 8 | | Extension | Invoke MCP: `mem_scoring(action: "unreliable")` |
| 9 | | Extension | Send data to webview |
| 10 | | Webview | Render histogram, low-quality table, confidence chart |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-08a | User clicks entry in low-quality table | Show entry detail panel with improvement suggestions |
| AF-08b | User selects bulk action (archive/delete) | Confirm dialog → invoke `mem_lifecycle(action: "archive")` or `mem_crud(action: "delete")` for each selected entry |

---

**Use Case ID:** UC-09
**Name:** Open KB Analytics Panel
**Actor:** Developer
**Preconditions:** Extension active
**Postconditions:** Search analytics and recommendations displayed

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Execute "Kiro SDLC: Open KB Analytics" |
| 2 | | Extension | Create/reveal WebviewPanel `viewType: "kiroKbAnalytics"` |
| 3 | | Extension | Load HTML template with Chart.js |
| 4 | | Webview | Send `{ type: "ready" }` |
| 5 | | Extension | Invoke MCP: `mem_admin(action: "analytics")` |
| 6 | | Extension | Invoke MCP: `mem_admin(action: "popular", limit: 20)` |
| 7 | | Extension | Invoke MCP: `mem_admin(action: "gaps")` |
| 8 | | Extension | Invoke MCP: `mem_admin(action: "zero_results")` |
| 9 | | Extension | Invoke MCP: `mem_admin(action: "recommendations")` |
| 10 | | Extension | Send data to webview |
| 11 | | Webview | Render search volume chart, popular queries, gaps, recommendations |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-09a | User clicks "Create Entry" on a gap/recommendation | Open VS Code input dialog → collect title + content → invoke `mem_ingest` → refresh panel |

---

#### 3.2.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-11 | Graph panel MUST render ≤500 nodes at 60fps | BRD Story 5 AC-1,2 |
| BR-12 | Dashboard MUST load within 2 seconds | BRD Story 6 AC-1 |
| BR-13 | Dashboard auto-refreshes every 60 seconds (configurable) | BRD Story 6 AC-3 |
| BR-14 | Panels MUST use VS Code postMessage API (no HTTP) | BRD NFR Security |
| BR-15 | Panels MUST retain state when hidden (retainContextWhenHidden) | BRD Story 5 AC-6 |
| BR-16 | Only one instance of each panel type at a time | UX best practice |
| BR-17 | Panels MUST show clear status during server reconnection | BRD Story 11 AC-2 |
| BR-18 | Panels MUST be theme-aware (respect VS Code color theme) | BRD Architecture Decision B |
| BR-19 | Heavy assets (Three.js) lazy-loaded only when panel opens | BRD NFR Performance |
| BR-20 | Tag cloud font size proportional to usage count | BRD Story 7 |

#### 3.2.4 Data Specifications

**Webview Message Protocol (Extension ↔ Webview):**

**Messages FROM Webview TO Extension:**

| Message Type | Payload | Description |
|-------------|---------|-------------|
| `ready` | `{}` | Webview loaded, ready to receive data |
| `refresh` | `{}` | User clicked refresh button |
| `filterByType` | `{ types: string[] }` | Filter graph/list by entry type |
| `filterByTier` | `{ tiers: string[] }` | Filter by tier |
| `filterByTag` | `{ tag: string }` | Filter entries by tag |
| `nodeClick` | `{ entryId: number }` | User clicked a graph node |
| `createTag` | `{ tag: string, category?: string }` | Create new tag |
| `searchNodes` | `{ query: string }` | Search within graph |
| `bulkAction` | `{ action: string, entryIds: number[] }` | Bulk archive/delete |
| `createEntry` | `{ title: string, content: string, type: string }` | Create KB entry from recommendation |

**Messages FROM Extension TO Webview:**

| Message Type | Payload | Description |
|-------------|---------|-------------|
| `graphData` | `{ nodes: Node[], edges: Edge[] }` | Full graph data |
| `dashboardData` | `{ health: number, types: {}, tiers: {}, trend: [], recent: [] }` | Dashboard metrics |
| `tagsData` | `{ taxonomy: {}, popular: Tag[] }` | Tags panel data |
| `qualityData` | `{ stats: {}, lowQuality: Entry[], confidence: {}, unreliable: Entry[] }` | Quality panel data |
| `analyticsData` | `{ volume: [], popular: [], gaps: [], recommendations: [] }` | Analytics data |
| `filteredEntries` | `{ entries: Entry[] }` | Filtered results |
| `entryDetail` | `{ entry: Entry }` | Single entry details |
| `serverStatus` | `{ status: string }` | Server connection status |
| `error` | `{ message: string, retryable: boolean }` | Error notification |

**Node Data Model (for Graph):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | number | Yes | KB entry ID |
| title | string | Yes | Entry summary (truncated to 50 chars) |
| type | string | Yes | DECISION, ERROR_PATTERN, ARCHITECTURE, etc. |
| tier | string | Yes | WORKING, EPISODIC, SEMANTIC, PROCEDURAL |
| color | string | Yes | Hex color based on type |
| size | number | Yes | Node size based on citation count |

**Edge Data Model (for Graph):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| source | number | Yes | Source entry ID |
| target | number | Yes | Target entry ID |
| relation | string | Yes | Relationship type (RELATED, CITES, DEPENDS_ON) |

---

#### 3.2.5 UI Specifications

**Panel: KB Graph**

| No. | Element | Type | Required | Behavior | Validation |
|-----|---------|------|----------|----------|------------|
| 1 | Graph Canvas | WebGL Canvas (Three.js) | Yes | 3D force-directed graph, rotate/zoom/pan | Min 1 node to render |
| 2 | Node Tooltip | Floating div | Yes | Shows entry title + type on hover | Disappears on mouse leave |
| 3 | Node Detail Sidebar | Slide-in panel (right) | Yes | Shows full entry on click: title, content, tags, citations | Close on X or click elsewhere |
| 4 | Type Filter | Multi-select dropdown | Yes | Filter nodes by type (checkboxes) | At least 1 type selected |
| 5 | Tier Filter | Multi-select dropdown | Yes | Filter nodes by tier | At least 1 tier selected |
| 6 | Search Box | Text input | Yes | Highlight matching nodes, dim others | Min 2 chars to search |
| 7 | Layout Toggle | Button group (2D/3D) | No | Switch between 2D flat and 3D perspective | Default: 3D |
| 8 | Refresh Button | Icon button | Yes | Reload all data from MCP | Disabled during loading |
| 9 | Node Count Badge | Text | Yes | Shows "N nodes, M edges" | Updates on filter |
| 10 | Legend | Color-coded list | Yes | Maps colors to entry types | Collapsible |

**Panel: KB Dashboard**

| No. | Element | Type | Required | Behavior | Validation |
|-----|---------|------|----------|----------|------------|
| 1 | Health Gauge | Circular gauge (SVG) | Yes | 0-100 score, color: red<40, yellow<70, green≥70 | — |
| 2 | Type Distribution | Pie chart (Chart.js) | Yes | Click slice → filter entries | — |
| 3 | Tier Distribution | Horizontal bar chart | Yes | Shows count per tier | — |
| 4 | Trend Chart | Area chart with gradient | Yes | Entries added over last 30 days | — |
| 5 | Recent Activity | Scrollable list | Yes | Last 10 entries with timestamp | Click → entry detail |
| 6 | Stale Entries Badge | Badge + link | Yes | Count of stale entries, click → detect_stale | — |
| 7 | Refresh Button | Icon button | Yes | Manual refresh | — |
| 8 | Auto-refresh Indicator | Small icon | Yes | Shows countdown to next refresh | — |

**Panel: KB Tags**

| No. | Element | Type | Required | Behavior | Validation |
|-----|---------|------|----------|----------|------------|
| 1 | View Toggle | Tab bar (Cloud / Tree) | Yes | Switch between tag cloud and taxonomy tree | Default: Cloud |
| 2 | Tag Cloud | Weighted text layout | Yes | Font size ∝ usage count, click → filter | — |
| 3 | Taxonomy Tree | Collapsible tree | Yes | Parent-child tag hierarchy | — |
| 4 | Tag Search | Text input | Yes | Filter tags by name | — |
| 5 | Entries List | Scrollable list | Yes | Shows entries for selected tag | — |
| 6 | Create Tag Button | Button | Yes | Opens inline form: name + category | Name required, unique |
| 7 | Tag Count | Badge on each tag | Yes | Number of entries with this tag | — |

**Panel: KB Quality**

| No. | Element | Type | Required | Behavior | Validation |
|-----|---------|------|----------|----------|------------|
| 1 | Quality Histogram | Bar chart | Yes | Distribution of quality scores (0-100) | — |
| 2 | Low-Quality Table | Sortable table | Yes | Entries with score < 40: ID, title, score, type, date | Sortable by all columns |
| 3 | Confidence Chart | Bar chart | Yes | Distribution of confidence scores | — |
| 4 | Unreliable List | Table | Yes | Entries with low confidence | — |
| 5 | Bulk Action Bar | Toolbar (appears on selection) | Yes | Archive, Delete, Mark for Review | Confirm dialog before destructive actions |
| 6 | Entry Detail | Expandable row | Yes | Click row → shows content + improvement suggestions | — |

**Panel: KB Analytics**

| No. | Element | Type | Required | Behavior | Validation |
|-----|---------|------|----------|----------|------------|
| 1 | Search Volume Chart | Line chart | Yes | Searches over time (30 days) | — |
| 2 | Popular Queries | Ranked list | Yes | Top 20 queries with frequency | — |
| 3 | Zero-Result Queries | Highlighted list | Yes | Queries that returned nothing (gaps) | — |
| 4 | Most Cited Entries | Ranked list | Yes | Top entries by citation count | — |
| 5 | Recommendations | Card list | Yes | Suggested new entries based on gaps | Click → create entry |
| 6 | Time Range Selector | Dropdown | Yes | 7d / 30d / 90d / All time | Default: 30d |

---

### 3.3 Feature: Sidebar Activity Bar & Tree View

**Source:** BRD Story 10

#### 3.3.1 Description

A custom Activity Bar icon in VS Code's left sidebar provides a tree view with quick links to all KB panels and MCP server status/controls.

#### 3.3.2 Use Case

**Use Case ID:** UC-10
**Name:** Navigate via Sidebar Tree View
**Actor:** Developer
**Preconditions:** Extension active
**Postconditions:** Requested panel opened or action executed

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Click Kiro SDLC icon in Activity Bar |
| 2 | | Extension | Show tree view with sections: Knowledge Base, MCP Server |
| 3 | Developer | | Click tree item (e.g., "📊 Dashboard") |
| 4 | | Extension | Execute corresponding command (e.g., `kiroSdlc.openKbDashboard`) |
| 5 | | Extension | Open/reveal the webview panel |

**Tree View Structure:**

```
🧠 Kiro SDLC
├── ✅ Running (Port 9180)
├── Knowledge Base
│   ├── 📊 Dashboard
│   ├── 🕸️ Graph
│   ├── 🏷️ Tags
│   ├── ⭐ Quality
│   └── 📈 Analytics
├── MCP Server
│   ├── Status: Running ✅  (or Stopped ❌ / Crashed ⚠️)
│   ├── 🔄 Restart Server
│   ├── ⏹️ Stop Server
│   ├── ▶️ Start Server          (shown when stopped)
│   └── ⚙️ Change Port...
└── Quick Actions
    ├── 💉 Inject All Agents
    ├── 📋 Show Status
    └── 🔍 Index Workspace
```

#### 3.3.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-21 | Activity Bar icon visible immediately after extension activates | BRD Story 10 AC-1 |
| BR-22 | MCP Server status updates in real-time (event-driven, not polling) | BRD Story 10 AC-4 |
| BR-23 | Tree view refreshes when server status changes | BRD Story 10 AC-5 |
| BR-24 | Click tree item → opens panel or executes command | BRD Story 10 AC-3 |

---

### 3.4 Feature: Backward Compatibility

**Source:** BRD Story 12

#### 3.4.1 Description

All existing extension features (6 commands, inject logic, checksum-based updates, status bar) MUST work identically to v1.8.1. The upgrade is purely additive.

#### 3.4.2 Use Case

**Use Case ID:** UC-11
**Name:** Existing Inject Workflow (Unchanged)
**Actor:** Developer (existing user)
**Preconditions:** Extension v2.0.0 installed, workspace open
**Postconditions:** All agents/steering/hooks/templates injected as before

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Execute "Kiro SDLC: Inject All Agents" |
| 2 | | Extension | Confirm dialog (unchanged) |
| 3 | | Extension | Copy agents, steering, hooks, templates to workspace (unchanged logic) |
| 4 | | Extension | Show success notification with component count |
| 5 | | Extension | Prompt to index workspace (unchanged) |

**Preserved Commands:**

| Command | Behavior | Changed? |
|---------|----------|----------|
| `kiroSdlc.injectAll` | Inject all components | No |
| `kiroSdlc.injectSelective` | Select components to inject | No |
| `kiroSdlc.update` | Safe update keeping customizations | No |
| `kiroSdlc.status` | Show component status | No |
| `kiroSdlc.indexWorkspace` | Index code + documents | No |
| `kiroSdlc.downloadModel` | Download ONNX embedding model | No |

#### 3.4.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-25 | All 6 existing commands work identically to v1.8.1 | BRD Story 12 AC-1 |
| BR-26 | Injected file content identical to v1.8.1 | BRD Story 12 AC-2 |
| BR-27 | User with Python/Kotlin MCP config → extension respects their choice | BRD Story 12 AC-3 |
| BR-28 | Checksum-based update detection unchanged | BRD Story 12 AC-4 |
| BR-29 | No breaking changes in extension settings | BRD Story 12 AC-5 |

---

### 3.5 Feature: Graceful Crash Recovery

**Source:** BRD Story 11

#### 3.5.1 Description

When the MCP server crashes, webview panels gracefully degrade, auto-restart is triggered, and panels reconnect automatically after recovery.

#### 3.5.2 Use Case

**Use Case ID:** UC-12
**Name:** Webview Panel Reconnection After Crash
**Actor:** System
**Preconditions:** Panel open, server crashes
**Postconditions:** Panel reconnected with fresh data

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Extension | Detect server process exit (crash) |
| 2 | | Extension | Send `{ type: "serverStatus", status: "disconnected" }` to all open panels |
| 3 | | Webview | Show overlay: "Server disconnected. Reconnecting..." |
| 4 | | Extension | Trigger auto-restart (UC-03) |
| 5 | | Extension | On restart success → send `{ type: "serverStatus", status: "connected" }` |
| 6 | | Webview | Remove overlay, send `{ type: "refresh" }` |
| 7 | | Extension | Reload data from MCP, send fresh data to webview |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-12a | Max retries exceeded | Send `{ type: "serverStatus", status: "failed" }` → Webview shows "Server unavailable. Click to retry." button |
| AF-12b | User clicks retry button | Webview sends `{ type: "manualRetry" }` → Extension resets counter, attempts restart |

---

## 4. Data Model

> **Note:** This section defines the logical data model. Physical implementation in TDD.

### 4.1 Entity Relationship Diagram

![ER Diagram](diagrams/er-diagram.png)

### 4.2 Logical Entities

#### Entity: ServerState

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| status | enum(starting, running, crashed, stopped) | Yes | BR-01 | Current server lifecycle state |
| pid | number | No | BR-04 | OS process ID |
| restartCount | number | Yes | BR-02 | Auto-restart attempts (0-3) |
| lastCrashTime | datetime | No | — | When server last crashed |
| startTime | datetime | No | — | When server last started successfully |

#### Entity: WebviewPanel

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| viewType | string | Yes | BR-16 | Unique panel identifier |
| panel | WebviewPanel | Yes | — | VS Code WebviewPanel reference |
| isVisible | boolean | Yes | BR-15 | Whether panel is currently visible |
| lastDataFetch | datetime | No | BR-13 | When data was last loaded |

#### Entity: McpConfig

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| filePath | string | Yes | — | Path to .kiro/settings/mcp.json |
| servers | map | Yes | BR-05 | Map of server configurations |
| isBundled | boolean | Yes | BR-27 | Whether using bundled server |

**Relationships:**

| From Entity | To Entity | Cardinality | Description |
|-------------|-----------|-------------|-------------|
| ServerState | WebviewPanel | 1:N | One server serves multiple panels |
| ServerState | McpConfig | 1:1 | Server config stored in mcp.json |
| WebviewPanel | ServerState | N:1 | All panels depend on server state |

---

## 5. Integration Specifications

### 5.1 External System: MCP NodeJS Server (Child Process)

| Attribute | Value |
|-----------|-------|
| Purpose | Provides 32 KB/code intelligence tools for webview panels and Kiro agents |
| Direction | Bidirectional |
| Data Format | JSON-RPC 2.0 over HTTP |
| Frequency | Real-time (on-demand per user interaction) |
| Transport | HTTP POST to localhost:9180 (configurable port) |

**Data Exchange:**

| Our Data (Extension) | External Data (MCP Server) | Direction | Business Rule |
|---------------------|---------------------------|-----------|---------------|
| Tool invocation request | Tool response (JSON) | Send/Receive | BR-14 (via HTTP) |
| Server spawn command | Process ready signal | Send/Receive | BR-01 (< 5s) |
| SIGTERM/SIGKILL | Graceful shutdown | Send | BR-03 |
| Config path (--config) | Orchestration config | Send | — |

### 5.2 External System: VS Code Extension Host API

| Attribute | Value |
|-----------|-------|
| Purpose | Provides UI primitives: commands, webview, tree view, output channels, notifications |
| Direction | Bidirectional |
| Data Format | TypeScript API calls |
| Frequency | Real-time |

**Key APIs Used:**

| API | Purpose | Business Rule |
|-----|---------|---------------|
| `vscode.window.createWebviewPanel()` | Create KB panels | BR-15, BR-16 |
| `vscode.window.registerTreeDataProvider()` | Sidebar tree view | BR-21 |
| `vscode.commands.registerCommand()` | Register 16 commands (6 existing + 10 new) | BR-25 |
| `vscode.window.createOutputChannel()` | Server log output | — |
| `vscode.window.showInformationMessage()` | Notifications | — |
| `child_process.spawn()` | Start MCP server | BR-01 |

### 5.3 External System: File System

| Attribute | Value |
|-----------|-------|
| Purpose | Read/write workspace config, KB database, extension bundle |
| Direction | Bidirectional |
| Data Format | JSON, SQLite, JavaScript |
| Frequency | On activation + on-demand |

**File Access:**

| Path | Operation | Purpose |
|------|-----------|---------|
| `{extensionPath}/mcp-server/` | Read | Bundled server files |
| `{workspace}/.kiro/settings/mcp.json` | Read/Write | MCP configuration |
| `{workspace}/.code-intel/index.db` | Read (via MCP) | KB database |
| `{workspace}/.code-intel/orchestration.json` | Read | MCP orchestration config |

---

## 6. Processing Logic

### 6.1 Extension Activation Sequence

**Trigger:** VS Code opens workspace with extension installed
**Input:** Workspace folder path, extension path
**Output:** Extension fully active with MCP server running

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Register all 16 commands (6 existing + 10 new) | Fatal if registration fails |
| 2 | Create status bar item | Non-fatal |
| 3 | Register tree view provider (sidebar) | Non-fatal — sidebar won't show |
| 4 | Check for extension upgrade (existing logic) | Non-fatal |
| 5 | Spawn MCP server (async — non-blocking) | Auto-retry up to 3 times |
| 6 | Auto-inject mcp.json (after server starts) | Non-fatal — user can inject manually |
| 7 | Update status bar with server state | Non-fatal |

**Sequence Diagram:**

![Activation Sequence](diagrams/activation-sequence.png)

### 6.2 Webview Panel Data Flow

**Trigger:** User opens a KB panel
**Input:** Panel type (graph/dashboard/tags/quality/analytics)
**Output:** Rendered visualization with live data

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Check if panel already exists → reveal if yes | — |
| 2 | Create WebviewPanel with options | Fatal if API fails |
| 3 | Generate HTML content (template + bundled JS/CSS) | Fatal |
| 4 | Set webview HTML | Fatal |
| 5 | Register message listener (webview → extension) | Fatal |
| 6 | Wait for "ready" message from webview | Timeout 10s → show error |
| 7 | Invoke MCP tools to fetch data | Retry once, then show error |
| 8 | Send data to webview via postMessage | — |
| 9 | Register dispose listener (cleanup on panel close) | — |

**Data Flow Diagram:**

![Webview Data Flow](diagrams/webview-dataflow.png)

### 6.3 MCP Server Health Monitor

**Trigger:** Server process exit event
**Schedule:** Event-driven (not polling)
**Input:** Exit code, signal
**Output:** Server restarted or max retries notification

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Receive process 'exit' event with code and signal | — |
| 2 | If exit code = 0 → graceful shutdown, do nothing | — |
| 3 | If exit code ≠ 0 → crash detected | — |
| 4 | Update serverStatus = "crashed" | — |
| 5 | Notify all open panels: serverStatus = "disconnected" | — |
| 6 | Check restartCount < 3 | If ≥ 3 → stop, notify user |
| 7 | Calculate backoff delay | — |
| 8 | Wait delay, then spawn new process | If spawn fails → increment counter, retry |
| 9 | On success → notify panels: serverStatus = "connected" | — |

---

## 7. Security Requirements

### 7.1 Authentication & Authorization

| Role | Permissions | Screens/Features |
|------|-------------|-------------------|
| Developer (local user) | Full access | All panels, all commands, all MCP tools |

> **Note:** This is a local VS Code extension — no multi-user auth needed. Security focuses on sandboxing and data isolation.

### 7.2 Data Sensitivity Classification

| Data Type | Classification | Business Requirement |
|-----------|---------------|---------------------|
| KB entries (knowledge base) | Internal | Local workspace only — never transmitted externally |
| Source code indexed | Internal | Stays in local .code-intel/index.db |
| Extension config (mcp.json) | Internal | May contain workspace paths |
| Server logs (Output channel) | Internal | May contain file paths, query content |

### 7.3 Security Controls

| Control | Implementation | Business Reason |
|---------|---------------|-----------------|
| No network from webview | `enableCommandUris: false`, no fetch/XHR in webview | BRD NFR: No network requests from webview |
| Workspace-scoped server | `CODE_INTEL_WORKSPACE` env limits server access | BRD NFR: No access outside workspace |
| CSP in webview | Content Security Policy restricts script sources | VS Code security best practice |
| No eval() in webview | CSP blocks unsafe-eval | Prevent XSS |
| Message validation | Extension validates all messages from webview before processing | Prevent injection |

### 7.4 Content Security Policy (Webview)

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'none';
  script-src 'nonce-${nonce}';
  style-src ${webview.cspSource} 'unsafe-inline';
  img-src ${webview.cspSource} data:;
  font-src ${webview.cspSource};
">
```

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | Extension activation < 3s | MCP server spawn is async, doesn't block activation |
| Performance | Webview panel load < 2s | Lazy-load heavy assets only when panel opens |
| Performance | Graph renders 500 nodes at 60fps | WebGL + level-of-detail for large graphs |
| Performance | MCP tool response < 1s for simple queries | HTTP to localhost, minimal overhead |
| Reliability | MCP server uptime > 99% during session | Auto-restart with backoff, max 3 retries |
| Reliability | No data loss on crash | SQLite WAL mode, graceful shutdown |
| Reliability | Core commands work without MCP server | Inject/update/status independent of server |
| Compatibility | Windows x64, macOS arm64, Linux x64 | Pre-built better-sqlite3 native addons |
| Compatibility | VS Code ^1.85.0 | Minimum supported version |
| Size | Extension package < 50MB | Tree-shaking, .vscodeignore, no dev dependencies |
| Usability | Zero-config for new users | Bundled server auto-starts, mcp.json auto-injected |
| Usability | Non-breaking for existing users | All v1.8.1 features preserved |
| Maintainability | MCP server version pinned | Update via extension release cycle |
| Scalability | Handle KB with up to 10,000 entries | Pagination in MCP queries, virtual scrolling in panels |

---

## 9. Error Handling (User-Facing)

### 9.1 Error Scenarios

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| MCP server fails to start | Critical | "MCP server failed to start. Check Output panel for details." | Show notification + output channel |
| MCP server crashes | Warning | "MCP server restarted automatically." | Auto-restart, panels reconnect |
| Max restart attempts exceeded | Critical | "MCP server failed after 3 attempts. Use 'Restart MCP Server' to retry." | Stop retrying, manual retry available |
| Webview data load fails | Warning | "Failed to load data. Click refresh to retry." | Show error in panel with retry button |
| Node.js not found | Critical | "Node.js 20+ required for bundled MCP server." | Show notification, server stays stopped |
| Bundled server files missing | Critical | "MCP server bundle not found. Reinstall extension." | Show notification |
| mcp.json write fails | Warning | "Could not update MCP config. Check file permissions." | Log error, continue without config |
| WebGL not supported | Info | "3D graph requires WebGL. Showing 2D fallback." | Render 2D graph instead |
| KB database locked | Warning | "KB database is busy. Retrying..." | Retry after 1s, max 3 attempts |

### 9.2 Notification Requirements

| Event | Who is Notified | Channel | Timing |
|-------|----------------|---------|--------|
| Server started | Developer | Status bar update | Immediate |
| Server crashed + restarted | Developer | VS Code notification (warning) | After successful restart |
| Server failed permanently | Developer | VS Code notification (error) | After max retries |
| Extension upgrade available | Developer | VS Code notification (info) | On activation |
| Panel data refresh failed | Developer | In-panel error message | Immediate |

---

## 10. Testing Considerations

### 10.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-01 | Extension activates and spawns MCP server | Open workspace | Server running within 5s, status bar shows ✅ | High |
| TC-02 | MCP server crash triggers auto-restart | Kill server process | Server restarts within 5s, panels reconnect | High |
| TC-03 | Max restart attempts reached | Kill server 4 times rapidly | Error notification after 3rd attempt, no more retries | High |
| TC-04 | Manual restart via command | Execute restart command | Server killed and restarted within 10s | High |
| TC-05 | Open KB Graph panel | Execute command | 3D graph renders with nodes from KB | High |
| TC-06 | Open KB Dashboard panel | Execute command | Dashboard shows health gauge, charts | High |
| TC-07 | Graph filter by type | Select "DECISION" type only | Only DECISION nodes visible | Medium |
| TC-08 | Dashboard auto-refresh | Wait 60s with panel open | Data refreshes automatically | Medium |
| TC-09 | Panel reconnects after crash | Crash server while panel open | Panel shows "Reconnecting...", then refreshes | High |
| TC-10 | mcp.json auto-inject (fresh workspace) | Activate in workspace without mcp.json | mcp.json created with bundled server config | High |
| TC-11 | mcp.json respects existing config | Activate with custom mcp.json | Prompt shown, no overwrite without consent | High |
| TC-12 | Sidebar tree view shows all items | Activate extension | Tree view with KB panels + MCP status | Medium |
| TC-13 | Existing inject command unchanged | Execute "Inject All Agents" | Same behavior as v1.8.1 | High |
| TC-14 | Extension deactivate kills server | Close VS Code | No orphan node processes | High |
| TC-15 | Graph handles 500 nodes at 60fps | KB with 500 entries | Smooth rotation/zoom | Medium |
| TC-16 | Tags panel create new tag | Click create, enter name | Tag created, cloud refreshes | Medium |
| TC-17 | Quality panel bulk archive | Select 3 entries, click archive | Entries archived, table refreshes | Medium |
| TC-18 | Analytics shows zero-result queries | Search for non-existent term | Query appears in gaps list | Low |
| TC-19 | Platform compatibility (win-x64) | Install on Windows | All features work | High |
| TC-20 | Platform compatibility (mac-arm64) | Install on macOS M1/M2 | All features work | High |
| TC-21 | Platform compatibility (linux-x64) | Install on Linux | All features work | High |
| TC-22 | Extension package size | Build VSIX | Size < 50MB | Medium |
| TC-23 | Server status in sidebar updates | Crash/restart server | Tree view status changes in real-time | Medium |
| TC-24 | Panel retains state when hidden | Open graph, switch to another tab, switch back | Graph state preserved (no re-render) | Medium |

---

## 11. Command Registry (Complete)

### 11.1 Existing Commands (Preserved)

| Command ID | Title | Behavior | Changed? |
|-----------|-------|----------|----------|
| `kiroSdlc.injectAll` | Kiro SDLC: Inject All Agents | Inject all components | No |
| `kiroSdlc.injectSelective` | Kiro SDLC: Inject (Select Components) | Select components | No |
| `kiroSdlc.update` | Kiro SDLC: Update Agents (Keep Customizations) | Safe update | No |
| `kiroSdlc.status` | Kiro SDLC: Show Status | Show component status | No |
| `kiroSdlc.indexWorkspace` | Kiro SDLC: Index Workspace (Code + Documents) | Index workspace | No |
| `kiroSdlc.downloadModel` | Kiro SDLC: Download Embedding Model | Download ONNX model | No |

### 11.2 New Commands

| Command ID | Title | Behavior | Keybinding |
|-----------|-------|----------|------------|
| `kiroSdlc.openKbGraph` | Kiro SDLC: Open KB Graph | Open 3D knowledge graph panel | None |
| `kiroSdlc.openKbDashboard` | Kiro SDLC: Open KB Dashboard | Open health/metrics dashboard | None |
| `kiroSdlc.openKbTags` | Kiro SDLC: Open KB Tags | Open tag cloud/taxonomy panel | None |
| `kiroSdlc.openKbQuality` | Kiro SDLC: Open KB Quality | Open quality scores panel | None |
| `kiroSdlc.openKbAnalytics` | Kiro SDLC: Open KB Analytics | Open search analytics panel | None |
| `kiroSdlc.restartMcpServer` | Kiro SDLC: Restart MCP Server | Kill + restart bundled server | None |
| `kiroSdlc.stopMcpServer` | Kiro SDLC: Stop MCP Server | Stop bundled server | None |
| `kiroSdlc.startMcpServer` | Kiro SDLC: Start MCP Server | Start bundled server (if stopped) | None |
| `kiroSdlc.changeMcpPort` | Kiro SDLC: Change MCP Port... | Open input box to change port, restart server | None |

---

## 12. State Machine: MCP Server Lifecycle

### 12.1 State Diagram

![Server State Machine](diagrams/server-state.png)

### 12.2 State Transitions

| From State | To State | Trigger | Action |
|-----------|----------|---------|--------|
| (initial) | starting | Extension activates | Spawn child process |
| starting | running | Server ready signal received | Update status bar, notify panels |
| starting | crashed | Timeout (5s) or spawn error | Increment restartCount |
| running | crashed | Process exit (code ≠ 0) | Record lastCrashTime, notify panels |
| running | stopped | Extension deactivate or manual stop | SIGTERM → SIGKILL |
| crashed | starting | restartCount < 3 (after backoff) | Spawn new process |
| crashed | stopped | restartCount ≥ 3 | Show error notification |
| stopped | starting | Manual restart command | Reset restartCount, spawn |

---

## 13. Pseudocode: Key Algorithms

### 13.1 Server Spawn with Health Monitor

```typescript
async function spawnMcpServer(extensionPath: string, workspaceFolder: string): Promise<void> {
  const serverPath = path.join(extensionPath, 'mcp-server', 'index.js');
  
  // Verify bundle exists
  if (!fs.existsSync(serverPath)) {
    throw new Error('MCP server bundle not found');
  }
  
  // Spawn child process
  serverProcess = spawn('node', [serverPath, '--config', configPath], {
    cwd: workspaceFolder,
    env: { ...process.env, CODE_INTEL_WORKSPACE: workspaceFolder, CODE_INTEL_HTTP_PORT: String(serverPort) },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  serverStatus = 'starting';
  
  // Wait for ready signal (first stdout line)
  const ready = await waitForReady(serverProcess.stdout, 5000);
  if (!ready) throw new Error('Server startup timeout');
  
  serverStatus = 'running';
  serverPid = serverProcess.pid;
  restartCount = 0;
  
  // Monitor for crashes
  serverProcess.on('exit', (code, signal) => {
    if (code === 0) { serverStatus = 'stopped'; return; }
    handleCrash(code, signal);
  });
  
  // Pipe stderr to output channel
  serverProcess.stderr.on('data', (data) => outputChannel.appendLine(data.toString()));
}
```

### 13.2 Auto-Restart with Exponential Backoff

```typescript
async function handleCrash(exitCode: number, signal: string): Promise<void> {
  serverStatus = 'crashed';
  lastCrashTime = new Date();
  restartCount++;
  
  notifyPanels({ type: 'serverStatus', status: 'disconnected' });
  
  if (restartCount > 3) {
    vscode.window.showErrorMessage('MCP server failed after 3 restart attempts.');
    serverStatus = 'stopped';
    return;
  }
  
  const backoff = [5000, 15000, 30000][restartCount - 1];
  vscode.window.showWarningMessage(`MCP server crashed. Restarting in ${backoff/1000}s...`);
  
  await delay(backoff);
  
  try {
    await spawnMcpServer(extensionPath, workspaceFolder);
    notifyPanels({ type: 'serverStatus', status: 'connected' });
    vscode.window.showInformationMessage('MCP server restarted successfully.');
  } catch (err) {
    handleCrash(-1, 'spawn_failed');
  }
}
```

### 13.3 Webview Panel Factory

```typescript
function createKbPanel(viewType: string, title: string, dataLoader: () => Promise<any>): void {
  // Singleton pattern — reveal if exists
  if (panels.has(viewType)) {
    panels.get(viewType).reveal();
    return;
  }
  
  const panel = vscode.window.createWebviewPanel(
    viewType, title, vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [extensionUri] }
  );
  
  panel.webview.html = getHtmlForPanel(viewType, panel.webview);
  
  // Message handler
  panel.webview.onDidReceiveMessage(async (msg) => {
    switch (msg.type) {
      case 'ready':
        const data = await dataLoader();
        panel.webview.postMessage({ type: `${viewType}Data`, ...data });
        break;
      case 'refresh':
        const freshData = await dataLoader();
        panel.webview.postMessage({ type: `${viewType}Data`, ...freshData });
        break;
      case 'filterByType':
        // Re-query with filter
        break;
    }
  });
  
  panel.onDidDispose(() => panels.delete(viewType));
  panels.set(viewType, panel);
}
```

### 13.4 MCP Tool Invocation via HTTP

```typescript
async function invokeMcpTool(toolName: string, args: object): Promise<any> {
  if (serverStatus !== 'running') {
    throw new Error('MCP server not running');
  }
  
  const requestId = nextRequestId++;
  const request = JSON.stringify({
    jsonrpc: '2.0', id: requestId,
    method: 'tools/call',
    params: { name: toolName, arguments: args }
  });
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('MCP request timeout')), 30000);
    pendingRequests.set(requestId, { resolve, reject, timeout });

    // HTTP POST to MCP server
    const req = http.request({
      hostname: 'localhost', port: serverPort, // default 9180
      path: '/', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => handleResponse(body, requestId));
    });
    req.on('error', (err) => reject(err));
    req.write(request);
    req.end();
  });
}
```

---

## 14. Open Issues & Decisions

| # | Issue | Status | Decision | Impact |
|---|-------|--------|----------|--------|
| 1 | Which chart library for Dashboard/Analytics? | Decided | Chart.js (smaller bundle than D3.js, sufficient for our needs) | Affects bundle size |
| 2 | How to handle better-sqlite3 platform builds? | Open | Options: prebuild-install, node-pre-gyp, or manual platform packages | Affects CI/CD pipeline |
| 3 | Should webview panels share a single MCP connection or each have their own? | Decided | Single connection (McpServerManager singleton) — panels share | Simpler architecture |
| 4 | How to handle VS Code version < 1.85? | Decided | Show error on activation, disable new features, keep existing commands working | Graceful degradation |
| 5 | Should graph panel use Web Workers for layout computation? | Open | Recommended for 500+ nodes to avoid UI freeze | Affects graph performance |
| 6 | PID file location for orphan cleanup? | Decided | `{workspace}/.code-intel/server.pid` — checked on activation | Prevents orphans |

---

## 15. Appendix

### 15.1 Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Activation Sequence | [activation-sequence.png](diagrams/activation-sequence.png) | [activation-sequence.drawio](diagrams/activation-sequence.drawio) |
| 3 | Webview Data Flow | [webview-dataflow.png](diagrams/webview-dataflow.png) | [webview-dataflow.drawio](diagrams/webview-dataflow.drawio) |
| 4 | Server State Machine | [server-state.png](diagrams/server-state.png) | [server-state.drawio](diagrams/server-state.drawio) |
| 5 | ER Diagram | [er-diagram.png](diagrams/er-diagram.png) | [er-diagram.drawio](diagrams/er-diagram.drawio) |

### 15.2 Change Log from BRD

| BRD Item | FSD Clarification |
|----------|-------------------|
| Story 2: "Monitor process health" | Clarified: event-driven (process 'exit' event), not polling |
| Story 4: "Auto-inject mcp.json" | Clarified: only `code-intelligence` key affected, other servers preserved |
| Story 5: "3D force-directed graph" | Clarified: Three.js + 3d-force-graph library, WebGL required |
| Story 11: "Graceful fallback" | Clarified: panels show overlay during reconnection, auto-refresh after |
| NFR "Extension activation < 3s" | Clarified: server spawn is async, activation completes before server ready |

### 15.3 MCP Tools Used by Panels

| Panel | MCP Tools | Purpose |
|-------|-----------|---------|
| Graph | `mem_crud(list)`, `mem_graph(ego)`, `mem_search` | Load nodes, edges, search |
| Dashboard | `mem_admin(dashboard)`, `mem_scoring(quality_stats)`, `mem_admin(analytics)` | Health, metrics, trends |
| Tags | `mem_tags(taxonomy)`, `mem_tags(popular)`, `mem_tags(search)`, `mem_tags(create)` | Tag data, filtering, creation |
| Quality | `mem_scoring(quality_stats, low_quality, confidence_stats, unreliable)` | Quality metrics |
| Analytics | `mem_admin(analytics, popular, gaps, zero_results, recommendations)` | Search analytics |

### 15.4 Extension Package Structure (v2.0.0)

```
kiro-sdlc-agents/
├── out/                          # Compiled TypeScript
│   ├── extension.js              # Entry point (modified)
│   ├── mcp-server-manager.js     # NEW: Server lifecycle
│   ├── webview-manager.js        # NEW: Panel factory
│   ├── tree-view-provider.js     # NEW: Sidebar tree
│   ├── injector.js               # Existing (unchanged)
│   ├── checksum.js               # Existing (unchanged)
│   ├── config.js                 # Existing (unchanged)
│   ├── file-utils.js             # Existing (unchanged)
│   ├── indexer.js                # Existing (unchanged)
│   ├── mcp-injector.js           # Existing (unchanged)
│   └── model-downloader.js       # Existing (unchanged)
├── mcp-server/                   # NEW: Bundled MCP server
│   ├── index.js                  # Server entry point
│   ├── node_modules/             # Server dependencies
│   └── ...                       # All server dist files
├── webview-assets/               # NEW: Panel HTML/JS/CSS
│   ├── graph/
│   │   ├── index.html
│   │   ├── graph.js              # Three.js + 3d-force-graph
│   │   └── graph.css
│   ├── dashboard/
│   │   ├── index.html
│   │   ├── dashboard.js          # Chart.js
│   │   └── dashboard.css
│   ├── tags/
│   ├── quality/
│   └── analytics/
├── resources/                    # Existing (unchanged)
├── package.json
└── .vscodeignore
```
