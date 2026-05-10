# Functional Specification Document (FSD)

## Kiro SDLC Agents — KSA-12: Release v1.0.1 — Checksum management, CI/CD fixes, sync tooling

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-12 |
| Title | Release v1.0.1 — Checksum management, CI/CD fixes, sync tooling |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-05-10 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-12.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-10 | BA Agent | Initiate document from BRD |
| 1.1 | 2026-05-10 | TA Agent | Technical enrichment — API contracts, pseudocode |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of three subsystems introduced in Kiro SDLC Agents v1.0.1:
1. Checksum Management — per-file integrity tracking with safe update UX
2. CI/CD Workflows — GitHub Actions configuration for build and publish
3. Sync Tooling — cross-repository file synchronization script

### 1.2 Scope

Covers all user-facing and system-facing behaviors for the features described in BRD KSA-12. Includes use cases, data flows, processing logic, and error handling.

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| Bundled Manifest | `resources/.sdlc-checksums.json` — shipped inside VSIX, contains expected SHA-256 hashes |
| Workspace Manifest | `.kiro/.sdlc-manifest.json` — per-workspace file tracking injected versions |
| VSIX | VS Code Extension package format (.vsix) |
| Injection | Copying agent/steering/template files from extension resources into workspace |
| Safe Update | Update process that detects user modifications before overwriting |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-12.docx |
| Source: checksum.ts | kiro-sdlc-agents/src/checksum.ts |
| Source: injector.ts | kiro-sdlc-agents/src/injector.ts |
| Source: gen-checksums.js | kiro-sdlc-agents/scripts/gen-checksums.js |
| Source: sync-from-source.ps1 | scripts/sync-from-source.ps1 |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

The extension operates within VS Code, interacting with:
- **Workspace filesystem** — reads/writes manifest files and injected resources
- **Extension resources** — bundled manifest and resource files inside VSIX
- **Git CLI** — used by gen-checksums.js to read committed content
- **GitHub Actions** — CI/CD platform executing build and publish workflows
- **MCPOrchestration repo** — source for sync tooling

### 2.2 Component Overview

| Component | Location | Responsibility |
|-----------|----------|----------------|
| checksum.ts | src/checksum.ts | Hash computation, manifest I/O, file status detection |
| injector.ts | src/injector.ts | File injection, safe update logic, backup |
| extension.ts | src/extension.ts | VS Code command registration, UX orchestration |
| gen-checksums.js | scripts/gen-checksums.js | CI-time manifest generation from git |
| sync-from-source.ps1 | scripts/sync-from-source.ps1 | Cross-repo file sync |
| ci.yml | .github/workflows/ci.yml | CI build pipeline |
| publish.yml | .github/workflows/publish.yml | Publish pipeline |

---

## 3. Functional Requirements

### 3.1 Feature: Checksum Management System

**Source:** BRD Stories 1, 2, 3

#### 3.1.1 Description

The checksum management system provides per-file integrity tracking for all resources injected by the extension into a workspace. It enables detection of user modifications and safe update workflows.

#### 3.1.2 Use Cases

---

**Use Case ID:** UC-01
**Name:** Detect File Modification Status
**Actor:** Extension (automatic on activation)
**Preconditions:** Workspace has been previously injected (workspace manifest exists)
**Postconditions:** File statuses computed and available for display/update logic

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Extension | Load bundled manifest from `resources/.sdlc-checksums.json` |
| 2 | | Extension | Load workspace manifest from `.kiro/.sdlc-manifest.json` |
| 3 | | Extension | For each file in bundled manifest, compute current SHA-256 hash |
| 4 | | Extension | Compare: workspace version vs bundled version, current hash vs recorded hash |
| 5 | | Extension | Assign state: current / outdated / modified / missing |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Workspace manifest doesn't exist | Treat all files as "missing" state |
| AF-02 | Legacy .sdlc-version file exists | Migrate to per-file manifest first (UC-02), then proceed |
| AF-03 | Bundled manifest doesn't exist | Return empty status list (extension packaging error) |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Workspace manifest is corrupted JSON | Delete corrupted file, treat as missing |
| EF-02 | File read permission denied | Skip file, mark as "missing" with warning |

---

**Use Case ID:** UC-02
**Name:** Migrate Legacy Version File
**Actor:** Extension (automatic on activation)
**Preconditions:** `.kiro/.sdlc-version` exists in workspace
**Postconditions:** Per-file manifest created, legacy file deleted

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Extension | Read version from `.kiro/.sdlc-version` JSON |
| 2 | | Extension | Load bundled manifest to get file list |
| 3 | | Extension | For each bundled file that exists on disk, compute hash |
| 4 | | Extension | Create workspace manifest with legacy version for all existing files |
| 5 | | Extension | Save workspace manifest |
| 6 | | Extension | Delete `.kiro/.sdlc-version` |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Legacy file is invalid JSON | Use default version "1.0.0", continue migration |

---

**Use Case ID:** UC-03
**Name:** Safe Update with Modification Detection
**Actor:** Extension User
**Preconditions:** Upgrade available (bundled version > workspace version for at least one file)
**Postconditions:** Files updated according to user choice, manifest reflects new state

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | User | | Clicks "Update Now" from upgrade notification |
| 2 | | Extension | Detect modified files (hash comparison) |
| 3 | | Extension | Categorize: outdated (version mismatch), modified (hash mismatch) |
| 4 | | Extension | If no modified files → force update all outdated files |
| 5 | | Extension | If modified files exist → show modal with file details and options |
| 6 | User | | Selects: "Overwrite All" / "Skip Modified" / "Backup & Overwrite" / "Cancel" |
| 7 | | Extension | Execute chosen strategy |
| 8 | | Extension | Rebuild workspace manifest with new versions/hashes |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | User selects "Skip Modified" | Update only outdated files, leave modified files unchanged |
| AF-02 | User selects "Backup & Overwrite" | Copy modified files to `.kiro/.sdlc-backup/{timestamp}/`, then overwrite all |
| AF-03 | User selects "Cancel" | No changes made |

---

**Use Case ID:** UC-04
**Name:** Show Upgrade Notification
**Actor:** Extension (automatic on activation)
**Preconditions:** Extension activated, workspace has injected files
**Postconditions:** User informed of available upgrade

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Extension | Check `isUpgradeAvailable()` — any bundled file newer than workspace |
| 2 | | Extension | If upgrade available → show info message with version |
| 3 | User | | Selects "Update Now" / "Show Details" / "Later" |
| 4a | | Extension | "Update Now" → execute UC-03 |
| 4b | | Extension | "Show Details" → show version report in output channel |
| 4c | | Extension | "Later" → dismiss notification |

---

**Use Case ID:** UC-05
**Name:** Check Component Status
**Actor:** Extension User
**Preconditions:** Workspace open
**Postconditions:** Status displayed to user

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | User | | Clicks status bar item or runs `kiroSdlc.status` command |
| 2 | | Extension | Check existence of each component's target path |
| 3 | | Extension | Show info message with ✅/❌ per component |
| 4 | User | | Selects "Show File Versions" / "Inject Missing" / "Close" |
| 5a | | Extension | "Show File Versions" → show detailed report in output channel |
| 5b | | Extension | "Inject Missing" → trigger selective injection |

---

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-01 | File state is "modified" when current hash ≠ recorded hash AND version matches | BRD Story 1 |
| BR-02 | File state is "outdated" when workspace version < bundled version | BRD Story 1 |
| BR-03 | File state is "missing" when file doesn't exist on disk | BRD Story 1 |
| BR-04 | File state is "current" when hash matches AND version matches | BRD Story 1 |
| BR-05 | Legacy migration assigns the legacy version to ALL existing files | BRD Story 1 AC-5 |
| BR-06 | Backup directory uses ISO timestamp: `.kiro/.sdlc-backup/{timestamp}/` | BRD Story 3 |
| BR-07 | gen-checksums reads from git HEAD, not filesystem | BRD Story 5 |
| BR-08 | Sync only copies NEW or CHANGED files (MD5 comparison) | BRD Story 6 |
| BR-09 | Sync skips directories: settings, node_modules, __pycache__, out, dist, .git | BRD Story 6 |
| BR-10 | Sync skips files: mcp.json, mcp.json,bk | BRD Story 6 |

#### 3.1.4 Data Specifications

**Bundled Manifest (ChecksumManifest):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| version | string | Yes | Semver format | Extension version |
| generatedAt | string | Yes | ISO 8601 | Generation timestamp |
| files | Record<string, FileChecksum> | Yes | Non-empty | Per-file entries |
| files[].hash | string | Yes | 64-char hex | SHA-256 hash |
| files[].version | string | Yes | Semver | File version |
| files[].injectedAt | string | Yes | ISO 8601 | Injection timestamp |

**Workspace Manifest (WorkspaceManifest):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| lastUpdated | string | Yes | ISO 8601 | Last manifest update |
| files | Record<string, WorkspaceFileEntry> | Yes | — | Per-file entries |
| files[].version | string | Yes | Semver | Injected version |
| files[].hash | string | Yes | 64-char hex | Hash at injection time |
| files[].injectedAt | string | Yes | ISO 8601 | When file was injected |

**File Status (computed):**

| Field | Type | Description |
|-------|------|-------------|
| relativePath | string | Path relative to workspace root |
| workspaceVersion | string | Version from workspace manifest |
| bundledVersion | string | Version from bundled manifest |
| state | "current" \| "outdated" \| "modified" \| "missing" | Computed state |

---

### 3.2 Feature: CI/CD Workflows

**Source:** BRD Stories 4, 5

#### 3.2.1 Description

GitHub Actions workflows for continuous integration (build verification) and continuous deployment (publish to marketplaces).

#### 3.2.2 Use Cases

---

**Use Case ID:** UC-06
**Name:** CI Build on Push/PR
**Actor:** CI Pipeline (GitHub Actions)
**Preconditions:** Push to main or PR targeting main with changes in `kiro-sdlc-agents/`
**Postconditions:** Build verified, VSIX package created

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Pushes code to main or opens PR |
| 2 | | GitHub Actions | Trigger CI workflow (paths filter matches) |
| 3 | | CI | Checkout repository |
| 4 | | CI | Setup Node.js 20 |
| 5 | | CI | `npm ci` (install dependencies) |
| 6 | | CI | `npm run copy-resources` (copy from workspace root) |
| 7 | | CI | `npm run gen-checksums` (generate manifest) |
| 8 | | CI | `npm run compile` (TypeScript compilation) |
| 9 | | CI | `npx vsce package --no-dependencies` (create VSIX) |
| 10 | | CI | Verify VSIX file exists |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Changes only outside kiro-sdlc-agents/ | Workflow does NOT trigger (paths filter) |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | npm ci fails | Build fails, PR blocked |
| EF-02 | TypeScript compilation error | Build fails, PR blocked |
| EF-03 | gen-checksums fails (git error) | Build fails |

---

**Use Case ID:** UC-07
**Name:** Publish Extension on Tag
**Actor:** CI Pipeline (GitHub Actions)
**Preconditions:** Tag matching `v*` pushed OR manual workflow dispatch
**Postconditions:** Extension published to VS Code Marketplace and/or Open VSX

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Maintainer | | Pushes tag `v1.0.1` |
| 2 | | GitHub Actions | Trigger publish workflow |
| 3 | | CI | Build job: checkout → install → copy-resources → gen-checksums → compile → package |
| 4 | | CI | Upload VSIX as artifact |
| 5 | | CI | publish-vscode job: download artifact → `npx vsce publish` with VSCE_PAT |
| 6 | | CI | publish-openvsx job: download artifact → `npx ovsx publish` with OVSX_TOKEN |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Manual dispatch target="vscode-only" | Only publish-vscode job runs |
| AF-02 | Manual dispatch target="openvsx-only" | Only publish-openvsx job runs |

---

**Use Case ID:** UC-08
**Name:** Generate Checksums Manifest
**Actor:** CI Pipeline or Developer (manual)
**Preconditions:** Git repository with committed files in tracked paths
**Postconditions:** `resources/.sdlc-checksums.json` generated

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Script | Read version from `package.json` |
| 2 | | Script | Run `git ls-tree -r --name-only HEAD` for tracked paths |
| 3 | | Script | For each file: `git show HEAD:{path}` → compute SHA-256 |
| 4 | | Script | Build manifest JSON with version, timestamp, file entries |
| 5 | | Script | Write to `resources/.sdlc-checksums.json` |

**Tracked Paths:**
- `.kiro/agents/`
- `.kiro/hooks/`
- `.kiro/steering/`
- `documents/templates/`
- `.analysis/code-intelligence/index-config.json`

---

### 3.3 Feature: Sync Tooling

**Source:** BRD Stories 6, 7

#### 3.3.1 Description

PowerShell script that synchronizes shared resources from the MCPOrchestration source repository into the FEC_CR_Builder extension repository.

#### 3.3.2 Use Cases

---

**Use Case ID:** UC-09
**Name:** Sync Files from Source Repository
**Actor:** Extension Maintainer
**Preconditions:** MCPOrchestration repo exists at configured path, PowerShell available
**Postconditions:** New/changed files copied to destination

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Maintainer | | Runs `sync-from-source.ps1` |
| 2 | | Script | For each mapping (3 mappings defined) |
| 3 | | Script | Recursively enumerate source files |
| 4 | | Script | Skip excluded directories and files |
| 5 | | Script | For each file: check if exists in destination |
| 6a | | Script | If not exists → copy (NEW) |
| 6b | | Script | If exists → compare MD5 hashes |
| 7 | | Script | If MD5 differs → overwrite (CHANGED) |
| 8 | | Script | If MD5 same → skip |
| 9 | | Script | Print summary: new count, changed count, skipped count |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | `-DryRun` flag | Show what would be copied without actually copying |
| AF-02 | Source directory doesn't exist | Print "SKIP: Source not found" and continue to next mapping |

**Sync Mappings:**

| Source (MCPOrchestration) | Destination (FEC_CR_Builder) |
|---------------------------|------------------------------|
| `documents/templates` | `documents/templates` |
| `.kiro` | `.kiro` |
| `.analysis/code-intelligence/scripts` | `.analysis/code-intelligence/scripts` |

---

#### 3.3.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-08 | Only copy if file is NEW (doesn't exist) or CHANGED (different MD5) | BRD Story 6 |
| BR-09 | Skip directories: settings, node_modules, __pycache__, out, dist, .git | BRD Story 6 |
| BR-10 | Skip files: mcp.json, mcp.json,bk | BRD Story 6 |
| BR-11 | DryRun mode shows actions without executing | BRD Story 7 |

---

## 4. Data Model

### 4.1 Logical Entities

#### Entity: ChecksumManifest (Bundled)

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| version | string | Yes | — | Extension semver version |
| generatedAt | ISO 8601 string | Yes | — | When manifest was generated |
| files | map | Yes | — | Keyed by relative path |

#### Entity: FileChecksum (Bundled entry)

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| hash | string (64 hex chars) | Yes | BR-07 | SHA-256 of git committed content |
| version | string | Yes | — | Version at generation time |
| injectedAt | ISO 8601 string | Yes | — | Timestamp |

#### Entity: WorkspaceManifest

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| lastUpdated | ISO 8601 string | Yes | — | Last save timestamp |
| files | map | Yes | — | Keyed by relative path |

#### Entity: WorkspaceFileEntry

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| version | string | Yes | BR-02 | Version when file was injected |
| hash | string (64 hex chars) | Yes | BR-01 | SHA-256 at injection time |
| injectedAt | ISO 8601 string | Yes | — | When file was injected |

**Relationships:**

| From Entity | To Entity | Cardinality | Description |
|-------------|-----------|-------------|-------------|
| ChecksumManifest | FileChecksum | 1:N | One manifest has many file entries |
| WorkspaceManifest | WorkspaceFileEntry | 1:N | One manifest has many file entries |

---

## 5. Integration Specifications

### 5.1 External System: Git CLI

| Attribute | Value |
|-----------|-------|
| Purpose | Read committed file content for reproducible hash generation |
| Direction | Outbound (script reads from git) |
| Data Format | Binary (file content via `git show`) |
| Frequency | On-demand (during gen-checksums execution) |

**Commands Used:**

| Command | Purpose | Output |
|---------|---------|--------|
| `git ls-tree -r --name-only HEAD -- {paths}` | List tracked files | Newline-separated file paths |
| `git show HEAD:{path}` | Read committed file content | Raw file bytes |

### 5.2 External System: VS Code Extension API

| Attribute | Value |
|-----------|-------|
| Purpose | UI notifications, commands, output channels, status bar |
| Direction | Bidirectional |
| Data Format | TypeScript API calls |
| Frequency | Real-time (on user interaction) |

### 5.3 External System: GitHub Actions

| Attribute | Value |
|-----------|-------|
| Purpose | Automated build, test, and publish |
| Direction | Triggered by git events |
| Data Format | YAML workflow definitions |
| Frequency | On push/PR/tag/manual dispatch |

---

## 6. Processing Logic

### 6.1 Hash Computation

**Trigger:** Called during status check, update, or manifest generation
**Input:** File path (absolute)
**Output:** 64-character hex string (SHA-256)

**Pseudocode:**
```
function computeFileHash(filePath):
    content = readFileSync(filePath)  // raw bytes
    return sha256(content).toHex()
```

### 6.2 File Status Determination

**Trigger:** Extension activation or status command
**Input:** Workspace root, extension path
**Output:** Array of FileStatus objects

**Pseudocode:**
```
function getFileStatuses(workspaceRoot, extensionPath):
    bundled = loadBundledManifest(extensionPath)
    if bundled is null: return []
    
    wsManifest = loadWorkspaceManifest(workspaceRoot)
    statuses = []
    
    for each (relativePath, entry) in bundled.files:
        fullPath = join(workspaceRoot, relativePath)
        wsEntry = wsManifest?.files[relativePath]
        wsVersion = wsEntry?.version ?? "0.0.0"
        
        if not exists(fullPath):
            state = "missing"
        else if wsVersion != entry.version:
            state = "outdated"
        else if computeFileHash(fullPath) != entry.hash:
            state = "modified"
        else:
            state = "current"
        
        statuses.push({ relativePath, wsVersion, bundledVersion: entry.version, state })
    
    return statuses
```

### 6.3 Safe Update Strategy Selection

**Trigger:** User clicks "Update Now"
**Input:** Workspace root, extension path
**Output:** Updated files list

**Pseudocode:**
```
function safeUpdate(root, extensionPath):
    migrateLegacyVersion(root, extensionPath)
    modified = detectModifiedFiles(root, extensionPath)
    
    if modified is empty:
        showMessage("All files match. No update needed.")
        return []
    
    statuses = getFileStatuses(root, extensionPath)
    outdated = statuses.filter(s => s.state == "outdated")
    userModified = statuses.filter(s => s.state == "modified")
    
    if outdated.length > 0 AND userModified.length == 0:
        return forceUpdate(root, extensionPath)
    
    action = promptUser(outdated, userModified)
    switch action:
        "overwrite": return forceUpdate(root, extensionPath)
        "skip": return updateSkipModified(root, extensionPath, modified)
        "backup": return updateWithBackup(root, extensionPath, modified)
        "cancel": return []
```

### 6.4 Sync File Detection

**Trigger:** Maintainer runs sync script
**Input:** Source path, destination path
**Output:** File copied or skipped

**Pseudocode:**
```
function syncFile(srcFile, dstFile, dryRun):
    if not exists(dstFile):
        if not dryRun: copy(srcFile, dstFile)
        print "NEW: {relativePath}"
        return "new"
    
    srcHash = md5(srcFile)
    dstHash = md5(dstFile)
    if srcHash != dstHash:
        if not dryRun: copy(srcFile, dstFile, force=true)
        print "CHANGED: {relativePath}"
        return "changed"
    
    return "skipped"
```

---

## 7. Security Requirements

### 7.1 Data Sensitivity

| Data Type | Classification | Business Requirement |
|-----------|---------------|---------------------|
| File hashes (SHA-256) | Internal | Integrity verification only, not secret |
| VSCE_PAT | Restricted | GitHub secret, never exposed in logs |
| OVSX_TOKEN | Restricted | GitHub secret, never exposed in logs |
| Workspace manifest | Internal | User's local file, no sensitive data |

### 7.2 Security Controls

| Control | Implementation | Rationale |
|---------|---------------|-----------|
| Tamper-proof bundled manifest | Stored inside VSIX package | Users cannot modify expected hashes |
| Git-based hash generation | Reads from git HEAD, not filesystem | Prevents uncommitted content from entering manifest |
| Secret masking in CI | GitHub Actions secrets mechanism | Tokens never appear in logs |

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | Extension activation < 500ms overhead | Hash computation for 50 files completes within 500ms |
| Performance | gen-checksums < 5s | Script completes within 5 seconds |
| Reliability | Manifest corruption recovery | Invalid JSON → treated as missing, rebuilt on next inject |
| Compatibility | VS Code 1.85+ | Extension uses stable API only |
| Maintainability | Single source of truth for hashes | gen-checksums reads git HEAD exclusively |

---

## 9. Error Handling

### 9.1 Error Scenarios

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| Bundled manifest missing | Warning | (silent) | Extension functions without checksum features |
| Workspace manifest corrupted | Warning | (silent) | Delete and rebuild on next injection |
| File read permission denied | Warning | "Failed to inject {id}: {error}" | Skip file, continue with others |
| Source not found (injection) | Warning | "Source not found: {path}" | Skip component, continue |
| Git not available (gen-checksums) | Critical | Script exits with error | CI build fails |
| Source repo not found (sync) | Info | "SKIP: Source not found — {path}" | Skip mapping, continue |

---

## 10. State Diagram

![State Diagram — File Lifecycle](diagrams/state-file-lifecycle.png)

**File States:**
- **Not Injected** → Initial state before extension injects files
- **Current** → File matches bundled version and hash
- **Outdated** → Bundled version is newer than workspace version
- **Modified** → User changed file content (hash mismatch)
- **Missing** → File tracked in manifest but deleted from disk

**Transitions:**
- Not Injected → Current: `inject()`
- Current → Outdated: Extension updates (new bundled version)
- Current → Modified: User edits file
- Current → Missing: User deletes file
- Outdated → Current: `safeUpdate()` applied
- Modified → Current: User selects "Overwrite" during update
- Missing → Current: `injectSelective()` or `safeUpdate()`

---

## 11. Sequence Diagrams

### 11.1 Activation & Upgrade Check

![Sequence — Activation](diagrams/sequence-activation.png)

### 11.2 Safe Update Flow

![Sequence — Safe Update](diagrams/sequence-safe-update.png)

---

## 12. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | State — File Lifecycle | [state-file-lifecycle.png](diagrams/state-file-lifecycle.png) | [state-file-lifecycle.drawio](diagrams/state-file-lifecycle.drawio) |
| 3 | Sequence — Activation | [sequence-activation.png](diagrams/sequence-activation.png) | [sequence-activation.drawio](diagrams/sequence-activation.drawio) |
| 4 | Sequence — Safe Update | [sequence-safe-update.png](diagrams/sequence-safe-update.png) | [sequence-safe-update.drawio](diagrams/sequence-safe-update.drawio) |
