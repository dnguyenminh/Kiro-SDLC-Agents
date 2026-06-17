# Software Test Plan (STP)

## Code Intelligence Extension — KSA-285: Authentication, Multi-Tenant KB, and MCP Server Configuration

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-285 |
| Title | Authentication, Multi-Tenant KB, and MCP Server Configuration |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-07-15 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-285.docx |
| Related FSD | FSD-v1.1-KSA-285.docx |
| Related TDD | TDD-v2.0-KSA-285.docx |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | QA Agent – QA Engineer | Create document |
| Peer Reviewer | SM Agent – Scrum Master | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-15 | QA Agent | Initiate document — auto-generated from BRD, FSD v1.1, and TDD v2.0 |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm the test plan in this STP |
| | ☐ I agree and confirm the test plan in this STP |

---

## 1. Introduction

### 1.1 Purpose

This Software Test Plan defines the testing strategy, scope, resources, and schedule for verifying the Authentication, Multi-Tenant Knowledge Base, and MCP Server Configuration features of the Code Intelligence Extension (KSA-285). These features add security enforcement, data isolation, and user personalization to the existing KSA-284 split architecture.

### 1.2 Test Objectives

- Verify all 11 FSD use cases (UC-1 through UC-11) are correctly implemented
- Validate all 29 business rules (BR-1 through BR-29) are enforced
- Ensure critical KB isolation: User A CANNOT access User B's Tier 1 entries
- Verify security mechanisms: JWT HS256, scrypt hashing, AES-256-GCM, PKCE, account lockout
- Confirm non-functional requirements: login <3s, refresh <500ms, search <500ms
- Validate background job behavior: promotion (30min) and TTL cleanup (1h)
- Ensure graceful degradation: auth failure shows Login Webview, does not crash IDE

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-285.docx |
| FSD | FSD-v1.1-KSA-285.docx |
| TDD | TDD-v2.0-KSA-285.docx |
| KSA-284 TDD | TDD-v1.1-KSA-284.docx |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Automation | Tools |
|-------|-------|------------|-------|
| PBT | Correctness properties (random inputs for JWT, scrypt, AES, tier access) | Automated | fast-check (Vitest property) |
| UT | Unit/edge case tests for services, repositories, utilities | Automated | Vitest |
| IT | API integration (Hono app testClient, real SQLite) | Automated | Vitest + Hono testClient |
| E2E-API | REST endpoint E2E (real server on port 48721) | Automated | Vitest + fetch/undici |
| E2E-UI | Browser UI E2E (Login Webview, MCP Config Webview) | Automated | Playwright + VS Code Extension Test |
| SIT | Manual exploratory / visual / timing edge cases only | Manual | Browser + VS Code |

![Test Execution Flow](diagrams/test-execution-flow.png)

### 2.2 Test Types

| Type | Description | Applicable |
|------|-------------|------------|
| Functional Testing | Verify features per FSD UC-1..UC-11 | Yes |
| Security Testing | JWT validation, PKCE, scrypt, AES-256, lockout, isolation | Yes |
| Performance Testing | Login <3s, refresh <500ms, search <500ms | Yes |
| Regression Testing | Existing MCP tools still work with auth enabled | Yes |
| Integration Testing | Extension↔Backend, Backend↔IdP, Backend↔SQLite | Yes |
| UI Testing | Login Webview, MCP Config Webview | Yes |

### 2.3 Test Approach

**Risk-based prioritization:** Security and isolation tests are Critical priority. Functional happy-path tests are High. Edge cases and UI polish are Medium.

**Automation-first:** Goal is 85%+ automated coverage. Only visual/UX/timing tests remain manual (SIT).

### 2.4 E2E Automation Coverage

| Scenario Type | Classified As | Rationale |
|---------------|---------------|-----------|
| Login CRUD (valid/invalid credentials) | E2E-API | API-level check sufficient |
| Token refresh lifecycle | E2E-API | No browser needed |
| KB CRUD operations | E2E-API | API-level verification |
| KB isolation (User A ≠ User B) | E2E-API | Critical security, API-level |
| MCP config save/retrieve | E2E-API | API response verification |
| RBAC checks (401, 403) | E2E-API | Status code verification |
| Login Webview form interaction | E2E-UI | Browser form interaction |
| MCP Config Webview tabs/forms | E2E-UI | Browser UI interaction |
| Status bar state transitions | E2E-UI | VS Code extension UI |
| SSO browser redirect flow | SIT (manual) | External browser + IdP timing |
| Auto-refresh timer visual feedback | SIT (manual) | Visual timing verification |
| KB promotion notification toast | SIT (manual) | VS Code notification timing |

### 2.5 Entry Criteria

| Level | Entry Criteria |
|-------|---------------|
| PBT/UT | Code compiles, module implemented |
| IT | Backend server starts, SQLite DB initialized, migrations run |
| E2E-API | Full server running on port 48721, test user seeded |
| E2E-UI | VS Code Extension loaded, Backend running |
| SIT | All automated tests pass, deployment to test environment |

### 2.6 Exit Criteria

| Level | Exit Criteria |
|-------|--------------|
| PBT/UT | 100% pass, no regressions |
| IT | 100% pass, all API contracts validated |
| E2E-API | 100% pass, all endpoints verified |
| E2E-UI | 100% pass, all UI flows verified |
| SIT | 100% executed, 0 Critical defects, ≤2 Major open |

---

## 3. Test Scope

### 3.1 Features In Scope

| # | Feature / Story | Priority | FSD Reference | Test Type |
|---|----------------|----------|---------------|-----------|
| 1 | Local Login (username/password) | High | UC-1, BR-2, BR-4, BR-5 | Functional, Security |
| 2 | SSO Login (OIDC + PKCE) | High | UC-2, BR-6, BR-7, BR-26, BR-27 | Functional, Security |
| 3 | Token Storage & Auto-Refresh | High | UC-3, BR-3, BR-8 | Functional, Performance |
| 4 | User KB (Tier 1) — Ingest & Isolation | Critical | UC-4, BR-9, BR-22, BR-23 | Functional, Security |
| 5 | Project KB (Tier 2) — Shared Access | High | UC-5, BR-10, BR-24 | Functional |
| 6 | Shared KB (Tier 3) — Admin-Only Write | High | UC-6, BR-11, BR-25 | Functional |
| 7 | Auto-Promotion User→Project→Shared | Medium | UC-7, UC-8, BR-12..BR-15 | Functional |
| 8 | MCP Server Configuration | High | UC-9, BR-16, BR-17 | Functional, Security |
| 9 | Secure Logout | High | UC-10, BR-18 | Functional, Security |
| 10 | Multi-Tier KB Search | High | UC-11, BR-19..BR-21 | Functional, Performance |

![Test Coverage](diagrams/test-coverage.png)

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | External IdP provisioning | Customer responsibility |
| 2 | RBAC beyond tier visibility | Not in this release |
| 3 | KB content moderation | Future ticket |
| 4 | MCP server deployment | Only config management |
| 5 | Multi-machine Backend | Single-machine per KSA-284 |
| 6 | KB data export/import | Future ticket |
| 7 | Audit logging completeness | Future ticket |

---

## 4. Test Environment

### 4.1 Environment Requirements

| Environment | URL | Database | Purpose |
|-------------|-----|----------|---------|
| DEV | localhost:48721 | SQLite (local) | Unit + Integration |
| SIT | localhost:48721 | SQLite (seeded test data) | System Integration Testing |

### 4.2 Browser / Device Requirements

| Component | Version | Required |
|-----------|---------|----------|
| VS Code | >= 1.85.0 | Yes (SecretStorage API) |
| Node.js | >= 18.0 | Yes (scrypt, AES built-in) |
| Chromium (Playwright) | Latest | Yes (E2E-UI) |

### 4.3 Test Data Requirements

| Data Type | Description | Source | Preparation |
|-----------|-------------|--------|-------------|
| Test users | admin + regular users (locked, active) | DB seed script | Migration 002 + seed |
| KB entries | Entries across 3 tiers, multiple owners | DB seed script | Insert via API |
| MCP configs | Pre-configured Jira/DrawIO/Export | DB seed script | Encrypted config rows |
| SSO config | Mock OIDC provider configuration | Test fixture | sso_config table entry |

### 4.4 External Dependencies

| System | Dependency | Mock/Stub Available |
|--------|-----------|---------------------|
| Identity Provider (OIDC) | SSO login flow | Yes — Mock OIDC server (node-oidc-provider) |
| VS Code SecretStorage | Token persistence | Yes — Mocked in Extension tests |
| Jira API | Test Connection | Yes — WireMock stub |

---

## 5. Test Schedule

| Phase | Duration | Milestone |
|-------|----------|-----------|
| Test Planning | 1 day | STP + STC approved |
| Test Data Preparation | 0.5 day | Seed scripts ready |
| PBT + UT Development | 2 days | Property + unit tests pass |
| IT Development | 2 days | Integration tests pass |
| E2E-API Development | 1.5 days | All API E2E pass |
| E2E-UI Development | 1 day | All UI E2E pass |
| SIT Execution | 1 day | Manual tests executed |
| Defect Fix & Retest | 1 day | All Critical/Major fixed |
| Test Report | 0.5 day | TEST-REPORT finalized |

---

## 6. Resources & Responsibilities

| Role | Responsibility |
|------|---------------|
| Test Lead (QA Agent) | Test planning, case design, execution, reporting |
| Developer | Unit tests, bug fixing, IT support |
| BA | UAT support, acceptance criteria clarification |
| DevOps | Environment setup, CI pipeline |

---

## 7. Risk & Mitigation

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | OIDC mock may not cover all IdP behaviors | Medium | Medium | Use node-oidc-provider for realistic mock |
| 2 | SecretStorage mock differs from real OS keychain | Low | Low | Include E2E-UI tests with real Extension |
| 3 | SQLite WAL mode concurrency edge cases | Medium | Low | Property-based tests with concurrent access |
| 4 | JWT secret rotation during tests | Medium | Low | Fixed test secret in env |
| 5 | Background job timing in tests | High | Medium | Use clock mocking (fake timers) for scheduler tests |

---

## 8. Defect Management

### 8.1 Severity Levels

| Severity | Definition | Example |
|----------|-----------|---------|
| Critical | Security breach, data leak, system crash | User A sees User B's KB; JWT not validated |
| Major | Feature not working, no workaround | Login always fails; search returns wrong tier |
| Minor | Feature works but with issues | Error message slightly wrong; UI misalignment |
| Trivial | Cosmetic | Typo in notification text |

### 8.2 Priority Levels

| Priority | Definition | SLA |
|----------|-----------|-----|
| P1 | Must fix immediately (security) | 4 hours |
| P2 | Must fix before release | 1 business day |
| P3 | Should fix if time permits | 3 business days |
| P4 | Nice to fix, can defer | Next release |

### 8.3 Defect Lifecycle

```
New → Open → In Progress → Fixed → Ready for Retest → Verified → Closed
                                                     → Reopened → In Progress
```

---

## 9. Test Metrics & Reporting

### 9.1 Metrics

| Metric | Formula | Target |
|--------|---------|--------|
| Test Execution Rate | Executed / Total × 100% | 100% |
| Pass Rate | Passed / Executed × 100% | ≥ 95% |
| Defect Density | Defects / Test Cases | ≤ 0.1 |
| Critical Defect Count | Count of Critical severity | 0 |
| Automation Coverage | Automated / Total × 100% | ≥ 85% |

---

## 10. Test Cases Summary

| Level | Count | Automated | Manual |
|-------|-------|-----------|--------|
| PBT | 8 | 8 | 0 |
| UT | 24 | 24 | 0 |
| IT | 18 | 18 | 0 |
| E2E-API | 22 | 22 | 0 |
| E2E-UI | 10 | 10 | 0 |
| SIT | 6 | 0 | 6 |
| **Total** | **88** | **82 (93%)** | **6 (7%)** |

---

## 11. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage Overview | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |

### Assumptions

- Backend server available at localhost:48721 during all test phases
- JWT_SECRET environment variable set to known test value
- SQLite database re-created (clean) before each test run
- Mock OIDC provider available for SSO tests
- VS Code Extension test host available for E2E-UI tests
