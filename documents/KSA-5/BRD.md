# Business Requirements Document (BRD)

## Kiro SDLC Agents Extension — KSA-5: Auto-detect Runtime & Run Indexer

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-5 |
| Title | Auto-detect Runtime & Run Indexer |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-07-10 |
| Status | Draft |
| Parent Epic | KSA-1: Kiro SDLC Agents Extension |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | SA Agent – Solution Architect | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-10 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-5 |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

This document defines the business requirements for the **Auto-detect Runtime & Run Indexer** feature of the Kiro SDLC Agents VS Code extension. This feature automatically detects which runtimes are available on the user's machine (Python, Java, Node.js, PowerShell, Bash), builds the correct command for the detected runtime, executes the indexer script with output directed to a VS Code output channel, and respects the `kiroSdlc.preferredIndexer` user setting.

KSA-5 specifically covers:
- Runtime detection logic (checking if python, java, node, powershell, bash are available)
- Priority-based auto-selection when `preferredIndexer` is set to "auto"
- Building the correct shell command per runtime (including path resolution and arguments)
- Executing the indexer as a child process with output streaming to a VS Code Output Channel
- Respecting the `kiroSdlc.preferredIndexer` configuration setting to override auto-detection
- Error handling when no compatible runtime is found

### 1.2 Out of Scope

- Extension activation and command registration (covered by KSA-2: Extension Core)
- File copy mechanics and resource injection (covered by KSA-3: Injector)
- QuickPick UI for manual indexer selection (covered by KSA-4: Indexer Selection)
- Bundled resource packaging (covered by KSA-6: Bundled Resources)
- Individual indexer script implementations (covered by KSA-7 through KSA-10)
- Checksum verification of injected files (covered by KSA-11)

### 1.3 Preliminary Requirement

- KSA-2 (Extension Core) must be implemented — provides `kiroSdlc.runIndex` command
- KSA-3 (Injector) must be implemented — indexer scripts must be present in workspace
- KSA-4 (Indexer Selection) must be implemented — determines which script directory exists
- At least one runtime (Python 3.7+, Java 17+, Node.js 18+, PowerShell 5.1+, or Bash 4+) must be installed on the user's machine
- The workspace must contain `.analysis/code-intelligence/scripts/{language}/` directory for the detected runtime

---

## 2. Business Requirements

### 2.1 High Level Process Map

The Auto-detect Runtime feature is triggered when the user invokes the "Kiro SDLC: Run Code Indexer" command (or automatically after injection if `kiroSdlc.autoIndex` is true). The system first checks the `preferredIndexer` setting. If set to "auto", it probes available runtimes in priority order. Once a runtime is identified, the system builds the appropriate command string, spawns a child process, and streams output to a dedicated VS Code Output Channel.

![Business Flow](diagrams/business-flow.png)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a developer, I want the extension to auto-detect available runtimes so that I don't need to manually configure which indexer to use | MUST HAVE | KSA-5 |
| 2 | As a developer, I want the system to build the correct command per runtime so that the indexer executes without manual intervention | MUST HAVE | KSA-5 |
| 3 | As a developer, I want indexer output streamed to a VS Code Output Channel so that I can monitor progress and diagnose issues | MUST HAVE | KSA-5 |
| 4 | As a developer, I want to override auto-detection via `kiroSdlc.preferredIndexer` setting so that I can force a specific runtime | MUST HAVE | KSA-5 |
| 5 | As a developer, I want a clear warning when no compatible runtime is found so that I know what to install | SHOULD HAVE | KSA-5 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** User triggers "Kiro SDLC: Run Code Indexer" command (or auto-trigger after injection).

**Step 2:** System reads `kiroSdlc.preferredIndexer` setting from VS Code configuration.

**Step 3:** If setting is "auto" → system probes runtimes in priority order (Python → Java → Node.js → PowerShell → Bash). If setting is a specific language → system uses that language directly.

**Step 4:** For each runtime probe, system executes a version-check command (e.g., `python --version`) with a 5-second timeout.

**Step 5:** First runtime that responds successfully is selected.

**Step 6:** System builds the full command string for the selected runtime, including script path and workspace root argument.

**Step 7:** System spawns a child process with the built command, working directory set to workspace root, and 120-second timeout.

**Step 8:** System creates/shows a VS Code Output Channel named "Kiro Code Indexer" and streams stdout/stderr to it.

**Step 9:** On success → show information message "Code indexing complete!". On failure → show error message with details.

> **Note:** If no runtime is detected and setting is "auto", the system falls back to PowerShell on Windows or Bash on Linux/Mac (since these are built-in). If even the fallback fails, a warning message is shown.

---

#### STORY 1: Auto-detect Available Runtimes

> As a developer, I want the extension to auto-detect available runtimes so that I don't need to manually configure which indexer to use.

**Requirement Details:**

1. System probes 5 runtimes in a fixed priority order: Python, Java, Node.js, PowerShell, Bash
2. Each probe executes a version-check command to verify the runtime is installed and accessible
3. The first runtime that responds successfully (exit code 0 within timeout) is selected
4. Probing is sequential — stops at first success (no unnecessary probes)
5. Each probe has a 5-second timeout to avoid hanging on unresponsive commands

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| runtime key | string | Yes | Identifier for the runtime | "python", "java", "nodejs", "powershell", "bash" |
| check command | string | Yes | Command to verify runtime availability | "python --version" |
| timeout | number | Yes | Maximum wait time for probe (ms) | 5000 |
| priority | number | Yes | Detection order (1 = highest) | 1 (Python), 2 (Java), etc. |

**Runtime Detection Table:**

| Priority | Runtime Key | Check Command | Label |
|----------|-------------|---------------|-------|
| 1 | python | `python --version` | Python |
| 2 | java | `java --version` | Java |
| 3 | nodejs | `node --version` | Node.js |
| 4 | powershell | `powershell -Command "$PSVersionTable.PSVersion"` | PowerShell |
| 5 | bash | `bash --version` | Bash |

**Acceptance Criteria:**

1. System detects Python if `python --version` returns exit code 0 within 5 seconds
2. System detects Java if `java --version` returns exit code 0 within 5 seconds
3. System detects Node.js if `node --version` returns exit code 0 within 5 seconds
4. System detects PowerShell if the PowerShell version command succeeds within 5 seconds
5. System detects Bash if `bash --version` returns exit code 0 within 5 seconds
6. Detection follows priority order — Python is preferred over Java if both are available
7. Detection stops at first successful probe (no unnecessary checks)

**Error Handling:**

- Probe command times out (> 5s): Runtime considered unavailable, move to next
- Probe command returns non-zero exit code: Runtime considered unavailable, move to next
- All probes fail: Fall back to platform default (PowerShell on Windows, Bash on Linux/Mac)
- Platform fallback also fails: Show warning message to user

---

#### STORY 2: Build Correct Command Per Runtime

> As a developer, I want the system to build the correct command per runtime so that the indexer executes without manual intervention.

**Requirement Details:**

1. Each runtime has a specific command template that includes the script path and workspace root argument
2. Script paths are resolved relative to the workspace root (`.analysis/code-intelligence/scripts/{language}/`)
3. Commands handle platform differences (Windows vs Unix path separators, shell invocation)
4. Node.js command includes `npm install` step before execution (since it has dependencies)
5. Java command uses a platform-specific launcher script (`.bat` on Windows, `.sh` on Unix)

**Command Templates:**

| Runtime | Command Template | Notes |
|---------|-----------------|-------|
| python | `python {root}/.analysis/code-intelligence/scripts/python/main.py "{root}"` | Direct Python invocation |
| java | Windows: `"{root}\.analysis\code-intelligence\scripts\java\run.bat" "{root}"` / Unix: `bash "{root}/.analysis/code-intelligence/scripts/java/run.sh" "{root}"` | Platform-specific launcher |
| nodejs | `cd "{scriptDir}" && npm install && npx tsx src/full-indexer.ts "{root}"` | Requires npm install first |
| powershell | `powershell -ExecutionPolicy Bypass -File "{root}\.analysis\code-intelligence\scripts\powershell\full-indexer.ps1" -RootDir "{root}"` | Bypass execution policy |
| bash | `bash "{root}/.analysis/code-intelligence/scripts/bash/full-indexer.sh" "{root}"` | Direct bash invocation |

**Acceptance Criteria:**

1. Python command resolves to correct script path and passes workspace root as argument
2. Java command uses `.bat` launcher on Windows and `.sh` launcher on Unix
3. Node.js command runs `npm install` before executing the indexer
4. PowerShell command includes `-ExecutionPolicy Bypass` flag
5. Bash command invokes the script with `bash` prefix
6. All commands pass the workspace root path as an argument (quoted for spaces)
7. Path separators are correct for the current platform

**Validation Rules:**

- Workspace root must be a valid directory path
- Script file must exist at the resolved path (otherwise command will fail at execution)
- Paths with spaces must be properly quoted

---

#### STORY 3: Execute with Output Channel

> As a developer, I want indexer output streamed to a VS Code Output Channel so that I can monitor progress and diagnose issues.

**Requirement Details:**

1. System creates a VS Code Output Channel named "Kiro Code Indexer"
2. The channel is shown (brought to focus) when indexing starts
3. A header line is printed: `[Kiro] Running {label} indexer...` followed by the full command
4. stdout and stderr from the child process are streamed to the channel
5. On success: channel shows `[Kiro] ✅ Indexing complete!` and an information toast appears
6. On failure: channel shows `[Kiro] ERROR: {message}` and an error toast appears
7. Child process has a 120-second timeout to prevent indefinite hanging

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| channelName | string | Yes | Name of the VS Code Output Channel | "Kiro Code Indexer" |
| timeout | number | Yes | Maximum execution time (ms) | 120000 |
| cwd | string | Yes | Working directory for child process | workspace root path |

**Acceptance Criteria:**

1. Output Channel named "Kiro Code Indexer" is created and shown when indexing starts
2. Channel displays `[Kiro] Running {runtime label} indexer...` as first line
3. Channel displays the full command being executed as second line
4. All stdout output from the indexer process appears in the channel
5. All stderr output from the indexer process appears in the channel
6. On success: `[Kiro] ✅ Indexing complete!` appears in channel AND information toast shown
7. On failure: `[Kiro] ERROR: {message}` appears in channel AND error toast shown
8. Process is killed if it exceeds 120-second timeout

**Error Handling:**

- Process exceeds timeout: Kill process, show error "Indexer timed out after 120 seconds"
- Process exits with non-zero code: Show error with exit code and last stderr line
- Process cannot be spawned (command not found): Show error "Failed to start indexer"

---

#### STORY 4: Respect preferredIndexer Setting

> As a developer, I want to override auto-detection via `kiroSdlc.preferredIndexer` setting so that I can force a specific runtime.

**Requirement Details:**

1. Extension contributes a configuration property `kiroSdlc.preferredIndexer`
2. Valid values: "auto", "python", "java", "nodejs", "powershell", "bash"
3. Default value: "auto" (triggers auto-detection)
4. When set to a specific runtime, auto-detection is skipped entirely
5. The specified runtime is used directly to build the command
6. If the specified runtime is not available, an error is shown (no fallback to auto-detect)

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| kiroSdlc.preferredIndexer | string (enum) | Yes | User's preferred indexer runtime | "auto" |

**Enum Values:**

| Value | Behavior |
|-------|----------|
| auto | Detect available runtimes in priority order |
| python | Use Python directly (skip detection) |
| java | Use Java directly (skip detection) |
| nodejs | Use Node.js directly (skip detection) |
| powershell | Use PowerShell directly (skip detection) |
| bash | Use Bash directly (skip detection) |

**Acceptance Criteria:**

1. Setting `kiroSdlc.preferredIndexer` to "python" skips detection and uses Python directly
2. Setting to "auto" triggers the full detection flow
3. If preferred runtime is not available, error message shown (no silent fallback)
4. Setting change takes effect on next "Run Code Indexer" invocation (no restart needed)
5. Setting is workspace-scoped (different workspaces can have different preferences)

**Error Handling:**

- Preferred runtime not installed: Show error "Preferred indexer '{runtime}' is not available. Install it or set preferredIndexer to 'auto'."
- Invalid setting value: Treat as "auto" (defensive fallback)

---

#### STORY 5: Warning When No Runtime Found

> As a developer, I want a clear warning when no compatible runtime is found so that I know what to install.

**Requirement Details:**

1. If auto-detection fails for all 5 runtimes AND platform fallback fails, show a warning
2. Warning message clearly states what runtimes are supported
3. Warning suggests installing one of the supported runtimes

**Acceptance Criteria:**

1. Warning message appears as VS Code warning notification
2. Message text: "No compatible runtime found. Install Python, Java, or Node.js."
3. Warning only appears when ALL detection attempts fail (including platform fallback)
4. Function returns `false` to indicate indexing did not run

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Extension Core | System | KSA-2 | Provides `kiroSdlc.runIndex` command registration |
| Injector | System | KSA-3 | Ensures indexer scripts are present in workspace |
| Indexer Selection | System | KSA-4 | Determines which language script directory exists |
| VS Code Configuration API | External | N/A | `vscode.workspace.getConfiguration()` for reading settings |
| VS Code Output Channel API | External | N/A | `vscode.window.createOutputChannel()` for output streaming |
| Node.js child_process | External | N/A | `cp.exec()` for spawning indexer processes |
| Platform runtimes | External | N/A | At least one of: Python 3.7+, Java 17+, Node.js 18+, PowerShell 5.1+, Bash 4+ |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Developer | Extension Users | Trigger indexer, monitor output, configure preferences | Target audience |
| Extension Maintainer | Kiro SDLC Team | Implements runtime detection and execution logic | KSA-5 assignee |
| Product Owner | Kiro SDLC Team | Defines detection priority and fallback behavior | Epic KSA-1 |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Runtime installed but not in PATH | High | Medium | Check command uses full version check (not just `which`); document PATH requirement |
| Different Python versions (python vs python3) | Medium | Medium | Try `python --version` first; could add `python3` as fallback in future |
| Node.js `npm install` fails (network issues) | Medium | Low | Show clear error in output channel; user can retry |
| PowerShell execution policy blocks script | Medium | Low | Use `-ExecutionPolicy Bypass` flag in command |
| Indexer script takes > 120s on large projects | Medium | Low | 120s timeout is generous; can be made configurable in future |

### 5.2 Assumptions

- Runtimes are accessible via PATH environment variable
- `python --version`, `java --version`, `node --version` are standard version-check commands
- VS Code Output Channel API supports real-time streaming (not buffered until process ends)
- `child_process.exec` is sufficient for process management (no need for `spawn` with streaming)
- The workspace root is always the first workspace folder (`workspaceFolders[0]`)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Runtime detection completes within 10 seconds | 5 probes × 5s timeout max = 25s worst case, but typically < 2s (first probe succeeds) |
| Performance | Indexer execution completes within 120 seconds | Timeout kills process if exceeded |
| Reliability | Graceful degradation on detection failure | Falls back to platform default before showing error |
| Usability | Real-time output streaming | User sees progress as it happens, not after completion |
| Usability | Clear error messages | Specific messages for each failure mode (timeout, not found, etc.) |
| Configurability | User can override detection | `preferredIndexer` setting allows explicit runtime choice |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-5 | Auto-detect Runtime & Run Indexer | To Do | Task | Main ticket |
| KSA-1 | Kiro SDLC Agents Extension | In Progress | Epic | Parent epic |
| KSA-2 | Extension Core — Commands & Activation | Done | Task | Dependency (command registration) |
| KSA-3 | Injector — Copy Resources to Workspace | Done | Task | Dependency (scripts in workspace) |
| KSA-4 | Indexer Selection — Choose ONE Language | To Do | Task | Related (determines which script exists) |
| KSA-6 | Bundled Resources | To Do | Task | Related (bundles scripts in extension) |
| KSA-7 | Code Indexer — Python | To Do | Task | Related (Python indexer script) |
| KSA-8 | Code Indexer — Java | To Do | Task | Related (Java indexer script) |
| KSA-9 | Code Indexer — PowerShell | To Do | Task | Related (PowerShell indexer script) |
| KSA-10 | Code Indexer — Bash | To Do | Task | Related (Bash indexer script) |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Runtime | A language interpreter or virtual machine installed on the user's system (Python, Java, Node.js, PowerShell, Bash) |
| Auto-detection | Process of probing the system to determine which runtimes are available |
| Output Channel | VS Code UI panel that displays text output (similar to terminal but read-only) |
| preferredIndexer | VS Code configuration setting that controls which runtime to use |
| Probe | A version-check command executed to verify a runtime is installed and accessible |
| Platform fallback | Using PowerShell (Windows) or Bash (Unix) as last resort since they're built-in |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| VS Code Output Channel API | https://code.visualstudio.com/api/references/vscode-api#OutputChannel |
| VS Code Configuration API | https://code.visualstudio.com/api/references/vscode-api#WorkspaceConfiguration |
| Node.js child_process | https://nodejs.org/api/child_process.html |
| Extension config | `kiro-sdlc-agents/src/config.ts` |
| Indexer module | `kiro-sdlc-agents/src/indexer.ts` |
| Parent Epic BRD | `documents/KSA-2/BRD.md` |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
