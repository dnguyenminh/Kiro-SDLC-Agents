# Software Test Cases (STC)

## Kiro SDLC Agents — KSA-247: Chat Panel: Restore collapsible tool call UI blocks with icons

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-247 |
| Title | Chat Panel: Restore collapsible tool call UI blocks with icons |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-06-09 |
| Status | Draft |
| Related STP | STP-v1-KSA-247.docx |
| Related FSD | FSD-v1-KSA-247.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-09 | QA Agent | Initial STC from FSD use cases UC-1 through UC-4 and BR-1 through BR-17 |

---

## Test Case Summary

| Category | ID Range | Count | Priority |
|----------|----------|-------|----------|
| Functional — Happy Path | TC-001 to TC-004 | 4 | High |
| Functional — Alternative Flows | TC-100 to TC-104 | 5 | High |
| Functional — Exception/Error Flows | TC-200 to TC-202 | 3 | High |
| Business Rule Validation | TC-300 to TC-316 | 17 | High |
| Boundary & Negative Testing | TC-400 to TC-405 | 6 | Medium |
| UI/UX Testing | TC-500 to TC-504 | 5 | Medium |
| Non-Functional (Performance, Security) | TC-600 to TC-604 | 5 | Medium |
| Integration Testing | TC-700 to TC-705 | 6 | High |
| Regression Testing | TC-800 to TC-802 | 3 | Medium |

**Total: 54 Test Cases**

---

## Test Level Classification

| Prefix | Level | Count | Automation |
|--------|-------|-------|------------|
| PBT-01 to PBT-04 | Property-Based Test | 4 | ✅ Automated (fast-check) |
| UT-01 to UT-12 | Unit Test | 12 | ✅ Automated (Jest) |
| IT-01 to IT-06 | Integration Test | 6 | ✅ Automated (VS Code Test API) |
| E2E-UI-01 to E2E-UI-10 | Browser E2E | 10 | ✅ Automated (Playwright) |
| SIT-01 to SIT-05 | Manual Exploratory | 5 | ❌ Manual |

---

## 1. Property-Based Tests (PBT)

### PBT-01: categorizeTool always returns valid category object

| Field | Value |
|-------|-------|
| **ID** | PBT-01 |
| **Priority** | High |
| **Type** | PBT — Invariant |
| **Requirement** | UC-1, BR-1, BR-2 |
| **Property** | For ANY string input, categorizeTool(input) returns {icon: string, label: string, cls: string} |

**Generator:** Random strings (alphanumeric, special chars, empty, unicode, 0–500 chars)
**Assertions:**
- Result is non-null object
- Result.icon is non-empty string
- Result.label is one of: "CMD", "FILE", "SEARCH", "MEM", "JIRA", "DOC", "TOOL"
- Result.cls starts with "cat-"

---

### PBT-02: escapeHtml prevents all XSS vectors

| Field | Value |
|-------|-------|
| **ID** | PBT-02 |
| **Priority** | High |
| **Type** | PBT — Security Invariant |
| **Requirement** | TDD 6.3 |
| **Property** | For ANY string, escapeHtml(input) contains no unescaped `<`, `>`, or `&` |

**Generator:** Random strings including `<script>`, `<img onerror=`, `&amp;`, HTML entities
**Assertions:**
- Output never contains raw `<` (only `&lt;`)
- Output never contains raw `>` (only `&gt;`)
- Output never contains raw `&` followed by non-entity (only `&amp;`)

---

### PBT-03: formatDuration returns human-readable string

| Field | Value |
|-------|-------|
| **ID** | PBT-03 |
| **Priority** | Medium |
| **Type** | PBT — Format Invariant |
| **Requirement** | TDD 3.2.3 |
| **Property** | For ANY non-negative integer, formatDuration(ms) matches pattern /^\d+(\.\d)?m?s$/ |

**Generator:** Random integers 0–999999
**Assertions:**
- ms < 1000 → ends with "ms"
- ms >= 1000 → ends with "s" and contains decimal point

---

### PBT-04: statusIcon returns valid Unicode for all known statuses

| Field | Value |
|-------|-------|
| **ID** | PBT-04 |
| **Priority** | Medium |
| **Type** | PBT — Completeness |
| **Requirement** | TDD 3.2.5, OI-3 |
| **Property** | For ANY of ["running", "completed", "failed", "interrupted"], statusIcon returns non-empty string |

**Generator:** One-of ["running", "completed", "failed", "interrupted", randomString]
**Assertions:**
- Known statuses → non-empty result
- Unknown statuses → empty string

---

## 2. Unit Tests (UT)

### UT-01: categorizeTool — prefix match "grep_search" → SEARCH

| Field | Value |
|-------|-------|
| **ID** | UT-01 |
| **Priority** | High |
| **Type** | Unit — Functional |
| **Requirement** | UC-1, BR-1, OI-4 |
| **Preconditions** | categorizeTool function available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call categorizeTool("grep_search") | Returns {icon: "?", label: "SEARCH", cls: "cat-search"} |
| 2 | Call categorizeTool("file_search") | Returns {icon: "?", label: "SEARCH", cls: "cat-search"} |
| 3 | Call categorizeTool("mem_search") | Returns {icon: "m", label: "MEM", cls: "cat-memory"} |

**Test Data:** "grep_search", "file_search", "mem_search"

---

### UT-02: categorizeTool — prefix match "execute_pwsh" → CMD

| Field | Value |
|-------|-------|
| **ID** | UT-02 |
| **Priority** | High |
| **Type** | Unit — Functional |
| **Requirement** | UC-1, BR-1 |
| **Preconditions** | categorizeTool function available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call categorizeTool("execute_pwsh") | Returns {icon: ">_", label: "CMD", cls: "cat-command"} |
| 2 | Call categorizeTool("control_pwsh_process") | Returns {icon: ">_", label: "CMD", cls: "cat-command"} |

---

### UT-03: categorizeTool — prefix match FILE tools

| Field | Value |
|-------|-------|
| **ID** | UT-03 |
| **Priority** | High |
| **Type** | Unit — Functional |
| **Requirement** | UC-1, BR-1 |
| **Preconditions** | categorizeTool function available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call categorizeTool("read_file") | Returns {icon: "[]", label: "FILE", cls: "cat-file"} |
| 2 | Call categorizeTool("read_files") | Returns {icon: "[]", label: "FILE", cls: "cat-file"} |
| 3 | Call categorizeTool("list_directory") | Returns {icon: "[]", label: "FILE", cls: "cat-file"} |
| 4 | Call categorizeTool("fs_write") | Returns {icon: "[]", label: "FILE", cls: "cat-file"} |
| 5 | Call categorizeTool("stream_write_file") | Returns {icon: "[]", label: "FILE", cls: "cat-file"} |

---

### UT-04: categorizeTool — fallback for unknown tool

| Field | Value |
|-------|-------|
| **ID** | UT-04 |
| **Priority** | High |
| **Type** | Unit — Functional |
| **Requirement** | UC-1, BR-2 |
| **Preconditions** | categorizeTool function available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call categorizeTool("unknown_tool_xyz") | Returns {icon: "T", label: "TOOL", cls: "cat-tool"} |
| 2 | Call categorizeTool("") | Returns {icon: "T", label: "TOOL", cls: "cat-tool"} |
| 3 | Call categorizeTool(null) | Returns {icon: "T", label: "TOOL", cls: "cat-tool"} |

---

### UT-05: categorizeTool — OI-4 priority fix (file_search → SEARCH not FILE)

| Field | Value |
|-------|-------|
| **ID** | UT-05 |
| **Priority** | Critical |
| **Type** | Unit — Regression |
| **Requirement** | OI-4 |
| **Preconditions** | categorizeTool with prefixMap implemented |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call categorizeTool("file_search") | Returns label: "SEARCH" (NOT "FILE") |

**Test Data:** "file_search" — previously misclassified as FILE due to "file" prefix matching first

---

### UT-06: formatDuration — milliseconds and seconds formatting

| Field | Value |
|-------|-------|
| **ID** | UT-06 |
| **Priority** | Medium |
| **Type** | Unit — Functional |
| **Requirement** | TDD 3.2.3 |
| **Preconditions** | formatDuration function available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call formatDuration(500) | Returns "500ms" |
| 2 | Call formatDuration(999) | Returns "999ms" |
| 3 | Call formatDuration(1000) | Returns "1.0s" |
| 4 | Call formatDuration(1500) | Returns "1.5s" |
| 5 | Call formatDuration(12345) | Returns "12.3s" |

---

### UT-07: statusIcon — all status values

| Field | Value |
|-------|-------|
| **ID** | UT-07 |
| **Priority** | Medium |
| **Type** | Unit — Functional |
| **Requirement** | TDD 3.2.5, OI-3 |
| **Preconditions** | statusIcon function available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call statusIcon("running") | Returns "⏳" (U+23F3) |
| 2 | Call statusIcon("completed") | Returns "✓" (U+2713) |
| 3 | Call statusIcon("failed") | Returns "✗" (U+2717) |
| 4 | Call statusIcon("interrupted") | Returns "⏸" (U+23F8) |
| 5 | Call statusIcon("unknown") | Returns "" |

---

### UT-08: escapeHtml — escapes dangerous characters

| Field | Value |
|-------|-------|
| **ID** | UT-08 |
| **Priority** | High |
| **Type** | Unit — Security |
| **Requirement** | TDD 6.3 |
| **Preconditions** | escapeHtml function available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call escapeHtml('<script>alert("xss")</script>') | Returns '&lt;script&gt;alert("xss")&lt;/script&gt;' |
| 2 | Call escapeHtml('a & b > c < d') | Returns 'a &amp; b &gt; c &lt; d' |
| 3 | Call escapeHtml(null) | Returns "" |
| 4 | Call escapeHtml("") | Returns "" |

---

### UT-09: escapeHtml — handles normal text unchanged

| Field | Value |
|-------|-------|
| **ID** | UT-09 |
| **Priority** | Medium |
| **Type** | Unit — Functional |
| **Requirement** | TDD 6.3 |
| **Preconditions** | escapeHtml function available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call escapeHtml("hello world") | Returns "hello world" (unchanged) |
| 2 | Call escapeHtml("file_search(path=/src)") | Returns "file_search(path=/src)" (unchanged — no special chars) |

---

### UT-10: categorizeTool — contains-based match (broader patterns)

| Field | Value |
|-------|-------|
| **ID** | UT-10 |
| **Priority** | Medium |
| **Type** | Unit — Functional |
| **Requirement** | UC-1, BR-1 |
| **Preconditions** | categorizeTool function available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call categorizeTool("custom_shell_command") | Returns label: "CMD" (contains "shell") |
| 2 | Call categorizeTool("deep_search_v2") | Returns label: "SEARCH" (contains "search") |
| 3 | Call categorizeTool("my_jira_plugin") | Returns label: "JIRA" (contains "jira") |

---

### UT-11: categorizeTool — DOC category tools

| Field | Value |
|-------|-------|
| **ID** | UT-11 |
| **Priority** | Medium |
| **Type** | Unit — Functional |
| **Requirement** | UC-1, BR-1 |
| **Preconditions** | categorizeTool function available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call categorizeTool("export_docx") | Returns {icon: "D", label: "DOC", cls: "cat-doc"} |
| 2 | Call categorizeTool("embed_images") | Returns {icon: "D", label: "DOC", cls: "cat-doc"} |
| 3 | Call categorizeTool("drawio_export") | Returns {icon: "D", label: "DOC", cls: "cat-doc"} |

---

### UT-12: categorizeTool — case insensitivity

| Field | Value |
|-------|-------|
| **ID** | UT-12 |
| **Priority** | Medium |
| **Type** | Unit — Functional |
| **Requirement** | UC-1, BR-1 |
| **Preconditions** | categorizeTool function available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call categorizeTool("EXECUTE_PWSH") | Returns label: "CMD" |
| 2 | Call categorizeTool("Grep_Search") | Returns label: "SEARCH" |
| 3 | Call categorizeTool("READ_FILE") | Returns label: "FILE" |

---

## 3. Integration Tests (IT)

### IT-01: postMessage flow — chat:toolCall renders block

| Field | Value |
|-------|-------|
| **ID** | IT-01 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | UC-1, BR-4 |
| **Preconditions** | VS Code Extension Test Host running, webview panel open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send postMessage({type: "chat:toolCall", toolCall: {id: "tc-1", name: "mem_search", args: {query: "test"}, status: "running"}}) | Webview receives message |
| 2 | Query DOM for element #tc-tc-1 | Element exists with class "tool-call-block" |
| 3 | Check element content | Contains "MEM" category chip, "mem_search" tool name, spinner icon |

---

### IT-02: postMessage flow — chat:toolCallUpdate completes block

| Field | Value |
|-------|-------|
| **ID** | IT-02 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | UC-1, BR-14 |
| **Preconditions** | IT-01 passed, tool block "tc-1" exists in DOM |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send postMessage({type: "chat:toolCallUpdate", id: "tc-1", status: "completed", result: "Found 3 results", duration: 1500}) | Message received |
| 2 | Query #tc-tc-1 .tool-status | Shows "✓" checkmark |
| 3 | Query #tc-tc-1 .tool-duration | Shows "1.5s" |
| 4 | Expand block, check .tool-call-body | Shows "Found 3 results" |

---

### IT-03: State persistence round-trip — save and restore

| Field | Value |
|-------|-------|
| **ID** | IT-03 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | UC-3, BR-9, BR-10, BR-11 |
| **Preconditions** | Extension test host running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Render 2 tool call blocks (running + completed) | Both visible in DOM |
| 2 | Trigger saveStateToDisk (via debounce or direct) | chat:saveState message sent to extension host |
| 3 | Read workspaceState("chatPanel.state") | Contains tabs[0].messages with 2 role:"tool" entries |
| 4 | Destroy webview, recreate panel | Fresh webview |
| 5 | Extension sends tab:updated with saved state | Webview receives message |
| 6 | Verify DOM has 2 tool-call-block elements | Both restored with correct status |

---

### IT-04: State restoration — running → interrupted conversion

| Field | Value |
|-------|-------|
| **ID** | IT-04 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | OI-3, UC-3 AF-1 |
| **Preconditions** | workspaceState has tool call with status "running" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Save state with toolData.status = "running" | Persisted |
| 2 | Reload panel, send tab:updated with saved state | Webview restores |
| 3 | Query restored block .tool-status | Shows "⏸" (interrupted icon, NOT spinner) |
| 4 | Check aria-label | Contains "interrupted" |

---

### IT-05: Streaming does not affect toolCalls map

| Field | Value |
|-------|-------|
| **ID** | IT-05 |
| **Priority** | Critical |
| **Type** | Integration |
| **Requirement** | UC-2, BR-5, BR-7 |
| **Preconditions** | 2 tool call blocks rendered |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Render 2 tool blocks (id: "a", "b") | Both in DOM and toolCalls map |
| 2 | Send chat:streamChunk with nodeId: "stream1", content: "Hello" | Stream bubble created |
| 3 | Send 5 more chat:streamChunk messages | Text appended to stream bubble |
| 4 | Send chat:streamComplete | Stream finalized |
| 5 | Verify toolCalls map still has "a" and "b" | Map unchanged |
| 6 | Verify #tc-a and #tc-b still in DOM | Elements still present |

---

### IT-06: Duration display guard — no duplicate spans

| Field | Value |
|-------|-------|
| **ID** | IT-06 |
| **Priority** | Medium |
| **Type** | Integration |
| **Requirement** | OI-6 |
| **Preconditions** | Tool block exists |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Render tool block "tc-1" (no duration) | Block has no .tool-duration span |
| 2 | Send toolCallUpdate with duration: 1000 | ".tool-duration" span created showing "1.0s" |
| 3 | Send ANOTHER toolCallUpdate with duration: 2000 | Existing span UPDATED to "2.0s" (not duplicated) |
| 4 | Count .tool-duration spans in block | Exactly 1 |

---

## 4. E2E-UI Tests

### E2E-UI-01: Full tool call lifecycle — render, update, expand

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-01 |
| **Priority** | High |
| **Type** | E2E-UI (Playwright) |
| **Requirement** | UC-1, UC-4, BR-4, BR-14 |
| **Preconditions** | Extension loaded in test VS Code |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger agent action that calls mem_search | Tool block appears with "MEM" chip and spinner |
| 2 | Wait for tool completion | Status changes to ✓, duration shown |
| 3 | Click tool block header | Block expands, body shows result |
| 4 | Click header again | Block collapses, body hidden |

---

### E2E-UI-02: Multiple tool calls then stream — all persist

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-02 |
| **Priority** | Critical |
| **Type** | E2E-UI (Playwright) |
| **Requirement** | UC-2, BR-5, BR-6, BR-8 |
| **Preconditions** | Extension loaded, agent configured |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger agent action that calls 3 tools then responds | 3 tool blocks appear sequentially |
| 2 | Wait for streaming text response to complete | Text bubble appears BELOW tool blocks |
| 3 | Verify all 3 tool blocks still visible | All 3 have correct categories and status |
| 4 | Verify text bubble is separate element | Class: .message.assistant (not inside tool block) |

---

### E2E-UI-03: Panel reload restores tool blocks

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-03 |
| **Priority** | High |
| **Type** | E2E-UI (Playwright) |
| **Requirement** | UC-3, BR-9, BR-10 |
| **Preconditions** | Conversation with completed tool calls exists |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify tool blocks visible | At least 1 tool block with ✓ status |
| 2 | Close Chat Panel | Panel hidden |
| 3 | Reopen Chat Panel | Panel restored |
| 4 | Verify tool blocks restored | Same blocks with same status, categories, durations |
| 5 | Click a restored block | Expands showing result (BR-10: fully interactive) |

---

### E2E-UI-04: Keyboard navigation — Tab focus and Enter toggle

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-04 |
| **Priority** | High |
| **Type** | E2E-UI (Playwright) |
| **Requirement** | UC-4 AF-1, BR-17 |
| **Preconditions** | Tool block rendered |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Press Tab until tool block receives focus | Focus ring visible on block (outline) |
| 2 | Press Enter | Block expands, aria-expanded="true" |
| 3 | Press Space | Block collapses, aria-expanded="false" |
| 4 | Verify screen reader attributes | role="button", aria-label contains tool name and status |

---

### E2E-UI-05: Failed tool display

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-05 |
| **Priority** | High |
| **Type** | E2E-UI (Playwright) |
| **Requirement** | BR-15 |
| **Preconditions** | Trigger a tool that will fail |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger agent with tool that fails | Block shows ✗ status icon |
| 2 | Expand the block | Body shows error message |
| 3 | Verify .failed class on body | Red styling (color: #ef4444, left border) |

---

### E2E-UI-06: Category icon correctness for various tools

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-06 |
| **Priority** | High |
| **Type** | E2E-UI (Playwright) |
| **Requirement** | UC-1, BR-1, BR-3 |
| **Preconditions** | Extension loaded |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger execute_pwsh tool | Block shows ">_" icon with "CMD" chip (cat-command class) |
| 2 | Trigger read_file tool | Block shows "[]" icon with "FILE" chip (cat-file class) |
| 3 | Trigger grep_search tool | Block shows "?" icon with "SEARCH" chip (cat-search class) |
| 4 | Trigger jira_get_issue tool | Block shows "J" icon with "JIRA" chip (cat-jira class) |
| 5 | Trigger export_docx tool | Block shows "D" icon with "DOC" chip (cat-doc class) |

---

### E2E-UI-07: Expand running tool shows args, then update shows result

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-07 |
| **Priority** | High |
| **Type** | E2E-UI (Playwright) |
| **Requirement** | UC-4 AF-2, BR-13, BR-14 |
| **Preconditions** | Extension loaded |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger slow tool (takes >2s) | Block appears in "running" state |
| 2 | Expand block while running | Body shows JSON.stringify(args, null, 2) |
| 3 | Wait for tool completion | Status changes to ✓ |
| 4 | Verify body content updated | Body now shows result text (args replaced) |

---

### E2E-UI-08: Chevron rotation on expand/collapse

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-08 |
| **Priority** | Medium |
| **Type** | E2E-UI (Playwright) |
| **Requirement** | BR-16 |
| **Preconditions** | Tool block rendered |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify chevron points right (collapsed) | .tool-chevron shows ▶ |
| 2 | Click header to expand | Block gets "expanded" class |
| 3 | Verify chevron rotated | CSS transform rotates 90° |
| 4 | Click header to collapse | "expanded" class removed, chevron back to 0° |

---

### E2E-UI-09: aria-expanded attribute toggles correctly

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-09 |
| **Priority** | Medium |
| **Type** | E2E-UI (Playwright) |
| **Requirement** | BR-17, OI-2 |
| **Preconditions** | Tool block rendered |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check initial aria-expanded | "false" |
| 2 | Click to expand | aria-expanded changes to "true" |
| 3 | Click to collapse | aria-expanded changes to "false" |
| 4 | Verify aria-label includes tool name | Contains "Tool call: {name} - {status}" |

---

### E2E-UI-10: Multiple rounds of tools + text preserve order

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-10 |
| **Priority** | High |
| **Type** | E2E-UI (Playwright) |
| **Requirement** | UC-2 AF-2, BR-8 |
| **Preconditions** | Agent configured for multi-round |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger action: Round 1 (2 tools + text) | 2 blocks + 1 text bubble in order |
| 2 | Trigger action: Round 2 (1 tool + text) | 1 block + 1 text bubble appended |
| 3 | Verify final DOM order | [tool-a, tool-b, text-1, tool-c, text-2] |

---

## 5. Manual SIT Tests

### SIT-01: Animation smoothness — expand/collapse transition

| Field | Value |
|-------|-------|
| **ID** | SIT-01 |
| **Priority** | Medium |
| **Type** | SIT — Visual/UX |
| **Requirement** | BR-16, NFR (200ms transition) |
| **Preconditions** | Tool block rendered |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click tool block header | Chevron rotation and body reveal animate smoothly (200ms) |
| 2 | Click again to collapse | Reverse animation is smooth, no jank |
| 3 | Rapidly click 5 times | No visual glitches, final state correct |

---

### SIT-02: Focus ring visibility on keyboard navigation

| Field | Value |
|-------|-------|
| **ID** | SIT-02 |
| **Priority** | Medium |
| **Type** | SIT — Accessibility/Visual |
| **Requirement** | OI-2, TDD 3.4 |
| **Preconditions** | Tool block rendered, no mouse interaction |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Press Tab to focus tool block | 2px focus ring visible (VS Code focusBorder color) |
| 2 | Click elsewhere | Focus ring disappears (:focus-visible only on keyboard) |
| 3 | Tab back to tool block | Focus ring reappears |

---

### SIT-03: Interrupted status visual appearance

| Field | Value |
|-------|-------|
| **ID** | SIT-03 |
| **Priority** | Low |
| **Type** | SIT — Visual |
| **Requirement** | OI-3, TDD 3.4 |
| **Preconditions** | Tool block with interrupted status restored |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Observe interrupted status icon | ⏸ pause icon visible, gray color (#94a3b8) |
| 2 | Verify no spinner animation | Static icon, not animated |
| 3 | Verify visual distinction from "running" | Clearly different (no hourglass animation) |

---

### SIT-04: Category chip colors match design spec

| Field | Value |
|-------|-------|
| **ID** | SIT-04 |
| **Priority** | Low |
| **Type** | SIT — Visual |
| **Requirement** | BR-3, TDD 3.4 |
| **Preconditions** | Multiple tool blocks with different categories |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Observe CMD chip | Green background (rgba(34,197,94,0.18)), green text |
| 2 | Observe SEARCH chip | Appropriate color for cat-search class |
| 3 | Observe MEM chip | Purple background (rgba(168,85,247,0.18)), purple text |
| 4 | Observe JIRA chip | Blue background (rgba(59,130,246,0.18)), blue text |
| 5 | Verify all chips readable against dark/light themes | Sufficient contrast |

---

### SIT-05: Duration display positioning and styling

| Field | Value |
|-------|-------|
| **ID** | SIT-05 |
| **Priority** | Low |
| **Type** | SIT — Visual |
| **Requirement** | TDD 3.4 |
| **Preconditions** | Completed tool block with duration |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Observe duration text | Positioned after status icon, opacity 0.5, font-size 10px |
| 2 | Verify alignment | Vertically centered with header elements |
| 3 | Check in both light/dark themes | Readable in both themes |

---

## 6. Functional Test Cases — Happy Path

### TC-001: Render tool call block with correct category

| Field | Value |
|-------|-------|
| **ID** | TC-001 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-1, BR-1, BR-4 |
| **Preconditions** | Chat Panel open, LangGraph processing |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Extension emits chat:toolCall with name="mem_search" | Webview receives message |
| 2 | Verify block rendered | #tc-{id} element exists with class "tool-call-block" |
| 3 | Verify category icon | "m" icon displayed |
| 4 | Verify category chip | "MEM" label with cat-memory class |
| 5 | Verify tool name | "mem_search" displayed |
| 6 | Verify status | Spinner showing (running) |

**Test Data:** {id: "tc-001", name: "mem_search", args: {query: "KSA-247"}, status: "running"}
**Postconditions:** Block stored in toolCalls map

---

### TC-002: Stream text without destroying tool blocks

| Field | Value |
|-------|-------|
| **ID** | TC-002 |
| **Priority** | Critical |
| **Type** | Functional |
| **Requirement** | UC-2, BR-5, BR-6 |
| **Preconditions** | 2 tool call blocks exist in messages area |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send chat:streamChunk with content "Based on the search results..." | New assistant bubble created BELOW tool blocks |
| 2 | Send 4 more stream chunks | Text appended to same bubble |
| 3 | Send chat:streamComplete | Bubble finalized |
| 4 | Verify tool blocks still visible | Both blocks in DOM with original data |

**Postconditions:** 2 tool blocks + 1 text bubble all visible

---

### TC-003: Persist and restore tool calls after reload

| Field | Value |
|-------|-------|
| **ID** | TC-003 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-3, BR-9, BR-10 |
| **Preconditions** | Conversation with 2 completed tool calls |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify state saved (chat:saveState sent) | workspaceState contains tool call data |
| 2 | Close panel | Panel hidden |
| 3 | Reopen panel | tab:updated message sent to webview |
| 4 | Verify 2 tool blocks restored | Correct status (✓), durations, categories |
| 5 | Click restored block | Expands showing result (fully interactive) |

---

### TC-004: Expand/collapse tool call block

| Field | Value |
|-------|-------|
| **ID** | TC-004 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-4, BR-12, BR-16 |
| **Preconditions** | Completed tool call block rendered |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify block starts collapsed | No "expanded" class, body hidden |
| 2 | Click header | "expanded" class added, body visible, chevron rotates 90° |
| 3 | Verify body shows result | textContent = tool result |
| 4 | Click header again | "expanded" class removed, body hidden |

---

## 7. Functional Test Cases — Alternative Flows

### TC-100: Unknown tool name uses fallback category

| Field | Value |
|-------|-------|
| **ID** | TC-100 |
| **Priority** | High |
| **Type** | Functional — AF-1 (UC-1) |
| **Requirement** | UC-1 AF-1, BR-2 |
| **Preconditions** | Chat Panel open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Emit chat:toolCall with name="custom_unknown_tool" | Block rendered |
| 2 | Verify category | icon="T", label="TOOL", class="cat-tool" |

---

### TC-101: Multiple simultaneous tool calls render in order

| Field | Value |
|-------|-------|
| **ID** | TC-101 |
| **Priority** | High |
| **Type** | Functional — AF-2 (UC-1) |
| **Requirement** | UC-1 AF-2 |
| **Preconditions** | Chat Panel open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Emit chat:toolCall for tool-a, tool-b, tool-c (rapid succession) | 3 blocks rendered |
| 2 | Verify DOM order | tool-a above tool-b above tool-c (message arrival order) |

---

### TC-102: Stream without preceding tool calls (normal text)

| Field | Value |
|-------|-------|
| **ID** | TC-102 |
| **Priority** | Medium |
| **Type** | Functional — AF-1 (UC-2) |
| **Requirement** | UC-2 AF-1 |
| **Preconditions** | No tool blocks in current message flow |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send chat:streamChunk directly (no preceding tool calls) | Normal text bubble created |
| 2 | Verify no tool blocks affected | toolCalls map empty/unchanged |

---

### TC-103: Stale "running" tool restored as "interrupted"

| Field | Value |
|-------|-------|
| **ID** | TC-103 |
| **Priority** | High |
| **Type** | Functional — AF-1 (UC-3) |
| **Requirement** | UC-3 AF-1, OI-3 |
| **Preconditions** | workspaceState has tool with status "running" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Reload panel | tab:updated with stale running tool |
| 2 | Verify rendered status | "interrupted" (not "running"), ⏸ icon |
| 3 | Verify no spinner | Static icon displayed |

---

### TC-104: Keyboard toggle (Enter/Space)

| Field | Value |
|-------|-------|
| **ID** | TC-104 |
| **Priority** | High |
| **Type** | Functional — AF-1 (UC-4) |
| **Requirement** | UC-4 AF-1, BR-17 |
| **Preconditions** | Tool block rendered, focused via Tab |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Focus block with Tab | tabindex="0" receives focus |
| 2 | Press Enter | Block expands, aria-expanded="true" |
| 3 | Press Space | Block collapses, aria-expanded="false" |

---

## 8. Functional Test Cases — Exception/Error Flows

### TC-200: Missing id/name in toolCall message — skip rendering

| Field | Value |
|-------|-------|
| **ID** | TC-200 |
| **Priority** | High |
| **Type** | Functional — EF-1 (UC-1) |
| **Requirement** | UC-1 EF-1 |
| **Preconditions** | Chat Panel open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Emit chat:toolCall with {id: null, name: "test"} | No block rendered |
| 2 | Emit chat:toolCall with {id: "x", name: ""} | No block rendered |
| 3 | Emit chat:toolCall with {id: "x", name: null} | No block rendered |
| 4 | Check console | Warning logged: "missing id or name" |
| 5 | Emit valid chat:toolCall after invalid ones | Valid block renders successfully |

---

### TC-201: toolCallUpdate for non-existent block

| Field | Value |
|-------|-------|
| **ID** | TC-201 |
| **Priority** | Medium |
| **Type** | Functional — Error Handling |
| **Requirement** | TDD 8.1 |
| **Preconditions** | Chat Panel open, no blocks rendered |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Emit chat:toolCallUpdate with {id: "nonexistent", status: "completed"} | No error thrown |
| 2 | Check console | Warning: "block not found for id" |
| 3 | Verify other functionality unaffected | New tool calls still render correctly |

---

### TC-202: Corrupted tool data during restoration — skip and continue

| Field | Value |
|-------|-------|
| **ID** | TC-202 |
| **Priority** | Medium |
| **Type** | Functional — EF-1 (UC-3) |
| **Requirement** | UC-3 EF-1 |
| **Preconditions** | workspaceState with mixed valid/invalid tool data |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Persist state with: [valid-tool-1, {id: null, name: null}, valid-tool-2] | State saved |
| 2 | Reload panel | Restoration begins |
| 3 | Verify valid-tool-1 restored | Block visible with correct data |
| 4 | Verify corrupted entry skipped | No error, no crash, console warning |
| 5 | Verify valid-tool-2 restored | Block visible with correct data |

---

## 9. Business Rule Validation

### TC-300: BR-1 — Category determined by prefix match

| Field | Value |
|-------|-------|
| **ID** | TC-300 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-1 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Test all 18 prefix entries from TDD prefixMap | Each returns correct category |

---

### TC-301: BR-2 — Unknown tool defaults to TOOL

| Field | Value |
|-------|-------|
| **ID** | TC-301 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-2 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | categorizeTool("completely_random_name") | {icon:"T", label:"TOOL", cls:"cat-tool"} |

---

### TC-302: BR-3 — CSS class cat-{category}

| Field | Value |
|-------|-------|
| **ID** | TC-302 |
| **Priority** | Medium |
| **Type** | Business Rule |
| **Requirement** | BR-3 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Render mem_search block | Chip element has class "cat-memory" |
| 2 | Render execute_pwsh block | Chip element has class "cat-command" |

---

### TC-303: BR-4 — Icon between chevron and tool name

| Field | Value |
|-------|-------|
| **ID** | TC-303 |
| **Priority** | Medium |
| **Type** | Business Rule |
| **Requirement** | BR-4 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Render any tool block | Header order: .tool-chevron → .tool-icon → .tool-cat → .tool-name → .tool-status |

---

### TC-304: BR-5 — Tool blocks NOT removed during streaming

| Field | Value |
|-------|-------|
| **ID** | TC-304 |
| **Priority** | Critical |
| **Type** | Business Rule |
| **Requirement** | BR-5 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Render 3 tool blocks, then stream 100 chunks | All 3 blocks remain in DOM after streaming completes |

---

### TC-305: BR-6 — Text response is SEPARATE bubble

| Field | Value |
|-------|-------|
| **ID** | TC-305 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-6 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | After tool blocks, stream text | Text in .message.assistant element, NOT inside any .tool-call-block |

---

### TC-306: BR-7 — toolCalls map NOT cleared during streaming

| Field | Value |
|-------|-------|
| **ID** | TC-306 |
| **Priority** | Critical |
| **Type** | Business Rule |
| **Requirement** | BR-7 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add 2 entries to toolCalls map, then stream | After streaming, both entries still in map |

---

### TC-307: BR-8 — Multiple tool blocks persist in order

| Field | Value |
|-------|-------|
| **ID** | TC-307 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-8 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Render tools A, B, C; then stream text | DOM order: A, B, C, text |

---

### TC-308: BR-9 — Tool data included in workspaceState

| Field | Value |
|-------|-------|
| **ID** | TC-308 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-9 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Render + complete tool block | saveStateToDisk called |
| 2 | Read persisted state | messages[] includes {role:"tool", toolData: {id, name, args, status, result, duration}} |

---

### TC-309: BR-10 — Restored blocks are fully interactive

| Field | Value |
|-------|-------|
| **ID** | TC-309 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-10 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Restore tool block from persisted state | Block visible |
| 2 | Click to expand | Expands correctly, shows result |
| 3 | Click to collapse | Collapses correctly |
| 4 | Press Enter on focused block | Toggles expansion |

---

### TC-310: BR-11 — isReplay skips spinner

| Field | Value |
|-------|-------|
| **ID** | TC-310 |
| **Priority** | Medium |
| **Type** | Business Rule |
| **Requirement** | BR-11 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Restore completed tool (isReplay=true) | Shows ✓ immediately, no spinner transition |

---

### TC-311: BR-12 — Clicking header toggles expanded class

| Field | Value |
|-------|-------|
| **ID** | TC-311 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-12 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click header | classList.contains("expanded") === true |
| 2 | Click header again | classList.contains("expanded") === false |

---

### TC-312: BR-13 — Running tool body shows args JSON

| Field | Value |
|-------|-------|
| **ID** | TC-312 |
| **Priority** | Medium |
| **Type** | Business Rule |
| **Requirement** | BR-13 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Expand running tool with args: {query: "test"} | Body shows '{\n  "query": "test"\n}' |

---

### TC-313: BR-14 — Completed tool body shows result

| Field | Value |
|-------|-------|
| **ID** | TC-313 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-14 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Expand completed tool with result "Found 3 files" | Body shows "Found 3 files" |

---

### TC-314: BR-15 — Failed tool shows error with .failed styling

| Field | Value |
|-------|-------|
| **ID** | TC-314 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-15 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Expand failed tool with error "File not found" | Body shows "File not found" |
| 2 | Verify styling | .tool-call-body has class "failed" (red color, left border) |

---

### TC-315: BR-16 — Chevron rotates 90° on expand

| Field | Value |
|-------|-------|
| **ID** | TC-315 |
| **Priority** | Medium |
| **Type** | Business Rule |
| **Requirement** | BR-16 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Expand block | .tool-chevron has CSS transform rotate(90deg) |
| 2 | Collapse block | .tool-chevron transform returns to rotate(0deg) |

---

### TC-316: BR-17 — Focusable via tabindex, toggle via Enter/Space

| Field | Value |
|-------|-------|
| **ID** | TC-316 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-17 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check block attributes | tabindex="0", role="button" |
| 2 | Focus + Enter | Toggles expanded |
| 3 | Focus + Space | Toggles expanded |
| 4 | Focus + other key (e.g., "A") | No toggle (only Enter/Space) |

---

## 10. Boundary & Negative Testing

### TC-400: Empty tool name

| Field | Value |
|-------|-------|
| **ID** | TC-400 |
| **Priority** | Medium |
| **Type** | Boundary |
| **Requirement** | UC-1 EF-1 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Emit chat:toolCall with name="" | Block NOT rendered (EF-1) |
| 2 | Console log | Warning about missing name |

---

### TC-401: Very long tool name (200 chars)

| Field | Value |
|-------|-------|
| **ID** | TC-401 |
| **Priority** | Medium |
| **Type** | Boundary |
| **Requirement** | FSD 3.1.5 (truncate at 40 chars) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Emit tool call with name = "a".repeat(200) | Block renders without breaking layout |
| 2 | Verify name display | Truncated or wrapped (no overflow) |

---

### TC-402: Very large args object

| Field | Value |
|-------|-------|
| **ID** | TC-402 |
| **Priority** | Medium |
| **Type** | Boundary |
| **Requirement** | BR-13 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Emit tool call with args = 50KB JSON object | Block renders |
| 2 | Expand block | Body shows full JSON (scrollable if needed) |
| 3 | No crash or performance issue | Render time acceptable |

---

### TC-403: Null/undefined args

| Field | Value |
|-------|-------|
| **ID** | TC-403 |
| **Priority** | Medium |
| **Type** | Negative |
| **Requirement** | UC-4 EF-1 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Render tool with args=null, status="running" | Block renders |
| 2 | Expand block | Body shows "No data available" |

---

### TC-404: Tool result with HTML/script injection

| Field | Value |
|-------|-------|
| **ID** | TC-404 |
| **Priority** | High |
| **Type** | Negative — Security |
| **Requirement** | TDD 6.3 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send toolCallUpdate with result='<script>alert("xss")</script>' | Result displayed as text, NOT executed |
| 2 | Verify body.textContent | Shows literal '<script>alert("xss")</script>' |
| 3 | Verify no alert fired | Page safe |

---

### TC-405: Duration = 0ms edge case

| Field | Value |
|-------|-------|
| **ID** | TC-405 |
| **Priority** | Low |
| **Type** | Boundary |
| **Requirement** | TDD 3.2.3 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send toolCallUpdate with duration=0 | Duration shows "0ms" |

---

## 11. Non-Functional Testing

### TC-600: Tool block renders within 16ms

| Field | Value |
|-------|-------|
| **ID** | TC-600 |
| **Priority** | Medium |
| **Type** | Performance |
| **Requirement** | BRD NFR, FSD Section 8 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Measure time from chat:toolCall receipt to DOM element visible | ≤ 16ms (1 animation frame) |

**Acceptance Criteria:** Render time ≤ 16ms for a single tool block

---

### TC-601: Expand/collapse completes within 200ms

| Field | Value |
|-------|-------|
| **ID** | TC-601 |
| **Priority** | Medium |
| **Type** | Performance |
| **Requirement** | BRD NFR, BR-16 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click header, measure time until transition complete | ≤ 200ms |

---

### TC-602: 50 tool blocks render without degradation

| Field | Value |
|-------|-------|
| **ID** | TC-602 |
| **Priority** | Medium |
| **Type** | Performance |
| **Requirement** | TDD 7.2 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Rapidly emit 50 chat:toolCall messages | All 50 render |
| 2 | Scroll performance | Smooth scrolling, no lag |
| 3 | Expand/collapse any block | Still < 200ms |

---

### TC-603: CSP compliance — no inline script execution

| Field | Value |
|-------|-------|
| **ID** | TC-603 |
| **Priority** | High |
| **Type** | Security |
| **Requirement** | TDD 6.2 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Inject tool name with onclick handler attempt | CSP blocks execution |
| 2 | Check DevTools console | No CSP violations related to tool blocks |

---

### TC-604: Screen reader announces tool block state

| Field | Value |
|-------|-------|
| **ID** | TC-604 |
| **Priority** | Medium |
| **Type** | Accessibility |
| **Requirement** | BR-17, OI-2, FSD Section 8 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Focus tool block | Screen reader announces: "Tool call: {name} - {status}, button" |
| 2 | Toggle expanded | Screen reader announces: "expanded/collapsed" |

---

## 12. Integration Testing

### TC-700: Extension Host → Webview message flow (chat:toolCall)

| Field | Value |
|-------|-------|
| **ID** | TC-700 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | FSD Section 5.1 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Extension host calls view.webview.postMessage({type:"chat:toolCall", toolCall:{...}}) | Webview listener fires |
| 2 | Verify renderToolCall called | DOM element created |

---

### TC-701: Webview → Extension Host message flow (chat:saveState)

| Field | Value |
|-------|-------|
| **ID** | TC-701 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | FSD Section 5.2 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger saveStateToDisk in webview | vscode.postMessage({type:"chat:saveState", ...}) called |
| 2 | Verify extension host receives | onDidReceiveMessage handler fires |
| 3 | Verify workspaceState updated | Key "chatPanel.state" contains tool data |

---

### TC-702: State restore — Extension reads workspaceState and sends tab:updated

| Field | Value |
|-------|-------|
| **ID** | TC-702 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | FSD Section 5.2, UC-3 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | workspaceState has persisted conversation with tool calls | Data available |
| 2 | Webview fires "ready" event | Extension host restoreChatState() called |
| 3 | Verify tab:updated message sent | Contains full messages array with tool data |

---

### TC-703: LangGraph → Extension → Webview tool call pipeline

| Field | Value |
|-------|-------|
| **ID** | TC-703 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | TDD 2.2, 2.3 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | LangGraph emits tool call event | ChatPanelProvider receives |
| 2 | ChatPanelProvider formats as chat:toolCall message | Correct ToolCallDisplay format |
| 3 | postMessage sent to webview | Webview renders block |

---

### TC-704: Debounced save — rapid updates batch correctly

| Field | Value |
|-------|-------|
| **ID** | TC-704 |
| **Priority** | Medium |
| **Type** | Integration |
| **Requirement** | TDD 7.2 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger 5 tool call updates within 100ms | saveStateToDisk debounce timer resets |
| 2 | Wait 600ms | Single chat:saveState message sent (not 5) |
| 3 | Verify final state | Contains all 5 updates |

---

### TC-705: workspaceState round-trip — serialize and deserialize

| Field | Value |
|-------|-------|
| **ID** | TC-705 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | BR-9, TDD 4.2 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create conversation with: text + 3 tool calls (running, completed, failed) + text | Full message array |
| 2 | Save to workspaceState | JSON serialization succeeds |
| 3 | Read from workspaceState | All data intact (no data loss in serialization) |
| 4 | Restore to webview | All messages and tool blocks render correctly |

---

## 13. Regression Testing

### TC-800: Existing chat text messages still render

| Field | Value |
|-------|-------|
| **ID** | TC-800 |
| **Priority** | Medium |
| **Type** | Regression |
| **Requirement** | KSA-210 (Chat Panel MVP) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send user message | User bubble appears |
| 2 | Receive assistant text (no tool calls) | Assistant bubble appears |
| 3 | Verify markdown rendering | Code blocks, links render correctly |

---

### TC-801: Tab switching preserves tool blocks

| Field | Value |
|-------|-------|
| **ID** | TC-801 |
| **Priority** | Medium |
| **Type** | Regression |
| **Requirement** | KSA-240 (State Persistence) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create Tab A with tool call blocks | Blocks visible |
| 2 | Switch to Tab B | Tab B loads |
| 3 | Switch back to Tab A | Tool call blocks restored correctly |

---

### TC-802: Input field and send button still work

| Field | Value |
|-------|-------|
| **ID** | TC-802 |
| **Priority** | Medium |
| **Type** | Regression |
| **Requirement** | KSA-210 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Type in input field | Text appears |
| 2 | Click send | Message sent, input cleared |

---

## 14. Requirements Traceability Matrix (RTM)

| Requirement | Source | Test Cases | Coverage |
|-------------|--------|------------|----------|
| UC-1 (Render with icon) | FSD 3.1.2 | TC-001, TC-100, TC-101, UT-01–UT-05, UT-10–UT-12, PBT-01, E2E-UI-01, E2E-UI-06 | ✅ |
| UC-2 (Stream without destroying) | FSD 3.2.2 | TC-002, TC-102, IT-05, E2E-UI-02, E2E-UI-10 | ✅ |
| UC-3 (Persist and restore) | FSD 3.3.2 | TC-003, TC-103, TC-202, IT-03, IT-04, E2E-UI-03 | ✅ |
| UC-4 (Expand/collapse) | FSD 3.4.2 | TC-004, TC-104, E2E-UI-01, E2E-UI-04, E2E-UI-07, E2E-UI-08, E2E-UI-09 | ✅ |
| BR-1 (Prefix match) | FSD 3.1.3 | TC-300, UT-01–UT-05, UT-10–UT-12, PBT-01 | ✅ |
| BR-2 (Fallback TOOL) | FSD 3.1.3 | TC-301, UT-04, TC-100 | ✅ |
| BR-3 (CSS class) | FSD 3.1.3 | TC-302, SIT-04 | ✅ |
| BR-4 (Icon position) | FSD 3.1.3 | TC-303 | ✅ |
| BR-5 (Blocks not removed) | FSD 3.2.3 | TC-304, IT-05, E2E-UI-02 | ✅ |
| BR-6 (Separate bubble) | FSD 3.2.3 | TC-305, E2E-UI-02 | ✅ |
| BR-7 (Map not cleared) | FSD 3.2.3 | TC-306, IT-05 | ✅ |
| BR-8 (Order preserved) | FSD 3.2.3 | TC-307, E2E-UI-10 | ✅ |
| BR-9 (State includes data) | FSD 3.3.3 | TC-308, IT-03, TC-705 | ✅ |
| BR-10 (Restored interactive) | FSD 3.3.3 | TC-309, E2E-UI-03 | ✅ |
| BR-11 (isReplay no spinner) | FSD 3.3.3 | TC-310, IT-04 | ✅ |
| BR-12 (Toggle expanded class) | FSD 3.4.3 | TC-311, E2E-UI-08 | ✅ |
| BR-13 (Running shows args) | FSD 3.4.3 | TC-312, E2E-UI-07 | ✅ |
| BR-14 (Completed shows result) | FSD 3.4.3 | TC-313, E2E-UI-07, IT-02 | ✅ |
| BR-15 (Failed shows error) | FSD 3.4.3 | TC-314, E2E-UI-05 | ✅ |
| BR-16 (Chevron 90°) | FSD 3.4.3 | TC-315, E2E-UI-08, SIT-01 | ✅ |
| BR-17 (Keyboard a11y) | FSD 3.4.3 | TC-316, TC-104, E2E-UI-04, E2E-UI-09, TC-604 | ✅ |
| OI-3 (Interrupted) | TDD 3.2.5 | TC-103, IT-04, UT-07, PBT-04, SIT-03 | ✅ |
| OI-4 (Priority fix) | TDD 3.2.1 | UT-05 | ✅ |
| OI-6 (Duration guard) | TDD 3.2.3 | IT-06 | ✅ |
| XSS Prevention | TDD 6.3 | UT-08, UT-09, PBT-02, TC-404, TC-603 | ✅ |
| NFR: Render < 16ms | BRD NFR | TC-600 | ✅ |
| NFR: Transition 200ms | BRD NFR | TC-601, SIT-01 | ✅ |
| NFR: Keyboard a11y | BRD NFR | TC-604, E2E-UI-04, SIT-02 | ✅ |

**Coverage Summary:**

| Category | Total | Covered | Coverage % |
|----------|-------|---------|------------|
| Use Cases | 4 | 4 | 100% |
| Business Rules | 17 | 17 | 100% |
| Open Issues | 3 (OI-3, OI-4, OI-6) | 3 | 100% |
| NFR | 3 | 3 | 100% |
| **Overall** | **27** | **27** | **100%** |

---

## 15. Appendix

### Test Data Setup

Tool call fixture data available at `documents/KSA-247/testdata/`.

### Environment Configuration

- VS Code Extension Development Host (F5 debug mode)
- Node.js 18+
- No external services required (all in-process)
