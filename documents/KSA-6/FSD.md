# Functional Specification Document (FSD)

## Kiro SDLC Agents Extension — KSA-6: Bundled Resources — Agents, Steering, Hooks, Templates

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-6 |
| Title | Bundled Resources — Agents, Steering, Hooks, Templates |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-05-10 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-6.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-10 | BA Agent | Initial FSD from BRD |
| 1.1 | 2026-05-10 | TA Agent | Technical enrichment — API contracts, build scripts detail |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the bundled resources system within the Kiro SDLC Agents VS Code extension. It defines how resources are structured, bundled during build, and injected into target workspaces at runtime.

### 1.2 Scope

- Resource file structure and naming conventions
- Build-time bundling process (copy + checksum generation)
- Runtime injection behavior (all/selective/update commands)
- Modification detection and safe update logic
- Resource inventory validation (counts match acceptance criteria)

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| Agent | AI agent definition consisting of JSON config + MD description + prompt file |
| Steering | Workspace-level rule file that guides agent behavior |
| Hook | Automated trigger that fires on file system events in Kiro IDE |
| Template | Markdown document template with placeholder variables |
| Injection | Process of copying bundled resources into a target workspace |
| Manifest | `.sdlc-checksums.json` — SHA-256 hash registry of all bundled files |
| VSIX | VS Code Extension package format |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-6.docx |
| Extension package.json | kiro-sdlc-agents/package.json |
| Config definitions | kiro-sdlc-agents/src/config.ts |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

The extension operates in two contexts:
1. **Build-time** — Developer machine running build scripts to bundle resources
2. **Runtime** — End-user's VS Code/Kiro IDE executing injection commands

**External Actors:**
- Extension Builder (runs sync + build)
- End-User Developer (runs inject/update commands)
- Source Project (MCPOrchestration — provides source files)
- Target Workspace (receives injected resources)
- VS Code Marketplace (distributes VSIX)

### 2.2 System Architecture

The bundled resources system consists of:
- **Source Layer** — MCPOrchestration project with canonical agent/steering/hook/template files
- **Sync Layer** — PowerShell script that copies changed files to extension workspace
- **Build Layer** — Node.js scripts that copy resources into extension package and generate checksums
- **Runtime Layer** — TypeScript extension code that injects resources into target workspaces

---

## 3. Functional Requirements

### 3.1 Feature: Resource Bundling (Build-Time)

**Source:** BRD Story 5, Story 6

#### 3.1.1 Description

During the extension build process (`npm run vscode:prepublish`), all SDLC resources are copied from the workspace root into the `resources/` directory inside the extension, and a checksum manifest is generated.

#### 3.1.2 Use Case: UC-1 — Bundle Resources

**Use Case ID:** UC-1
**Actor:** Extension Builder
**Preconditions:** Source files exist in workspace root directories (`.kiro/`, `documents/templates/`)
**Postconditions:** All resources copied to `resources/` with valid checksum manifest

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Builder | | Runs `npm run vscode:prepublish` |
| 2 | | copy-resources.js | Reads MAPPINGS array for source→destination pairs |
| 3 | | copy-resources.js | For each mapping, recursively copies files (skipping excluded dirs) |
| 4 | | gen-checksums.js | Scans all files in `resources/` |
| 5 | | gen-checksums.js | Computes SHA-256 hash for each file |
| 6 | | gen-checksums.js | Writes `.sdlc-checksums.json` with version from package.json |
| 7 | | tsc | Compiles TypeScript source |
| 8 | Builder | | Runs `vsce package` to create VSIX |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | Source directory missing | Log warning "SKIP: Source not found", continue with other mappings |
| AF-2 | File in SKIP_FILES list | Skip file silently, continue |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Write permission denied | Throw error, build fails |
| EF-2 | Disk full | Throw error, build fails |

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-1 | SKIP_DIRS: node_modules, __pycache__, out, dist, .git, settings | copy-resources.js |
| BR-2 | SKIP_FILES: mcp.json, mcp.json,bk | copy-resources.js |
| BR-3 | Checksum algorithm MUST be SHA-256 | BRD Story 6 |
| BR-4 | Manifest version MUST match package.json version | BRD Story 6 |
| BR-5 | All 9 agents MUST be present after copy | BRD Story 1 |
| BR-6 | All 9 steering files MUST be present after copy | BRD Story 2 |
| BR-7 | All 8 hooks MUST be present after copy | BRD Story 3 |
| BR-8 | At minimum 10 templates MUST be present after copy | BRD Story 4 |

#### 3.1.4 Data Specifications

**Input Data (MAPPINGS):**

| Source Path | Destination Path | Type |
|-------------|-----------------|------|
| .kiro/agents | .kiro/agents | Directory (recursive) |
| .kiro/hooks | .kiro/hooks | Directory (recursive) |
| .kiro/steering | .kiro/steering | Directory (recursive) |
| documents/templates | documents/templates | Directory (recursive) |
| .analysis/code-intelligence/index-config.json | .analysis/code-intelligence/index-config.json | Single file |

**Output Data (Checksum Manifest):**

| Field | Type | Description |
|-------|------|-------------|
| version | string | Extension version from package.json |
| generatedAt | ISO 8601 string | Timestamp of generation |
| files | Record<string, FileChecksum> | Map of relative path → checksum entry |
| files[path].hash | string (64 hex chars) | SHA-256 hash of file content |
| files[path].version | string | Version when file was added |
| files[path].injectedAt | ISO 8601 string | Same as generatedAt |

---

### 3.2 Feature: Resource Injection (Runtime)

**Source:** BRD Story 1, 2, 3, 4

#### 3.2.1 Description

When a user runs an injection command, the extension copies resources from its bundled `resources/` directory into the target workspace, creating the standard SDLC directory structure.

#### 3.2.2 Use Case: UC-2 — Inject All Agents

**Use Case ID:** UC-2
**Actor:** End-User Developer
**Preconditions:** Extension installed, workspace folder open
**Postconditions:** All resources injected, `.kiro/.sdlc-version` created

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | User | | Runs command "Kiro SDLC: Inject All Agents" |
| 2 | | Extension | Shows confirmation dialog |
| 3 | User | | Clicks "Yes" |
| 4 | | Extension | Iterates CORE_COMPONENTS (agents, steering, hooks, templates) |
| 5 | | Extension | For each component, copies source→target recursively |
| 6 | | Extension | Prompts user to pick indexer language |
| 7 | User | | Selects indexer (e.g., Python) |
| 8 | | Extension | Copies indexer base config + selected language scripts |
| 9 | | Extension | Saves `.kiro/.sdlc-version` with current version |
| 10 | | Extension | Shows success message with count of injected components |
| 11 | | Extension | If autoIndex enabled, runs code indexer |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | User cancels confirmation | Abort, no files copied |
| AF-2 | User cancels indexer pick | Skip indexer, inject core components only |
| AF-3 | Source component missing | Show warning, skip that component, continue |

#### 3.2.3 Use Case: UC-3 — Inject Selective

**Use Case ID:** UC-3
**Actor:** End-User Developer
**Preconditions:** Extension installed, workspace folder open
**Postconditions:** Selected resources injected

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | User | | Runs command "Kiro SDLC: Inject (Select Components)" |
| 2 | | Extension | Shows multi-select QuickPick with all components |
| 3 | User | | Selects desired components (checkboxes) |
| 4 | | Extension | Injects only selected components |
| 5 | | Extension | If "indexer" selected, prompts for language choice |
| 6 | | Extension | Saves version file |

#### 3.2.4 Use Case: UC-4 — Safe Update

**Use Case ID:** UC-4
**Actor:** End-User Developer
**Preconditions:** Resources previously injected, new extension version available
**Postconditions:** Resources updated while respecting user modifications

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | User | | Runs command "Kiro SDLC: Update Agents (Keep Customizations)" |
| 2 | | Extension | Loads bundled manifest, compares hashes with workspace files |
| 3 | | Extension | Identifies modified files (hash mismatch) |
| 4a | | Extension | If NO modifications: force update all files |
| 4b | | Extension | If modifications found: show warning with file list |
| 5 | User | | Chooses action: Skip Modified / Backup & Overwrite / Overwrite All / Cancel |
| 6 | | Extension | Executes chosen strategy |
| 7 | | Extension | Updates version file |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | "Skip Modified" chosen | Update all files EXCEPT those user modified |
| AF-2 | "Backup & Overwrite" chosen | Copy modified files to `.kiro/.sdlc-backup/{timestamp}/`, then overwrite all |
| AF-3 | "Overwrite All" chosen | Force overwrite everything |
| AF-4 | "Cancel" chosen | Abort, no changes |

#### 3.2.5 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-9 | Injection target paths mirror source paths (`.kiro/agents` → `.kiro/agents`) | config.ts |
| BR-10 | Skip directories during copy: node_modules, __pycache__, out, dist, .git | injector.ts |
| BR-11 | Version file location: `.kiro/.sdlc-version` | checksum.ts |
| BR-12 | Backup location: `.kiro/.sdlc-backup/{ISO-timestamp}/` | injector.ts |
| BR-13 | Modification detection compares SHA-256 of workspace file vs manifest hash | checksum.ts |
| BR-14 | Only files matching current version in manifest are checked for modifications | checksum.ts |

---

### 3.3 Feature: Status Check

**Source:** BRD Story 6

#### 3.3.1 Use Case: UC-5 — Show Status

**Use Case ID:** UC-5
**Actor:** End-User Developer
**Preconditions:** Workspace folder open
**Postconditions:** Status displayed (no file changes)

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | User | | Runs command "Kiro SDLC: Show Status" or clicks status bar |
| 2 | | Extension | Checks existence of each component's target path |
| 3 | | Extension | Detects modified files via checksum comparison |
| 4 | | Extension | Shows info message with ✅/❌ per component + modification count |
| 5 | User | | Optionally clicks "Inject Missing" or "Show Modified" |

---

### 3.4 Feature: Upgrade Notification

#### 3.4.1 Use Case: UC-6 — Auto Upgrade Check

**Use Case ID:** UC-6
**Actor:** System (on extension activation)
**Preconditions:** Extension activated, workspace has `.kiro/.sdlc-version`
**Postconditions:** User notified if upgrade available

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Extension | On activation, reads workspace version file |
| 2 | | Extension | Compares workspace version with bundled manifest version |
| 3 | | Extension | If versions differ, shows notification with "Update Now" / "Later" |
| 4 | User | | Clicks "Update Now" |
| 5 | | Extension | Triggers safe update flow (UC-4) |

---

## 4. Data Model

### 4.1 Logical Entities

#### Entity: Component

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Unique identifier (e.g., "agents", "steering") |
| label | string | Yes | Display name for QuickPick UI |
| description | string | Yes | Short description for QuickPick |
| sourcePath | string | Yes | Relative path within `resources/` |
| targetPath | string | Yes | Relative path in target workspace |
| filter | string[] | No | If set, only copy these items from source |

#### Entity: ChecksumManifest

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| version | string | Yes | Extension version |
| generatedAt | ISO 8601 | Yes | Generation timestamp |
| files | Record | Yes | Map of path → FileChecksum |

#### Entity: FileChecksum

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| hash | string (64 hex) | Yes | SHA-256 hash |
| version | string | Yes | Version when added |
| injectedAt | ISO 8601 | Yes | Injection timestamp |

#### Entity: VersionInfo

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| version | string | Yes | Injected extension version |
| injectedAt | ISO 8601 | Yes | When injection occurred |

---

## 5. Integration Specifications

### 5.1 External System: Source Project (MCPOrchestration)

| Attribute | Value |
|-----------|-------|
| Purpose | Provides canonical source files for all agents, steering, hooks, templates |
| Direction | Inbound (source → extension) |
| Data Format | Markdown, JSON, Shell scripts |
| Frequency | On-demand (developer runs sync script) |

**Data Exchange:**

| Our Data | External Data | Direction | Rule |
|----------|--------------|-----------|------|
| resources/.kiro/agents/* | .kiro/agents/* | Receive | Byte-identical copy |
| resources/.kiro/steering/* | .kiro/steering/* | Receive | Byte-identical copy |
| resources/.kiro/hooks/* | .kiro/hooks/* | Receive | Byte-identical copy |
| resources/documents/templates/* | documents/templates/* | Receive | Byte-identical copy |

### 5.2 External System: VS Code API

| Attribute | Value |
|-----------|-------|
| Purpose | Extension host providing commands, QuickPick, notifications |
| Direction | Bidirectional |
| Data Format | TypeScript API calls |
| Frequency | Real-time (user interactions) |

---

## 6. Processing Logic

### 6.1 Copy Resources Process

**Trigger:** `npm run copy-resources` (build script)
**Input:** Workspace root directories
**Output:** Populated `resources/` directory

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Read MAPPINGS array | Fatal if script fails to load |
| 2 | For each mapping, resolve absolute source path | Skip if source doesn't exist |
| 3 | Check if source is file or directory | Handle both cases |
| 4 | If directory: recursively copy, skipping SKIP_DIRS | Log skipped dirs |
| 5 | If file: copy single file | Skip if in SKIP_FILES |
| 6 | Count and report total files copied | Print summary |

### 6.2 Checksum Generation Process

**Trigger:** `npm run gen-checksums` (build script, after copy-resources)
**Input:** All files in `resources/` directory
**Output:** `.sdlc-checksums.json`

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Read package.json for version | Fatal if missing |
| 2 | Recursively scan `resources/` for all files | Skip directories |
| 3 | For each file, compute SHA-256 hash | Fatal on read error |
| 4 | Build manifest object with version + timestamp | — |
| 5 | Write JSON to `resources/.sdlc-checksums.json` | Fatal on write error |

### 6.3 Modification Detection Process

**Trigger:** Update command or status check
**Input:** Bundled manifest + workspace files
**Output:** List of ModifiedFile objects

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Load bundled manifest from extension path | Return empty if missing |
| 2 | Load workspace version file | Use manifest version as fallback |
| 3 | For each file in manifest matching current version | — |
| 4 | Check if workspace file exists | Skip if not exists (not modified, just missing) |
| 5 | Compute SHA-256 of workspace file | Skip on read error |
| 6 | Compare with manifest hash | If different → add to modified list |

---

## 7. Security Requirements

### 7.1 Data Sensitivity

| Data Type | Classification | Requirement |
|-----------|---------------|-------------|
| Agent prompts | Internal | No secrets in prompts; prompts are distributable |
| Steering rules | Internal | No secrets; workspace-level guidance only |
| Checksums | Public | Integrity verification, not security-sensitive |
| User workspace files | User-owned | Extension must not transmit workspace data externally |

### 7.2 Security Rules

| Rule | Description |
|------|-------------|
| No network calls | Extension does NOT make any network requests during injection |
| Local-only operations | All file operations are local filesystem only |
| No telemetry | Extension does not collect or send usage data |
| Safe file operations | Never delete user files; only create/overwrite with confirmation |

---

## 8. Non-Functional Requirements

| Category | Requirement | Acceptance Criteria |
|----------|-------------|---------------------|
| Performance | Injection completes quickly | < 3 seconds for full inject on SSD |
| Performance | Checksum generation fast | < 2 seconds for ~60 files |
| Reliability | No data loss during update | Backup option preserves all modified files |
| Compatibility | VS Code 1.85+ | Extension activates without errors |
| Package Size | VSIX stays small | < 5 MB total (text-only resources) |

---

## 9. Error Handling

### 9.1 Error Scenarios

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| No workspace open | Warning | "No workspace folder open." | Command aborts gracefully |
| Source component missing | Warning | "Source not found: {path}" | Skip component, continue others |
| Injection write fails | Error | "Failed to inject {id}: {error}" | Report error, continue others |
| Manifest missing | Info | (silent) | Treat as no modifications detected |
| Version file missing | Info | (silent) | Treat as upgrade available |

---

## 10. Testing Considerations

### 10.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-1 | Inject all into empty workspace | Empty workspace | All 4 components + indexer injected | High |
| TC-2 | Inject selective (agents only) | Select "agents" | Only .kiro/agents/ created | High |
| TC-3 | Update with no modifications | Previously injected, no changes | All files updated silently | High |
| TC-4 | Update with modifications | User edited steering file | Warning shown with options | High |
| TC-5 | Backup and overwrite | Modified files exist | Backup created, then overwrite | Medium |
| TC-6 | Status check — all present | All components injected | All ✅ in status | Medium |
| TC-7 | Status check — missing components | Only agents injected | Mix of ✅ and ❌ | Medium |
| TC-8 | Upgrade notification | Workspace v1.0.2, extension v1.0.3 | Notification shown | Medium |
| TC-9 | Count validation — 9 agents | After inject | Exactly 9 agent .json + .md pairs | High |
| TC-10 | Count validation — 9 steering | After inject | Exactly 9 .md files in steering/ | High |
| TC-11 | Count validation — 8 hooks | After inject | Exactly 8 files in hooks/ | High |
| TC-12 | Count validation — 12 templates | After inject | 12 .md files in templates/ | High |
| TC-13 | Checksum integrity | After gen-checksums | All hashes match file content | High |

---

## 11. Appendix

### Component Registry (CORE_COMPONENTS)

| ID | Source Path | Target Path | File Count |
|----|------------|-------------|------------|
| agents | .kiro/agents | .kiro/agents | 27 files (9×json + 9×md + 9×prompts) |
| steering | .kiro/steering | .kiro/steering | 9 files |
| hooks | .kiro/hooks | .kiro/hooks | 8 files |
| templates | documents/templates | documents/templates | 12 files |

### State Diagram — Update Flow

![State Diagram](diagrams/state-update-flow.png)

### Sequence Diagram — Inject All

![Sequence Diagram](diagrams/sequence-inject-all.png)

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence — Inject All | [sequence-inject-all.png](diagrams/sequence-inject-all.png) | [sequence-inject-all.drawio](diagrams/sequence-inject-all.drawio) |
| 3 | State — Update Flow | [state-update-flow.png](diagrams/state-update-flow.png) | [state-update-flow.drawio](diagrams/state-update-flow.drawio) |
