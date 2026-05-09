# Software Test Cases (STC)

## Kiro SDLC Agents Extension — KSA-2: Extension Core — Commands & Activation

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-2 |
| Title | Extension Core — Commands & Activation |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-01-20 |
| Status | Draft |
| Related STP | documents/KSA-2/STP.md |
| Related FSD | documents/KSA-2/FSD.md |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-20 | QA Agent | Initiate document — auto-generated from FSD use cases and business rules |

---

## Test Case Summary

| Category | ID Range | Count | Priority |
|----------|----------|-------|----------|
| Functional — Happy Path | TC-001 to TC-005 | 5 | High |
| Functional — Alternative Flows | TC-100 to TC-109 | 10 | High |
| Functional — Exception/Error Flows | TC-200 to TC-205 | 6 | High |
| Business Rule Validation | TC-300 to TC-311 | 12 | High |
| Boundary & Negative Testing | TC-400 to TC-403 | 4 | Medium |
| UI/UX Testing (Status Bar) | TC-500 to TC-502 | 3 | Medium |
| Non-Functional (Performance) | TC-600 to TC-602 | 3 | Medium |
| Integration Testing | TC-700 to TC-703 | 4 | High |

**Total: 47 test cases**

---

## Test Level Classification

| Prefix | Level | Count |
|--------|-------|-------|
| UT-xx | Unit Test (vitest + vscode mock) | 20 |
| IT-xx | Integration Test (@vscode/test-electron) | 12 |
| SIT-xx | Manual System Integration Test | 8 |

---

## 1. Functional Test Cases — Happy Path

### TC-001: Extension activates on VS Code startup

| Field | Value |
|-------|-------|
| **ID** | TC-001 |
| **Level** | IT-01 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-1, BR-1, Story 1 |
| **Preconditions** | Extension is installed and enabled in VS Code ^1.85.0 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Launch VS Code with a workspace folder open | Extension activates automatically |
| 2 | Open Command Palette (Ctrl+Shift+P) | Command Palette opens |
| 3 | Type "Kiro SDLC" | All 5 commands appear in the filtered list |

**Test Data:** Any workspace folder with at least one file
**Postconditions:** Extension is active, all commands registered, status bar visible

---

### TC-002: Inject All — happy path with confirmation

| Field | Value |
|-------|-------|
| **ID** | TC-002 |
| **Level** | IT-02 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-2a, BR-8, Story 2 |
| **Preconditions** | Extension activated, workspace folder open, extension bundle has `/resources/` |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Command Palette, select "Kiro SDLC: Inject All Agents" | Confirmation dialog appears: "Inject all SDLC agents, steering, hooks, templates, and indexer into this workspace?" |
| 2 | Click "Yes" | QuickPick appears for indexer language selection |
| 3 | Select "Python Indexer" | Injection proceeds |
| 4 | Wait for completion | Success message: "✅ Injected N components: agents, steering, hooks, templates, indexer-python" |
| 5 | Check workspace file system | `.kiro/agents/`, `.kiro/steering/`, `.kiro/hooks/`, `documents/templates/`, `.analysis/code-intelligence/scripts/python/` all exist |

**Test Data:** Empty workspace folder, extension bundle with all resources
**Postconditions:** All SDLC components present in workspace

---

### TC-003: Inject Selective — pick subset of components

| Field | Value |
|-------|-------|
| **ID** | TC-003 |
| **Level** | IT-03 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-2b, BR-10, Story 2 |
| **Preconditions** | Extension activated, workspace folder open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Command Palette, select "Kiro SDLC: Inject (Select Components)" | Multi-select QuickPick appears with all components pre-selected |
| 2 | Uncheck "Hooks" and "Code Intelligence Indexer", confirm | Only agents, steering, templates are injected |
| 3 | Wait for completion | Success message: "✅ Injected: agents, steering, templates" |
| 4 | Check workspace | `.kiro/agents/`, `.kiro/steering/`, `documents/templates/` exist; `.kiro/hooks/` does NOT exist |

**Test Data:** Empty workspace folder
**Postconditions:** Only selected components present

---

### TC-004: Run Code Indexer — successful execution

| Field | Value |
|-------|-------|
| **ID** | TC-004 |
| **Level** | IT-04 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-2c, BR-11, Story 2 |
| **Preconditions** | Extension activated, workspace with indexer scripts present, Python installed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Command Palette, select "Kiro SDLC: Run Code Indexer" | Output Channel "Kiro Code Indexer" opens |
| 2 | Observe Output Channel | Shows "[Kiro] Running Python indexer..." and command being executed |
| 3 | Wait for indexer to complete | Output shows "[Kiro] ✅ Indexing complete!" |
| 4 | Check notification | Information message: "Code indexing complete!" |

**Test Data:** Workspace with `.analysis/code-intelligence/scripts/python/` and source files to index
**Postconditions:** Index files generated in `.analysis/code-intelligence/`

---

### TC-005: Show Status — all components present

| Field | Value |
|-------|-------|
| **ID** | TC-005 |
| **Level** | IT-05 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-2e, Story 2 |
| **Preconditions** | Extension activated, all SDLC components injected in workspace |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Command Palette, select "Kiro SDLC: Show Status" | Information message appears with status lines |
| 2 | Read status content | All components show "✅": agents, steering, hooks, templates, indexer |
| 3 | Verify buttons | "Inject Missing" and "Close" buttons are present |

**Test Data:** Workspace with all components present
**Postconditions:** No changes to workspace

---

## 2. Functional Test Cases — Alternative Flows

### TC-100: Inject All — user cancels confirmation dialog

| Field | Value |
|-------|-------|
| **ID** | TC-100 |
| **Level** | UT-01 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-2a AF-2a-1, BR-20 |
| **Preconditions** | Extension activated, workspace open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `kiroSdlc.injectAll` command | Confirmation dialog appears |
| 2 | Click "Cancel" | Dialog closes, no files modified |
| 3 | Check workspace file system | No new files or folders created |

**Test Data:** Empty workspace
**Postconditions:** Workspace unchanged

---

### TC-101: Inject All — user dismisses indexer QuickPick

| Field | Value |
|-------|-------|
| **ID** | TC-101 |
| **Level** | UT-02 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-2a AF-2a-2 |
| **Preconditions** | Extension activated, workspace open, user confirmed "Yes" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `kiroSdlc.injectAll`, click "Yes" | QuickPick for indexer language appears |
| 2 | Press Escape to dismiss QuickPick | Indexer not injected |
| 3 | Check success message | Shows injected core components only (no indexer) |
| 4 | Check workspace | Core components present, no indexer scripts |

**Test Data:** Empty workspace
**Postconditions:** Core components injected, indexer skipped

---

### TC-102: Inject All — autoIndex disabled

| Field | Value |
|-------|-------|
| **ID** | TC-102 |
| **Level** | UT-03 |
| **Priority** | Medium |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-2a AF-2a-3, BR-12 |
| **Preconditions** | `kiroSdlc.autoIndex` set to `false`, workspace open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set `kiroSdlc.autoIndex` to `false` in settings | Setting saved |
| 2 | Invoke `kiroSdlc.injectAll`, confirm "Yes", select indexer | Injection completes |
| 3 | Check Output Channel | No "Kiro Code Indexer" output channel created — indexer NOT auto-run |

**Test Data:** Empty workspace, autoIndex=false
**Postconditions:** Components injected, indexer NOT executed

---

### TC-103: Inject Selective — user cancels QuickPick

| Field | Value |
|-------|-------|
| **ID** | TC-103 |
| **Level** | UT-04 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-2b AF-2b-1 |
| **Preconditions** | Extension activated, workspace open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `kiroSdlc.injectSelective` | Multi-select QuickPick appears |
| 2 | Press Escape | QuickPick dismissed |
| 3 | Check for messages | No success/error message shown |
| 4 | Check workspace | No files modified |

**Test Data:** Empty workspace
**Postconditions:** Workspace unchanged

---

### TC-104: Inject Selective — empty selection

| Field | Value |
|-------|-------|
| **ID** | TC-104 |
| **Level** | UT-05 |
| **Priority** | Medium |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-2b AF-2b-2 |
| **Preconditions** | Extension activated, workspace open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `kiroSdlc.injectSelective` | Multi-select QuickPick appears |
| 2 | Uncheck all items, confirm | Returns empty array |
| 3 | Check for messages | No success message shown |

**Test Data:** Empty workspace
**Postconditions:** Workspace unchanged

---

### TC-105: Run Indexer — preferred indexer configured (not auto)

| Field | Value |
|-------|-------|
| **ID** | TC-105 |
| **Level** | UT-06 |
| **Priority** | Medium |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-2c AF-2c-1 |
| **Preconditions** | `kiroSdlc.preferredIndexer` set to "python", Python installed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set `kiroSdlc.preferredIndexer` to "python" | Setting saved |
| 2 | Invoke `kiroSdlc.runIndex` | Skips auto-detection, uses Python directly |
| 3 | Check Output Channel | Shows "[Kiro] Running Python indexer..." |

**Test Data:** Workspace with indexer scripts
**Postconditions:** Indexer runs with configured runtime

---

### TC-106: Update — user cancels warning dialog

| Field | Value |
|-------|-------|
| **ID** | TC-106 |
| **Level** | UT-07 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-2d AF-2d-1, BR-20 |
| **Preconditions** | Extension activated, workspace open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `kiroSdlc.update` | Warning dialog appears |
| 2 | Click "Cancel" | Dialog closes |
| 3 | Check workspace | No files modified or overwritten |

**Test Data:** Workspace with existing components
**Postconditions:** Workspace unchanged

---

### TC-107: Show Status — user clicks "Close"

| Field | Value |
|-------|-------|
| **ID** | TC-107 |
| **Level** | UT-08 |
| **Priority** | Low |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-2e AF-2e-1 |
| **Preconditions** | Extension activated, workspace open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `kiroSdlc.status` | Status message appears |
| 2 | Click "Close" | Dialog dismissed, no action taken |

**Test Data:** Any workspace
**Postconditions:** No changes

---

### TC-108: Show Status — click "Inject Missing"

| Field | Value |
|-------|-------|
| **ID** | TC-108 |
| **Level** | IT-06 |
| **Priority** | Medium |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-2e Step 6-7 |
| **Preconditions** | Extension activated, workspace with some components missing |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `kiroSdlc.status` | Status shows mix of ✅ and ❌ |
| 2 | Click "Inject Missing" | `kiroSdlc.injectSelective` command is triggered |
| 3 | Verify QuickPick appears | Multi-select component picker shown |

**Test Data:** Workspace with agents and steering present, hooks and templates missing
**Postconditions:** injectSelective flow initiated

---

### TC-109: Status bar click triggers status command

| Field | Value |
|-------|-------|
| **ID** | TC-109 |
| **Level** | IT-07 |
| **Priority** | Medium |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-3 AF-3-1, BR-15 |
| **Preconditions** | Extension activated, status bar visible |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the SDLC status bar item | `kiroSdlc.status` command executes |
| 2 | Verify status dialog appears | Status information message shown |

**Test Data:** Any workspace
**Postconditions:** Status dialog displayed

---

## 3. Functional Test Cases — Exception/Error Flows

### TC-200: Command invoked with no workspace open

| Field | Value |
|-------|-------|
| **ID** | TC-200 |
| **Level** | UT-09 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | EF-2a-1, BR-5 |
| **Preconditions** | Extension activated, NO workspace folder open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `kiroSdlc.injectAll` | Error message: "No workspace folder open." |
| 2 | Invoke `kiroSdlc.injectSelective` | Error message: "No workspace folder open." |
| 3 | Invoke `kiroSdlc.runIndex` | Error message: "No workspace folder open." |
| 4 | Invoke `kiroSdlc.update` | Error message: "No workspace folder open." |
| 5 | Invoke `kiroSdlc.status` | Error message: "No workspace folder open." |

**Test Data:** VS Code opened without any folder
**Postconditions:** No crash, extension remains active

---

### TC-201: Source resource not found during injection

| Field | Value |
|-------|-------|
| **ID** | TC-201 |
| **Level** | UT-10 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | EF-2a-2 |
| **Preconditions** | Extension activated, workspace open, one resource path missing from bundle |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Remove `.kiro/agents` from extension bundle `/resources/` | Resource missing |
| 2 | Invoke `kiroSdlc.injectAll`, confirm "Yes" | Warning: "Source not found: .kiro/agents" |
| 3 | Check remaining components | Other components (steering, hooks, templates) still injected successfully |

**Test Data:** Extension bundle with one resource directory removed
**Postconditions:** Partial injection — missing component skipped, others present

---

### TC-202: File copy permission error

| Field | Value |
|-------|-------|
| **ID** | TC-202 |
| **Level** | UT-11 |
| **Priority** | Medium |
| **Type** | Functional — Exception Flow |
| **Requirement** | EF-2a-3 |
| **Preconditions** | Extension activated, workspace open, target directory is read-only |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set workspace `.kiro/` directory to read-only | Permission restricted |
| 2 | Invoke `kiroSdlc.injectAll`, confirm "Yes" | Error: "Failed to inject agents: EACCES: permission denied" |
| 3 | Check other components | Components targeting other paths still injected |

**Test Data:** Workspace with read-only `.kiro/` directory
**Postconditions:** Partial injection, error reported for failed component

---

### TC-203: No compatible runtime for indexer

| Field | Value |
|-------|-------|
| **ID** | TC-203 |
| **Level** | UT-12 |
| **Priority** | Medium |
| **Type** | Functional — Exception Flow |
| **Requirement** | EF-2c-1 |
| **Preconditions** | Extension activated, workspace open, no Python/Java/Node.js installed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock all runtime checks to fail | No runtime available |
| 2 | Invoke `kiroSdlc.runIndex` | Warning: "No compatible runtime found. Install Python, Java, or Node.js." |

**Test Data:** System with no supported runtimes (mocked in UT)
**Postconditions:** No indexer executed, warning shown

---

### TC-204: Indexer execution fails

| Field | Value |
|-------|-------|
| **ID** | TC-204 |
| **Level** | UT-13 |
| **Priority** | Medium |
| **Type** | Functional — Exception Flow |
| **Requirement** | EF-2c-2 |
| **Preconditions** | Extension activated, workspace open, indexer script has syntax error |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `kiroSdlc.runIndex` with broken indexer script | Indexer starts execution |
| 2 | Wait for failure | Error: "Indexer failed: {error message}" |
| 3 | Check Output Channel | Full error details logged in "Kiro Code Indexer" channel |

**Test Data:** Workspace with intentionally broken indexer script
**Postconditions:** Error reported, extension remains functional

---

### TC-205: Indexer exceeds 120s timeout

