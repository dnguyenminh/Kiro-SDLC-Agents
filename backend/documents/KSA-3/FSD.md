# Functional Specification Document (FSD)

## Kiro SDLC Agent — KSA-3: Injector — Copy Resources to Workspace

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-3 |
| Title | Injector — Copy Resources to Workspace |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-01-20 |
| Status | Draft |
| Related BRD | documents/KSA-3/BRD.md |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-20 | BA Agent | Initiate document — auto-generated from BRD and Jira tickets |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the **Injector** module within the Kiro SDLC Agent VS Code extension. It defines how the system copies bundled resource files (agents, steering, hooks, templates, indexer scripts) from the extension's installation directory into the user's workspace, including recursive copy logic, directory exclusion, filtered copy, and status checking.

### 1.2 Scope

The Injector module provides four primary functions:
1. **injectAll()** — Copy all core components + one indexer language to workspace
2. **injectSelective()** — Present QuickPick UI for user to choose components
3. **copyDirRecursive() / copyFiltered()** — Low-level copy utilities with exclusion and filtering
4. **checkStatus()** — Report which components exist in the workspace

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| CORE_COMPONENTS | The four main injectable resource sets: agents, steering, hooks, templates |
| Injector | Module responsible for copying extension resources to workspace |
| QuickPick | VS Code's built-in multi-select dropdown UI component |
| extensionPath | Filesystem path where the VS Code extension is installed |
| workspaceRoot | Root directory of the currently open VS Code workspace |
| Indexer | Language-specific scripts that analyze source code |
| Filtered Copy | Copy operation that only includes items matching a whitelist |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | documents/KSA-3/BRD.md |
| VS Code Extension API | https://code.visualstudio.com/api |
| Node.js fs module | https://nodejs.org/api/fs.html |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)
*[Edit in draw.io](diagrams/system-context.drawio)*

### 2.2 System Architecture

The Injector module is a TypeScript module within the VS Code extension host process. It uses Node.js `fs` module for all file system operations. The module exposes functions that are called by the Extension Core (KSA-2) command handlers.

**Technology Stack:**
- Language: TypeScript
- Runtime: VS Code Extension Host (Node.js)
- File I/O: Node.js `fs/promises` (async)
- UI: VS Code QuickPick API
- Configuration: JSON (indexer-config)

---

## 3. Functional Requirements

### 3.1 Feature: Inject All Resources

**Source:** BRD Story 1

#### 3.1.1 Description

The `injectAll()` function copies all four CORE_COMPONENTS to their designated workspace paths, then copies the selected indexer language scripts using filtered copy. This is the primary injection path for first-time setup.

#### 3.1.2 Use Case

**Use Case ID:** UC-1
**Actor:** Developer
**Preconditions:** VS Code workspace is open; extension is activated
**Postconditions:** All CORE_COMPONENTS and selected indexer exist in workspace

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Triggers "Inject All" command | | Developer executes command via palette |
| 2 | | Resolves extensionPath and workspaceRoot | System gets paths from VS Code API |
| 3 | | Validates indexerLanguage parameter | Checks against allowed enum values |
| 4 | | Calls injectComponent() for each CORE_COMPONENT | Copies agents, steering, hooks, templates |
| 5 | | Calls copyFiltered() for indexer | Copies only selected language scripts |
| 6 | | Shows success notification | Displays summary of injected components |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | One component source dir missing | Log warning, skip that component, continue with remaining |
| AF-2 | Workspace already has components | Overwrite existing files without prompt |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | No workspace open | Show error: "Please open a workspace first" |
| EF-2 | Destination not writable | Show error with permission details, abort |
| EF-3 | Invalid indexer language | Show error listing valid options |

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-1 | All four CORE_COMPONENTS must be copied in a single injectAll() call | BRD Story 1 |
| BR-2 | Exactly one indexer language is copied per injectAll() call | BRD Story 1 |
| BR-3 | Existing files are overwritten without merge | BRD Business Flow Note |
| BR-4 | Excluded directories are never copied regardless of context | BRD Story 3 |

#### 3.1.4 Data Specifications

**Input Data:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| indexerLanguage | string | Y | Must be one of: "python", "java", "powershell", "bash", "nodejs" | Selected indexer language |
| extensionPath | string | Y | Must exist and contain resources/ subdirectory | Extension installation path |
| workspaceRoot | string | Y | Must be writable directory | Target workspace root |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Whether all components were injected |
| injectedComponents | string[] | List of successfully injected component names |
| errors | string[] | List of error messages for failed components |

---

### 3.2 Feature: Inject Selective Components

**Source:** BRD Story 2

#### 3.2.1 Description

The `injectSelective()` function presents a VS Code QuickPick multi-select dialog allowing the developer to choose which components to inject. Only selected components are copied.

#### 3.2.2 Use Case

**Use Case ID:** UC-2
**Actor:** Developer
**Preconditions:** VS Code workspace is open; extension is activated
**Postconditions:** Selected components exist in workspace

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Triggers "Inject Selective" command | | Developer executes command |
| 2 | | Builds QuickPick items list | Creates items for each CORE_COMPONENT + indexer options |
| 3 | | Shows QuickPick dialog | Multi-select enabled |
| 4 | Selects components and confirms | | Developer picks desired items |
| 5 | | Iterates selected items | Calls injectComponent() for each |
| 6 | | Shows success notification | Lists what was injected |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | User selects only indexer (no core) | Copy only indexer scripts |
| AF-2 | User selects all items | Equivalent to injectAll() |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | User presses ESC / cancels | No action taken, no notification |
| EF-2 | One component fails | Log error, continue with remaining, show partial success |

#### 3.2.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-5 | QuickPick must support multi-select | BRD Story 2 |
| BR-6 | Cancel action must not modify any files | BRD Story 2 AC-4 |
| BR-7 | Partial failure does not abort remaining copies | BRD Story 2 Error Handling |

#### 3.2.4 UI Specifications

**Screen: Component Selection QuickPick**

| No. | Element | Type | Required | Behavior | Validation |
|-----|---------|------|----------|----------|------------|
| 1 | Title | Text | Y | "Select components to inject" | Static |
| 2 | Agents item | QuickPickItem | Y | label: "Agents", description: "Multi-agent SDLC pipeline (.kiro/agents)" | N/A |
| 3 | Steering item | QuickPickItem | Y | label: "Steering", description: "Code standards and rules (.kiro/steering)" | N/A |
| 4 | Hooks item | QuickPickItem | Y | label: "Hooks", description: "Auto-trigger hooks (.kiro/hooks)" | N/A |
| 5 | Templates item | QuickPickItem | Y | label: "Templates", description: "Document templates (documents/templates)" | N/A |
| 6 | Indexer items | QuickPickItem[] | Y | One item per language: "Indexer — Python", "Indexer — Java", etc. | N/A |
| 7 | canPickMany | boolean | Y | Set to true for multi-select | N/A |

---

### 3.3 Feature: Recursive Directory Copy with Exclusions

**Source:** BRD Story 3

#### 3.3.1 Description

The `copyDirRecursive()` function performs a recursive copy of a source directory to a destination, skipping any directories whose names match the exclusion list.

#### 3.3.2 Use Case

**Use Case ID:** UC-3
**Actor:** System (internal)
**Preconditions:** Source directory exists; destination is writable
**Postconditions:** All non-excluded content copied to destination

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Reads source directory entries | Lists all files and subdirectories |
| 2 | | For each entry, checks if directory name is in exclusion list | Case-sensitive match |
| 3 | | If excluded: skip entirely | Do not recurse into excluded dirs |
| 4 | | If file: copy to destination | Preserves relative path |
| 5 | | If non-excluded directory: create in destination, recurse | Depth-first traversal |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Source directory does not exist | Throw error with path details |
| EF-2 | File copy fails (permission) | Throw error with file path and reason |

#### 3.3.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-8 | Exclusion list: node_modules, __pycache__, .git, out, dist | BRD Story 3 |
| BR-9 | Exclusion is case-sensitive, directory name only | BRD Story 3 Validation Rules |
| BR-10 | Exclusion applies at any depth | BRD Story 3 Validation Rules |
| BR-11 | Files with excluded names (not directories) are still copied | BRD Story 3 Validation Rules |

#### 3.3.4 Data Specifications

**Input Data:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| source | string | Y | Must be existing directory | Source directory path |
| destination | string | Y | Parent must be writable | Destination directory path |

**Processing Logic:**

```
function copyDirRecursive(source, destination):
    ensure destination directory exists (create if needed)
    entries = readDirectory(source)
    for each entry in entries:
        if entry.isDirectory:
            if entry.name in EXCLUDE_LIST:
                continue  // skip
            copyDirRecursive(source/entry.name, destination/entry.name)
        else:
            copyFile(source/entry.name, destination/entry.name)
```

---

### 3.4 Feature: Filtered Copy for Indexer

**Source:** BRD Story 4

#### 3.4.1 Description

The `copyFiltered()` function copies only specific items (files or directories) from a source directory based on a filter list. Used for indexer injection where only the selected language's files should be copied.

#### 3.4.2 Use Case

**Use Case ID:** UC-4
**Actor:** System (internal)
**Preconditions:** Source directory exists; filter list is non-empty
**Postconditions:** Only filtered items exist at destination

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Reads filter list from indexer-config | Gets array of item names for selected language |
| 2 | | For each item in filter list | Iterates the whitelist |
| 3 | | Checks if item exists in source | Exact name match |
| 4 | | If directory: calls copyDirRecursive() | Exclusion rules still apply |
| 5 | | If file: copies directly | Simple file copy |
| 6 | | If not found: skip silently | No error for missing filter items |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Empty filter list | Log warning, return without copying |
| EF-2 | Source directory missing | Throw error |

#### 3.4.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-12 | Only items in filter list are copied | BRD Story 4 AC-1 |
| BR-13 | Filter matching is exact (no glob/regex) | BRD Story 4 Validation |
| BR-14 | Missing filter items are silently skipped | BRD Story 4 Error Handling |
| BR-15 | Exclusion rules (BR-8) still apply within filtered directories | BRD Story 4 AC-4 |

---

### 3.5 Feature: Check Component Status

**Source:** BRD Story 5

#### 3.5.1 Description

The `checkStatus()` function examines the workspace and returns a status object indicating which components are currently installed (their target directories exist).

#### 3.5.2 Use Case

**Use Case ID:** UC-5
**Actor:** Developer / System
**Preconditions:** workspaceRoot is available
**Postconditions:** Status object returned (no file modifications)

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Requests status (or system checks internally) | | Trigger |
| 2 | | Checks existence of .kiro/agents | fs.existsSync or fs.access |
| 3 | | Checks existence of .kiro/steering | Same |
| 4 | | Checks existence of .kiro/hooks | Same |
| 5 | | Checks existence of documents/templates | Same |
| 6 | | Checks existence of .analysis/code-intelligence/scripts | Same |
| 7 | | Returns status object | All boolean values |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Workspace path invalid | Return all false with error flag |
| EF-2 | Permission denied on check | Treat as false (not exists) |

#### 3.5.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-16 | checkStatus() is read-only — no file modifications | BRD Story 5 AC-4 |
| BR-17 | All components default to false if workspace is invalid | BRD Story 5 Error Handling |

#### 3.5.4 Data Specifications

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| agents | boolean | .kiro/agents exists |
| steering | boolean | .kiro/steering exists |
| hooks | boolean | .kiro/hooks exists |
| templates | boolean | documents/templates exists |
| indexer | boolean | .analysis/code-intelligence/scripts exists |

---

## 4. Data Model

### 4.1 Entity Relationship Diagram

The Injector module does not have a persistent data model (no database). It operates on file system state. The logical entities are configuration objects:

![Data Model](diagrams/data-model.png)
*[Edit in draw.io](diagrams/data-model.drawio)*

### 4.2 Logical Entities

#### Entity: CoreComponent

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| name | string | Y | BR-1 | Component identifier (agents, steering, hooks, templates) |
| sourcePath | string | Y | — | Relative path within extension resources |
| destinationPath | string | Y | — | Relative path within workspace |
| description | string | Y | — | Human-readable description for UI |

#### Entity: IndexerConfig

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| languages | Map<string, string[]> | Y | BR-12 | Maps language name to filter list |

**Example indexer-config.json:**
```json
{
  "python": ["python"],
  "java": ["java"],
  "powershell": ["powershell"],
  "bash": ["bash"],
  "nodejs": ["nodejs"]
}
```

#### Entity: ComponentStatus

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| agents | boolean | Y | BR-16 | Whether .kiro/agents exists |
| steering | boolean | Y | BR-16 | Whether .kiro/steering exists |
| hooks | boolean | Y | BR-16 | Whether .kiro/hooks exists |
| templates | boolean | Y | BR-16 | Whether documents/templates exists |
| indexer | boolean | Y | BR-16 | Whether scripts directory exists |

---

## 5. Integration Specifications

### 5.1 External System: VS Code Extension Host API

| Attribute | Value |
|-----------|-------|
| Purpose | Provides workspace path, extension path, UI components, notifications |
| Direction | Bidirectional |
| Data Format | TypeScript API calls |
| Frequency | On-demand (user-triggered) |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| — | vscode.ExtensionContext.extensionUri | Receive | Resolves extensionPath |
| — | vscode.workspace.workspaceFolders[0].uri | Receive | Resolves workspaceRoot |
| QuickPickItem[] | vscode.window.showQuickPick() | Send/Receive | BR-5 multi-select |
| message string | vscode.window.showInformationMessage() | Send | Success notification |
| error string | vscode.window.showErrorMessage() | Send | Error notification |

### 5.2 External System: Node.js File System (fs)

| Attribute | Value |
|-----------|-------|
| Purpose | All file and directory operations |
| Direction | Bidirectional |
| Data Format | Node.js fs API |
| Frequency | Per file/directory during copy |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| path | fs.readdir() results | Receive | List directory entries |
| source, dest | fs.copyFile() | Send | Copy individual files |
| path | fs.mkdir() | Send | Create directories |
| path | fs.access() / fs.existsSync() | Send/Receive | BR-16 status check |
| path | fs.stat() | Receive | Determine file vs directory |

---

## 6. Processing Logic

### 6.1 injectAll Process

**Trigger:** User executes "Kiro: Inject All" command
**Schedule:** On-demand
**Input:** indexerLanguage (string)
**Output:** Success/failure notification

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Resolve extensionPath from context.extensionUri | Throw if null |
| 2 | Resolve workspaceRoot from workspace.workspaceFolders | Show error if no workspace |
| 3 | Validate indexerLanguage against allowed values | Show error listing valid options |
| 4 | For each CORE_COMPONENT: call injectComponent(name) | Log error, continue with next |
| 5 | Load indexer-config.json | Throw if missing |
| 6 | Get filter list for indexerLanguage | Throw if language not in config |
| 7 | Call copyFiltered(scriptsSource, scriptsDest, filterList) | Log error |
| 8 | Show success notification with summary | — |

### 6.2 injectComponent Process

**Trigger:** Called by injectAll() or injectSelective()
**Input:** componentName (string)
**Output:** void (throws on critical error)

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Look up component source and destination paths | Throw if unknown component |
| 2 | Resolve full source path: extensionPath/resources/{sourcePath} | Throw if not exists |
| 3 | Resolve full destination path: workspaceRoot/{destinationPath} | — |
| 4 | Call copyDirRecursive(fullSource, fullDest) | Propagate error |

### 6.3 copyDirRecursive Process

**Trigger:** Called by injectComponent() or copyFiltered()
**Input:** source (string), destination (string)
**Output:** void (throws on error)

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Ensure destination directory exists (mkdir -p) | Throw on permission error |
| 2 | Read source directory entries with file types | Throw if source missing |
| 3 | For each entry: check if directory name is in EXCLUDE_LIST | — |
| 4 | If excluded directory: skip (continue) | — |
| 5 | If non-excluded directory: recurse into it | Propagate errors |
| 6 | If file: copy from source to destination | Throw on write error |

### 6.4 copyFiltered Process

**Trigger:** Called by injectAll() for indexer injection
**Input:** source, destination, filterList (string[])
**Output:** void

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Validate filterList is non-empty | Log warning, return early |
| 2 | Ensure destination directory exists | Throw on permission error |
| 3 | For each item in filterList | — |
| 4 | Check if item exists in source directory | Skip silently if not found |
| 5 | If directory: call copyDirRecursive(source/item, dest/item) | Log error, continue |
| 6 | If file: copy directly | Log error, continue |

---

## 7. Security Requirements

### 7.1 Authentication & Authorization

| Role | Permissions | Screens/Features |
|------|-------------|-------------------|
| Developer (workspace owner) | Full access | All inject commands, status check |

No additional authentication is required — the extension operates within the user's VS Code session with their file system permissions.

### 7.2 Data Sensitivity Classification

| Data Type | Classification | Business Requirement |
|-----------|---------------|---------------------|
| Resource files (agents, steering, hooks, templates) | Internal | Extension-bundled, not user-sensitive |
| Workspace files | Internal | User's project files — overwrite with caution |
| Indexer scripts | Internal | Code analysis utilities |

### 7.3 Audit Trail

| Event | Logged Fields | Retention | Business Reason |
|-------|--------------|-----------|-----------------|
| Inject All executed | timestamp, components, indexerLanguage | Session | Debugging |
| Inject Selective executed | timestamp, selected components | Session | Debugging |
| Component copy error | timestamp, component, error message | Session | Troubleshooting |

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | Copy operation should feel instant for typical setups | Complete within 5 seconds for < 500 files |
| Availability | Extension must be responsive during copy | Use async I/O, don't block extension host |
| Compatibility | Must work on all VS Code supported platforms | Windows, macOS, Linux path handling |
| Reliability | Partial failure should not corrupt workspace | Each component copy is independent |

---

## 9. Error Handling (User-Facing)

### 9.1 Error Scenarios

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| No workspace open | Critical | "Please open a workspace before injecting resources." | Command aborts, no files modified |
| Invalid indexer language | Warning | "Invalid indexer language '{lang}'. Valid options: python, java, powershell, bash, nodejs" | Command aborts |
| Source directory missing | Warning | "Component '{name}' source not found. Skipping." | Skip component, continue |
| Permission denied on write | Critical | "Cannot write to workspace. Check file permissions." | Command aborts |
| Partial injection failure | Warning | "Injected {n} of {total} components. See output for errors." | Show partial success |

### 9.2 Notification Requirements

| Event | Who is Notified | Channel | Timing |
|-------|----------------|---------|--------|
| Successful injection | Developer | VS Code Information Message | Immediate |
| Partial failure | Developer | VS Code Warning Message | Immediate |
| Critical error | Developer | VS Code Error Message | Immediate |

---

## 10. Testing Considerations

### 10.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-1 | Inject all with valid language | indexerLanguage="python" | All 4 components + python indexer copied | High |
| TC-2 | Inject all with invalid language | indexerLanguage="ruby" | Error message shown, no files copied | High |
| TC-3 | Inject all — no workspace open | No workspace | Error: "Please open a workspace" | High |
| TC-4 | Selective inject — select 2 components | User picks agents + hooks | Only agents and hooks copied | High |
| TC-5 | Selective inject — cancel | User presses ESC | No files modified | Medium |
| TC-6 | Copy recursive — excludes node_modules | Source has node_modules/ | node_modules not in destination | High |
| TC-7 | Copy recursive — excludes __pycache__ | Source has __pycache__/ | __pycache__ not in destination | High |
| TC-8 | Copy recursive — excludes .git | Source has .git/ | .git not in destination | High |
| TC-9 | Copy recursive — file named "dist" | Source has file named "dist" | File IS copied (not directory) | Medium |
| TC-10 | Filtered copy — valid filter | filter=["python"] | Only python/ dir copied | High |
| TC-11 | Filtered copy — item not in source | filter=["nonexistent"] | No error, nothing copied | Medium |
| TC-12 | Filtered copy — empty filter | filter=[] | Warning logged, nothing copied | Low |
| TC-13 | checkStatus — all components present | All dirs exist | All true | High |
| TC-14 | checkStatus — no components | Empty workspace | All false | High |
| TC-15 | checkStatus — partial | Only agents exists | agents=true, rest=false | Medium |
| TC-16 | Overwrite existing files | Component already exists | Files overwritten without error | High |
| TC-17 | Cross-platform paths | Windows backslash paths | Correct path resolution | High |

---

## 11. Appendix

### Diagrams

| Diagram | File |
|---------|------|
| System Context | [system-context.png](diagrams/system-context.png) |
| Use Case | [use-case.png](diagrams/use-case.png) |
| Business Flow | [business-flow.png](diagrams/business-flow.png) |

### Change Log from BRD

No deviations from BRD. All functional specifications are directly traceable to BRD requirements.

### Component Path Mapping (Reference)

| Component | Source (relative to extensionPath) | Destination (relative to workspaceRoot) |
|-----------|-----------------------------------|----------------------------------------|
| agents | resources/agents | .kiro/agents |
| steering | resources/steering | .kiro/steering |
| hooks | resources/hooks | .kiro/hooks |
| templates | resources/templates | documents/templates |
| indexer (python) | resources/scripts/python | .analysis/code-intelligence/scripts/python |
| indexer (java) | resources/scripts/java | .analysis/code-intelligence/scripts/java |
| indexer (powershell) | resources/scripts/powershell | .analysis/code-intelligence/scripts/powershell |
| indexer (bash) | resources/scripts/bash | .analysis/code-intelligence/scripts/bash |
| indexer (nodejs) | resources/scripts/nodejs | .analysis/code-intelligence/scripts/nodejs |
