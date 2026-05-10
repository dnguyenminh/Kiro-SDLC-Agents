# Business Requirements Document (BRD)

## Kiro SDLC Agents Extension — KSA-14: Release v1.0.5 — Fix inject overwrite bug + per-file version tracking

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-14 |
| Title | Release v1.0.5 — Fix inject overwrite bug + per-file version tracking |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-10 |
| Status | Draft |
| Type | Task (Bugfix) |
| Labels | bugfix, checksum, release |
| Parent Epic | KSA-1 (Kiro SDLC Agents Extension) |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-10 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-14 |

---

## 1. Introduction

### 1.1 Scope

This change request covers two related releases (v1.0.4 and v1.0.5) of the Kiro SDLC Agents VS Code extension. The primary objectives are:

1. **v1.0.4 — Fix overwrite bug**: Resolve a critical bug where "Inject All" and "Update Agents" commands fail to overwrite existing agent files when a new extension version is installed. The root cause is version-gating logic in `detectModifiedFiles` that incorrectly skips all entries on version mismatch.

2. **v1.0.5 — Per-file version tracking**: Replace the single workspace-level version file (`.kiro/.sdlc-version`) with a per-file manifest (`.kiro/.sdlc-manifest.json`) that tracks individual file versions, hashes, and injection timestamps.

### 1.2 Out of Scope

- Changes to agent prompt content (`.md` files)
- Changes to the code intelligence indexer
- VS Code Marketplace publishing automation
- Multi-workspace support
- Remote workspace (SSH/WSL) compatibility

### 1.3 Preliminary Requirements

- VS Code Extension API v1.85+
- Node.js crypto module (for SHA-256 hashing)
- Existing `.kiro/.sdlc-version` file format understanding (for migration)

---

## 2. Business Requirements

### 2.1 High Level Process Map

The extension manages SDLC agent files in user workspaces. When a user installs a new extension version, the extension must:
1. Detect that bundled files are newer than workspace files
2. Overwrite outdated files automatically (or prompt for user-modified files)
3. Track which version each file was injected at
4. Provide visibility into per-file version status

See Business Flow diagram in Appendix.

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a developer, I want "Inject All" to always overwrite all files regardless of version so that I get the latest agent definitions | MUST HAVE | KSA-14 |
| 2 | As a developer, I want "Update Agents" to overwrite outdated files and prompt for user-modified files so that my customizations are preserved | MUST HAVE | KSA-14 |
| 3 | As a developer, I want to see per-file version information via "Show File Versions" so that I know which files are outdated | MUST HAVE | KSA-14 |
| 4 | As a developer, I want legacy `.sdlc-version` to auto-migrate to the new manifest format so that I don't lose tracking data | MUST HAVE | KSA-14 |
| 5 | As a developer, I want the extension to compile cleanly and package as VSIX so that it can be distributed | MUST HAVE | KSA-14 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** User installs new extension version (v1.0.5) in VS Code

**Step 2:** Extension activates → calls `checkForUpgrade()`

**Step 3:** `migrateLegacyVersion()` checks for `.kiro/.sdlc-version` → if exists, migrates to `.kiro/.sdlc-manifest.json`

**Step 4:** `isUpgradeAvailable()` compares per-file versions in workspace manifest vs bundled manifest

**Step 5:** If upgrade available → show notification with options: "Update Now", "Show Details", "Later"

**Step 6a:** "Update Now" → `safeUpdate()` distinguishes outdated-only vs user-modified files
- Outdated only → auto-overwrite all
- User-modified present → prompt with "Overwrite All (recommended)", "Skip Modified", "Backup & Overwrite"

**Step 6b:** "Show Details" → `getVersionReport()` shows per-file version comparison in Output Channel

**Step 7:** After inject/update → `buildManifestAfterInject()` records exact version per file

> **Note:** "Inject All" always overwrites ALL files unconditionally (no version check, no prompt for modified files).

---

#### STORY 1: Inject All Always Overwrites

> As a developer, I want "Inject All" to always overwrite all files regardless of version so that I get the latest agent definitions.

**Requirement Details:**

1. The "Inject All" command (`kiroSdlc.injectAll`) MUST copy all bundled resource files to the workspace, overwriting any existing files without version comparison
2. After injection, `buildManifestAfterInject()` MUST record the bundled version and computed hash for each injected file
3. No user prompt for modified files — "Inject All" is a destructive reset operation by design

**Acceptance Criteria:**

1. ✅ Running "Inject All" on a workspace with older files overwrites all files with bundled versions
2. ✅ Running "Inject All" on a workspace with user-modified files overwrites all files without prompting
3. ✅ After "Inject All", `.kiro/.sdlc-manifest.json` reflects the bundled version for every file
4. ✅ No errors or warnings during the overwrite process

---

#### STORY 2: Update Agents — Smart Overwrite

> As a developer, I want "Update Agents" to overwrite outdated files and prompt for user-modified files so that my customizations are preserved.

**Requirement Details:**

1. `safeUpdate()` MUST first call `migrateLegacyVersion()` to handle legacy format
2. `detectModifiedFiles()` MUST compare file hashes without version-gating (v1.0.4 fix — removed version mismatch skip logic)
3. `getFileStatuses()` classifies each file as: `current`, `outdated`, `modified`, or `missing`
4. If ONLY outdated files exist (no user modifications) → auto-overwrite without prompting
5. If user-modified files exist → show prompt with options:
   - "Overwrite All (recommended)" — default action
   - "Skip Modified" — only update outdated files
   - "Backup & Overwrite" — backup modified files then overwrite all

**Acceptance Criteria:**

1. ✅ `detectModifiedFiles` no longer has version-gating logic that skips entries on version mismatch
2. ✅ When only outdated files exist, update proceeds automatically
3. ✅ When user-modified files exist, prompt appears with "Overwrite All" as default
4. ✅ "Skip Modified" leaves user-modified files untouched
5. ✅ "Backup & Overwrite" creates backup copies in `.kiro/.sdlc-backup/{timestamp}/` before overwriting

---

#### STORY 3: Per-File Version Visibility

> As a developer, I want to see per-file version information via "Show File Versions" so that I know which files are outdated.

**Requirement Details:**

1. "Show File Versions" command (renamed from "Show Status") opens an Output Channel
2. Report format shows: `{relativePath}  [v{workspaceVersion} → v{bundledVersion}]` for outdated files
3. Report groups files by state: current, outdated, modified, missing
4. Report header shows extension version and file count summary

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| relativePath | string | Yes | Path relative to workspace root | `.kiro/agents/sm-agent.md` |
| workspaceVersion | string | Yes | Version when file was last injected | `1.0.3` |
| bundledVersion | string | Yes | Version in current extension bundle | `1.0.5` |
| state | enum | Yes | File state classification | `outdated` |

**Acceptance Criteria:**

1. ✅ "Show File Versions" displays per-file version comparison
2. ✅ Outdated files show `[v{old} → v{new}]` format
3. ✅ Modified files show `[v{version}]` with "Modified by user" label
4. ✅ Report is readable and grouped logically

---

#### STORY 4: Legacy Migration

> As a developer, I want legacy `.sdlc-version` to auto-migrate to the new manifest format so that I don't lose tracking data.

**Requirement Details:**

1. On extension activation, `migrateLegacyVersion()` checks for `.kiro/.sdlc-version`
2. If legacy file exists:
   - Read version from legacy JSON (`{ "version": "1.0.3" }`)
   - Create new `.kiro/.sdlc-manifest.json` with all existing workspace files recorded at the legacy version
   - Compute current hash for each file
   - Delete legacy `.kiro/.sdlc-version` file
3. If legacy file does not exist → no-op

**Acceptance Criteria:**

1. ✅ First run after upgrade auto-migrates legacy version file
2. ✅ New manifest contains entries for all files that exist in workspace
3. ✅ Legacy `.sdlc-version` file is deleted after successful migration
4. ✅ If legacy file is malformed, defaults to version "1.0.0"

---

#### STORY 5: Clean Compile and VSIX Package

> As a developer, I want the extension to compile cleanly and package as VSIX so that it can be distributed.

**Requirement Details:**

1. TypeScript compilation (`tsc`) must complete with zero errors
2. `vsce package` must produce a valid `.vsix` file
3. Both v1.0.4 and v1.0.5 tags must be pushed to git

**Acceptance Criteria:**

1. ✅ `npm run compile` succeeds with no errors
2. ✅ `vsce package` produces `kiro-sdlc-agents-1.0.5.vsix`
3. ✅ Git tags `v1.0.4` and `v1.0.5` pushed to remote

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| VS Code Extension API | System | N/A | Required runtime environment for the extension |
| Node.js crypto module | System | N/A | SHA-256 hash computation for file integrity |
| `.sdlc-checksums.json` | Internal | KSA-1 | Bundled manifest with expected hashes per file |
| Legacy `.sdlc-version` format | Internal | KSA-1 | Must understand old format for migration |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Developer | Extension Users | Use inject/update commands, report issues | End users |
| Maintainer | Extension Author | Implement fixes, package releases | KSA-14 assignee |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Migration deletes legacy file before new manifest is fully written | High | Low | Write new manifest first, then delete legacy file |
| Hash computation fails on large files | Low | Low | Node.js crypto handles large files via streaming if needed |
| User loses customizations on "Inject All" | Medium | Medium | Clear warning in confirmation dialog; "Update Agents" preserves modifications |

### 5.2 Assumptions

- Users have a single workspace folder open (multi-root not supported)
- The bundled `.sdlc-checksums.json` is always present and valid in the extension package
- File system permissions allow read/write to `.kiro/` directory
- SHA-256 hash is sufficient for detecting file modifications

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Hash computation < 100ms per file | Agent files are small (< 50KB each), SHA-256 is fast |
| Reliability | Migration is atomic | New manifest written before legacy file deleted |
| Compatibility | Backward compatible | Extensions without legacy file work normally |
| Usability | Clear version report | Users can quickly identify outdated files |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-14 | Release v1.0.5 — Fix inject overwrite bug + per-file version tracking | In Progress | Task | Main ticket |
| KSA-1 | Kiro SDLC Agents Extension | Active | Epic | Parent epic |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Workspace Manifest | `.kiro/.sdlc-manifest.json` — per-file version/hash tracking |
| Bundled Manifest | `resources/.sdlc-checksums.json` — expected hashes shipped with extension |
| Inject | Copy bundled resource files into user's workspace |
| Safe Update | Update that preserves user modifications |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