| Field | Value |
|-------|-------|
| **ID** | TC-205 |
| **Level** | UT-14 |
| **Priority** | Low |
| **Type** | Functional — Exception Flow |
| **Requirement** | EF-2c-3 |
| **Preconditions** | Extension activated, workspace open, indexer script hangs indefinitely |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock `child_process.exec` to simulate timeout after 120s | Timeout triggered |
| 2 | Verify error handling | Error message shown to user |
| 3 | Verify process killed | Child process terminated |

**Test Data:** Mocked hanging process
**Postconditions:** Process killed, error reported

---

## 4. Business Rule Validation

### TC-300: BR-1 — Extension activates without user action

| Field | Value |
|-------|-------|
| **ID** | TC-300 |
| **Level** | IT-08 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-1 |
| **Preconditions** | Extension installed, VS Code starting |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start VS Code with extension installed | Extension activates automatically |
| 2 | Verify `activate()` was called | No manual trigger needed |
| 3 | Verify `activationEvents: []` in package.json | Empty array confirms startup activation |

**Test Data:** package.json with `"activationEvents": []`

---

### TC-301: BR-3 — No errors when no workspace open

| Field | Value |
|-------|-------|
| **ID** | TC-301 |
| **Level** | UT-15 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-3 |
| **Preconditions** | VS Code opened without workspace folder |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Launch VS Code without opening a folder | Extension activates without throwing |
| 2 | Check Extension Host log | No errors or exceptions logged |
| 3 | Verify status bar | Shows `$(circle-slash) SDLC` with tooltip "No workspace open" |

**Test Data:** No workspace folder
**Postconditions:** Extension active, graceful degradation

---

### TC-302: BR-4 — All disposables pushed to context.subscriptions

| Field | Value |
|-------|-------|
| **ID** | TC-302 |
| **Level** | UT-16 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-4 |
| **Preconditions** | Extension activating |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock `context.subscriptions` array | Array available |
| 2 | Call `activate(context)` | Function completes |
| 3 | Check `context.subscriptions.length` | Contains 6 items (1 status bar + 5 commands) |

**Test Data:** Mocked ExtensionContext
**Postconditions:** All disposables registered for cleanup

---

### TC-303: BR-5 — All commands check workspace root

| Field | Value |
|-------|-------|
| **ID** | TC-303 |
| **Level** | UT-17 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-5 |
| **Preconditions** | Extension activated, no workspace open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock `vscode.workspace.workspaceFolders` as `undefined` | No workspace |
| 2 | Call each handler function | Each shows "No workspace folder open." error |
| 3 | Verify no further processing | Handlers return early after error |

**Test Data:** Mocked empty workspaceFolders

---

### TC-304: BR-6 — Command IDs follow pattern kiroSdlc.{action}

| Field | Value |
|-------|-------|
| **ID** | TC-304 |
| **Level** | UT-18 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-6 |
| **Preconditions** | Extension source code available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Read registered command IDs from `activate()` | 5 command IDs extracted |
| 2 | Verify each matches pattern `kiroSdlc.{action}` | All match: injectAll, injectSelective, runIndex, update, status |

**Test Data:** Source code inspection / runtime verification

---

### TC-305: BR-8 — injectAll shows confirmation before modifying workspace

| Field | Value |
|-------|-------|
| **ID** | TC-305 |
| **Level** | UT-19 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-8, BR-18 |
| **Preconditions** | Extension activated, workspace open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `handleInjectAll()` | `showInformationMessage` called (not showWarningMessage) |
| 2 | Verify message text | Contains "Inject all SDLC agents, steering, hooks, templates, and indexer into this workspace?" |
| 3 | Verify buttons | "Yes" and "Cancel" options provided |

**Test Data:** Mocked VS Code Window API

---

### TC-306: BR-9 — update shows WARNING-level confirmation

| Field | Value |
|-------|-------|
| **ID** | TC-306 |
| **Level** | UT-20 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-9, BR-19 |
| **Preconditions** | Extension activated, workspace open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `handleUpdate()` | `showWarningMessage` called (elevated severity) |
| 2 | Verify message text | Contains "Update will overwrite agents/steering/templates. Custom modifications in these folders will be lost. Continue?" |
| 3 | Verify buttons | "Update" and "Cancel" options provided |

**Test Data:** Mocked VS Code Window API

---

### TC-307: BR-13 — Status bar right-aligned with priority 100

| Field | Value |
|-------|-------|
| **ID** | TC-307 |
| **Level** | IT-09 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-13 |
| **Preconditions** | Extension activating |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify `createStatusBarItem` call parameters | Alignment = `StatusBarAlignment.Right`, Priority = `100` |
| 2 | Verify status bar item is shown | `item.show()` called |

**Test Data:** Mocked VS Code Window API

---

### TC-308: BR-14 — Status bar uses correct codicon icons

| Field | Value |
|-------|-------|
| **ID** | TC-308 |
| **Level** | IT-10 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-14 |
| **Preconditions** | Extension activated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | All components present | Status bar text = `$(check) SDLC Agents` |
| 2 | Some components missing | Status bar text = `$(warning) SDLC Agents` |
| 3 | No workspace open | Status bar text = `$(circle-slash) SDLC` |

**Test Data:** Three workspace states (full, partial, none)

---

### TC-309: BR-16 — Status check uses synchronous fs.existsSync

| Field | Value |
|-------|-------|
| **ID** | TC-309 |
| **Level** | UT-21 (code review) |
| **Priority** | Medium |
| **Type** | Business Rule |
| **Requirement** | BR-16 |
| **Preconditions** | Source code available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Review `checkStatus()` function in injector.ts | Uses `fs.existsSync()` — synchronous |
| 2 | Verify no `await` or Promise in status check | Function is synchronous |

**Test Data:** Code review of injector.ts

---

### TC-310: BR-20 — Dismissing dialog aborts operation

| Field | Value |
|-------|-------|
| **ID** | TC-310 |
| **Level** | UT-22 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-20 |
| **Preconditions** | Extension activated, workspace open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock `showInformationMessage` to return `undefined` (dialog dismissed) | Simulates Escape key |
| 2 | Invoke `handleInjectAll()` | Handler returns early |
| 3 | Verify `injectAll()` NOT called | No file operations performed |

**Test Data:** Mocked dialog returning undefined

---

### TC-311: BR-21 — Success message shown after operation

| Field | Value |
|-------|-------|
| **ID** | TC-311 |
| **Level** | IT-11 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-21 |
| **Preconditions** | Extension activated, workspace open, injection succeeds |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Complete `injectAll` successfully | `showInformationMessage` called |
| 2 | Verify message content | Contains "✅ Injected" and component count |
| 3 | Complete `update` successfully | `showInformationMessage` called with "✅ Updated" |

**Test Data:** Successful injection mock

---

## 5. Boundary & Negative Testing

### TC-400: Multiple workspace folders — uses first folder only

| Field | Value |
|-------|-------|
| **ID** | TC-400 |
| **Level** | UT-23 |
| **Priority** | Medium |
| **Type** | Boundary |
| **Requirement** | FSD Section 6.1 (getWorkspaceRoot uses workspaceFolders[0]) |
| **Preconditions** | VS Code opened with multi-root workspace (2+ folders) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open multi-root workspace with folders: `/project-a`, `/project-b` | Both folders in workspace |
| 2 | Invoke `kiroSdlc.injectAll`, confirm | Injection targets `/project-a` (first folder) |
| 3 | Check `/project-b` | No SDLC files injected into second folder |

**Test Data:** Multi-root workspace with 2 folders

---

### TC-401: Workspace folder with special characters in path

| Field | Value |
|-------|-------|
| **ID** | TC-401 |
| **Level** | UT-24 |
| **Priority** | Medium |
| **Type** | Boundary |
| **Requirement** | File system safety |
| **Preconditions** | Workspace folder path contains spaces and special chars |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open workspace at path `C:\My Projects\test (v2)\workspace` | Workspace opens |
| 2 | Invoke `kiroSdlc.injectAll`, confirm | Injection succeeds |
| 3 | Verify files at target path | All components present at correct paths |

**Test Data:** Workspace path: `C:\My Projects\test (v2)\workspace`

---

### TC-402: shouldSkipDir — skips dangerous directories

| Field | Value |
|-------|-------|
| **ID** | TC-402 |
| **Level** | UT-25 |
| **Priority** | Medium |
| **Type** | Negative |
| **Requirement** | TDD Section 7.2 (File System Safety) |
| **Preconditions** | Source resource contains node_modules, .git directories |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `copyDirRecursive` on source with `node_modules/` subfolder | Copy proceeds |
| 2 | Check target directory | `node_modules/` NOT copied |
| 3 | Verify skip list | `node_modules`, `__pycache__`, `out`, `dist`, `.git` all skipped |

**Test Data:** Source directory containing all skip-listed subdirectories

---

### TC-403: Empty workspaceFolders array (edge case)

| Field | Value |
|-------|-------|
| **ID** | TC-403 |
| **Level** | UT-26 |
| **Priority** | Medium |
| **Type** | Boundary |
| **Requirement** | BR-5 |
| **Preconditions** | `vscode.workspace.workspaceFolders` is empty array `[]` |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock `workspaceFolders` as `[]` (empty array, not undefined) | Edge case |
| 2 | Invoke any command | Error: "No workspace folder open." |
| 3 | Verify no crash | Extension remains functional |

**Test Data:** Mocked empty array for workspaceFolders

---

## 6. UI/UX Testing (Status Bar)

### TC-500: Status bar — all components present state

| Field | Value |
|-------|-------|
| **ID** | TC-500 |
| **Level** | SIT-01 |
| **Priority** | High |
| **Type** | UI/UX |
| **Requirement** | UC-3, BR-14, FSD 3.3.4 |
| **Preconditions** | Extension activated, all SDLC components present in workspace |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Look at VS Code status bar (bottom-right area) | Status bar item visible |
| 2 | Verify icon and text | Shows `$(check) SDLC Agents` (check mark icon) |
| 3 | Hover over status bar item | Tooltip: "All SDLC components active" |
| 4 | Click the status bar item | Status command executes, shows all ✅ |

**Test Data:** Workspace with all components injected

---

### TC-501: Status bar — some components missing state

| Field | Value |
|-------|-------|
| **ID** | TC-501 |
| **Level** | SIT-02 |
| **Priority** | High |
| **Type** | UI/UX |
| **Requirement** | UC-3, BR-14, FSD 3.3.4 |
| **Preconditions** | Extension activated, some SDLC components missing from workspace |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Delete `.kiro/hooks/` directory from workspace | Component removed |
| 2 | Reload VS Code window (Ctrl+Shift+P → "Reload Window") | Extension re-activates |
| 3 | Check status bar | Shows `$(warning) SDLC Agents` (warning icon) |
| 4 | Hover over status bar item | Tooltip: "Some components missing — click to check" |

**Test Data:** Workspace with `.kiro/hooks/` deleted

---

### TC-502: Status bar — no workspace open state

| Field | Value |
|-------|-------|
| **ID** | TC-502 |
| **Level** | SIT-03 |
| **Priority** | Medium |
| **Type** | UI/UX |
| **Requirement** | UC-3, BR-14, FSD 3.3.4 |
| **Preconditions** | VS Code opened without any workspace folder |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open VS Code without a folder (File → New Window) | Empty editor |
| 2 | Check status bar | Shows `$(circle-slash) SDLC` (circle-slash icon) |
| 3 | Hover over status bar item | Tooltip: "No workspace open" |

**Test Data:** VS Code with no folder open

---

## 7. Non-Functional Testing

### TC-600: Activation performance — completes in < 100ms

| Field | Value |
|-------|-------|
| **ID** | TC-600 |
| **Level** | IT-12 |
| **Priority** | High |
| **Type** | Non-Functional — Performance |
| **Requirement** | FSD Section 8, BRD NFR |
| **Preconditions** | Extension installed, VS Code starting |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Instrument `activate()` with `performance.now()` before and after | Timing captured |
| 2 | Launch VS Code with workspace | Extension activates |
| 3 | Check elapsed time | Activation completes in < 100ms |
| 4 | Verify no async I/O in activate path | Only synchronous operations (registerCommand, createStatusBarItem, existsSync) |

**Acceptance Criteria:** `activate()` execution time < 100ms

---

### TC-601: Command response time — dialog appears within 2s

| Field | Value |
|-------|-------|
| **ID** | TC-601 |
| **Level** | SIT-04 |
| **Priority** | Medium |
| **Type** | Non-Functional — Performance |
| **Requirement** | FSD Section 8, BRD NFR |
| **Preconditions** | Extension activated, workspace open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `kiroSdlc.injectAll` from Command Palette | Start timer |
| 2 | Observe confirmation dialog | Dialog appears within 2 seconds |
| 3 | Invoke `kiroSdlc.status` | Status message appears within 2 seconds |

**Acceptance Criteria:** User sees dialog/result within 2 seconds of command invocation

---

### TC-602: Indexer timeout — process killed after 120s

| Field | Value |
|-------|-------|
| **ID** | TC-602 |
| **Level** | SIT-05 |
| **Priority** | Low |
| **Type** | Non-Functional — Reliability |
| **Requirement** | FSD Section 8 (Indexer timeout), TDD Section 8.3 |
| **Preconditions** | Extension activated, workspace with indexer that hangs |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create an indexer script that runs `sleep 300` (or equivalent infinite loop) | Hanging script |
| 2 | Invoke `kiroSdlc.runIndex` | Indexer starts |
| 3 | Wait 120 seconds | Process killed by timeout |
| 4 | Verify error message | "Indexer failed: Command timed out" or similar |

**Acceptance Criteria:** Indexer process terminated after 120 seconds, error reported

---

## 8. Integration Testing

### TC-700: Full inject lifecycle — inject, verify status, update

| Field | Value |
|-------|-------|
| **ID** | TC-700 |
| **Level** | SIT-06 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | UC-2a + UC-2e + UC-2d (end-to-end flow) |
| **Preconditions** | Extension activated, empty workspace |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `kiroSdlc.status` | All components show ❌ |
| 2 | Invoke `kiroSdlc.injectAll`, confirm, select Python indexer | All components injected |
| 3 | Invoke `kiroSdlc.status` | All components show ✅ |
| 4 | Delete `.kiro/hooks/` manually | Component removed |
| 5 | Invoke `kiroSdlc.status` | hooks shows ❌, others ✅ |
| 6 | Invoke `kiroSdlc.update`, confirm | All components re-injected |
| 7 | Invoke `kiroSdlc.status` | All components show ✅ again |

**Test Data:** Empty workspace → full lifecycle
**Postconditions:** All components present after update

---

### TC-701: Inject + auto-index integration

| Field | Value |
|-------|-------|
| **ID** | TC-701 |
| **Level** | SIT-07 |
| **Priority** | Medium |
| **Type** | Integration |
| **Requirement** | BR-12, UC-2a Step 10 |
| **Preconditions** | `kiroSdlc.autoIndex` = true, Python installed, workspace with source files |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `kiroSdlc.injectAll`, confirm, select Python indexer | Injection completes |
| 2 | Observe Output Channel | "Kiro Code Indexer" channel opens automatically |
| 3 | Wait for indexer | "[Kiro] ✅ Indexing complete!" appears |
| 4 | Check `.analysis/code-intelligence/` | `project-structure.md` and `modules/` generated |

**Test Data:** Workspace with TypeScript source files
**Postconditions:** Index files generated automatically after injection

---

### TC-702: Extension activation with VS Code Extension Test framework

| Field | Value |
|-------|-------|
| **ID** | TC-702 |
| **Level** | IT-12 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | UC-1, TDD Section 2.1 |
| **Preconditions** | @vscode/test-electron configured, test workspace prepared |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Launch VS Code via test-electron with extension | Extension Host starts |
| 2 | Query registered commands | All 5 `kiroSdlc.*` commands present |
| 3 | Execute `kiroSdlc.status` programmatically | Returns without error |

**Test Data:** Test workspace with @vscode/test-electron setup

---

### TC-703: Injector + Config integration — CORE_COMPONENTS mapping

| Field | Value |
|-------|-------|
| **ID** | TC-703 |
| **Level** | SIT-08 |
| **Priority** | Medium |
| **Type** | Integration |
| **Requirement** | TDD Section 4.2, FSD Section 5.2 |
| **Preconditions** | Extension bundle has all resources matching CORE_COMPONENTS paths |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify extension bundle has `resources/.kiro/agents/` | Directory exists |
| 2 | Verify extension bundle has `resources/.kiro/steering/` | Directory exists |
| 3 | Verify extension bundle has `resources/.kiro/hooks/` | Directory exists |
| 4 | Verify extension bundle has `resources/documents/templates/` | Directory exists |
| 5 | Inject all and verify target paths match config | Each component at correct targetPath |

**Test Data:** Extension bundle structure
**Postconditions:** All source→target mappings verified

---

## 9. Requirements Traceability Matrix (RTM)

| Requirement | Source | Test Cases | Status |
|-------------|--------|------------|--------|
| UC-1 (Activation) | FSD 3.1 | TC-001, TC-300, TC-301, TC-302, TC-702 | ✅ Covered |
| UC-2a (Inject All) | FSD 3.2.3 | TC-002, TC-100, TC-101, TC-102, TC-305 | ✅ Covered |
| UC-2b (Inject Selective) | FSD 3.2.4 | TC-003, TC-103, TC-104 | ✅ Covered |
| UC-2c (Run Indexer) | FSD 3.2.5 | TC-004, TC-105, TC-203, TC-204, TC-205 | ✅ Covered |
| UC-2d (Update) | FSD 3.2.6 | TC-106, TC-306, TC-700 | ✅ Covered |
| UC-2e (Show Status) | FSD 3.2.7 | TC-005, TC-107, TC-108, TC-700 | ✅ Covered |
| UC-3 (Status Bar) | FSD 3.3 | TC-109, TC-307, TC-308, TC-500, TC-501, TC-502 | ✅ Covered |
| UC-4 (Confirmation) | FSD 3.4 | TC-100, TC-106, TC-305, TC-306, TC-310 | ✅ Covered |
| BR-1 | FSD 3.1.3 | TC-300 | ✅ Covered |
| BR-2 | FSD 3.1.3 | TC-600 | ✅ Covered |
| BR-3 | FSD 3.1.3 | TC-301, TC-200 | ✅ Covered |
| BR-4 | FSD 3.1.3 | TC-302 | ✅ Covered |
| BR-5 | FSD 3.2.8 | TC-200, TC-303, TC-403 | ✅ Covered |
| BR-6 | FSD 3.2.8 | TC-304 | ✅ Covered |
| BR-8 | FSD 3.2.8 | TC-305 | ✅ Covered |
| BR-9 | FSD 3.2.8 | TC-306 | ✅ Covered |
| BR-10 | FSD 3.2.8 | TC-003, TC-103 | ✅ Covered |
| BR-11 | FSD 3.2.8 | TC-004 | ✅ Covered |
| BR-12 | FSD 3.2.8 | TC-102, TC-701 | ✅ Covered |
| BR-13 | FSD 3.3.3 | TC-307 | ✅ Covered |
| BR-14 | FSD 3.3.3 | TC-308, TC-500, TC-501, TC-502 | ✅ Covered |
| BR-15 | FSD 3.3.3 | TC-109 | ✅ Covered |
| BR-16 | FSD 3.3.3 | TC-309 | ✅ Covered |
| BR-17 | FSD 3.3.3 | TC-302 | ✅ Covered |
| BR-18 | FSD 3.4.3 | TC-305 | ✅ Covered |
| BR-19 | FSD 3.4.3 | TC-306 | ✅ Covered |
| BR-20 | FSD 3.4.3 | TC-310 | ✅ Covered |
| BR-21 | FSD 3.4.3 | TC-311 | ✅ Covered |
| EF-2a-1 | FSD 3.2.3 | TC-200 | ✅ Covered |
| EF-2a-2 | FSD 3.2.3 | TC-201 | ✅ Covered |
| EF-2a-3 | FSD 3.2.3 | TC-202 | ✅ Covered |
| EF-2c-1 | FSD 3.2.5 | TC-203 | ✅ Covered |
| EF-2c-2 | FSD 3.2.5 | TC-204 | ✅ Covered |
| EF-2c-3 | FSD 3.2.5 | TC-205 | ✅ Covered |
| Story 1 (Activation) | BRD 2.3 | TC-001, TC-300, TC-301 | ✅ Covered |
| Story 2 (Commands) | BRD 2.3 | TC-002, TC-003, TC-004, TC-005, TC-304 | ✅ Covered |
| Story 3 (Status Bar) | BRD 2.3 | TC-500, TC-501, TC-502, TC-307, TC-308 | ✅ Covered |
| Story 4 (Confirmation) | BRD 2.3 | TC-305, TC-306, TC-310, TC-311 | ✅ Covered |
| NFR: Activation < 100ms | FSD Section 8 | TC-600 | ✅ Covered |
| NFR: Command response < 2s | FSD Section 8 | TC-601 | ✅ Covered |
| NFR: Indexer timeout 120s | FSD Section 8 | TC-602 | ✅ Covered |

**Coverage Summary:**

| Category | Total | Covered | Coverage % |
|----------|-------|---------|------------|
| Use Cases | 8 | 8 | 100% |
| Business Rules | 19 | 19 | 100% |
| Exception Flows | 6 | 6 | 100% |
| BRD Stories | 4 | 4 | 100% |
| NFR | 3 | 3 | 100% |
| **Overall** | **40** | **40** | **100%** |

---

## 10. Appendix

### Test Level Mapping

| TC ID | Level | Automation |
|-------|-------|------------|
| TC-001 | IT-01 | ✅ Automated (@vscode/test-electron) |
| TC-002 | IT-02 | ✅ Automated |
| TC-003 | IT-03 | ✅ Automated |
| TC-004 | IT-04 | ✅ Automated |
| TC-005 | IT-05 | ✅ Automated |
| TC-100 | UT-01 | ✅ Automated (vitest) |
| TC-101 | UT-02 | ✅ Automated |
| TC-102 | UT-03 | ✅ Automated |
| TC-103 | UT-04 | ✅ Automated |
| TC-104 | UT-05 | ✅ Automated |
| TC-105 | UT-06 | ✅ Automated |
| TC-106 | UT-07 | ✅ Automated |
| TC-107 | UT-08 | ✅ Automated |
| TC-108 | IT-06 | ✅ Automated |
| TC-109 | IT-07 | ✅ Automated |
| TC-200 | UT-09 | ✅ Automated |
| TC-201 | UT-10 | ✅ Automated |
| TC-202 | UT-11 | ✅ Automated |
| TC-203 | UT-12 | ✅ Automated |
| TC-204 | UT-13 | ✅ Automated |
| TC-205 | UT-14 | ✅ Automated |
| TC-300 | IT-08 | ✅ Automated |
| TC-301 | UT-15 | ✅ Automated |
| TC-302 | UT-16 | ✅ Automated |
| TC-303 | UT-17 | ✅ Automated |
| TC-304 | UT-18 | ✅ Automated |
| TC-305 | UT-19 | ✅ Automated |
| TC-306 | UT-20 | ✅ Automated |
| TC-307 | IT-09 | ✅ Automated |
| TC-308 | IT-10 | ✅ Automated |
| TC-309 | UT-21 | ✅ Automated (code review) |
| TC-310 | UT-22 | ✅ Automated |
| TC-311 | IT-11 | ✅ Automated |
| TC-400 | UT-23 | ✅ Automated |
| TC-401 | UT-24 | ✅ Automated |
| TC-402 | UT-25 | ✅ Automated |
| TC-403 | UT-26 | ✅ Automated |
| TC-500 | SIT-01 | ❌ Manual |
| TC-501 | SIT-02 | ❌ Manual |
| TC-502 | SIT-03 | ❌ Manual |
| TC-600 | IT-12 | ✅ Automated |
| TC-601 | SIT-04 | ❌ Manual |
| TC-602 | SIT-05 | ❌ Manual |
| TC-700 | SIT-06 | ❌ Manual |
| TC-701 | SIT-07 | ❌ Manual |
| TC-702 | IT-12 | ✅ Automated |
| TC-703 | SIT-08 | ❌ Manual |

### Environment Configuration

- **VS Code Version:** ^1.85.0
- **Node.js:** 20.x LTS
- **TypeScript:** ^5.4.0
- **Test Framework (UT):** vitest with vscode mock
- **Test Framework (IT):** @vscode/test-electron
- **OS:** Windows 10/11 (primary), macOS/Linux (CI)

---

*End of Document*
