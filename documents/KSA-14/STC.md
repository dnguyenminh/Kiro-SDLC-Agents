# Software Test Cases (STC)

## Kiro SDLC Agents Extension — KSA-14: Release v1.0.5 — Fix inject overwrite bug + per-file version tracking

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-14 |
| Title | Release v1.0.5 — Fix inject overwrite bug + per-file version tracking |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-10 |
| Status | Draft |
| Related STP | STP-v1-KSA-14.docx |
| Related FSD | FSD-v1-KSA-14.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-10 | QA Agent | Initiate document — auto-generated from FSD use cases and business rules |

---

## Test Case Summary

| Category | ID Range | Count | Priority |
|----------|----------|-------|----------|
| Functional — Happy Path | TC-001 to TC-010 | 10 | High |
| Functional — Alternative Flows | TC-100 to TC-105 | 6 | High |
| Functional — Exception/Error Flows | TC-200 to TC-205 | 6 | High |
| Business Rule Validation | TC-300 to TC-313 | 13 | High |
| Boundary & Negative Testing | TC-400 to TC-408 | 9 | Medium |
| Non-Functional (Performance) | TC-600 to TC-603 | 4 | Medium |
| Integration Testing | TC-700 to TC-711 | 12 | High |
| Manual SIT (VS Code) | SIT-01 to SIT-08 | 8 | High |

**Total: 68 test cases (60 automated + 8 manual)**

---

## Test Level Classification

| Prefix | Level | Automation | Tools |
|--------|-------|------------|-------|
| TC-0xx to TC-6xx | Unit Test (UT) | ✅ Automated | vitest |
| TC-7xx | Integration Test (IT) | ✅ Automated | vitest + real fs (tmp dirs) |
| SIT-xx | System Integration Test | ❌ Manual | VS Code Extension Host |

---

## 1. Functional Test Cases — Happy Path

### TC-001: computeFileHash returns correct SHA-256 for known content

| Field | Value |
|-------|-------|
| **ID** | TC-001 |
| **Priority** | High |
| **Type** | Functional |
| **Level** | UT |
| **Requirement** | UC-01, UC-03 (hash computation) |
| **Preconditions** | Temp file with known content exists |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create temp file with content `"hello world"` | File created |
| 2 | Call `computeFileHash(tempFilePath)` | Returns `"b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"` |

**Test Data:** Content: `"hello world"` → SHA-256: `b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9`
**Postconditions:** None

---

### TC-002: computeFileHash returns correct hash for empty file

| Field | Value |
|-------|-------|
| **ID** | TC-002 |
| **Priority** | High |
| **Type** | Functional |
| **Level** | UT |
| **Requirement** | UC-01 (edge case) |
| **Preconditions** | Temp file with empty content exists |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create temp file with content `""` (empty) | File created |
| 2 | Call `computeFileHash(tempFilePath)` | Returns `"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"` |

**Test Data:** Empty file → SHA-256: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
**Postconditions:** None

---

### TC-003: detectModifiedFiles finds hash mismatches without version-gating

| Field | Value |
|-------|-------|
| **ID** | TC-003 |
| **Priority** | Critical |
| **Type** | Functional |
| **Level** | UT |
| **Requirement** | UC-01, BR-02 (v1.0.4 bug fix) |
| **Preconditions** | Bundled manifest with file entries; workspace files with different content |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create bundled manifest with file `"a.md"` hash `"abc123"` at version `"1.0.5"` | Manifest created |
| 2 | Create workspace file `"a.md"` with different content (different hash) | File exists |
| 3 | Create workspace manifest with `"a.md"` at version `"1.0.3"` (different version) | Workspace manifest exists |
| 4 | Call `detectModifiedFiles(root, extensionPath)` | Returns array with 1 entry for `"a.md"` |
| 5 | Verify returned entry has correct `relativePath`, `expectedHash`, `actualHash` | All fields match |

**Test Data:** Bundled version: `1.0.5`, workspace version: `1.0.3`, file content differs
**Postconditions:** No files modified

---

### TC-004: getFileStatuses classifies files correctly (current, outdated, modified, missing)

| Field | Value |
|-------|-------|
| **ID** | TC-004 |
| **Priority** | High |
| **Type** | Functional |
| **Level** | UT |
| **Requirement** | UC-02, UC-03 (file classification) |
| **Preconditions** | Bundled manifest with 4 files; workspace with varying states |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create bundled manifest with files: `current.md`, `outdated.md`, `modified.md`, `missing.md` | Manifest created |
| 2 | Create workspace: `current.md` (same version, same hash), `outdated.md` (old version), `modified.md` (same version, different hash) | Files created |
| 3 | Do NOT create `missing.md` in workspace | File absent |
| 4 | Call `getFileStatuses(root, extensionPath)` | Returns 4 FileStatus entries |
| 5 | Verify `current.md` → state `"current"` | Correct |
| 6 | Verify `outdated.md` → state `"outdated"` | Correct |
| 7 | Verify `modified.md` → state `"modified"` | Correct |
| 8 | Verify `missing.md` → state `"missing"` | Correct |

**Test Data:** 4 files with distinct states
**Postconditions:** None

---

### TC-005: safeUpdate auto-overwrites when only outdated files exist

| Field | Value |
|-------|-------|
| **ID** | TC-005 |
| **Priority** | High |
| **Type** | Functional |
| **Level** | UT |
| **Requirement** | UC-02, BR-04 |
| **Preconditions** | Workspace has outdated files only (no user-modified files) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Setup: 3 files at version `"1.0.3"`, bundled at `"1.0.5"`, no hash modifications | Outdated state |
| 2 | Call `safeUpdate(root, extensionPath)` | Returns array of updated component IDs |
| 3 | Verify NO prompt was shown to user | `vscode.window.showWarningMessage` not called |
| 4 | Verify all files now match bundled content | Files overwritten |
| 5 | Verify manifest updated with new versions | Manifest reflects `"1.0.5"` |

**Test Data:** 3 outdated files, 0 modified files
**Postconditions:** All files at bundled version; manifest updated

---

### TC-006: safeUpdate shows "No update needed" when all files current

| Field | Value |
|-------|-------|
| **ID** | TC-006 |
| **Priority** | High |
| **Type** | Functional |
| **Level** | UT |
| **Requirement** | UC-02, AF-02 |
| **Preconditions** | All workspace files match bundled hashes |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Setup: all files at current version with matching hashes | All current |
| 2 | Call `safeUpdate(root, extensionPath)` | Returns empty array `[]` |
| 3 | Verify info message shown: "All files match bundled version. No update needed." | Message displayed |

**Test Data:** All files current
**Postconditions:** No files modified

---

### TC-007: migrateLegacyVersion creates manifest and deletes legacy file

| Field | Value |
|-------|-------|
| **ID** | TC-007 |
| **Priority** | High |
| **Type** | Functional |
| **Level** | UT |
| **Requirement** | UC-04, BR-11 |
| **Preconditions** | `.kiro/.sdlc-version` exists with `{"version":"1.0.3"}` |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create legacy file `.kiro/.sdlc-version` with `{"version":"1.0.3"}` | File exists |
| 2 | Create workspace files matching bundled manifest entries | Files exist |
| 3 | Call `migrateLegacyVersion(root, extensionPath)` | Function completes |
| 4 | Verify `.kiro/.sdlc-manifest.json` exists | New manifest created |
| 5 | Verify manifest entries have version `"1.0.3"` and correct hashes | Entries correct |
| 6 | Verify `.kiro/.sdlc-version` is deleted | Legacy file removed |

**Test Data:** Legacy version: `"1.0.3"`, 3 workspace files
**Postconditions:** New manifest exists; legacy file deleted

---

### TC-008: buildManifestAfterInject records correct version and hash per file

| Field | Value |
|-------|-------|
| **ID** | TC-008 |
| **Priority** | High |
| **Type** | Functional |
| **Level** | UT |
| **Requirement** | UC-01, BR-03 |
| **Preconditions** | Bundled manifest exists; workspace files injected |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create bundled manifest with 3 files at version `"1.0.5"` | Manifest exists |
| 2 | Create corresponding workspace files with known content | Files exist |
| 3 | Call `buildManifestAfterInject(root, extensionPath)` | Function completes |
| 4 | Read `.kiro/.sdlc-manifest.json` | Manifest exists |
| 5 | Verify each entry has `version: "1.0.5"` | Correct version |
| 6 | Verify each entry has correct SHA-256 hash | Hashes match computed values |
| 7 | Verify `lastUpdated` is a valid ISO timestamp | Timestamp valid |

**Test Data:** 3 files with known content and expected hashes
**Postconditions:** Manifest reflects current state

---

### TC-009: getVersionReport formats output correctly

| Field | Value |
|-------|-------|
| **ID** | TC-009 |
| **Priority** | High |
| **Type** | Functional |
| **Level** | UT |
| **Requirement** | UC-03, BR-08, BR-09, BR-10 |
| **Preconditions** | Workspace with mix of current, outdated, and modified files |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Setup: 2 current, 1 outdated (v1.0.3→v1.0.5), 1 modified | Mixed states |
| 2 | Call `getVersionReport(root, extensionPath)` | Returns formatted string |
| 3 | Verify header contains `"Extension version: 1.0.5"` | Header correct |
| 4 | Verify summary line: `"Files: 2 current, 1 outdated, 1 modified, 0 missing"` | Summary correct |
| 5 | Verify outdated section shows `[v1.0.3 → v1.0.5]` format | Arrow format correct |
| 6 | Verify modified section shows `[v1.0.5]` format | Version shown |

**Test Data:** 2 current, 1 outdated, 1 modified, 0 missing
**Postconditions:** None

---

### TC-010: isUpgradeAvailable returns true when files need update

| Field | Value |
|-------|-------|
| **ID** | TC-010 |
| **Priority** | High |
| **Type** | Functional |
| **Level** | UT |
| **Requirement** | UC-02 (upgrade detection) |
| **Preconditions** | Workspace manifest at older version than bundled |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create bundled manifest with file at version `"1.0.5"` | Bundled ready |
| 2 | Create workspace manifest with same file at version `"1.0.3"` | Workspace outdated |
| 3 | Call `isUpgradeAvailable(root, extensionPath)` | Returns `true` |
| 4 | Update workspace manifest to version `"1.0.5"` | Workspace current |
| 5 | Call `isUpgradeAvailable(root, extensionPath)` again | Returns `false` |

**Test Data:** Version mismatch: workspace `1.0.3` vs bundled `1.0.5`
**Postconditions:** None

---

## 2. Functional Test Cases — Alternative Flows

### TC-100: safeUpdate — User selects "Overwrite All" when modified files exist

| Field | Value |
|-------|-------|
| **ID** | TC-100 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Level** | UT |
| **Requirement** | UC-02, BR-05 |
| **Preconditions** | Workspace has both outdated and user-modified files |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Setup: 2 outdated files, 1 user-modified file | Mixed state |
| 2 | Mock `vscode.window.showWarningMessage` to return `"Overwrite All"` | Mock configured |
| 3 | Call `safeUpdate(root, extensionPath)` | Prompt shown |
| 4 | Verify ALL files (including modified) are overwritten with bundled content | All files updated |
| 5 | Verify manifest updated for all files | Manifest correct |

**Test Data:** 2 outdated + 1 modified; user selects "Overwrite All"
**Postconditions:** All files at bundled version

---

### TC-101: safeUpdate — User selects "Skip Modified"

| Field | Value |
|-------|-------|
| **ID** | TC-101 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Level** | UT |
| **Requirement** | UC-02 AF-03, BR-06 |
| **Preconditions** | Workspace has outdated and user-modified files |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Setup: 2 outdated files, 1 user-modified file with known content | Mixed state |
| 2 | Mock prompt to return `"Skip Modified"` | Mock configured |
| 3 | Call `safeUpdate(root, extensionPath)` | Executes skip strategy |
| 4 | Verify outdated files are overwritten | Outdated files updated |
| 5 | Verify user-modified file content is UNCHANGED | Modified file preserved |
| 6 | Verify manifest updated for outdated files only | Manifest partial update |

**Test Data:** 2 outdated + 1 modified; user selects "Skip Modified"
**Postconditions:** Modified file preserved; outdated files updated

---

### TC-102: safeUpdate — User selects "Backup & Overwrite"

| Field | Value |
|-------|-------|
| **ID** | TC-102 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Level** | UT |
| **Requirement** | UC-02 AF-04, BR-07 |
| **Preconditions** | Workspace has user-modified files |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Setup: 1 user-modified file with content `"my custom content"` | Modified file exists |
| 2 | Mock prompt to return `"Backup & Overwrite"` | Mock configured |
| 3 | Call `safeUpdate(root, extensionPath)` | Executes backup strategy |
| 4 | Verify `.kiro/.sdlc-backup/{timestamp}/` directory created | Backup dir exists |
| 5 | Verify backup contains the modified file with original content | Backup content matches |
| 6 | Verify workspace file is now overwritten with bundled content | File updated |
| 7 | Verify info message about backup location shown | Message displayed |

**Test Data:** 1 modified file; user selects "Backup & Overwrite"
**Postconditions:** Backup created; all files at bundled version

---

### TC-103: safeUpdate — User cancels prompt

| Field | Value |
|-------|-------|
| **ID** | TC-103 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Level** | UT |
| **Requirement** | UC-02 EF-03 |
| **Preconditions** | Workspace has modified files; prompt shown |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Setup: 1 outdated, 1 modified file | Mixed state |
| 2 | Mock prompt to return `undefined` (user dismissed) | Mock configured |
| 3 | Call `safeUpdate(root, extensionPath)` | Returns empty array |
| 4 | Verify NO files were modified | All files unchanged |
| 5 | Verify manifest NOT updated | Manifest unchanged |

**Test Data:** User cancels/dismisses prompt
**Postconditions:** No changes made

---

### TC-104: Inject All — User cancels confirmation dialog (AF-01)

| Field | Value |
|-------|-------|
| **ID** | TC-104 |
| **Priority** | Medium |
| **Type** | Functional — Alternative Flow |
| **Level** | UT |
| **Requirement** | UC-01 AF-01 |
| **Preconditions** | Extension activated; workspace exists |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock confirmation dialog to return `undefined` | Mock configured |
| 2 | Trigger "Inject All" command handler | Handler executes |
| 3 | Verify no files were copied | Workspace unchanged |

**Test Data:** User cancels confirmation
**Postconditions:** No changes

---

### TC-105: migrateLegacyVersion — No legacy file exists (AF-05)

| Field | Value |
|-------|-------|
| **ID** | TC-105 |
| **Priority** | Medium |
| **Type** | Functional — Alternative Flow |
| **Level** | UT |
| **Requirement** | UC-04 AF-05 |
| **Preconditions** | No `.kiro/.sdlc-version` file in workspace |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure no `.kiro/.sdlc-version` exists | File absent |
| 2 | Call `migrateLegacyVersion(root, extensionPath)` | Returns immediately (no-op) |
| 3 | Verify no `.kiro/.sdlc-manifest.json` was created or modified | No side effects |

**Test Data:** No legacy file
**Postconditions:** No changes

---

## 3. Functional Test Cases — Exception/Error Flows

### TC-200: injectComponent — Source directory not found (EF-01)

| Field | Value |
|-------|-------|
| **ID** | TC-200 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Level** | UT |
| **Requirement** | UC-01 EF-01 |
| **Preconditions** | Component source path does not exist in extension resources |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Configure component with `sourcePath` pointing to non-existent directory | Component configured |
| 2 | Call `injectComponent(component, root, extensionPath)` | Returns `false` |
| 3 | Verify warning message shown: `"Source not found: {sourcePath}"` | Warning displayed |
| 4 | Verify no files were created in target | Target unchanged |

**Test Data:** Non-existent source path: `"resources/nonexistent"`
**Postconditions:** No files created; operation gracefully failed

---

### TC-201: injectComponent — File permission denied (EF-01)

| Field | Value |
|-------|-------|
| **ID** | TC-201 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Level** | UT |
| **Requirement** | UC-01 EF-01 |
| **Preconditions** | Target directory is read-only |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create source directory with files | Source ready |
| 2 | Create target directory with read-only permissions | Target locked |
| 3 | Call `injectComponent(component, root, extensionPath)` | Returns `false` |
| 4 | Verify error message shown: `"Failed to inject {id}: {err}"` | Error displayed |

**Test Data:** Read-only target directory
**Postconditions:** No files modified; error reported

---

### TC-202: loadBundledManifest — Manifest file missing (EF-02)

| Field | Value |
|-------|-------|
| **ID** | TC-202 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Level** | UT |
| **Requirement** | UC-01 EF-02 |
| **Preconditions** | `resources/.sdlc-checksums.json` does not exist |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set extensionPath to directory without `.sdlc-checksums.json` | No manifest |
| 2 | Call `loadBundledManifest(extensionPath)` | Returns `null` |
| 3 | Call `detectModifiedFiles(root, extensionPath)` | Returns empty array `[]` |
| 4 | Call `getFileStatuses(root, extensionPath)` | Returns empty array `[]` |

**Test Data:** Missing bundled manifest
**Postconditions:** All dependent functions handle null gracefully

---

### TC-203: loadWorkspaceManifest — Corrupted JSON

| Field | Value |
|-------|-------|
| **ID** | TC-203 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Level** | UT |
| **Requirement** | TDD 5.2 (safe defaults pattern) |
| **Preconditions** | `.kiro/.sdlc-manifest.json` contains invalid JSON |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Write `"{invalid json"` to `.kiro/.sdlc-manifest.json` | Corrupted file exists |
| 2 | Call `loadWorkspaceManifest(root)` | Returns `null` |
| 3 | Verify no exception thrown | Graceful handling |

**Test Data:** Content: `"{invalid json"`
**Postconditions:** Function returns null; caller treats as fresh workspace

---

### TC-204: migrateLegacyVersion — Malformed legacy JSON (EF-04)

| Field | Value |
|-------|-------|
| **ID** | TC-204 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Level** | UT |
| **Requirement** | UC-04 EF-04, BR-12 |
| **Preconditions** | `.kiro/.sdlc-version` contains malformed JSON |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Write `"not valid json {{"` to `.kiro/.sdlc-version` | Malformed file exists |
| 2 | Create workspace files matching bundled manifest | Files exist |
| 3 | Call `migrateLegacyVersion(root, extensionPath)` | Completes without error |
| 4 | Verify new manifest entries have version `"1.0.0"` (default) | Default version used |
| 5 | Verify legacy file is deleted | Legacy removed |

**Test Data:** Malformed JSON: `"not valid json {{"`
**Postconditions:** Migration completes with default version `"1.0.0"`

---

### TC-205: migrateLegacyVersion — Cannot write new manifest (EF-05)

| Field | Value |
|-------|-------|
| **ID** | TC-205 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Level** | UT |
| **Requirement** | UC-04 EF-05, BR-11 |
| **Preconditions** | `.kiro/` directory is read-only (cannot write manifest) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create `.kiro/.sdlc-version` with `{"version":"1.0.3"}` | Legacy exists |
| 2 | Make `.kiro/` directory read-only | Cannot write |
| 3 | Call `migrateLegacyVersion(root, extensionPath)` | Throws or logs error |
| 4 | Verify `.kiro/.sdlc-version` is NOT deleted | Legacy preserved |

**Test Data:** Read-only `.kiro/` directory
**Postconditions:** Legacy file preserved (write-before-delete safety)

---

## 4. Business Rule Validation

### TC-300: BR-01 — Inject All overwrites without version comparison

| Field | Value |
|-------|-------|
| **ID** | TC-300 |
| **Priority** | High |
| **Type** | Business Rule |
| **Level** | UT |
| **Requirement** | BR-01 |
| **Preconditions** | Workspace files at various versions |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create workspace files at version `"1.0.3"` with user modifications | Files exist |
| 2 | Call `injectAll(root, extensionPath)` (bypassing confirmation) | All files overwritten |
| 3 | Verify ALL files now match bundled content regardless of prior version | Content matches bundled |

**Test Data:** Files at v1.0.3 with modifications; bundled at v1.0.5

---

### TC-301: BR-02 — detectModifiedFiles does NOT skip on version mismatch

| Field | Value |
|-------|-------|
| **ID** | TC-301 |
| **Priority** | Critical |
| **Type** | Business Rule |
| **Level** | UT |
| **Requirement** | BR-02 (v1.0.4 bug fix) |
| **Preconditions** | Workspace manifest version differs from bundled version |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create bundled manifest at version `"1.0.5"` with 3 files | Bundled ready |
| 2 | Create workspace manifest at version `"1.0.3"` | Version mismatch |
| 3 | Create workspace files with content different from bundled hashes | Hash mismatch |
| 4 | Call `detectModifiedFiles(root, extensionPath)` | Returns 3 modified entries |
| 5 | Verify function does NOT return empty array due to version mismatch | Bug fix verified |

**Test Data:** Version mismatch (1.0.3 vs 1.0.5) + hash mismatch on all 3 files

---

### TC-302: BR-03 — Manifest updated after every inject/update

| Field | Value |
|-------|-------|
| **ID** | TC-302 |
| **Priority** | High |
| **Type** | Business Rule |
| **Level** | UT |
| **Requirement** | BR-03 |
| **Preconditions** | Workspace exists |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `buildManifestAfterInject(root, extensionPath)` | Manifest written |
| 2 | Verify `.kiro/.sdlc-manifest.json` exists | File exists |
| 3 | Verify `lastUpdated` timestamp is recent (within 1 second) | Timestamp valid |
| 4 | Verify all injected files have entries | All files tracked |

**Test Data:** Standard bundled manifest with 3 files

---

### TC-303: BR-04 — Auto-overwrite when only outdated (no prompt)

| Field | Value |
|-------|-------|
| **ID** | TC-303 |
| **Priority** | High |
| **Type** | Business Rule |
| **Level** | UT |
| **Requirement** | BR-04 |
| **Preconditions** | Only outdated files, no user-modified files |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Setup: 3 outdated files (version mismatch), 0 modified (hash matches workspace version) | Only outdated |
| 2 | Call `safeUpdate(root, extensionPath)` | Updates without prompt |
| 3 | Verify `showWarningMessage` was NOT called | No prompt shown |
| 4 | Verify all 3 files updated to bundled content | Files overwritten |

**Test Data:** 3 outdated, 0 modified

---

### TC-304: BR-05 — "Overwrite All" is first/default option

| Field | Value |
|-------|-------|
| **ID** | TC-304 |
| **Priority** | Medium |
| **Type** | Business Rule |
| **Level** | UT |
| **Requirement** | BR-05 |
| **Preconditions** | Prompt is triggered (modified files exist) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Setup: 1 outdated + 1 modified file | Prompt triggered |
| 2 | Capture arguments passed to `showWarningMessage` | Arguments captured |
| 3 | Verify first option after message is `"Overwrite All"` | First option correct |

**Test Data:** 1 outdated + 1 modified

---

### TC-305: BR-06 — Skip Modified leaves user files untouched

| Field | Value |
|-------|-------|
| **ID** | TC-305 |
| **Priority** | High |
| **Type** | Business Rule |
| **Level** | UT |
| **Requirement** | BR-06 |
| **Preconditions** | User-modified file with custom content |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create modified file with content `"user custom content"` | File exists |
| 2 | Execute "Skip Modified" strategy | Strategy runs |
| 3 | Read modified file content | Content is `"user custom content"` (unchanged) |
| 4 | Verify outdated files ARE updated | Outdated files overwritten |

**Test Data:** Modified file content: `"user custom content"`

---

### TC-306: BR-07 — Backup creates files in .sdlc-backup/{timestamp}/

| Field | Value |
|-------|-------|
| **ID** | TC-306 |
| **Priority** | High |
| **Type** | Business Rule |
| **Level** | UT |
| **Requirement** | BR-07 |
| **Preconditions** | User-modified files exist |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create modified file at `.kiro/agents/dev-agent.md` with custom content | File exists |
| 2 | Execute "Backup & Overwrite" strategy | Strategy runs |
| 3 | Verify `.kiro/.sdlc-backup/` directory exists | Directory created |
| 4 | Verify subdirectory with ISO timestamp format exists | Timestamp dir exists |
| 5 | Verify backup file content matches original modified content | Content preserved |

**Test Data:** Modified file: `.kiro/agents/dev-agent.md`

---

### TC-307: BR-08 — Report shows [vOld → vNew] for outdated files

| Field | Value |
|-------|-------|
| **ID** | TC-307 |
| **Priority** | Medium |
| **Type** | Business Rule |
| **Level** | UT |
| **Requirement** | BR-08 |
| **Preconditions** | Outdated files exist |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Setup: file at workspace version `"1.0.3"`, bundled version `"1.0.5"` | Outdated |
| 2 | Call `getVersionReport(root, extensionPath)` | Report generated |
| 3 | Verify report contains `[v1.0.3 → v1.0.5]` | Arrow format present |

**Test Data:** Workspace v1.0.3, bundled v1.0.5

---

### TC-308: BR-09 — Report groups files by state

| Field | Value |
|-------|-------|
| **ID** | TC-308 |
| **Priority** | Medium |
| **Type** | Business Rule |
| **Level** | UT |
| **Requirement** | BR-09 |
| **Preconditions** | Mix of outdated and modified files |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Setup: 1 outdated, 1 modified file | Mixed states |
| 2 | Call `getVersionReport(root, extensionPath)` | Report generated |
| 3 | Verify "⬆️ Outdated (need update):" section exists | Section present |
| 4 | Verify "✏️ Modified by user:" section exists | Section present |
| 5 | Verify outdated files listed under outdated section only | Correct grouping |

**Test Data:** 1 outdated + 1 modified

---

### TC-309: BR-10 — Report header shows extension version and file count

| Field | Value |
|-------|-------|
| **ID** | TC-309 |
| **Priority** | Medium |
| **Type** | Business Rule |
| **Level** | UT |
| **Requirement** | BR-10 |
| **Preconditions** | Bundled manifest with version "1.0.5" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Setup: 2 current, 1 outdated, 1 modified, 0 missing | Known counts |
| 2 | Call `getVersionReport(root, extensionPath)` | Report generated |
| 3 | Verify first line: `"Extension version: 1.0.5"` | Version shown |
| 4 | Verify second line: `"Files: 2 current, 1 outdated, 1 modified, 0 missing"` | Counts correct |

**Test Data:** 2 current, 1 outdated, 1 modified, 0 missing

---

### TC-310: BR-11 — Migration writes new manifest BEFORE deleting legacy

| Field | Value |
|-------|-------|
| **ID** | TC-310 |
| **Priority** | Critical |
| **Type** | Business Rule |
| **Level** | UT |
| **Requirement** | BR-11 |
| **Preconditions** | Legacy file exists; write operation can be intercepted |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create legacy `.sdlc-version` file | Legacy exists |
| 2 | Spy on `fs.writeFileSync` and `fs.unlinkSync` call order | Spies configured |
| 3 | Call `migrateLegacyVersion(root, extensionPath)` | Migration runs |
| 4 | Verify `writeFileSync` (manifest save) called BEFORE `unlinkSync` (legacy delete) | Order correct |

**Test Data:** Standard legacy file
**Note:** This verifies the atomic write-before-delete safety guarantee

---

### TC-311: BR-12 — Malformed legacy defaults to version "1.0.0"

| Field | Value |
|-------|-------|
| **ID** | TC-311 |
| **Priority** | High |
| **Type** | Business Rule |
| **Level** | UT |
| **Requirement** | BR-12 |
| **Preconditions** | Legacy file with invalid JSON |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Write `"corrupted data"` to `.kiro/.sdlc-version` | Malformed file |
| 2 | Call `migrateLegacyVersion(root, extensionPath)` | Completes |
| 3 | Read new manifest | Manifest exists |
| 4 | Verify all entries have version `"1.0.0"` | Default version used |

**Test Data:** Malformed content: `"corrupted data"`

---

### TC-312: BR-13 — Migration is idempotent (skip if manifest exists)

| Field | Value |
|-------|-------|
| **ID** | TC-312 |
| **Priority** | Medium |
| **Type** | Business Rule |
| **Level** | UT |
| **Requirement** | BR-13 |
| **Preconditions** | No legacy file exists (already migrated) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure no `.kiro/.sdlc-version` exists | No legacy |
| 2 | Create existing `.kiro/.sdlc-manifest.json` with known content | Manifest exists |
| 3 | Call `migrateLegacyVersion(root, extensionPath)` | Returns immediately |
| 4 | Verify manifest content unchanged | No modification |

**Test Data:** Pre-existing manifest, no legacy file

---

### TC-313: BR-03 — Manifest updated after selective inject

| Field | Value |
|-------|-------|
| **ID** | TC-313 |
| **Priority** | High |
| **Type** | Business Rule |
| **Level** | UT |
| **Requirement** | BR-03 |
| **Preconditions** | Selective inject of single component |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Inject only "agents" component | Component injected |
| 2 | Call `buildManifestAfterInject(root, extensionPath)` | Manifest rebuilt |
| 3 | Verify manifest contains entries for all existing workspace files | All tracked |

**Test Data:** Single component injection

---

## 5. Boundary & Negative Testing

### TC-400: computeFileHash — Binary file (non-UTF8)

| Field | Value |
|-------|-------|
| **ID** | TC-400 |
| **Priority** | Medium |
| **Type** | Boundary |
| **Level** | UT |
| **Requirement** | checksum.ts robustness |
| **Preconditions** | Binary file exists |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create temp file with binary content (Buffer with random bytes) | Binary file exists |
| 2 | Call `computeFileHash(binaryFilePath)` | Returns valid 64-char hex string |
| 3 | Call again with same file | Returns same hash (deterministic) |

**Test Data:** `Buffer.from([0x00, 0x01, 0xFF, 0xFE, 0x80])`

---

### TC-401: getFileStatuses — Empty bundled manifest (0 files)

| Field | Value |
|-------|-------|
| **ID** | TC-401 |
| **Priority** | Medium |
| **Type** | Boundary |
| **Level** | UT |
| **Requirement** | TDD 8.3 edge case |
| **Preconditions** | Bundled manifest exists but has empty `files` object |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create bundled manifest with `files: {}` | Empty manifest |
| 2 | Call `getFileStatuses(root, extensionPath)` | Returns empty array `[]` |
| 3 | Call `detectModifiedFiles(root, extensionPath)` | Returns empty array `[]` |

**Test Data:** Bundled manifest: `{"version":"1.0.5","generatedAt":"...","files":{}}`

---

### TC-402: isUpgradeAvailable — No workspace manifest exists

| Field | Value |
|-------|-------|
| **ID** | TC-402 |
| **Priority** | Medium |
| **Type** | Boundary |
| **Level** | UT |
| **Requirement** | checksum.ts (fresh workspace) |
| **Preconditions** | No `.kiro/.sdlc-manifest.json` in workspace |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure no workspace manifest exists | Fresh workspace |
| 2 | Create valid bundled manifest with files | Bundled ready |
| 3 | Call `isUpgradeAvailable(root, extensionPath)` | Returns `true` |

**Test Data:** Fresh workspace with no manifest

---

### TC-403: copyDirRecursive — Skips SKIP_DIRS (node_modules, .git, etc.)

| Field | Value |
|-------|-------|
| **ID** | TC-403 |
| **Priority** | Medium |
| **Type** | Negative |
| **Level** | UT |
| **Requirement** | file-utils.ts SKIP_DIRS |
| **Preconditions** | Source directory contains `node_modules/` and `.git/` subdirectories |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create source with: `file.md`, `node_modules/pkg.json`, `.git/config`, `sub/nested.md` | Source ready |
| 2 | Call `copyDirRecursive(source, target)` | Copy completes |
| 3 | Verify `target/file.md` exists | Copied |
| 4 | Verify `target/sub/nested.md` exists | Nested copied |
| 5 | Verify `target/node_modules/` does NOT exist | Skipped |
| 6 | Verify `target/.git/` does NOT exist | Skipped |

**Test Data:** Directories: `node_modules`, `__pycache__`, `out`, `dist`, `.git`

---

### TC-404: copyDirFiltered — Skips paths in skipPaths set

| Field | Value |
|-------|-------|
| **ID** | TC-404 |
| **Priority** | Medium |
| **Type** | Negative |
| **Level** | UT |
| **Requirement** | file-utils.ts (Skip Modified strategy) |
| **Preconditions** | skipPaths contains specific file paths |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create source with: `a.md`, `b.md`, `sub/c.md` | Source ready |
| 2 | Set `skipPaths = new Set([".kiro/agents/b.md"])` | Skip configured |
| 3 | Call `copyDirFiltered({source, target, workspaceRoot, skipPaths})` | Copy completes |
| 4 | Verify `target/a.md` exists | Copied |
| 5 | Verify `target/b.md` does NOT exist (skipped) | Skipped |
| 6 | Verify `target/sub/c.md` exists | Copied |

**Test Data:** skipPaths: `[".kiro/agents/b.md"]`

---

### TC-405: copySelectedItems — Item does not exist in source

| Field | Value |
|-------|-------|
| **ID** | TC-405 |
| **Priority** | Medium |
| **Type** | Negative |
| **Level** | UT |
| **Requirement** | file-utils.ts robustness |
| **Preconditions** | Filter list includes non-existent item |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create source with only `existing.md` | Source ready |
| 2 | Call `copySelectedItems(source, target, ["existing.md", "nonexistent.md"])` | Completes |
| 3 | Verify `target/existing.md` exists | Copied |
| 4 | Verify no error thrown for `nonexistent.md` | Graceful skip |

**Test Data:** Filter: `["existing.md", "nonexistent.md"]`

---

### TC-406: getVersionReport — Truncates at 15 outdated files

| Field | Value |
|-------|-------|
| **ID** | TC-406 |
| **Priority** | Medium |
| **Type** | Boundary |
| **Level** | UT |
| **Requirement** | TDD 7.2 (limit report) |
| **Preconditions** | More than 15 outdated files |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create bundled manifest with 20 files, all outdated | 20 outdated |
| 2 | Call `getVersionReport(root, extensionPath)` | Report generated |
| 3 | Count listed outdated files in report | Exactly 15 listed |
| 4 | Verify `"...and 5 more"` message present | Truncation message shown |

**Test Data:** 20 outdated files

---

### TC-407: getVersionReport — Truncates at 10 modified files

| Field | Value |
|-------|-------|
| **ID** | TC-407 |
| **Priority** | Medium |
| **Type** | Boundary |
| **Level** | UT |
| **Requirement** | TDD 7.2 (limit report) |
| **Preconditions** | More than 10 modified files |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create workspace with 12 modified files (same version, different hash) | 12 modified |
| 2 | Call `getVersionReport(root, extensionPath)` | Report generated |
| 3 | Count listed modified files in report | Exactly 10 listed |
| 4 | Verify `"...and 2 more"` message present | Truncation message shown |

**Test Data:** 12 modified files

---

### TC-408: computeFileHash — File does not exist

| Field | Value |
|-------|-------|
| **ID** | TC-408 |
| **Priority** | Medium |
| **Type** | Negative |
| **Level** | UT |
| **Requirement** | checksum.ts error handling |
| **Preconditions** | File path points to non-existent file |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `computeFileHash("/nonexistent/path/file.md")` | Throws ENOENT error |
| 2 | Verify error is a file-not-found error | Error type correct |

**Test Data:** Path: `/nonexistent/path/file.md`

---

## 6. Non-Functional Testing

### TC-600: Performance — Hash computation < 100ms per file

| Field | Value |
|-------|-------|
| **ID** | TC-600 |
| **Priority** | Medium |
| **Type** | Non-Functional — Performance |
| **Level** | UT |
| **Requirement** | FSD Section 8, TDD 7.1 |
| **Preconditions** | File of ~50KB exists |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create temp file with 50KB of content | File ready |
| 2 | Record start time (`performance.now()`) | Timer started |
| 3 | Call `computeFileHash(filePath)` | Hash computed |
| 4 | Record end time | Timer stopped |
| 5 | Verify elapsed time < 100ms | Performance target met |

**Acceptance Criteria:** Hash computation completes in < 100ms for files ≤ 50KB

---

### TC-601: Performance — Full manifest rebuild < 500ms

| Field | Value |
|-------|-------|
| **ID** | TC-601 |
| **Priority** | Medium |
| **Type** | Non-Functional — Performance |
| **Level** | IT |
| **Requirement** | TDD 7.1 |
| **Preconditions** | 50 workspace files exist |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create 50 temp files (~10KB each) matching bundled manifest | Files ready |
| 2 | Record start time | Timer started |
| 3 | Call `buildManifestAfterInject(root, extensionPath)` | Manifest rebuilt |
| 4 | Record end time | Timer stopped |
| 5 | Verify elapsed time < 500ms | Performance target met |

**Acceptance Criteria:** Full manifest rebuild for 50 files completes in < 500ms

---

### TC-602: Performance — Status check < 200ms

| Field | Value |
|-------|-------|
| **ID** | TC-602 |
| **Priority** | Medium |
| **Type** | Non-Functional — Performance |
| **Level** | UT |
| **Requirement** | TDD 7.1 |
| **Preconditions** | Both manifests exist with 50 file entries |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create bundled + workspace manifests with 50 entries | Manifests ready |
| 2 | Create 50 workspace files | Files exist |
| 3 | Record start time | Timer started |
| 4 | Call `getFileStatuses(root, extensionPath)` | Statuses computed |
| 5 | Record end time | Timer stopped |
| 6 | Verify elapsed time < 200ms | Performance target met |

**Acceptance Criteria:** Status check for 50 files completes in < 200ms

---

### TC-603: Security — No path traversal in manifest paths

| Field | Value |
|-------|-------|
| **ID** | TC-603 |
| **Priority** | Medium |
| **Type** | Non-Functional — Security |
| **Level** | UT |
| **Requirement** | TDD 6.1 (path traversal threat) |
| **Preconditions** | Bundled manifest with path traversal attempt |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create bundled manifest with entry `"../../etc/passwd"` | Malicious path |
| 2 | Call `getFileStatuses(root, extensionPath)` | Function executes |
| 3 | Verify resolved path stays within workspace root | No traversal outside workspace |
| 4 | Verify file at `"../../etc/passwd"` is NOT read | Security maintained |

**Test Data:** Path: `"../../etc/passwd"`
**Note:** Current implementation uses `path.join(root, relativePath)` which resolves relative to root

---

## 7. Integration Testing

### TC-700: Full inject lifecycle on empty workspace

| Field | Value |
|-------|-------|
| **ID** | TC-700 |
| **Priority** | High |
| **Type** | Integration |
| **Level** | IT |
| **Requirement** | UC-01, TDD IT-01 |
| **Preconditions** | Empty temp directory (no .kiro/ folder) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create empty temp workspace directory | Empty dir |
| 2 | Create extension resources with bundled manifest and source files | Resources ready |
| 3 | Call `injectAll(root, extensionPath)` (mock VS Code prompts) | Injection completes |
| 4 | Verify all component files exist in workspace | Files created |
| 5 | Verify `.kiro/.sdlc-manifest.json` exists | Manifest created |
| 6 | Verify manifest entries match bundled versions and computed hashes | Entries correct |

**Test Data:** Empty workspace; bundled manifest with 5 files
**Postconditions:** Workspace fully populated; manifest accurate

---

### TC-701: Safe update with only outdated files (auto-overwrite)

| Field | Value |
|-------|-------|
| **ID** | TC-701 |
| **Priority** | High |
| **Type** | Integration |
| **Level** | IT |
| **Requirement** | UC-02, BR-04, TDD IT-02 |
| **Preconditions** | Workspace at v1.0.3; bundled at v1.0.5; no user modifications |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create workspace with files at v1.0.3 (matching v1.0.3 hashes) | Workspace ready |
| 2 | Create workspace manifest recording v1.0.3 for all files | Manifest at v1.0.3 |
| 3 | Create bundled manifest at v1.0.5 with different hashes | Bundle newer |
| 4 | Create bundled source files with v1.0.5 content | Sources ready |
| 5 | Call `safeUpdate(root, extensionPath)` | Auto-overwrites |
| 6 | Verify all files now have v1.0.5 content | Content updated |
| 7 | Verify manifest shows v1.0.5 for all files | Manifest updated |

**Test Data:** 3 files: workspace v1.0.3, bundled v1.0.5
**Postconditions:** All files at v1.0.5

---

### TC-702: Safe update with modified files — Skip Modified strategy

| Field | Value |
|-------|-------|
| **ID** | TC-702 |
| **Priority** | High |
| **Type** | Integration |
| **Level** | IT |
| **Requirement** | UC-02, BR-06, TDD IT-03 |
| **Preconditions** | Workspace has 2 outdated + 1 user-modified file |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create workspace: 2 files at v1.0.3, 1 file at v1.0.5 with modified content | Mixed state |
| 2 | Mock prompt to return "Skip Modified" | Mock ready |
| 3 | Call `safeUpdate(root, extensionPath)` | Prompt shown; skip strategy executed |
| 4 | Verify 2 outdated files updated to v1.0.5 content | Outdated updated |
| 5 | Verify modified file content UNCHANGED | Modified preserved |
| 6 | Verify manifest updated for outdated files, modified file entry unchanged | Manifest correct |

**Test Data:** 2 outdated + 1 modified; user selects "Skip Modified"
**Postconditions:** Outdated updated; modified preserved

---

### TC-703: Safe update with modified files — Backup & Overwrite strategy

| Field | Value |
|-------|-------|
| **ID** | TC-703 |
| **Priority** | High |
| **Type** | Integration |
| **Level** | IT |
| **Requirement** | UC-02, BR-07, TDD IT-03 |
| **Preconditions** | Workspace has user-modified file |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create workspace with 1 modified file (content: `"my custom agent"`) | Modified exists |
| 2 | Mock prompt to return "Backup & Overwrite" | Mock ready |
| 3 | Call `safeUpdate(root, extensionPath)` | Backup + overwrite executed |
| 4 | Verify `.kiro/.sdlc-backup/` directory created | Backup dir exists |
| 5 | Verify backup file contains `"my custom agent"` | Original content backed up |
| 6 | Verify workspace file now has bundled content | File overwritten |
| 7 | Verify manifest updated | Manifest correct |

**Test Data:** Modified content: `"my custom agent"`
**Postconditions:** Backup created; all files at bundled version

---

### TC-704: Legacy migration end-to-end

| Field | Value |
|-------|-------|
| **ID** | TC-704 |
| **Priority** | High |
| **Type** | Integration |
| **Level** | IT |
| **Requirement** | UC-04, BR-11, TDD IT-04 |
| **Preconditions** | Workspace with legacy `.sdlc-version` and existing files |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create `.kiro/.sdlc-version` with `{"version":"1.0.3"}` | Legacy exists |
| 2 | Create 5 workspace files matching bundled manifest paths | Files exist |
| 3 | Call `migrateLegacyVersion(root, extensionPath)` | Migration runs |
| 4 | Verify `.kiro/.sdlc-manifest.json` created with 5 entries | Manifest created |
| 5 | Verify all entries have version `"1.0.3"` | Legacy version preserved |
| 6 | Verify all entries have correct SHA-256 hashes | Hashes computed |
| 7 | Verify `.kiro/.sdlc-version` deleted | Legacy removed |
| 8 | Call `migrateLegacyVersion` again | No-op (idempotent) |

**Test Data:** Legacy version: `"1.0.3"`, 5 workspace files
**Postconditions:** New manifest exists; legacy gone; second call is no-op

---

### TC-705: Inject → Modify → Safe Update → Verify flow

| Field | Value |
|-------|-------|
| **ID** | TC-705 |
| **Priority** | High |
| **Type** | Integration |
| **Level** | IT |
| **Requirement** | UC-01 + UC-02 combined flow |
| **Preconditions** | Empty workspace |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `injectAll(root, extensionPath)` | All files injected |
| 2 | Verify manifest created with correct entries | Manifest correct |
| 3 | Modify one workspace file (append `"\n// custom"`) | File modified |
| 4 | Call `detectModifiedFiles(root, extensionPath)` | Returns 1 modified file |
| 5 | Call `getFileStatuses(root, extensionPath)` | Shows 1 "modified" |
| 6 | Call `getVersionReport(root, extensionPath)` | Report shows modified file |

**Test Data:** Standard inject then manual modification
**Postconditions:** System correctly detects user modification

---

### TC-706: copyDirRecursive — Deep nested directory structure

| Field | Value |
|-------|-------|
| **ID** | TC-706 |
| **Priority** | Medium |
| **Type** | Integration |
| **Level** | IT |
| **Requirement** | file-utils.ts |
| **Preconditions** | Source with 3-level deep nesting |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create source: `a/b/c/deep.md`, `a/file.md`, `root.md` | Deep structure |
| 2 | Call `copyDirRecursive(source, target)` | Copy completes |
| 3 | Verify `target/root.md` exists with correct content | Root copied |
| 4 | Verify `target/a/file.md` exists | Level 1 copied |
| 5 | Verify `target/a/b/c/deep.md` exists | Level 3 copied |

**Test Data:** 3-level nested structure
**Postconditions:** All files copied preserving structure

---

### TC-707: copyDirRecursive — Overwrites existing files

| Field | Value |
|-------|-------|
| **ID** | TC-707 |
| **Priority** | Medium |
| **Type** | Integration |
| **Level** | IT |
| **Requirement** | file-utils.ts (overwrite behavior) |
| **Preconditions** | Target already has files with different content |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create target with `file.md` containing `"old content"` | Target exists |
| 2 | Create source with `file.md` containing `"new content"` | Source ready |
| 3 | Call `copyDirRecursive(source, target)` | Copy completes |
| 4 | Read `target/file.md` | Content is `"new content"` |

**Test Data:** Old: `"old content"`, New: `"new content"`
**Postconditions:** File overwritten

---

### TC-708: copySelectedItems — Mix of files and directories

| Field | Value |
|-------|-------|
| **ID** | TC-708 |
| **Priority** | Medium |
| **Type** | Integration |
| **Level** | IT |
| **Requirement** | file-utils.ts (selective copy) |
| **Preconditions** | Source has both files and directories |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create source: `file.md`, `dir/nested.md`, `other.md` | Source ready |
| 2 | Call `copySelectedItems(source, target, ["file.md", "dir"])` | Selective copy |
| 3 | Verify `target/file.md` exists | File copied |
| 4 | Verify `target/dir/nested.md` exists | Directory recursively copied |
| 5 | Verify `target/other.md` does NOT exist | Not in filter, not copied |

**Test Data:** Filter: `["file.md", "dir"]`

---

### TC-709: isUpgradeAvailable — New file added in bundled (not in workspace)

| Field | Value |
|-------|-------|
| **ID** | TC-709 |
| **Priority** | Medium |
| **Type** | Integration |
| **Level** | IT |
| **Requirement** | checksum.ts (new file detection) |
| **Preconditions** | Bundled has file not present in workspace manifest |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create workspace manifest with 3 files at v1.0.5 | Workspace ready |
| 2 | Create bundled manifest with 4 files (1 new) at v1.0.5 | Bundled has extra |
| 3 | Call `isUpgradeAvailable(root, extensionPath)` | Returns `true` |

**Test Data:** Workspace: 3 files; Bundled: 4 files (1 new)

---

### TC-710: Full lifecycle — Legacy migrate → inject → update → report

| Field | Value |
|-------|-------|
| **ID** | TC-710 |
| **Priority** | High |
| **Type** | Integration |
| **Level** | IT |
| **Requirement** | All UCs combined |
| **Preconditions** | Workspace with legacy version file |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create legacy `.sdlc-version` at v1.0.3 with workspace files | Legacy state |
| 2 | Call `migrateLegacyVersion(root, extensionPath)` | Migrates to manifest |
| 3 | Verify manifest at v1.0.3 | Migration correct |
| 4 | Simulate extension upgrade: update bundled manifest to v1.0.5 | New bundle |
| 5 | Call `isUpgradeAvailable(root, extensionPath)` | Returns `true` |
| 6 | Call `safeUpdate(root, extensionPath)` | Auto-overwrites (only outdated) |
| 7 | Verify all files at v1.0.5 | Updated |
| 8 | Call `getVersionReport(root, extensionPath)` | Shows all current |

**Test Data:** Full lifecycle from v1.0.3 legacy to v1.0.5 current
**Postconditions:** Clean state at v1.0.5

---

### TC-711: saveWorkspaceManifest — Creates .kiro/ directory if missing

| Field | Value |
|-------|-------|
| **ID** | TC-711 |
| **Priority** | Medium |
| **Type** | Integration |
| **Level** | IT |
| **Requirement** | checksum.ts (directory creation) |
| **Preconditions** | Workspace has no `.kiro/` directory |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create workspace root with no `.kiro/` subdirectory | No .kiro |
| 2 | Call `saveWorkspaceManifest(root, manifest)` | Saves successfully |
| 3 | Verify `.kiro/` directory was created | Directory exists |
| 4 | Verify `.kiro/.sdlc-manifest.json` exists with correct content | File written |

**Test Data:** Empty workspace root
**Postconditions:** `.kiro/` directory and manifest created

---

## 8. Manual System Integration Testing (SIT)

### SIT-01: Inject All via Command Palette

| Field | Value |
|-------|-------|
| **ID** | SIT-01 |
| **Priority** | High |
| **Type** | System Integration — Manual |
| **Level** | SIT |
| **Requirement** | UC-01, Story 1 |
| **Preconditions** | VS Code open with workspace; extension v1.0.5 installed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Command Palette (Ctrl+Shift+P) | Palette opens |
| 2 | Type "Kiro SDLC: Inject All" | Command appears |
| 3 | Select the command | Confirmation dialog appears |
| 4 | Confirm injection | Files are copied to workspace |
| 5 | Verify `.kiro/agents/` directory populated | Agent files present |
| 6 | Verify `.kiro/.sdlc-manifest.json` created | Manifest exists |
| 7 | Verify success notification: "✅ Injected N components" | Notification shown |

**Test Data:** Fresh workspace with no prior injection
**Postconditions:** All components injected; manifest created

---

### SIT-02: Update Agents — Auto-overwrite (outdated only)

| Field | Value |
|-------|-------|
| **ID** | SIT-02 |
| **Priority** | High |
| **Type** | System Integration — Manual |
| **Level** | SIT |
| **Requirement** | UC-02, BR-04 |
| **Preconditions** | Workspace has files from older version (v1.0.3); no user modifications |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Command Palette | Palette opens |
| 2 | Run "Kiro SDLC: Update Agents" | Command executes |
| 3 | Observe: NO prompt appears (auto-overwrite) | No dialog shown |
| 4 | Verify files updated to v1.0.5 content | Files updated |
| 5 | Verify manifest updated | Manifest reflects v1.0.5 |

**Test Data:** Workspace at v1.0.3 with matching hashes (no modifications)
**Postconditions:** All files at v1.0.5

---

### SIT-03: Update Agents — Prompt for modified files

| Field | Value |
|-------|-------|
| **ID** | SIT-03 |
| **Priority** | High |
| **Type** | System Integration — Manual |
| **Level** | SIT |
| **Requirement** | UC-02, BR-05 |
| **Preconditions** | Workspace has user-modified agent file |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Manually edit `.kiro/agents/dev-agent.md` (add custom content) | File modified |
| 2 | Run "Kiro SDLC: Update Agents" | Command executes |
| 3 | Observe: Warning dialog appears with file details | Prompt shown |
| 4 | Verify dialog shows "✏️ 1 file(s) modified by you" | Modified count correct |
| 5 | Verify "Overwrite All" is first option | Default option correct |
| 6 | Select "Skip Modified" | Strategy executes |
| 7 | Verify modified file content unchanged | Modification preserved |

**Test Data:** Manually edited agent file
**Postconditions:** Modified file preserved; outdated files updated

---

### SIT-04: Show File Versions command

| Field | Value |
|-------|-------|
| **ID** | SIT-04 |
| **Priority** | High |
| **Type** | System Integration — Manual |
| **Level** | SIT |
| **Requirement** | UC-03, BR-08, BR-09, BR-10 |
| **Preconditions** | Workspace with mix of current and outdated files |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run "Kiro SDLC: Show File Versions" | Command executes |
| 2 | Observe Output Channel opens | Output panel visible |
| 3 | Verify header: "Extension version: 1.0.5" | Version shown |
| 4 | Verify file count summary line | Counts correct |
| 5 | Verify outdated files show `[v{old} → v{new}]` format | Arrow format |
| 6 | Verify files grouped by state | Logical grouping |

**Test Data:** Mix of current, outdated, modified files
**Postconditions:** Report displayed in Output Channel

---

### SIT-05: Legacy migration on first activation

| Field | Value |
|-------|-------|
| **ID** | SIT-05 |
| **Priority** | High |
| **Type** | System Integration — Manual |
| **Level** | SIT |
| **Requirement** | UC-04, BR-11 |
| **Preconditions** | Workspace has `.kiro/.sdlc-version` (from v1.0.3 extension) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create `.kiro/.sdlc-version` with `{"version":"1.0.3"}` | Legacy file exists |
| 2 | Reload VS Code window (extension reactivates) | Extension activates |
| 3 | Verify `.kiro/.sdlc-manifest.json` created | New manifest exists |
| 4 | Verify `.kiro/.sdlc-version` deleted | Legacy removed |
| 5 | Run "Show File Versions" to confirm migration worked | Report shows v1.0.3 entries |

**Test Data:** Legacy version file at v1.0.3
**Postconditions:** Migrated to new manifest format

---

### SIT-06: Upgrade notification on activation

| Field | Value |
|-------|-------|
| **ID** | SIT-06 |
| **Priority** | Medium |
| **Type** | System Integration — Manual |
| **Level** | SIT |
| **Requirement** | TDD 3.4.2 (activation flow) |
| **Preconditions** | Workspace at older version; extension just upgraded |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure workspace manifest at v1.0.3 | Outdated workspace |
| 2 | Install extension v1.0.5 | Extension upgraded |
| 3 | Reload VS Code | Extension activates |
| 4 | Observe notification: "Update available → v1.0.5" | Notification shown |
| 5 | Click "Update Now" | safeUpdate executes |
| 6 | Verify files updated | Update successful |

**Test Data:** Workspace at v1.0.3, extension at v1.0.5
**Postconditions:** Files updated to v1.0.5

---

### SIT-07: Status bar icon reflects component state

| Field | Value |
|-------|-------|
| **ID** | SIT-07 |
| **Priority** | Medium |
| **Type** | System Integration — Manual |
| **Level** | SIT |
| **Requirement** | TDD 3.4.3 (status bar) |
| **Preconditions** | Extension activated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Inject all components | All present |
| 2 | Verify status bar shows `$(check) SDLC Agents` | Check icon |
| 3 | Delete one component directory | Component missing |
| 4 | Reload window | Status refreshes |
| 5 | Verify status bar shows `$(warning) SDLC Agents` | Warning icon |

**Test Data:** Full workspace → partial workspace
**Postconditions:** Status bar reflects actual state

---

### SIT-08: npm run compile + vsce package

| Field | Value |
|-------|-------|
| **ID** | SIT-08 |
| **Priority** | High |
| **Type** | System Integration — Manual |
| **Level** | SIT |
| **Requirement** | Story 5 |
| **Preconditions** | Source code at v1.0.5; Node.js installed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `npm run compile` in extension directory | Compiles successfully |
| 2 | Verify zero TypeScript errors | No errors |
| 3 | Run `vsce package` | VSIX created |
| 4 | Verify `kiro-sdlc-agents-1.0.5.vsix` exists | File present |
| 5 | Install VSIX in VS Code | Extension installs |
| 6 | Verify extension activates without errors | No activation errors |

**Test Data:** Extension source code at v1.0.5
**Postconditions:** Valid VSIX produced and installable

---

## 9. Requirements Traceability Matrix (RTM)

| Requirement | Source | Test Cases | Status |
|-------------|--------|------------|--------|
| UC-01 (Inject All) | FSD 3.1 | TC-001, TC-002, TC-008, TC-104, TC-200, TC-201, TC-202, TC-300, TC-700, SIT-01 | ✅ Covered |
| UC-02 (Safe Update) | FSD 3.2 | TC-003, TC-004, TC-005, TC-006, TC-100, TC-101, TC-102, TC-103, TC-303, TC-304, TC-305, TC-306, TC-701, TC-702, TC-703, SIT-02, SIT-03 | ✅ Covered |
| UC-03 (Version Report) | FSD 3.3 | TC-004, TC-009, TC-307, TC-308, TC-309, TC-406, TC-407, SIT-04 | ✅ Covered |
| UC-04 (Legacy Migration) | FSD 3.4 | TC-007, TC-105, TC-204, TC-205, TC-310, TC-311, TC-312, TC-704, TC-710, SIT-05 | ✅ Covered |
| BR-01 | FSD 3.1.3 | TC-300 | ✅ Covered |
| BR-02 | FSD 3.1.3 | TC-003, TC-301 | ✅ Covered |
| BR-03 | FSD 3.1.3 | TC-008, TC-302, TC-313 | ✅ Covered |
| BR-04 | FSD 3.2.3 | TC-005, TC-303, TC-701 | ✅ Covered |
| BR-05 | FSD 3.2.3 | TC-100, TC-304 | ✅ Covered |
| BR-06 | FSD 3.2.3 | TC-101, TC-305, TC-702 | ✅ Covered |
| BR-07 | FSD 3.2.3 | TC-102, TC-306, TC-703 | ✅ Covered |
| BR-08 | FSD 3.3.3 | TC-009, TC-307 | ✅ Covered |
| BR-09 | FSD 3.3.3 | TC-009, TC-308 | ✅ Covered |
| BR-10 | FSD 3.3.3 | TC-009, TC-309 | ✅ Covered |
| BR-11 | FSD 3.4.3 | TC-007, TC-205, TC-310, TC-704 | ✅ Covered |
| BR-12 | FSD 3.4.3 | TC-204, TC-311 | ✅ Covered |
| BR-13 | FSD 3.4.3 | TC-105, TC-312 | ✅ Covered |
| Story 1 (Inject All overwrites) | BRD 2.3 | TC-300, TC-700, SIT-01 | ✅ Covered |
| Story 2 (Smart overwrite) | BRD 2.3 | TC-005, TC-100–TC-103, TC-701–TC-703, SIT-02, SIT-03 | ✅ Covered |
| Story 3 (Per-file visibility) | BRD 2.3 | TC-009, TC-307–TC-309, SIT-04 | ✅ Covered |
| Story 4 (Legacy migration) | BRD 2.3 | TC-007, TC-204, TC-310–TC-312, TC-704, SIT-05 | ✅ Covered |
| Story 5 (Clean compile) | BRD 2.3 | SIT-08 | ✅ Covered |
| NFR — Performance (hash < 100ms) | FSD 8 | TC-600 | ✅ Covered |
| NFR — Performance (rebuild < 500ms) | FSD 8 | TC-601 | ✅ Covered |
| NFR — Performance (status < 200ms) | FSD 8 | TC-602 | ✅ Covered |
| NFR — Security (path traversal) | TDD 6.1 | TC-603 | ✅ Covered |

**Coverage Summary:**

| Category | Total | Covered | Coverage % |
|----------|-------|---------|------------|
| Use Cases | 4 | 4 | 100% |
| Business Rules | 13 | 13 | 100% |
| User Stories | 5 | 5 | 100% |
| Non-Functional Requirements | 4 | 4 | 100% |
| **Overall** | **26** | **26** | **100%** |

---

## 10. Appendix

### Test Data Setup

**Bundled Manifest Fixture (`test-fixtures/bundled-manifest.json`):**

```json
{
  "version": "1.0.5",
  "generatedAt": "2026-05-10T09:00:00.000Z",
  "files": {
    ".kiro/agents/sm-agent.md": {
      "hash": "abc123def456",
      "version": "1.0.5",
      "injectedAt": "2026-05-10T09:00:00.000Z"
    },
    ".kiro/agents/ba-agent.md": {
      "hash": "789ghi012jkl",
      "version": "1.0.5",
      "injectedAt": "2026-05-10T09:00:00.000Z"
    },
    ".kiro/agents/dev-agent.md": {
      "hash": "mno345pqr678",
      "version": "1.0.5",
      "injectedAt": "2026-05-10T09:00:00.000Z"
    }
  }
}
```

**Legacy Version Fixture (`test-fixtures/legacy-version.json`):**

```json
{
  "version": "1.0.3"
}
```

### Environment Configuration

- **Test Runner:** vitest (to be configured in `package.json`)
- **Temp Directory:** Use `os.tmpdir()` + unique prefix for each test
- **Cleanup:** Each test creates and removes its own temp directory
- **VS Code Mocks:** Mock `vscode` module for unit tests (no extension host needed)
- **File System:** Real file system operations on temp directories (no mocks)

### vitest Configuration (to be added)

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/checksum.ts', 'src/file-utils.ts', 'src/injector.ts'],
    },
  },
});
```
