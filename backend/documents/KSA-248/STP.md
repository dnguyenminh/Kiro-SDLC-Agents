# Software Test Plan (STP)

## FEC Code Intelligence — KSA-248: KB Contradiction Resolution

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-248 |
| Title | KB Contradiction Resolution — Test Plan |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-06-09 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-248.docx |
| Related FSD | FSD-v1-KSA-248.docx |
| Related TDD | TDD-v1-KSA-248.docx |

---

## 1. Introduction

### 1.1 Purpose

This STP defines the test strategy, scope, and approach for verifying the KB Contradiction Resolution feature across all 4 platform variants (NodeJS, Python, Kotlin/MCP, Kotlin/SDLC).

### 1.2 Test Scope

**In Scope:**
- ContradictionResolver class: all public methods
- 3 resolution strategies (status marking, LLM consolidation, graph edges)
- Integration with ingest pipeline and search engine
- Confidence scoring algorithm
- Supersession signal detection
- Schema migration (idempotent ALTER TABLE)
- Cross-platform behavior consistency

**Out of Scope:**
- Existing ingest pipeline tests (already covered)
- Existing hybrid search tests (already covered)
- LLM service availability (external dependency)
- UI testing (no UI for this feature)

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Description | Technique | Automation |
|-------|-------------|-----------|------------|
| PBT | Property-Based Testing | QuickCheck/Hypothesis | 100% automated |
| UT | Unit Tests | Direct method calls, in-memory SQLite | 100% automated |
| IT | Integration Tests | Real SQLite DB, full resolver lifecycle | 100% automated |
| E2E-API | End-to-End API | Call resolver through ingest/search integration | 100% automated |
| E2E-UI | End-to-End UI | N/A (no UI) | N/A |
| SIT | System Integration | Cross-platform consistency verification | 90% automated |

### 2.2 Test Distribution

| Level | Cases | Automated | Manual |
|-------|-------|-----------|--------|
| PBT | 6 | 6 | 0 |
| UT | 24 | 24 | 0 |
| IT | 12 | 12 | 0 |
| E2E-API | 8 | 8 | 0 |
| E2E-UI | 0 | 0 | 0 |
| SIT | 4 | 3 | 1 |
| **Total** | **54** | **53** | **1** |

### 2.3 Test Techniques

| Technique | Applied To |
|-----------|-----------|
| Equivalence Partitioning | Confidence score ranges (< 0.6, >= 0.6, = 1.0) |
| Boundary Value Analysis | Confidence threshold at 0.6 exactly |
| Property-Based Testing | Signal detection (any string with signal -> detected) |
| State Machine Testing | ACTIVE -> SUPERSEDED -> ACTIVE lifecycle |
| Error Guessing | DB failures, LLM timeouts, empty inputs |

---

## 3. Test Environment

### 3.1 Platforms

| Platform | Runtime | DB |
|----------|---------|-----|
| NodeJS | Node 18+ | better-sqlite3 (in-memory for tests) |
| Python | Python 3.11+ | sqlite3 (in-memory for tests) |
| Kotlin/MCP | JVM 17+ | JDBC SQLite (in-memory for tests) |
| Kotlin/SDLC | JVM 17+ | JDBC SQLite (in-memory for tests) |

### 3.2 Test Data

All test data defined in CSV files at `documents/KSA-248/testdata/`:
- `signals.csv` — supersession signal keywords for testing
- `confidence-scenarios.csv` — input combinations and expected scores
- `resolution-scenarios.csv` — full resolution test scenarios

---

## 4. Requirements Traceability Matrix (RTM)

| Requirement | BRD Story | FSD UC | Test Cases |
|-------------|-----------|--------|------------|
| Auto-detect contradictions on ingest | Story 1 | UC-01 | UT-01..UT-08, IT-01..IT-04, PBT-01..PBT-02 |
| Filter superseded from search | Story 2 | UC-02 | UT-09..UT-14, IT-05..IT-06, E2E-01..E2E-02 |
| LLM consolidation (optional) | Story 5 | UC-03 | UT-15..UT-18, IT-07..IT-08 |
| Manual supersede | Story 3 | UC-04 | UT-19..UT-20, E2E-03..E2E-04 |
| Revalidate | Story 4 | UC-05 | UT-21..UT-22, E2E-05..E2E-06 |
| Diagnostics/stats | Story 6 | UC-06 | UT-23..UT-24, E2E-07..E2E-08 |
| Confidence >= 0.6 threshold | BR-01 | UC-01 | UT-05..UT-06, PBT-03..PBT-04 |
| Chain resolution | BR-12 | UC-02 | UT-13..UT-14, IT-06 |
| Graceful degradation | BR-14, BR-19 | UC-02, UC-03 | UT-17..UT-18, IT-08 |
| Cross-platform consistency | NFR | All | SIT-01..SIT-04 |

**RTM Coverage: 100%** — All 6 BRD stories, all 6 FSD use cases, and all critical business rules have test coverage.

---

## 5. Entry/Exit Criteria

### 5.1 Entry Criteria
- BRD, FSD, TDD approved
- Code implemented (all 4 platforms)
- Test environment available (in-memory SQLite)
- Test data prepared

### 5.2 Exit Criteria
- All Critical/High priority tests pass
- No Critical bugs open
- Code coverage >= 80% for ContradictionResolver class
- Cross-platform consistency verified (SIT pass)

---

## 6. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| SQLite behavior differs between better-sqlite3 / Python sqlite3 / JDBC | Cross-platform inconsistency | SIT tests verify same inputs -> same outputs |
| LLM mock may not represent real behavior | False confidence in LLM strategy | Separate E2E with real LLM (manual, not blocking) |
| FTS5 availability in test SQLite | Tests may skip FTS path | Verify FTS5 available in all test runtimes |

---

## 7. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage Overview | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |