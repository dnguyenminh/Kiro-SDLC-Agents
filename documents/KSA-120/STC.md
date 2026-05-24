# Software Test Cases (STC)

## KSA-120: Bundle MCP NodeJS Server + Native VS Code Webview KB Panels

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-120 |
| Version | 1.0 |
| Date | 2025-05-25 |
| Author | QA Agent |
| Related STP | STP-v1-KSA-120.docx |

---

## 1. Property-Based Tests (PBT)

| ID | Property | Input Generator | Assertion | Samples |
|----|----------|----------------|-----------|---------|
| PBT-01 | getNonce() returns 32 hex chars | N/A (no input) | result.length === 32 and /^[0-9a-f]+$/.test(result) | 10000 |
| PBT-02 | getNonce() uniqueness | N/A | Set of 10000 nonces has size 10000 | 1 run |
| PBT-03 | Backoff for attempt n in [1,3] | fc.integer({min:1, max:3}) | result === [5000,15000,30000][n-1] | 1000 |
| PBT-04 | JSON-RPC ID monotonic | fc.array(fc.anything()) | Each ID > previous ID | 1000 |
| PBT-05 | Node color valid hex | fc.constantFrom(...allTypes) | /^#[0-9a-fA-F]{6}$/.test(color) | 1000 |
| PBT-06 | Node size bounded [5,50] | fc.integer({min:0, max:1000}) | 5 <= size and size <= 50 | 1000 |

---

## 2. Unit Tests (UT)

### 2.1 McpServerManager (UT-MCM)

| ID | Test Case | Precondition | Steps | Expected Result | Priority |
|----|-----------|-------------|-------|-----------------|----------|
| UT-MCM-01 | spawn() starts server | Manager created | 1. Call spawn() 2. Mock process emits ready | spawn called with correct args, status transitions starting->running | P0 |
| UT-MCM-02 | spawn() fails bundle missing | fs.existsSync returns false | 1. Call spawn() | Throws McpBundleMissingError | P0 |
| UT-MCM-03 | kill() SIGTERM then SIGKILL | Server running | 1. Call kill() 2. Process doesn't exit in 5s | SIGTERM sent, then SIGKILL, status = stopped | P0 |
| UT-MCM-04 | restart() resets counter | restartCount = 2 | 1. Call restart() | kill() called, spawn() called, restartCount = 0 | P0 |
| UT-MCM-05 | handleCrash() backoff attempt 1 | Server crashes | 1. Process emits exit(1) | Status = crashed, waits 5000ms, respawns | P0 |
| UT-MCM-06 | handleCrash() max retries | restartCount >= 3 | 1. Process crashes | Status = stopped, error notification shown, no respawn | P0 |
| UT-MCM-07 | cleanupOrphan() | PID file with stale PID | 1. Activate extension | Stale process killed, PID file deleted | P1 |
| UT-MCM-08 | invokeTool() JSON-RPC format | Server running | 1. invokeTool("mem_search", {query:"x"}) | stdin.write called with valid JSON-RPC | P0 |
| UT-MCM-09 | invokeTool() timeout 30s | No response | 1. invokeTool() 2. 30s passes | Rejects with McpTimeoutError | P0 |
| UT-MCM-10 | invokeTool() server stopped | Status = stopped | 1. invokeTool() | Throws McpServerNotRunningError | P0 |
| UT-MCM-11 | handleStdout() resolves request | Valid response | 1. Write response to stdout mock | Pending promise resolved with result text | P0 |
| UT-MCM-12 | handleStdout() buffers partial | Incomplete JSON | 1. Emit half 2. Emit rest | Buffers, resolves on complete | P1 |
| UT-MCM-13 | onStatusChange event | Any status change | 1. setStatus("running") | Event fired with "running" | P0 |

### 2.2 WebviewPanelManager (UT-WPM)

| ID | Test Case | Precondition | Steps | Expected Result | Priority |
|----|-----------|-------------|-------|-----------------|----------|
| UT-WPM-01 | openPanel() creates new | No existing panel | 1. openPanel("graph") | Panel created, stored in map | P0 |
| UT-WPM-02 | openPanel() reveals existing | Panel already open | 1. openPanel("graph") again | reveal() called, no new panel | P0 |
| UT-WPM-03 | disposeAll() | 3 panels open | 1. disposeAll() | All disposed, map empty | P0 |
| UT-WPM-04 | getPanel() | Panel exists | 1. getPanel("dashboard") | Returns correct instance | P1 |
| UT-WPM-05 | notifyAllPanels() | 3 panels | 1. notifyAllPanels(msg) | All 3 receive message | P0 |
| UT-WPM-06 | Auto-remove on dispose | Panel disposed externally | 1. Panel.onDidDispose fires | Removed from map | P0 |

### 2.3 BasePanel (UT-BP)

| ID | Test Case | Precondition | Steps | Expected Result | Priority |
|----|-----------|-------------|-------|-----------------|----------|
| UT-BP-01 | create() options | - | 1. create() | enableScripts=true, retainContextWhenHidden=true | P0 |
| UT-BP-02 | retainContextWhenHidden | Panel created | 1. Check options | true | P0 |
| UT-BP-03 | sendMessage() | Panel created | 1. sendMessage(data) | postMessage called | P0 |
| UT-BP-04 | dispose() cleanup | Panel with listeners | 1. dispose() | All disposables cleaned | P0 |
| UT-BP-05 | Server status listener | Status changes | 1. Fire event | Panel gets serverStatus msg | P0 |

### 2.4 Panels (UT-GP, UT-DP, UT-TP, UT-QP, UT-AP)

| ID | Test Case | Component | Steps | Expected Result | Priority |
|----|-----------|-----------|-------|-----------------|----------|
| UT-GP-01 | loadData() | Graph | 1. loadData() | mem_crud + mem_graph invoked | P1 |
| UT-GP-02 | handleMessage(nodeClick) | Graph | 1. nodeClick {entryId:5} | mem_crud(get,5) called | P1 |
| UT-GP-03 | handleMessage(filterByType) | Graph | 1. filterByType ["DECISION"] | Filtered data sent | P1 |
| UT-GP-04 | handleMessage(searchNodes) | Graph | 1. searchNodes {query:"arch"} | Matching nodes highlighted | P2 |
| UT-DP-01 | loadData() | Dashboard | 1. loadData() | dashboard + quality_stats + analytics invoked | P1 |
| UT-DP-02 | handleMessage(refresh) | Dashboard | 1. refresh | loadData() called | P1 |
| UT-DP-03 | Auto-refresh timer | Dashboard | 1. Create 2. 60s passes | loadData() called again | P1 |
| UT-TP-01 | loadData() | Tags | 1. loadData() | taxonomy + popular invoked | P2 |
| UT-TP-02 | handleMessage(createTag) | Tags | 1. createTag {tag:"new"} | mem_tags(create) called | P2 |
| UT-TP-03 | handleMessage(filterByTag) | Tags | 1. filterByTag {tag:"arch"} | mem_tags(search) called | P2 |
| UT-QP-01 | loadData() | Quality | 1. loadData() | quality_stats + low_quality + confidence invoked | P2 |
| UT-QP-02 | handleMessage(bulkAction) | Quality | 1. bulkAction {archive, [1,2,3]} | lifecycle(archive) x3 | P2 |
| UT-AP-01 | loadData() | Analytics | 1. loadData() | analytics + popular + gaps + zero_results invoked | P2 |
| UT-AP-02 | handleMessage(createEntry) | Analytics | 1. createEntry {...} | mem_ingest called | P2 |

### 2.5 TreeViewProvider (UT-TVP)

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| UT-TVP-01 | getChildren(root) | 1. getChildren(undefined) | Returns 3 sections: KB, Server, Quick Actions | P1 |
| UT-TVP-02 | Status update | 1. Server status = running | Tree shows "Running" with check icon | P1 |
| UT-TVP-03 | getTreeItem() commands | 1. Get Dashboard item | command = kiroSdlc.openKbDashboard | P1 |
| UT-TVP-04 | refresh() event | 1. refresh() | onDidChangeTreeData fires | P1 |

### 2.6 HtmlTemplateEngine (UT-HT)

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| UT-HT-01 | CSP connect-src none | 1. Generate HTML | CSP has connect-src 'none' | P0 |
| UT-HT-02 | Three.js only in graph | 1. getGraphHtml() 2. getDashboardHtml() | Graph has three.min.js, dashboard doesn't | P1 |
| UT-HT-03 | Nonce in scripts | 1. Generate HTML | All script tags have nonce="${nonce}" | P0 |
| UT-HT-04 | asWebviewUri for resources | 1. Generate HTML | All src use webview URI scheme | P0 |
| UT-HT-05 | Chart.js distribution | 1. Check each panel HTML | Only dashboard/quality/analytics have chart.min.js | P1 |

### 2.7 MessageHandler (UT-MH)

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| UT-MH-01 | ready -> loadAll | 1. Handle {type:"ready"} | loadAll called, result posted | P0 |
| UT-MH-02 | refresh -> loadAll | 1. Handle {type:"refresh"} | loadAll called | P0 |
| UT-MH-03 | filterByType | 1. Handle {type:"filterByType",types:["X"]} | loadFiltered called | P1 |
| UT-MH-04 | nodeClick | 1. Handle {type:"nodeClick",entryId:5} | mem_crud(get,5) called | P1 |
| UT-MH-05 | manualRetry | 1. Handle {type:"manualRetry"} | mcpManager.restart() called | P0 |
| UT-MH-06 | Unknown type | 1. Handle {type:"bogus"} | No error, no action | P1 |

### 2.8 MCP Injector Enhanced (UT-MCI)

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| UT-MCI-01 | No existing config | 1. No mcp.json 2. inject | Creates with bundled server path | P0 |
| UT-MCI-02 | Same config exists | 1. mcp.json has bundled path | No-op | P0 |
| UT-MCI-03 | Different config (npx) | 1. mcp.json has npx | Prompts user | P0 |
| UT-MCI-04 | Preserves other servers | 1. mcp.json has other entries | Only code-intelligence updated | P1 |

---

## 3. Integration Tests (IT)

| ID | Test Case | Components | Steps | Expected Result | Priority |
|----|-----------|-----------|-------|-----------------|----------|
| IT-01 | Activation spawns server | extension + McpServerManager | 1. Activate extension | Server running within 5s, status bar updated | P0 |
| IT-02 | Crash -> restart -> reconnect | McpServerManager + Panel | 1. Kill process 2. Wait | Restarts with backoff, panel gets "connected" | P0 |
| IT-03 | Panel retains state | PanelManager + Panel | 1. Load data 2. Hide 3. Show | Same data displayed without reload | P1 |
| IT-04 | Singleton enforcement | WebviewPanelManager | 1. Open graph 2. Open graph again | Reveals existing, no duplicate | P0 |
| IT-05 | Custom mcp.json respected | mcp-injector + extension | 1. Custom config exists 2. Activate | User prompted, choice respected | P0 |
| IT-06 | Commands without server | extension + injector | 1. Stop server 2. injectAll | Inject succeeds | P0 |
| IT-07 | Panel disconnect overlay | BasePanel + McpServerManager | 1. Panel open 2. Server crashes | Panel gets "disconnected" status | P0 |
| IT-08 | TreeView status refresh | TreeViewProvider + McpServerManager | 1. Status changes | Tree updates | P1 |
| IT-09 | Tree click opens panel | TreeViewProvider + PanelManager | 1. Click Dashboard item | Dashboard panel opens | P1 |
| IT-10 | Graph data from MCP | GraphPanel + McpServerManager | 1. Open graph | MCP tools invoked, data rendered | P1 |
| IT-11 | Dashboard aggregation | DashboardPanel + McpServerManager | 1. Open dashboard | 3 tools invoked, data sent | P1 |
| IT-12 | Tags CRUD | TagsPanel + McpServerManager | 1. Create tag | mem_tags(create) invoked | P2 |
| IT-13 | Quality bulk action | QualityPanel + McpServerManager | 1. Bulk archive | lifecycle(archive) per entry | P2 |
| IT-14 | Analytics create entry | AnalyticsPanel + McpServerManager | 1. Create from recommendation | mem_ingest invoked | P2 |

---

## 4. E2E API Tests

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| E2E-API-01 | Full activation | 1. Open workspace 2. Wait | PID file exists, mcp.json created, status = running | P0 |
| E2E-API-02 | Panel data round-trip | 1. Open dashboard 2. Wait | Receives dashboardData with valid health | P0 |
| E2E-API-03 | Crash recovery | 1. Kill PID 2. Wait 10s | Server restarts, panel reconnects | P0 |
| E2E-API-04 | Deactivation cleanup | 1. Close VS Code | Process killed, PID deleted | P0 |
| E2E-API-05 | Backward compat | 1. injectAll 2. status 3. update | All work as v1.8.1 | P0 |
| E2E-API-06 | Commands without server | 1. Stop server 2. injectAll | Succeeds | P1 |
| E2E-API-07 | Sidebar visible | 1. Check Activity Bar | Icon visible, tree populated | P1 |

---

## 5. E2E UI Tests

| ID | Test Case | Panel | Steps | Expected | Auto | Priority |
|----|-----------|-------|-------|----------|------|----------|
| E2E-UI-GRAPH-01 | Render nodes | Graph | 1. Open graph | WebGL canvas, nodes visible | Yes | P1 |
| E2E-UI-GRAPH-02 | Filter by type | Graph | 1. Select DECISION | Only DECISION nodes | Yes | P1 |
| E2E-UI-GRAPH-03 | Node click | Graph | 1. Click node | Detail sidebar | Yes | P1 |
| E2E-UI-GRAPH-04 | Zoom/pan | Graph | 1. Scroll 2. Drag | View changes | No | P2 |
| E2E-UI-DASH-01 | Health gauge | Dashboard | 1. Open | Gauge 0-100 | Yes | P1 |
| E2E-UI-DASH-02 | Charts render | Dashboard | 1. Open | Pie+bar+trend visible | Yes | P1 |
| E2E-UI-DASH-03 | Auto-refresh | Dashboard | 1. Wait 60s | Data updates | Yes | P2 |
| E2E-UI-TAGS-01 | Tag cloud | Tags | 1. Open | Varying font sizes | Yes | P2 |
| E2E-UI-TAGS-02 | Tag click | Tags | 1. Click tag | Filtered entries | Yes | P2 |
| E2E-UI-TAGS-03 | Create tag | Tags | 1. Create | New tag appears | Yes | P2 |
| E2E-UI-QUAL-01 | Histogram | Quality | 1. Open | Score distribution | Yes | P2 |
| E2E-UI-QUAL-02 | Table sort | Quality | 1. Click header | Sorted | Yes | P2 |
| E2E-UI-QUAL-03 | Bulk archive | Quality | 1. Select 2. Archive | Entries removed | Yes | P2 |
| E2E-UI-ANAL-01 | Charts | Analytics | 1. Open | Volume + queries | Yes | P2 |
| E2E-UI-ANAL-02 | Time range | Analytics | 1. Change to 7d | Charts update | Yes | P2 |
| E2E-UI-CRASH-01 | Disconnect overlay | Any | 1. Kill server | Overlay appears | Yes | P0 |
| E2E-UI-THEME-01 | Dark theme | All | 1. Switch theme | Colors adapt | No | P2 |
| E2E-UI-TREE-01 | Sidebar nav | Sidebar | 1. Click items | Panels open | Yes | P1 |

---

## 6. System Integration Tests (SIT)

| ID | Test Case | Platform | Steps | Pass Criteria | Priority |
|----|-----------|----------|-------|---------------|----------|
| SIT-01 | Windows install | win32-x64 | 1. Install VSIX 2. Activate | Server starts, panels work | P0 |
| SIT-02 | macOS install | darwin-arm64 | 1. Install VSIX 2. Activate | Server starts, panels work | P0 |
| SIT-03 | Linux install | linux-x64 | 1. Install VSIX 2. Activate | Server starts, panels work | P0 |
| SIT-04 | Package size | All | 1. Check size | < 50MB | P0 |
| SIT-05 | Native addon | All | 1. Check output | No addon errors | P0 |
| SIT-06 | Theme compliance | All | 1. Dark/light/HC | Panels adapt | P1 |
| SIT-07 | Graph 500 nodes | All | 1. Large KB 2. Open graph | 60fps | P1 |
| SIT-08 | Activation time | All | 1. Measure | < 3s | P1 |
| SIT-09 | Panel open time | All | 1. Measure | < 2s | P1 |
