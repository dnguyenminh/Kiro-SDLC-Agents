# Software Test Plan (STP)

## Code Indexer Python — KSA-7: Code Indexer — Python version

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-7 |
| Title | Code Indexer — Python version |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-10 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-7.docx |
| Related FSD | FSD-v1-KSA-7.docx |
| Related TDD | TDD-v1-KSA-7.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-10 | QA Agent | Initiate document from BRD, FSD, TDD KSA-7 |

---

## 1. Introduction

### 1.1 Purpose

This test plan defines the testing strategy for the Code Indexer Python tool — a standalone CLI script that analyzes source code projects across 7 programming languages and generates structured metadata for AI agent consumption. The tool has zero external dependencies (Python stdlib only).

### 1.2 Test Objectives

- Verify all 7 use cases (UC-1 through UC-7) from FSD are implemented correctly
- Validate all 38 business rules (BR-1 through BR-38) are enforced
- Ensure 7 language parsers extract signatures accurately (≥90% coverage)
- Verify non-functional requirements: performance (<30s for 1000 files), cross-platform, error resilience
- Confirm zero external dependencies constraint

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-7.docx |
| FSD | FSD-v1-KSA-7.docx |
| TDD | TDD-v1-KSA-7.docx |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Automation | Tools |
|-------|-------|------------|-------|
| UT | Unit tests per module (config, detector, scanner, parsers, generator) | Automated | unittest (Python stdlib) |
| IT | Integration — full pipeline on fixture projects | Automated | unittest + subprocess |
| SIT | Manual exploratory — edge cases, real-world projects | Manual | CLI + filesystem |

### 2.2 Test Types

| Type | Description | Applicable |
|------|-------------|------------|
| Functional Testing | Verify features per FSD use cases | Yes |
| Regression Testing | Ensure parsers don't break on updates | Yes |
| Performance Testing | Verify indexing speed targets | Yes |
| Security Testing | Verify no code execution, no network access | Yes |
| Compatibility Testing | Cross-platform (Windows/macOS/Linux) | Yes |

### 2.3 Test Approach

- **Risk-based prioritization**: Parser accuracy and error handling are highest risk
- **Fixture-based testing**: Sample projects in `tests/fixtures/` for reproducible tests
- **Self-indexing test**: The indexer indexes itself as an integration test
- **Automated first**: All UT and IT are automated; SIT only for exploratory/real-world validation

### 2.4 Entry/Exit Criteria

| Level | Entry Criteria | Exit Criteria |
|-------|---------------|--------------|
| UT | Code compiles, module implemented | 100% UT pass, 0 Critical defects |
| IT | All modules integrated, fixtures ready | Full pipeline runs on all fixture types |
| SIT | IT passed, tool deployed to test machine | All SIT scenarios executed, ≤2 Minor defects |

### 2.5 Test Cases Summary

| Level | Count | Automated | Manual |
|-------|-------|-----------|--------|
| UT | 25 | 25 | 0 |
| IT | 8 | 8 | 0 |
| SIT | 5 | 0 | 5 |
| **Total** | **38** | **33 (87%)** | **5 (13%)** |

---

## 3. Test Scope

### 3.1 Features In Scope

| # | Feature / Story | Priority | FSD Reference | Test Type |
|---|----------------|----------|---------------|-----------|
| 1 | CLI Entry Point & Pipeline | High | UC-1 | UT + IT |
| 2 | Configuration Loading | High | UC-2 | UT |
| 3 | Project Type Detection | High | UC-3 | UT + IT |
| 4 | Module Discovery | High | UC-4 | UT + IT |
| 5 | File Scanning & Filtering | High | UC-5 | UT |
| 6 | Source File Parsing (7 languages) | High | UC-6 | UT |
| 7 | Output Generation (4 file types) | High | UC-7 | UT + IT |
| 8 | Error Handling & Resilience | High | FSD §9 | UT + IT |
| 9 | Performance (speed targets) | Medium | FSD §8 | IT |
| 10 | Cross-platform compatibility | Medium | BRD §6 | SIT |

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | IDE/editor integration | BRD §1.2 — out of scope |
| 2 | Real-time file watching | BRD §1.2 — out of scope |
| 3 | AI/LLM-based analysis | BRD §1.2 — out of scope |
| 4 | Database storage | BRD §1.2 — file-based only |

---

## 4. Test Environment

### 4.1 Environment Requirements

| Environment | Setup | Purpose |
|-------------|-------|---------|
| Dev Local | Python 3.10+, project source | Unit + Integration testing |
| CI/CD | GitHub Actions (Python 3.10, 3.11, 3.12) | Automated regression |

### 4.2 Platform Requirements

| OS | Python Version | Required |
|----|---------------|----------|
| Windows 10/11 | 3.10+ | Yes |
| macOS 12+ | 3.10+ | Yes |
| Ubuntu 22.04+ | 3.10+ | Yes |

### 4.3 Test Data Requirements

| Data Type | Description | Source |
|-----------|-------------|--------|
| Gradle project fixture | Sample Kotlin/Gradle project | tests/fixtures/gradle-project/ |
| npm project fixture | Sample Node.js project | tests/fixtures/npm-project/ |
| Python project fixture | Sample Python project | tests/fixtures/python-project/ |
| Mixed/monorepo fixture | Multi-type project | tests/fixtures/mixed-project/ |
| Empty directory | Edge case | tests/fixtures/empty-project/ |
| Binary files | Edge case | tests/fixtures/binary-files/ |

---

## 5. Test Schedule

| Phase | Duration | Milestone |
|-------|----------|-----------|
| Test Planning | 1 day | STP + STC approved |
| Test Fixture Preparation | 1 day | All fixtures ready |
| UT Execution | 2 days | All unit tests pass |
| IT Execution | 1 day | Full pipeline verified |
| SIT Execution | 1 day | Manual scenarios complete |
| Defect Fix & Retest | 1 day | All Critical/Major fixed |

---

## 6. Resources & Responsibilities

| Role | Responsibility |
|------|---------------|
| QA Engineer | Test planning, case design, execution, defect reporting |
| Developer | Unit test implementation, bug fixing |
| BA | Acceptance criteria clarification |

---

## 7. Risk & Mitigation

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | Regex parsers miss edge cases | High | High | Comprehensive fixtures with real-world code samples |
| 2 | Cross-platform path handling issues | Medium | Medium | Test on all 3 OS in CI |
| 3 | Performance degradation on large projects | Medium | Low | Benchmark test with 1000+ file fixture |
| 4 | Encoding issues with non-UTF-8 files | Low | Medium | Include non-UTF-8 files in fixtures |

---

## 8. Defect Management

### 8.1 Severity Levels

| Severity | Definition |
|----------|-----------|
| Critical | Indexer crashes, produces corrupt output |
| Major | Parser misses entire category of declarations, wrong project type |
| Minor | Missing visibility modifier, incorrect line number |
| Trivial | Formatting issue in output markdown |

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
| Defect Density | ≤ 0.1 |
| Critical Defect Count | 0 |
| Parser Accuracy (per language) | ≥ 90% |

