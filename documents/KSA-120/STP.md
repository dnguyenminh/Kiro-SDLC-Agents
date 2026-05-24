# Software Test Plan (STP)

## KSA-120: Bundle MCP NodeJS Server + Native VS Code Webview KB Panels

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-120 |
| Title | Bundle MCP NodeJS Server + Native VS Code Webview KB Panels |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-05-25 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-120.docx |
| Related FSD | FSD-v1-KSA-120.docx |
| Related TDD | TDD-v1-KSA-120.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-05-25 | QA Agent | Initial STP |

---

## 1. Introduction

### 1.1 Purpose

This STP defines the testing strategy for the v2.0.0 upgrade of the kiro-sdlc-agents VS Code extension introducing bundled MCP server lifecycle management and five native Webview KB panels.

### 1.2 Scope

**In Scope:**
- McpServerManager: spawn, kill, restart, crash recovery, orphan cleanup
- WebviewPanelManager: singleton enforcement, panel creation/disposal
- BasePanel + 5 concrete panels: data loading, message handling, HTML generation
- TreeViewProvider: sidebar tree, status updates
- MessageHandler: message routing between webview and MCP
- HtmlTemplateEngine: CSP-compliant HTML generation
- Extension integration: command registration, activation/deactivation
- Backward compatibility: all 6 existing commands unchanged

**Out of Scope:**
- MCP server internal logic (32 tools)
- Agent prompt modifications
- Python/Kotlin MCP variants

### 1.3 Test Approach

| Aspect | Strategy |
|--------|----------|
| Methodology | Risk-based testing prioritizing server lifecycle and panel rendering |
| Automation | 87% automated (PBT + UT + IT + E2E-API) |
| Manual | Visual/UX testing for webview panels, cross-platform VSIX install |
| Environment | VS Code Extension Development Host + Mocha test framework |
| CI/CD | GitHub Actions matrix (win/mac/linux) |

---

## 2. Test Strategy

### 2.1 Test Levels Overview

| # | Level | Scope | Automation | Framework |
|---|-------|-------|------------|-----------|
| 1 | Property-Based Testing (PBT) | Pure functions, data transformations | 100% | fast-check |
| 2 | Unit Testing (UT) | Individual classes/methods in isolation | 100% | Mocha + Sinon |
| 3 | Integration Testing (IT) | Component interactions | 100% | Mocha + @vscode/test-electron |
| 4 | E2E API Testing (E2E-API) | Full extension + real MCP server | 100% | @vscode/test-electron |
| 5 | E2E UI Testing (E2E-UI) | Webview rendering + interactions | 78% | Playwright |
| 6 | System Integration Testing (SIT) | Cross-platform install + visual | 0% (manual) | Manual checklist |

### 2.2 PBT Details

| Component | Properties |
|-----------|-----------|
| getNonce() | 32 hex chars, unique across 10000 calls |
| Message type validation | Valid types accepted, invalid rejected |
| JSON-RPC ID generation | Monotonically increasing, no duplicates |
| Backoff calculation | [5000, 15000, 30000] for attempts 1-3 |
| Node color mapping | Every type maps to valid hex color |
| Node size calculation | Proportional to citations, bounded [5, 50] |

### 2.3 UT Details

| Component | Key Methods | Mock Strategy |
|-----------|-------------|---------------|
| McpServerManager | spawn, kill, restart, invokeTool, handleCrash | Mock child_process, fs |
| WebviewPanelManager | openPanel, getPanel, disposeAll | Mock vscode.window |
| BasePanel | create, reveal, sendMessage, dispose | Mock WebviewPanel |
| TreeViewProvider | getTreeItem, getChildren, refresh | Mock EventEmitter |
| MessageHandler | handleMessage (all types) | Mock McpServerManager |
| HtmlTemplateEngine | getGraphHtml, getDashboardHtml, etc. | Mock vscode.Webview |

### 2.4 IT Details

| Integration Point | Components | Technique |
|-------------------|-----------|-----------|
| Server status → Panel notification | McpServerManager + BasePanel | Real EventEmitter, mock process |
| Panel → MCP tool invocation | MessageHandler + McpServerManager | Mock stdio, real routing |
| Extension activation flow | extension.ts + all managers | @vscode/test-electron |
| TreeView refresh on status | TreeViewProvider + McpServerManager | Real events |
| Panel singleton enforcement | WebviewPanelManager + multiple opens | Real manager, mock window |

### 2.5 E2E-API Details

| Scenario | Verification |
|----------|--------------|
| Activation → Server spawn | PID file exists, status = running |
| Tool invocation round-trip | Panel receives valid data |
| Server crash → auto-restart | Restarts within backoff, panels reconnect |
| Deactivation → server kill | No orphan process |
| mcp.json injection | Config file created correctly |
| Existing config preservation | User prompted, config preserved |
| Backward compatibility | All 6 existing commands work |

### 2.6 E2E-UI Gherkin Scenarios

```gherkin
Feature: KB Graph Panel
  Scenario: Open and render graph
    Given extension active and MCP server running
    When I execute "Kiro SDLC: Open KB Graph"
    Then webview panel "KB Graph" opens
    And graph renders color-coded nodes
    And node count badge shows "N nodes, M edges"

  Scenario: Filter by type
    Given KB Graph panel open with nodes
    When I select only "DECISION" in type filter
    Then only DECISION nodes visible
    And node count updates

  Scenario: Node click detail
    Given KB Graph panel open
    When I click a node
    Then detail sidebar slides in
    And shows title, content, tags, citations

Feature: KB Dashboard Panel
  Scenario: Dashboard loads with metrics
    Given extension active
    When I execute "Kiro SDLC: Open KB Dashboard"
    Then health gauge renders (0-100)
    And type distribution pie chart renders
    And trend chart shows 30-day data

  Scenario: Auto-refresh
    Given dashboard open
    When 60 seconds pass
    Then data refreshes automatically
    And charts update

Feature: Server Crash Recovery
  Scenario: Panel shows disconnected overlay
    Given graph panel open and server running
    When server process crashes
    Then panel shows "Server disconnected. Reconnecting..."
    And after restart, overlay disappears
    And data reloads
```

### 2.7 SIT Manual Checklist

| # | Check | Platform | Pass Criteria |
|---|-------|----------|---------------|
| 1 | VSIX install | Windows x64 | Extension activates, server starts |
| 2 | VSIX install | macOS arm64 | Extension activates, server starts |
| 3 | VSIX install | Linux x64 | Extension activates, server starts |
| 4 | Package size | All | VSIX < 50MB |
| 5 | Native addon | All | better-sqlite3 loads without error |
| 6 | Theme compliance | All | Panels respect dark/light/high-contrast |
| 7 | Memory usage | All | < 500MB with all panels open |
| 8 | Activation time | All | < 3s |
| 9 | Panel open time | All | < 2s first open |

---

## 3. Requirements Traceability Matrix (RTM)

### 3.1 Business Rules Coverage

| Rule ID | Rule | Test Level | Test Case IDs |
|---------|------|------------|---------------|
| BR-01 | Server starts within 5s | IT, E2E-API | IT-01, E2E-API-01 |
| BR-02 | Max 3 restarts, backoff [5s,15s,30s] | UT, IT | UT-MCM-05, IT-02 |
| BR-03 | Deactivate kills server | UT, E2E-API | UT-MCM-03, E2E-API-04 |
| BR-04 | No orphan processes | UT, E2E-API | UT-MCM-07, E2E-API-04 |
| BR-05 | Never overwrite mcp.json without confirm | UT, IT | UT-MCI-01, IT-05 |
| BR-06 | Core commands work without server | IT, E2E-API | IT-06, E2E-API-06 |
| BR-07 | Server tied to extension lifecycle | E2E-API | E2E-API-04 |
| BR-08 | Manual restart resets counter | UT | UT-MCM-04 |
| BR-09 | Package < 50MB | SIT | SIT-04 |
| BR-10 | Native addon on 3 platforms | SIT | SIT-01,02,03 |
| BR-11 | Graph 500 nodes at 60fps | E2E-UI, SIT | E2E-UI-GRAPH-01, SIT-07 |
| BR-12 | Dashboard loads < 2s | E2E-API, SIT | E2E-API-02, SIT-09 |
| BR-13 | Dashboard auto-refresh 60s | UT, E2E-UI | UT-DP-03, E2E-UI-DASH-03 |
| BR-14 | No HTTP in webview | UT | UT-HT-01 |
| BR-15 | retainContextWhenHidden | UT, IT | UT-BP-02, IT-03 |
| BR-16 | One instance per panel type | UT, IT | UT-WPM-02, IT-04 |
| BR-17 | Clear status during reconnection | IT, E2E-UI | IT-07, E2E-UI-CRASH-01 |
| BR-18 | Theme-aware panels | E2E-UI, SIT | E2E-UI-THEME-01, SIT-06 |
| BR-19 | Lazy-load heavy assets | UT | UT-HT-02 |
| BR-20 | Tag cloud font proportional | E2E-UI | E2E-UI-TAGS-01 |
| BR-21 | Activity Bar visible on activate | E2E-API | E2E-API-07 |
| BR-22 | Server status real-time | UT, IT | UT-TVP-02, IT-08 |
| BR-23 | Tree view refreshes on status | IT | IT-08 |
| BR-24 | Click tree item opens panel | IT, E2E-UI | IT-09, E2E-UI-TREE-01 |
| BR-25 | 6 existing commands unchanged | E2E-API | E2E-API-05 |
| BR-26 | Injected file content identical | E2E-API | E2E-API-05 |
| BR-27 | Respects Python/Kotlin config | IT | IT-05 |
| BR-28 | Checksum detection unchanged | E2E-API | E2E-API-05 |
| BR-29 | No breaking settings changes | E2E-API | E2E-API-05 |

### 3.2 Use Case Coverage

