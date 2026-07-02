# Software Test Plan (STP)

## FEC Knowledge Base — KSA-295: Multi-Scope KB - 3-Level Scope Isolation with Auto-Promotion Service

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-295 |
| Title | Multi-Scope KB - 3-level scope isolation (USER/PROJECT/SHARED) with auto-promotion service |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-07-03 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-295.docx |
| Related FSD | FSD-v1-KSA-295.docx |
| Related TDD | TDD-v1-KSA-295.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-03 | QA Agent | Initiate document — auto-generated from BRD, FSD, and TDD |

---

## 1. Introduction

### 1.1 Purpose

This test plan defines the testing strategy, scope, schedule, and resources for the Multi-Scope KB feature (KSA-295). The feature introduces 3-level scope isolation (USER/PROJECT/SHARED), scope-filtered search, background auto-promotion scanning, admin approval workflow, merge-triggered promotion, and manual SHARED promotion requests.

### 1.2 Test Objectives

- Verify all 6 use cases (UC-1 through UC-6) function correctly per FSD specifications
- Validate all 9 business rules (BR-1 through BR-9) are enforced
- Ensure scope isolation is enforced at the SQL level — no cross-user data leaks
- Verify the promotion lifecycle (scan → queue → approve/reject → scope change)
- Confirm backward compatibility with existing KB entries after migration
- Validate non-functional requirements (performance, scalability, data integrity)

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-295.docx |
| FSD | FSD-v1-KSA-295.docx |
| TDD | TDD-v1-KSA-295.docx |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Automation | Tools |
|-------|-------|------------|-------|
| PBT | Correctness properties (random inputs for scope transitions, criteria evaluation) | Automated | Vitest + fast-check |
| UT | Unit/edge case tests (individual functions in MemoryEngine, ScopePromotionService) | Automated | Vitest |
| IT | Integration tests (MemoryModule with real SQLite DB, end-to-end tool dispatch) | Automated | Vitest + better-sqlite3 |
| E2E-API | REST endpoint E2E (real HTTP server, tool calls via POST /mcp/tools/call) | Automated | Playwright API testing |
| E2E-UI | Not applicable (no UI in this feature — MCP tool-only interface) | N/A | N/A |
| SIT | Manual exploratory testing — edge cases, timing, concurrent access | Manual | Postman / curl |

### 2.2 Test Types

| Type | Description | Applicable |
|------|-------------|------------|
| Functional Testing | Verify all 6 use cases and 14 FSD test scenarios | Yes |
| Regression Testing | Ensure existing mem_search, mem_ingest, mem_crud still work | Yes |
| Security Testing | Verify scope isolation, header injection, SQL injection prevention | Yes |
| Performance Testing | Verify scan performance with batch limits, query latency with indexes | Yes |
| Integration Testing | Verify HTTP layer → dispatcher → engine → DB chain | Yes |
| Compatibility Testing | Not applicable (backend API only) | No |

### 2.3 Test Approach

- **Risk-based prioritization**: Scope isolation (data leak prevention) is highest priority
- **Bottom-up testing**: PBT → UT → IT → E2E-API → SIT
- **Automation-first**: 85%+ automated coverage; SIT only for timing/concurrency edge cases
- **Data-driven**: Test data CSVs drive parameterized tests for boundary values

### 2.4 Entry/Exit Criteria

| Level | Entry Criteria | Exit Criteria |
|-------|---------------|---------------|
| PBT | Source code compiled, properties defined | All properties hold for 1000+ random inputs |
| UT | Source code compiled | 100% pass, ≥90% branch coverage for domain layer |
| IT | DB migration runs, test fixtures loaded | 100% pass, all tool dispatch paths verified |
| E2E-API | Server starts, /mcp/tools/call endpoint responsive | All 14 FSD scenarios pass, 0 Critical defects |
| SIT | E2E-API complete, environment stable | Exploratory testing complete, no Critical defects |

---

## 3. Test Scope

### 3.1 Features In Scope

| # | Feature / Story | Priority | FSD Reference | Test Level |
|---|----------------|----------|---------------|------------|
| 1 | Private-by-Default Ingestion | High | UC-1, BR-1 | PBT, UT, IT, E2E-API |
| 2 | Scope-Filtered Search & Retrieval | High | UC-2, BR-9 | PBT, UT, IT, E2E-API |
| 3 | Auto-Detection of High-Value Entries | High | UC-3, BR-2, BR-3, BR-8 | UT, IT, E2E-API |
| 4 | Admin Approval/Rejection Workflow | High | UC-4, BR-4 | UT, IT, E2E-API |
| 5 | Auto-Promote on Merge/Release | Medium | UC-5, BR-5 | UT, IT, E2E-API |
| 6 | Request PROJECT to SHARED Promotion | High | UC-6, BR-6, BR-7 | UT, IT, E2E-API |
| 7 | Database Migration (scope columns + indexes) | High | TDD Section 4.5 | IT |
| 8 | Backward Compatibility | High | BRD NFR | IT, E2E-API |

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | Multi-project isolation | Future enhancement (BRD 1.2) |
| 2 | RBAC beyond scope-level visibility | Future enhancement |
| 3 | UI dashboard for promotion queue | Not implemented |
| 4 | E2E-UI testing | No UI exists for this feature |
| 5 | Cross-project KB federation | Out of scope per BRD |

---

## 4. Test Environment

### 4.1 Environment Requirements

| Environment | Configuration | Purpose |
|-------------|--------------|---------|
| Local Dev | Node.js >=18.14.1, SQLite (in-memory), Vitest | PBT, UT, IT |
| Integration | Node.js + SQLite (file-based), Hono server | E2E-API |
| SIT | Full backend deployment, real DB with seeded data | Manual SIT |

### 4.2 Test Data Requirements

| Data Type | Description | Source |
|-----------|-------------|--------|
| Pre-seeded entries | 10+ entries across USER/PROJECT/SHARED scopes | SQL fixture |
| Multi-user entries | Entries owned by different user_ids | SQL fixture |
| High-value entries | Entries meeting >=2 promotion criteria | SQL fixture |
| Young entries | Entries < 24h old | Dynamic creation |
| Citations | Citation records linking entries to agents | SQL fixture |

### 4.3 External Dependencies

| System | Dependency | Mock/Stub Available |
|--------|-----------|---------------------|
| HTTP Client (Agent) | Sends POST /mcp/tools/call with X-User-Id header | Direct HTTP calls in tests |
| CI/CD Pipeline | Triggers promote_on_merge | Simulated via direct API call |
| Background Timer | setInterval for hourly scan | Mocked in UT; real in IT/E2E |

---

## 5. Test Schedule

| Phase | Duration | Milestone |
|-------|----------|-----------|
| Test Planning | 1 day | STP + STC approved |
| Test Data Preparation | 0.5 days | Fixtures and CSVs ready |
| PBT + UT Development | 1 day | Properties verified, unit tests pass |
| IT Development + Execution | 1 day | Integration tests pass |
| E2E-API Execution | 0.5 days | All 14 scenarios pass |
| SIT Execution | 0.5 days | Exploratory testing complete |
| Defect Fix & Retest | 1 day | All Critical/Major fixed |
| **Total** | **5.5 days** | Release-ready |

---

## 6. Resources & Responsibilities

| Role | Responsibility |
|------|---------------|
| QA Agent | Test planning, case design, automation, execution, defect reporting |
| Dev Agent | Bug fixing, unit test support, environment setup |
| BA Agent | Acceptance criteria clarification, UAT support |
| SA Agent | Architecture queries, performance analysis |

---

## 7. Risk & Mitigation

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | Scope isolation bypass via direct DB access | Critical | Low | SQL-level enforcement + IT tests verify WHERE clauses |
| 2 | Migration breaks existing queries | High | Low | Backward compat tests; migration is additive-only |
| 3 | Background scan timing conflicts | Medium | Low | Non-blocking design; timer mocked in tests |
| 4 | Test data contamination between tests | Medium | Medium | In-memory DB per test suite; transaction rollback |
| 5 | FTS query edge cases (special chars) | Low | Medium | PBT with random strings; sanitization verified |

---

## 8. Defect Management

### 8.1 Severity Levels

| Severity | Definition | Example |
|----------|-----------|---------|
| Critical | Data leak (cross-user visibility), scope bypass | User A sees User B's USER entries |
| Major | Feature not working but no data leak | Approve action fails silently |
| Minor | Non-critical behavior deviation | Scan returns wrong count in summary |
| Trivial | Log message formatting, typos | Misspelled error message |

### 8.2 Priority & SLA

| Priority | SLA (Fix Time) |
|----------|----------------|
| P1 | 4 hours |
| P2 | 1 business day |
| P3 | 3 business days |
| P4 | Next release |

### 8.3 Defect Lifecycle

```
New → Open → In Progress → Fixed → Ready for Retest → Verified → Closed
                                                     → Reopened → In Progress
```

---

## 9. Test Metrics

| Metric | Formula | Target |
|--------|---------|--------|
| Test Execution Rate | Executed / Total × 100% | 100% |
| Pass Rate | Passed / Executed × 100% | ≥ 95% |
| Automation Rate | Automated / Total × 100% | ≥ 85% |
| Critical Defect Count | Count of Critical severity | 0 |
| Defect Fix Rate | Fixed / Total Defects × 100% | ≥ 90% |

---

## 10. Test Cases Summary

| Level | Count | Automated | Manual |
|-------|-------|-----------|--------|
| PBT | 4 | 4 | 0 |
| UT | 18 | 18 | 0 |
| IT | 14 | 14 | 0 |
| E2E-API | 14 | 14 | 0 |
| E2E-UI | 0 | 0 | 0 |
| SIT | 4 | 0 | 4 |
| **Total** | **54** | **50 (93%)** | **4 (7%)** |

---

## 11. Requirements Traceability Matrix (RTM)

| Requirement | Source | Test Cases (STC) | Coverage |
|-------------|--------|------------------|----------|
| UC-1 Private-by-Default Ingestion | FSD 3.1 | UT-01, UT-02, UT-03, IT-01, IT-02, IT-03, E2E-API-01, E2E-API-02, E2E-API-03 | ✅ |
| UC-2 Scope-Filtered Search | FSD 3.2 | UT-04, UT-05, UT-06, IT-04, IT-05, E2E-API-04, E2E-API-14 | ✅ |
| UC-3 Auto-Detection Scan | FSD 3.3 | UT-07, UT-08, UT-09, IT-06, IT-07, E2E-API-05, E2E-API-06, E2E-API-07 | ✅ |
| UC-4 Admin Approval/Rejection | FSD 3.4 | UT-10, UT-11, UT-12, IT-08, IT-09, E2E-API-08, E2E-API-09 | ✅ |
| UC-5 Merge Auto-Promote | FSD 3.5 | UT-13, UT-14, IT-10, E2E-API-10 | ✅ |
| UC-6 Request SHARED | FSD 3.6 | UT-15, UT-16, UT-17, IT-11, IT-12, IT-13, E2E-API-11, E2E-API-12, E2E-API-13 | ✅ |
| BR-1 Default scope=USER | FSD 3.7 | UT-01, IT-01, E2E-API-01 | ✅ |
| BR-2 Scan criteria (4 criteria, >=2 met) | FSD 3.7 | PBT-01, UT-07, UT-08, IT-06 | ✅ |
| BR-3 Entry >=24h old | FSD 3.7 | UT-09, IT-07, E2E-API-06 | ✅ |
| BR-4 No cooldown on reject | FSD 3.7 | UT-12, IT-09, E2E-API-09 | ✅ |
| BR-5 Merge = auto-promote (no approval) | FSD 3.7 | UT-13, IT-10, E2E-API-10 | ✅ |
| BR-6 PROJECT→SHARED requires approval | FSD 3.7 | UT-15, IT-11, E2E-API-11 | ✅ |
| BR-7 Single-step transitions only | FSD 3.7 | PBT-02, UT-18, IT-14 | ✅ |
| BR-8 Scan interval = 1 hour | FSD 3.7 | UT-09 (timer config) | ✅ |
| BR-9 X-User-Id header context | FSD 3.7 | UT-06, IT-05, E2E-API-14 | ✅ |
| NFR-Performance | FSD 8 | PBT-03, SIT-01 | ✅ |
| NFR-Backward Compat | FSD 8 | IT-14, SIT-02 | ✅ |
| NFR-Security (SQL injection) | FSD 8 | PBT-04, SIT-03 | ✅ |

**Coverage: 100% — All 6 UCs, 9 BRs, and NFRs have test cases.**

---

## 12. Appendix

### Glossary

| Term | Definition |
|------|------------|
| PBT | Property-Based Testing — automated tests with random inputs |
| UT | Unit Testing |
| IT | Integration Testing |
| E2E-API | End-to-End API Testing (real HTTP calls) |
| SIT | System Integration Testing (manual) |
| RTM | Requirements Traceability Matrix |

### Assumptions

- SQLite in-memory mode is functionally equivalent to file-based for testing purposes
- Background timer can be mocked/accelerated in test environment
- X-User-Id header is the sole source of user identity (no JWT/session)
