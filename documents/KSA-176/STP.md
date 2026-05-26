# Software Test Plan (STP)

## MCP Code Intelligence — KSA-176: [Kotlin] Security Analysis

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-176 |
| Title | [Kotlin] Security Analysis — Test Plan |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-26 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-176.docx |
| Related FSD | FSD-v1-KSA-176.docx |
| Related TDD | TDD-v1-KSA-176.docx |

---

## 1. Test Scope

### 1.1 In Scope

- CFG construction from AST (all supported languages)
- DFG construction from CFG
- Taint analysis engine (forward propagation)
- Vulnerability detectors: SQL injection, XSS, command injection, SSRF, IDOR, misconfiguration
- Severity scoring
- Cross-file taint tracking
- MCP tool API (`analyze_security`)
- Performance benchmarks
- Parity with nodejs reference

### 1.2 Out of Scope

- Tree-sitter parsing (tested in KSA-172)
- Graph engine (tested in KSA-173)
- Python implementation (tested in KSA-182)

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | ID Prefix | Description | Automation |
|-------|-----------|-------------|------------|
| Property-Based Testing (PBT) | PBT-xxx | Invariant verification | 100% automated |
| Unit Testing (UT) | UT-xxx | Individual class/function | 100% automated |
| Integration Testing (IT) | IT-xxx | Module pipeline testing | 100% automated |
| E2E API Testing (E2E-API) | E2E-API-xxx | MCP tool call testing | 100% automated |
| E2E UI Testing (E2E-UI) | E2E-UI-xxx | N/A (no UI) | N/A |
| System Integration Testing (SIT) | SIT-xxx | Parity + performance | 95% automated |

### 2.2 Test Coverage Targets

| Component | UT Coverage | IT Coverage |
|-----------|-------------|-------------|
| CFGBuilder | 90% | 80% |
| DFGBuilder | 90% | 80% |
| TaintAnalyzer | 85% | 80% |
| Detectors (each) | 90% | 85% |
| Facade | 80% | 90% |

---

## 3. Test Cases Summary

| Level | Count | Automated | Manual |
|-------|-------|-----------|--------|
| PBT | 8 | 8 | 0 |
| UT | 77 | 77 | 0 |
| IT | 15 | 15 | 0 |
| E2E-API | 12 | 12 | 0 |
| SIT | 10 | 9 | 1 |
| **Total** | **122** | **121** | **1** |

---

## 4. Requirements Traceability Matrix (RTM)

| BRD Requirement | FSD Use Case | Test Cases |
|-----------------|--------------|------------|
| CFG construction | UC-01 | PBT-001, UT-001 to UT-015, IT-001 |
| DFG construction | UC-02 | PBT-002, UT-016 to UT-027, IT-002 |
| Taint analysis | UC-03 | PBT-003 to PBT-005, UT-028 to UT-042, IT-003 to IT-005 |
| SQL injection | UC-04 (SQL) | UT-043 to UT-048, IT-006, E2E-API-001 |
| XSS detection | UC-04 (XSS) | UT-049 to UT-054, IT-007, E2E-API-002 |
| Command injection | UC-04 (CMD) | UT-055 to UT-060, IT-008, E2E-API-003 |
| SSRF detection | UC-04 (SSRF) | UT-061 to UT-065, IT-009, E2E-API-004 |
| IDOR detection | UC-04 (IDOR) | UT-066 to UT-070, IT-010, E2E-API-005 |
| Misconfiguration | UC-04 (MISC) | UT-071 to UT-075, IT-011, E2E-API-006 |
| Severity scoring | UC-03 (scoring) | PBT-006, UT-076 to UT-077, IT-012 |
| Performance NFRs | All | SIT-001 to SIT-006 |
| Parity with nodejs | All | SIT-007 to SIT-010 |

---

## 5. Test Environment

| Component | Version |
|-----------|---------|
| JDK | 17+ |
| Kotlin | 1.9+ |
| JUnit 5 | 5.10+ |
| kotest | 5.8+ (for PBT) |
| Gradle | 8.x |
| Tree-sitter (K1) | Latest |
| Graph Engine (K2) | Latest |

---

## 6. Risk-Based Testing

| Risk | Test Focus | Priority |
|------|-----------|----------|
| False positives too high | Benchmark with clean code | P0 |
| Missing vulnerabilities | Known-vulnerable test fixtures | P0 |
| Cross-file taint broken | Multi-file test projects | P0 |
| Performance regression | Automated benchmarks | P1 |
| Language-specific patterns | Per-language test fixtures | P1 |

---

## 7. Entry/Exit Criteria

### Entry
- K1 (Parser) and K2 (Graph) modules available and passing
- Test fixtures from nodejs v2 available
- Security benchmark suite available

### Exit
- All P0 tests pass
- UT coverage ≥ 85%
- False positive rate < 20% on benchmark
- Detection rate > 90% on known vulnerabilities
- Performance within NFR thresholds
- Parity with nodejs > 95%

---

## 8. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |
