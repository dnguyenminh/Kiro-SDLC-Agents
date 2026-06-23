# Functional Specification Document (FSD)

## Kiro SDLC Agents Extension — KSA-4: Indexer Selection — Choose ONE Language

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-4 |
| Title | Indexer Selection — Choose ONE Language |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2025-07-10 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-4.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-10 | BA Agent | Initiate document — functional specification from BRD |
| 1.0 | 2025-07-10 | TA Agent | Enriched with API contracts, technical integration details |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the Indexer Selection feature — a VS Code QuickPick UI that allows users to choose exactly one code indexer language during the SDLC resource injection flow.

### 1.2 Scope

- QuickPick UI presentation and interaction behavior
- Single-selection constraint enforcement
- Integration with `injectAll()` and `injectSelective()` flows
- Base config copy behavior (always included)
- Selected language script copy behavior

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| QuickPick | VS Code's built-in list/dropdown UI component |
| INDEXER_OPTIONS | Array of 5 Component objects defining available indexer languages |
| INDEXER_BASE | Component object defining base config files always copied |
| canPickMany | VS Code QuickPick property controlling single vs multi-select |
| Component | TypeScript interface with id, label, description, sourcePath, targetPath, filter |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-4.docx |
| VS Code QuickPick API | https://code.visualstudio.com/api/references/vscode-api#window.showQuickPick |
| Extension config.ts | kiro-sdlc-agents/src/config.ts |
| Injector module | kiro-sdlc-agents/src/injector.ts |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

The Indexer Selection feature operates within the VS Code extension host. It is invoked by the Injector module during injection flows and interacts with the VS Code QuickPick API to present options to the user. Upon selection, it returns the chosen Component to the Injector which handles the actual file copy.

### 2.2 System Architecture

The feature consists of:
- **pickIndexer()** function in `injector.ts` — orchestrates the QuickPick
- **INDEXER_OPTIONS** config in `config.ts` — defines the 5 options
- **INDEXER_BASE** config in `config.ts` — defines base files always copied
- **VS Code QuickPick API** — renders the UI

---

## 3. Functional Requirements

### 3.1 Feature: Indexer Language Picker

**Source:** BRD Story 1, Story 2

#### 3.1.1 Description

The `pickIndexer()` function displays a VS Code QuickPick dialog with 5 indexer language options. The user selects exactly one option. The function returns the selected `Component` object or `undefined` if cancelled.

#### 3.1.2 Use Case: UC-1 — Select Indexer Language

**Use Case ID:** UC-1
**Actor:** Developer
**Preconditions:**
- VS Code workspace is open
- User has triggered "Inject All" or "Inject Selective" (with indexer selected)
- Extension is activated

**Postconditions:**
- Selected: `pickIndexer()` returns the chosen Component
- Cancelled: `pickIndexer()` returns undefined

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Triggers inject command | | User invokes kiroSdlc.injectAll or kiroSdlc.injectSelective |
| 2 | | Calls pickIndexer() | Injector module invokes the picker function |
| 3 | | Displays QuickPick | Shows 5 options with labels and descriptions |
| 4 | Selects one language | | User clicks or presses Enter on an option |
| 5 | | Returns Component | pickIndexer() returns the selected INDEXER_OPTIONS entry |
| 6 | | Copies INDEXER_BASE | Injector copies base config (filtered copy) |
| 7 | | Copies selected scripts | Injector copies language directory (recursive copy) |
| 8 | | Shows success message | "✅ Injected {N} components: ..., indexer-{lang}" |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | User types filter text | QuickPick filters options by typed text; user selects from filtered list |
| AF-2 | User uses keyboard navigation | Arrow keys navigate options; Enter confirms selection |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | User presses ESC | QuickPick returns undefined; no indexer files copied; injection continues without indexer |
| EF-2 | User clicks outside QuickPick | Same as EF-1 — treated as cancellation |
| EF-3 | Source directory missing | injectComponent logs warning "Source not found: {path}"; returns false; injection reports partial success |

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-1 | Exactly ONE indexer language can be selected per injection operation | BRD Story 2 |
| BR-2 | Base config (INDEXER_BASE) is ALWAYS copied when any language is selected | BRD Story 3 |
| BR-3 | Cancellation results in NO indexer files copied (but core components still injected) | BRD Story 2 |
| BR-4 | QuickPick options are static — no async loading or runtime detection in this feature | BRD NFR |
| BR-5 | Existing indexer files in workspace are NOT deleted — only new files are added/overwritten | BRD Story 2 AC4 |

#### 3.1.4 Data Specifications

**Input Data:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| INDEXER_OPTIONS | Component[] | Yes | Array length = 5 | Static config array of indexer choices |
| canPickMany | boolean | Yes | Must be false | Enforces single-select |
| placeHolder | string | Yes | Non-empty | "Choose ONE indexer language for this workspace" |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| selected | Component \| undefined | The chosen indexer Component, or undefined if cancelled |
| selected.id | string | One of: "indexer-python", "indexer-java", "indexer-powershell", "indexer-bash", "indexer-nodejs" |
| selected.sourcePath | string | Relative path to source scripts in extension resources |
| selected.targetPath | string | Relative path to target in workspace |

#### 3.1.5 UI Specifications

**Screen: Indexer Language Picker (QuickPick)**

| No. | Element | Type | Required | Behavior | Validation |
|-----|---------|------|----------|----------|------------|
| 1 | QuickPick Container | vscode.QuickPick | Yes | Modal overlay at top of editor | canPickMany: false |
| 2 | Placeholder Text | string | Yes | "Choose ONE indexer language for this workspace" | Shown when input is empty |
| 3 | Filter Input | TextInput | Yes | Filters options as user types | Built-in VS Code behavior |
| 4 | Option: Python | QuickPickItem | Yes | label + description; first in list | — |
| 5 | Option: Java | QuickPickItem | Yes | label + description; second in list | — |
| 6 | Option: PowerShell | QuickPickItem | Yes | label + description; third in list | — |
| 7 | Option: Bash | QuickPickItem | Yes | label + description; fourth in list | — |
| 8 | Option: Node.js | QuickPickItem | Yes | label + description; fifth in list | — |

**QuickPick Item Details:**

| # | Label | Description | Component ID |
|---|-------|-------------|--------------|
| 1 | Python Indexer (recommended — zero dependency) | Python 3.7+ standard library only | indexer-python |
| 2 | Java Indexer | Java 17+ (for JVM projects) | indexer-java |
| 3 | PowerShell Indexer | PowerShell 5.1+ (Windows built-in) | indexer-powershell |
| 4 | Bash Indexer | Bash 4+ (Linux/Mac built-in) | indexer-bash |
| 5 | Node.js Indexer (most accurate) | Node.js 18+ (needs npm install) | indexer-nodejs |

#### 3.1.6 API Contract (Functional View)

> **Note:** This is an internal TypeScript function API, not an HTTP endpoint.

**Function:** `pickIndexer(): Promise<Component | undefined>`

**Purpose:** Present indexer language selection UI and return user's choice.

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| (none) | — | — | — | Function reads from INDEXER_OPTIONS config directly |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| return value | Component \| undefined | Selected Component object, or undefined if user cancelled |

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| User cancels | (none — silent) | User presses ESC or clicks outside QuickPick |
| Source not found | "Source not found: {sourcePath}" | Extension resources missing (corrupt install) |
| Copy failure | "Failed to inject {id}: {error}" | File system permission error or disk full |

---

### 3.2 Feature: Base Config Injection

**Source:** BRD Story 3

#### 3.2.1 Description

When a user selects any indexer language, the system first copies the `INDEXER_BASE` component using filtered copy. This ensures the workspace has the necessary configuration infrastructure regardless of which language was chosen.

#### 3.2.2 Use Case: UC-2 — Copy Base Config

**Use Case ID:** UC-2
**Actor:** System (automatic)
**Preconditions:** User has selected an indexer language (UC-1 returned a Component)
**Postconditions:** Base config files exist in workspace at `.analysis/code-intelligence/`

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Reads INDEXER_BASE.filter | Gets list: ["index-config.json", "modules", "scripts/README.md"] |
| 2 | | Calls injectComponent(INDEXER_BASE) | Triggers filtered copy |
| 3 | | copyFiltered() executes | Copies only items in filter list from source to target |
| 4 | | Creates target directories | mkdirSync with recursive: true |
| 5 | | Copies each filtered item | Files copied, directories recursively copied |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Filter item not found in source | Silently skipped; continues with remaining items |
| EF-2 | Target directory not writable | Throws error; caught by injectComponent; shows error message |

#### 3.2.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-6 | INDEXER_BASE is copied BEFORE the language-specific scripts | BRD Story 3 |
| BR-7 | Filter list is exact match — no glob patterns | KSA-3 Story 4 |
| BR-8 | If a filter item doesn't exist in source, it is silently skipped | KSA-3 Story 4 |

#### 3.2.4 Data Specifications

**INDEXER_BASE Configuration:**

| Field | Value | Description |
|-------|-------|-------------|
| id | "indexer-config" | Unique identifier |
| label | "Code Intelligence — Config (always included)" | Display name |
| sourcePath | ".analysis/code-intelligence" | Source in extension resources |
| targetPath | ".analysis/code-intelligence" | Target in workspace |
| filter | ["index-config.json", "modules", "scripts/README.md"] | Items to copy |

**Workspace Result After Base Config Copy:**

```
{workspaceRoot}/
└── .analysis/
    └── code-intelligence/
        ├── index-config.json          ← Configuration for indexer
        ├── modules/                   ← Output directory for module analysis
        └── scripts/
            └── README.md              ← Documentation for scripts directory
```

---

### 3.3 Feature: Language-Specific Script Copy

**Source:** BRD Story 2

#### 3.3.1 Description

After base config is copied, the system copies the selected language's script directory using recursive directory copy (with exclusion of build artifacts).

#### 3.3.2 Use Case: UC-3 — Copy Selected Language Scripts

**Use Case ID:** UC-3
**Actor:** System (automatic)
**Preconditions:** Base config copied (UC-2 complete), selected Component available
**Postconditions:** Selected language scripts exist in workspace

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Reads selected.sourcePath | e.g., ".analysis/code-intelligence/scripts/python" |
| 2 | | Resolves full source path | path.join(extensionPath, "resources", sourcePath) |
| 3 | | Resolves full target path | path.join(workspaceRoot, targetPath) |
| 4 | | Calls copyDirRecursive() | Recursively copies directory contents |
| 5 | | Skips excluded dirs | node_modules, __pycache__, .git, out, dist |
| 6 | | Returns true | Injection successful |

**Workspace Result After Language Copy (example: Python):**

```
{workspaceRoot}/
└── .analysis/
    └── code-intelligence/
        ├── index-config.json
        ├── modules/
        └── scripts/
            ├── README.md
            └── python/
                ├── main.py
                ├── config.py
                ├── detector.py
                ├── discovery.py
                ├── scanner.py
                ├── parser.py
                ├── patterns.py
                ├── generator.py
                └── utils.py
```

#### 3.3.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-9 | Only ONE language directory is copied per injection | BRD Story 2 |
| BR-10 | Excluded directories (node_modules, __pycache__, .git, out, dist) are never copied | KSA-3 Story 3 |
| BR-11 | Existing files at destination are overwritten without prompt | KSA-3 Story 1 |
| BR-12 | Other language directories already in workspace are NOT deleted | BRD Story 2 AC4 |

---

## 4. Data Model

### 4.1 Entity Relationship Diagram

This feature uses configuration objects (not database entities). The data model is the TypeScript interface hierarchy.

### 4.2 Logical Entities

#### Entity: Component

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| id | string | Yes | Unique across all components | Identifier (e.g., "indexer-python") |
| label | string | Yes | Displayed in QuickPick | Human-readable name with key trait |
| description | string | Yes | Displayed as secondary text | Version requirement and notes |
| sourcePath | string | Yes | Relative to extension resources | Where to copy from |
| targetPath | string | Yes | Relative to workspace root | Where to copy to |
| filter | string[] | No | Only for INDEXER_BASE | Whitelist of items to copy |

#### Entity: QuickPickItem (VS Code API)

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| label | string | Yes | From Component.label | Primary display text |
| description | string | Yes | From Component.description | Secondary display text |
| component | Component | Yes | Internal reference | Maps pick back to config |

**Relationships:**

| From Entity | To Entity | Cardinality | Description |
|-------------|-----------|-------------|-------------|
| INDEXER_OPTIONS | Component | 1:5 | Array contains exactly 5 Component entries |
| QuickPickItem | Component | 1:1 | Each pick item wraps one Component |
| INDEXER_BASE | Component | 1:1 | Single Component for base config |

---

## 5. Integration Specifications

### 5.1 Internal Integration: Injector Module

| Attribute | Value |
|-----------|-------|
| Purpose | pickIndexer() is called by injectAll() and injectSelective() |
| Direction | Inbound (Injector calls Picker) |
| Data Format | TypeScript function call/return |
| Frequency | On-demand (each injection operation) |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| Component \| undefined | injectAll() receives selection | Return | BR-1: exactly one or none |
| INDEXER_BASE | injectComponent() receives base config | Pass | BR-2: always copied first |

### 5.2 External Integration: VS Code QuickPick API

| Attribute | Value |
|-----------|-------|
| Purpose | Render the selection UI to the user |
| Direction | Outbound (extension calls VS Code API) |
| Data Format | QuickPickItem[] → Promise<QuickPickItem \| undefined> |
| Frequency | Once per injection operation |

**API Call:**

```typescript
vscode.window.showQuickPick(picks, {
    canPickMany: false,
    placeHolder: "Choose ONE indexer language for this workspace"
}): Promise<QuickPickItem | undefined>
```

---

## 6. Processing Logic

### 6.1 pickIndexer() Process

**Trigger:** Called by `injectAll()` or `injectSelective()` during injection flow
**Input:** INDEXER_OPTIONS config array (static)
**Output:** Component | undefined

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Map INDEXER_OPTIONS to QuickPickItem[] | N/A (static data) |
| 2 | Call vscode.window.showQuickPick() | Returns undefined on cancel |
| 3 | Return selected?.component | undefined propagates to caller |

**State Diagram:**

![State Diagram](diagrams/state-picker.png)

### 6.2 Injection Flow with Indexer Selection

**Trigger:** User confirms "Inject All" or selects indexer in "Inject Selective"
**Input:** workspaceRoot, extensionPath
**Output:** string[] (list of injected component IDs)

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Copy CORE_COMPONENTS (agents, steering, hooks, templates) | Log + skip on failure |
| 2 | Call pickIndexer() | If undefined → skip indexer, continue |
| 3 | Call injectComponent(INDEXER_BASE) | Log warning if source missing |
| 4 | Call injectComponent(selectedLanguage) | Log error if copy fails |
| 5 | Save workspace version | — |
| 6 | Return injected component IDs | — |

---

## 7. Security Requirements

### 7.1 Authentication & Authorization

| Role | Permissions | Screens/Features |
|------|-------------|-------------------|
| Any VS Code user | Full access | Indexer selection (no auth required — local extension) |

### 7.2 Data Sensitivity Classification

| Data Type | Classification | Business Requirement |
|-----------|---------------|---------------------|
| Indexer scripts | Public | Open-source scripts bundled with extension |
| Workspace paths | Internal | Used only locally, never transmitted |

### 7.3 Audit Trail

| Event | Logged Fields | Retention | Business Reason |
|-------|--------------|-----------|-----------------|
| Indexer selected | Language ID, timestamp | Session only (Output Channel) | Debugging injection issues |

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | QuickPick appears instantly | < 100ms from function call to UI display |
| Usability | Clear option differentiation | Each option has unique label + description |
| Usability | Keyboard-first workflow | Arrow keys + Enter to select without mouse |
| Accessibility | Screen reader support | VS Code QuickPick natively accessible |
| Extensibility | Easy to add 6th language | Add one entry to INDEXER_OPTIONS array |

---

## 9. Error Handling (User-Facing)

### 9.1 Error Scenarios

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| User cancels QuickPick | Info | (none) | Silent — no indexer copied, core components still injected |
| Source directory missing | Warning | "Source not found: {path}" | VS Code warning notification; injection continues without indexer |
| Copy fails (permission) | Error | "Failed to inject {id}: {error}" | VS Code error notification; partial injection reported |
| Extension resources corrupt | Error | "Source not found: {path}" | All indexer options fail; user must reinstall extension |

### 9.2 Notification Requirements

| Event | Who is Notified | Channel | Timing |
|-------|----------------|---------|--------|
| Successful injection | Developer | VS Code info message | Immediate after completion |
| Source not found | Developer | VS Code warning message | Immediate on detection |
| Copy failure | Developer | VS Code error message | Immediate on failure |

---

## 10. Testing Considerations

### 10.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-1 | Select Python indexer | User picks "Python Indexer" | indexer-python copied + base config | High |
| TC-2 | Select Java indexer | User picks "Java Indexer" | indexer-java copied + base config | High |
| TC-3 | Select PowerShell indexer | User picks "PowerShell Indexer" | indexer-powershell copied + base config | High |
| TC-4 | Select Bash indexer | User picks "Bash Indexer" | indexer-bash copied + base config | High |
| TC-5 | Select Node.js indexer | User picks "Node.js Indexer" | indexer-nodejs copied + base config | High |
| TC-6 | Cancel selection (ESC) | User presses ESC | No indexer files copied; returns undefined | High |
| TC-7 | Cancel by clicking outside | User clicks outside QuickPick | Same as TC-6 | Medium |
| TC-8 | QuickPick shows 5 options | Function called | 5 items displayed with correct labels | High |
| TC-9 | Single-select enforced | canPickMany = false | Only one item selectable | High |
| TC-10 | Base config always copied | Any language selected | index-config.json + modules/ + README exist | High |
| TC-11 | Only selected language copied | Select Python | Only python/ dir exists in scripts/ (others not added) | High |
| TC-12 | Existing files not deleted | Had bash/, select python | bash/ still exists, python/ added | Medium |
| TC-13 | Filter text works | Type "node" | Only Node.js option visible | Low |

---

## 11. Appendix

### Sequence Diagram

![Sequence Diagram — Inject All with Indexer Selection](diagrams/sequence-inject-all.png)

### Diagrams

| Diagram | File |
|---------|------|
| System Context | [system-context.png](diagrams/system-context.png) |
| Sequence — Inject All | [sequence-inject-all.png](diagrams/sequence-inject-all.png) |
| State — Picker | [state-picker.png](diagrams/state-picker.png) |

### Change Log from BRD

- No deviations from BRD. All 4 user stories mapped to functional use cases.
- Added technical detail on `copyFiltered()` vs `copyDirRecursive()` behavior.
- Clarified that existing language directories are NOT deleted (BR-12).

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence — Inject All | [sequence-inject-all.png](diagrams/sequence-inject-all.png) | [sequence-inject-all.drawio](diagrams/sequence-inject-all.drawio) |
| 3 | State — Picker | [state-picker.png](diagrams/state-picker.png) | [state-picker.drawio](diagrams/state-picker.drawio) |
