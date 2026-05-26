# Software Test Plan (STP)

## MCP Code Intelligence — KSA-171: Code Intelligence v2 — Feature Parity Sync (Kotlin + Python)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-171 |
| Title | Feature Parity Sync — Test Plan |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-26 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-171.docx |
| Related FSD | FSD-v1-KSA-171.docx |
| Related TDD | TDD-v1-KSA-171.docx |

---

## 1. Test Scope

### 1.1 In Scope

- All 6 feature batches for Kotlin platform
- All 6 feature batches for Python platform
- Cross-platform parity verification
- Performance benchmarks
- Security analysis accuracy

### 1.2 Out of Scope

- nodejs reference implementation testing (covered by KSA-144)
- UI testing (covered by KSA-170)
- Deployment/infrastructure testing

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | ID Prefix | Description | Automation |
|-------|-----------|-------------|------------|
| Property-Based Testing (PBT) | PBT-xxx | Verify invariants with random inputs | 100% automated |
| Unit Testing (UT) | UT-xxx | Individual function/class testing | 100% automated |
| Integration Testing (IT) | IT-xxx | Module interaction testing | 100% automated |
| E2E API Testing (E2E-API) | E2E-API-xxx | Full MCP tool call testing | 100% automated |
| E2E UI Testing (E2E-UI) | E2E-UI-xxx | N/A (no UI in this epic) | N/A |
| System Integration Testing (SIT) | SIT-xxx | Cross-platform parity testing | 95% automated |

### 2.2 Test Coverage Targets

| Batch | Feature | UT Coverage | IT Coverage | E2E Coverage |
|-------|---------|-------------|-------------|--------------|
| K1/P1 | Parsers | 90% | 80% | 100% tools |
| K2/P2 | Graph | 85% | 80% | 100% tools |
| K3/P3 | AI Context | 80% | 75% | 100% tools |
| K4/P4 | Quality | 85% | 80% | 100% tools |
| K5/P5 | Security | 80% | 75% | 100% tools |
| K6/P6 | Similarity | 80% | 70% | 100% tools |

---

## 3. Test Environment

### 3.1 Kotlin

| Component | Version |
|-----------|---------|
| JDK | 17+ |
| Kotlin | 1.9+ |
| JUnit | 5.10+ |
| Gradle | 8.x |
| Tree-sitter JNI | Latest |

### 3.2 Python

| Component | Version |
|-----------|---------|
| Python | 3.11+ |
| pytest | 7.x+ |
| py-tree-sitter | 0.21+ |
| NetworkX | 3.x |

---

## 4. Test Cases Summary

| Level | Count | Automated | Manual |
|-------|-------|-----------|--------|
| PBT | 12 | 12 | 0 |
| UT | 84 | 84 | 0 |
| IT | 36 | 36 | 0 |
| E2E-API | 24 | 24 | 0 |
| SIT | 18 | 17 | 1 |
| **Total** | **174** | **173** | **1** |

---

## 5. Requirements Traceability Matrix (RTM)

| Requirement (BRD) | FSD Use Case | Test Cases |
|-------------------|--------------|------------|
| 12 language parsers | UC-01 | UT-001 to UT-012, IT-001, E2E-API-001 |
| Graph construction | UC-02 | UT-013 to UT-024, IT-002 to IT-006, E2E-API-002 to E2E-API-004 |
| AI context tools | UC-03 | UT-025 to UT-036, IT-007 to IT-012, E2E-API-005 to E2E-API-008 |
| Code quality | UC-04 | UT-037 to UT-048, IT-013 to IT-018, E2E-API-009 to E2E-API-012 |
| Security analysis | UC-05 | UT-049 to UT-066, IT-019 to IT-028, E2E-API-013 to E2E-API-018 |
| Similarity detection | UC-06 | UT-067 to UT-078, IT-029 to IT-034, E2E-API-019 to E2E-API-022 |
| Performance NFRs | All | PBT-001 to PBT-012, SIT-001 to SIT-006 |
| Cross-platform parity | All | SIT-007 to SIT-018 |

---

## 6. Risk-Based Testing

| Risk | Test Focus | Priority |
|------|-----------|----------|
| Tree-sitter JVM instability | Stress tests, memory leak detection | P0 |
| AST divergence between platforms | Parity comparison tests | P0 |
| Taint analysis false positives | Benchmark suite with known results | P1 |
| Performance regression | Automated benchmarks with thresholds | P1 |
| Python GIL bottleneck | Concurrency stress tests | P2 |

---

## 7. Test Execution Schedule

| Phase | Batch | Duration | Dependencies |
|-------|-------|----------|--------------|
| 1 | K1/P1 (Parsers) | 2 days | Code complete |
| 2 | K2/P2 (Graph) | 2 days | Phase 1 pass |
| 3 | K3/P3 (Context) | 1 day | Phase 2 pass |
| 4 | K4/P4 (Quality) | 1 day | Phase 2 pass |
| 5 | K5/P5 (Security) | 2 days | Phase 2 pass |
| 6 | K6/P6 (Similarity) | 1 day | Phase 3-5 pass |
| 7 | Cross-platform parity | 2 days | All phases pass |

---

## 8. Entry/Exit Criteria

### Entry Criteria
- Code compiles without errors
- All dependencies available
- Test fixtures from nodejs v2 available
- Test environment configured

### Exit Criteria
- All P0 tests pass
- UT coverage ≥ 80%
- No Critical/High severity bugs open
- Cross-platform parity ≥ 95%
- Performance within NFR thresholds

---

## 9. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage Overview | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |
