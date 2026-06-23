# Business Requirements Document (BRD)

## Kiro SDLC Agents — KSA-12: Release v1.0.1 — Checksum management, CI/CD fixes, sync tooling

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-12 |
| Title | Release v1.0.1 — Checksum management, CI/CD fixes, sync tooling |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-10 |
| Status | Draft |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-10 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-12 |

---

## 1. Introduction

### 1.1 Scope

This release (v1.0.1) delivers three major capabilities to the Kiro SDLC Agents VS Code extension:

1. **Checksum Management System** — SHA-256 integrity tracking for all injected files, enabling safe updates with user-modification detection
2. **CI/CD Pipeline Fixes** — Corrected GitHub Actions workflow placement and configuration for proper triggering
3. **Sync Tooling** — PowerShell script to synchronize templates, agents, and indexer scripts from the MCPOrchestration source repository

### 1.2 Out of Scope

- New agent prompts or steering content (only synced existing content)
- VS Code Marketplace publishing process changes (existing workflow reused)
- Extension UI redesign
- Multi-workspace support
- Rollback mechanism for failed updates (handled by user via git)

### 1.3 Preliminary Requirements

- Node.js 20+ runtime for CI/CD
- VS Code extension development environment (vsce, ovsx CLI)
- Access to MCPOrchestration source repository (for sync tooling)
- Git repository with committed content (gen-checksums reads from git HEAD)

---

## 2. Business Requirements

### 2.1 High Level Process Map

The release addresses three independent but related concerns:

1. **File Integrity** — When the extension injects files into a workspace, users may customize them. On extension update, the system must detect modifications and offer safe update options.
2. **CI Reliability** — GitHub Actions workflows must trigger correctly on push/PR to build, test, and publish the extension.
3. **Source Synchronization** — Development workflow requires syncing shared resources from the MCPOrchestration monorepo into the extension package.

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a developer using the extension, I want the system to detect when I've modified injected files so that my customizations aren't silently overwritten on update | MUST HAVE | KSA-12 |
| 2 | As a developer using the extension, I want to see which files are outdated/modified/current so I can decide what to update | MUST HAVE | KSA-12 |
| 3 | As a developer using the extension, I want safe update options (Skip Modified, Backup & Overwrite, Overwrite All) when new versions are available | MUST HAVE | KSA-12 |
| 4 | As a CI pipeline, I want workflows to trigger correctly when code changes in the kiro-sdlc-agents subdirectory | MUST HAVE | KSA-12 |
| 5 | As a CI pipeline, I want checksums auto-generated from git committed content before VSIX packaging | MUST HAVE | KSA-12 |
| 6 | As an extension maintainer, I want to sync shared resources from MCPOrchestration with a single command | SHOULD HAVE | KSA-12 |
| 7 | As an extension maintainer, I want dry-run mode to preview sync changes before applying | SHOULD HAVE | KSA-12 |

---

### 2.3 Details of User Stories

---

#### Business Flow

![Business Flow](diagrams/business-flow.png)

**Update Detection Flow:**

**Step 1:** Extension activates in VS Code workspace

**Step 2:** Extension checks for legacy `.kiro/.sdlc-version` file and migrates to per-file manifest if found

**Step 3:** Extension compares bundled manifest (`resources/.sdlc-checksums.json`) with workspace manifest (`.kiro/.sdlc-manifest.json`)

**Step 4:** If any bundled file has newer version than workspace → show upgrade notification

**Step 5:** User clicks "Update Now" → extension runs safe update

**Step 6:** For each outdated file, compute current file hash and compare with recorded hash

**Step 7:** If hash differs from recorded → file was user-modified → present options (Skip/Backup & Overwrite/Overwrite All)

**Step 8:** Apply user's choice, update workspace manifest with new versions and hashes

---

#### STORY 1: Detect User-Modified Files

> As a developer using the extension, I want the system to detect when I've modified injected files so that my customizations aren't silently overwritten on update.

**Requirement Details:**

1. Extension stores a per-file workspace manifest at `.kiro/.sdlc-manifest.json` tracking version, SHA-256 hash, and injection timestamp for each file
2. Bundled manifest at `resources/.sdlc-checksums.json` contains the expected hash for each file at the current extension version
3. On activation, extension compares workspace file hash against the recorded hash in workspace manifest
4. If current file hash ≠ recorded hash → file state = "modified" (user changed it)
5. If workspace version < bundled version → file state = "outdated"
6. If file doesn't exist on disk → file state = "missing"
7. If hash matches and version matches → file state = "current"

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| relativePath | string | Yes | Path relative to workspace root | `.kiro/agents/ba-agent.md` |
| hash | string | Yes | SHA-256 hex digest of file content | `4b35262c5de6...` |
| version | string | Yes | Semver version when file was injected | `1.0.5` |
| injectedAt | string | Yes | ISO 8601 timestamp | `2026-05-10T04:22:47.128Z` |
| state | enum | Yes | Computed file status | `current\|outdated\|modified\|missing` |

**Acceptance Criteria:**

1. Given a file injected at v1.0.0 that user has NOT modified, when extension checks status, then state = "current"
2. Given a file injected at v1.0.0 that user HAS modified (different hash), when extension checks status, then state = "modified"
3. Given a file injected at v1.0.0 when bundled version is v1.0.5, when extension checks status, then state = "outdated"
4. Given a file tracked in manifest but deleted from disk, when extension checks status, then state = "missing"
5. Legacy `.kiro/.sdlc-version` file is automatically migrated to per-file manifest on first activation

---

#### STORY 2: File Status Report

> As a developer using the extension, I want to see which files are outdated/modified/current so I can decide what to update.

**Requirement Details:**

1. Status command (`kiroSdlc.status`) shows per-file status with ✅/❌ indicators
2. "Show File Versions" action displays detailed version report in output channel
3. Report includes: file path, workspace version, bundled version, state

**Acceptance Criteria:**

1. Given workspace with mixed file states, when user runs status command, then all files are listed with correct state indicators
2. Given user clicks "Show File Versions", then output channel shows detailed report with version comparison
3. Given user clicks "Inject Missing", then selective injection command is triggered

---

#### STORY 3: Safe Update Options

> As a developer using the extension, I want safe update options when new versions are available.

**Requirement Details:**

1. When upgrade is available, show notification: "🆕 SDLC Agents update available → v{version}"
2. Options: "Update Now", "Show Details", "Later"
3. "Update Now" triggers safe update that:
   - Identifies modified files
   - Presents per-file options: Skip Modified, Backup & Overwrite, Overwrite All
   - Updates workspace manifest after successful injection
4. After update, workspace manifest records new version and hash for each updated file

**Acceptance Criteria:**

1. Given bundled version > workspace version, when extension activates, then upgrade notification appears
2. Given user selects "Update Now" with modified files, then user is prompted with safe options before overwriting
3. Given user selects "Skip Modified", then modified files are left unchanged and only outdated/missing files are updated
4. Given user selects "Backup & Overwrite", then original file is backed up before overwriting
5. After successful update, workspace manifest reflects new versions and hashes

---

#### STORY 4: CI Workflow Triggers Correctly

> As a CI pipeline, I want workflows to trigger correctly when code changes in the kiro-sdlc-agents subdirectory.

**Requirement Details:**

1. `.github/workflows/ci.yml` placed at repository root (not inside `kiro-sdlc-agents/`)
2. Workflow uses `paths` filter: `kiro-sdlc-agents/**`
3. Workflow uses `working-directory: kiro-sdlc-agents` for all run steps
4. CI steps: checkout → setup-node → npm ci → copy-resources → gen-checksums → compile → package VSIX
5. Publish workflow triggers on tag push (`v*`) or manual dispatch

**Acceptance Criteria:**

1. Given push to main with changes in `kiro-sdlc-agents/`, when CI triggers, then build completes successfully
2. Given push to main with changes ONLY outside `kiro-sdlc-agents/`, then CI does NOT trigger
3. Given tag `v1.0.1` pushed, then publish workflow triggers and publishes to both VS Code Marketplace and Open VSX
4. Given manual dispatch with target "vscode-only", then only VS Code Marketplace publish runs

---

#### STORY 5: CI Auto-generate Checksums

> As a CI pipeline, I want checksums auto-generated from git committed content before VSIX packaging.

**Requirement Details:**

1. Script `scripts/gen-checksums.js` generates `resources/.sdlc-checksums.json`
2. Script reads file content from `git show HEAD:{path}` (not filesystem) to ensure reproducibility
3. Script scans paths: `.kiro/agents/`, `.kiro/hooks/`, `.kiro/steering/`, `documents/templates/`, `.analysis/code-intelligence/index-config.json`
4. Output manifest includes: version (from package.json), generatedAt timestamp, per-file hash entries
5. `npm run gen-checksums` added to `vscode:prepublish` script so it runs automatically before packaging

**Acceptance Criteria:**

1. Given clean git checkout, when `npm run gen-checksums` runs, then `.sdlc-checksums.json` is generated with correct hashes
2. Given uncommitted local changes, when script runs, then hashes reflect git HEAD content (not local modifications)
3. Given new file added to tracked paths and committed, when script runs, then new file appears in manifest
4. Manifest version matches `package.json` version

---

#### STORY 6: Sync Tooling

> As an extension maintainer, I want to sync shared resources from MCPOrchestration with a single command.

**Requirement Details:**

1. PowerShell script `scripts/sync-from-source.ps1` copies files from MCPOrchestration to FEC_CR_Builder
2. Sync mappings:
   - `documents/templates` → `documents/templates`
   - `.kiro` → `.kiro`
   - `.analysis/code-intelligence/scripts` → `.analysis/code-intelligence/scripts`
3. Only copies NEW or CHANGED files (MD5 hash comparison)
4. Skips: `settings/`, `node_modules/`, `__pycache__/`, `out/`, `dist/`, `.git/`
5. Skips files: `mcp.json`, `mcp.json,bk`

**Acceptance Criteria:**

1. Given new file in MCPOrchestration source, when sync runs, then file is copied to destination
2. Given changed file in source (different MD5), when sync runs, then file is overwritten in destination
3. Given unchanged file (same MD5), when sync runs, then file is skipped
4. Given file in `settings/` directory, when sync runs, then file is skipped
5. Summary shows count of new, changed, and skipped files

---

#### STORY 7: Dry-Run Mode for Sync

> As an extension maintainer, I want dry-run mode to preview sync changes before applying.

**Requirement Details:**

1. `-DryRun` switch parameter shows what would be copied without actually copying
2. Output clearly indicates "(DRY RUN — no files were copied)"
3. Same detection logic (new/changed) runs in dry-run mode

**Acceptance Criteria:**

1. Given `-DryRun` flag, when sync runs, then no files are modified on disk
2. Given `-DryRun` flag with new files detected, then output shows "NEW: {path}" for each
3. Given `-DryRun` flag with changed files detected, then output shows "CHANGED: {path}" for each

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Node.js 20+ | Infrastructure | N/A | Required for CI build and gen-checksums script |
| VS Code Extension API | System | N/A | Extension host for checksum management |
| Git CLI | System | N/A | gen-checksums.js uses `git ls-tree` and `git show` |
| MCPOrchestration repo | External | N/A | Source repository for sync tooling |
| GitHub Actions | Infrastructure | N/A | CI/CD platform for build and publish |
| VSCE_PAT secret | Infrastructure | N/A | VS Code Marketplace publish token |
| OVSX_TOKEN secret | Infrastructure | N/A | Open VSX Registry publish token |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Reporter / Developer | Duc Nguyen | Implementation, release management | Jira reporter |
| Extension Users | Development teams | Use extension, provide feedback | End users |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Hash collision (SHA-256) | Low | Negligible | SHA-256 collision probability is astronomically low |
| Git not available in CI | High | Low | CI uses actions/checkout which includes git |
| User deletes workspace manifest | Medium | Low | Extension recreates manifest on next activation |
| MCPOrchestration repo unavailable | Medium | Low | Sync is manual, not blocking CI |
| Large number of tracked files slows activation | Medium | Medium | Manifest is JSON, reads are fast; currently ~50 files |

### 5.2 Assumptions

- Users have git installed in their development environment
- VS Code workspace has a single root folder (multi-root not supported)
- Extension has filesystem read/write access to workspace
- CI environment has clean git checkout (no uncommitted changes)
- MCPOrchestration source paths remain stable

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Activation check < 500ms | Hash computation for ~50 files should complete within 500ms |
| Performance | Gen-checksums < 5s | Script should complete within 5 seconds for current file count |
| Reliability | Manifest corruption recovery | If manifest is corrupted (invalid JSON), treat as missing and rebuild |
| Security | Tamper-proof bundled manifest | Bundled manifest inside VSIX cannot be modified by users |
| Compatibility | VS Code 1.85+ | Minimum VS Code version for extension API compatibility |
| Maintainability | Single source of truth | gen-checksums.js reads from git HEAD, ensuring reproducibility |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-12 | Release v1.0.1 — Checksum management, CI/CD fixes, sync tooling | In Progress | Task | Main ticket |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Bundled Manifest | `resources/.sdlc-checksums.json` — shipped inside the VSIX, contains expected hashes |
| Workspace Manifest | `.kiro/.sdlc-manifest.json` — stored in user's workspace, tracks injected file versions |
| Injection | Process of copying agent/steering/template files from extension into workspace |
| Safe Update | Update process that detects user modifications before overwriting |
| VSIX | VS Code Extension package format |

### Use Case Diagram

![Use Case Diagram](diagrams/use-case.png)

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
