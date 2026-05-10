# Functional Specification Document (FSD)

## Kiro SDLC Agents Extension — KSA-5: Auto-detect Runtime & Run Indexer

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-5 |
| Title | Auto-detect Runtime & Run Indexer |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2025-07-10 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-5.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-10 | BA Agent | Initiate document — business sections |
| 1.0 | 2025-07-10 | TA Agent | Enriched with API contracts, technical depth |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the Auto-detect Runtime & Run Indexer feature. It defines how the system detects available runtimes, builds commands, executes indexer scripts, and streams output — providing enough detail for developers to implement from this specification.

### 1.2 Scope

Covers the `runIndexer()` function and its sub-functions: `detectAvailableIndexer()`, `buildCommand()`, `executeIndexer()`, and supporting utilities (`commandExists()`, `isWindows()`).

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| Runtime | Language interpreter/VM available on the system (Python, Java, Node.js, PowerShell, Bash) |
| Probe | A lightweight command executed to check if a runtime is installed |
| Output Channel | VS Code read-only text panel for displaying process output |
| IndexerKey | TypeScript type representing valid runtime identifiers |
| CWD | Current Working Directory — workspace root for process execution |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-5.docx |
| Existing indexer.ts | `kiro-sdlc-agents/src/indexer.ts` |
| Extension config | `kiro-sdlc-agents/src/config.ts` |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

The Auto-detect Runtime feature operates within the VS Code extension host. It interacts with:
- **VS Code Configuration API** — reads `kiroSdlc.preferredIndexer` setting
- **VS Code Output Channel API** — creates and writes to output panel
- **VS Code Window API** — shows toast notifications (info/warning/error)
- **Operating System** — executes shell commands to probe runtimes and run indexer
- **File System** — resolves script paths relative to workspace root

### 2.2 System Architecture

The feature is implemented as a single TypeScript module (`indexer.ts`) with the following internal structure:

| Function | Responsibility |
|----------|---------------|
| `runIndexer(workspaceRoot)` | Entry point — orchestrates detection, build, execute |
| `detectAvailableIndexer()` | Probes runtimes in priority order |
| `buildCommand(key, workspaceRoot)` | Constructs platform-specific command string |
| `executeIndexer(command, cwd, key)` | Spawns process, streams output, handles result |
| `commandExists(cmd)` | Utility — checks if a command is available |
| `isWindows()` | Utility — platform detection |

---

## 3. Functional Requirements

### 3.1 Feature: Runtime Detection

**Source:** BRD Story 1

#### 3.1.1 Description

The system detects which runtimes are available on the user's machine by executing version-check commands. Detection follows a fixed priority order and stops at the first successful probe.

#### 3.1.2 Use Case

**Use Case ID:** UC-01
**Actor:** Developer (indirect — triggered by command)
**Preconditions:** Extension is activated, workspace is open
**Postconditions:** A valid IndexerKey is returned, or null if no runtime found

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Triggers "Run Code Indexer" command |
| 2 | | Reads config | Reads `kiroSdlc.preferredIndexer` from VS Code settings |
| 3 | | Checks setting | If setting ≠ "auto", returns setting as IndexerKey directly |
| 4 | | Iterates priority list | Loops through ["python", "java", "nodejs", "powershell", "bash"] |
| 5 | | Executes probe | Runs check command (e.g., `python --version`) with 5s timeout |
| 6 | | Evaluates result | If exit code = 0, returns this runtime key |
| 7 | | Continues | If probe fails, moves to next runtime in list |
| 8 | | Fallback | If all probes fail, returns platform default (powershell/bash) |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | preferredIndexer ≠ "auto" | Skip detection, use configured value directly as IndexerKey |
| AF-02 | All probes fail | Return "powershell" on Windows, "bash" on Linux/Mac |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Even platform fallback unavailable | Return null → caller shows warning |

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-01 | Detection priority: Python > Java > Node.js > PowerShell > Bash | BRD §2.3 Story 1 |
| BR-02 | Each probe has 5-second timeout | BRD §2.3 Story 1 |
| BR-03 | Detection stops at first success | BRD §2.3 Story 1 |
| BR-04 | preferredIndexer = "auto" triggers detection; specific value skips it | BRD §2.3 Story 4 |
| BR-05 | Platform fallback: PowerShell (Windows), Bash (Unix) | BRD §2.3 Story 1 |

#### 3.1.4 Data Specifications

**Input Data:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| preferredIndexer | string | Yes | Must be "auto" or valid IndexerKey | User's configured preference |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| indexerKey | IndexerKey \| null | Detected runtime key, or null if none found |

#### 3.1.5 API Contract (Functional View)

**Function:** `detectAvailableIndexer(): Promise<IndexerKey | null>`
**Purpose:** Determine which runtime is available on the system

**Input Parameters:** None (reads from INDEXER_SCRIPTS config)

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| return | IndexerKey \| null | First available runtime key, or null |

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| No runtime found | "No compatible runtime found. Install Python, Java, or Node.js." | All probes fail AND platform fallback fails |

---

### 3.2 Feature: Command Building

**Source:** BRD Story 2

#### 3.2.1 Description

Given a detected runtime key and workspace root path, the system constructs the correct shell command string. Commands are platform-aware (Windows vs Unix paths) and runtime-specific (different invocation patterns per language).

#### 3.2.2 Use Case

**Use Case ID:** UC-02
**Actor:** System (internal)
**Preconditions:** Valid IndexerKey determined from UC-01
**Postconditions:** A complete, executable command string is returned

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Receives key + root | Gets IndexerKey and workspace root path |
| 2 | | Resolves script path | Builds absolute path to indexer script using `path.join()` |
| 3 | | Applies template | Constructs command string per runtime's template |
| 4 | | Returns command | Returns the complete command string |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Java on Windows | Uses `.bat` launcher instead of `.sh` |
| AF-02 | Java on Unix | Uses `bash` to invoke `.sh` launcher |
| AF-03 | Node.js | Prepends `cd` + `npm install` before execution |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Unknown IndexerKey | Returns null |

#### 3.2.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-06 | Python: direct invocation with `python` command | BRD §2.3 Story 2 |
| BR-07 | Java: platform-specific launcher (.bat/.sh) | BRD §2.3 Story 2 |
| BR-08 | Node.js: requires `npm install` before execution | BRD §2.3 Story 2 |
| BR-09 | PowerShell: must include `-ExecutionPolicy Bypass` | BRD §2.3 Story 2 |
| BR-10 | Bash: invoked with `bash` prefix | BRD §2.3 Story 2 |
| BR-11 | All paths with spaces must be quoted | BRD §2.3 Story 2 |

#### 3.2.4 Data Specifications

**Input Data:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| key | IndexerKey | Yes | Must be valid enum value | Runtime identifier |
| workspaceRoot | string | Yes | Must be valid directory path | Absolute path to workspace |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| command | string \| null | Complete shell command, or null if key is invalid |

#### 3.2.5 Command Templates (Detailed)

| Runtime | Platform | Command Template |
|---------|----------|-----------------|
| python | All | `python {root}/.analysis/code-intelligence/scripts/python/main.py "{root}"` |
| java | Windows | `"{root}\.analysis\code-intelligence\scripts\java\run.bat" "{root}"` |
| java | Unix | `bash "{root}/.analysis/code-intelligence/scripts/java/run.sh" "{root}"` |
| nodejs | All | `cd "{root}/.analysis/code-intelligence/scripts/nodejs" && npm install && npx tsx src/full-indexer.ts "{root}"` |
| powershell | All | `powershell -ExecutionPolicy Bypass -File "{root}\.analysis\code-intelligence\scripts\powershell\full-indexer.ps1" -RootDir "{root}"` |
| bash | All | `bash "{root}/.analysis/code-intelligence/scripts/bash/full-indexer.sh" "{root}"` |

---

### 3.3 Feature: Indexer Execution with Output Channel

**Source:** BRD Story 3

#### 3.3.1 Description

The system spawns a child process with the built command, creates a VS Code Output Channel, streams all process output to it, and reports success/failure via toast notifications.

#### 3.3.2 Use Case

**Use Case ID:** UC-03
**Actor:** Developer (observes output)
**Preconditions:** Valid command string from UC-02
**Postconditions:** Indexer has run, output is visible, result is reported

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Creates channel | Creates Output Channel "Kiro Code Indexer" |
| 2 | | Shows channel | Brings Output Channel panel to focus |
| 3 | | Prints header | Writes `[Kiro] Running {label} indexer...` |
| 4 | | Prints command | Writes the full command being executed |
| 5 | | Spawns process | Executes command via `child_process.exec()` |
| 6 | | Streams output | Writes stdout/stderr to channel as received |
| 7 | | Handles completion | On exit code 0: success path. Non-zero: error path |
| 8 | Developer | Views output | Reads progress/results in Output Channel |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Process succeeds (exit 0) | Print `[Kiro] ✅ Indexing complete!`, show info toast, return true |
| AF-02 | Process fails (exit ≠ 0) | Print `[Kiro] ERROR: {message}`, show error toast, return false |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Process exceeds 120s timeout | Kill process, print timeout error, show error toast, return false |
| EF-02 | Process cannot be spawned | Print spawn error, show error toast, return false |

#### 3.3.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-12 | Output Channel name: "Kiro Code Indexer" | BRD §2.3 Story 3 |
| BR-13 | Channel is shown (focused) on start | BRD §2.3 Story 3 |
| BR-14 | Header format: `[Kiro] Running {label} indexer...` | BRD §2.3 Story 3 |
| BR-15 | Execution timeout: 120 seconds | BRD §2.3 Story 3 |
| BR-16 | Success message: `[Kiro] ✅ Indexing complete!` | BRD §2.3 Story 3 |
| BR-17 | Error format: `[Kiro] ERROR: {message}` | BRD §2.3 Story 3 |
| BR-18 | CWD for process = workspace root | BRD §2.3 Story 3 |

#### 3.3.4 Data Specifications

**Input Data:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| command | string | Yes | Non-empty | Shell command to execute |
| cwd | string | Yes | Valid directory | Working directory for process |
| key | IndexerKey | Yes | Valid enum | Used to get label for output |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | true if process exited with code 0, false otherwise |

---

### 3.4 Feature: Configuration Setting

**Source:** BRD Story 4

#### 3.4.1 Description

The extension contributes a `kiroSdlc.preferredIndexer` configuration property that allows users to override auto-detection with a specific runtime choice.

#### 3.4.2 Use Case

**Use Case ID:** UC-04
**Actor:** Developer
**Preconditions:** Extension is installed
**Postconditions:** Setting is persisted and used on next indexer run

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Opens VS Code Settings |
| 2 | Developer | | Searches for "kiroSdlc.preferredIndexer" |
| 3 | Developer | | Selects value from dropdown (auto/python/java/nodejs/powershell/bash) |
| 4 | | Persists | VS Code saves setting to workspace or user settings |
| 5 | Developer | | Triggers "Run Code Indexer" |
| 6 | | Reads setting | `runIndexer()` reads the configured value |
| 7 | | Applies | If ≠ "auto", skips detection and uses value directly |

#### 3.4.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-19 | Default value: "auto" | BRD §2.3 Story 4 |
| BR-20 | Valid values: "auto", "python", "java", "nodejs", "powershell", "bash" | BRD §2.3 Story 4 |
| BR-21 | Setting change takes effect immediately (no restart) | BRD §2.3 Story 4 |
| BR-22 | If preferred runtime unavailable, show error (no silent fallback) | BRD §2.3 Story 4 |

---

## 4. Data Model

### 4.1 Configuration Schema

#### Entity: INDEXER_SCRIPTS

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| key | IndexerKey | Yes | BR-01 | Runtime identifier (python/java/nodejs/powershell/bash) |
| check | string | Yes | BR-02 | Command to verify runtime availability |
| label | string | Yes | BR-14 | Human-readable name for output messages |

**Relationships:**

| From Entity | To Entity | Cardinality | Description |
|-------------|-----------|-------------|-------------|
| INDEXER_SCRIPTS | IndexerKey | 1:1 | Each script entry maps to one runtime key |
| preferredIndexer setting | IndexerKey | 1:1 | Setting value maps to one runtime key (or "auto") |

---

## 5. Integration Specifications

### 5.1 External System: Operating System Shell

| Attribute | Value |
|-----------|-------|
| Purpose | Execute version-check probes and indexer scripts |
| Direction | Outbound |
| Data Format | Shell commands (text) |
| Frequency | On-demand (user triggers) |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| Check command string | Exit code (0 = available) | Send/Receive | BR-02, BR-03 |
| Indexer command string | stdout + stderr + exit code | Send/Receive | BR-15, BR-16, BR-17 |

### 5.2 External System: VS Code Extension Host APIs

| Attribute | Value |
|-----------|-------|
| Purpose | Configuration, Output Channel, Notifications |
| Direction | Bidirectional |
| Data Format | TypeScript API calls |
| Frequency | Per indexer invocation |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| Config key "kiroSdlc.preferredIndexer" | Setting value (string) | Receive | BR-19, BR-20 |
| Channel name + text | Output Channel display | Send | BR-12, BR-13 |
| Message text | Toast notification | Send | BR-16, BR-17 |

---

## 6. Processing Logic

### 6.1 Runtime Detection Process

**Trigger:** `runIndexer()` called with preferredIndexer = "auto"
**Input:** INDEXER_SCRIPTS configuration
**Output:** IndexerKey or null

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Define priority array: ["python", "java", "nodejs", "powershell", "bash"] | N/A |
| 2 | For each key in priority array, get check command from INDEXER_SCRIPTS | Skip if no check command defined |
| 3 | Execute check command with 5s timeout via `commandExists()` | Timeout or error → runtime unavailable, continue |
| 4 | If command succeeds (exit 0), return this key | N/A |
| 5 | If all fail, check platform: Windows → "powershell", else → "bash" | This is the fallback |

**Pseudocode:**

```typescript
async function detectAvailableIndexer(): Promise<IndexerKey | null> {
    const priority: IndexerKey[] = ["python", "java", "nodejs", "powershell", "bash"];
    for (const key of priority) {
        const script = INDEXER_SCRIPTS[key];
        if (script.check && await commandExists(script.check)) {
            return key;
        }
    }
    return isWindows() ? "powershell" : "bash";
}
```

### 6.2 Command Building Process

**Trigger:** Runtime key determined
**Input:** IndexerKey + workspace root path
**Output:** Command string or null

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Switch on IndexerKey value | Unknown key → return null |
| 2 | Resolve script path using `path.join(workspaceRoot, ...)` | N/A |
| 3 | Apply platform-specific adjustments (Windows backslashes, .bat vs .sh) | N/A |
| 4 | Quote paths that may contain spaces | N/A |
| 5 | Return complete command string | N/A |

### 6.3 Execution Process

**Trigger:** Command string built
**Input:** Command, CWD, IndexerKey
**Output:** boolean (success/failure)

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Create Output Channel "Kiro Code Indexer" | N/A |
| 2 | Show channel (bring to focus) | N/A |
| 3 | Print header: `[Kiro] Running {label} indexer...` | N/A |
| 4 | Print command string | N/A |
| 5 | Execute `cp.exec(command, { cwd, timeout: 120000 })` | Timeout → kill + error |
| 6 | On completion: append stdout to channel | N/A |
| 7 | On completion: append stderr to channel | N/A |
| 8 | If error: print `[Kiro] ERROR: {message}`, show error toast, resolve false | N/A |
| 9 | If success: print `[Kiro] ✅ Indexing complete!`, show info toast, resolve true | N/A |

---

## 7. Security Requirements

### 7.1 Authentication & Authorization

| Role | Permissions | Screens/Features |
|------|-------------|-------------------|
| Developer | Execute | Can run indexer command, configure settings |
| Extension | System | Spawns child processes with user's permissions |

### 7.2 Data Sensitivity Classification

| Data Type | Classification | Business Requirement |
|-----------|---------------|---------------------|
| Source code paths | Internal | Paths shown in output channel only |
| Process output | Internal | May contain file names, not sensitive data |
| Configuration | Internal | User preference, no secrets |

### 7.3 Security Considerations

- Commands are constructed from static templates + workspace path (no user-supplied arbitrary input)
- `-ExecutionPolicy Bypass` is scoped to the single script invocation (not system-wide)
- Child process inherits user's permissions (no privilege escalation)
- 120s timeout prevents resource exhaustion from runaway processes

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | Runtime detection < 10s total | Worst case: 5 probes × 5s = 25s, typical < 2s |
| Performance | Indexer execution < 120s | Timeout kills process at 120s |
| Reliability | Graceful fallback on detection failure | Platform default used before showing error |
| Usability | Real-time output visibility | Output streams as process runs, not buffered |
| Usability | Clear success/failure indication | Toast + channel message on completion |
| Configurability | Override auto-detection | `preferredIndexer` setting with 6 valid values |

---

## 9. Error Handling (User-Facing)

### 9.1 Error Scenarios

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| No runtime found | Warning | "No compatible runtime found. Install Python, Java, or Node.js." | Warning toast, function returns false |
| Preferred runtime unavailable | Error | "Preferred indexer '{runtime}' is not available." | Error toast, function returns false |
| Indexer process fails | Error | "Indexer failed: {error message}" | Error toast + details in Output Channel |
| Indexer times out | Error | "Indexer timed out after 120 seconds" | Process killed, error in channel |
| Command build fails | Error | (internal — no user message) | Function returns false silently |

### 9.2 Notification Requirements

| Event | Who is Notified | Channel | Timing |
|-------|----------------|---------|--------|
| Indexing started | Developer | Output Channel (header) | Immediate |
| Indexing complete | Developer | Info toast + Output Channel | On process exit |
| Indexing failed | Developer | Error toast + Output Channel | On process exit/timeout |
| No runtime found | Developer | Warning toast | After detection completes |

---

## 10. Testing Considerations

### 10.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-01 | Auto-detect with Python available | Python installed, setting = "auto" | Returns "python", runs Python indexer | High |
| TC-02 | Auto-detect with only Java | Only Java installed, setting = "auto" | Returns "java", runs Java indexer | High |
| TC-03 | Preferred indexer = "nodejs" | Node.js installed, setting = "nodejs" | Skips detection, runs Node.js indexer | High |
| TC-04 | Preferred indexer unavailable | Setting = "python", Python not installed | Error message shown | High |
| TC-05 | No runtime available | No runtimes installed | Warning message shown | Medium |
| TC-06 | Indexer succeeds | Valid command, process exits 0 | Success toast + channel message | High |
| TC-07 | Indexer fails | Process exits non-zero | Error toast + channel message | High |
| TC-08 | Indexer times out | Process runs > 120s | Process killed, timeout error | Medium |
| TC-09 | Platform fallback Windows | All probes fail, Windows OS | Uses "powershell" | Medium |
| TC-10 | Platform fallback Unix | All probes fail, Linux/Mac OS | Uses "bash" | Medium |

---

## 11. Appendix

### State Diagram — Indexer Execution

![State Diagram](diagrams/state-indexer.png)

### Sequence Diagram — Run Indexer Flow

![Sequence Diagram](diagrams/sequence-run-indexer.png)

### Diagrams

| Diagram | File |
|---------|------|
| System Context | [system-context.png](diagrams/system-context.png) |
| Sequence — Run Indexer | [sequence-run-indexer.png](diagrams/sequence-run-indexer.png) |
| State — Indexer Execution | [state-indexer.png](diagrams/state-indexer.png) |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence — Run Indexer | [sequence-run-indexer.png](diagrams/sequence-run-indexer.png) | [sequence-run-indexer.drawio](diagrams/sequence-run-indexer.drawio) |
| 3 | State — Indexer Execution | [state-indexer.png](diagrams/state-indexer.png) | [state-indexer.drawio](diagrams/state-indexer.drawio) |
