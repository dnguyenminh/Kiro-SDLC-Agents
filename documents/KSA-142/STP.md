# Software Test Plan (STP)

## MCP Code Intelligence — KSA-142: Feature Parity Sync — Đồng bộ 3 MCP Implementations

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-142 |
| Title | Feature Parity Sync — Đồng bộ 3 MCP Implementations (Python, Node.js, Kotlin) |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-07-25 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-142.docx |
| Related FSD | FSD-v1-KSA-142.docx |
| Related TDD | TDD-v1-KSA-142.docx |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | QA Agent – QA Engineer | Create document |
| Peer Reviewer | SA Agent – Solution Architect | Review technical feasibility |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-25 | QA Agent | Initiate document — auto-generated from BRD, FSD, and TDD |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm the test plan in this STP |
| | ☐ I agree and confirm the test plan in this STP |

---

## 1. Introduction

### 1.1 Purpose

This test plan defines the testing strategy, scope, schedule, and resources for validating the Feature Parity Sync (KSA-142). The goal is to ensure that all 7 features are correctly ported across the 3 MCP Code Intelligence implementations (Python, Node.js, Kotlin) with identical behavior — achieving 100% feature parity.

### 1.2 Test Objectives

- Verify all 12 use cases (UC-01 to UC-12) from FSD are implemented correctly in target implementations
- Validate all 45 business rules (BR-01 to BR-45) are enforced
- Ensure non-functional requirements (performance, storage, reliability) are met
- **CRITICAL**: Verify cross-implementation parity — same input produces same output across Python/Node.js/Kotlin
- Validate schema V3 migrations are reversible and preserve existing data
- Confirm error handling matches FSD Section 9 specifications

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-142.docx |
| FSD | FSD-v1-KSA-142.docx |
| TDD | TDD-v1-KSA-142.docx |
| Node.js Reference Tests | `memory/tests/core-memory.test.ts`, `conversation.test.ts` |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Automation | Tools |
|-------|-------|------------|-------|
| UT | Unit tests per class (CoreMemoryManager, ConversationRepo, etc.) | Automated | pytest (Python), kotest (Kotlin), Jest (Node.js) |
| IT | Integration tests (tool dispatcher → feature manager → DB) | Automated | pytest + SQLite (Python), kotest + SQLite (Kotlin), Jest + better-sqlite3 (Node.js) |
| Parity | Cross-implementation parity — same input → same output | Automated | Custom parity test runner (JSON comparison) |
| SIT | Manual exploratory / edge cases / visual verification | Manual | Browser (Viewer UI), CLI |

![Test Execution Flow](diagrams/test-execution-flow.png)

### 2.2 Test Types

| Type | Description | Applicable |
|------|-------------|------------|
| Functional Testing | Verify features work per FSD use cases (UC-01 to UC-12) | Yes |
| Parity Testing | Verify identical behavior across 3 implementations | Yes — CRITICAL |
| Regression Testing | Ensure existing features are not broken by schema migration | Yes |
| Performance Testing | Verify response times (< 5ms auto-recall, < 50ms search, < 1ms cache) | Yes |
| Security Testing | Verify localhost-only binding for Viewer UI | Yes |
| Integration Testing | Verify tool dispatcher → manager → DB pipeline | Yes |

### 2.3 Test Approach

**Risk-based prioritization:**
1. **CRITICAL** — Parity tests (TC-25, TC-26): If implementations diverge, the entire feature is broken
2. **HIGH** — Core Memory, Conversation, Cache (F1, F2, F4): Most actively used by agents
3. **MEDIUM** — Structured Map, File Watcher, Nested Detection (F3, F5, F7)
4. **LOW** — Viewer UI (F6): Visual, less critical for agent functionality

**Automation strategy:**
- UT + IT: 100% automated (each implementation has its own test suite)
- Parity: Automated JSON comparison across implementations
- SIT: Manual for Viewer UI visual verification only

### 2.4 Entry Criteria

| Level | Entry Criteria |
|-------|---------------|
| UT | Code compiles, schema V3 migration applied, test data fixtures ready |
| IT | Unit tests pass (≥ 95%), SQLite DB initialized with V3 schema |
| Parity | All 3 implementations pass their own UT + IT suites |
| SIT | Parity tests pass, server starts without errors, Viewer UI enabled |

### 2.5 Exit Criteria

| Level | Exit Criteria |
|-------|--------------|
| UT | 100% test cases executed, ≥ 95% pass rate, 0 Critical defects |
| IT | 100% integration scenarios pass, DB operations verified |
| Parity | 100% parity tests pass — identical JSON output across all implementations |
| SIT | All manual scenarios executed, 0 Critical defects, ≤ 2 Major defects |

---

## 3. Test Scope

### 3.1 Features In Scope

| # | Feature / Story | Priority | FSD Reference | Target Implementations | Test Type |
|---|----------------|----------|---------------|------------------------|-----------|
| 1 | Core Memory (Pin/Unpin/Auto-Recall) | HIGH | UC-01, UC-02, BR-01 to BR-06 | Python, Kotlin (port from Node.js) | UT + IT + Parity |
| 2 | Conversation History (Save/Get/Search) | HIGH | UC-03, UC-04, BR-07 to BR-12 | Python, Kotlin (port from Node.js) | UT + IT + Parity |
| 3 | Structured Map & Entity Index | MEDIUM | UC-05, UC-06, BR-13 to BR-18 | Python, Kotlin (port from Node.js) | UT + IT + Parity |
| 4 | Cache Layer for Orchestration | HIGH | UC-07, UC-08, BR-19 to BR-26 | Node.js (verify existing) | UT + IT |
| 5 | File Watcher (Auto-Reindex) | MEDIUM | UC-09, BR-27 to BR-32 | Node.js (verify existing) | UT + IT |
| 6 | Viewer UI (Web Dashboard) | LOW | UC-10, BR-33 to BR-38 | Node.js, Kotlin | SIT (manual) |
| 7 | Nested Detection | MEDIUM | UC-11, UC-12, BR-39 to BR-45 | Kotlin | UT + IT |

![Test Coverage](diagrams/test-coverage.png)

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | New features not in any implementation | BRD explicitly excludes (only porting) |
| 2 | MCP protocol changes | Out of scope per BRD 1.2 |
| 3 | UI/UX redesign of Viewer | Only port existing Python UI |
| 4 | Performance optimization beyond parity | Only verify NFR targets are met |
| 5 | Python File Watcher (already exists) | Only verify Node.js port |
| 6 | Python/Kotlin Cache Layer (already exists) | Only verify Node.js port |

---

## 4. Test Environment

### 4.1 Environment Requirements

| Environment | Runtime | Database | Purpose |
|-------------|---------|----------|---------|
| Python | Python 3.11+, CPython | SQLite 3.35+ (stdlib) | UT + IT + Parity for F1/F2/F3 |
| Node.js | Node 20+, TypeScript 5.x | better-sqlite3 | UT + IT for F4/F5/F6 + Parity reference |
| Kotlin | JVM 21, Kotlin 2.x | sqlite-jdbc | UT + IT + Parity for F1/F2/F3/F7 |
| Viewer UI | Any modern browser | N/A | SIT manual testing |

### 4.2 Browser / Device Requirements (Viewer UI only)

| Browser | Version | OS | Required |
|---------|---------|-----|----------|
| Chrome | 120+ | Windows/Mac/Linux | Yes |
| Firefox | 120+ | Windows/Mac/Linux | Optional |

### 4.3 Test Data Requirements

| Data Type | Description | Source | Preparation |
|-----------|-------------|--------|-------------|
| Knowledge entries | 10+ entries with varying content lengths | DB seed script | SQL INSERT statements |
| Pinned entries | 3-5 entries within 2000-token budget | Test fixture | Created during test setup |
| Conversation sessions | 3 sessions with 5-20 turns each | Test fixture | Created during test setup |
| Entity-rich content | Content with PascalCase identifiers | Test fixture | Predefined strings |
| Cache entries | 100+ entries for LRU testing | Test fixture | Programmatic generation |
| Source files | 10+ .ts/.py/.kt files for watcher | Temp directory | Created in test setup |

### 4.4 External Dependencies

| System | Dependency | Mock/Stub Available |
|--------|-----------|---------------------|
| SQLite 3.35+ | FTS5 extension for search | Built-in (no mock needed) |
| File System | OS file events for watcher | chokidar (Node.js), watchdog (Python) |
| Child MCP Server | For nested detection testing | Mock MCP server (stdio transport) |
| HTTP Server | For Viewer UI | Localhost binding |

---

## 5. Test Schedule

| Phase | Start Date | End Date | Duration | Milestone |
|-------|-----------|----------|----------|-----------|
| Test Planning | Day 1 | Day 2 | 2 days | STP + STC approved |
| Test Data Preparation | Day 2 | Day 3 | 1 day | Fixtures and seed scripts ready |
| UT Execution (all implementations) | Day 3 | Day 6 | 4 days | All unit tests pass |
| IT Execution (all implementations) | Day 5 | Day 8 | 4 days | Integration verified |
| Parity Testing | Day 7 | Day 9 | 3 days | Cross-impl parity confirmed |
| SIT Execution (Viewer UI) | Day 9 | Day 10 | 2 days | Manual verification complete |
| Defect Fix & Retest | Day 8 | Day 11 | 4 days | All Critical/Major fixed |
| Sign-off | Day 12 | Day 12 | 1 day | Test completion report |

---

## 6. Resources & Responsibilities

| Role | Name | Responsibility |
|------|------|---------------|
| Test Lead | QA Agent | Test planning, coordination, parity test design |
| QA Engineer (Python) | QA Agent | Python test execution, defect reporting |
| QA Engineer (Kotlin) | QA Agent | Kotlin test execution, defect reporting |
| QA Engineer (Node.js) | QA Agent | Node.js test execution, defect reporting |
| Developer | Dev Team | Bug fixing, unit test coverage |
| SA | SA Agent | Architecture review, parity criteria definition |

---

## 7. Risk & Mitigation

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | Schema V3 migration breaks existing data | High | Medium | Test migration on copy of production DB first |
| 2 | Parity divergence due to language differences | High | Medium | Use JSON comparison with tolerance for ordering |
| 3 | File watcher flaky tests (timing-dependent) | Medium | High | Use generous timeouts, retry logic in tests |
| 4 | SQLite version mismatch (FTS5 not available) | High | Low | Check SQLite version in test setup, skip if < 3.35 |
| 5 | Token counting approximation differs | Medium | Medium | Standardize on `chars / 4` across all implementations |
| 6 | Child MCP server mock instability | Medium | Medium | Use deterministic mock with fixed responses |
| 7 | Large scope delays testing | Medium | High | Prioritize F1/F2/F4 (HIGH), defer F6 (LOW) |

---

## 8. Defect Management

### 8.1 Severity Levels

| Severity | Definition | Example |
|----------|-----------|---------|
| Critical | Parity broken — implementations produce different results | mem_pin returns different JSON in Python vs Node.js |
| Major | Feature not working in one implementation | Conversation search returns 0 results in Kotlin |
| Minor | Edge case handling differs slightly | Error message wording differs |
| Trivial | Cosmetic, logging differences | Log format differs between implementations |

### 8.2 Priority Levels

| Priority | Definition | SLA (Fix Time) |
|----------|-----------|----------------|
| P1 | Parity-breaking defect | 4 hours |
| P2 | Feature broken in one implementation | 1 business day |
| P3 | Edge case or minor behavior difference | 3 business days |
| P4 | Cosmetic or logging issue | Next release |

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
| Parity Pass Rate | Parity tests passed / Total parity tests × 100% | 100% |
| Defect Density | Defects / Test Cases | ≤ 0.1 |
| Critical Defect Count | Count of Critical severity | 0 |
| Cross-Impl Coverage | Features tested in all target impls / Total features × 100% | 100% |

### 9.2 Test Cases Summary

| Level | Count | Automated | Manual |
|-------|-------|-----------|--------|
| UT | 42 | 42 | 0 |
| IT | 26 | 26 | 0 |
| Parity | 12 | 12 | 0 |
| SIT | 6 | 0 | 6 |
| **Total** | **86** | **80 (93%)** | **6 (7%)** |

### 9.3 Reporting Schedule

| Report | Frequency | Audience |
|--------|-----------|----------|
| Daily Test Status | Daily during execution | Project team |
| Parity Report | After each parity run | Dev team + SA |
| Test Completion Report | End of testing | All stakeholders |

---

## 10. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Parity Test | Test that verifies identical behavior across implementations |
| SIT | System Integration Testing (manual) |
| UT | Unit Testing |
| IT | Integration Testing |
| LRU | Least Recently Used (cache eviction) |
| FTS5 | Full-Text Search version 5 (SQLite extension) |
| SSE | Server-Sent Events |

### Assumptions

- Node.js implementation is the reference (gold standard) for F1/F2/F3 parity
- Python implementation is the reference for F4/F5/F6 parity
- All implementations use SQLite with identical schema (V3)
- Token counting uses `chars / 4` approximation uniformly
- Tests run on developer machines (no CI/CD pipeline required for initial validation)
