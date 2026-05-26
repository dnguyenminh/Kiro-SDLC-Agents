# Software Test Plan (STP)

## MCP Code Intelligence — KSA-178: [Python] Tree-sitter Core + Parsers

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-178 |
| Title | [Python] Tree-sitter Core + Parsers |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-26 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-178.docx |
| Related FSD | FSD-v1-KSA-178.docx |
| Related TDD | TDD-v1-KSA-178.docx |

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
- Confirm concurrency correctness (multiprocessing, GIL handling)
- Verify graceful error handling and degradation

### 1.2 Test Levels

| Level | Abbreviation | Description | Automation |
|-------|-------------|-------------|------------|
| Property-Based Testing | PBT | Verify invariants with random inputs (Hypothesis) | 100% automated |
| Unit Testing | UT | Individual class/function testing (pytest) | 100% automated |
| Integration Testing | IT | py-tree-sitter + grammar + parser integration | 100% automated |
| E2E API Testing | E2E-API | Full parse pipeline via Python API | 100% automated |
| E2E UI Testing | E2E-UI | MCP tool invocation end-to-end (JSON-RPC) | 90% automated |
| System Integration Testing | SIT | Cross-platform parity verification | 80% automated |

### 1.3 Test Approach

- **PBT**: Hypothesis library for property-based testing of parser invariants
- **UT**: pytest + assertions for unit tests
- **IT**: Real py-tree-sitter + real grammars (no mocks for native layer)
- **E2E-API**: Parse real files, compare output with nodejs reference JSON
- **E2E-UI**: MCP tool calls via JSON-RPC client
- **SIT**: Cross-platform output comparison (Python vs nodejs vs Kotlin)

### 1.4 Test Tools

| Tool | Purpose | Version |
|------|---------|---------|
| pytest | Test runner | ^8.0 |
| pytest-benchmark | Performance benchmarks | ^4.0 |
| pytest-cov | Coverage reporting | ^5.0 |
| hypothesis | Property-based testing | ^6.100 |
| pytest-xdist | Parallel test execution | ^3.5 |
| pytest-timeout | Test timeout enforcement | ^2.3 |

---

## 2. Test Scope

### 2.1 In Scope

| Feature | Test Coverage |
|---------|--------------|
| Parser initialization (py-tree-sitter) | UT, IT |
| Grammar loading (12 languages) | UT, IT, E2E-API |
| Source file parsing | UT, IT, E2E-API, PBT |
| AST construction | UT, IT, E2E-API |
| Incremental parsing | UT, IT, E2E-API, PBT |
| Symbol extraction | UT, IT, E2E-API |
| Language detection | UT |
| Error handling | UT, IT, E2E-API |
| Concurrency (multiprocessing) | IT, PBT |
| Performance benchmarks | IT |
| Cross-platform parity | SIT |
| MCP tool interface | E2E-UI |

### 2.2 Out of Scope

| Feature | Reason |
|---------|--------|
| Graph Engine | Separate ticket (future) |
| AI Context Tools | Separate ticket (future) |
| CI/CD pipeline | Infrastructure concern |
| UI components | KSA-170 scope |

---

## 3. Test Environment

### 3.1 Hardware Requirements

| Component | Specification |
|-----------|--------------|
| CPU | 4+ cores (for multiprocessing tests) |
| RAM | 8GB minimum (for memory tests) |
| Disk | 1GB free (for grammar files + test fixtures) |

### 3.2 Software Requirements

| Software | Version | Purpose |
|----------|---------|---------|
| Python | 3.11, 3.12, 3.13 | Runtime (test matrix) |
| py-tree-sitter | ^0.22.0 | Parser bindings |
| tree-sitter grammars | Pinned versions | Language support |
| Node.js | 20+ | Reference output generation |
| OS | Linux x64, macOS arm64, Windows x64 | Platform matrix |

---

## 4. Requirements Traceability Matrix (RTM)

| Requirement (BRD) | Test Level | Test Case IDs | Priority |
|-------------------|-----------|---------------|----------|
| STORY-1: Parse Source Files | UT, IT, E2E-API, PBT | TC-UT-001..005, TC-IT-001..003, TC-E2E-001..002, TC-PBT-001 | MUST |
| STORY-2: 12 Languages | UT, IT, E2E-API | TC-UT-006..008, TC-IT-004..006, TC-E2E-003..004 | MUST |
| STORY-3: AST Parity | IT, E2E-API, SIT | TC-IT-007..009, TC-E2E-005..006, TC-SIT-001..003 | MUST |
| STORY-4: Incremental Parse | UT, IT, PBT | TC-UT-009..012, TC-IT-010..012, TC-PBT-002..003 | SHOULD |
| STORY-5: Symbol Extraction | UT, IT, E2E-API | TC-UT-013..018, TC-IT-013..015, TC-E2E-007..008 | MUST |
| NFR: Performance | IT (benchmarks) | TC-PERF-001..008 | MUST |
| NFR: Memory | IT | TC-MEM-001..003 | MUST |
| NFR: Concurrency | IT, PBT | TC-CONC-001..004 | SHOULD |
| NFR: Error Handling | UT, IT | TC-ERR-001..007 | MUST |

---

## 5. Test Execution Plan

### 5.1 Execution Order

| Phase | Tests | Duration | Dependency |
|-------|-------|----------|------------|
| 1 | UT (unit tests) | ~30s | Code compiled |
| 2 | IT (integration) | ~2min | Grammars available |
| 3 | PBT (property-based) | ~1min | Parser functional |
| 4 | E2E-API | ~1min | Full pipeline working |
| 5 | PERF (benchmarks) | ~3min | Stable build |
| 6 | SIT (parity) | ~5min | nodejs reference available |
| 7 | E2E-UI (MCP tools) | ~2min | MCP server running |

### 5.2 Entry Criteria

- All source code committed and builds without errors
- py-tree-sitter installed with all 12 grammar files
- Test fixtures available (from nodejs v2)
- CI environment configured with Python 3.11+

### 5.3 Exit Criteria

- All MUST-priority tests pass (100%)
- All SHOULD-priority tests pass (>= 95%)
- Code coverage >= 90% (line coverage)
- Performance benchmarks within targets
- No Critical or High severity bugs open

---

## 6. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Grammar files not available in CI | High | Medium | Bundle in test fixtures; cache in CI |
| Flaky multiprocessing tests | Medium | High | Use pytest-timeout; retry decorator |
| nodejs reference output changes | High | Low | Pin nodejs version; snapshot tests |
| Platform-specific failures | Medium | Medium | CI matrix: linux, macos, windows |
| Memory leaks in long-running tests | Medium | Medium | RSS monitoring; pytest-memray |

---

## 7. Test Data

### 7.1 Test Fixtures

| Category | Location | Description |
|----------|----------|-------------|
| Valid source files | `tests/fixtures/valid/` | One file per language (12 files) |
| Invalid source files | `tests/fixtures/invalid/` | Syntax errors per language |
| Large files | `tests/fixtures/large/` | 10K+ LOC files for perf tests |
| nodejs reference output | `tests/fixtures/reference/` | Expected AST JSON from nodejs |
| Symbol extraction expected | `tests/fixtures/symbols/` | Expected symbol lists |

### 7.2 Test Data Files

| File | Format | Purpose |
|------|--------|---------|
| `valid_sources.csv` | CSV | File paths + expected language + expected node count |
| `symbol_expectations.csv` | CSV | File path + expected symbols (name, kind, scope) |
| `performance_baselines.csv` | CSV | File path + max parse time + max memory |

---

## 8. Automation Summary

| Level | Total Cases | Automated | Manual | Automation % |
|-------|------------|-----------|--------|--------------|
| PBT | 5 | 5 | 0 | 100% |
| UT | 18 | 18 | 0 | 100% |
| IT | 15 | 15 | 0 | 100% |
| E2E-API | 8 | 8 | 0 | 100% |
| E2E-UI | 5 | 4 | 1 | 80% |
| SIT | 5 | 4 | 1 | 80% |
| PERF | 8 | 8 | 0 | 100% |
| **Total** | **64** | **62** | **2** | **97%** |

---

## 9. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage Overview | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |
