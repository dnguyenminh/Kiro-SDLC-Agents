# Software Test Plan (STP)

## Kiro SDLC Agents — KSA-180: Settings & Configuration

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-180 |
| Title | Settings & Configuration — Test Plan |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-25 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-180.docx |
| Related FSD | FSD-v1-KSA-180.docx |
| Related TDD | TDD-v1-KSA-180.docx |
| Related STP | STP-v1-KSA-180.docx |

---

## 1. Test Strategy

### 1.1 Scope

This test plan covers all 7 user stories from BRD KSA-180:
- STORY 1: Enable/Disable MCP Server
- STORY 2: Change MCP Server Port
- STORY 3: Custom Orchestration Config Path
- STORY 4: Port Conflict Auto-Detection
- STORY 5: Config File Auto-Restart
- STORY 6: MCP Server Variant Selection
- STORY 7: Status Bar Indicator

### 1.2 Test Levels

| Level | Abbreviation | Description | Automation |
|-------|-------------|-------------|------------|
| Property-Based Testing | PBT | Invariant verification for port validation, config parsing | 100% automated |
| Unit Testing | UT | Individual function/method testing with mocks | 100% automated |
| Integration Testing | IT | Module interaction (ConfigWatcher + McpServerManager) | 100% automated |
| E2E API Testing | E2E-API | MCP server HTTP endpoint testing | 100% automated |
| E2E UI Testing | E2E-UI | VS Code extension commands and UI interactions | 90% automated |
| System Integration Testing | SIT | Full extension activation with real server | Manual (visual verification) |

### 1.3 Test Environment

| Component | Specification |
|-----------|--------------|
| IDE | VS Code 1.85+ (Extension Development Host) |
| Runtime | Node.js 20+ |
| OS | Windows 11 / macOS / Linux |
| Test Framework | Mocha 10.x + Sinon 17.x |
| Assertion | Node.js assert (built-in) |
| Coverage | c8 or nyc |

### 1.4 Entry Criteria

- Source code compiles without errors (`npm run compile`)
- All existing tests pass (`npm test`)
- BRD, FSD, TDD reviewed and approved

### 1.5 Exit Criteria

- All Critical/High priority test cases pass
- Code coverage >= 80% for settings modules
- No Critical/High severity bugs open
- All acceptance criteria from BRD verified

---

## 2. Test Coverage Matrix

### 2.1 Requirements Traceability Matrix (RTM)

| Requirement | BRD Story | Test Cases | Level |
|-------------|-----------|------------|-------|
| Enable/Disable server | STORY 1 | TC-UT-01 to TC-UT-04, TC-IT-01, TC-E2E-UI-01 | UT, IT, E2E-UI |
| Change port | STORY 2 | TC-PBT-01, TC-UT-05 to TC-UT-08, TC-IT-02, TC-E2E-UI-02 | PBT, UT, IT, E2E-UI |
| Config path | STORY 3 | TC-UT-09 to TC-UT-12, TC-E2E-UI-03, TC-E2E-UI-04 | UT, E2E-UI |
| Port conflict | STORY 4 | TC-UT-13 to TC-UT-15, TC-IT-03 | UT, IT |
| Config auto-restart | STORY 5 | TC-UT-16 to TC-UT-22, TC-IT-04 to TC-IT-06 | UT, IT |
| Variant selection | STORY 6 | TC-UT-23 to TC-UT-25 | UT |
| Status bar | STORY 7 | TC-UT-26 to TC-UT-29, TC-E2E-UI-05 | UT, E2E-UI |

### 2.2 Coverage Summary

| Level | Total Cases | Automated | Manual |
|-------|-------------|-----------|--------|
| PBT | 3 | 3 | 0 |
| UT | 29 | 29 | 0 |
| IT | 6 | 6 | 0 |
| E2E-API | 4 | 4 | 0 |
| E2E-UI | 5 | 4 | 1 |
| SIT | 3 | 0 | 3 |
| **Total** | **50** | **46** | **4** |

---

## 3. Test Levels Detail

### 3.1 Property-Based Testing (PBT)

**Purpose:** Verify invariants hold for all valid inputs.

| ID | Property | Generator | Invariant |
|----|----------|-----------|-----------|
| TC-PBT-01 | Port validation | Random int 1-65535 | Always accepts valid ports |
| TC-PBT-02 | Port rejection | Random int outside 1-65535 + strings | Always rejects invalid |
| TC-PBT-03 | Config hash stability | Random JSON objects | Same input = same hash |

### 3.2 Unit Testing (UT)

**Module: McpServerManager**

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| TC-UT-01 | Spawn when enabled | enableMcpServer=true | spawn() called | Critical |
| TC-UT-02 | No spawn when disabled | enableMcpServer=false | spawn() NOT called | Critical |
| TC-UT-03 | Status after spawn | spawn() succeeds | status="running" | Critical |
| TC-UT-04 | Status after kill | kill() called | status="stopped" | Critical |
| TC-UT-05 | getConfiguredPort default | No setting | Returns 9181 | High |
| TC-UT-06 | getConfiguredPort custom | Setting=9999 | Returns 9999 | High |
| TC-UT-07 | Port validation accepts valid | port=8080 | No error | High |
| TC-UT-08 | Port validation rejects invalid | port=0, 70000, "abc" | Error message | High |
| TC-UT-09 | getConfigPath default | No setting | Returns ".code-intel/orchestration.json" | High |
| TC-UT-10 | getConfigPath custom | Setting="custom/config.json" | Returns resolved path | High |
| TC-UT-11 | editConfig creates file | File missing | Creates with default JSON | Medium |
| TC-UT-12 | editConfig opens existing | File exists | Opens in editor | Medium |
| TC-UT-13 | Port conflict detection - in use | Port listening | externalServer=true | Critical |
| TC-UT-14 | Port conflict detection - free | Port not listening | Spawns process | Critical |
| TC-UT-15 | External mode kill | externalServer=true, kill() | Only disconnects | High |
| TC-UT-16 | Crash recovery - first crash | Process exits | Restarts after 2000ms | Critical |
| TC-UT-17 | Crash recovery - second crash | Process exits again | Restarts after 5000ms | High |
| TC-UT-18 | Crash recovery - third crash | Process exits again | Restarts after 10000ms | High |
| TC-UT-19 | Crash recovery - max reached | 4th crash | No restart, stays crashed | Critical |
| TC-UT-20 | Manual restart resets count | restart() called | restartCount=0 | High |
| TC-UT-21 | Port detection regex | stderr: "[mcp-http] Listening on port 9181" | Returns 9181 | Critical |
| TC-UT-22 | Port detection timeout | No pattern within timeout | Uses fallback | High |
| TC-UT-23 | Python variant config | MCP_VARIANTS[0] | command="uvx" | Medium |
| TC-UT-24 | Node.js variant config | MCP_VARIANTS[1] | command="npx" | Medium |
| TC-UT-25 | Kotlin variant config | MCP_VARIANTS[2] | command="java" | Medium |
| TC-UT-26 | Status bar - running | status="running" | Shows "$(check) SDLC Agents" | High |
| TC-UT-27 | Status bar - stopped | status="stopped" | Shows "$(warning) SDLC Agents" | High |
| TC-UT-28 | Status bar - tooltip with port | port=9181 | Tooltip contains "Port: 9181" | Medium |
| TC-UT-29 | Status bar - no workspace | No folders | Shows "$(circle-slash) SDLC" | Medium |

**Module: ConfigWatcher**

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| TC-UT-30 | Debounce - single change | 1 file change | 1 restart after 500ms | Critical |
| TC-UT-31 | Debounce - rapid changes | 5 changes in 100ms | 1 restart after 500ms | Critical |
| TC-UT-32 | Hash unchanged | Same config written | No restart | High |
| TC-UT-33 | Hash changed | Different config | Restart triggered | High |
| TC-UT-34 | Self-suppression | suppressNextChange() + write | No restart | Critical |
| TC-UT-35 | Disabled flag | disabled: true | Server stops | High |
| TC-UT-36 | File deleted | mcp.json removed | Server stops | High |
| TC-UT-37 | Other server changed | Different server section | No restart | High |

### 3.3 Integration Testing (IT)

| ID | Test Case | Components | Expected | Priority |
|----|-----------|-----------|----------|----------|
| TC-IT-01 | Activation spawns server | extension + McpServerManager | Server running after activate | Critical |
| TC-IT-02 | Port change triggers restart | extension + McpServerManager | Server on new port | High |
| TC-IT-03 | External server detection | McpServerManager + net | Connects without spawn | High |
| TC-IT-04 | Config change restarts server | ConfigWatcher + McpServerManager | Server restarted | High |
| TC-IT-05 | Config delete stops server | ConfigWatcher + McpServerManager | Server stopped | High |
| TC-IT-06 | Self-write no restart | McpServerManager + ConfigWatcher | No restart loop | Critical |

### 3.4 E2E API Testing

| ID | Test Case | Method | Expected | Priority |
|----|-----------|--------|----------|----------|
| TC-E2E-API-01 | Health check | GET /mcp (invalid) | 405 or error | Medium |
| TC-E2E-API-02 | Tool invocation | POST /mcp (valid JSON-RPC) | 200 + result | Critical |
| TC-E2E-API-03 | Invalid tool | POST /mcp (unknown tool) | Error response | High |
| TC-E2E-API-04 | Timeout handling | POST /mcp (slow tool) | Timeout error | Medium |

### 3.5 E2E UI Testing

| ID | Test Case | Steps | Expected | Priority | Automation |
|----|-----------|-------|----------|----------|------------|
| TC-E2E-UI-01 | Toggle enable setting | Open settings, toggle kiroSdlc.enableMcpServer | Server starts/stops | Critical | Automated |
| TC-E2E-UI-02 | Change port command | Cmd palette > "Change Port" > enter 9999 | Server restarts on 9999 | High | Automated |
| TC-E2E-UI-03 | Edit config command | Cmd palette > "Edit Config" | Config file opens | Medium | Automated |
| TC-E2E-UI-04 | Change config command | Cmd palette > "Change Config" > select file | Setting updates | Medium | Automated |
| TC-E2E-UI-05 | Status bar visual | Observe status bar during server lifecycle | Correct icons/text | High | Manual |

### 3.6 System Integration Testing (SIT)

| ID | Test Case | Steps | Expected | Priority |
|----|-----------|-------|----------|----------|
| TC-SIT-01 | Fresh install activation | Install extension, open workspace | Server auto-starts, status bar green | Critical |
| TC-SIT-02 | Multi-extension port conflict | Run another service on 9181, activate | Connects to external | High |
| TC-SIT-03 | Server crash and recovery | Kill MCP process externally | Auto-restarts within 2s | High |

---

## 4. Test Data

### 4.1 Valid Port Numbers

```csv
port,description
1,minimum valid
80,common HTTP
443,common HTTPS
3000,dev server
8080,alternative HTTP
9181,default MCP
9999,high port
65535,maximum valid
```

### 4.2 Invalid Port Numbers

```csv
input,description,expected_error
0,below minimum,Port must be 1-65535
-1,negative,Port must be 1-65535
65536,above maximum,Port must be 1-65535
70000,way above,Port must be 1-65535
abc,non-numeric,Port must be 1-65535
3.14,decimal,Port must be 1-65535
,empty,Port must be 1-65535
```

### 4.3 Config File Variants

```csv
scenario,content,expected_action
valid_config,{"mcpServers":{"code-intelligence":{"url":"http://127.0.0.1:9181/mcp"}}},restart
disabled_config,{"mcpServers":{"code-intelligence":{"disabled":true}}},stop
empty_config,{},no_action
invalid_json,{invalid,no_action
missing_section,{"mcpServers":{"other-server":{}}},no_action
null_config,,stop
```

---

## 5. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Flaky tests due to timing (debounce) | High | Medium | Use fake timers (sinon.useFakeTimers) |
| Port conflicts in CI | Medium | Medium | Use random high ports in tests |
| VS Code API mocking complexity | Medium | High | Use sinon stubs, test in Extension Dev Host |
| Process spawn tests on Windows vs Linux | Medium | Low | Platform-specific test paths |

---

## 6. Test Schedule

| Phase | Duration | Activities |
|-------|----------|-----------|
| Test Design | 1 day | Write test cases, prepare test data |
| UT Implementation | 2 days | Implement all unit tests |
| IT Implementation | 1 day | Implement integration tests |
| E2E Implementation | 1 day | Implement E2E tests |
| Execution | 1 day | Run all tests, fix failures |
| Report | 0.5 day | Generate coverage report |

---

## 7. Tools and Infrastructure

| Tool | Purpose | Version |
|------|---------|---------|
| Mocha | Test runner | 10.x |
| Sinon | Mocking/stubbing | 17.x |
| fast-check | Property-based testing | 3.x |
| c8 | Code coverage | Latest |
| @vscode/test-electron | VS Code integration tests | Latest |

---

## Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage Overview | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |
