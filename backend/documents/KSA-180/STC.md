# Software Test Cases (STC)

## Kiro SDLC Agents — KSA-180: Settings & Configuration

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-180 |
| Title | Settings & Configuration — Test Cases |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-25 |
| Status | Draft |
| Related STP | STP-v1-KSA-180.docx |
| Related STC | STC-v1-KSA-180.docx |

---

## 1. Property-Based Tests (PBT)

### TC-PBT-01: Port Validation — Valid Range

| Field | Value |
|-------|-------|
| ID | TC-PBT-01 |
| Level | PBT |
| Priority | High |
| Automation | Automated (fast-check) |
| Traces To | STORY 2, BR-02 |

**Property:** For any integer n where 1 <= n <= 65535, port validation returns null (no error).

```typescript
fc.assert(
  fc.property(fc.integer({ min: 1, max: 65535 }), (port) => {
    const result = validatePort(String(port));
    return result === null; // null means valid
  })
);
```

---

### TC-PBT-02: Port Validation — Invalid Range

| Field | Value |
|-------|-------|
| ID | TC-PBT-02 |
| Level | PBT |
| Priority | High |
| Automation | Automated (fast-check) |
| Traces To | STORY 2, BR-02 |

**Property:** For any integer n where n < 1 OR n > 65535, port validation returns error string.

```typescript
fc.assert(
  fc.property(
    fc.oneof(
      fc.integer({ max: 0 }),
      fc.integer({ min: 65536 })
    ),
    (port) => {
      const result = validatePort(String(port));
      return result === "Port must be 1-65535";
    }
  )
);
```

---

### TC-PBT-03: Config Hash Stability

| Field | Value |
|-------|-------|
| ID | TC-PBT-03 |
| Level | PBT |
| Priority | Medium |
| Automation | Automated (fast-check) |
| Traces To | STORY 5, BR-10 |

**Property:** For any valid CodeIntelConfig object, computing hash twice yields same result.

```typescript
fc.assert(
  fc.property(fc.record({
    url: fc.option(fc.webUrl()),
    port: fc.option(fc.integer({ min: 1, max: 65535 })),
    disabled: fc.option(fc.boolean())
  }), (config) => {
    const hash1 = JSON.stringify(config);
    const hash2 = JSON.stringify(config);
    return hash1 === hash2;
  })
);
```

---

## 2. Unit Tests (UT)

### 2.1 McpServerManager Tests

#### TC-UT-01: Spawn When Enabled

| Field | Value |
|-------|-------|
| ID | TC-UT-01 |
| Level | UT |
| Priority | Critical |
| Automation | Automated |
| Traces To | STORY 1, UC-01 |

**Preconditions:** McpServerManager instantiated, enableMcpServer=true

**Steps:**
1. Stub `vscode.workspace.getConfiguration` to return `{ enableMcpServer: true }`
2. Stub `spawn` to return mock child process
3. Call `activate(context)`

**Expected:** `mcpManager.spawn()` is called

---

#### TC-UT-04: Status After Kill

| Field | Value |
|-------|-------|
| ID | TC-UT-04 |
| Level | UT |
| Priority | Critical |
| Automation | Automated |
| Traces To | STORY 1, UC-02 |

**Preconditions:** Server is running (status="running")

**Steps:**
1. Call `mcpManager.kill()`
2. Check `mcpManager.status`

**Expected:** status = "stopped", port = null, pid = null

---

#### TC-UT-13: Port Conflict Detection — In Use

| Field | Value |
|-------|-------|
| ID | TC-UT-13 |
| Level | UT |
| Priority | Critical |
| Automation | Automated |
| Traces To | STORY 4, UC-02 alt |

**Preconditions:** Port 9181 is already listening (mock TCP server)

**Steps:**
1. Create a TCP server listening on port 9181
2. Call `mcpManager.spawn()`
3. Check `mcpManager.status` and internal state

**Expected:**
- status = "running"
- externalServer = true
- No child process spawned
- mcp.json updated with URL

**Cleanup:** Close TCP server

---

#### TC-UT-16: Crash Recovery — First Crash

| Field | Value |
|-------|-------|
| ID | TC-UT-16 |
| Level | UT |
| Priority | Critical |
| Automation | Automated |
| Traces To | STORY 5, UC-07 |

**Preconditions:** Server running, restartCount=0

**Steps:**
1. Use fake timers (sinon.useFakeTimers)
2. Emit "exit" event on child process (code=1)
3. Verify status = "crashed"
4. Advance timer by 2000ms
5. Verify spawn() called again

**Expected:**
- After exit: status="crashed", restartCount=1
- After 2000ms: spawn() called, status="starting"

---

#### TC-UT-19: Crash Recovery — Max Reached

| Field | Value |
|-------|-------|
| ID | TC-UT-19 |
| Level | UT |
| Priority | Critical |
| Automation | Automated |
| Traces To | STORY 5, UC-07 alt |

**Preconditions:** restartCount = 3 (MAX_RESTARTS)

**Steps:**
1. Set restartCount = 3
2. Emit "exit" event on child process
3. Advance timer by 30000ms

**Expected:**
- status = "crashed"
- spawn() NOT called again
- Log: "Max restarts reached. Server will not auto-restart."

---

#### TC-UT-21: Port Detection Regex

| Field | Value |
|-------|-------|
| ID | TC-UT-21 |
| Level | UT |
| Priority | Critical |
| Automation | Automated |
| Traces To | STORY 1, UC-02 |

**Preconditions:** Mock child process with stderr stream

**Steps:**
1. Call spawn() (which calls waitForPort internally)
2. Emit on stderr: `[mcp-http] Listening on port 9181\n`

**Expected:** Detected port = 9181, status = "running"

---

### 2.2 ConfigWatcher Tests

#### TC-UT-30: Debounce — Single Change

| Field | Value |
|-------|-------|
| ID | TC-UT-30 |
| Level | UT |
| Priority | Critical |
| Automation | Automated |
| Traces To | STORY 5, UC-06, BR-05 |

**Preconditions:** ConfigWatcher active, fake timers

**Steps:**
1. Trigger onDidChange event
2. Verify no immediate action
3. Advance timer by 499ms — still no action
4. Advance timer by 1ms (total 500ms)

**Expected:** handleConfigChange() called exactly once after 500ms

---

#### TC-UT-31: Debounce — Rapid Changes

| Field | Value |
|-------|-------|
| ID | TC-UT-31 |
| Level | UT |
| Priority | Critical |
| Automation | Automated |
| Traces To | STORY 5, UC-06, BR-05 |

**Preconditions:** ConfigWatcher active, fake timers

**Steps:**
1. Trigger onDidChange 5 times in 100ms intervals
2. Advance timer by 600ms from last change

**Expected:** handleConfigChange() called exactly ONCE (not 5 times)

---

#### TC-UT-34: Self-Suppression

| Field | Value |
|-------|-------|
| ID | TC-UT-34 |
| Level | UT |
| Priority | Critical |
| Automation | Automated |
| Traces To | STORY 5, UC-06, BR-06 |

**Preconditions:** ConfigWatcher active

**Steps:**
1. Call `configWatcher.suppressNextChange()`
2. Trigger onDidChange event within 2000ms
3. Advance timer by 500ms (debounce)

**Expected:** handleConfigChange() NOT called (suppressed)

---

#### TC-UT-37: Other Server Changed

| Field | Value |
|-------|-------|
| ID | TC-UT-37 |
| Level | UT |
| Priority | High |
| Automation | Automated |
| Traces To | STORY 5, BR-10 |

**Preconditions:** mcp.json has code-intelligence + other-server sections

**Steps:**
1. Modify only `other-server` section in mcp.json
2. Trigger onDidChange
3. Advance timer by 500ms

**Expected:** No restart (hash of code-intelligence unchanged)

---

## 3. Integration Tests (IT)

#### TC-IT-01: Activation Spawns Server

| Field | Value |
|-------|-------|
| ID | TC-IT-01 |
| Level | IT |
| Priority | Critical |
| Automation | Automated |
| Traces To | STORY 1, UC-01 |

**Preconditions:** VS Code Extension Development Host, workspace open

**Steps:**
1. Activate extension
2. Wait for status change event
3. Check mcpManager.status

**Expected:** status = "running", port is set, mcp.json exists

---

#### TC-IT-06: Self-Write No Restart Loop

| Field | Value |
|-------|-------|
| ID | TC-IT-06 |
| Level | IT |
| Priority | Critical |
| Automation | Automated |
| Traces To | STORY 5, BR-06 |

**Preconditions:** Server running, ConfigWatcher active

**Steps:**
1. Call mcpManager.spawn() (which writes mcp.json)
2. Wait 3000ms
3. Count restart calls

**Expected:** No restart triggered (self-suppression works)

---

## 4. E2E API Tests

#### TC-E2E-API-02: Tool Invocation

| Field | Value |
|-------|-------|
| ID | TC-E2E-API-02 |
| Level | E2E-API |
| Priority | Critical |
| Automation | Automated |
| Traces To | STORY 1 (server must be running) |

**Preconditions:** MCP server running on port 9181

**Steps:**
1. POST to `http://127.0.0.1:9181/mcp`
2. Body: `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"code_index_status","arguments":{}}}`
3. Assert response status 200
4. Assert response has `result.content[0].text`

**Expected:** Valid JSON-RPC response with tool result

---

## 5. E2E UI Tests (Gherkin)

#### TC-E2E-UI-01: Toggle Enable Setting

```gherkin
Feature: MCP Server Enable/Disable
  As a developer
  I want to toggle the MCP server via settings
  So that I can control resource usage

  Scenario: Disable running server
    Given the extension is activated
    And the MCP server is running
    When I set "kiroSdlc.enableMcpServer" to false
    Then the MCP server should stop
    And the status bar should show warning icon

  Scenario: Enable stopped server
    Given the extension is activated
    And "kiroSdlc.enableMcpServer" is false
    And the MCP server is stopped
    When I set "kiroSdlc.enableMcpServer" to true
    Then the MCP server should start
    And the status bar should show check icon
```

---

#### TC-E2E-UI-02: Change Port Command

```gherkin
Feature: Change MCP Server Port
  As a developer
  I want to change the server port via command
  So that I can avoid port conflicts

  Scenario: Valid port change
    Given the MCP server is running on port 9181
    When I run command "Kiro SDLC: Change MCP Server Port"
    And I enter "9999" in the input box
    Then the server should restart on port 9999
    And I should see message "Port changed to 9999. Restarting server..."

  Scenario: Invalid port rejected
    Given the MCP server is running
    When I run command "Kiro SDLC: Change MCP Server Port"
    And I enter "0" in the input box
    Then I should see validation error "Port must be 1-65535"
    And the server port should remain unchanged

  Scenario: Same port no-op
    Given the MCP server is running on port 9181
    When I run command "Kiro SDLC: Change MCP Server Port"
    And I enter "9181" in the input box
    Then no restart should occur
```

---

#### TC-E2E-UI-03: Edit Config Command

```gherkin
Feature: Edit Orchestration Config
  As a developer
  I want to edit the config file via command
  So that I can customize MCP server behavior

  Scenario: Config file exists
    Given ".code-intel/orchestration.json" exists in workspace
    When I run command "Kiro SDLC: Edit Orchestration Config"
    Then the file should open in the editor

  Scenario: Config file missing - create
    Given ".code-intel/orchestration.json" does NOT exist
    When I run command "Kiro SDLC: Edit Orchestration Config"
    Then I should see warning "Config file not found. Create it?"
    When I click "Create"
    Then the file should be created with default content
    And the file should open in the editor
```

---

## 6. System Integration Tests (SIT) — Manual

#### TC-SIT-01: Fresh Install Activation

| Field | Value |
|-------|-------|
| ID | TC-SIT-01 |
| Level | SIT |
| Priority | Critical |
| Automation | Manual |
| Traces To | All stories |

**Steps:**
1. Install extension from VSIX
2. Open a workspace folder
3. Observe status bar
4. Open Output panel > "Kiro MCP Server"
5. Verify server started message

**Expected:**
- Status bar shows "$(check) SDLC Agents" within 5 seconds
- Output shows "[MCP] Server running on port 9181 (PID: ...)"
- `.kiro/settings/mcp.json` created with httpStream URL

---

#### TC-SIT-02: Port Conflict with External Service

| Field | Value |
|-------|-------|
| ID | TC-SIT-02 |
| Level | SIT |
| Priority | High |
| Automation | Manual |

**Steps:**
1. Start a service on port 9181 (e.g., `npx http-server -p 9181`)
2. Open VS Code with extension
3. Observe output channel

**Expected:**
- Output shows "Port 9181 already in use — connecting to existing server."
- Status bar shows running
- "Stop Server" command only disconnects (external service still running)

---

#### TC-SIT-03: Server Crash and Recovery

| Field | Value |
|-------|-------|
| ID | TC-SIT-03 |
| Level | SIT |
| Priority | High |
| Automation | Manual |

**Steps:**
1. Extension active, server running
2. Find server PID from `.code-intel/server.pid`
3. Kill process: `taskkill /PID {pid} /F`
4. Observe output channel and status bar

**Expected:**
- Status bar briefly shows warning
- Output shows "Crash recovery 1/3 — retrying in 2000ms"
- Server restarts within 3 seconds
- Status bar returns to check icon

---

## 7. Test Data Files

### testdata/valid-ports.csv

```csv
port,description
1,minimum
80,http
443,https
3000,dev
8080,alt-http
9181,default
9999,high
65535,maximum
```

### testdata/invalid-ports.csv

```csv
input,expected_error
0,Port must be 1-65535
-1,Port must be 1-65535
65536,Port must be 1-65535
70000,Port must be 1-65535
abc,Port must be 1-65535
3.14,Port must be 1-65535
```

### testdata/config-variants.csv

```csv
scenario,file_content,expected_action
valid_running,{"mcpServers":{"code-intelligence":{"url":"http://127.0.0.1:9181/mcp"}}},restart
disabled,{"mcpServers":{"code-intelligence":{"disabled":true}}},stop
empty_object,{},no_action
no_code_intel,{"mcpServers":{"other":{}}},no_action
invalid_json,{broken,no_action
```
