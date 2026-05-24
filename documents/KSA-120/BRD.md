# Business Requirements Document (BRD)

## Kiro SDLC Agents Extension — KSA-120: Bundle MCP Server & Native KB Webview Panels

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

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | SA Agent – Solution Architect | Review technical feasibility |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-05-23 | BA Agent | Initiate document — feature request from stakeholder discussion |
| 1.1 | 2025-05-24 | BA Agent | Updated for HTTP transport, port 9180, Stop/Start/Change Port commands |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

Nâng cấp VS Code extension `kiro-sdlc-agents` (v1.8.1 → v2.0.0) với hai thay đổi lớn:

1. **Bundle MCP NodeJS Server** — Đóng gói `mcp-code-intelligence-nodejs/dist/` vào extension, tự động spawn child process khi activate. Server giao tiếp qua **HTTP** (localhost:9180, JSON-RPC over HTTP). User không cần cài npx/uvx/java riêng.

2. **Native VS Code Webview Panels** — Rewrite KB Viewer từ iframe-based sang native VS Code Webview API. 5 panels: Graph, Dashboard, Tags, Quality, Analytics.

3. **Sidebar Activity Bar** — Tree view với links đến các KB panels.

4. **Commands mới** — 10 commands cho KB panels + MCP server management (bao gồm Stop, Start, Change Port).

### 1.2 Out of Scope

- Thay đổi MCP server logic/tools (32 tools giữ nguyên)
- Thay đổi agent prompts (BA, SA, QA, DEV, DevOps, UI, Security, SM, TA)
- Thay đổi steering rules, hooks, templates
- Python/Kotlin MCP variants (vẫn giữ nguyên option cho user chọn)
- Backend API changes cho MCP server
- Mobile/web extension support

### 1.3 Preliminary Requirement

- Extension hiện tại v1.8.1 đã stable với inject workflow
- `mcp-code-intelligence-nodejs` package v0.6.0 đã build thành công (`dist/` folder)
- VS Code API ^1.85.0 hỗ trợ Webview API, TreeView API, child_process
- Node.js 20+ runtime (bundled với VS Code)

---

## 2. Business Requirements

### 2.1 High Level Process Map

Extension upgrade flow:

**Step 1:** User installs/updates extension từ VS Code Marketplace

**Step 2:** Extension activates → auto-spawn bundled MCP NodeJS server as child process

**Step 3:** Extension auto-injects `mcp.json` config trỏ vào bundled server (không cần user config)

**Step 4:** User mở KB panels qua commands hoặc sidebar → native webview renders data từ MCP server

**Step 5:** User có thể restart/kill MCP server qua command nếu cần

> **Note:** Tất cả chức năng hiện tại (inject agents, steering, hooks, templates, selective inject, update, status) giữ nguyên 100%.

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source |
|---|------------------|----------|--------|
| 1 | Bundle MCP Server — Zero-config startup | MUST HAVE | KSA-120 |
| 2 | Auto-spawn MCP server on extension activate | MUST HAVE | KSA-120 |
| 3 | Kill/Restart MCP server via command | MUST HAVE | KSA-120 |
| 4 | Auto-inject mcp.json pointing to bundled server | MUST HAVE | KSA-120 |
| 5 | Native KB Graph Panel (3D knowledge graph) | MUST HAVE | KSA-120 |
| 6 | Native KB Dashboard Panel (health, metrics, trends) | MUST HAVE | KSA-120 |
| 7 | Native KB Tags Panel (tag cloud, taxonomy tree) | SHOULD HAVE | KSA-120 |
| 8 | Native KB Quality Panel (quality distribution, low-quality table) | SHOULD HAVE | KSA-120 |
| 9 | Native KB Analytics Panel (search metrics, popular queries, gaps) | SHOULD HAVE | KSA-120 |
| 10 | Sidebar Activity Bar with tree view links | SHOULD HAVE | KSA-120 |
| 11 | Graceful fallback khi MCP server crash | MUST HAVE | KSA-120 |
| 12 | Backward compatibility — existing inject workflow unchanged | MUST HAVE | KSA-120 |

---

### 2.3 Details of User Stories

---

#### Business Flow

![Business Flow](diagrams/business-flow.png)

**Step 1:** Extension activates (VS Code startup hoặc first command)

**Step 2:** Check bundled MCP server dist exists trong extension directory

**Step 3:** Spawn `node dist/index.js` as child process, server listens on HTTP port 9180

**Step 4:** Write/update `.kiro/settings/mcp.json` trỏ vào bundled server (HTTP localhost:9180)

**Step 5:** Register all commands (existing + new KB panel commands)

**Step 6:** Register sidebar tree view provider

**Step 7:** User interacts via commands/sidebar → open webview panels

**Step 8:** Webview panels communicate với MCP server qua extension host (message passing)

---

#### STORY 1: Bundle MCP Server — Zero-config Startup

> As a developer using Kiro SDLC extension, I want the MCP Code Intelligence server to be bundled and auto-started so that I don't need to install npx/uvx/java separately.

**Requirement Details:**

1. Extension PHẢI bundle `mcp-code-intelligence-nodejs/dist/` folder vào extension package
2. Bundle location: `{extensionPath}/mcp-server/` (copy từ `mcp-code-intelligence-nodejs/dist/`)
3. Extension PHẢI include `better-sqlite3` native addon pre-built cho platform target
4. Bundle size target: < 50MB (including native addons)
5. Extension vẫn giữ option cho user chọn Python/Kotlin variant nếu muốn override

**Acceptance Criteria:**

1. Sau khi install extension, user KHÔNG cần chạy `npm install`, `npx`, `uvx`, hoặc `java` command nào
2. Extension folder chứa `mcp-server/index.js` và tất cả dependencies
3. `better-sqlite3` native addon hoạt động trên Windows x64, macOS arm64, Linux x64
4. Extension package size < 50MB
5. Existing Python/Kotlin variants vẫn available qua "Inject MCP Config" command

---

#### STORY 2: Auto-spawn MCP Server on Extension Activate

> As a developer, I want the MCP server to start automatically when VS Code opens so that Code Intelligence is always available without manual steps.

**Requirement Details:**

1. Khi extension activate, spawn `node {extensionPath}/mcp-server/index.js` as child process
2. Pass config: `--config {workspaceFolder}/.code-intel/orchestration.json`
3. Server starts HTTP listener on **port 9180** (default, configurable in `.kiro/settings/mcp.json`)
4. Set environment variables: `CODE_INTEL_WORKSPACE={workspaceFolder}`
5. Capture stdout/stderr cho logging
6. Monitor process health — restart nếu crash (max 3 retries, backoff 5s → 15s → 30s)
7. Process lifecycle tied to extension — deactivate kills process
8. If configured port is busy → show error notification (do NOT fallback to random port)

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| serverProcess | ChildProcess | Yes | Reference to spawned Node.js process | — |
| serverStatus | enum | Yes | Current server state | "starting" / "running" / "crashed" / "stopped" |
| restartCount | number | Yes | Number of restart attempts since last success | 0-3 |
| lastCrashTime | Date | No | Timestamp of last crash | 2025-05-23T10:00:00Z |

**Acceptance Criteria:**

1. MCP server starts within 5 seconds of extension activation
2. Server process visible in VS Code Output channel "Kiro SDLC: MCP Server"
3. If server crashes, auto-restart within 5 seconds (first attempt)
4. After 3 failed restarts, show error notification + stop retrying
5. Extension deactivate cleanly kills server process (SIGTERM → SIGKILL after 5s)
6. No orphan processes after VS Code closes

**Error Handling:**

- Server fails to start (port 9180 busy): Show error "Port 9180 is already in use. Change port in .kiro/settings/mcp.json or stop the conflicting process."
- Server crashes during operation: Auto-restart, show warning "MCP server restarted"
- Node.js not available: Show error "Node.js 20+ required for bundled MCP server"

---

#### STORY 3: Kill/Restart/Stop/Start MCP Server via Commands

> As a developer, I want to manually restart, stop, or start the MCP server so that I can recover from bad states or control resource usage.

**Requirement Details:**

1. Command `Kiro SDLC: Restart MCP Server` — kills current process, spawns new one
2. Command `Kiro SDLC: Stop MCP Server` — kills current process, sets status to stopped
3. Command `Kiro SDLC: Start MCP Server` — spawns new process (if currently stopped)
4. Command `Kiro SDLC: Change MCP Port...` — opens input box to change port, saves to mcp.json, restarts server
5. Kill = SIGTERM, wait 5s, then SIGKILL if still alive
6. Show progress notification during restart/stop/start
7. Reset restart counter after manual restart or start

**Acceptance Criteria:**

1. All 4 commands available in Command Palette
2. Restart completes within 10 seconds
3. All webview panels reconnect after restart/start (no stale data)
4. Status bar updates to reflect server state during restart/stop/start
5. Stop command sets status to "stopped" — no auto-restart triggered
6. Change Port validates input (numeric, 1024-65535), saves to mcp.json, restarts server

---

#### STORY 4: Auto-inject mcp.json Pointing to Bundled Server

> As a developer, I want the extension to automatically configure mcp.json so that Kiro IDE agents can use the bundled MCP server without manual setup.

**Requirement Details:**

1. On activate, write/update `.kiro/settings/mcp.json` với config cho bundled server
2. Config format:
   ```json
   {
     "mcpServers": {
       "code-intelligence": {
         "command": "node",
         "args": ["{extensionPath}/mcp-server/index.js", "--config", "{workspaceFolder}/.code-intel/orchestration.json"],
         "cwd": "{workspaceFolder}",
         "env": {
           "CODE_INTEL_WORKSPACE": "{workspaceFolder}"
         }
       }
     }
   }
   ```
3. KHÔNG overwrite nếu user đã có custom config (check if `code-intelligence` key exists với different command)
4. Nếu user đã có config → show prompt: "Update MCP config to use bundled server? (Current: {current_command})"

**Acceptance Criteria:**

1. Fresh workspace: mcp.json auto-created với bundled server config
2. Existing workspace with npx/uvx config: prompt user before overwriting
3. Existing workspace with bundled config: no-op (already correct)
4. Config uses `${extensionPath}` placeholder resolved at runtime
5. After inject, Kiro agents can immediately use MCP tools

---

#### STORY 5: Native KB Graph Panel (3D Knowledge Graph)

> As a developer, I want to visualize my knowledge base as an interactive 3D graph so that I can understand relationships between knowledge entries.

**Requirement Details:**

1. Command: `Kiro SDLC: Open KB Graph`
2. Opens VS Code Webview panel (native, NOT iframe)
3. Renders 3D force-directed graph using Three.js + 3d-force-graph library
4. Nodes = KB entries (color-coded by type: DECISION=blue, ERROR_PATTERN=red, ARCHITECTURE=green, etc.)
5. Edges = relationships from knowledge graph (neighbors, citations)
6. Interactive: rotate, zoom, click node to see details
7. Data source: MCP tools `mem_search`, `mem_graph(action: "ego")`, `mem_crud(action: "list")`

**UI Specifications:**

| No. | Name | Type | Required | Description | Note |
|-----|------|------|----------|-------------|------|
| 1 | Graph Canvas | WebGL Canvas | Yes | 3D force-directed graph | Three.js + 3d-force-graph |
| 2 | Node Tooltip | Popup | Yes | Shows entry summary on hover | |
| 3 | Node Detail Panel | Side panel | Yes | Shows full entry on click | Slide-in from right |
| 4 | Filter Controls | Dropdown + Checkboxes | Yes | Filter by type, tier, tags | Top toolbar |
| 5 | Search Box | Input | Yes | Search nodes by content | Top-left |
| 6 | Layout Toggle | Button group | No | Switch 2D/3D view | Default: 3D |
| 7 | Refresh Button | Button | Yes | Reload data from MCP | Top-right |

**Acceptance Criteria:**

1. Graph renders within 3 seconds for up to 500 nodes
2. Smooth 60fps interaction (rotate, zoom) on standard hardware
3. Nodes color-coded by type with legend
4. Click node → shows entry details (title, content preview, tags, citations)
5. Filter by type/tier updates graph in real-time
6. Graph persists state when panel is hidden/shown (VS Code retainContextWhenHidden)

---

#### STORY 6: Native KB Dashboard Panel (Health, Metrics, Trends)

> As a developer, I want a dashboard showing KB health and metrics so that I can monitor the quality of my knowledge base.

**Requirement Details:**

1. Command: `Kiro SDLC: Open KB Dashboard`
2. Opens VS Code Webview panel
3. Displays:
   - Health gauge (overall KB quality score 0-100)
   - Entry count by type (pie chart)
   - Entry count by tier (bar chart)
   - Trend chart (entries added over time — last 30 days)
   - Recent activity (last 10 ingested entries)
   - Stale entries count + link to review
4. Data source: MCP tools `mem_admin(action: "dashboard")`, `mem_scoring(action: "quality_stats")`, `mem_admin(action: "analytics")`

**UI Specifications:**

| No. | Name | Type | Required | Description | Note |
|-----|------|------|----------|-------------|------|
| 1 | Health Gauge | Circular gauge | Yes | Overall quality 0-100 | Color: red < 40, yellow < 70, green ≥ 70 |
| 2 | Type Distribution | Pie chart | Yes | Entries by type | Interactive — click slice to filter |
| 3 | Tier Distribution | Bar chart | Yes | Entries by tier | Horizontal bars |
| 4 | Trend Chart | Line chart | Yes | Entries over time (30 days) | Area chart with gradient |
| 5 | Recent Activity | List | Yes | Last 10 entries | Clickable → opens entry |
| 6 | Stale Entries | Badge + Link | Yes | Count of stale entries | Click → runs lifecycle detect |
| 7 | Refresh Button | Button | Yes | Reload all metrics | Top-right |

**Acceptance Criteria:**

1. Dashboard loads within 2 seconds
2. All charts render correctly with real data from MCP
3. Auto-refresh every 60 seconds (configurable)
4. Responsive layout — adapts to panel width
5. Empty state shown gracefully when KB has no entries

---

#### STORY 7: Native KB Tags Panel (Tag Cloud, Taxonomy Tree)

> As a developer, I want to browse my KB by tags so that I can find related knowledge quickly.

**Requirement Details:**

1. Command: `Kiro SDLC: Open KB Tags`
2. Two views: Tag Cloud (visual) + Taxonomy Tree (hierarchical)
3. Tag Cloud: font size proportional to usage count
4. Taxonomy Tree: parent-child tag relationships
5. Click tag → shows all entries with that tag
6. Data source: MCP tools `mem_tags(action: "taxonomy")`, `mem_tags(action: "popular")`, `mem_tags(action: "search")`

**Acceptance Criteria:**

1. Tag cloud renders with proportional sizing
2. Taxonomy tree shows parent-child relationships
3. Click tag → filters entries list
4. Search within tags works
5. Create new tag from panel (calls `mem_tags(action: "create")`)

---

#### STORY 8: Native KB Quality Panel (Quality Distribution, Low-Quality Table)

> As a developer, I want to see quality scores of my KB entries so that I can identify and improve low-quality entries.

**Requirement Details:**

1. Command: `Kiro SDLC: Open KB Quality`
2. Displays:
   - Quality score distribution (histogram)
   - Low-quality entries table (score < 40)
   - Confidence score distribution
   - Unreliable entries list
3. Data source: MCP tools `mem_scoring(action: "quality_stats")`, `mem_scoring(action: "low_quality")`, `mem_scoring(action: "confidence_stats")`, `mem_scoring(action: "unreliable")`

**Acceptance Criteria:**

1. Histogram shows quality distribution across all entries
2. Low-quality table sortable by score, type, date
3. Click entry → shows details + suggestions for improvement
4. Bulk actions: archive, delete, mark for review

---

#### STORY 9: Native KB Analytics Panel (Search Metrics, Popular Queries, Gaps)

> As a developer, I want to see search analytics so that I can understand how my KB is being used and identify gaps.

**Requirement Details:**

1. Command: `Kiro SDLC: Open KB Analytics`
2. Displays:
   - Search volume over time
   - Popular queries (top 20)
   - Zero-result queries (knowledge gaps)
   - Most cited entries
   - Recommendations for new entries
3. Data source: MCP tools `mem_admin(action: "analytics")`, `mem_admin(action: "popular")`, `mem_admin(action: "gaps")`, `mem_admin(action: "zero_results")`, `mem_admin(action: "recommendations")`

**Acceptance Criteria:**

1. Analytics data loads within 3 seconds
2. Popular queries shown with frequency count
3. Zero-result queries highlighted as "gaps" with suggestion to create entry
4. Most cited entries shown with citation count
5. Recommendations actionable — click to create new entry from suggestion

---

#### STORY 10: Sidebar Activity Bar with Tree View Links

> As a developer, I want a sidebar icon that gives me quick access to all KB panels so that I don't need to remember command names.

**Requirement Details:**

1. Activity Bar icon (left sidebar) — custom icon for "Kiro SDLC"
2. Tree view with sections:
   - **✅ Running (Port 9180)** ← port shown at root level
   - **Knowledge Base**
     - 📊 Dashboard
     - 🕸️ Graph
     - 🏷️ Tags
     - ⭐ Quality
     - 📈 Analytics
   - **MCP Server**
     - Status: Running ✅
     - 🔄 Restart Server
     - ⏹️ Stop Server
     - ▶️ Start Server (shown when stopped)
     - ⚙️ Change Port... (opens input box)
   - **Documents** (future — link to document explorer)
3. Click item → opens corresponding webview panel or executes command

**Acceptance Criteria:**

1. Activity Bar icon visible after extension activates
2. Tree view shows all sections with correct icons
3. Click item opens correct panel
4. MCP Server status updates in real-time (running/stopped/crashed)
5. Tree view refreshes when server status changes

---

#### STORY 11: Graceful Fallback When MCP Server Crash

> As a developer, I want the extension to handle MCP server crashes gracefully so that my workflow isn't disrupted.

**Requirement Details:**

1. If MCP server crashes, webview panels show "Server disconnected. Reconnecting..." message
2. Auto-restart server (Story 2 restart logic)
3. After restart, panels auto-reconnect and refresh data
4. If restart fails after 3 attempts, panels show "Server unavailable. Click to retry." button
5. Extension core functionality (inject, update, status) MUST work even without MCP server

**Acceptance Criteria:**

1. Crash doesn't cause extension to deactivate
2. Panels show clear status during reconnection
3. No data loss — panels refresh from server after reconnect
4. Core inject/update/status commands always work regardless of MCP server state
5. User can manually restart via command even after max retries exceeded

---

#### STORY 12: Backward Compatibility — Existing Inject Workflow Unchanged

> As an existing user of kiro-sdlc-agents, I want all current features to work exactly as before so that the upgrade doesn't break my workflow.

**Requirement Details:**

1. All existing commands preserved:
   - `Kiro SDLC: Inject All Agents`
   - `Kiro SDLC: Inject (Select Components)`
   - `Kiro SDLC: Update Agents (Keep Customizations)`
   - `Kiro SDLC: Show Status`
   - `Kiro SDLC: Index Workspace`
   - `Kiro SDLC: Download Embedding Model`
2. Existing inject logic unchanged (agents, steering, hooks, templates)
3. User who prefers Python/Kotlin MCP variant can still choose via "Inject MCP Config"
4. Status bar behavior unchanged
5. Auto-upgrade detection unchanged

**Acceptance Criteria:**

1. All 6 existing commands work identically to v1.8.1
2. Injected files (agents, steering, hooks, templates) identical content
3. User with existing Python/Kotlin config → extension respects their choice, doesn't force bundled server
4. Checksum-based update detection still works
5. No breaking changes in extension settings/configuration

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| mcp-code-intelligence-nodejs v0.6.0 | Internal Package | N/A | NodeJS MCP server to bundle |
| better-sqlite3 | Native Addon | N/A | SQLite binding — needs pre-built for each platform |
| VS Code ^1.85.0 | Platform | N/A | Webview API, TreeView API, child_process support |
| Node.js 20+ | Runtime | N/A | Required by MCP server (bundled with VS Code) |
| Three.js | Frontend Library | N/A | 3D rendering for KB Graph panel |
| 3d-force-graph | Frontend Library | N/A | Force-directed graph layout |
| Chart.js or D3.js | Frontend Library | N/A | Charts for Dashboard, Analytics panels |
| shared/viewer HTML/CSS/JS | Internal | N/A | Existing viewer assets to adapt for native webview |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Product Owner | Duc Nguyen | Feature approval, priority | Extension author |
| Developer | DEV Agent | Implementation | — |
| QA | QA Agent | Testing | — |
| End Users | VS Code developers using Kiro | Feedback, UAT | Marketplace users |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| better-sqlite3 native addon incompatibility across platforms | High | Medium | Pre-build for win-x64, mac-arm64, linux-x64; test on CI |
| Extension package size too large (>100MB) | Medium | Low | Tree-shake dependencies, exclude dev files, use .vscodeignore |
| MCP server memory leak in long-running sessions | High | Medium | Monitor memory usage, implement periodic restart option |
| Webview security restrictions block MCP communication | Medium | Low | Use VS Code message passing API (postMessage), not direct HTTP |
| Three.js bundle size impacts extension load time | Medium | Medium | Lazy-load graph panel assets only when opened |
| Child process orphaning on VS Code crash | Medium | Medium | PID file + cleanup on next activate |

### 5.2 Assumptions

- VS Code's built-in Node.js runtime (>=20) is sufficient to run the MCP server
- `better-sqlite3` can be pre-built and bundled for the 3 major platforms
- Webview panels can communicate with extension host fast enough for real-time graph updates
- MCP server HTTP transport on localhost:9180 works reliably for extension↔server communication
- Port 9180 is typically available on developer machines (not commonly used by other tools)
- Users have sufficient RAM (>4GB) to run VS Code + MCP server + webview panels simultaneously
- Extension marketplace allows packages up to 100MB

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Extension activation < 3s | MCP server spawn is async, doesn't block activation |
| Performance | Webview panel load < 2s | Lazy-load heavy assets (Three.js) only when panel opens |
| Performance | Graph renders 500 nodes at 60fps | Use WebGL, level-of-detail for large graphs |
| Reliability | MCP server uptime > 99% during session | Auto-restart with backoff, max 3 retries |
| Reliability | No data loss on crash | SQLite WAL mode, graceful shutdown |
| Security | No network requests from webview | All data via extension host message passing |
| Security | MCP server runs in workspace scope only | No access outside workspace folder |
| Compatibility | Windows x64, macOS arm64, Linux x64 | Pre-built native addons for each platform |
| Compatibility | VS Code ^1.85.0 | Minimum supported version |
| Size | Extension package < 50MB | Aggressive tree-shaking, .vscodeignore |
| Usability | Zero-config for new users | Bundled server starts automatically |
| Usability | Non-breaking for existing users | All current features preserved |
| Maintainability | MCP server version pinned in extension | Update via extension release cycle |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-120 | Bundle MCP Server + Native KB Webview Panels | In Progress | Story | Main ticket |
| KSA-108 | MCP Code Intelligence Server (NodeJS) | Done | Story | Dependency — server to bundle |
| KSA-110 | KB Viewer (iframe-based) | Done | Story | Predecessor — being replaced by native webview |

---

## 8. Appendix

### Architecture Decision: Option A — Spawn Child Process

**Decision:** Bundle MCP server dist và spawn as child process (NOT embed in extension host process).

**Rationale:**
- Isolation: server crash doesn't crash extension
- Memory: separate V8 heap, can be killed/restarted independently
- Compatibility: same server code works standalone (npx) or bundled
- Debugging: separate process can be attached to debugger

**Alternative rejected:** Option B (embed in extension host) — rejected because:
- Shared memory space = crash affects extension
- Cannot restart without reloading window
- Harder to debug

### Architecture Decision: Option B — Native Webview Rewrite

**Decision:** Rewrite KB viewer as native VS Code Webview panels (NOT iframe pointing to HTTP server).

**Rationale:**
- Security: no HTTP server needed, no port conflicts
- Performance: direct message passing vs HTTP round-trips
- UX: native VS Code look and feel, theme-aware
- Reliability: no dependency on viewer port being available

**Alternative rejected:** Keep iframe approach — rejected because:
- Port conflicts with other tools
- Security warnings in some VS Code configurations
- Not theme-aware (looks foreign in VS Code)

### MCP Server Tools (32 total — all preserved)

| Category | Tools | Count |
|----------|-------|-------|
| Code Intelligence | code_search, code_symbols, code_context, code_modules, code_index_status, code_kb_export, stream_write_file, drawio_auto_layout | 8 |
| Memory Core | mem_search, mem_ingest, mem_ingest_file, mem_crud, mem_graph, mem_consolidate | 6 |
| Memory Lifecycle | mem_lifecycle, mem_templates, mem_attachments, mem_discover | 4 |
| Memory Organization | mem_tags, mem_citations, mem_scoring, mem_map | 4 |
| Memory Admin | mem_admin, mem_pin, mem_conversation | 3 |
| Orchestration | find_tools, execute_dynamic_tool, toggle_tool, reset_tools, manage_auto_approve, orchestration_status, agent_log | 7 |
| **Total** | | **32** |

### Glossary

| Term | Definition |
|------|------------|
| MCP | Model Context Protocol — standard for AI tool communication |
| KB | Knowledge Base — local SQLite database managed by MCP server |
| Webview | VS Code API for rendering custom HTML/JS/CSS panels |
| Activity Bar | Left sidebar in VS Code with icons for Explorer, Search, etc. |
| Child Process | OS process spawned by extension, runs independently |
| stdio transport | Communication via stdin/stdout pipes between processes |
| HTTP transport | Communication via HTTP requests to localhost:port (JSON-RPC over HTTP) |
| FTS5 | SQLite Full-Text Search extension version 5 |
| WAL | Write-Ahead Logging — SQLite journaling mode for reliability |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