| UC ID | Use Case | Test Levels | Test Case IDs |
|-------|----------|-------------|---------------|
| UC-01 | Auto-Spawn MCP Server | UT, IT, E2E-API | UT-MCM-01, IT-01, E2E-API-01 |
| UC-02 | Manual Restart | UT, IT | UT-MCM-04, IT-02 |
| UC-03 | Auto-Restart on Crash | UT, IT, E2E-API | UT-MCM-05, IT-02, E2E-API-03 |
| UC-04 | Auto-Inject mcp.json | UT, IT | UT-MCI-01, IT-05 |
| UC-05 | Open KB Graph | UT, IT, E2E-UI | UT-GP-01, IT-10, E2E-UI-GRAPH-* |
| UC-06 | Open KB Dashboard | UT, IT, E2E-UI | UT-DP-01, IT-11, E2E-UI-DASH-* |
| UC-07 | Open KB Tags | UT, IT, E2E-UI | UT-TP-01, IT-12, E2E-UI-TAGS-* |
| UC-08 | Open KB Quality | UT, IT, E2E-UI | UT-QP-01, IT-13, E2E-UI-QUAL-* |
| UC-09 | Open KB Analytics | UT, IT, E2E-UI | UT-AP-01, IT-14, E2E-UI-ANAL-* |
| UC-10 | Sidebar Tree View | UT, IT, E2E-UI | UT-TVP-01, IT-09, E2E-UI-TREE-* |
| UC-11 | Existing Inject Workflow | E2E-API | E2E-API-05 |
| UC-12 | Crash Recovery | UT, IT, E2E-API | UT-MCM-05, IT-07, E2E-API-03 |

---

## 4. Test Environment

### 4.1 Tools

| Tool | Version | Purpose |
|------|---------|---------|
| Mocha | 10.x | Test runner |
| Sinon | 17.x | Mocking/stubbing |
| Chai | 5.x | Assertions |
| fast-check | 3.x | Property-based testing |
| @vscode/test-electron | 2.x | VS Code integration tests |
| Playwright | 1.x | E2E UI (webview) |
| Istanbul/nyc | 17.x | Code coverage |

### 4.2 Test Data

| Data Set | Description | File |
|----------|-------------|------|
| Empty KB | No entries | Fresh index.db |
| Small KB | 10 entries, 5 relationships | testdata/small-kb.sql |
| Medium KB | 100 entries, 50 relationships | testdata/medium-kb.sql |
| Large KB | 500 entries, 200 relationships | testdata/large-kb.sql |
| Corrupted DB | Invalid SQLite | testdata/corrupted.db |

---

## 5. Test Execution Strategy

### 5.1 Execution Order

```
Phase 1: PBT + UT (parallel, < 30s)
Phase 2: IT (VS Code test host, < 2min)
Phase 3: E2E-API (real MCP server, < 5min)
Phase 4: E2E-UI (rendered webviews, < 10min)
Phase 5: SIT (manual, cross-platform)
```

### 5.2 Entry/Exit Criteria

| Level | Entry | Exit |
|-------|-------|------|
| PBT | Code compiles | All properties hold 1000+ samples |
| UT | Code compiles | 100% pass, >= 90% line coverage |
| IT | UT pass | All integration points verified |
| E2E-API | IT pass | All API scenarios pass |
| E2E-UI | E2E-API pass | All UI scenarios pass |
| SIT | VSIX built | All manual checks pass |

---

## 6. Risk Assessment

| # | Risk | Probability | Impact | Mitigation |
|---|------|-------------|--------|-----------|
| 1 | Native addon platform failure | Medium | High | CI matrix all 3 platforms |
| 2 | WebGL unavailable (SSH/remote) | Low | Medium | 2D fallback test |
| 3 | MCP server memory leak | Medium | Medium | Memory monitoring in E2E |
| 4 | CSP blocks scripts | Low | High | Nonce-based CSP, UT coverage |
| 5 | retainContextWhenHidden memory | Medium | Medium | All-panels-open stress test |
| 6 | Orphan process on crash | Medium | Low | PID cleanup verification |
| 7 | Race condition in panel ops | Low | Medium | Singleton + mutex testing |

---

## 7. Test Metrics

| Metric | Target |
|--------|--------|
| Line coverage (UT) | >= 90% |
| Branch coverage (UT) | >= 85% |
| Requirements coverage | 100% (all BR/UC have tests) |
| Automation rate | >= 85% |

### Summary

| Level | Total | Automated | Manual |
|-------|-------|-----------|--------|
| PBT | 6 | 6 | 0 |
| UT | 48 | 48 | 0 |
| IT | 14 | 14 | 0 |
| E2E-API | 7 | 7 | 0 |
| E2E-UI | 18 | 14 | 4 |
| SIT | 9 | 0 | 9 |
| **Total** | **102** | **89 (87%)** | **13 (13%)** |

---

## 8. Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| QA Lead | QA Agent | 2025-05-25 | Approved |
| SM | SM Agent | 2025-05-25 | Pending |
