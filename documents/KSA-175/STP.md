# Software Test Plan (STP)

## MCP Code Intelligence — KSA-175: [Kotlin] Code Quality

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-175 |
| Title | [Kotlin] Code Quality — Test Plan |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-25 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-175.docx |
| Related FSD | FSD-v1-KSA-175.docx |
| Related TDD | TDD-v1-KSA-175.docx |

---

## 1. Test Scope

### 1.1 In Scope

- Cyclomatic complexity calculation for 6 languages (TS, JS, Python, Java, Kotlin, Go)
- Grade assignment (A-F)
- Entry point detection (5 types, 6 frameworks)
- Circular dependency detection (Tarjan's SCC)
- Dead import detection
- Hot path analysis
- Related test finder
- Module quality summary
- MCP tool registration and response format
- Database persistence (upsert, query, indexes)

### 1.2 Out of Scope

- Security analysis (KSA-176)
- Similarity detection (KSA-177)
- Tree-sitter parser correctness (KSA-172)
- Graph engine correctness (KSA-173)
- UI testing (no UI)

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | ID Prefix | Scope | Automation | Tool |
|-------|-----------|-------|------------|------|
| Property-Based Testing | PBT | Grade boundaries, CC formula | 100% | kotlin-test + jqwik |
| Unit Testing | UT | Individual counters, algorithms | 100% | JUnit 5 + kotlin-test |
| Integration Testing | IT | Analyzer + DB, Tool handlers | 100% | JUnit 5 + SQLite in-memory |
| E2E-API Testing | E2E-API | MCP tool calls end-to-end | 100% | MCP client test harness |
| E2E-UI Testing | E2E-UI | N/A (no UI) | N/A | N/A |
| System Integration Testing | SIT | Parity with Node.js output | 80% auto / 20% manual | Custom comparison scripts |

### 2.2 Test Coverage Targets

| Module | Line Coverage | Branch Coverage |
|--------|-------------|----------------|
| complexity/counters/ | >= 90% | >= 85% |
| complexity/ (other) | >= 85% | >= 80% |
| entrypoints/ | >= 85% | >= 80% |
| graphanalysis/ | >= 85% | >= 80% |

### 2.3 Entry/Exit Criteria

**Entry Criteria:**
- KSA-172 (parsers) tests pass
- KSA-173 (graph engine) tests pass
- Code compiles without errors
- Database schema created successfully

**Exit Criteria:**
- All PBT, UT, IT tests pass (100%)
- E2E-API tests pass (100%)
- SIT parity tests pass (>= 95% output match)
- No Critical or High severity bugs open
- Coverage targets met

---

## 3. Test Environment

| Component | Specification |
|-----------|--------------|
| OS | Windows 11 / Linux (CI) |
| JDK | OpenJDK 21 |
| Build | Gradle 8.x |
| Database | SQLite in-memory (tests) |
| Test Framework | JUnit 5 + kotlin-test |
| Mocking | MockK (for DB isolation in unit tests) |
| CI | GitHub Actions |

---

## 4. Requirements Traceability Matrix (RTM)

| Requirement (BRD) | FSD Use Case | Test Cases |
|-------------------|-------------|------------|
| Story 1: Complexity Analysis | UC-01 | PBT-01..03, UT-01..12, IT-01..04, E2E-01..03 |
| Story 2: Entry Point Detection | UC-02 | UT-13..18, IT-05..07, E2E-04..05 |
| Story 3: Circular Deps | UC-03 | UT-19..22, IT-08..09, E2E-06 |
| Story 4: Dead Imports | UC-04 | UT-23..25, IT-10, E2E-07 |
| Story 5: Hot Paths | UC-05 | UT-26..28, IT-11, E2E-08 |
| Story 6: Related Tests | UC-06 | UT-29..31, IT-12, E2E-09 |
| Story 7: Module Summary | UC-07 | IT-13, E2E-10 |
| NFR: Performance | — | PERF-01..03 |
| NFR: Output Parity | — | SIT-01..07 |

---

## 5. Test Schedule

| Phase | Duration | Activities |
|-------|----------|-----------|
| Test Design | 1 day | Write test cases, prepare test data |
| Unit Testing | 2 days | Implement PBT + UT tests |
| Integration Testing | 1 day | IT tests with real DB |
| E2E Testing | 1 day | MCP tool call tests |
| SIT (Parity) | 1 day | Compare with Node.js output |
| Bug Fix & Retest | 1 day | Fix failures, rerun |

---

## 6. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| AST node types differ between JNI and Node.js tree-sitter | High | Create adapter layer; test with real parsed files |
| Tarjan's algorithm edge cases | Medium | Use well-known test graphs from algorithm textbooks |
| Framework detection false positives | Medium | Test with real-world project samples |
| Performance regression on large codebases | Low | Add benchmark tests with 5K+ function dataset |

---

## 7. Test Data Requirements

| Data Set | Purpose | Location |
|----------|---------|----------|
| Simple functions (CC=1..5) | Grade A verification | testdata/complexity-simple.csv |
| Complex functions (CC=10..50+) | Grade B-F verification | testdata/complexity-complex.csv |
| Known cycle graphs | Tarjan's SCC verification | testdata/graphs-cycles.csv |
| DAG graphs (no cycles) | Negative test for circular deps | testdata/graphs-dag.csv |
| Framework code samples | Entry point detection | testdata/frameworks/ |
| Node.js reference output | Parity comparison | testdata/reference-output/ |

---

## 8. Defect Management

| Severity | Response Time | Resolution Time |
|----------|--------------|-----------------|
| Critical (crash, data loss) | Immediate | Same day |
| High (wrong CC calculation) | 4 hours | 1 day |
| Medium (formatting issue) | 1 day | 2 days |
| Low (cosmetic) | 3 days | Next sprint |
