# Software Test Plan (STP)

## MCP Code Intelligence Python — KSA-179: [Python] Graph Engine

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-179 |
| Title | [Python] Graph Engine — Test Plan |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-25 |
| Status | Draft |
| Related STP | STP-v1-KSA-179.docx |

---

## 1. Test Scope

### 1.1 In Scope

- SymbolResolver: all 3 resolution strategies + suggest
- CallGraphService: find_callers, find_callees with depth/limit/filter
- DependencyGraphService: query with direction/depth + cycle detection
- ImpactAnalysisService: analyze_impact with all actions + severity classification
- GraphTraverser: traverse with edge/node type filters
- TestDetector: is_test_file, find_related_tests
- FileResolver: resolve_file, is_external, resolve_import_target
- MCP tool integration (5 tools)
- JSON response compatibility with nodejs

### 1.2 Out of Scope

- Tree-sitter parser correctness (KSA-178)
- MCP protocol layer
- Frontend/UI testing

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | ID Prefix | Description | Automation |
|-------|-----------|-------------|------------|
| Property-Based Testing (PBT) | PBT-xxx | Invariant verification with random inputs | 100% automated |
| Unit Testing (UT) | UT-xxx | Individual method/function testing | 100% automated |
| Integration Testing (IT) | IT-xxx | Service interaction with real SQLite | 100% automated |
| E2E-API | E2E-API-xxx | Full MCP tool invocation | 100% automated |
| E2E-UI | E2E-UI-xxx | N/A (no UI) | N/A |
| System Integration (SIT) | SIT-xxx | Cross-module integration | 100% automated |

### 2.2 Test Environment

| Component | Specification |
|-----------|--------------|
| Python | 3.11+ |
| Test Framework | pytest 7.x |
| Coverage | pytest-cov |
| PBT | hypothesis |
| Database | In-memory SQLite (`:memory:`) |
| Mocking | unittest.mock (minimal — prefer real SQLite) |

### 2.3 Test Data Strategy

- **Fixture-based**: pytest fixtures create in-memory SQLite with known graph structures
- **Deterministic**: All test data is hardcoded for reproducibility
- **Scenarios**: Small graph (5 nodes), medium graph (50 nodes), cyclic graph, disconnected graph

---

## 3. Requirements Traceability Matrix (RTM)

| Requirement (BRD) | Test Cases | Coverage |
|-------------------|-----------|----------|
| STORY 1: Find Callers | UT-001 to UT-005, IT-001, E2E-API-001 | 100% |
| STORY 2: Find Callees | UT-006 to UT-009, IT-002, E2E-API-002 | 100% |
| STORY 3: Dependency Graph | UT-010 to UT-014, IT-003, E2E-API-003 | 100% |
| STORY 4: Circular Dependencies | UT-015 to UT-017, IT-004 | 100% |
| STORY 5: Impact Analysis | UT-018 to UT-024, IT-005, E2E-API-004 | 100% |
| STORY 6: Graph Traversal | UT-025 to UT-029, IT-006, E2E-API-005 | 100% |
| STORY 7: Symbol Resolution | UT-030 to UT-035, PBT-001 | 100% |
| STORY 8: Test Detection | UT-036 to UT-039, PBT-002 | 100% |
| NFR: Performance < 500ms | PBT-003, SIT-001 | 100% |
| NFR: API Compatibility | SIT-002 | 100% |

---

## 4. Test Execution Plan

### 4.1 Execution Order

1. PBT (property-based) — verify invariants
2. UT (unit) — verify individual logic
3. IT (integration) — verify service interactions
4. E2E-API — verify MCP tool responses
5. SIT — verify cross-module + performance

### 4.2 Pass/Fail Criteria

| Level | Pass Criteria |
|-------|--------------|
| PBT | All properties hold for 100+ random inputs |
| UT | 100% pass, >80% line coverage |
| IT | 100% pass |
| E2E-API | All 5 tools return valid JSON matching schema |
| SIT | Performance within NFR targets |

---

## 5. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| SQLite in-memory differs from file-based | Low | Also run IT with temp file DB |
| BFS performance degrades with large graphs | Medium | PBT with large random graphs |
| Cycle detection misses edge cases | High | Dedicated cycle test fixtures |

---

## 6. Test Summary

| Level | Total Cases | Automated | Manual |
|-------|-------------|-----------|--------|
| PBT | 3 | 3 | 0 |
| UT | 39 | 39 | 0 |
| IT | 6 | 6 | 0 |
| E2E-API | 5 | 5 | 0 |
| SIT | 2 | 2 | 0 |
| **Total** | **55** | **55** | **0** |

---

## 7. Appendix

### 7.1 Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage Overview | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |
