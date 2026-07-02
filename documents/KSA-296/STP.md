# Software Test Plan (STP)

## FEC Code Intelligence — KSA-296: KB Sensitive Data Masking - Read-time PII/Business Logic Redaction

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-296 |
| Title | KB Sensitive Data Masking - Test Plan |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-01-28 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-296.docx |
| Related FSD | FSD-v1-KSA-296.docx |
| Related TDD | TDD-v1-KSA-296.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-28 | QA Agent | Initial test plan from BRD, FSD, and TDD |

---

## 1. Introduction

### 1.1 Purpose

This test plan defines the testing strategy, scope, resources, and schedule for the KB Sensitive Data Masking feature (KSA-296). The feature implements a read-time middleware that detects and redacts PII, credentials, and business-sensitive content before returning KB responses based on requester roles.

### 1.2 Test Objectives

- Verify all PII detection patterns (email, phone, IP, credit card, SSN) work correctly
- Validate credential masking is always-on regardless of user role
- Confirm role-based access control for sensitivity levels (PUBLIC/INTERNAL/CONFIDENTIAL/RESTRICTED)
- Verify auto-classification accuracy > 80%
- Validate admin configuration UI (CRUD for rules, allowlists, classifications)
- Confirm audit trail logs all masking events
- Verify performance overhead < 5ms (p95) for entries < 10KB
- Validate allowlist correctly bypasses masking
- Verify fail-open (PII) and fail-closed (credentials) error handling

### 1.3 References

| Document | Description |
|----------|-------------|
| BRD-v1-KSA-296.docx | Business Requirements |
| FSD-v1-KSA-296.docx | Functional Specification |
| TDD-v1-KSA-296.docx | Technical Design |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Automation | Tools |
|-------|-------|------------|-------|
| PBT | Random input generation for regex detectors | Automated | fast-check (vitest) |
| UT | Unit tests for detectors, maskers, services | Automated | vitest |
| IT | Integration tests with real SQLite DB | Automated | vitest + better-sqlite3 |
| E2E-API | REST endpoint E2E against running server | Automated | vitest + fetch/supertest |
| E2E-UI | Browser UI E2E for admin config page | Automated | Playwright |
| SIT | Manual exploratory / visual verification | Manual | Browser |

### 2.2 Test Types

| Type | Description | Levels |
|------|-------------|--------|
| Functional | Verify masking rules, detection patterns, role-based access | PBT, UT, IT, E2E-API |
| Security | Credential never exposed, role bypass attempts | IT, E2E-API |
| Performance | Masking overhead < 5ms, concurrent reads | IT (benchmark) |
| Regression | Existing KB read operations unaffected | IT, E2E-API |
| Usability | Admin UI configuration workflow | E2E-UI, SIT |

### 2.3 Entry/Exit Criteria

| Level | Entry Criteria | Exit Criteria |
|-------|---------------|---------------|
| PBT | Detector classes implemented | All properties hold for 1000 random inputs |
| UT | Module code complete | >= 90% branch coverage on detectors/maskers |
| IT | DB migrations applied, middleware integrated | All integration scenarios pass |
| E2E-API | Server running with masking enabled | All API test cases pass |
| E2E-UI | Admin UI page deployed | All UI flows verified |
| SIT | E2E-UI pass, staging ready | No Critical/Major defects open |

### 2.4 Test Cases Summary

| Level | Count | Automated | Manual |
|-------|-------|-----------|--------|
| PBT | 6 | 6 | 0 |
| UT | 24 | 24 | 0 |
| IT | 14 | 14 | 0 |
| E2E-API | 12 | 12 | 0 |
| E2E-UI | 8 | 8 | 0 |
| SIT | 4 | 0 | 4 |
| **Total** | **68** | **64 (94%)** | **4 (6%)** |

---

## 3. Test Scope

### 3.1 In Scope

| # | Feature | Priority | Stories |
|---|---------|----------|---------|
| 1 | PII Detection and Masking (email, phone, IP, CC, SSN) | High | Story 1 |
| 2 | Credential Masking (always-on) | High | Story 2 |
| 3 | Business Logic Sensitivity Classification | High | Story 3 |
| 4 | Auto-Classification with Admin Confirmation | Medium | Story 4 |
| 5 | Admin Configuration UI | High | Story 5 |
| 6 | Audit Trail Logging | High | Story 6 |
| 7 | Allowlist Management | Medium | Story 7 |
| 8 | Performance (< 5ms overhead) | High | Story 8 |
| 9 | Role-Based Masking Rules | High | BR-01 to BR-04 |
| 10 | Fail-open/Fail-closed Error Handling | High | BR-11 |
| 11 | Code Block Preservation | Medium | BR-07, BR-08 |

### 3.2 Out of Scope

- Write-time encryption testing
- Database-level encryption
- External DLP service integration
- Non-KB module masking (analytics, code-intelligence)
- Multi-tenant isolation (handled by existing scope system)
- Load testing beyond 100 concurrent users

---

## 4. Test Environment

### 4.1 Environment Requirements

| Component | Specification |
|-----------|---------------|
| Runtime | Node.js 18+ |
| Database | SQLite (same as production) |
| Server | Backend dev server (localhost:4572) |
| Browser | Chrome latest (E2E-UI) |
| OS | Windows 11 / Linux |

### 4.2 Test Data Requirements

| Data Type | Examples | Purpose |
|-----------|----------|---------|
| PII samples | Emails, phones, IPs, credit cards, SSNs | Detection accuracy testing |
| Credential samples | API keys (sk-*, ghp_*), JWT tokens, connection strings | Credential masking |
| Clean content | Plain text, code blocks, markdown | False positive testing |
| Mixed content | PII embedded in code, credentials in config blocks | Code block preservation |
| Large content | 50KB+ entries | Performance boundary testing |

### 4.3 External Dependencies

| Dependency | Strategy |
|-----------|----------|
| Memory Module (MemoryEngine) | Real integration (same process) |
| RBAC System | Real integration (role context) |
| SQLite | Real database (test instance) |
| Admin Portal | Real server (dev mode) |

---

## 5. Test Schedule

| Phase | Duration | Activities |
|-------|----------|------------|
| Test Preparation | 1 day | Set up test data, configure environments |
| PBT + UT Execution | 1 day | Run property-based and unit tests |
| IT Execution | 1 day | Integration tests with full pipeline |
| E2E-API Execution | 0.5 day | API endpoint verification |
| E2E-UI Execution | 0.5 day | Admin UI workflow tests |
| SIT | 0.5 day | Manual exploratory testing |
| Defect Fixing | 1 day | Fix found issues, re-test |
| **Total** | **5.5 days** | |

---

## 6. Resources and Responsibilities

| Role | Responsibility |
|------|---------------|
| QA Agent | Create test plan, test cases, execute automated tests |
| DEV Agent | Fix defects, provide test support |
| BA Agent | Clarify requirements, UAT support |
| SM Agent | Coordinate, track progress |

---

## 7. Risk and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Regex patterns too aggressive (false positives) | High | Medium | PBT with random inputs, diverse test data |
| Performance degradation under load | High | Low | Dedicated performance test suite |
| Admin UI flaky in E2E tests | Medium | Medium | Retry mechanism, stable selectors |
| Test data insufficient for edge cases | Medium | Low | Comprehensive CSV test data files |
| SQLite locking under concurrent tests | Medium | Low | Separate test DB instances |

---

## 8. Defect Management

### 8.1 Severity Levels

| Severity | Description | Example |
|----------|-------------|---------|
| Critical | Credentials exposed / security breach | Credential not masked for any user |
| Major | PII visible to unauthorized user | Email shown to external user |
| Minor | Masking format incorrect | Email masked but wrong format |
| Trivial | UI cosmetic issue | Alignment off in admin page |

### 8.2 Priority and SLA

| Priority | Fix SLA | Description |
|----------|---------|-------------|
| P1 | Same day | Security/credential exposure |
| P2 | 2 days | Functional masking failure |
| P3 | 1 week | Minor format/UI issues |
| P4 | Backlog | Cosmetic, nice-to-have |

---

## 9. Test Metrics

| Metric | Target |
|--------|--------|
| Test execution rate | 100% of planned cases |
| Pass rate | >= 95% |
| Defect density | < 5 defects per feature |
| Critical defects at release | 0 |
| Automation coverage | >= 90% |
| PII detection accuracy | > 95% (PBT verified) |
| Credential masking coverage | 100% |

---

## 10. Requirements Traceability Matrix (RTM)

| Requirement | Source | Test Cases | Level | Status |
|-------------|--------|-----------|-------|--------|
| PII email masking | Story 1, BR-02 | TC-001, TC-002, TC-003, PBT-001 | UT, IT, PBT | Planned |
| PII phone masking | Story 1, BR-02 | TC-004, TC-005, PBT-002 | UT, IT, PBT | Planned |
| PII IP masking | Story 1, BR-02 | TC-006, TC-007, PBT-003 | UT, IT, PBT | Planned |
| PII credit card masking | Story 1, BR-02 | TC-008, TC-009, PBT-004 | UT, IT, PBT | Planned |
| PII SSN masking | Story 1, BR-02 | TC-010, TC-011, PBT-005 | UT, IT, PBT | Planned |
| Credential always masked | Story 2, BR-01 | TC-012 to TC-018 | UT, IT, E2E-API | Planned |
| Admin reveal with audit | UC-02 | TC-019, TC-020 | IT, E2E-API | Planned |
| Business classification | Story 3, BR-03, BR-04 | TC-021 to TC-025 | UT, IT | Planned |
| Auto-classification >80% | Story 4 | TC-026, TC-027 | IT | Planned |
| Admin config UI | Story 5, UC-03 | TC-028 to TC-035 | E2E-API, E2E-UI | Planned |
| Allowlist management | Story 7, UC-04 | TC-036 to TC-040 | IT, E2E-API | Planned |
| Audit trail | Story 6, BR-10 | TC-041 to TC-045 | IT, E2E-API | Planned |
| Performance < 5ms | Story 8, BR-12 | TC-046, TC-047 | IT (bench) | Planned |
| Code block preservation | BR-07, BR-08 | TC-048, TC-049 | UT, IT | Planned |
| Fail-open/fail-closed | BR-11 | TC-050, TC-051 | UT, IT | Planned |
| Role-based access | BR-02, BR-03, BR-04 | TC-052 to TC-058 | IT, E2E-API | Planned |
| Config immediate effect | BR-09 | TC-059 | IT, E2E-API | Planned |
| Markdown preservation | BR-07 | TC-060 | UT | Planned |
| PBT random inputs | All patterns | PBT-001 to PBT-006 | PBT | Planned |

---

## Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage Overview | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |
