# Software Test Cases (STC)

## Kiro SDLC Agents Extension — KSA-4: Indexer Selection — Choose ONE Language

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-4 |
| Title | Indexer Selection — Choose ONE Language |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-07-10 |
| Status | Draft |
| Related STP | STP-v1-KSA-4.docx |
| Related FSD | FSD-v1-KSA-4.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-10 | QA Agent | Initiate document — test cases from FSD use cases and business rules |

---

## Test Case Summary

| Category | ID Range | Count |
|----------|----------|-------|
| Functional — Happy Path | TC-001 to TC-005 | 5 |
| Functional — Alternative Flows | TC-100 to TC-101 | 2 |
| Functional — Exception/Error Flows | TC-200 to TC-202 | 3 |
| Business Rule Validation | TC-300 to TC-305 | 6 |
| UI/UX Testing | TC-500 to TC-503 | 4 |
| Non-Functional | TC-600 | 1 |
| Integration Testing | TC-700 | 1 |
| **Total** | | **22** |

---

## 1. Functional Test Cases — Happy Path

### TC-001: Select Python Indexer — Full Flow

| Field | Value |
|-------|-------|
| **ID** | TC-001 |
| **Priority** | High |
| **Type** | Functional |
| **Level** | UT / E2E-UI |
| **Requirement** | UC-1, UC-2, UC-3, Story 1, Story 2, Story 3 |
| **Preconditions** | Extension activated, workspace open, inject command triggered |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger "Inject All" command | pickIndexer() is called |
| 2 | QuickPick appears | 5 options displayed with correct labels |
| 3 | Select "Python Indexer (recommended — zero dependency)" | QuickPick closes, returns indexer-python Component |
| 4 | Verify base config copied | `index-config.json`, `modules/`, `scripts/README.md` exist at `.analysis/code-intelligence/` |
| 5 | Verify Python scripts copied | `scripts/python/` directory exists with all Python indexer files |
| 6 | Verify no other language dirs added | `scripts/java/`, `scripts/bash/`, etc. do NOT exist (unless pre-existing) |

**Test Data:** INDEXER_OPTIONS[0] = { id: "indexer-python", label: "Python Indexer (recommended — zero dependency)" }
**Postconditions:** Workspace has base config + python scripts only

---

### TC-002: Select Java Indexer

| Field | Value |
|-------|-------|
| **ID** | TC-002 |
| **Priority** | High |
| **Type** | Functional |
| **Level** | UT |
| **Requirement** | UC-1, UC-3, Story 2 |
| **Preconditions** | Extension activated, workspace open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger injection, select "Java Indexer" | Returns indexer-java Component |
| 2 | Verify base config copied | `index-config.json`, `modules/`, `scripts/README.md` exist |
| 3 | Verify Java scripts copied | `scripts/java/` directory exists |

**Test Data:** INDEXER_OPTIONS[1] = { id: "indexer-java" }
**Postconditions:** Workspace has base config + java scripts

---

### TC-003: Select PowerShell Indexer

| Field | Value |
|-------|-------|
| **ID** | TC-003 |
| **Priority** | High |
| **Type** | Functional |
| **Level** | UT |
| **Requirement** | UC-1, UC-3, Story 2 |
| **Preconditions** | Extension activated, workspace open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger injection, select "PowerShell Indexer" | Returns indexer-powershell Component |
| 2 | Verify base config + PowerShell scripts copied | `scripts/powershell/` exists |

**Test Data:** INDEXER_OPTIONS[2] = { id: "indexer-powershell" }

---

### TC-004: Select Bash Indexer

| Field | Value |
|-------|-------|
| **ID** | TC-004 |
| **Priority** | High |
| **Type** | Functional |
| **Level** | UT |
| **Requirement** | UC-1, UC-3, Story 2 |
| **Preconditions** | Extension activated, workspace open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger injection, select "Bash Indexer" | Returns indexer-bash Component |
| 2 | Verify base config + Bash scripts copied | `scripts/bash/` exists |

**Test Data:** INDEXER_OPTIONS[3] = { id: "indexer-bash" }

---

### TC-005: Select Node.js Indexer

| Field | Value |
|-------|-------|
| **ID** | TC-005 |
| **Priority** | High |
| **Type** | Functional |
| **Level** | UT |
| **Requirement** | UC-1, UC-3, Story 2 |
| **Preconditions** | Extension activated, workspace open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger injection, select "Node.js Indexer (most accurate)" | Returns indexer-nodejs Component |
| 2 | Verify base config + Node.js scripts copied | `scripts/nodejs/` exists |

**Test Data:** INDEXER_OPTIONS[4] = { id: "indexer-nodejs" }

---

## 2. Functional Test Cases — Alternative Flows

### TC-100: Filter Text Narrows Options (AF-1)

| Field | Value |
|-------|-------|
| **ID** | TC-100 |
| **Priority** | Medium |
| **Type** | Functional — Alternative Flow |
| **Level** | E2E-UI |
| **Requirement** | UC-1 AF-1 |
| **Preconditions** | QuickPick is displayed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Type "node" in QuickPick filter | Only "Node.js Indexer (most accurate)" visible |
| 2 | Press Enter | Node.js indexer selected and returned |

---

### TC-101: Keyboard Navigation (AF-2)

| Field | Value |
|-------|-------|
| **ID** | TC-101 |
| **Priority** | Medium |
| **Type** | Functional — Alternative Flow |
| **Level** | SIT |
| **Requirement** | UC-1 AF-2 |
| **Preconditions** | QuickPick is displayed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Press Down Arrow 3 times | "Bash Indexer" is highlighted (4th item) |
| 2 | Press Enter | Bash indexer selected and returned |

---

## 3. Functional Test Cases — Exception/Error Flows

### TC-200: User Cancels with ESC (EF-1)

| Field | Value |
|-------|-------|
| **ID** | TC-200 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Level** | UT / E2E-UI |
| **Requirement** | UC-1 EF-1, BR-3 |
| **Preconditions** | QuickPick is displayed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Press ESC while QuickPick is open | QuickPick closes |
| 2 | Verify pickIndexer() return value | Returns `undefined` |
| 3 | Verify no indexer files copied | No `scripts/{language}/` directories added |
| 4 | Verify core components still injected | Agents, steering, hooks, templates present |

**Postconditions:** Workspace has core components but no indexer files

---

### TC-201: User Clicks Outside QuickPick (EF-2)

| Field | Value |
|-------|-------|
| **ID** | TC-201 |
| **Priority** | Medium |
| **Type** | Functional — Exception Flow |
| **Level** | SIT |
| **Requirement** | UC-1 EF-2, BR-3 |
| **Preconditions** | QuickPick is displayed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click on editor area outside QuickPick | QuickPick dismisses |
| 2 | Verify no indexer files copied | Same as TC-200 |

---

### TC-202: Source Directory Missing (EF-3)

| Field | Value |
|-------|-------|
| **ID** | TC-202 |
| **Priority** | Medium |
| **Type** | Functional — Exception Flow |
| **Level** | UT |
| **Requirement** | UC-1 EF-3 |
| **Preconditions** | Extension resources missing the selected language directory |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select Python indexer (but python/ dir missing from resources) | injectComponent() detects missing source |
| 2 | Verify warning shown | VS Code warning: "Source not found: .analysis/code-intelligence/scripts/python" |
| 3 | Verify function returns false | injectComponent() returns false |

---

## 4. Business Rule Validation

### TC-300: BR-1 — Exactly ONE Language Selected

| Field | Value |
|-------|-------|
| **ID** | TC-300 |
| **Priority** | High |
| **Type** | Business Rule |
| **Level** | UT |
| **Requirement** | BR-1 |
| **Preconditions** | QuickPick configured |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify QuickPick options: `canPickMany` | Value is `false` |
| 2 | Call showQuickPick with canPickMany: false | Only single item returned (not array) |

---

### TC-301: BR-2 — Base Config Always Copied

| Field | Value |
|-------|-------|
| **ID** | TC-301 |
| **Priority** | High |
| **Type** | Business Rule |
| **Level** | IT |
| **Requirement** | BR-2, UC-2 |
| **Preconditions** | User selects any language |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select any indexer language | injectComponent(INDEXER_BASE) called BEFORE language copy |
| 2 | Verify `index-config.json` exists | File present at `.analysis/code-intelligence/index-config.json` |
| 3 | Verify `modules/` exists | Directory present at `.analysis/code-intelligence/modules/` |
| 4 | Verify `scripts/README.md` exists | File present at `.analysis/code-intelligence/scripts/README.md` |

---

### TC-302: BR-3 — Cancellation = No Indexer Files

| Field | Value |
|-------|-------|
| **ID** | TC-302 |
| **Priority** | High |
| **Type** | Business Rule |
| **Level** | UT |
| **Requirement** | BR-3 |
| **Preconditions** | pickIndexer() returns undefined |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | pickIndexer() returns undefined | injectComponent(INDEXER_BASE) NOT called |
| 2 | Verify no base config copied | `index-config.json` does NOT exist |
| 3 | Verify core components still injected | agents/, steering/, hooks/ present |

---

### TC-303: BR-5/BR-12 — Existing Files Not Deleted

| Field | Value |
|-------|-------|
| **ID** | TC-303 |
| **Priority** | Medium |
| **Type** | Business Rule |
| **Level** | IT |
| **Requirement** | BR-5, BR-12 |
| **Preconditions** | Workspace already has `scripts/bash/` from previous injection |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select Python indexer | Python scripts copied |
| 2 | Verify `scripts/bash/` still exists | Previous bash scripts NOT deleted |
| 3 | Verify `scripts/python/` exists | New python scripts added |

---

### TC-304: BR-6 — Base Copied Before Language

| Field | Value |
|-------|-------|
| **ID** | TC-304 |
| **Priority** | High |
| **Type** | Business Rule |
| **Level** | IT |
| **Requirement** | BR-6 |
| **Preconditions** | Injection triggered with language selected |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock injectComponent to track call order | — |
| 2 | Select Python indexer | injectComponent(INDEXER_BASE) called first |
| 3 | Verify call order | INDEXER_BASE before indexer-python |

---

### TC-305: BR-9 — Only ONE Language Directory Copied

| Field | Value |
|-------|-------|
| **ID** | TC-305 |
| **Priority** | High |
| **Type** | Business Rule |
| **Level** | IT |
| **Requirement** | BR-9 |
| **Preconditions** | Clean workspace, select Java |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select Java indexer on clean workspace | Java scripts copied |
| 2 | List `scripts/` directory contents | Only `README.md` and `java/` present |
| 3 | Verify no python/, powershell/, bash/, nodejs/ | None of the other 4 directories exist |

---

## 5. UI/UX Testing

### TC-500: QuickPick Displays Correct Labels

| Field | Value |
|-------|-------|
| **ID** | TC-500 |
| **Priority** | Medium |
| **Type** | UI/UX |
| **Level** | SIT |
| **Requirement** | Story 4, FSD §3.1.5 |
| **Preconditions** | QuickPick displayed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify option 1 label | "Python Indexer (recommended — zero dependency)" |
| 2 | Verify option 1 description | "Python 3.7+ standard library only" |
| 3 | Verify option 2 label | "Java Indexer" |
| 4 | Verify option 3 label | "PowerShell Indexer" |
| 5 | Verify option 4 label | "Bash Indexer" |
| 6 | Verify option 5 label | "Node.js Indexer (most accurate)" |

---

### TC-501: QuickPick Option Order

| Field | Value |
|-------|-------|
| **ID** | TC-501 |
| **Priority** | Medium |
| **Type** | UI/UX |
| **Level** | UT |
| **Requirement** | Story 1 AC3 |
| **Preconditions** | INDEXER_OPTIONS array |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Read INDEXER_OPTIONS array order | [Python, Java, PowerShell, Bash, Node.js] |
| 2 | Verify picks array passed to showQuickPick | Same order preserved |

---

### TC-502: Placeholder Text

| Field | Value |
|-------|-------|
| **ID** | TC-502 |
| **Priority** | Medium |
| **Type** | UI/UX |
| **Level** | UT / SIT |
| **Requirement** | Story 1 AC4 |
| **Preconditions** | QuickPick displayed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify placeHolder option passed to showQuickPick | "Choose ONE indexer language for this workspace" |

---

### TC-503: QuickPick Shows Exactly 5 Options

| Field | Value |
|-------|-------|
| **ID** | TC-503 |
| **Priority** | High |
| **Type** | UI/UX |
| **Level** | UT |
| **Requirement** | Story 1 AC1 |
| **Preconditions** | pickIndexer() called |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify picks array length | Exactly 5 items |
| 2 | Verify each item has label and description | All 5 have non-empty label + description |

---

## 6. Non-Functional Testing

### TC-600: QuickPick Performance

| Field | Value |
|-------|-------|
| **ID** | TC-600 |
| **Priority** | Medium |
| **Type** | Non-Functional — Performance |
| **Level** | SIT |
| **Requirement** | FSD §8, NFR: < 100ms |
| **Preconditions** | Extension activated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger inject command | QuickPick appears instantly (< 100ms perceived) |
| 2 | Measure time from command to UI visible | No loading spinner, no delay |

**Acceptance Criteria:** QuickPick appears within 100ms (no async loading — static config)

---

## 7. Integration Testing

### TC-700: injectAll() Full Flow with Indexer

| Field | Value |
|-------|-------|
| **ID** | TC-700 |
| **Priority** | High |
| **Type** | Integration |
| **Level** | IT |
| **Requirement** | UC-1 + UC-2 + UC-3, FSD §5.1 |
| **Preconditions** | Extension resources bundled, clean workspace |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call injectAll() with mocked QuickPick returning Python | Function executes without error |
| 2 | Verify CORE_COMPONENTS copied | agents/, steering/, hooks/, templates/ present |
| 3 | Verify INDEXER_BASE copied | index-config.json, modules/, scripts/README.md present |
| 4 | Verify Python scripts copied | scripts/python/ present with all files |
| 5 | Verify return value | Array includes "indexer-python" |

---

## 8. Requirements Traceability Matrix (RTM)

| Requirement | Source | Test Cases | Status |
|-------------|--------|------------|--------|
| UC-1 (Select Indexer Language) | FSD 3.1.2 | TC-001 to TC-005, TC-100, TC-101, TC-200, TC-201 | ✅ Covered |
| UC-2 (Copy Base Config) | FSD 3.2.2 | TC-001, TC-301, TC-304 | ✅ Covered |
| UC-3 (Copy Language Scripts) | FSD 3.3.2 | TC-001 to TC-005, TC-305 | ✅ Covered |
| BR-1 (Single select) | FSD 3.1.3 | TC-300 | ✅ Covered |
| BR-2 (Base always copied) | FSD 3.1.3 | TC-301 | ✅ Covered |
| BR-3 (Cancel = no indexer) | FSD 3.1.3 | TC-200, TC-302 | ✅ Covered |
| BR-5 (Existing not deleted) | FSD 3.1.3 | TC-303 | ✅ Covered |
| BR-6 (Base before language) | FSD 3.2.3 | TC-304 | ✅ Covered |
| BR-9 (Only ONE language) | FSD 3.3.3 | TC-305 | ✅ Covered |
| BR-12 (Other langs not deleted) | FSD 3.3.3 | TC-303 | ✅ Covered |
| EF-1 (ESC cancel) | FSD 3.1.2 | TC-200 | ✅ Covered |
| EF-2 (Click outside) | FSD 3.1.2 | TC-201 | ✅ Covered |
| EF-3 (Source missing) | FSD 3.1.2 | TC-202 | ✅ Covered |
| Story 1 (5 options) | BRD 2.3 | TC-503, TC-500 | ✅ Covered |
| Story 2 (Single select) | BRD 2.3 | TC-300, TC-305 | ✅ Covered |
| Story 3 (Base config) | BRD 2.3 | TC-301 | ✅ Covered |
| Story 4 (Clear labels) | BRD 2.3 | TC-500, TC-501, TC-502 | ✅ Covered |
| NFR (Performance < 100ms) | FSD §8 | TC-600 | ✅ Covered |

**Coverage Summary:**

| Category | Total | Covered | Coverage % |
|----------|-------|---------|------------|
| Use Cases | 3 | 3 | 100% |
| Business Rules | 7 (BR-1 to BR-12 relevant) | 7 | 100% |
| Exception Flows | 3 | 3 | 100% |
| User Stories | 4 | 4 | 100% |
| **Overall** | **17** | **17** | **100%** |

