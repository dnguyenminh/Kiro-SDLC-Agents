# Software Test Cases (STC)

## Kiro SDLC Agents — KSA-249: Developer Experience: Steering Optimization + Context Usage Graph + Full Hook System

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-249 |
| Title | Test Cases — Context Usage Graph + Full Hook System |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-01-27 |
| Status | Draft |
| Related STP | STP-v1-KSA-249.docx |

---

## 1. Context Usage Graph Test Cases

### TC-CUG-001: Token Estimation Accuracy

| Field | Value |
|-------|-------|
| ID | TC-CUG-001 |
| Priority | High |
| Level | UT |
| Requirement | UC-CUG-01, BR-CUG-03 |

**Steps:**
1. Call estimateTokens("Hello world") (11 chars)
2. Call estimateTokens("") (0 chars)
3. Call estimateTokens(string of 1000 chars)

**Expected:**
1. Returns 3 (ceil(11/4))
2. Returns 0
3. Returns 250 (ceil(1000/4))

---

### TC-CUG-002: Context Usage Payload Calculation

| Field | Value |
|-------|-------|
| ID | TC-CUG-002 |
| Priority | High |
| Level | UT |
| Requirement | UC-CUG-01, BR-CUG-01, BR-CUG-02 |

**Steps:**
1. Set conversation=45000, mcp=12000, steering=3000, maxTokens=128000
2. Call getUsagePayload(tabId)

**Expected:**
- conversation.tokens = 45000, percentage = 35.2
- mcpTools.tokens = 12000, percentage = 9.4
- steering.tokens = 3000, percentage = 2.3
- total.tokens = 60000, percentage = 46.9
- total.threshold = "safe"

---

### TC-CUG-003: Empty Tab Usage

| Field | Value |
|-------|-------|
| ID | TC-CUG-003 |
| Priority | Medium |
| Level | UT |
| Requirement | UC-CUG-01, AF-01 |

**Steps:**
1. Create new tab with no messages, no tools, steering=2000 tokens
2. Call getUsagePayload(tabId)

**Expected:**
- conversation.tokens = 0, percentage = 0
- mcpTools.tokens = 0, percentage = 0
- steering.tokens = 2000, percentage = 1.6
- total.tokens = 2000, percentage = 1.6, threshold = "safe"

---

### TC-CUG-004: Tab Switch Updates Usage

| Field | Value |
|-------|-------|
| ID | TC-CUG-004 |
| Priority | High |
| Level | IT |
| Requirement | UC-CUG-01, AF-02 |

**Steps:**
1. Tab A: 50000 total tokens
2. Tab B: 10000 total tokens
3. Switch from Tab A to Tab B

**Expected:**
- Usage payload shows Tab B data (10000 tokens)
- Panel updates with Tab B percentages

---

### TC-CUG-005: Large Token Count Formatting

| Field | Value |
|-------|-------|
| ID | TC-CUG-005 |
| Priority | Low |
| Level | UT |
| Requirement | BR-CUG-04 |

**Steps:**
1. Format token count 45231

**Expected:** Display shows "45,231"

---

### TC-CUG-006: Safe Threshold (0-59%)

| Field | Value |
|-------|-------|
| ID | TC-CUG-006 |
| Priority | High |
| Level | UT |
| Requirement | BR-CUG-05 |

**Steps:**
1. Set total percentage to 47%

**Expected:** threshold = "safe"

---

### TC-CUG-007: Warning Threshold (60-79%)

| Field | Value |
|-------|-------|
| ID | TC-CUG-007 |
| Priority | High |
| Level | UT |
| Requirement | BR-CUG-06 |

**Steps:**
1. Set total to 60% exactly
2. Set total to 79%

**Expected:** Both return threshold = "warning"

---

### TC-CUG-008: Critical Threshold (80-94%)

| Field | Value |
|-------|-------|
| ID | TC-CUG-008 |
| Priority | High |
| Level | UT |
| Requirement | BR-CUG-07 |

**Steps:**
1. Set total to 80% exactly
2. Set total to 94%

**Expected:** Both return threshold = "critical"

---

### TC-CUG-009: Full Threshold (95-100%)

| Field | Value |
|-------|-------|
| ID | TC-CUG-009 |
| Priority | High |
| Level | UT |
| Requirement | BR-CUG-08 |

**Steps:**
1. Set total to 95% exactly
2. Set total to 100%

**Expected:** Both return threshold = "full"

---

### TC-CUG-010: Panel Default Collapsed

| Field | Value |
|-------|-------|
| ID | TC-CUG-010 |
| Priority | Medium |
| Level | E2E-UI |
| Requirement | BR-CUG-10 |

**Steps:**
1. Open chat panel fresh

**Expected:** Context usage panel shows collapsed state ("Context: 0% used")

---

### TC-CUG-011: Panel Toggle Expand/Collapse

| Field | Value |
|-------|-------|
| ID | TC-CUG-011 |
| Priority | Medium |
| Level | E2E-UI |
| Requirement | UC-CUG-03 |

**Steps:**
1. Click panel header (collapsed)
2. Verify expanded shows all bars
3. Click header again

**Expected:** Toggles between collapsed/expanded states

---

### TC-CUG-012: Auto-Expand at 80%

| Field | Value |
|-------|-------|
| ID | TC-CUG-012 |
| Priority | Medium |
| Level | IT |
| Requirement | BR-CUG-11, AF-01 |

**Steps:**
1. Panel is collapsed
2. Usage crosses 80% threshold

**Expected:** Panel auto-expands. autoExpandTriggered = true.

---

### TC-CUG-013: No Re-Expand After Manual Collapse

| Field | Value |
|-------|-------|
| ID | TC-CUG-013 |
| Priority | Medium |
| Level | IT |
| Requirement | BR-CUG-11, AF-02 |

**Steps:**
1. Panel auto-expanded at 80%
2. User manually collapses
3. Usage increases to 90%

**Expected:** Panel stays collapsed (auto-expand already triggered)

---

### TC-CUG-014: Update After Message Exchange

| Field | Value |
|-------|-------|
| ID | TC-CUG-014 |
| Priority | High |
| Level | IT |
| Requirement | UC-CUG-04 |

**Steps:**
1. Send message, receive response
2. Check if chat:contextUsage message sent to webview

**Expected:** Message sent within 500ms of response completion with updated values

---

### TC-CUG-015: Update After Tool Call

| Field | Value |
|-------|-------|
| ID | TC-CUG-015 |
| Priority | Medium |
| Level | IT |
| Requirement | UC-CUG-04 |

**Steps:**
1. MCP tool call completes with result
2. Check mcpToolsTokens updated

**Expected:** mcpToolsTokens increases by estimated tokens of tool result

---

### TC-CUG-016: Update After Steering Load

| Field | Value |
|-------|-------|
| ID | TC-CUG-016 |
| Priority | Medium |
| Level | IT |
| Requirement | UC-CUG-04 |

**Steps:**
1. Load steering file (2000 chars)
2. Check steeringTokens updated

**Expected:** steeringTokens = ~500 (2000/4)

---

## 2. Hook System Test Cases

### TC-HOOK-001: userTriggered Command Registration

| Field | Value |
|-------|-------|
| ID | TC-HOOK-001 |
| Priority | High |
| Level | IT |
| Requirement | UC-HOOK-01, BR-HOOK-01 |

**Steps:**
1. Create hook: { name: "My Hook", when: { type: "userTriggered" }, then: { type: "askAgent", prompt: "test" } }
2. Load hooks
3. Check VS Code commands

**Expected:** Command "kiro-sdlc.hook.my-hook" registered

---

### TC-HOOK-002: userTriggered Disabled Hook Not Registered

| Field | Value |
|-------|-------|
| ID | TC-HOOK-002 |
| Priority | Medium |
| Level | UT |
| Requirement | UC-HOOK-01, AF-03 |

**Steps:**
1. Create hook with enabled: false
2. Load hooks

**Expected:** No command registered for disabled hook

---

### TC-HOOK-003: userTriggered askAgent Execution

| Field | Value |
|-------|-------|
| ID | TC-HOOK-003 |
| Priority | High |
| Level | IT |
| Requirement | UC-HOOK-01 |

**Steps:**
1. Register userTriggered hook with askAgent action
2. Execute the command

**Expected:** askAgent prompt injected into agent context

---

### TC-HOOK-004: userTriggered runCommand Execution

| Field | Value |
|-------|-------|
| ID | TC-HOOK-004 |
| Priority | High |
| Level | IT |
| Requirement | UC-HOOK-01 |

**Steps:**
1. Register userTriggered hook with runCommand: "echo hello"
2. Execute command

**Expected:** Shell command executes, stdout captured

---

### TC-HOOK-005: Hook Refresh on File Change

| Field | Value |
|-------|-------|
| ID | TC-HOOK-005 |
| Priority | Medium |
| Level | IT |
| Requirement | BR-HOOK-03 |

**Steps:**
1. Load hooks (N hooks registered)
2. Add new hook file to .kiro/hooks/
3. Wait for FileSystemWatcher

**Expected:** Commands re-registered with N+1 hooks

---

### TC-HOOK-006: postToolUse Category Match - write

| Field | Value |
|-------|-------|
| ID | TC-HOOK-006 |
| Priority | High |
| Level | UT |
| Requirement | UC-HOOK-02, BR-HOOK-04 |

**Steps:**
1. Hook with toolTypes: ["write"]
2. Fire postToolUse for tool "fs_write"

**Expected:** Hook fires

---

### TC-HOOK-007: postToolUse Category Match - wildcard

| Field | Value |
|-------|-------|
| ID | TC-HOOK-007 |
| Priority | Medium |
| Level | UT |
| Requirement | UC-HOOK-02 |

**Steps:**
1. Hook with toolTypes: ["*"]
2. Fire postToolUse for any tool

**Expected:** Hook fires for all tools

---

### TC-HOOK-008: postToolUse Category No Match

| Field | Value |
|-------|-------|
| ID | TC-HOOK-008 |
| Priority | High |
| Level | UT |
| Requirement | UC-HOOK-02 |

**Steps:**
1. Hook with toolTypes: ["write"]
2. Fire postToolUse for tool "readFile" (category: read)

**Expected:** Hook does NOT fire

---

### TC-HOOK-009: postToolUse Regex Match

| Field | Value |
|-------|-------|
| ID | TC-HOOK-009 |
| Priority | Medium |
| Level | UT |
| Requirement | BR-HOOK-06 |

**Steps:**
1. Hook with toolTypes: ["/mem_.*/"]
2. Fire postToolUse for tool "mem_search"

**Expected:** Hook fires (regex matches)

---

### TC-HOOK-010: postToolUse Multiple Hooks Fire in Order

| Field | Value |
|-------|-------|
| ID | TC-HOOK-010 |
| Priority | Medium |
| Level | IT |
| Requirement | BR-HOOK-04 |

**Steps:**
1. Hook A (loaded first) matches
2. Hook B (loaded second) matches
3. Fire postToolUse

**Expected:** Hook A fires first, then Hook B

---

### TC-HOOK-011: postToolUse Non-Blocking

| Field | Value |
|-------|-------|
| ID | TC-HOOK-011 |
| Priority | Medium |
| Level | IT |
| Requirement | BR-HOOK-07 |

**Steps:**
1. Hook with slow askAgent (simulated 2s delay)
2. Fire postToolUse
3. Check pipeline continues

**Expected:** Next operation starts without waiting for hook completion

---

### TC-HOOK-012: postToolUse Placeholder Substitution

| Field | Value |
|-------|-------|
| ID | TC-HOOK-012 |
| Priority | High |
| Level | UT |
| Requirement | BR-HOOK-05 |

**Steps:**
1. Hook prompt contains dollar{toolName} and dollar{toolResult}
2. Fire for tool "fs_write" with result "File written"

**Expected:** Prompt becomes "...fs_write...File written..."

---

### TC-HOOK-013: preTaskExecution Fires Before Node

| Field | Value |
|-------|-------|
| ID | TC-HOOK-013 |
| Priority | High |
| Level | IT |
| Requirement | UC-HOOK-03 |

**Steps:**
1. Register preTaskExecution hook
2. Execute pipeline node

**Expected:** Hook fires BEFORE node execution starts

---

### TC-HOOK-014: preTaskExecution askAgent Injection

| Field | Value |
|-------|-------|
| ID | TC-HOOK-014 |
| Priority | High |
| Level | IT |
| Requirement | UC-HOOK-03, BR-HOOK-08 |

**Steps:**
1. Hook with prompt containing dollar{nodeName}
2. Execute node "ba-agent"

**Expected:** Prompt injected with nodeName = "ba-agent"

---

### TC-HOOK-015: preTaskExecution Hook Failure Non-Blocking

| Field | Value |
|-------|-------|
| ID | TC-HOOK-015 |
| Priority | High |
| Level | IT |
| Requirement | BR-HOOK-09 |

**Steps:**
1. Hook action throws error
2. Execute pipeline node

**Expected:** Node still executes despite hook failure

---

### TC-HOOK-016: preTaskExecution Sequential

| Field | Value |
|-------|-------|
| ID | TC-HOOK-016 |
| Priority | Medium |
| Level | IT |
| Requirement | BR-HOOK-10 |

**Steps:**
1. Hook A and Hook B both match preTaskExecution
2. Execute node

**Expected:** A completes before B starts (sequential)

---

### TC-HOOK-017: postTaskExecution Fires After Node

| Field | Value |
|-------|-------|
| ID | TC-HOOK-017 |
| Priority | High |
| Level | IT |
| Requirement | UC-HOOK-04 |

**Steps:**
1. Register postTaskExecution hook
2. Execute pipeline node

**Expected:** Hook fires AFTER node completes, BEFORE next node

---

### TC-HOOK-018: postTaskExecution Has Output

| Field | Value |
|-------|-------|
| ID | TC-HOOK-018 |
| Priority | Medium |
| Level | IT |
| Requirement | BR-HOOK-11 |

**Steps:**
1. Hook prompt with dollar{taskOutput} and dollar{duration}
2. Node completes with output

**Expected:** Placeholders substituted with actual output and duration

---

### TC-HOOK-019: postTaskExecution Failure Non-Blocking

| Field | Value |
|-------|-------|
| ID | TC-HOOK-019 |
| Priority | High |
| Level | IT |
| Requirement | BR-HOOK-12 |

**Steps:**
1. postTaskExecution hook throws error
2. Pipeline has next node

**Expected:** Next node executes normally

---

### TC-HOOK-020: preToolUse FORBIDDEN Denial

| Field | Value |
|-------|-------|
| ID | TC-HOOK-020 |
| Priority | Critical |
| Level | UT |
| Requirement | UC-HOOK-05, BR-HOOK-14 |

**Steps:**
1. preToolUse hook returns "FORBIDDEN: write to protected file"
2. Agent attempts fs_write

**Expected:** Tool NOT executed. Error returned to agent.

---

### TC-HOOK-021: preToolUse Denial - No Retry

| Field | Value |
|-------|-------|
| ID | TC-HOOK-021 |
| Priority | Critical |
| Level | IT |
| Requirement | BR-HOOK-14 |

**Steps:**
1. preToolUse returns FORBIDDEN
2. Check agent behavior

**Expected:** Agent receives non-retryable error, does not re-attempt same call

---

### TC-HOOK-022: preToolUse Denial Error Message Format

| Field | Value |
|-------|-------|
| ID | TC-HOOK-022 |
| Priority | High |
| Level | UT |
| Requirement | BR-HOOK-17 |

**Steps:**
1. Hook "Protect Config" denies with reason "Config file protected"

**Expected:** Error: "[HOOK DENIED] Protect Config: Config file protected"

---

### TC-HOOK-023: preToolUse First Denial Wins

| Field | Value |
|-------|-------|
| ID | TC-HOOK-023 |
| Priority | Medium |
| Level | UT |
| Requirement | BR-HOOK-16 |

**Steps:**
1. Hook A denies
2. Hook B would also match

**Expected:** Hook B is NOT evaluated. A's denial is returned.

---

### TC-HOOK-024: preToolUse Denial Audit Log

| Field | Value |
|-------|-------|
| ID | TC-HOOK-024 |
| Priority | Medium |
| Level | UT |
| Requirement | BR-HOOK-15 |

**Steps:**
1. Denial occurs

**Expected:** Log entry with timestamp, hookName, toolName, args

---

### TC-HOOK-025: preToolUse Parameter Modification

| Field | Value |
|-------|-------|
| ID | TC-HOOK-025 |
| Priority | High |
| Level | UT |
| Requirement | UC-HOOK-06, BR-HOOK-18 |

**Steps:**
1. Hook returns { action: "modify", params: { path: "/safe/path" } }
2. Original args: { path: "/dangerous/path" }

**Expected:** Tool called with { path: "/safe/path" } (exact replacement)

---

### TC-HOOK-026: preToolUse Partial Merge

| Field | Value |
|-------|-------|
| ID | TC-HOOK-026 |
| Priority | High |
| Level | UT |
| Requirement | BR-HOOK-20 |

**Steps:**
1. Original: { path: "/a", content: "hello" }
2. Hook modifies: { path: "/b" }

**Expected:** Final: { path: "/b", content: "hello" } (content unchanged)

---

### TC-HOOK-027: preToolUse Single Pass

| Field | Value |
|-------|-------|
| ID | TC-HOOK-027 |
| Priority | Medium |
| Level | UT |
| Requirement | BR-HOOK-19 |

**Steps:**
1. Hook A modifies params
2. Hook B also wants to modify

**Expected:** Only first modification applied (single pass)

---

### TC-HOOK-028: preToolUse No Modification (Pass Through)

| Field | Value |
|-------|-------|
| ID | TC-HOOK-028 |
| Priority | Medium |
| Level | UT |
| Requirement | BR-HOOK-18 |

**Steps:**
1. Hook returns response without "modify" signal

**Expected:** Original params pass through unchanged

---

### TC-HOOK-029: preToolUse Denial Beats Modification

| Field | Value |
|-------|-------|
| ID | TC-HOOK-029 |
| Priority | High |
| Level | UT |
| Requirement | BR-HOOK-21 |

**Steps:**
1. Hook A returns FORBIDDEN
2. Hook B would return modification

**Expected:** Denial wins. Tool NOT called. Modification ignored.

---

### TC-HOOK-030: Circular Detection - Self Reference

| Field | Value |
|-------|-------|
| ID | TC-HOOK-030 |
| Priority | Critical |
| Level | UT |
| Requirement | UC-HOOK-07, BR-HOOK-22 |

**Steps:**
1. Hook A (preToolUse) triggers askAgent
2. askAgent would trigger preToolUse again (same hook context)

**Expected:** Nested invocation of Hook A is skipped

---

### TC-HOOK-031: Circular Detection - Top Level Honored

| Field | Value |
|-------|-------|
| ID | TC-HOOK-031 |
| Priority | Critical |
| Level | UT |
| Requirement | BR-HOOK-23 |

**Steps:**
1. Hook A fires (first invocation)

**Expected:** Executes normally (top-level)

---

### TC-HOOK-032: Circular Detection - Max Depth

| Field | Value |
|-------|-------|
| ID | TC-HOOK-032 |
| Priority | High |
| Level | UT |
| Requirement | BR-HOOK-24 |

**Steps:**
1. Hook A triggers Hook B triggers Hook C triggers Hook D
2. maxDepth = 3

**Expected:** Hook D is skipped (depth 4 > max 3)

---

### TC-HOOK-033: Circular Detection - Stack Cleanup

| Field | Value |
|-------|-------|
| ID | TC-HOOK-033 |
| Priority | High |
| Level | UT |
| Requirement | BR-HOOK-25 |

**Steps:**
1. Hook A fires and completes
2. New event would trigger Hook A again

**Expected:** Hook A fires again (stack was cleaned after first completion)

---

### TC-HOOK-034: Circular Warning Log

| Field | Value |
|-------|-------|
| ID | TC-HOOK-034 |
| Priority | Medium |
| Level | UT |
| Requirement | BR-HOOK-22 |

**Steps:**
1. Circular detected

**Expected:** Warning logged: "Circular dependency: {hookName} skipped"

---

### TC-HOOK-035: runCommand Default Timeout

| Field | Value |
|-------|-------|
| ID | TC-HOOK-035 |
| Priority | High |
| Level | UT |
| Requirement | BR-HOOK-26 |

**Steps:**
1. Hook with no timeout field, command: "sleep 70" (>60s)

**Expected:** Process killed after 60s, status = "timed_out"

---

### TC-HOOK-036: runCommand Custom Timeout

| Field | Value |
|-------|-------|
| ID | TC-HOOK-036 |
| Priority | Medium |
| Level | UT |
| Requirement | BR-HOOK-27 |

**Steps:**
1. Hook with timeout: 5000, command: "sleep 10"

**Expected:** Process killed after 5s

---

### TC-HOOK-037: runCommand Graceful Kill

| Field | Value |
|-------|-------|
| ID | TC-HOOK-037 |
| Priority | Medium |
| Level | IT |
| Requirement | BR-HOOK-28 |

**Steps:**
1. Command runs, timeout reached
2. SIGTERM sent
3. Process exits within 5s

**Expected:** Process terminates gracefully

---

### TC-HOOK-038: runCommand Output Capture

| Field | Value |
|-------|-------|
| ID | TC-HOOK-038 |
| Priority | Medium |
| Level | UT |
| Requirement | BR-HOOK-29 |

**Steps:**
1. Command: "echo hello world"

**Expected:** stdout captured: "hello world"

---

### TC-HOOK-039: runCommand CWD

| Field | Value |
|-------|-------|
| ID | TC-HOOK-039 |
| Priority | Low |
| Level | UT |
| Requirement | BR-HOOK-30 |

**Steps:**
1. Execute runCommand in workspace

**Expected:** CWD = workspace root

---

### TC-HOOK-040: Schema - Missing Name

| Field | Value |
|-------|-------|
| ID | TC-HOOK-040 |
| Priority | High |
| Level | UT |
| Requirement | UC-HOOK-09 |

**Steps:**
1. Hook JSON without "name" field

**Expected:** Validation error: "missing 'name'". Hook skipped.

---

### TC-HOOK-041: Schema - Missing Version

| Field | Value |
|-------|-------|
| ID | TC-HOOK-041 |
| Priority | High |
| Level | UT |
| Requirement | UC-HOOK-09 |

**Steps:**
1. Hook JSON without "version" field

**Expected:** Validation error: "missing 'version'". Hook skipped.

---

### TC-HOOK-042: Schema - Invalid when.type

| Field | Value |
|-------|-------|
| ID | TC-HOOK-042 |
| Priority | High |
| Level | UT |
| Requirement | UC-HOOK-09 |

**Steps:**
1. Hook with when.type: "invalidEvent"

**Expected:** Error lists 10 valid types. Hook skipped.

---

### TC-HOOK-043: Schema - Invalid then.type

| Field | Value |
|-------|-------|
| ID | TC-HOOK-043 |
| Priority | High |
| Level | UT |
| Requirement | UC-HOOK-09 |

**Steps:**
1. Hook with then.type: "sendEmail"

**Expected:** Error: "Valid: askAgent, runCommand". Hook skipped.

---

### TC-HOOK-044: Schema - askAgent Missing Prompt

| Field | Value |
|-------|-------|
| ID | TC-HOOK-044 |
| Priority | High |
| Level | UT |
| Requirement | UC-HOOK-09 |

**Steps:**
1. Hook with then.type: "askAgent" but no prompt field

**Expected:** Error: "askAgent requires 'prompt'". Hook skipped.

---

### TC-HOOK-045: Schema - runCommand Missing Command

| Field | Value |
|-------|-------|
| ID | TC-HOOK-045 |
| Priority | High |
| Level | UT |
| Requirement | UC-HOOK-09 |

**Steps:**
1. Hook with then.type: "runCommand" but no command field

**Expected:** Error: "runCommand requires 'command'". Hook skipped.

---

### TC-HOOK-046: Schema - Malformed JSON

| Field | Value |
|-------|-------|
| ID | TC-HOOK-046 |
| Priority | High |
| Level | UT |
| Requirement | UC-HOOK-09 |

**Steps:**
1. Hook file with syntax error: "{ name: }"

**Expected:** Parse error with file location. Hook skipped.

---

### TC-HOOK-047: Schema - Valid Hooks Still Load

| Field | Value |
|-------|-------|
| ID | TC-HOOK-047 |
| Priority | Critical |
| Level | UT |
| Requirement | BR-HOOK-32 |

**Steps:**
1. Directory has 3 hooks: valid1, invalid, valid2
2. Load hooks

**Expected:** 2 hooks loaded. 1 skipped with error. No crash.

---

### TC-HOOK-048: Schema - Errors in Output Channel

| Field | Value |
|-------|-------|
| ID | TC-HOOK-048 |
| Priority | Medium |
| Level | IT |
| Requirement | BR-HOOK-33 |

**Steps:**
1. Load invalid hook

**Expected:** Error appears in "Kiro SDLC" output channel

---

## 3. Test Data

Test fixture hooks located in: test/fixtures/hooks/

| File | Purpose |
|------|---------|
| valid-user-triggered.json | Valid userTriggered hook |
| valid-post-tool.json | Valid postToolUse hook |
| valid-pre-task.json | Valid preTaskExecution hook |
| invalid-no-name.json | Missing name field |
| invalid-bad-type.json | Invalid when.type |
| invalid-json.json | Malformed JSON |
| denial-hook.json | preToolUse that returns FORBIDDEN |
| modify-hook.json | preToolUse that modifies params |
| timeout-hook.json | runCommand with short timeout |
| circular-a.json | Hook that could trigger itself |

---

## 4. Summary

| Level | Count | Automated | Manual |
|-------|-------|-----------|--------|
| UT | 34 | 34 | 0 |
| IT | 14 | 14 | 0 |
| E2E-UI | 3 | 0 | 3 |
| **Total** | **51** | **48** | **3** |

Coverage: 100% of BRD user stories covered by test cases.
