# Software Test Plan (STP)

## KSA-5: Auto-detect Runtime & Run Indexer

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-5 |
| Title | Auto-detect Runtime & Run Indexer — Test Plan |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-07-10 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-5.docx |
| Related FSD | FSD-v1-KSA-5.docx |
| Related TDD | TDD-v1-KSA-5.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-10 | QA Agent | Initial test plan |

---

## 1. Introduction

### 1.1 Purpose

This document defines the test strategy, scope, and approach for verifying the Auto-detect Runtime & Run Indexer feature (KSA-5). The feature auto-detects available runtimes (Python, Java, Node.js, PowerShell, Bash), builds platform-specific commands, executes indexer scripts, and streams output to a VS Code Output Channel.

### 1.2 Test Objectives

- Verify runtime detection follows priority order (BR-01)
- Verify command building is platform-correct for all 5 runtimes
- Verify indexer execution with output streaming and timeout handling
- Verify `preferredIndexer` setting overrides auto-detection
- Verify error handling and user notifications

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | documents/KSA-5/BRD.md |
| FSD | documents/KSA-5/FSD.md |
| TDD | documents/KSA-5/TDD.md |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Automation | Tools |
|-------|-------|------------|-------|
| UT | Unit tests for pure functions (buildCommand, isWindows, commandExists) | Automated | Jest + VS Code mock |
| IT | Integration tests with real child_process calls | Automated | Jest + real shell |
| SIT | Manual end-to-end in VS Code Extension Development Host | Manual | VS Code F5 |

### 2.2 Test Approach

- **UT**: Mock `child_process.exec`, `vscode` APIs. Test each function in isolation.
- **IT**: Use real shell commands (e.g., `node --version`) to verify detection logic works on actual system.
- **SIT**: Launch Extension Development Host, trigger command, observe Output Channel and toasts.

### 2.3 Entry/Exit Criteria

| Level | Entry Criteria | Exit Criteria |
|-------|---------------|---------------|
| UT | Code compiles, Jest configured | All UT pass, >80% branch coverage |
| IT | UT pass, test machine has ≥1 runtime | All IT pass on CI |
| SIT | IT pass, extension packaged | All SIT scenarios pass manually |

### 2.4 Test Cases Summary

| Level | Count | Automated | Manual |
|-------|-------|-----------|--------|
| UT | 14 | 14 | 0 |
| IT | 6 | 6 | 0 |
| SIT | 5 | 0 | 5 |
| **Total** | **25** | **20 (80%)** | **5 (20%)** |

---

## 3. Test Scope

### 3.1 In Scope

| Feature | Priority | Source |
|---------|----------|--------|
| Runtime detection (5 runtimes, priority order) | High | UC-01, BR-01–BR-05 |
| Command building (5 templates, platform-aware) | High | UC-02, BR-06–BR-11 |
| Indexer execution with Output Channel | High | UC-03, BR-12–BR-18 |
| preferredIndexer setting | High | UC-04, BR-19–BR-22 |
| No-runtime warning | Medium | Story 5 |
| Timeout handling (120s) | Medium | BR-15 |
| Platform fallback (PowerShell/Bash) | Medium | BR-05 |

### 3.2 Out of Scope

- Extension activation/command registration (KSA-2)
- File injection mechanics (KSA-3)
- QuickPick UI (KSA-4)
- Individual indexer script correctness (KSA-7 to KSA-10)
- Performance benchmarking of indexer scripts

---

## 4. Test Environment

| Attribute | Requirement |
|-----------|-------------|
| OS | Windows 10+, macOS 12+, Ubuntu 22.04+ |
| VS Code | 1.85+ |
| Node.js | 20+ (extension host) |
| Runtimes | Python 3.7+, Java 17+, Node.js 18+ (for detection tests) |
| Test Framework | Jest 29+ with `@vscode/test-electron` |

### 4.1 Test Data

- Mock workspace with `.analysis/code-intelligence/scripts/{language}/` directories
- Mock scripts that exit 0 (success) or exit 1 (failure)
- Mock script that sleeps >120s (timeout test)

---

## 5. Test Schedule

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| UT Development | 1 day | Unit test suite |
| IT Development | 0.5 day | Integration test suite |
| SIT Execution | 0.5 day | SIT report with evidence |

---

## 6. Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| CI machine missing runtimes | IT tests fail | Use Docker with all runtimes installed |
| Platform-specific bugs | Tests pass on one OS only | Run CI on Windows + Linux |
| Flaky timeout tests | False failures | Use generous margins (6s for 5s timeout) |

---

## 7. Defect Management

| Severity | SLA | Example |
|----------|-----|---------|
| Critical | Fix within 4h | Indexer crashes VS Code |
| Major | Fix within 1 day | Wrong runtime detected, command fails |
| Minor | Fix within 3 days | Output Channel formatting issue |
| Trivial | Next sprint | Typo in toast message |

---

## 8. Test Metrics

| Metric | Target |
|--------|--------|
| Test pass rate | ≥ 95% |
| Branch coverage (UT) | ≥ 80% |
| Requirement coverage (RTM) | 100% |
| Defect escape rate | 0 critical/major |

