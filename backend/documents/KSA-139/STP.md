# Software Test Plan (STP)

## MCP Code Intelligence — KSA-139: 2-Level Agent Tool Cache Registry

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-139 |
| Title | 2-Level Agent Tool Cache Registry — KB-based tool discovery cache |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-23 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-139.docx |
| Related FSD | FSD-v1-KSA-139.docx |
| Related TDD | TDD-v1-KSA-139.docx |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | QA Agent – QA Engineer | Create document |
| Peer Reviewer | Duc Nguyen Minh – Technical Lead | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-23 | QA Agent | Initiate document — auto-generated from BRD, FSD, and TDD |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm the test plan in this STP |
| | ☐ I agree and confirm the test plan in this STP |

---

## 1. Introduction

### 1.1 Purpose

This test plan defines the testing strategy, scope, schedule, and resources for the 2-Level Agent Tool Cache Registry feature (KSA-139). The feature implements a KB-backed cache middleware that intercepts tool discovery calls, caches successful results at two levels (global + per-agent), and injects top-N tools into sub-agent prompts at startup to reduce token consumption by ~80%.

### 1.2 Test Objectives

- Verify the lookup cascade (L2 → L1 → find_tools) works correctly per FSD UC-01
- Validate automatic cache population on successful tool execution per UC-02
- Confirm cache invalidation on permanent failures while preserving cache on transient errors per UC-03
- Verify startup injection of top-N tools into sub-agent prompts per UC-04
- Validate configuration management with hot-reload per UC-05
- Ensure all 23 business rules (BR-01 to BR-23) are enforced
- Verify non-functional requirements: KB lookup < 100ms, non-blocking writes, persistence across restarts
- Confirm graceful degradation when KB is unavailable

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | documents/KSA-139/BRD.md |
| FSD | documents/KSA-139/FSD.md |
| TDD | documents/KSA-139/TDD.md |
| Orchestration Architecture | .kiro/steering/orchestration.md |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Automation | Tools |
|-------|-------|------------|-------|
| PBT | Correctness properties — random inputs for cache lookup, error classification, hit counting | Automated | pytest + hypothesis |
| UT | Unit/edge case tests — individual module functions | Automated | pytest + pytest-asyncio |
| IT | Integration tests — cache modules with real KB (SQLite) | Automated | pytest + pytest-asyncio + SQLite |
| E2E-API | REST/MCP endpoint E2E — full server with cache middleware | Automated | pytest + httpx/MCP client |
| E2E-UI | N/A — this feature has no UI | N/A | N/A |
| SIT | Manual exploratory — edge cases, timing, observability | Manual | Python REPL / MCP Inspector |

> **Note:** E2E-UI is not applicable for KSA-139 as this is a backend middleware feature with no user interface.

### 2.2 Test Types

| Type | Description | Applicable |
|------|-------------|------------|
| Functional Testing | Verify cache lookup, population, invalidation, injection per FSD use cases | Yes |
| Regression Testing | Ensure existing find_tools and execute_dynamic_tool still work without cache | Yes |
| Performance Testing | Verify KB lookup < 100ms, non-blocking writes | Yes |
| Security Testing | Verify no sensitive data in cache, workspace isolation | Yes |
| Integration Testing | Verify KB server interaction, MCP server integration | Yes |
| Compatibility Testing | N/A (backend only) | No |

### 2.3 Test Approach

**Risk-based prioritization:** Focus on the lookup cascade (core path) and invalidation logic (data integrity) first. Performance testing validates the 100ms SLA. Property-based testing ensures correctness under random inputs.

**Automation-first:** Given this is a Python backend feature with no UI, 90%+ of tests are automated. Manual SIT is limited to exploratory testing of edge cases and observability verification.

![Test Execution Flow](diagrams/test-execution-flow.png)

### 2.4 Entry/Exit Criteria

| Level | Entry Criteria | Exit Criteria |
|-------|---------------|---------------|
| PBT | Models and core logic implemented | All properties pass with 100+ examples |
| UT | Module code complete | 100% function coverage, all tests pass |
| IT | KB server available, modules integrated | All integration scenarios pass |
| E2E-API | Full server running with cache middleware | All MCP tool calls work through cache |
| SIT | E2E-API passed, server deployed to test env | All manual scenarios executed, no Critical defects |

### 2.5 E2E Automation Coverage

| Scenario Type | Classification | Rationale |
|---------------|---------------|-----------|
| Cache lookup cascade (L2→L1→find_tools) | **E2E-API** | Deterministic API flow |
| Auto-ingest on success | **E2E-API** | Verify KB state after execution |
| Invalidation on failure | **E2E-API** | Verify KB state after error |
| Startup injection | **E2E-API** | Verify prompt enrichment |
| Config hot-reload | **E2E-API** | Verify behavior change without restart |
| KB unavailable degradation | **SIT** (manual) | Requires simulating infrastructure failure |
| Timing/latency verification | **SIT** (manual) | Requires precise timing measurement |
| Log output verification | **SIT** (manual) | Requires human judgment on log quality |

---

## 3. Test Scope

### 3.1 Features In Scope

| # | Feature / Story | Priority | FSD Reference | Test Type |
|---|----------------|----------|---------------|-----------|
| 1 | Lookup Cascade (L2 → L1 → find_tools) | High | UC-01, BR-01 to BR-05 | Functional, Performance |
| 2 | Automatic Cache Population | High | UC-02, BR-06 to BR-10 | Functional, Integration |
| 3 | Cache Invalidation on Failure | High | UC-03, BR-11 to BR-14 | Functional |
| 4 | Startup Injection (Top-N) | High | UC-04, BR-15 to BR-19 | Functional, Integration |
| 5 | Hit-Based Scoring & Ranking | Medium | Story 5, BR-16 | Functional |
| 6 | Configuration Management | Medium | UC-05, BR-20 to BR-23 | Functional |
| 7 | Cross-Session Persistence | High | Story 7, AC6 | Integration |
| 8 | Graceful Degradation (KB unavailable) | High | BR-05, FSD 9.1 | Non-Functional |
| 9 | Performance (< 100ms lookup) | High | BR-04, FSD 8 | Performance |

![Test Coverage](diagrams/test-coverage.png)

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | UI dashboard for cache management | Explicitly out of scope per BRD 1.2 |
| 2 | Tool versioning / schema change detection | Future enhancement per BRD 1.2 |
| 3 | Cross-workspace tool sharing | Not in scope per BRD 1.2 |
| 4 | Tool recommendation engine | Future enhancement per BRD 1.2 |
| 5 | Hit count decay mechanism | Deferred per TDD Open Questions |

---

## 4. Test Environment

### 4.1 Environment Requirements

| Environment | Configuration | Database | Purpose |
|-------------|--------------|----------|---------|
| Local Dev | Python 3.11+, FastMCP | SQLite (local) | UT, IT, PBT |
| Test Server | Python 3.11+, Full MCP stack | SQLite (test) | E2E-API, SIT |

### 4.2 Test Data Requirements

| Data Type | Description | Source | Preparation |
|-----------|-------------|--------|-------------|
| KB entries (tool cache) | Pre-seeded cache entries for L1/L2 | pytest fixtures | Auto-generated per test |
| MCP tool definitions | Mock tool schemas | Test fixtures | Static JSON files |
| orchestration.json | Config with tool_cache section | Test fixture | Template with defaults |
| Agent identifiers | Agent names (ba-agent, sa-agent, etc.) | Constants | Hardcoded in tests |

### 4.3 External Dependencies

| System | Dependency | Mock/Stub Available |
|--------|-----------|---------------------|
| KB Server (SQLite) | Must be running for IT/E2E | Yes — in-memory SQLite for UT |
| MCP Child Servers | Tool discovery source | Yes — mock server for tests |
| UnifiedRegistry | In-memory tool registry | Yes — mock registry |

---

## 5. Test Schedule

| Phase | Start Date | End Date | Duration | Milestone |
|-------|-----------|----------|----------|-----------|
| Test Planning | 2026-05-23 | 2026-05-23 | 1 day | STP + STC approved |
| Test Data Preparation | 2026-05-24 | 2026-05-24 | 1 day | Fixtures ready |
| PBT + UT Execution | 2026-05-25 | 2026-05-26 | 2 days | Unit coverage ≥ 90% |
| IT Execution | 2026-05-27 | 2026-05-28 | 2 days | Integration pass |
| E2E-API Execution | 2026-05-29 | 2026-05-30 | 2 days | E2E pass |
| SIT Execution | 2026-05-31 | 2026-05-31 | 1 day | Manual sign-off |
| Defect Fix & Retest | 2026-06-01 | 2026-06-02 | 2 days | All Critical/Major fixed |

---

## 6. Resources & Responsibilities

| Role | Name | Responsibility |
|------|------|---------------|
| Test Lead | QA Agent | Test planning, coordination, reporting |
| QA Engineer | QA Agent | Test case design, execution, defect reporting |
| BA | BA Agent | Acceptance criteria clarification |
| Developer | DEV Agent | Bug fixing, unit test coverage |
| DevOps | DevOps Agent | Environment setup, CI integration |

---

## 7. Risk & Mitigation

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | KB server latency exceeds 100ms in test env | High | Low | Use local SQLite, benchmark early |
| 2 | Async fire-and-forget writes hard to verify | Medium | Medium | Add await option for test mode |
| 3 | Mock MCP servers don't match real behavior | Medium | Medium | Use integration tests with real KB |
| 4 | Hit count race conditions under concurrency | Medium | Low | Test with asyncio.gather() |
| 5 | Config hot-reload timing issues | Low | Medium | Test with explicit file mtime changes |

---

## 8. Defect Management

### 8.1 Severity Levels

| Severity | Definition | Example |
|----------|-----------|---------|
| Critical | Cache causes data corruption or system crash | Infinite loop in lookup cascade |
| Major | Feature not working, workaround exists | L2 cache never hit (always falls to find_tools) |
| Minor | Non-critical issue, minor impact | Hit count not incrementing on L2 hit |
| Trivial | Cosmetic, logging format | Log message typo |

### 8.2 Priority Levels

| Priority | Definition | SLA (Fix Time) |
|----------|-----------|----------------|
| P1 | Must fix immediately — blocks testing | 4 hours |
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
| Automation Rate | Automated / Total × 100% | ≥ 90% |
| Requirement Coverage | Covered Requirements / Total × 100% | 100% |

### 9.2 Test Cases Summary

| Level | Count | Automated | Manual |
|-------|-------|-----------|--------|
| PBT | 6 | 6 | 0 |
| UT | 24 | 24 | 0 |
| IT | 12 | 12 | 0 |
| E2E-API | 10 | 10 | 0 |
| E2E-UI | 0 | 0 | 0 |
| SIT | 5 | 0 | 5 |
| **Total** | **57** | **52 (91%)** | **5 (9%)** |

---

## 10. Appendix

### Glossary

| Term | Definition |
|------|------------|
| L1 Cache | Global scope — tools accessible by all agents |
| L2 Cache | Agent scope — tools specific to one agent |
| PBT | Property-Based Testing |
| SIT | System Integration Testing (manual) |
| KB | Knowledge Base (SQLite-backed) |
| Lookup Cascade | Sequential search: L2 → L1 → find_tools |

### Assumptions

- KB server (SQLite) is co-located with MCP server (local file access, no network latency)
- Tool names are unique within a server
- Agent names are stable across sessions
- pytest-asyncio supports fire-and-forget task verification via event loop control
