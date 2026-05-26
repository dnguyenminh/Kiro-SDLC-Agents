# Software Test Cases (STC)

## KSA-12: Release v1.0.1 — Checksum management, CI/CD fixes, sync tooling

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-12 |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-10 |
| Status | Draft |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-10 | QA Agent | Initial test cases |

---

## 1. Unit Tests (UT)

### UT-01: computeFileHash returns correct SHA-256

| Field | Value |
|-------|-------|
| **ID** | UT-01 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-01, BR-01 |
| **Preconditions** | File exists on disk with known content |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create temp file with content "hello world" | File created |
| 2 | Call `computeFileHash(tempFile)` | Returns `b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9` |
| 3 | Modify file content to "hello world!" | File modified |
| 4 | Call `computeFileHash(tempFile)` again | Returns different 64-char hex string |

---

### UT-02: getFileStatuses — state "current"

| Field | Value |
|-------|-------|
| **ID** | UT-02 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-01, BR-04 |
| **Preconditions** | Workspace manifest and bundled manifest exist with matching version and hash |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Setup: bundled manifest has file X at v1.0.0 with hash H | — |
| 2 | Setup: workspace manifest has file X at v1.0.0 with hash H | — |
| 3 | Setup: actual file on disk has hash H | — |
| 4 | Call `getFileStatuses()` | File X state = "current" |

---

### UT-03: getFileStatuses — state "outdated"

| Field | Value |
|-------|-------|
| **ID** | UT-03 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-01, BR-02 |
| **Preconditions** | Bundled version > workspace version |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Setup: bundled manifest has file X at v1.0.5 | — |
| 2 | Setup: workspace manifest has file X at v1.0.0 | — |
| 3 | Call `getFileStatuses()` | File X state = "outdated" |

---

### UT-04: getFileStatuses — state "modified"

| Field | Value |
|-------|-------|
| **ID** | UT-04 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-01, BR-01 |
| **Preconditions** | File hash differs from recorded hash, version matches |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Setup: bundled and workspace manifest have file X at v1.0.0 with hash H1 | — |
| 2 | Setup: actual file on disk has hash H2 (≠ H1) | — |
| 3 | Call `getFileStatuses()` | File X state = "modified" |

---

### UT-05: getFileStatuses — state "missing"

| Field | Value |
|-------|-------|
| **ID** | UT-05 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-01, BR-03 |
| **Preconditions** | File tracked in manifest but not on disk |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Setup: bundled manifest has file X | — |
| 2 | Setup: file X does NOT exist on disk | — |
| 3 | Call `getFileStatuses()` | File X state = "missing" |

---

### UT-06: loadBundledManifest — valid JSON

| Field | Value |
|-------|-------|
| **ID** | UT-06 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-01 |
| **Preconditions** | Valid JSON file at resources/.sdlc-checksums.json |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `loadBundledManifest(extensionPath)` | Returns ChecksumManifest object with version, generatedAt, files |

---

### UT-07: loadBundledManifest — missing file returns null

| Field | Value |
|-------|-------|
| **ID** | UT-07 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-01, AF-03 |
| **Preconditions** | resources/.sdlc-checksums.json does NOT exist |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `loadBundledManifest(extensionPath)` | Returns null |

---

### UT-08: loadWorkspaceManifest — corrupted JSON returns null

| Field | Value |
|-------|-------|
| **ID** | UT-08 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | EF-01 |
| **Preconditions** | .kiro/.sdlc-manifest.json contains invalid JSON |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Write `{invalid json` to manifest path | — |
| 2 | Call `loadWorkspaceManifest(workspaceRoot)` | Returns null (no crash) |

---

### UT-09: migrateLegacyVersion — creates per-file manifest

| Field | Value |
|-------|-------|
| **ID** | UT-09 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-02, BR-05 |
| **Preconditions** | .kiro/.sdlc-version exists with `{"version":"1.0.0"}` |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Setup: create .kiro/.sdlc-version with version "1.0.0" | — |
| 2 | Setup: create 3 files that exist in bundled manifest | — |
| 3 | Call `migrateLegacyVersion()` | — |
| 4 | Verify .kiro/.sdlc-manifest.json created | Manifest exists with 3 entries, all version "1.0.0" |
| 5 | Verify .kiro/.sdlc-version deleted | File no longer exists |

---

### UT-10: isUpgradeAvailable — true when bundled newer

| Field | Value |
|-------|-------|
| **ID** | UT-10 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | UC-04 |
| **Preconditions** | At least one file has bundled version > workspace version |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Setup: bundled v1.0.5, workspace v1.0.0 | — |
| 2 | Call `isUpgradeAvailable()` | Returns true |

---

### UT-11: isUpgradeAvailable — false when all current

| Field | Value |
|-------|-------|
| **ID** | UT-11 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | UC-04 |
| **Preconditions** | All files have matching versions |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Setup: all files bundled v1.0.0, workspace v1.0.0 | — |
| 2 | Call `isUpgradeAvailable()` | Returns false |

---

### UT-12: saveWorkspaceManifest — writes valid JSON

| Field | Value |
|-------|-------|
| **ID** | UT-12 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | UC-03 |
| **Preconditions** | Workspace directory exists |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `saveWorkspaceManifest(root, manifest)` | — |
| 2 | Read .kiro/.sdlc-manifest.json | Valid JSON matching input manifest |

---

## 2. Integration Tests (IT)

### IT-01: Safe update — no modified files → force update

| Field | Value |
|-------|-------|
| **ID** | IT-01 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-03 |
| **Preconditions** | Workspace with outdated files, none modified |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Setup workspace with 3 outdated files (v1.0.0 vs bundled v1.0.5) | — |
| 2 | Call `safeUpdate()` | All 3 files updated to v1.0.5 content |
| 3 | Verify workspace manifest | All entries show v1.0.5 with correct hashes |

---

### IT-02: Safe update — skip modified files

| Field | Value |
|-------|-------|
| **ID** | IT-02 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-03, AF-01 |
| **Preconditions** | 2 outdated files, 1 modified file |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Setup: file A outdated, file B outdated, file C modified | — |
| 2 | Call `updateSkipModified()` | Files A, B updated; file C unchanged |
| 3 | Verify file C content | Original user-modified content preserved |

---

### IT-03: Safe update — backup & overwrite

| Field | Value |
|-------|-------|
| **ID** | IT-03 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-03, AF-02, BR-06 |
| **Preconditions** | Modified files exist |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Setup: file A modified with custom content | — |
| 2 | Call `updateWithBackup()` | — |
| 3 | Verify backup exists at `.kiro/.sdlc-backup/{timestamp}/` | Backup contains original modified content |
| 4 | Verify file A overwritten with new version | File A has bundled content |

---

### IT-04: Legacy migration + status check integration

| Field | Value |
|-------|-------|
| **ID** | IT-04 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-02, UC-01 |
| **Preconditions** | Legacy .sdlc-version exists, no per-file manifest |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Setup: .kiro/.sdlc-version with version "1.0.0" | — |
| 2 | Call `migrateLegacyVersion()` then `getFileStatuses()` | Migration completes, statuses computed correctly |
| 3 | Verify legacy file deleted | .sdlc-version no longer exists |

---

### IT-05: gen-checksums reads from git HEAD

| Field | Value |
|-------|-------|
| **ID** | IT-05 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-08, BR-07 |
| **Preconditions** | Git repo with committed files, local uncommitted changes |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Commit file with content "original" | — |
| 2 | Modify file locally (uncommitted) to "modified" | — |
| 3 | Run `node scripts/gen-checksums.js` | — |
| 4 | Read generated manifest | Hash matches SHA-256 of "original", NOT "modified" |

---

### IT-06: gen-checksums includes all tracked paths

| Field | Value |
|-------|-------|
| **ID** | IT-06 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-08 |
| **Preconditions** | Git repo with files in all tracked paths |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Commit files in .kiro/agents/, .kiro/hooks/, .kiro/steering/, documents/templates/ | — |
| 2 | Run gen-checksums.js | — |
| 3 | Read manifest | All committed files from tracked paths present |

---

### IT-07: Sync detects new files

| Field | Value |
|-------|-------|
| **ID** | IT-07 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | UC-09, BR-08 |
| **Preconditions** | Source has file that doesn't exist in destination |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create new file in source directory | — |
| 2 | Run sync-from-source.ps1 | — |
| 3 | Verify file copied to destination | File exists with same content |
| 4 | Verify summary shows "NEW: 1" | — |

---

### IT-08: Sync detects changed files

| Field | Value |
|-------|-------|
| **ID** | IT-08 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | UC-09, BR-08 |
| **Preconditions** | Same file exists in source and dest with different content |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Modify source file (different MD5 from dest) | — |
| 2 | Run sync-from-source.ps1 | — |
| 3 | Verify dest file overwritten with source content | Content matches source |
| 4 | Verify summary shows "CHANGED: 1" | — |

---

## 3. E2E-API Tests (Script Execution)

### E2E-API-01: gen-checksums produces valid manifest

| Field | Value |
|-------|-------|
| **ID** | E2E-API-01 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-08, Story 5 |
| **Preconditions** | Clean git checkout with tracked files |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `npm run gen-checksums` | Exit code 0 |
| 2 | Read `resources/.sdlc-checksums.json` | Valid JSON |
| 3 | Verify `version` field | Matches package.json version |
| 4 | Verify `generatedAt` field | Valid ISO 8601 timestamp |
| 5 | Verify each file entry has 64-char hex hash | All hashes valid |

---

### E2E-API-02: gen-checksums manifest version matches package.json

| Field | Value |
|-------|-------|
| **ID** | E2E-API-02 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | Story 5 AC-4 |
| **Preconditions** | package.json has version "1.0.1" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run gen-checksums.js | — |
| 2 | Parse manifest JSON | `version` = "1.0.1" |

---

### E2E-API-03: Sync dry-run makes no changes

| Field | Value |
|-------|-------|
| **ID** | E2E-API-03 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | UC-09 AF-01, BR-11, Story 7 |
| **Preconditions** | Source has new/changed files |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Record dest directory state (file list + hashes) | — |
| 2 | Run `sync-from-source.ps1 -DryRun` | Output shows "NEW:" and "CHANGED:" entries |
| 3 | Re-check dest directory state | No files modified (identical to step 1) |

---

### E2E-API-04: Sync skips excluded directories

| Field | Value |
|-------|-------|
| **ID** | E2E-API-04 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | BR-09 |
| **Preconditions** | Source has files in settings/, node_modules/ |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create files in source/settings/ and source/node_modules/ | — |
| 2 | Run sync-from-source.ps1 | — |
| 3 | Verify dest does NOT have those files | Files not copied |

---

### E2E-API-05: Sync skips excluded files

| Field | Value |
|-------|-------|
| **ID** | E2E-API-05 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | BR-10 |
| **Preconditions** | Source has mcp.json file |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create mcp.json in source directory | — |
| 2 | Run sync-from-source.ps1 | — |
| 3 | Verify mcp.json NOT copied to dest | File skipped |

---

### E2E-API-06: Sync skips unchanged files

| Field | Value |
|-------|-------|
| **ID** | E2E-API-06 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | BR-08 |
| **Preconditions** | Source and dest have identical file |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure same file exists in source and dest with same content | — |
| 2 | Run sync-from-source.ps1 | — |
| 3 | Verify summary shows file as "skipped" | Not in NEW or CHANGED count |

---

## 4. E2E-UI Tests (VS Code Extension)

### E2E-UI-01: Status command shows file states

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-01 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-05, Story 2 |
| **Preconditions** | Extension activated in workspace with mixed file states |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Execute command `kiroSdlc.status` | Info message appears |
| 2 | Verify message content | Shows ✅ for current, ❌ for missing/outdated components |
| 3 | Click "Show File Versions" | Output channel opens with detailed version report |

---

### E2E-UI-02: Upgrade notification appears

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-02 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-04, Story 3 AC-1 |
| **Preconditions** | Bundled version > workspace version |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Activate extension in workspace with outdated files | — |
| 2 | Observe notifications | "🆕 SDLC Agents update available → v{version}" appears |
| 3 | Verify options | "Update Now", "Show Details", "Later" buttons present |

---

### E2E-UI-03: Update Now with modified files shows options

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-03 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-03, Story 3 AC-2 |
| **Preconditions** | Upgrade available, some files user-modified |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Update Now" from notification | — |
| 2 | Observe modal dialog | Shows list of modified files with options |
| 3 | Verify options | "Overwrite All", "Skip Modified", "Backup & Overwrite", "Cancel" |

---

### E2E-UI-04: Inject Missing command

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-04 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | UC-05 |
| **Preconditions** | Some components missing from workspace |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Delete a tracked file from workspace | — |
| 2 | Run status command, click "Inject Missing" | — |
| 3 | Verify file restored | File exists with correct content |
| 4 | Verify manifest updated | New entry with current version and hash |

---

### E2E-UI-05: Legacy migration on first activation

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-05 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-02, Story 1 AC-5 |
| **Preconditions** | Workspace has .kiro/.sdlc-version (legacy), no .sdlc-manifest.json |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Activate extension | — |
| 2 | Verify .kiro/.sdlc-version deleted | Legacy file removed |
| 3 | Verify .kiro/.sdlc-manifest.json created | Per-file manifest exists |
| 4 | Verify manifest entries | All existing files tracked with legacy version |

---

## 5. SIT Tests (Manual)

### SIT-01: Full upgrade flow — end to end

| Field | Value |
|-------|-------|
| **ID** | SIT-01 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-03, UC-04 |
| **Preconditions** | Extension installed, workspace with outdated + modified files |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open VS Code with test workspace | Extension activates |
| 2 | Observe notification | Upgrade notification appears within 2s |
| 3 | Click "Update Now" | Modal shows modified file list |
| 4 | Select "Backup & Overwrite" | Files updated, backup created |
| 5 | Verify backup directory | `.kiro/.sdlc-backup/` contains original files |
| 6 | Run status command | All files show ✅ current |

---

### SIT-02: CI workflow triggers correctly

| Field | Value |
|-------|-------|
| **ID** | SIT-02 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-06, Story 4 |
| **Preconditions** | GitHub repo with workflows configured |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Push change to `kiro-sdlc-agents/src/` on main | CI workflow triggers |
| 2 | Verify build steps complete | All steps green |
| 3 | Push change ONLY to `documents/` (outside kiro-sdlc-agents/) | CI does NOT trigger |

---

### SIT-03: Performance — activation overhead

| Field | Value |
|-------|-------|
| **ID** | SIT-03 |
| **Priority** | Medium |
| **Type** | Non-Functional |
| **Requirement** | NFR Performance |
| **Preconditions** | Workspace with 50 tracked files |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add timing instrumentation to activation | — |
| 2 | Activate extension | — |
| 3 | Measure checksum computation time | < 500ms for 50 files |

---

### SIT-04: Manifest corruption recovery

| Field | Value |
|-------|-------|
| **ID** | SIT-04 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | EF-01, NFR Reliability |
| **Preconditions** | Workspace manifest contains invalid JSON |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Manually corrupt .kiro/.sdlc-manifest.json | — |
| 2 | Activate extension | Extension activates without crash |
| 3 | Run inject command | Manifest rebuilt correctly |
| 4 | Run status command | All states computed correctly |

---

## 6. Requirements Traceability Matrix (RTM)

| Requirement | Source | Test Cases | Coverage |
|-------------|--------|------------|----------|
| UC-01 (Detect File Status) | FSD 3.1.2 | UT-01 to UT-08 | ✅ |
| UC-02 (Legacy Migration) | FSD 3.1.2 | UT-09, IT-04, E2E-UI-05 | ✅ |
| UC-03 (Safe Update) | FSD 3.1.2 | IT-01, IT-02, IT-03, E2E-UI-03, SIT-01 | ✅ |
| UC-04 (Upgrade Notification) | FSD 3.1.2 | UT-10, UT-11, E2E-UI-02 | ✅ |
| UC-05 (Check Status) | FSD 3.1.2 | E2E-UI-01, E2E-UI-04 | ✅ |
| UC-06 (CI Build) | FSD 3.2.2 | SIT-02 | ✅ |
| UC-07 (Publish on Tag) | FSD 3.2.2 | SIT-02 | ✅ |
| UC-08 (Gen Checksums) | FSD 3.2.2 | IT-05, IT-06, E2E-API-01, E2E-API-02 | ✅ |
| UC-09 (Sync Files) | FSD 3.3.2 | IT-07, IT-08, E2E-API-03 to E2E-API-06 | ✅ |
| BR-01 (Modified = hash mismatch) | FSD 3.1.3 | UT-04 | ✅ |
| BR-02 (Outdated = version mismatch) | FSD 3.1.3 | UT-03 | ✅ |
| BR-03 (Missing = not on disk) | FSD 3.1.3 | UT-05 | ✅ |
| BR-04 (Current = all match) | FSD 3.1.3 | UT-02 | ✅ |
| BR-05 (Legacy assigns version to all) | FSD 3.1.3 | UT-09 | ✅ |
| BR-06 (Backup uses timestamp dir) | FSD 3.1.3 | IT-03 | ✅ |
| BR-07 (Gen-checksums reads git HEAD) | FSD 3.1.3 | IT-05 | ✅ |
| BR-08 (Sync only new/changed) | FSD 3.3.3 | IT-07, IT-08, E2E-API-06 | ✅ |
| BR-09 (Sync skip dirs) | FSD 3.3.3 | E2E-API-04 | ✅ |
| BR-10 (Sync skip files) | FSD 3.3.3 | E2E-API-05 | ✅ |
| BR-11 (DryRun no changes) | FSD 3.3.3 | E2E-API-03 | ✅ |
| NFR Performance (< 500ms) | FSD 8 | SIT-03 | ✅ |
| NFR Reliability (corruption recovery) | FSD 8 | UT-08, SIT-04 | ✅ |
| EF-01 (Corrupted manifest) | FSD 3.1.2 | UT-08, SIT-04 | ✅ |
| EF-02 (Permission denied) | FSD 3.1.2 | — (env-dependent) | ⚠️ |

**Coverage: 23/24 requirements covered (96%)**
- EF-02 (permission denied) is environment-dependent and difficult to test reliably in CI.

