# Business Requirements Document (BRD)

## Kiro SDLC Agents — KSA-180: Settings & Configuration

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-180 |
| Title | Settings & Configuration — VS Code Extension |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-25 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-180.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-25 | BA Agent | Initial — inferred from source code and PARALLEL-PLAN.md |

---

## 1. Introduction

### 1.1 Scope

KSA-180 covers the **Settings & Configuration** subsystem of the Kiro SDLC Agents VS Code extension. This is the foundational component (Batch A) that all other Code Intelligence UI features depend on. It provides:

1. VS Code workspace settings (`contributes.configuration`) for controlling extension behavior
2. Configuration file management (orchestration.json) for MCP server behavior
3. Config file watcher with debounced change detection and auto-restart
4. MCP server variant selection (Python/Node.js/Kotlin) and lifecycle management
5. Port management with conflict detection
6. Settings UI commands (change port, edit config, change config file)

### 1.2 Out of Scope

- MCP server internal logic (handled by mcp-code-intelligence-nodejs)
- KB panel webviews (KSA-171, KSA-176)
- Code quality/security analysis UI (KSA-172, KSA-173)
- Symbol search and entry point explorer (KSA-179, KSA-175)
- Agent injection logic (existing feature, not part of this ticket)

### 1.3 Preliminary Requirements

- VS Code 1.85.0+ installed
- Node.js 20+ (for MCP server spawning)
- Workspace folder open in VS Code

---

## 2. Business Requirements

### 2.1 High Level Process Map

The Settings & Configuration system manages the lifecycle of extension settings and the MCP Code Intelligence server:

1. Extension activates -> reads VS Code settings
2. If `enableMcpServer` is true -> spawns MCP server on configured port
3. ConfigWatcher monitors `.kiro/settings/mcp.json` for external changes
4. User can change settings via VS Code Settings UI or extension commands
5. Settings changes trigger appropriate actions (restart server, update config)

### 2.2 List of User Stories

| # | Story / Use Case | Priority | Source |
|---|------------------|----------|--------|
| 1 | As a developer, I want to enable/disable the MCP server via settings so I can control resource usage | MUST HAVE | KSA-180 |
| 2 | As a developer, I want to change the MCP server port so I can avoid conflicts with other services | MUST HAVE | KSA-180 |
| 3 | As a developer, I want to specify a custom orchestration config path so I can use different configs per workspace | MUST HAVE | KSA-180 |
| 4 | As a developer, I want the extension to auto-detect port conflicts and connect to existing servers | SHOULD HAVE | KSA-180 |
| 5 | As a developer, I want config file changes to auto-restart the server so I don't have to manually restart | SHOULD HAVE | KSA-180 |
| 6 | As a developer, I want to choose between Python/Node.js/Kotlin MCP server variants so I can use my preferred runtime | COULD HAVE | KSA-180 |
| 7 | As a developer, I want a status bar indicator showing server status so I can quickly see if the server is running | MUST HAVE | KSA-180 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Extension activates when VS Code opens a workspace folder

**Step 2:** Extension reads `kiroSdlc.*` settings from VS Code configuration

**Step 3:** If `enableMcpServer` is true, extension checks if configured port is already in use

**Step 4a:** If port is in use -> connect to existing server (external mode)

**Step 4b:** If port is free -> spawn bundled MCP server as child process

**Step 5:** ConfigWatcher starts monitoring `.kiro/settings/mcp.json`

**Step 6:** Server status is reflected in status bar and tree view

**Step 7:** User can interact via commands: change port, edit config, restart/stop server

---

#### STORY 1: Enable/Disable MCP Server

> As a developer, I want to enable/disable the MCP server via settings so I can control resource usage

**Requirement Details:**

1. Setting `kiroSdlc.enableMcpServer` (boolean, default: true) controls auto-spawn
2. When disabled, server does NOT start on extension activation
3. When toggled from disabled to enabled, server should start
4. When toggled from enabled to disabled, server should stop
5. Output channel logs the disabled state: `[MCP] Server disabled by setting kiroSdlc.enableMcpServer`

**Acceptance Criteria:**

1. GIVEN setting is true WHEN extension activates THEN MCP server spawns automatically
2. GIVEN setting is false WHEN extension activates THEN MCP server does NOT spawn
3. GIVEN server is running WHEN user disables setting THEN server stops gracefully
4. GIVEN server is stopped WHEN user enables setting THEN server starts

---

#### STORY 2: Change MCP Server Port

> As a developer, I want to change the MCP server port so I can avoid conflicts with other services

**Requirement Details:**

1. Setting `kiroSdlc.mcpServerPort` (number, default: 9181) specifies the port
2. Command `kiroSdlc.changePort` shows input box with current port pre-filled
3. Port validation: must be 1-65535
4. After port change, server automatically restarts on new port
5. `.kiro/settings/mcp.json` is updated with new URL

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| mcpServerPort | number | Yes | TCP port for MCP server | 9181 |

**Acceptance Criteria:**

1. GIVEN current port is 9181 WHEN user changes to 9182 THEN server restarts on 9182
2. GIVEN user enters invalid port (0, 70000, "abc") THEN validation error shown
3. GIVEN user enters same port as current THEN no restart occurs
4. GIVEN port change succeeds THEN mcp.json updated with new URL

---

#### STORY 3: Custom Orchestration Config Path

> As a developer, I want to specify a custom orchestration config path so I can use different configs per workspace

**Requirement Details:**

1. Setting `kiroSdlc.configPath` (string, default: `.code-intel/orchestration.json`) specifies config file
2. Path is relative to workspace root
3. Command `kiroSdlc.editConfig` opens the config file in editor (creates if missing)
4. Command `kiroSdlc.changeConfig` shows file picker dialog for JSON files
5. After config path change, server restarts with new config

**Acceptance Criteria:**

1. GIVEN config file exists WHEN user runs "Edit Config" THEN file opens in editor
2. GIVEN config file does NOT exist WHEN user runs "Edit Config" THEN prompt to create, then open
3. GIVEN user selects new config via file picker THEN setting updates and server restarts
4. GIVEN config path is invalid THEN server spawn fails gracefully with error message

---

#### STORY 4: Port Conflict Auto-Detection

> As a developer, I want the extension to auto-detect port conflicts and connect to existing servers

**Requirement Details:**

1. Before spawning, extension checks if configured port is already listening (TCP connect test)
2. If port is in use -> assume external server, connect without spawning
3. External server mode: no PID management, no crash recovery
4. Log message: `Port {port} already in use - connecting to existing server.`

**Acceptance Criteria:**

1. GIVEN port 9181 is already in use by another process WHEN extension activates THEN connects to existing server
2. GIVEN external server stops WHEN extension detects disconnect THEN status changes to "stopped"
3. GIVEN external mode WHEN user runs "Stop Server" THEN only disconnects (does not kill external process)

---

#### STORY 5: Config File Auto-Restart

> As a developer, I want config file changes to auto-restart the server so I don't have to manually restart

**Requirement Details:**

1. ConfigWatcher monitors `.kiro/settings/mcp.json` using VS Code FileSystemWatcher
2. Debounce: 500ms (rapid edits don't trigger multiple restarts)
3. Only triggers restart when `code-intelligence` section actually changes (hash comparison)
4. Self-suppression: extension's own writes to mcp.json don't trigger restart (2000ms suppress window)
5. If `disabled: true` in config -> stop server instead of restart
6. If config file deleted -> stop server

**Acceptance Criteria:**

1. GIVEN server running WHEN user edits mcp.json (code-intelligence section) THEN server restarts after 500ms
2. GIVEN server running WHEN user edits mcp.json (other section) THEN no restart
3. GIVEN extension writes mcp.json THEN no self-triggered restart
4. GIVEN user sets `disabled: true` THEN server stops
5. GIVEN user deletes mcp.json THEN server stops

---

#### STORY 6: MCP Server Variant Selection

> As a developer, I want to choose between Python/Node.js/Kotlin MCP server variants

**Requirement Details:**

1. Three variants available: Python (uvx), Node.js (npx), Kotlin (JAR download)
2. Python: zero-install via `uvx mcp-code-intelligence@latest`
3. Node.js: zero-install via `npx mcp-code-intelligence@latest`
4. Kotlin: downloads JAR from GitHub Release, requires JDK 21+
5. Variant selection during "Inject All" or "Inject Selective" commands
6. Selected variant config written to `.kiro/settings/mcp.json`

**Acceptance Criteria:**

1. GIVEN user selects Python variant THEN mcp.json contains uvx command config
2. GIVEN user selects Kotlin variant THEN JAR is downloaded to `.code-intel/servers/`
3. GIVEN variant change THEN server restarts with new variant

---

#### STORY 7: Status Bar Indicator

> As a developer, I want a status bar indicator showing server status

**Requirement Details:**

1. Status bar item on the right side (priority 100)
2. Shows server status with icon: check (running), warning (stopped/crashed)
3. Tooltip shows: component status + MCP status + port info
4. Click opens status command
5. Updates on every status change event

**Acceptance Criteria:**

1. GIVEN server running THEN status bar shows "$(check) SDLC Agents"
2. GIVEN server stopped THEN status bar shows "$(warning) SDLC Agents"
3. GIVEN user clicks status bar THEN status command executes
4. GIVEN port is 9181 THEN tooltip includes "Port: 9181"

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| VS Code API 1.85+ | System | N/A | workspace.getConfiguration, FileSystemWatcher, StatusBarItem |
| Node.js child_process | System | N/A | Spawning MCP server process |
| mcp-code-intelligence | External | KSA-144 | The MCP server being managed |
| .kiro/settings/mcp.json | Infrastructure | N/A | Kiro IDE MCP server configuration file |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Developer | Extension Users | Primary users of settings |
| Extension Maintainer | dnguyenminh | Maintains extension code |
| MCP Server Team | Code Intelligence | Provides server binary/package |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Port conflict with other VS Code extensions | Medium | Medium | Auto-detection + configurable port |
| MCP server crash loop | High | Low | Max 3 restarts with exponential backoff |
| Config file corruption | Medium | Low | JSON parse error handling, graceful fallback |
| External server disappears | Low | Medium | Status polling, clear error messages |

### 5.2 Assumptions

- VS Code workspace has a single root folder (multi-root not supported)
- Node.js is available in PATH for spawning MCP server
- `.kiro/settings/mcp.json` follows Kiro IDE standard format
- Network localhost (127.0.0.1) is always available

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Server spawn < 5s | From activation to "running" status |
| Performance | Config change detection < 500ms | Debounce window for file watcher |
| Reliability | Auto-restart on crash | Max 3 restarts with backoff: 2s, 5s, 10s |
| Security | No secrets in settings | Port and paths only, no tokens/passwords |
| Usability | Zero-config default | Works out of box with default settings |
| Compatibility | VS Code 1.85+ | Minimum engine version |

---

## 7. Related Tickets

| Ticket Key | Summary | Type | Relationship |
|------------|---------|------|--------------|
| KSA-180 | Settings & Configuration | Story | Main ticket |
| KSA-170 | Code Intelligence UI Epic | Epic | Parent epic |
| KSA-144 | Code Intelligence v2 | Epic | MCP server source |
| KSA-179 | Symbol Search (Quick Pick) | Story | Depends on KSA-180 |
| KSA-175 | Entry Point Explorer | Story | Depends on KSA-180 |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| MCP | Model Context Protocol — communication protocol between IDE and AI tools |
| Orchestration Config | JSON file controlling MCP server behavior, child servers, model routing |
| ConfigWatcher | Component that monitors config file changes and triggers server restart |
| External Server | MCP server running independently (not spawned by extension) |

### Configuration Schema

```json
{
  "kiroSdlc.enableMcpServer": true,
  "kiroSdlc.mcpServerPort": 9181,
  "kiroSdlc.configPath": ".code-intel/orchestration.json"
}
```

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
