# Software Test Plan (STP)

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
| Related BRD | BRD-v1-KSA-4.docx |
| Related FSD | FSD-v1-KSA-4.docx |
| Related TDD | TDD-v1-KSA-4.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-10 | QA Agent | Initiate document — auto-generated from BRD, FSD, and TDD |

---

## 1. Introduction

### 1.1 Purpose

This test plan defines the testing strategy for the Indexer Selection feature (KSA-4) — a VS Code QuickPick UI that allows users to choose exactly one code indexer language during SDLC resource injection.

### 1.2 Test Objectives

- Verify QuickPick displays 5 indexer options with correct labels and descriptions
- Validate single-selection constraint (canPickMany: false)
- Ensure base config (INDEXER_BASE) is always copied when a language is selected
- Verify only the selected language's script directory is copied
- Confirm cancellation behavior (ESC/click outside) results in no indexer files copied
- Validate error handling for missing source directories

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-4.docx |
| FSD | FSD-v1-KSA-4.docx |
| TDD | TDD-v1-KSA-4.docx |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Automation | Tools |
|-------|-------|------------|-------|
| UT | Unit tests for pickIndexer(), injectComponent(), copyFiltered(), copyDirRecursive() | Automated | Jest + ts-jest |
| IT | Integration between injector.ts ↔ config.ts ↔ VS Code API (mocked) | Automated | Jest + vscode-test |
| E2E-UI | Full extension flow: command → QuickPick → file copy verification | Automated | @vscode/test-electron |
| SIT | Manual exploratory testing in VS Code | Manual | VS Code (live extension) |

### 2.2 Test Types

| Type | Description | Applicable |
|------|-------------|------------|
| Functional Testing | Verify QuickPick behavior, file copy, cancellation | Yes |
| Regression Testing | Ensure injectAll/injectSelective still work after changes | Yes |
| UI/UX Testing | Verify QuickPick labels, order, descriptions | Yes |
| Performance Testing | QuickPick appears < 100ms | Yes (lightweight) |
| Security Testing | No path traversal in file copy | Yes (lightweight) |

### 2.3 Test Approach

- **Unit tests** cover individual functions in isolation (mock VS Code API and fs)
- **Integration tests** verify the full injection flow with mocked VS Code QuickPick
- **E2E tests** run in a real VS Code instance using @vscode/test-electron
- **Manual SIT** for visual verification of QuickPick appearance and keyboard navigation

### 2.4 Entry/Exit Criteria

| Level | Entry Criteria | Exit Criteria |
|-------|---------------|--------------|
| UT | Code compiles, Jest configured | 100% pass, ≥90% branch coverage |
| IT | UT passed, vscode-test configured | 100% pass, all UC flows verified |
| E2E-UI | IT passed, extension packaged | All 5 language selections verified |
| SIT | E2E passed, extension installed in VS Code | All manual scenarios passed, 0 Critical defects |

---

## 3. Test Scope

### 3.1 Features In Scope

| # | Feature / Story | Priority | FSD Reference | Test Type |
|---|----------------|----------|---------------|-----------|
| 1 | QuickPick shows 5 indexer options | High | UC-1, Story 1 | Functional |
| 2 | Single-select enforcement | High | UC-1, BR-1 | Functional |
| 3 | Base config always copied | High | UC-2, BR-2 | Functional |
| 4 | Selected language scripts copied | High | UC-3, BR-9 | Functional |
| 5 | Cancellation handling (ESC/click outside) | High | EF-1, EF-2, BR-3 | Functional |
| 6 | Labels and descriptions correct | Medium | Story 4 | UI/UX |
| 7 | Error handling (source missing) | Medium | EF-3 | Functional |
| 8 | Existing files not deleted | Medium | BR-5, BR-12 | Functional |

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | Extension activation/command registration | Covered by KSA-2 |
| 2 | File copy mechanics (copyDirRecursive internals) | Covered by KSA-3 |
| 3 | Auto-detect runtime | Covered by KSA-5 |
| 4 | Individual indexer script correctness | Covered by KSA-7 to KSA-10 |

---

## 4. Test Environment

### 4.1 Environment Requirements

| Environment | Setup | Purpose |
|-------------|-------|---------|
| Dev (local) | VS Code + Extension Development Host | Unit + Integration tests |
| CI | GitHub Actions + @vscode/test-electron | Automated E2E |
| Manual | VS Code stable (latest) | SIT |

### 4.2 OS / Platform Requirements

| OS | Version | Required |
|----|---------|----------|
| Windows | 10+ | Yes |
| macOS | 12+ | Yes |
| Linux | Ubuntu 22.04+ | Yes |

### 4.3 Test Data Requirements

| Data Type | Description | Preparation |
|-----------|-------------|-------------|
| Extension resources | 5 indexer script directories + base config | Bundled in extension |
| Empty workspace | Clean workspace folder for injection | Created per test |
| Pre-existing workspace | Workspace with existing indexer files | Created per test |

---

## 5. Test Schedule

| Phase | Duration | Milestone |
|-------|----------|-----------|
| Test Planning | 1 day | STP + STC approved |
| UT Development | 1 day | Unit tests passing |
| IT Development | 1 day | Integration tests passing |
| E2E Development | 1 day | E2E tests passing |
| SIT Execution | 0.5 day | Manual sign-off |

---

## 6. Resources & Responsibilities

| Role | Responsibility |
|------|---------------|
| QA Agent | Test planning, test case design, SIT execution |
| Developer | Unit tests, integration tests, bug fixes |
| DevOps | CI pipeline for automated tests |

---

## 7. Risk & Mitigation

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 1 | VS Code API mock inaccuracy | Medium | Use @vscode/test-electron for E2E validation |
| 2 | Cross-platform file path differences | Medium | Test on all 3 OS in CI |
| 3 | QuickPick behavior changes in VS Code update | Low | Pin VS Code engine version in package.json |

---

## 8. Defect Management

### 8.1 Severity Levels

| Severity | Definition |
|----------|-----------|
| Critical | QuickPick doesn't appear, files copied to wrong location |
| Major | Wrong language copied, base config missing |
| Minor | Label typo, description inaccurate |
| Trivial | Option order slightly off |

### 8.2 Priority & SLA

| Priority | SLA |
|----------|-----|
| P1 | 4 hours |
| P2 | 1 business day |
| P3 | 3 business days |
| P4 | Next release |

---

## 9. Test Metrics

| Metric | Target |
|--------|--------|
| Test Execution Rate | 100% |
| Pass Rate | ≥ 95% |
| Critical Defect Count | 0 |
| Code Coverage (UT) | ≥ 90% |

---

## 10. Test Cases Summary

| Level | Count | Automated | Manual |
|-------|-------|-----------|--------|
| UT | 8 | 8 | 0 |
| IT | 5 | 5 | 0 |
| E2E-UI | 5 | 5 | 0 |
| SIT | 4 | 0 | 4 |
| **Total** | **22** | **18 (82%)** | **4 (18%)** |

