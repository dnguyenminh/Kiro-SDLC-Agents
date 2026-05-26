# Software Test Plan (STP)

## KSA-12: Release v1.0.1 — Checksum management, CI/CD fixes, sync tooling

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-12 |
| Title | Test Plan — Checksum management, CI/CD fixes, sync tooling |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-10 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-12.docx |
| Related FSD | FSD-v1-KSA-12.docx |
| Related TDD | TDD-v1-KSA-12.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-10 | QA Agent | Initial test plan |

---

## 1. Introduction

### 1.1 Purpose

This document defines the test strategy, scope, and approach for verifying KSA-12 features:
1. Checksum Management System (SHA-256 integrity tracking, safe updates)
2. CI/CD Pipeline (GitHub Actions workflows)
3. Sync Tooling (PowerShell cross-repo sync)

### 1.2 Test Objectives

- Verify file state detection logic (current/outdated/modified/missing)
- Verify safe update strategies (skip/backup/overwrite)
- Verify CI workflow triggers and build steps
- Verify gen-checksums script produces correct manifests
- Verify sync tooling copies only new/changed files
- Verify non-functional requirements (performance, reliability)

### 1.3 References

| Document | Version |
|----------|---------|
| BRD-v1-KSA-12 | 1.0 |
| FSD-v1-KSA-12 | 1.1 |
| TDD-v1-KSA-12 | 1.0 |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Automation | Tools |
|-------|-------|------------|-------|
| UT | Unit logic: hash computation, state detection, manifest I/O | Automated | Jest / Mocha |
| IT | Module integration: checksum + injector, gen-checksums + git | Automated | Jest + mock fs |
| E2E-API | Script execution: gen-checksums.js, sync-from-source.ps1 | Automated | Node.js + PowerShell + assertions |
| E2E-UI | VS Code extension commands (inject, update, status) | Automated | VS Code Extension Test API (@vscode/test-electron) |
| SIT | Manual exploratory: VS Code UX, notification flow, edge cases | Manual | VS Code + Browser |

### 2.2 Test Types

- **Functional**: All use cases (UC-01 through UC-09)
- **Non-Functional**: Performance (activation < 500ms, gen-checksums < 5s)
- **Security**: Manifest tamper-proofing, secret masking in CI
- **Regression**: Existing injection/status features still work

### 2.3 Entry/Exit Criteria

| Level | Entry | Exit |
|-------|-------|------|
| UT | Code complete for module | 100% pass, ≥80% branch coverage |
| IT | UT pass | All integration scenarios pass |
| E2E-API | IT pass | Scripts produce correct output |
| E2E-UI | E2E-API pass | Extension commands work end-to-end |
| SIT | E2E-UI pass | All critical paths verified manually |

---

## 3. Test Scope

### 3.1 In Scope

| Feature | Priority | Stories |
|---------|----------|---------|
| File state detection (current/outdated/modified/missing) | High | Story 1 |
| Legacy migration (.sdlc-version → per-file manifest) | High | Story 1 |
| Safe update (skip/backup/overwrite) | High | Story 3 |
| Upgrade notification UX | Medium | Story 2, 3 |
| Status command & version report | Medium | Story 2 |
| CI workflow triggers (paths filter) | High | Story 4 |
| gen-checksums.js (git-based hash generation) | High | Story 5 |
| Publish workflow (tag/manual dispatch) | Medium | Story 4 |
| Sync tooling (new/changed/skipped detection) | Medium | Story 6 |
| Dry-run mode | Low | Story 7 |

### 3.2 Out of Scope

- VS Code Marketplace publishing verification (requires real tokens)
- Multi-workspace support
- Extension UI redesign
- Rollback mechanism (handled by git)

---

## 4. Test Environment

### 4.1 Environment Requirements

| Component | Requirement |
|-----------|-------------|
| OS | Windows 10+, Ubuntu 22.04 (CI) |
| Node.js | 20+ |
| VS Code | 1.85+ |
| Git | 2.x |
| PowerShell | 5.1+ |

### 4.2 Test Data

- Sample workspace with injected files (various states)
- Git repository with committed test files
- Mock MCPOrchestration source directory
- Corrupted JSON manifest files (for error handling)

### 4.3 External Dependencies

| Dependency | Approach |
|------------|----------|
| Git CLI | Real git repo (test fixture) |
| VS Code API | @vscode/test-electron for E2E-UI |
| GitHub Actions | Act (local runner) or manual verification |
| MCPOrchestration repo | Mock directory structure |

---

## 5. Test Schedule

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| UT Development | 1 day | Unit tests for checksum.ts, injector.ts |
| IT Development | 1 day | Integration tests |
| E2E Script Tests | 0.5 day | gen-checksums, sync script tests |
| E2E-UI Tests | 1 day | Extension command tests |
| SIT Execution | 0.5 day | Manual test report |

---

## 6. Resources & Responsibilities

| Role | Responsibility |
|------|---------------|
| QA Agent | Test plan, test cases, execution |
| Dev (Duc Nguyen) | Bug fixes, unit test support |
| BA Agent | Acceptance criteria clarification |

---

## 7. Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Git not available in test env | High | Ensure git installed in CI |
| VS Code test API instability | Medium | Pin @vscode/test-electron version |
| File permission issues on CI | Medium | Use temp directories with full access |
| Large file count slows tests | Low | Limit test fixtures to 10 files |

---

## 8. Defect Management

| Severity | SLA | Example |
|----------|-----|---------|
| Critical | Fix within 4h | Extension crashes on activation |
| Major | Fix within 1 day | Wrong file state detection |
| Minor | Fix within 3 days | Status bar shows stale info |
| Trivial | Next sprint | Typo in notification message |

---

## 9. Test Metrics

| Metric | Target |
|--------|--------|
| Test case pass rate | ≥ 95% |
| Requirement coverage | 100% (all UC, BR covered) |
| Defect density | < 2 major defects per feature |
| Automation rate | ≥ 80% |

---

## 10. Test Cases Summary

| Level | Count | Automated | Manual |
|-------|-------|-----------|--------|
| UT | 12 | 12 | 0 |
| IT | 8 | 8 | 0 |
| E2E-API | 6 | 6 | 0 |
| E2E-UI | 5 | 5 | 0 |
| SIT | 4 | 0 | 4 |
| **Total** | **35** | **31 (89%)** | **4 (11%)** |

