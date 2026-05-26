# Software Test Cases (STC)

## KSA-5: Auto-detect Runtime & Run Indexer

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-5 |
| Title | Auto-detect Runtime & Run Indexer — Test Cases |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-07-10 |
| Status | Draft |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-10 | QA Agent | Initial test cases |

---

## Unit Tests (UT)

### UT-01: detectAvailableIndexer — Python detected first

| Field | Value |
|-------|-------|
| **ID** | UT-01 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-01, BR-01, BR-03 |
| **Preconditions** | `commandExists("python --version")` returns true |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock `commandExists` to return true for "python --version" | — |
| 2 | Call `detectAvailableIndexer()` | Returns "python" |
| 3 | Verify no further probes executed | Only 1 call to `commandExists` |

---

### UT-02: detectAvailableIndexer — Skips Python, detects Java

| Field | Value |
|-------|-------|
| **ID** | UT-02 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-01, BR-01, BR-03 |
| **Preconditions** | Python unavailable, Java available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock `commandExists`: false for python, true for java | — |
| 2 | Call `detectAvailableIndexer()` | Returns "java" |
| 3 | Verify python probed first, then java | 2 calls to `commandExists` |

---

### UT-03: detectAvailableIndexer — All fail, Windows fallback

| Field | Value |
|-------|-------|
| **ID** | UT-03 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | UC-01, BR-05, AF-02 |
| **Preconditions** | All probes fail, `process.platform = "win32"` |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock all `commandExists` calls to return false | — |
| 2 | Mock `isWindows()` to return true | — |
| 3 | Call `detectAvailableIndexer()` | Returns "powershell" |

---

### UT-04: detectAvailableIndexer — All fail, Unix fallback

| Field | Value |
|-------|-------|
| **ID** | UT-04 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | UC-01, BR-05, AF-02 |
| **Preconditions** | All probes fail, `process.platform = "linux"` |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock all `commandExists` calls to return false | — |
| 2 | Mock `isWindows()` to return false | — |
| 3 | Call `detectAvailableIndexer()` | Returns "bash" |

---

### UT-05: buildCommand — Python (all platforms)

| Field | Value |
|-------|-------|
| **ID** | UT-05 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-02, BR-06, BR-11 |
| **Preconditions** | workspaceRoot = "/workspace" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `buildCommand("python", "/workspace")` | Returns `python /workspace/.analysis/code-intelligence/scripts/python/main.py "/workspace"` |

---

### UT-06: buildCommand — Java on Windows

| Field | Value |
|-------|-------|
| **ID** | UT-06 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-02, BR-07, AF-01 |
| **Preconditions** | `isWindows()` = true, workspaceRoot = `C:\project` |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `buildCommand("java", "C:\\project")` | Returns `"C:\project\.analysis\code-intelligence\scripts\java\run.bat" "C:\project"` |

---

### UT-07: buildCommand — Java on Unix

| Field | Value |
|-------|-------|
| **ID** | UT-07 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-02, BR-07, AF-02 |
| **Preconditions** | `isWindows()` = false, workspaceRoot = "/workspace" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `buildCommand("java", "/workspace")` | Returns `bash "/workspace/.analysis/code-intelligence/scripts/java/run.sh" "/workspace"` |

---

### UT-08: buildCommand — Node.js (npm install + tsx)

| Field | Value |
|-------|-------|
| **ID** | UT-08 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-02, BR-08 |
| **Preconditions** | workspaceRoot = "/workspace" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `buildCommand("nodejs", "/workspace")` | Returns `cd "/workspace/.analysis/code-intelligence/scripts/nodejs" && npm install && npx tsx src/full-indexer.ts "/workspace"` |

---

### UT-09: buildCommand — PowerShell (ExecutionPolicy Bypass)

| Field | Value |
|-------|-------|
| **ID** | UT-09 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-02, BR-09 |
| **Preconditions** | workspaceRoot = `C:\project` |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `buildCommand("powershell", "C:\\project")` | Command contains `-ExecutionPolicy Bypass` and `-File` with correct path |

---

### UT-10: buildCommand — Bash

| Field | Value |
|-------|-------|
| **ID** | UT-10 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-02, BR-10 |
| **Preconditions** | workspaceRoot = "/workspace" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `buildCommand("bash", "/workspace")` | Returns `bash "/workspace/.analysis/code-intelligence/scripts/bash/full-indexer.sh" "/workspace"` |

---

### UT-11: buildCommand — Invalid key returns null

| Field | Value |
|-------|-------|
| **ID** | UT-11 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | UC-02, EF-01 |
| **Preconditions** | None |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `buildCommand("ruby" as any, "/workspace")` | Returns null |

---

### UT-12: runIndexer — preferredIndexer skips detection

| Field | Value |
|-------|-------|
| **ID** | UT-12 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-04, BR-04, BR-19–BR-21 |
| **Preconditions** | `kiroSdlc.preferredIndexer` = "nodejs" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock config to return "nodejs" | — |
| 2 | Call `runIndexer("/workspace")` | `detectAvailableIndexer` NOT called |
| 3 | Verify `buildCommand` called with "nodejs" | Command built for Node.js |

---

### UT-13: runIndexer — No runtime shows warning

| Field | Value |
|-------|-------|
| **ID** | UT-13 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | Story 5, EF-01 |
| **Preconditions** | `detectAvailableIndexer` returns null |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock detection to return null | — |
| 2 | Call `runIndexer("/workspace")` | `showWarningMessage` called with "No compatible runtime found..." |
| 3 | Verify returns false | Function returns false |

---

### UT-14: commandExists — Timeout resolves false

| Field | Value |
|-------|-------|
| **ID** | UT-14 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | BR-02 |
| **Preconditions** | Command hangs > 5s |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock `cp.exec` to trigger timeout error | — |
| 2 | Call `commandExists("slow-command")` | Resolves to false |

---

## Integration Tests (IT)

### IT-01: Detect real runtime on system

| Field | Value |
|-------|-------|
| **ID** | IT-01 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-01, BR-01 |
| **Preconditions** | At least Node.js installed (CI environment) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `commandExists("node --version")` with real shell | Returns true |
| 2 | Call `detectAvailableIndexer()` | Returns a valid IndexerKey (not null) |

---

### IT-02: Execute simple command with output

| Field | Value |
|-------|-------|
| **ID** | IT-02 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-03, BR-12–BR-16 |
| **Preconditions** | Mock VS Code Output Channel API |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create mock script: `echo "hello" && exit 0` | — |
| 2 | Call `executeIndexer("echo hello", cwd, "python")` | Returns true |
| 3 | Verify Output Channel received "hello" | Channel contains stdout |
| 4 | Verify success message printed | Channel contains "✅ Indexing complete!" |

---

### IT-03: Execute failing command

| Field | Value |
|-------|-------|
| **ID** | IT-03 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-03, BR-17, AF-02 |
| **Preconditions** | Mock VS Code APIs |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `executeIndexer("exit 1", cwd, "python")` | Returns false |
| 2 | Verify error message in channel | Contains "[Kiro] ERROR:" |
| 3 | Verify error toast shown | `showErrorMessage` called |

---

### IT-04: Timeout kills process

| Field | Value |
|-------|-------|
| **ID** | IT-04 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | UC-03, EF-01, BR-15 |
| **Preconditions** | Script that sleeps > timeout |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create script: `sleep 200` (or equivalent) | — |
| 2 | Call `executeIndexer` with reduced timeout (e.g., 2s for test) | Process killed, returns false |
| 3 | Verify error mentions timeout | Error message contains "timed out" |

---

### IT-05: Preferred runtime unavailable shows error

| Field | Value |
|-------|-------|
| **ID** | IT-05 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-04, BR-22 |
| **Preconditions** | preferredIndexer = "python", Python not in PATH |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set config to "python", ensure python not available | — |
| 2 | Call `runIndexer("/workspace")` | Error shown, no silent fallback |

---

### IT-06: Full flow — detect + build + execute

| Field | Value |
|-------|-------|
| **ID** | IT-06 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-01, UC-02, UC-03 |
| **Preconditions** | Node.js available, mock workspace with scripts |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set preferredIndexer = "auto" | — |
| 2 | Create mock indexer script that exits 0 | — |
| 3 | Call `runIndexer(mockWorkspace)` | Detects runtime, builds command, executes, returns true |

---

## System Integration Tests — Manual (SIT)

### SIT-01: Auto-detect with Python in Extension Dev Host

| Field | Value |
|-------|-------|
| **ID** | SIT-01 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-01, UC-03, Story 1 |
| **Preconditions** | Python installed, extension loaded in Dev Host, workspace has injected scripts |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Command Palette → "Kiro SDLC: Run Code Indexer" | Command executes |
| 2 | Observe Output Channel | "Kiro Code Indexer" channel appears |
| 3 | Verify header | Shows `[Kiro] Running Python indexer...` |
| 4 | Wait for completion | Shows `[Kiro] ✅ Indexing complete!` |
| 5 | Verify toast | Information toast "Code indexing complete!" appears |

---

### SIT-02: Override with preferredIndexer = "nodejs"

| Field | Value |
|-------|-------|
| **ID** | SIT-02 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-04, BR-19–BR-21 |
| **Preconditions** | Node.js installed, setting changed to "nodejs" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Settings → set `kiroSdlc.preferredIndexer` to "nodejs" | Setting saved |
| 2 | Run "Kiro SDLC: Run Code Indexer" | — |
| 3 | Observe Output Channel | Shows `[Kiro] Running Node.js indexer...` (not Python) |
| 4 | Verify npm install runs | Output shows npm install output |

---

### SIT-03: No runtime available — warning

| Field | Value |
|-------|-------|
| **ID** | SIT-03 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | Story 5, EF-01 |
| **Preconditions** | Remove all runtimes from PATH (or use restricted container) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run "Kiro SDLC: Run Code Indexer" | — |
| 2 | Observe notification | Warning toast: "No compatible runtime found. Install Python, Java, or Node.js." |

---

### SIT-04: Indexer timeout (120s)

| Field | Value |
|-------|-------|
| **ID** | SIT-04 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | UC-03, EF-01, BR-15 |
| **Preconditions** | Replace indexer script with one that sleeps 130s |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Replace main.py with `import time; time.sleep(130)` | — |
| 2 | Run indexer | — |
| 3 | Wait 120s | Process killed, error toast shown |
| 4 | Verify Output Channel | Shows timeout error message |

---

### SIT-05: Output Channel shows real-time progress

| Field | Value |
|-------|-------|
| **ID** | SIT-05 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | UC-03, BR-13, BR-14 |
| **Preconditions** | Indexer script that prints progress lines |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Use indexer script that prints multiple lines with delays | — |
| 2 | Run indexer | — |
| 3 | Observe Output Channel during execution | Output appears (note: may be buffered with `exec`) |
| 4 | Verify all output present after completion | All lines visible in channel |

---

## Requirements Traceability Matrix (RTM)

| Requirement | Source | Test Cases | Coverage |
|-------------|--------|------------|----------|
| UC-01 (Runtime Detection) | FSD 3.1 | UT-01, UT-02, UT-03, UT-04, IT-01, IT-06, SIT-01 | ✅ |
| UC-02 (Command Building) | FSD 3.2 | UT-05, UT-06, UT-07, UT-08, UT-09, UT-10, UT-11, IT-06 | ✅ |
| UC-03 (Execution + Output) | FSD 3.3 | IT-02, IT-03, IT-04, IT-06, SIT-01, SIT-04, SIT-05 | ✅ |
| UC-04 (preferredIndexer) | FSD 3.4 | UT-12, IT-05, SIT-02 | ✅ |
| BR-01 (Priority order) | FSD 3.1.3 | UT-01, UT-02 | ✅ |
| BR-02 (5s probe timeout) | FSD 3.1.3 | UT-14 | ✅ |
| BR-03 (Stop at first success) | FSD 3.1.3 | UT-01, UT-02 | ✅ |
| BR-04 (auto vs specific) | FSD 3.1.3 | UT-12 | ✅ |
| BR-05 (Platform fallback) | FSD 3.1.3 | UT-03, UT-04 | ✅ |
| BR-06 (Python command) | FSD 3.2.3 | UT-05 | ✅ |
| BR-07 (Java platform-specific) | FSD 3.2.3 | UT-06, UT-07 | ✅ |
| BR-08 (Node.js npm install) | FSD 3.2.3 | UT-08 | ✅ |
| BR-09 (PowerShell bypass) | FSD 3.2.3 | UT-09 | ✅ |
| BR-10 (Bash prefix) | FSD 3.2.3 | UT-10 | ✅ |
| BR-11 (Quoted paths) | FSD 3.2.3 | UT-05–UT-10 | ✅ |
| BR-12 (Channel name) | FSD 3.3.3 | IT-02, SIT-01 | ✅ |
| BR-13 (Channel shown) | FSD 3.3.3 | SIT-01, SIT-05 | ✅ |
| BR-14 (Header format) | FSD 3.3.3 | IT-02, SIT-01 | ✅ |
| BR-15 (120s timeout) | FSD 3.3.3 | IT-04, SIT-04 | ✅ |
| BR-16 (Success message) | FSD 3.3.3 | IT-02, SIT-01 | ✅ |
| BR-17 (Error format) | FSD 3.3.3 | IT-03 | ✅ |
| BR-18 (CWD = workspace root) | FSD 3.3.3 | IT-06 | ✅ |
| BR-19 (Default "auto") | FSD 3.4.3 | UT-12 | ✅ |
| BR-20 (Valid enum values) | FSD 3.4.3 | UT-12, SIT-02 | ✅ |
| BR-21 (No restart needed) | FSD 3.4.3 | SIT-02 | ✅ |
| BR-22 (Error if unavailable) | FSD 3.4.3 | IT-05 | ✅ |
| Story 5 (No runtime warning) | BRD 2.3 | UT-13, SIT-03 | ✅ |

