# Software Test Cases (STC)

## Chatbox UI — KSA-252: Context Menu ("#" Trigger)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-252 |
| Title | Context Menu ("#" Trigger) — Test Cases |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-06-15 |
| Status | Draft |
| Related STP | STP-v1-KSA-252.docx |

---

## 1. Property-Based Testing (PBT) — 12 Cases

### PBT-01: Fuzzy Filter Subset Property

| Field | Value |
|-------|-------|
| ID | PBT-01 |
| Level | PBT |
| Module | FuzzyFilter.ts |
| Property | For any items I, queries q1 and q2: filter(I, q1+q2) ⊆ filter(I, q1) |
| Generator | Arbitrary strings (1-20 chars, alphanumeric + space) |
| Iterations | 1000 |
| Framework | fast-check + Vitest |

```typescript
fc.assert(fc.property(
  fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 50 }),
  fc.string({ minLength: 1, maxLength: 5 }),
  fc.string({ minLength: 1, maxLength: 5 }),
  (labels, q1, q2) => {
    const items = labels.map(l => ({ label: l }));
    const r1 = fuzzyFilter(items, q1);
    const r2 = fuzzyFilter(items, q1 + q2);
    return r2.every(item => r1.includes(item));
  }
));
```

---

### PBT-02: Fuzzy Filter Empty Query Returns All

| Field | Value |
|-------|-------|
| ID | PBT-02 |
| Level | PBT |
| Module | FuzzyFilter.ts |
| Property | filter(items, "") === items (returns all items unchanged) |
| Generator | Arbitrary arrays of ContextMenuItem (1-20 items) |
| Iterations | 500 |

---

### PBT-03: Fuzzy Filter Performance Bound

| Field | Value |
|-------|-------|
| ID | PBT-03 |
| Level | PBT |
| Module | FuzzyFilter.ts |
| Property | filter(N items, query) completes within 50ms for N <= 1000 |
| Generator | Array of 100-1000 strings, query 1-10 chars |
| Iterations | 100 |

---

### PBT-04: Fuzzy Filter Idempotency

| Field | Value |
|-------|-------|
| ID | PBT-04 |
| Level | PBT |
| Module | FuzzyFilter.ts |
| Property | filter(filter(items, q), q) produces same results as filter(items, q) |
| Generator | Arbitrary items + query |
| Iterations | 500 |

---

### PBT-05: Fuzzy Filter Prefix Bonus

| Field | Value |
|-------|-------|
| ID | PBT-05 |
| Level | PBT |
| Module | FuzzyFilter.ts |
| Property | Items starting with query always score higher than items containing query mid-string |
| Generator | Prefix-matching item + mid-match item + query |
| Iterations | 500 |

---

### PBT-06: State Machine No Stuck States

| Field | Value |
|-------|-------|
| ID | PBT-06 |
| Level | PBT |
| Module | ContextMenuController.ts |
| Property | From any reachable state, applying DISMISS trigger leads to CLOSED within 2 steps |
| Generator | Arbitrary sequence of valid triggers (1-10 length) |
| Iterations | 1000 |

---

### PBT-07: State Machine Transition Validity

| Field | Value |
|-------|-------|
| ID | PBT-07 |
| Level | PBT |
| Module | ContextMenuController.ts |
| Property | Undefined transitions are rejected (state unchanged, no error thrown) |
| Generator | All state x all trigger combinations |
| Iterations | All (exhaustive — 5 states x 8 triggers = 40) |

---

### PBT-08: State Machine CLOSED Reachable

| Field | Value |
|-------|-------|
| ID | PBT-08 |
| Level | PBT |
| Module | ContextMenuController.ts |
| Property | DISMISS from any state leads to CLOSED (except CLOSED is no-op) |
| Generator | All 5 states |
| Iterations | Exhaustive |

---

### PBT-09: Badge Unique IDs

| Field | Value |
|-------|-------|
| ID | PBT-09 |
| Level | PBT |
| Module | BadgeManager.ts |
| Property | Insert N badges results in N elements with all unique IDs |
| Generator | N = 1..20, arbitrary badge types |
| Iterations | 500 |

---

### PBT-10: Badge Insert/Remove Invariant

| Field | Value |
|-------|-------|
| ID | PBT-10 |
| Level | PBT |
| Module | BadgeManager.ts |
| Property | insert(b) then remove(b.id) returns to original set |
| Generator | Arbitrary badge sequence (1-10) |
| Iterations | 500 |

---

### PBT-11: Badge Max Limit

| Field | Value |
|-------|-------|
| ID | PBT-11 |
| Level | PBT |
| Module | BadgeManager.ts |
| Property | Insert N badges where N > 20 results in getAll().length === 20 |
| Generator | N = 21..50 |
| Iterations | 100 |

---

### PBT-12: Fuzzy Filter Case Insensitivity

| Field | Value |
|-------|-------|
| ID | PBT-12 |
| Level | PBT |
| Module | FuzzyFilter.ts |
| Property | filter(items, q.toLowerCase()) matches same items as filter(items, q.toUpperCase()) |
| Generator | Arbitrary items + query (alpha only) |
| Iterations | 500 |

---

## 2. Unit Testing (UT) — 45 Cases

### 2.1 FuzzyFilter.ts (10 cases)

| ID | Test Case | Input | Expected Output |
|----|-----------|-------|-----------------|
| UT-01 | Exact match returns item | items=["Files","Spec"], query="Files" | ["Files"] |
| UT-02 | Partial match (subsequence) | items=["Files","Folder"], query="fl" | ["Files","Folder"] |
| UT-03 | No match returns empty | items=["Files","Spec"], query="xyz" | [] |
| UT-04 | Empty query returns all | items=["A","B","C"], query="" | ["A","B","C"] |
| UT-05 | Case insensitive matching | items=["Git Diff"], query="git" | ["Git Diff"] |
| UT-06 | Special characters handled | items=["#File: test.ts"], query="#" | ["#File: test.ts"] |
| UT-07 | Unicode characters | items=["Tep","Thu muc"], query="te" | ["Tep"] |
| UT-08 | Score ordering (prefix > mid) | items=["Folder","Current File"], query="f" | ["Folder","Current File"] (Folder first) |
| UT-09 | Single character query | items=9 menu items, query="m" | ["MCP"] |
| UT-10 | Very long query (20+ chars) | items=["Short"], query="verylongquerythatnevermatches" | [] |

### 2.2 ContextMenuItems.ts (3 cases)

| ID | Test Case | Input | Expected Output |
|----|-----------|-------|-----------------|
| UT-11 | All 9 items defined | CONTEXT_MENU_ITEMS | length === 9 |
| UT-12 | Each item has required fields | All items | id, label, icon, type present on each |
| UT-13 | Correct types assigned | Check instant items | "git-diff","terminal","problems","current-file" have type="instant" |

### 2.3 BadgeManager.ts (10 cases)

| ID | Test Case | Input | Expected Output |
|----|-----------|-------|-----------------|
| UT-14 | Insert single badge | badge{type:"files", label:"#File: a.ts"} | getAll().length === 1 |
| UT-15 | Insert multiple badges | 3 different badges | getAll().length === 3 |
| UT-16 | Remove by ID | insert(b), remove(b.id) | getAll().length === 0 |
| UT-17 | Remove non-existent ID | remove("invalid-id") | No error thrown, collection unchanged |
| UT-18 | Clear all | insert 5 badges, clear() | getAll().length === 0 |
| UT-19 | Max 20 limit enforced | insert 25 badges | getAll().length === 20 |
| UT-20 | getAll returns copies | getAll(), mutate result | Original collection unchanged |
| UT-21 | resolveAll triggers resolution | 2 badges, mock resolver | Both resolved with content |
| UT-22 | resolveAll handles partial failure | 1 success + 1 timeout | Returns 1 fulfilled result |
| UT-23 | Duplicate type allowed | 2 badges with type="files" | Both stored (different IDs) |

### 2.4 BadgeRenderer.ts (6 cases)

| ID | Test Case | Input | Expected Output |
|----|-----------|-------|-----------------|
| UT-24 | Creates span element | badge{type:"files"} | HTMLSpanElement with class "context-badge" |
| UT-25 | Sets contentEditable false | any badge | el.contentEditable === "false" |
| UT-26 | Escapes HTML in label | badge{label:"<script>alert(1)</script>"} | No raw HTML in innerHTML, text escaped |
| UT-27 | Includes remove (X) button | any badge | querySelector(".badge-remove") exists |
| UT-28 | Maps correct icon | badge{type:"git-diff"} | Icon element has "plus" identifier |
| UT-29 | Truncates long labels | badge{label:"#File: very/long/deep/path/file.ts"} | max-width CSS applied |

### 2.5 MessageBridge.ts (8 cases)

| ID | Test Case | Input | Expected Output |
|----|-----------|-------|-----------------|
| UT-30 | Generates unique request IDs | Call request() 100 times | All generated IDs are unique |
| UT-31 | Timeout rejects promise | request with 100ms timeout, no response | Promise rejects with "Timeout" error |
| UT-32 | Matches response to request | Send request id="ctx-1", fire response id="ctx-1" | Promise resolves with response data |
| UT-33 | Ignores unmatched responses | Fire response with unknown id="ctx-999" | No error, no resolution |
| UT-34 | Cleans up after timeout | Timeout occurs | pendingRequests.size decremented |
| UT-35 | Cleans up after response | Response received | pendingRequests.size decremented |
| UT-36 | Handles error responses | Response {type:"error", message:"fail"} | Promise rejects with "fail" |
| UT-37 | Concurrent requests work | 5 parallel requests, 5 responses | Each resolves to its own data |

### 2.6 ContextMenuController.ts (8 cases)

| ID | Test Case | Input | Expected Output |
|----|-----------|-------|-----------------|
| UT-38 | Initial state is CLOSED | new ContextMenuController() | state === "CLOSED" |
| UT-39 | HASH_TYPED transitions to OPEN | From CLOSED, dispatch HASH_TYPED | state === "OPEN" |
| UT-40 | CHAR_TYPED transitions to FILTERING | From OPEN, dispatch CHAR_TYPED | state === "FILTERING" |
| UT-41 | DISMISS from OPEN goes to CLOSED | From OPEN, dispatch DISMISS | state === "CLOSED" |
| UT-42 | Invalid transition ignored | From CLOSED, dispatch CHAR_TYPED | state remains "CLOSED" |
| UT-43 | PICKER_SELECTED to PICKER_OPEN | From OPEN, dispatch PICKER_SELECTED | state === "PICKER_OPEN" |
| UT-44 | INSTANT_SELECTED to BADGE_INSERTED | From OPEN, dispatch INSTANT_SELECTED | state === "BADGE_INSERTED" |
| UT-45 | BADGE_INSERTED auto-transitions to CLOSED | After entering BADGE_INSERTED | state === "CLOSED" |

---

## 3. Integration Testing (IT) — 30 Cases

### 3.1 Controller to View (6 cases)

| ID | Test Case | Setup | Action | Expected |
|----|-----------|-------|--------|----------|
| IT-01 | Menu opens on hash trigger | Controller + View (jsdom) | controller.open() | DOM ".context-menu" element visible |
| IT-02 | Menu closes on dismiss | Menu open in DOM | controller.close() | DOM ".context-menu" hidden/removed |
| IT-03 | Filter updates visible items | Menu open, 9 items rendered | controller.filter("fi") | Only 2 items ("Files","Current File") have display!="none" |
| IT-04 | Highlight moves on arrow key | Menu open, first item highlighted | handleKeyDown(ArrowDown) x2 | 3rd item has "highlighted" class |
| IT-05 | Enter selects highlighted item | 3rd item highlighted | handleKeyDown(Enter) | 3rd item's action triggered (callback called) |
| IT-06 | Escape closes and clears filter | Menu open, filter="fi" | handleKeyDown(Escape) | Menu hidden, filterText="" |

### 3.2 Controller to BadgeManager (5 cases)

| ID | Test Case | Setup | Action | Expected |
|----|-----------|-------|--------|----------|
| IT-07 | Instant select inserts badge | Controller + BadgeManager | selectInstant({id:"git-diff",...}) | badgeManager.getAll().length===1, type==="git-diff" |
| IT-08 | Picker select inserts badge | Controller + BadgeManager | selectFromPicker({type:"files", filePaths:["a.ts"]}) | Badge label === "#File: a.ts" |
| IT-09 | Multiple selections accumulate | Controller | Select "git-diff", then "terminal", then "problems" | 3 badges in manager |
| IT-10 | Badge remove decrements count | 3 badges | badgeManager.remove(badges[1].id) | 2 badges remain, correct ones |
| IT-11 | Clear removes all badges | 3 badges | badgeManager.clear() | 0 badges |

### 3.3 Controller to MessageBridge (6 cases)

| ID | Test Case | Setup | Action | Expected |
|----|-----------|-------|--------|----------|
| IT-12 | Files picker triggers file tree request | Controller + mock Bridge | openPicker("files") | bridge.getFileTree() called once |
| IT-13 | File tree response renders picker | Mock returns [{name:"src",type:"directory",children:[...]}] | Await response | PickerPanel DOM shows "src" folder |
| IT-14 | Spec picker triggers spec list request | Controller + mock Bridge | openPicker("spec") | bridge.getSpecList() called |
| IT-15 | Timeout shows error state | Bridge configured to timeout (3s) | Open Files picker, wait 3s | Picker shows "Failed to load. Retry?" |
| IT-16 | MCP picker requests resources | Controller + mock Bridge | openPicker("mcp") | bridge.getMcpResources() called |
| IT-17 | Current File gets filename | Controller + mock Bridge (returns "index.ts") | selectInstant("current-file") | Badge label === "#Current File: index.ts" |

### 3.4 InputArea to Controller (4 cases)

| ID | Test Case | Setup | Action | Expected |
|----|-----------|-------|--------|----------|
| IT-18 | Hash character triggers menu | InputAreaIntegration wired to Controller | Dispatch keydown "#" on input | controller.open() called |
| IT-19 | Badge element appears in input DOM | Badge inserted via manager | Check inputEl children | span.context-badge element present |
| IT-20 | Backspace adjacent to badge removes it | Badge in input, cursor after badge | Dispatch keydown Backspace | Badge span removed, manager.remove called |
| IT-21 | Click (X) icon removes badge | Badge rendered with .badge-remove | Click .badge-remove | Badge span removed from DOM |

### 3.5 View to FuzzyFilter (3 cases)

| ID | Test Case | Setup | Action | Expected |
|----|-----------|-------|--------|----------|
| IT-22 | Filter "ter" shows Terminal only | 9 items rendered | view.applyFilter("ter") | Only "Terminal" item visible |
| IT-23 | Empty filter restores all | Filtered to 1 item | view.applyFilter("") | All 9 items visible |
| IT-24 | No matches shows empty state | 9 items rendered | view.applyFilter("xyz") | "No matching items" message visible |

### 3.6 PickerPanel to MessageBridge (4 cases)

| ID | Test Case | Setup | Action | Expected |
|----|-----------|-------|--------|----------|
| IT-25 | File tree loads and renders items | Mock returns 3 directories | Open Files picker | 3 folder nodes rendered |
| IT-26 | Folder picker shows directories only | Mock returns files + dirs | Open Folder picker | Only directory nodes rendered |
| IT-27 | Steering picker shows filenames without extension | Mock returns ["sm-core.md","drawio.md"] | Open Steering picker | Items: "sm-core", "drawio" |
| IT-28 | Picker search filters items | File picker, 50 mock files | Type "test" in picker search | Only files with "test" in name shown |

### 3.7 Performance (2 cases)

| ID | Test Case | Setup | Action | Expected |
|----|-----------|-------|--------|----------|
| IT-29 | Menu render within 100ms | Controller + View (jsdom) | Measure: start=now(), controller.open(), end=now() | end-start < 100ms |
| IT-30 | Filter within 50ms | 9 items loaded | Measure: start=now(), filter("f"), end=now() | end-start < 50ms |

---

## 4. E2E-API Testing (E2E-API) — 18 Cases

### 4.1 File System Protocol

| ID | Test Case | Request | Expected Response | Timeout |
|----|-----------|---------|-------------------|---------|
| E2E-API-01 | Get file tree success | {type:"getWorkspaceFileTree"} | {type:"workspaceFileTree", data:[...]} (non-empty array of FileTreeNode) | 3000ms |
| E2E-API-02 | Get spec list success | {type:"getSpecList"} | {type:"specList", data:["chatbox-ui",...]} (string array) | 1000ms |
| E2E-API-03 | Resolve spec content | {type:"resolveSpecContent", specName:"chatbox-ui"} | {type:"specContent", data:{requirements:string, design:string, tasks:string}} | 2000ms |
| E2E-API-04 | Get folder tree | {type:"getWorkspaceFolderTree"} | {type:"workspaceFolderTree", data:[...]} (FolderTreeNode array) | 3000ms |
| E2E-API-05 | Get steering files | {type:"getSteeringFiles"} | {type:"steeringFiles", data:["sm-core","drawio",...]} | 1000ms |

### 4.2 Context Resolution Protocol

| ID | Test Case | Request | Expected Response | Timeout |
|----|-----------|---------|-------------------|---------|
| E2E-API-06 | Resolve git diff | {type:"resolveGitDiff"} | {type:"gitDiff", data:string} (diff output) | 3000ms |
| E2E-API-07 | Resolve terminal output | {type:"resolveTerminalOutput", lines:100} | {type:"terminalOutput", data:string} | 1000ms |
| E2E-API-08 | Resolve diagnostics | {type:"resolveDiagnostics"} | {type:"diagnostics", data:DiagnosticItem[]} | 500ms |
| E2E-API-09 | Resolve file content | {type:"resolveFileContent", paths:["src/index.ts"]} | {type:"fileContent", data:[{path:"src/index.ts", content:string}]} | 3000ms |
| E2E-API-10 | Resolve steering content | {type:"resolveSteeringContent", fileName:"sm-core"} | {type:"steeringContent", data:string} (non-empty markdown) | 1000ms |
| E2E-API-11 | Resolve folder listing | {type:"resolveFolderListing", folderPath:"src"} | {type:"folderListing", data:string[]} (file paths) | 3000ms |

### 4.3 MCP Protocol

| ID | Test Case | Request | Expected Response | Timeout |
|----|-----------|---------|-------------------|---------|
| E2E-API-12 | Get MCP resources | {type:"getMcpResources"} | {type:"mcpResources", data:McpResourceItem[]} | 5000ms |
| E2E-API-13 | Resolve MCP resource | {type:"resolveMcpResource", server:"test", resource:"tool1"} | {type:"mcpResourceContent", data:string} | 5000ms |

### 4.4 Error Handling Protocol

| ID | Test Case | Request | Expected Response | Timeout |
|----|-----------|---------|-------------------|---------|
| E2E-API-14 | No git repo error | {type:"resolveGitDiff"} (no .git/) | {type:"error", message: contains "git", requestType:"resolveGitDiff"} | 3000ms |
| E2E-API-15 | No active terminal | {type:"resolveTerminalOutput"} (no terminals) | {type:"error", message: contains "terminal"} | 1000ms |
| E2E-API-16 | No MCP configured | {type:"getMcpResources"} (no mcp.json) | {type:"mcpResources", data:[]} (empty array, not error) | 5000ms |
| E2E-API-17 | File not found | {type:"resolveFileContent", paths:["nonexist.ts"]} | {type:"error", message: contains "not found"} | 3000ms |
| E2E-API-18 | Get active filename (no editor) | {type:"getActiveFileName"} (no open file) | {type:"activeFileName", data:null} | 100ms |

---

## 5. E2E-UI Testing (E2E-UI) — 24 Cases (Gherkin)

### E2E-UI-01: Context Menu Trigger

```gherkin
Feature: Context Menu Trigger
  Scenario: Menu appears when user types hash
    Given the Input Area is focused and empty
    When the user types "#"
    Then the Context Menu popup appears above the input field
    And the popup is visible within 150ms
    And the popup displays 9 context source items
```

### E2E-UI-02: Nine Categories Displayed

```gherkin
Feature: Context Menu Items
  Scenario: All categories visible with correct icons
    Given the Context Menu is open
    Then the following items are displayed in order:
      | Label        | Icon           | Type    |
      | Files        | folder         | picker  |
      | Spec         | document       | picker  |
      | Git Diff     | plus           | instant |
      | Terminal     | terminal       | instant |
      | Problems     | warning        | instant |
      | Folder       | folder         | picker  |
      | Current File | document       | instant |
      | Steering     | steering-wheel | picker  |
      | MCP          | gem            | submenu |
```

### E2E-UI-03: Keyboard Navigation

```gherkin
Feature: Keyboard Navigation
  Scenario: Arrow keys navigate menu items
    Given the Context Menu is open with 9 items
    When the user presses ArrowDown 3 times
    Then the 4th item "Terminal" is highlighted
    When the user presses ArrowUp 1 time
    Then the 3rd item "Git Diff" is highlighted
    When the user presses Enter
    Then a badge "#Git Diff" is inserted into the input
    And the Context Menu closes
```

### E2E-UI-04: Dismiss on Escape

```gherkin
Feature: Menu Dismissal
  Scenario: Escape closes menu without insertion
    Given the Context Menu is open
    When the user presses Escape
    Then the Context Menu is hidden
    And no badge is inserted into the input
    And the "#" trigger text is removed from the input
```

### E2E-UI-05: Files Picker Opens

```gherkin
Feature: Files Context Selection
  Scenario: Files picker shows workspace tree
    Given the Context Menu is open
    When the user selects "Files"
    Then a file picker panel appears
    And the file picker shows workspace files in a tree structure
    And a search input is available at the top of the picker
```

### E2E-UI-06: Files Fuzzy Search

```gherkin
Feature: File Picker Search
  Scenario: Fuzzy search filters file tree
    Given the file picker is open with multiple files
    When the user types "main" in the search field
    Then only files containing "main" in their name are displayed
    And non-matching files are hidden
```

### E2E-UI-07: File Selection Inserts Badge

```gherkin
Feature: File Selection
  Scenario: Selecting file inserts context badge
    Given the file picker is open
    When the user clicks on "src/app.ts"
    Then a badge "#File: src/app.ts" appears in the input field
    And the Context Menu closes
    And the badge is styled as a non-editable inline chip
```

### E2E-UI-08: Multi-File Selection

```gherkin
Feature: Multi-File Selection
  Scenario: Ctrl+click selects multiple files
    Given the file picker is open
    When the user Ctrl+clicks "file1.ts", "file2.ts", and "file3.ts"
    Then 3 badges are inserted into the input
    And the Context Menu closes
```

### E2E-UI-09: Spec Selection

```gherkin
Feature: Spec Context Selection
  Scenario: Selecting spec inserts badge
    Given the Context Menu is open
    When the user selects "Spec"
    Then a spec picker shows available specs
    When the user selects "chatbox-ui"
    Then a badge "#Spec: chatbox-ui" is inserted
    And the Context Menu closes
```

### E2E-UI-10: Git Diff Instant

```gherkin
Feature: Git Diff Context
  Scenario: Git Diff instantly inserts badge
    Given the Context Menu is open
    When the user selects "Git Diff"
    Then a badge "#Git Diff" is immediately inserted
    And the Context Menu closes without showing a secondary picker
```

### E2E-UI-11: Terminal Instant

```gherkin
Feature: Terminal Context
  Scenario: Terminal instantly inserts badge
    Given the Context Menu is open
    When the user selects "Terminal"
    Then a badge "#Terminal" is immediately inserted
    And the Context Menu closes
```

### E2E-UI-12: Problems Instant

```gherkin
Feature: Problems Context
  Scenario: Problems instantly inserts badge
    Given the Context Menu is open
    When the user selects "Problems"
    Then a badge "#Problems" is immediately inserted
    And the Context Menu closes
```

### E2E-UI-13: Folder Selection

```gherkin
Feature: Folder Context
  Scenario: Folder picker and selection
    Given the Context Menu is open
    When the user selects "Folder"
    Then a folder picker shows workspace directories only
    When the user selects "src/components"
    Then a badge "#Folder: src/components" is inserted
    And the Context Menu closes
```

### E2E-UI-14: Current File Instant

```gherkin
Feature: Current File Context
  Scenario: Current File inserts badge with filename
    Given the Context Menu is open
    And "index.ts" is the currently active file in the editor
    When the user selects "Current File"
    Then a badge "#Current File: index.ts" is inserted
    And the Context Menu closes
```

### E2E-UI-15: Steering Selection

```gherkin
Feature: Steering Context
  Scenario: Steering picker and selection
    Given the Context Menu is open
    When the user selects "Steering"
    Then a picker shows steering filenames without path or extension
    When the user selects "sm-core"
    Then a badge "#Steering: sm-core" is inserted
    And the Context Menu closes
```

### E2E-UI-16: MCP Sublabel Visible

```gherkin
Feature: MCP Display
  Scenario: MCP shows sublabel
    Given the Context Menu is open
    Then the "MCP" item displays "Model Context Protocol" as secondary text on the right
```

### E2E-UI-17: MCP Resource Selection

```gherkin
Feature: MCP Resource Selection
  Scenario: MCP picker and resource selection
    Given the Context Menu is open
    When the user selects "MCP"
    Then a secondary panel lists available MCP resources
    When the user selects "code_search"
    Then a badge "#MCP: code_search" is inserted
    And the Context Menu closes
```

### E2E-UI-18: Badge Displayed as Chip

```gherkin
Feature: Badge Visual
  Scenario: Badge renders as non-editable chip
    Given a badge "#File: app.ts" has been inserted
    Then the badge appears as an inline chip element
    And the badge is not text-editable
    And the badge shows an icon, label, and close (X) button
```

### E2E-UI-19: Badge Remove via Backspace

```gherkin
Feature: Badge Removal
  Scenario: Backspace removes adjacent badge
    Given a badge "#Git Diff" exists in the input
    And the text cursor is positioned immediately after the badge
    When the user presses Backspace
    Then the badge is removed from the input
```

### E2E-UI-20: Performance 100ms Popup

```gherkin
Feature: Performance
  Scenario: Menu appears within performance budget
    Given the Input Area is focused
    When the user types "#"
    Then the Context Menu becomes visible within 150ms
```

### E2E-UI-21: Keyboard-Only Flow

```gherkin
Feature: Accessibility Keyboard
  Scenario: Complete context attachment without mouse
    Given the user uses keyboard only (no mouse)
    When the user presses Tab to focus the input
    And types "#"
    Then the Context Menu opens
    When the user presses ArrowDown twice and Enter
    Then the selected context badge is inserted
    And focus returns to the input field
```

### E2E-UI-22: Click Outside Dismisses

```gherkin
Feature: Click Outside
  Scenario: Clicking outside closes menu
    Given the Context Menu is open
    When the user clicks on an area outside the Context Menu popup
    Then the Context Menu closes
    And no badge is inserted
```

### E2E-UI-23: Filter Narrows Items

```gherkin
Feature: Fuzzy Filter UI
  Scenario: Typing after hash narrows items
    Given the Context Menu is open showing all 9 items
    When the user types "fi" (after the "#")
    Then only items matching "fi" are displayed (Files, Current File)
    And non-matching items are hidden
```

### E2E-UI-24: Multiple Badges Coexist

```gherkin
Feature: Multiple Badges
  Scenario: Multiple context badges in same message
    Given the user inserts "#Git Diff" badge
    And the user types "#" again to open the menu
    And selects "Problems"
    Then both "#Git Diff" and "#Problems" badges are visible in the input
```

---

## 6. System Integration Testing (SIT) — 8 Cases

| ID | Test Case | Method | Steps | Expected Result | Pass Criteria |
|----|-----------|--------|-------|-----------------|---------------|
| SIT-01 | Screen reader navigation | Manual (NVDA) | 1. Focus input 2. Type "#" 3. Listen to NVDA 4. ArrowDown 5. Enter | Announces "Context sources listbox", reads item labels | All announced correctly |
| SIT-02 | Touch target measurement | Manual + DevTools | 1. Open in VS Code 2. Inspect all menu items 3. Measure dimensions | All interactive >= 44x44px | No element below 44px |
| SIT-03 | Dark theme colors | Manual compare | 1. Open menu 2. Screenshot 3. Compare bg=#2d2d3d, border=#3d3d5c | Colors match spec | Within +/-10 hex |
| SIT-04 | Animation smoothness | Manual 60fps | 1. Type "#" 10x rapidly 2. Observe animation | Smooth fadeIn, no stutter | No dropped frames visible |
| SIT-05 | High contrast mode | Manual | 1. Enable HC mode 2. Open menu 3. Check readability | All text/icons visible | >= 7:1 contrast |
| SIT-06 | Real VS Code test | Manual | 1. F5 Extension Dev Host 2. Open webview 3. Full "#" flow | Works end-to-end | No console errors |
| SIT-07 | DPI 150%/200% | Manual | 1. Change DPI 2. Reopen VS Code 3. Test menu | No overflow/clipping | Properly scaled |
| SIT-08 | Perceived speed | Manual | 1. Type "#" normally 2. Rate responsiveness | Feels instant | < 200ms perceived |

---

## 7. Test Data Files

| File | Content | Format |
|------|---------|--------|
| menu-items.csv | 9 context menu items with id, label, icon, type | CSV |
| fuzzy-filter-inputs.csv | 30 filter test cases: query, items, expected_matches | CSV |
| file-tree-mock.csv | Mock workspace file tree (100 entries) | CSV |
| badge-scenarios.csv | 20 badge insert/remove scenarios | CSV |
| postmessage-protocol.csv | 18 request/response pairs for E2E-API | CSV |
| state-transitions.csv | All 13 valid state transitions | CSV |
