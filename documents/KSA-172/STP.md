# Software Test Plan (STP)

## MCP Code Intelligence — KSA-172: [Kotlin] Tree-sitter Core + Parsers

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-172 |
| Title | [Kotlin] Tree-sitter Core + Parsers |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-26 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-172.docx |
| Related FSD | FSD-v1-KSA-172.docx |
| Related TDD | TDD-v1-KSA-172.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-26 | QA Agent | Initial test plan |

---

## 1. Test Strategy

### 1.1 Objectives

- Verify all 5 user stories from BRD are fully covered
- Ensure AST output parity with nodejs v2 reference (> 99%)
- Validate performance targets (parsing, incremental, symbol extraction)
- Confirm thread safety and concurrency correctness
- Verify graceful error handling and degradation

### 1.2 Test Levels

| Level | Abbreviation | Description | Automation |
|-------|-------------|-------------|------------|
| Property-Based Testing | PBT | Verify invariants with random inputs | 100% automated |
| Unit Testing | UT | Individual class/function testing | 100% automated |
| Integration Testing | IT | JNI + grammar + parser integration | 100% automated |
| E2E API Testing | E2E-API | Full parse pipeline via API | 100% automated |
| E2E UI Testing | E2E-UI | MCP tool invocation end-to-end | 90% automated |
| System Integration Testing | SIT | Cross-platform parity verification | 80% automated |

### 1.3 Test Approach

- **PBT**: Use jqwik for property-based testing of parser invariants
- **UT**: JUnit 5 + AssertJ for unit tests
- **IT**: Real JNI + real grammars (no mocks for native layer)
- **E2E-API**: Parse real files, compare output with nodejs reference
- **E2E-UI**: MCP tool calls via JSON-RPC
- **SIT**: Cross-platform output comparison (Kotlin vs nodejs)

---

## 2. Test Scope

### 2.1 In Scope

| Feature | Test Coverage |
|---------|--------------|
| Parser initialization (JNI) | UT, IT |
| Grammar loading (12 languages) | UT, IT, E2E-API |
| Source file parsing | UT, IT, E2E-API, PBT |
| AST construction | UT, IT, E2E-API |
| Incremental parsing | UT, IT, E2E-API, PBT |
| Symbol extraction | UT, IT, E2E-API |
| Language detection | UT |
| Error handling | UT, IT, E2E-API |
| Thread safety | IT, PBT |
| Performance | IT (benchmarks) |
| Cross-platform parity | SIT |

### 2.2 Out of Scope

- Graph engine testing (KSA-173)
- AI context testing (KSA-174)
- UI testing (no UI in this module)
- Deployment testing (KSA-177)

---

## 3. Requirements Traceability Matrix (RTM)

| Req ID | Requirement | Test Cases | Coverage |
|--------|-------------|-----------|----------|
| STORY-1 | Parse source files into ASTs | PBT-01, UT-01..05, IT-01..03, E2E-01..03 | 100% |
| STORY-2 | Support 12 languages | UT-06..08, IT-04..06, E2E-04..05 | 100% |
| STORY-3 | AST output matching nodejs | IT-07..09, E2E-06..08, SIT-01..03 | 100% |
| STORY-4 | Incremental parsing | PBT-02, UT-09..12, IT-10..12, E2E-09..10 | 100% |
| STORY-5 | Symbol extraction | PBT-03, UT-13..17, IT-13..15, E2E-11..13 | 100% |
| BR-01 | Language detection | UT-18..20 | 100% |
| BR-08 | Incremental threshold | UT-21, IT-16 | 100% |
| BR-09 | Parse timeout | UT-22, IT-17 | 100% |
| BR-10 | Error tolerance | UT-23..24, IT-18, E2E-14 | 100% |
| NFR-PERF | Performance targets | IT-19..23 (benchmarks) | 100% |
| NFR-MEM | Memory targets | IT-24..25 | 100% |
| NFR-THREAD | Thread safety | PBT-04, IT-26..27 | 100% |

---

## 4. Test Environment

### 4.1 Hardware

| Component | Specification |
|-----------|--------------|
| CPU | 8+ cores (for concurrency tests) |
| RAM | 16GB minimum |
| Disk | SSD (for file I/O benchmarks) |

### 4.2 Software

| Component | Version |
|-----------|---------|
| JDK | 17 (minimum), 21 (LTS) |
| Kotlin | 1.9+ |
| Gradle | 8.5+ |
| JUnit | 5.10.2 |
| jqwik | 1.8.3 |
| AssertJ | 3.25.3 |
| OS | Linux x64, macOS arm64, Windows x64 |

### 4.3 Test Data

| Data Set | Description | Location |
|----------|-------------|----------|
| fixtures-small | 50 files, 1-100 LOC each, all 12 languages | testdata/fixtures-small/ |
| fixtures-medium | 100 files, 100-1000 LOC each | testdata/fixtures-medium/ |
| fixtures-large | 20 files, 5000-50000 LOC each | testdata/fixtures-large/ |
| fixtures-errors | 30 files with syntax errors | testdata/fixtures-errors/ |
| nodejs-reference | Expected AST JSON from nodejs v2 | testdata/nodejs-reference/ |

---

## 5. Test Schedule

| Phase | Duration | Activities |
|-------|----------|-----------|
| Test Preparation | 2 days | Setup environment, prepare fixtures |
| PBT + UT Execution | 3 days | Run property-based and unit tests |
| IT Execution | 3 days | Integration tests with real JNI |
| E2E-API Execution | 2 days | Full pipeline tests |
| SIT Execution | 2 days | Cross-platform comparison |
| Performance Testing | 2 days | Benchmarks and stress tests |
| Bug Fix & Retest | 3 days | Fix issues, regression testing |

---

## 6. Entry/Exit Criteria

### 6.1 Entry Criteria

- All source code committed and builds successfully
- JNI native library available for test platform
- All 12 grammar files available
- Test fixtures prepared and validated
- nodejs v2 reference output generated

### 6.2 Exit Criteria

- All PBT properties pass (1000+ iterations each)
- All UT pass (100% pass rate)
- All IT pass (100% pass rate)
- All E2E-API pass (100% pass rate)
- SIT parity > 99% (AST comparison)
- Performance benchmarks within targets
- No Critical or High severity bugs open
- Code coverage > 85%

---

## 7. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| JNI crashes during testing | High | Run tests in isolated JVM processes |
| Platform-specific failures | Medium | Test on all 3 OS in CI |
| Flaky concurrency tests | Medium | Use deterministic thread scheduling in tests |
| Large fixture files slow CI | Low | Separate performance tests from unit tests |
| nodejs reference output changes | Medium | Pin nodejs version, regenerate on update |

---

## 8. Test Case Summary

| Level | Count | Automated | Manual |
|-------|-------|-----------|--------|
| PBT | 4 | 4 | 0 |
| UT | 24 | 24 | 0 |
| IT | 27 | 27 | 0 |
| E2E-API | 14 | 14 | 0 |
| E2E-UI | 3 | 3 | 0 |
| SIT | 5 | 4 | 1 |
| **Total** | **77** | **76** | **1** |

---

## 9. Defect Management

### 9.1 Severity Levels

| Severity | Description | SLA |
|----------|-------------|-----|
| Critical | Parser crash, data corruption, JNI segfault | Fix within 4 hours |
| High | Wrong AST output, missing symbols, performance > 2x target | Fix within 1 day |
| Medium | Edge case failures, minor parity differences | Fix within 3 days |
| Low | Cosmetic, documentation, non-blocking | Fix in next sprint |

### 9.2 Defect Workflow

1. QA reports defect with reproduction steps
2. Dev triages and assigns severity
3. Dev fixes and marks for retest
4. QA retests and closes or reopens

---

## 10. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |
