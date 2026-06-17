# Software Test Plan (STP)

## Chatbox UI — KSA-252: Context Menu ("#" Trigger)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-252 |
| Title | Context Menu ("#" Trigger) — Test Plan |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-06-15 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-252.docx |
| Related FSD | FSD-v1-KSA-252.docx |
| Related TDD | TDD-v1-KSA-252.docx |
| Architecture Pattern | Plugin (VS Code Extension) |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-15 | QA Agent | Initial STP — 6 test levels, RTM, test strategy |

---

## 1. Test Scope

### 1.1 In Scope

- Context Menu trigger detection ("#" character in Input Area)
- Context Menu popup rendering and positioning
- All 9 context source categories (Files, Spec, Git Diff, Terminal, Problems, Folder, Current File, Steering, MCP)
- Fuzzy filtering algorithm and real-time filter updates
- Keyboard navigation (Arrow Up/Down, Enter, Escape)
- Mouse/click interactions
- Secondary picker panels (Files, Spec, Folder, Steering, MCP)
- Tag badge insertion, display, and removal
- postMessage communication between webview and extension host
- State machine transitions (CLOSED → OPEN → FILTERING → PICKER_OPEN → BADGE_INSERTED)
- Accessibility (ARIA roles, screen reader, keyboard)
- Performance (100ms popup, 50ms filter, 200ms file tree)
- Error handling (timeout, empty results, disconnection)

### 1.2 Out of Scope

- Slash Command Menu ("/" trigger) — separate ticket
- Chat Panel layout — dependency, not under test
- Input Area core functionality — dependency
- AI processing of attached context — backend
- VS Code marketplace publishing

---

## 2. Test Strategy

### 2.1 Test Levels Overview

| Level | Abbreviation | Focus | Automation | Tools |
|-------|-------------|-------|------------|-------|
| Property-Based Testing | PBT | Algorithmic invariants (fuzzy filter, state machine) | 100% Automated | fast-check + Vitest |
| Unit Testing | UT | Individual class/function correctness | 100% Automated | Vitest |
| Integration Testing | IT | Component interactions (Controller↔View, Bridge↔Host) | 100% Automated | Vitest + jsdom + mock postMessage |
| E2E-API Testing | E2E-API | postMessage protocol (webview↔extension host) | 100% Automated | Vitest + VS Code Extension test runner |
| E2E-UI Testing | E2E-UI | Full user interaction in webview | 90% Automated | Playwright (VS Code webview) |
| System Integration Testing | SIT | Visual/UX validation in real VS Code | 10% Automated, 90% Manual | Manual + screenshot comparison |

### 2.2 Test Pyramid

```
         /  SIT  \          ← 8 cases (mostly manual: visual, UX feel)
        / E2E-UI  \         ← 24 cases (Playwright Gherkin)
       /  E2E-API  \        ← 18 cases (postMessage protocol)
      / Integration \       ← 30 cases (component wiring)
     /     Unit      \      ← 45 cases (functions, classes)
    /      PBT        \     ← 12 cases (invariants)
```

**Total: 137 test cases**

### 2.3 Test Automation Strategy

| Level | % Automated | Reason |
|-------|------------|--------|
| PBT | 100% | Pure functions, no UI dependency |
| UT | 100% | Isolated, fast feedback |
| IT | 100% | jsdom + mock extension host |
| E2E-API | 100% | VS Code extension test framework |
| E2E-UI | 90% | Playwright, 10% manual for timing-sensitive |
| SIT | 10% | Visual regression tools for basic checks |

**Overall: ~92% automated, ~8% manual**

---

## 3. Test Environment

### 3.1 Environment Setup

| Component | Tool/Version | Purpose |
|-----------|-------------|---------|
| Runtime | Node.js 18+ | Execute tests |
| Test Framework | Vitest 1.x | UT, IT, PBT |
| PBT Library | fast-check 3.x | Property-based tests |
| DOM Simulation | jsdom | Webview DOM testing |
| E2E Framework | Playwright | Browser-based UI tests |
| VS Code Test | @vscode/test-electron | Extension integration tests |
| Coverage | Vitest built-in (v8) | Code coverage measurement |
| CI | GitHub Actions | Automated test execution |

### 3.2 Test Data Management

- Static test data in CSV files (see `documents/KSA-252/testdata/`)
- Mock file trees generated programmatically for PBT
- Mock postMessage responses defined in test fixtures
- No external database or API dependencies

---

## 4. Requirements Traceability Matrix (RTM)

| Requirement (BRD) | AC # | Test Level | Test Case IDs | Coverage |
|-------------------|------|-----------|---------------|----------|
| STORY-1: Trigger and Display | AC-1 | UT, IT, E2E-UI | UT-01, IT-01, E2E-UI-01 | ✅ |
| STORY-1: Trigger and Display | AC-2 | UT, E2E-UI | UT-02, E2E-UI-02 | ✅ |
| STORY-2: Navigation and Filtering | AC-3 | PBT, UT, IT | PBT-01, UT-03, IT-02 | ✅ |
| STORY-2: Navigation and Filtering | AC-4 | UT, IT, E2E-UI | UT-04, IT-03, E2E-UI-03 | ✅ |
| STORY-2: Navigation and Filtering | AC-5 | UT, IT, E2E-UI | UT-05, IT-04, E2E-UI-04 | ✅ |
| STORY-3: Files Selection | AC-8 | IT, E2E-API, E2E-UI | IT-05, E2E-API-01, E2E-UI-05 | ✅ |
| STORY-3: Files Selection | AC-9 | PBT, UT, E2E-UI | PBT-02, UT-06, E2E-UI-06 | ✅ |
| STORY-3: Files Selection | AC-10 | IT, E2E-UI | IT-06, E2E-UI-07 | ✅ |
| STORY-3: Files Selection | AC-11 | IT, E2E-UI | IT-07, E2E-UI-08 | ✅ |
| STORY-4: Spec Selection | AC-12 | IT, E2E-API | IT-08, E2E-API-02 | ✅ |
| STORY-4: Spec Selection | AC-13 | IT, E2E-UI | IT-09, E2E-UI-09 | ✅ |
| STORY-4: Spec Selection | AC-14 | E2E-API | E2E-API-03 | ✅ |
| STORY-5: Git Diff | AC-15 | IT, E2E-UI | IT-10, E2E-UI-10 | ✅ |
| STORY-5: Git Diff | AC-16 | E2E-API | E2E-API-04 | ✅ |
| STORY-6: Terminal | AC-17 | IT, E2E-UI | IT-11, E2E-UI-11 | ✅ |
| STORY-6: Terminal | AC-18 | E2E-API | E2E-API-05 | ✅ |
| STORY-7: Problems | AC-19 | IT, E2E-UI | IT-12, E2E-UI-12 | ✅ |
| STORY-7: Problems | AC-20 | E2E-API | E2E-API-06 | ✅ |
| STORY-8: Folder Selection | AC-21 | IT, E2E-API | IT-13, E2E-API-07 | ✅ |
| STORY-8: Folder Selection | AC-22 | IT, E2E-UI | IT-14, E2E-UI-13 | ✅ |
| STORY-8: Folder Selection | AC-23 | E2E-API | E2E-API-08 | ✅ |
| STORY-9: Current File | AC-24 | IT, E2E-UI | IT-15, E2E-UI-14 | ✅ |
| STORY-9: Current File | AC-25 | E2E-API | E2E-API-09 | ✅ |
| STORY-10: Steering | AC-26 | IT, E2E-API | IT-16, E2E-API-10 | ✅ |
| STORY-10: Steering | AC-27 | UT | UT-07 | ✅ |
| STORY-10: Steering | AC-28 | IT, E2E-UI | IT-17, E2E-UI-15 | ✅ |
| STORY-10: Steering | AC-29 | E2E-API | E2E-API-11 | ✅ |
| STORY-11: MCP | AC-30 | UT, E2E-UI | UT-08, E2E-UI-16 | ✅ |
| STORY-11: MCP | AC-31 | IT, E2E-API | IT-18, E2E-API-12 | ✅ |
| STORY-11: MCP | AC-32 | IT, E2E-UI | IT-19, E2E-UI-17 | ✅ |
| STORY-11: MCP | AC-33 | E2E-API | E2E-API-13 | ✅ |
| STORY-12: Badge Management | AC-6 | UT, IT, E2E-UI | UT-09, IT-20, E2E-UI-18 | ✅ |
| STORY-12: Badge Management | AC-7 | UT, IT, E2E-UI | UT-10, IT-21, E2E-UI-19 | ✅ |
| NFR: Performance (100ms popup) | NFR-01 | IT, E2E-UI | IT-22, E2E-UI-20 | ✅ |
| NFR: Fuzzy filter (50ms) | NFR-02 | PBT, UT | PBT-03, UT-11 | ✅ |
| NFR: Accessibility | NFR-05-08 | UT, IT, E2E-UI, SIT | UT-12, IT-23, E2E-UI-21, SIT-01 | ✅ |
| NFR: Touch targets (44x44) | NFR-11 | SIT | SIT-02 | ✅ |
| NFR: Security (workspace scope) | NFR-10 | UT, IT | UT-13, IT-24 | ✅ |

**RTM Coverage: 33/33 Acceptance Criteria + 5 NFRs = 100%**

---

## 5. Test Level Details

### 5.1 Property-Based Testing (PBT) — 12 Cases

| ID | Focus Area | Properties to Verify |
|----|-----------|---------------------|
| PBT-01 | Fuzzy Filter: Subset property | filter(items, q1+q2) ⊆ filter(items, q1) |
| PBT-02 | Fuzzy Filter: Empty query | filter(items, "") === items (all returned) |
| PBT-03 | Fuzzy Filter: Performance | filter(N items, query) < 50ms for N ≤ 1000 |
| PBT-04 | Fuzzy Filter: Idempotency | filter(filter(items, q), q) === filter(items, q) |
| PBT-05 | Fuzzy Filter: Prefix bonus | Items starting with query score higher |
| PBT-06 | State Machine: No stuck states | From any state, some transition leads to CLOSED |
| PBT-07 | State Machine: Transition validity | Only defined transitions are accepted |
| PBT-08 | State Machine: CLOSED reachable | DISMISS from any state → CLOSED |
| PBT-09 | Badge: Unique IDs | Insert N badges → N unique IDs in collection |
| PBT-10 | Badge: Insert/Remove invariant | insert(b) then remove(b.id) → original state |
| PBT-11 | Badge: Max limit | Insert >20 badges → capped at 20 |
| PBT-12 | Fuzzy Filter: Case insensitivity | filter("ABC", "abc") === filter("ABC", "ABC") |

### 5.2 Unit Testing (UT) — 45 Cases

| Module | # Cases | Test Focus |
|--------|---------|-----------|
| FuzzyFilter.ts | 10 | Match/no-match, scoring, empty input, special chars, unicode, case |
| ContextMenuItems.ts | 3 | 9 items defined, correct types, icons present |
| BadgeManager.ts | 10 | insert, remove, getAll, clear, resolveAll, max limit, duplicate prevention |
| BadgeRenderer.ts | 6 | DOM creation, HTML escape, icon mapping, (X) button, badge styling |
| MessageBridge.ts | 8 | Request ID generation, timeout handling, response matching, cleanup |
| ContextMenuController.ts | 8 | State transitions, invalid transition rejection, event dispatch |

### 5.3 Integration Testing (IT) — 30 Cases

| Integration Point | # Cases | Test Focus |
|-------------------|---------|-----------|
| Controller ↔ View | 6 | Menu open/close renders DOM, filter updates DOM, highlight moves |
| Controller ↔ BadgeManager | 5 | Selection inserts badge, badge removal updates state, multi-badge |
| Controller ↔ MessageBridge | 6 | Picker selection triggers postMessage, response updates picker |
| InputArea ↔ Controller | 4 | "#" detection triggers controller, badge renders in input, backspace removes |
| View ↔ FuzzyFilter | 3 | Filter text updates visible items, empty filter shows all |
| PickerPanel ↔ MessageBridge | 4 | File tree request/response, timeout fallback, retry |
| Performance | 2 | Menu render < 100ms, filter < 50ms with 9 items |

### 5.4 E2E-API Testing (E2E-API) — 18 Cases

| Protocol Message | # Cases | Test Focus |
|-----------------|---------|-----------|
| getWorkspaceFileTree | 3 | Success response, timeout (3s), large tree (10K+) |
| getSpecList | 2 | Success with specs, empty (no .kiro/specs/) |
| getWorkspaceFolderTree | 2 | Success, deep nesting (>10 levels) |
| getSteeringFiles | 2 | Success with files, empty directory |
| getMcpResources | 2 | Success with resources, no MCP configured |
| resolveGitDiff | 2 | Has changes, no git repo |
| resolveTerminalOutput | 2 | Active terminal (100 lines), no active terminal |
| resolveDiagnostics | 2 | Has errors/warnings, clean workspace |
| resolveFileContent | 1 | Multiple files resolved |

### 5.5 E2E-UI Testing (E2E-UI) — 24 Cases

| ID | Scenario | Gherkin Summary |
|----|---------|-----------------|
| E2E-UI-01 | Menu trigger | Given input focused, When type "#", Then menu visible above input |
| E2E-UI-02 | 9 categories displayed | Given menu open, Then 9 items with icons visible |
| E2E-UI-03 | Keyboard navigation | Given menu open, When ArrowDown x3 + Enter, Then 4th item selected |
| E2E-UI-04 | Dismiss on Escape | Given menu open, When press Escape, Then menu hidden, no badge |
| E2E-UI-05 | Files picker opens | Given menu open, When select "Files", Then file tree panel appears |
| E2E-UI-06 | Files fuzzy search | Given file picker open, When type "main", Then filtered results shown |
| E2E-UI-07 | File selection inserts badge | Given file picker, When click "src/app.ts", Then badge "#File: src/app.ts" in input |
| E2E-UI-08 | Multi-file Ctrl+click | Given file picker, When Ctrl+click 3 files, Then 3 badges inserted |
| E2E-UI-09 | Spec selection | Given Spec picker, When select spec, Then badge "#Spec: {name}" inserted |
| E2E-UI-10 | Git Diff instant | Given menu open, When select "Git Diff", Then badge "#Git Diff" + menu closes |
| E2E-UI-11 | Terminal instant | Given menu, When select "Terminal", Then badge "#Terminal" + close |
| E2E-UI-12 | Problems instant | Given menu, When select "Problems", Then badge "#Problems" + close |
| E2E-UI-13 | Folder selection | Given folder picker, When select folder, Then badge "#Folder: {path}" |
| E2E-UI-14 | Current File instant | Given menu, When select "Current File", Then badge "#Current File: {name}" |
| E2E-UI-15 | Steering selection | Given steering picker, When select file, Then badge "#Steering: {name}" |
| E2E-UI-16 | MCP sublabel visible | Given menu open, Then MCP item shows "Model Context Protocol →" |
| E2E-UI-17 | MCP resource selection | Given MCP picker, When select resource, Then badge "#MCP: {name}" |
| E2E-UI-18 | Badge displayed as chip | Given badge inserted, Then non-editable chip visible with icon + label + (X) |
| E2E-UI-19 | Badge remove via Backspace | Given cursor next to badge, When Backspace, Then badge removed |
| E2E-UI-20 | Performance: 100ms popup | Given input focused, When type "#", Then menu visible within 150ms (tolerance) |
| E2E-UI-21 | Keyboard-only complete flow | Given no mouse, Tab to input → # → ArrowDown → Enter → badge inserted |
| E2E-UI-22 | Click outside dismisses | Given menu open, When click outside, Then menu closes |
| E2E-UI-23 | Filter narrows items | Given menu open, When type "fi", Then only "Files" and "Current File" visible |
| E2E-UI-24 | Multiple badges coexist | Given 2 badges in input, When submit, Then message includes both contexts |

### 5.6 System Integration Testing (SIT) — 8 Cases

| ID | Test Case | Method | Focus |
|----|-----------|--------|-------|
| SIT-01 | Screen reader navigation | Manual (NVDA/VoiceOver) | ARIA roles correctly read |
| SIT-02 | Touch target measurement | Manual + screenshot tool | All elements >= 44x44px |
| SIT-03 | Dark theme visual match | Manual comparison | Colors match spec (#2d2d3d, #3d3d5c) |
| SIT-04 | Animation smoothness | Manual observation | fadeIn 100ms feels natural |
| SIT-05 | High contrast mode | Manual | System colors applied, text readable |
| SIT-06 | Real VS Code integration | Manual | Menu works inside Extension Development Host |
| SIT-07 | DPI scaling (150%, 200%) | Manual | No layout breaks at high DPI |
| SIT-08 | Performance perception | Manual | No visible lag or jank during normal use |

---

## 6. Entry and Exit Criteria

### 6.1 Entry Criteria

| Condition | Required For |
|-----------|-------------|
| BRD.md approved | All levels |
| FSD.md approved | All levels |
| TDD.md approved | All levels |
| Code implemented per TDD | UT, IT, E2E-API, E2E-UI, SIT |
| Test environment operational | All levels |
| Test data available | All levels |

### 6.2 Exit Criteria

| Criteria | Target |
|---------|--------|
| PBT pass rate | 100% (1000+ iterations each) |
| UT pass rate | 100% |
| IT pass rate | 100% |
| E2E-API pass rate | 100% |
| E2E-UI pass rate | >= 95% (timing-sensitive tests may flake) |
| SIT pass rate | >= 90% (minor visual issues acceptable) |
| Code coverage (UT+IT) | >= 85% line coverage |
| Critical/High defects | 0 open |
| Medium defects | <= 3 open (deferred to next sprint) |

---

## 7. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Flaky timing tests (100ms assertion) | Medium | High | Use tolerance ranges (80-150ms), retry logic |
| VS Code API changes breaking E2E | High | Low | Pin VS Code version in CI, version matrix |
| Playwright webview access limitations | Medium | Medium | Fall back to VS Code test extension framework |
| Large file tree performance regression | Medium | Medium | Benchmark suite with 10K file workspace |
| postMessage race conditions | High | Medium | Deterministic mock responses in IT |

---

## 8. Test Schedule

| Phase | Duration | Activities |
|-------|----------|-----------|
| Sprint 1 | Week 1 | PBT + UT (FuzzyFilter, BadgeManager, State Machine) |
| Sprint 2 | Week 1-2 | IT (Controller↔View, Bridge↔Host) |
| Sprint 3 | Week 2 | E2E-API (postMessage protocol full cycle) |
| Sprint 4 | Week 2-3 | E2E-UI (Playwright scenarios) |
| Sprint 5 | Week 3 | SIT (manual visual + accessibility) |
| Regression | Ongoing | Automated suite in CI on every PR |

---

## 9. Defect Management

| Severity | Response Time | Resolution Time | Example |
|----------|-------------|----------------|---------|
| Critical | 1 hour | 4 hours | Menu doesn't open, crash on "#" |
| High | 4 hours | 1 day | Badge not inserted, picker empty when shouldn't be |
| Medium | 1 day | 3 days | Minor visual misalignment, filter lag |
| Low | 3 days | Next sprint | Cosmetic issues, minor a11y warnings |

---

## 10. Test Deliverables

| Deliverable | Format | Location |
|------------|--------|----------|
| Test Plan (STP) | Markdown → DOCX | documents/KSA-252/STP.md |
| Test Cases (STC) | Markdown → XLSX | documents/KSA-252/STC.md |
| Test Data | CSV | documents/KSA-252/testdata/*.csv |
| Test Coverage Report | HTML | coverage/ (generated) |
| Defect Report | Jira | Project KSA |
| Test Execution Report | Markdown → DOCX | documents/KSA-252/TEST-REPORT-KSA-252.md |

---

## Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage Overview | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |
