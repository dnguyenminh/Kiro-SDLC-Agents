# Software Test Plan (STP)

## Code Intelligence Extension — KSA-286: Web Admin Portal - Server Operations Dashboard and RBAC

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-286 |
| Title | Web Admin Portal - Server Operations Dashboard and RBAC |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-286.docx |
| Related FSD | FSD-v1-KSA-286.docx |
| Related TDD | TDD-v1-KSA-286.docx |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | QA Agent – QA Engineer | Create document |
| Peer Reviewer | SA Agent – Solution Architect | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-14 | QA Agent | Initiate document — auto-generated from BRD, FSD, and TDD |
| 2.0 | 2025-07-22 | SM Agent | Added test cases for impersonation, multi-tab comparison, KB Quality, KB Tags, permission enforcement (17 endpoints), sidebar filtering, force password change, 403 handling. Updated test case count from 126 to 156. |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm the test plan in this STP |
| | ☐ I agree and confirm the test plan in this STP |

---

## 1. Introduction

### 1.1 Purpose

This test plan defines the testing strategy, scope, schedule, and resources for the **Web Admin Portal** (KSA-286). The portal extends the Backend MCP Server (KSA-284) with a React SPA for system administration, including dashboard monitoring, KB management, MCP server control, user management, RBAC, configuration editing, search exploration, and audit trail.

### 1.2 Test Objectives

- Verify all 10 functional use cases (UC-01 through UC-10) are implemented correctly per FSD
- Validate all 61 business rules (BR-01 through BR-61) are enforced
- Ensure RBAC middleware correctly enforces permissions on every API endpoint
- Verify non-functional requirements (performance, security, accessibility)
- Confirm audit trail completeness — no admin action goes unlogged
- Validate integration with KSA-284 (Backend MCP Server) and KSA-285 (JWT Auth)

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-286.docx |
| FSD | FSD-v1-KSA-286.docx |
| TDD | TDD-v1-KSA-286.docx |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Automation | Tools |
|-------|-------|------------|-------|
| PBT | Correctness properties (random inputs for validation rules) | Automated | fast-check |
| UT | Unit/edge case tests for services, middleware, utilities | Automated | Vitest |
| IT | API integration (Hono testClient with in-memory SQLite) | Automated | Vitest + @hono/node-server |
| E2E-API | REST endpoint E2E (real server on port 48721) | Automated | Vitest + fetch/axios |
| E2E-UI | Browser UI E2E (Playwright scenarios) | Automated | Playwright |
| SIT | Manual exploratory / visual / timing edge cases | Manual | Browser |

![Test Execution Flow](diagrams/test-execution-flow.png)

### 2.2 Test Types

| Type | Description | Applicable |
|------|-------------|------------|
| Functional Testing | Verify features per FSD use cases UC-01 to UC-10 | Yes |
| Regression Testing | Ensure KSA-284/285 features are not broken | Yes |
| Performance Testing | Dashboard < 2s, API p95 < 500ms, Graph 60fps | Yes |
| Security Testing | RBAC enforcement, JWT validation, audit immutability | Yes |
| Usability Testing | WCAG 2.1 AA, keyboard nav, ARIA | Yes |
| Compatibility Testing | Chrome 90+, Firefox 100+, Edge 90+ (desktop-only) | Yes |

### 2.3 Test Approach

**Risk-Based Prioritization:**
1. **Critical** — RBAC enforcement (any bypass = security breach), user lifecycle (create/disable/delete), audit immutability
2. **High** — KB promotion workflow, MCP server restart/toggle, configuration hot-reload
3. **Medium** — Dashboard metrics, KB graph visualization (3D ForceGraph3D), analytics, search explorer

**Permission Rules Testing Strategy (32 Rules × 14 Permissions):**

The BRD defines 32 fixed permission rules with typed constraints. Testing approach:

| Rule Type | Test Strategy | Cases per Rule |
|-----------|--------------|----------------|
| boolean (18 rules) | Test true→allowed, false→denied | 2 per rule = 36 cases |
| number (7 rules) | Test within-range, at-boundary (min/max), out-of-range | 3 per rule = 21 cases |
| enum[] (7 rules) | Test allowed value, disallowed value, wildcard (*), empty array | 3-4 per rule = 25 cases |
| LOCKED rules (1 rule) | Test API rejects override, UI shows disabled | 2 cases |

**Total Permission Rule Test Cases: ~84** (integrated into existing E2E-API and UT levels)

**Key Test Scenarios for Permission Rules:**
- `RBAC_MANAGE.canDeleteSystemGroups` LOCKED: API always returns false regardless of roleData
- `CONFIG_EDIT.readOnly=true` overrides `allowedSections`: user sees config but cannot PATCH
- `allowedServers=[*]` grants access to all current + future servers
- Number boundaries: `maxEntries=1` vs `maxEntries=100000`, `maxNodes=50` vs `maxNodes=5000`
- Enum validation: submitting value not in allowedValues list → 400 error
4. **Low** — UI cosmetics, tooltips, accessibility edge cases

**Automation Strategy:** Maximize E2E-API and E2E-UI coverage. Only keep SIT manual for visual/UX/timing tests that require human judgment.

### 2.4 Entry Criteria

| Level | Entry Criteria |
|-------|---------------|
| PBT/UT | Source code for module exists, dependencies installed |
| IT | All services + repositories implemented, SQLite schema applied |
| E2E-API | Backend server running on port 48721, seed data loaded |
| E2E-UI | Frontend built and served, backend running, test user accounts created |
| SIT | All E2E-API + E2E-UI tests pass, deployment to test env complete |

### 2.5 Exit Criteria

| Level | Exit Criteria |
|-------|--------------|
| PBT/UT | 100% property tests pass, ≥80% unit test coverage on business logic |
| IT | All integration tests pass, 0 Critical defects |
| E2E-API | 100% API test cases pass, RBAC verified on all endpoints |
| E2E-UI | All automated UI scenarios pass |
| SIT | 100% manual test cases executed, 0 Critical/Major defects open |

### 2.6 Test Cases Summary

| Level | Count | Automated | Manual |
|-------|-------|-----------|--------|
| PBT | 8 | 8 | 0 |
| UT | 24 | 24 | 0 |
| IT | 42 | 42 | 0 |
| E2E-API | 40 | 40 | 0 |
| E2E-UI | 28 | 28 | 0 |
| SIT | 14 | 0 | 14 |
| **Total** | **156** | **142 (91%)** | **14 (9%)** |

---

## 3. Test Scope

### 3.1 Features In Scope

| # | Feature / Story | Priority | FSD Reference | Test Level |
|---|----------------|----------|---------------|-----------|
| 1 | Dashboard & Monitoring | Medium | UC-01, BR-01–BR-03 | IT, E2E-API, E2E-UI |
| 2 | KB Management (CRUD, Link, Tag) | High | UC-02a/b/c, BR-04–BR-14 | UT, IT, E2E-API, E2E-UI |
| 3 | KB Graph Visualization | Medium | UC-03, BR-15–BR-19 | E2E-UI, SIT |
| 4 | Analytics & Quality | Medium | UC-04, BR-20–BR-23 | IT, E2E-API, E2E-UI |
| 5 | MCP Server Management | High | UC-05a/b/c, BR-24–BR-28 | IT, E2E-API, E2E-UI |
| 6 | User Management | Critical | UC-06a/b/c, BR-29–BR-36 | PBT, UT, IT, E2E-API, E2E-UI |
| 7 | Permission & Role System (RBAC) | Critical | UC-07a/b, BR-37–BR-44 | PBT, UT, IT, E2E-API, E2E-UI |
| 8 | Configuration Editor | High | UC-08, BR-45–BR-50 | IT, E2E-API, E2E-UI |
| 9 | Search Explorer | Low | UC-09, BR-51–BR-53 | IT, E2E-API |
| 10 | Audit Trail | Critical | UC-10, BR-54–BR-61 | UT, IT, E2E-API, E2E-UI |
| 11 | Impersonation | High | UC-13, BRD Story 7 AC-9/10 | IT, E2E-API |
| 12 | Multi-tab Tenant Comparison | Medium | UC-14, BRD Story 13 | E2E-UI, SIT |
| 13 | KB Quality Page | Medium | UC-15, BRD Story 14 | IT, E2E-API, E2E-UI |
| 14 | KB Tags Management | High | UC-16, BRD Story 15 | IT, E2E-API, E2E-UI |
| 15 | Permission Enforcement (17 endpoints) | Critical | FSD 3.13.4 | IT, E2E-API |
| 16 | UI Permission Filtering (sidebar) | High | FSD 3.13.2 | E2E-UI |
| 17 | Force Password Change | Medium | FSD 3.13.2 | E2E-API, E2E-UI |
| 18 | 403 Error Handling | High | FSD 3.13.2 | IT, E2E-API |

![Test Coverage](diagrams/test-coverage.png)

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | Mobile responsive design | BRD explicitly desktop-only |
| 2 | SSO integration | Uses KSA-285 JWT, no SSO in this phase |
| 3 | WebSocket push notifications | BRD specifies polling-based initially |
| 4 | Custom dashboard widgets | Explicitly out of BRD scope |
| 5 | Multi-language UI | English only per BRD |

---

## 4. Test Environment

### 4.1 Environment Requirements

| Environment | URL | Database | Purpose |
|-------------|-----|----------|---------|
| Dev/Test | http://localhost:48721 | SQLite (admin-test.db) | UT/IT/E2E development testing |
| SIT | http://localhost:48721/admin | SQLite (admin-sit.db) | Manual system integration testing |

### 4.2 Browser Requirements

| Browser | Version | OS | Required |
|---------|---------|-----|----------|
| Chrome | 90+ | Windows/Mac | Yes |
| Firefox | 100+ | Windows/Mac | Yes |
| Edge | 90+ | Windows | Yes |

### 4.3 Test Data Requirements

| Data Type | Description | Source | Preparation |
|-----------|-------------|--------|-------------|
| Admin users | System Owner + Operator + Developer + Viewer | DB seed script | testdata/pre-seeded-users.csv |
| Access Groups | 5 predefined groups with permissions | DB seed | testdata/pre-seeded-data.csv |
| KB entries | 50 entries across tiers with links/tags | DB seed + API | testdata/kb-testdata.csv |
| MCP servers | 3 configured child servers (1 running, 1 stopped, 1 error) | Config | Server config fixture |
| Config entries | 20 config keys across sections | DB seed | testdata/config-testdata.csv |
| Audit entries | 100 seeded audit records | DB seed | testdata/audit-testdata.csv |

### 4.4 External Dependencies

| System | Dependency | Mock/Stub Available |
|--------|-----------|---------------------|
| KSA-284 Backend MCP Server | HTTP server hosting portal | Real instance required |
| KSA-285 JWT Auth | Token issuance/validation | Real instance (shared server) |
| MCP Child Servers | At least 1 for toggle/restart tests | Mock child server process |
| SQLite | Database engine | In-memory for IT, file for E2E |

---

## 5. Test Schedule

| Phase | Start Date | End Date | Duration | Milestone |
|-------|-----------|----------|----------|-----------|
| Test Planning | Day 1 | Day 2 | 2 days | STP + STC approved |
| Test Data Preparation | Day 3 | Day 4 | 2 days | Seed scripts + CSV ready |
| UT + PBT Development | Day 5 | Day 8 | 4 days | Unit tests passing |
| IT Development | Day 9 | Day 12 | 4 days | Integration tests passing |
| E2E-API Development | Day 13 | Day 16 | 4 days | API E2E tests passing |
| E2E-UI Development | Day 17 | Day 20 | 4 days | UI E2E tests passing |
| SIT Execution (Manual) | Day 21 | Day 23 | 3 days | SIT sign-off |
| Defect Fix & Retest | Day 24 | Day 26 | 3 days | All Critical/Major fixed |
| UAT | Day 27 | Day 29 | 3 days | UAT sign-off |

---

## 6. Resources & Responsibilities

| Role | Name | Responsibility |
|------|------|---------------|
| Test Lead | QA Agent | Test planning, coordination, reporting |
| QA Engineer | QA Agent | Test case design, automation, execution |
| BA | BA Agent | UAT support, acceptance criteria clarification |
| Developer | DEV Agent | Bug fixing, unit test coverage, test fixtures |
| DevOps | DevOps Agent | Environment setup, CI pipeline |

---

## 7. Risk & Mitigation

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | RBAC logic errors allow unauthorized access | Critical | Medium | Dedicated RBAC test suite covering all endpoints × all roles |
| 2 | MCP server restart destabilizes test env | High | Medium | Isolated mock MCP servers for testing |
| 3 | SQLite concurrency issues under load | Medium | Low | Connection pooling + serialized writes in tests |
| 4 | JWT token expiration during long test runs | Medium | Medium | Token refresh logic in test framework |
| 5 | KB graph performance with large datasets | Medium | Medium | ForceGraph3D WebGL handles 500+ nodes natively, progressive loading tests |
| 6 | Audit trail gaps due to async recording | High | Medium | Synchronous audit in tests, async in production |
| 7 | Config hot-reload race conditions | High | Low | Concurrent update tests, transaction isolation |

---

## 8. Defect Management

### 8.1 Severity Levels

| Severity | Definition | Example |
|----------|-----------|---------|
| Critical | Security breach, data loss, system crash | RBAC bypass, audit deletion possible, server crash on restart |
| Major | Feature not working, no workaround | User creation fails, promotion approval doesn't move entry |
| Minor | Feature works but with issues | Toast message wrong, table sort not working |
| Trivial | Cosmetic, no functional impact | Alignment off by 2px, typo in label |

### 8.2 Priority Levels

| Priority | Definition | SLA (Fix Time) |
|----------|-----------|----------------|
| P1 | Must fix immediately (security, data) | 4 hours |
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
| Automation Rate | Automated / Total × 100% | ≥ 90% |
| Defect Density | Defects / Test Cases | ≤ 0.1 |
| Critical Defect Count | Count of Critical severity | 0 |
| RBAC Coverage | Endpoints with RBAC test / Total endpoints × 100% | 100% |

### 9.2 Reporting Schedule

| Report | Frequency | Audience |
|--------|-----------|----------|
| Daily Test Status | Daily during SIT | Project team |
| Defect Summary | Daily | Dev team + PM |
| Test Completion Report | End of SIT / End of UAT | All stakeholders |

---

## 10. Appendix

### Glossary

| Term | Definition |
|------|------------|
| SIT | System Integration Testing |
| UAT | User Acceptance Testing |
| RBAC | Role-Based Access Control |
| JWT | JSON Web Token |
| SSE | Server-Sent Events |
| PBT | Property-Based Testing |

### Assumptions

- Backend MCP Server (KSA-284) is stable and operational
- JWT authentication (KSA-285) is functional with token issuance/validation
- SQLite database is accessible and schema migrations applied
- Test environment has Node.js >= 18.0 installed
- At least 1 MCP child server is available for restart/toggle tests

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |
