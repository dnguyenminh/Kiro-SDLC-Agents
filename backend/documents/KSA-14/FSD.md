# Functional Specification Document (FSD)

## Kiro SDLC Agents Extension — KSA-14: Release v1.0.5 — Fix inject overwrite bug + per-file version tracking

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-14 |
| Title | Release v1.0.5 — Fix inject overwrite bug + per-file version tracking |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-05-10 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-14.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-10 | BA Agent | Initiate document from BRD KSA-14 |
| 1.0 | 2026-05-10 | TA Agent | Enriched with API contracts, technical details |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the Kiro SDLC Agents VS Code extension for releases v1.0.4 and v1.0.5. It details the fix for the inject overwrite bug and the new per-file version tracking system.

### 1.2 Scope

- Fix `detectModifiedFiles` to remove version-gating logic
- Implement per-file workspace manifest (`.kiro/.sdlc-manifest.json`)
- Implement `safeUpdate` with smart overwrite logic
- Implement `getVersionReport` for per-file status display
- Implement `migrateLegacyVersion` for backward compatibility

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| Workspace Manifest | `.kiro/.sdlc-manifest.json` — JSON file tracking per-file version/hash |
| Bundled Manifest | `resources/.sdlc-checksums.json` — expected file hashes shipped with extension |
| Inject | Copy bundled resource files into user's workspace |
| Safe Update | Update that auto-overwrites outdated files, prompts for user-modified files |
| Hash | SHA-256 digest of file content |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-14.docx |
| VS Code Extension API | https://code.visualstudio.com/api |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

The extension operates within VS Code, interacting with:
- **User** — triggers commands via Command Palette
- **Workspace File System** — reads/writes agent files and manifest
- **Extension Bundle** — contains bundled resources and checksums manifest

### 2.2 System Architecture

The extension consists of three core modules:
1. **extension.ts** — VS Code command registration and UI interaction
2. **checksum.ts** — Per-file version tracking, hash computation, manifest management
3. **injector.ts** — File injection logic, safe update, version report generation

---

## 3. Functional Requirements

### 3.1 Feature: Fix Inject Overwrite Bug (v1.0.4)

**Source:** BRD Story 1, Story 2

#### 3.1.1 Description

Remove version-gating logic from `detectModifiedFiles()` that previously skipped all file entries when the workspace version didn't match the bundled version. The function must now compare file hashes directly regardless of version.

#### 3.1.2 Use Case

**Use Case ID:** UC-01
**Actor:** Developer
**Preconditions:** Extension v1.0.4+ installed; workspace has files from older version
**Postconditions:** All bundled files are present in workspace at current version

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Runs "Inject All" | | Developer triggers command from palette |
| 2 | | Copies all bundled files | System overwrites all workspace files unconditionally |
| 3 | | Calls `buildManifestAfterInject()` | Records version + hash for each file |
| 4 | | Shows success notification | "✅ Injected N components" |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | User cancels confirmation dialog | No files are modified; operation aborted |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | File system permission denied | Show error message; skip that file; continue with others |
| EF-02 | Bundled manifest missing | Show error "Extension package corrupted"; abort |

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-01 | "Inject All" MUST overwrite all files without version comparison | BRD Story 1 |
| BR-02 | `detectModifiedFiles` MUST NOT skip entries based on version mismatch | BRD Story 2 |
| BR-03 | After any inject/update, manifest MUST be updated | BRD Story 1, 2 |

---

### 3.2 Feature: Safe Update with Smart Overwrite

**Source:** BRD Story 2

#### 3.2.1 Description

`safeUpdate()` provides an intelligent update mechanism that distinguishes between outdated files (version mismatch) and user-modified files (content changed by user). It auto-overwrites when safe and prompts when user customizations are at risk.

#### 3.2.2 Use Case

**Use Case ID:** UC-02
**Actor:** Developer
**Preconditions:** Extension has newer bundled files than workspace
**Postconditions:** Workspace files updated; user modifications handled per user choice

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Runs "Update Agents" | | Developer triggers update command |
| 2 | | Calls `migrateLegacyVersion()` | Ensures manifest format is current |
| 3 | | Calls `detectModifiedFiles()` | Finds files with hash mismatch |
| 4 | | Calls `getFileStatuses()` | Classifies: outdated vs modified |
| 5 | | Checks if only outdated | Decision point |
| 6a | | Auto-overwrites all | If no user-modified files exist |
| 6b | | Shows prompt | If user-modified files exist |
| 7 | Selects action | | "Overwrite All" / "Skip Modified" / "Backup & Overwrite" |
| 8 | | Executes chosen action | Updates files accordingly |
| 9 | | Calls `buildManifestAfterInject()` | Records new state |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-02 | No files need update | Show "All files match bundled version. No update needed." |
| AF-03 | User selects "Skip Modified" | Only overwrite outdated files; leave modified untouched |
| AF-04 | User selects "Backup & Overwrite" | Create backup copies in `.kiro/.sdlc-backup/{timestamp}/`, then overwrite all |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-03 | User cancels prompt | No files modified; operation aborted |

#### 3.2.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-04 | If only outdated files exist, auto-overwrite without prompt | BRD Story 2 |
| BR-05 | "Overwrite All (recommended)" must be the default/first option | BRD Story 2 |
| BR-06 | "Skip Modified" must leave user-modified files untouched | BRD Story 2 |
| BR-07 | "Backup & Overwrite" must create backup in `.kiro/.sdlc-backup/{timestamp}/` before overwriting | BRD Story 2 |

#### 3.2.4 Data Specifications

**File Classification States:**

| State | Condition | Description |
|-------|-----------|-------------|
| `current` | wsVersion == bundledVersion AND hash matches | File is up-to-date |
| `outdated` | wsVersion != bundledVersion | File needs update (version mismatch) |
| `modified` | wsVersion == bundledVersion AND hash differs | User modified the file |
| `missing` | File doesn't exist in workspace | File needs injection |

---

### 3.3 Feature: Per-File Version Tracking

**Source:** BRD Story 3

#### 3.3.1 Description

Replace single `.kiro/.sdlc-version` with per-file `.kiro/.sdlc-manifest.json`. Each file entry records its own version, SHA-256 hash, and injection timestamp.

#### 3.3.2 Use Case

**Use Case ID:** UC-03
**Actor:** Developer
**Preconditions:** Extension installed; workspace has injected files
**Postconditions:** Version report displayed in Output Channel

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Runs "Show File Versions" | | Developer triggers status command |
| 2 | | Calls `migrateLegacyVersion()` | Ensures manifest format is current |
| 3 | | Calls `getFileStatuses()` | Compares workspace vs bundled |
| 4 | | Calls `getVersionReport()` | Generates formatted report |
| 5 | | Opens Output Channel | Displays report to user |

#### 3.3.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-08 | Report MUST show `[v{old} → v{new}]` for outdated files | BRD Story 3 |
| BR-09 | Report MUST group files by state | BRD Story 3 |
| BR-10 | Report header MUST show extension version and file count summary | BRD Story 3 |

#### 3.3.4 Data Specifications

**WorkspaceManifest Schema:**

```json
{
  "lastUpdated": "2026-05-10T10:00:00.000Z",
  "files": {
    ".kiro/agents/sm-agent.md": {
      "version": "1.0.5",
      "hash": "a1b2c3d4...",
      "injectedAt": "2026-05-10T10:00:00.000Z"
    }
  }
}
```

**ChecksumManifest (Bundled) Schema:**

```json
{
  "version": "1.0.5",
  "generatedAt": "2026-05-10T09:00:00.000Z",
  "files": {
    ".kiro/agents/sm-agent.md": {
      "hash": "a1b2c3d4...",
      "version": "1.0.5",
      "injectedAt": "2026-05-10T09:00:00.000Z"
    }
  }
}
```

#### 3.3.5 Version Report Output Format

```
Extension version: 1.0.5
Files: 12 current, 3 outdated, 1 modified, 0 missing

⬆️ Outdated (need update):
  .kiro/agents/sm-agent.md  [v1.0.3 → v1.0.5]
  .kiro/agents/ba-agent.md  [v1.0.3 → v1.0.5]
  .kiro/steering/drawio.md  [v1.0.4 → v1.0.5]

✏️ Modified by user (same version, different content):
  .kiro/agents/dev-agent.md  [v1.0.5]
```

---

### 3.4 Feature: Legacy Migration

**Source:** BRD Story 4

#### 3.4.1 Description

Auto-migrate from legacy `.kiro/.sdlc-version` (single version JSON) to new per-file `.kiro/.sdlc-manifest.json` on first extension activation after upgrade.

#### 3.4.2 Use Case

**Use Case ID:** UC-04
**Actor:** System (automatic on activation)
**Preconditions:** Legacy `.kiro/.sdlc-version` file exists
**Postconditions:** New manifest created; legacy file deleted

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Extension activates | VS Code starts extension |
| 2 | | Checks for legacy file | `fs.existsSync(".kiro/.sdlc-version")` |
| 3 | | Reads legacy version | Parse JSON, extract `version` field |
| 4 | | Scans workspace files | Find all files listed in bundled manifest |
| 5 | | Creates new manifest | Each existing file gets legacy version + current hash |
| 6 | | Saves new manifest | Write `.kiro/.sdlc-manifest.json` |
| 7 | | Deletes legacy file | `fs.unlinkSync(".kiro/.sdlc-version")` |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-05 | No legacy file exists | No-op; function returns immediately |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-04 | Legacy file is malformed JSON | Default to version "1.0.0"; continue migration |
| EF-05 | Cannot write new manifest | Log error; do NOT delete legacy file |

#### 3.4.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-11 | Migration MUST write new manifest BEFORE deleting legacy file | BRD Risk mitigation |
| BR-12 | Malformed legacy file defaults to version "1.0.0" | BRD Story 4 AC-4 |
| BR-13 | Migration is idempotent — if manifest already exists, skip | Implicit |

---

## 4. Data Model

### 4.1 Logical Entities

#### Entity: WorkspaceManifest

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| lastUpdated | ISO DateTime | Yes | BR-03 | When manifest was last modified |
| files | Map<string, FileEntry> | Yes | | Per-file tracking entries |

#### Entity: WorkspaceFileEntry

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| version | SemVer string | Yes | BR-08 | Version when file was injected |
| hash | SHA-256 hex string | Yes | BR-02 | Hash of file content at injection time |
| injectedAt | ISO DateTime | Yes | | Timestamp of injection |

#### Entity: ChecksumManifest (Bundled)

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| version | SemVer string | Yes | Extension version |
| generatedAt | ISO DateTime | Yes | When manifest was generated |
| files | Map<string, FileChecksum> | Yes | Expected file hashes |

#### Entity: FileStatus (Runtime)

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| relativePath | string | Yes | File path relative to workspace root |
| workspaceVersion | SemVer string | Yes | Version in workspace manifest |
| bundledVersion | SemVer string | Yes | Version in bundled manifest |
| state | enum | Yes | current / outdated / modified / missing |

**Relationships:**

| From Entity | To Entity | Cardinality | Description |
|-------------|-----------|-------------|-------------|
| WorkspaceManifest | WorkspaceFileEntry | 1:N | Manifest contains many file entries |
| ChecksumManifest | FileChecksum | 1:N | Bundled manifest contains expected hashes |

---

## 5. Integration Specifications

### 5.1 VS Code Extension API

| Attribute | Value |
|-----------|-------|
| Purpose | Register commands, show notifications, open output channels |
| Direction | Outbound (extension → VS Code) |
| Data Format | TypeScript API calls |
| Frequency | On-demand (user triggers) |

### 5.2 Node.js File System

| Attribute | Value |
|-----------|-------|
| Purpose | Read/write workspace files and manifests |
| Direction | Bidirectional |
| Data Format | UTF-8 text, JSON |
| Frequency | On every inject/update/status operation |

### 5.3 Node.js Crypto

| Attribute | Value |
|-----------|-------|
| Purpose | Compute SHA-256 hashes for file integrity |
| Direction | Inbound (crypto → extension) |
| Data Format | Binary → hex string |
| Frequency | Once per file per operation |

---

## 6. Processing Logic

### 6.1 detectModifiedFiles (v1.0.4 Fix)

**Trigger:** Called by `safeUpdate()` during "Update Agents"
**Input:** workspaceRoot, extensionPath
**Output:** Array of ModifiedFile objects

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Load bundled manifest | Return empty array if missing |
| 2 | For each file in bundled manifest | Continue loop on error |
| 3 | Check if file exists in workspace | Skip if missing |
| 4 | Compute SHA-256 hash of workspace file | Skip on read error |
| 5 | Compare hash with bundled hash | — |
| 6 | If different → add to modified list | — |

**Key Change (v1.0.4):** Step 2 no longer checks workspace version against bundled version. Previously, a version mismatch caused ALL entries to be skipped.

### 6.2 safeUpdate Decision Logic

**Trigger:** User runs "Update Agents" command
**Input:** workspaceRoot, extensionPath
**Output:** List of updated component IDs

**Pseudocode:**

```
function safeUpdate(root, extensionPath):
    migrateLegacyVersion(root, extensionPath)
    modified = detectModifiedFiles(root, extensionPath)
    
    if modified.length == 0:
        show "No update needed"
        return []
    
    statuses = getFileStatuses(root, extensionPath)
    outdated = statuses.filter(s => s.state == "outdated")
    userModified = statuses.filter(s => s.state == "modified")
    
    if outdated.length > 0 AND userModified.length == 0:
        return forceUpdate(root, extensionPath)  // Auto-overwrite
    
    action = promptUpdateWithDetails(outdated, userModified)
    switch action:
        "overwrite": return forceUpdate(root, extensionPath)
        "skip": return updateSkipModified(root, extensionPath, modified)
        "backup": return updateWithBackup(root, extensionPath, modified)
        "cancel": return []
```

### 6.3 buildManifestAfterInject

**Trigger:** After any successful inject or update
**Input:** workspaceRoot, extensionPath
**Output:** Updated `.kiro/.sdlc-manifest.json`

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Load bundled manifest | Return if missing |
| 2 | Create empty WorkspaceManifest | — |
| 3 | For each file in bundled manifest | — |
| 4 | Check if file exists in workspace | Skip if missing |
| 5 | Record: version from bundled, hash computed from file, current timestamp | — |
| 6 | Save manifest to `.kiro/.sdlc-manifest.json` | Log error on write failure |

---

## 7. Security Requirements

### 7.1 Authentication & Authorization

Not applicable — extension operates locally within user's VS Code instance. No network calls, no authentication required.

### 7.2 Data Sensitivity

| Data Type | Classification | Business Requirement |
|-----------|---------------|---------------------|
| File hashes | Internal | Used only for integrity comparison; not sensitive |
| File content | User-controlled | Extension reads but does not transmit file content |
| Manifest JSON | Internal | Local tracking only; no PII |

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | Hash computation must not block UI | < 100ms per file; files are < 50KB |
| Reliability | Migration must not lose data | Write new manifest before deleting legacy |
| Compatibility | Works with VS Code 1.85+ | Tested on minimum supported version |
| Usability | Version report is scannable | Grouped by state, shows version arrows |

---

## 9. Error Handling (User-Facing)

### 9.1 Error Scenarios

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| Bundled manifest missing | Critical | "Extension package may be corrupted" | Abort operation |
| File permission denied | Warning | "Could not update {file}: permission denied" | Skip file, continue |
| Legacy file malformed | Info | (silent) | Default to version "1.0.0", continue migration |
| No workspace open | Warning | "No workspace folder open" | Abort with message |

---

## 10. Testing Considerations

### 10.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-01 | Inject All overwrites older files | Workspace with v1.0.3 files | All files at v1.0.5 | High |
| TC-02 | Inject All overwrites modified files | Workspace with user-edited files | All files overwritten | High |
| TC-03 | Safe Update auto-overwrites outdated only | 3 outdated, 0 modified | All 3 updated, no prompt | High |
| TC-04 | Safe Update prompts for modified | 2 outdated, 1 modified | Prompt shown | High |
| TC-05 | Skip Modified leaves modified untouched | User selects "Skip Modified" | Modified file unchanged | High |
| TC-06 | Backup creates .bak files | User selects "Backup & Overwrite" | .bak files created | Medium |
| TC-07 | Version report shows outdated | 3 outdated files | Report shows [vOld → vNew] | Medium |
| TC-08 | Legacy migration creates manifest | .sdlc-version exists | .sdlc-manifest.json created | High |
| TC-09 | Legacy migration deletes old file | After successful migration | .sdlc-version deleted | High |
| TC-10 | Malformed legacy defaults to 1.0.0 | Invalid JSON in .sdlc-version | Version "1.0.0" used | Medium |

---

## 11. Appendix

### State Diagram — File Lifecycle

![State Diagram](diagrams/state-file-lifecycle.png)

### Sequence Diagram — Safe Update Flow

![Sequence Diagram](diagrams/sequence-safe-update.png)

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence — Safe Update | [sequence-safe-update.png](diagrams/sequence-safe-update.png) | [sequence-safe-update.drawio](diagrams/sequence-safe-update.drawio) |
| 3 | State — File Lifecycle | [state-file-lifecycle.png](diagrams/state-file-lifecycle.png) | [state-file-lifecycle.drawio](diagrams/state-file-lifecycle.drawio) |
