# Software Test Plan (STP)

## Kiro SDLC Agents — KSA-249: Developer Experience: Steering Optimization + Context Usage Graph + Full Hook System

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-249 |
| Title | Test Plan — Context Usage Graph + Full Hook System |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-01-27 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-249.docx |
| Related FSD | FSD-v1-KSA-249.docx |
| Related TDD | TDD-v1-KSA-249.docx |

---

## 1. Test Scope

### 1.1 In Scope

| Area | Coverage |
|------|----------|
| Context Usage Graph UI | Panel display, thresholds, collapse/expand, auto-update |
| Hook Schema Validation | Required fields, invalid types, error reporting |
| Hook Executor | askAgent, runCommand, timeout, placeholder substitution |
| Hook Events | Event dispatch, circular detection, tool classification |
| Hook Commands | userTriggered registration, command palette |
| preToolUse Constraints | Denial (FORBIDDEN), parameter modification |
| postToolUse Filtering | Category matching, regex matching |
| pre/postTaskExecution | Pipeline integration, metadata passing |

### 1.2 Out of Scope

- Steering Optimization (Req 1) — already committed, no tests needed
- LLM token counting accuracy (external dependency)
- Visual pixel-perfect rendering tests
- Performance benchmarks (covered separately)

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Description | Tool | Coverage |
|-------|-------------|------|----------|
| UT | Unit Tests | Vitest | Individual functions, calculations |
| IT | Integration Tests | Vitest + VS Code test runner | Component interactions |
| E2E-API | End-to-End API | Vitest | Message protocol, pipeline hooks |
| E2E-UI | End-to-End UI | Manual + Playwright (future) | Webview rendering |
| SIT | System Integration | Manual | Full pipeline with hooks |

### 2.2 Test Environment

| Component | Details |
|-----------|---------|
| IDE | VS Code 1.85+ with extension loaded |
| OS | Windows 11, macOS (secondary) |
| Node | 18.x or 20.x |
| Test Runner | Vitest |
| Hook Files | Test fixtures in test/fixtures/hooks/ |

---

## 3. Requirements Traceability Matrix (RTM)

| Requirement | User Story | Test Cases | Level |
|-------------|-----------|------------|-------|
| Context Usage Display | UC-CUG-01 | TC-CUG-001 to TC-CUG-005 | UT, IT |
| Threshold Colors | UC-CUG-02 | TC-CUG-006 to TC-CUG-009 | UT |
| Collapse/Expand | UC-CUG-03 | TC-CUG-010 to TC-CUG-013 | UT, E2E-UI |
| Auto-Update | UC-CUG-04 | TC-CUG-014 to TC-CUG-016 | IT |
| userTriggered | UC-HOOK-01 | TC-HOOK-001 to TC-HOOK-005 | UT, IT |
| postToolUse | UC-HOOK-02 | TC-HOOK-006 to TC-HOOK-012 | UT, IT |
| preTaskExecution | UC-HOOK-03 | TC-HOOK-013 to TC-HOOK-016 | IT |
| postTaskExecution | UC-HOOK-04 | TC-HOOK-017 to TC-HOOK-019 | IT |
| Access Denial | UC-HOOK-05 | TC-HOOK-020 to TC-HOOK-024 | UT, IT |
| Param Modification | UC-HOOK-06 | TC-HOOK-025 to TC-HOOK-029 | UT, IT |
| Circular Detection | UC-HOOK-07 | TC-HOOK-030 to TC-HOOK-034 | UT |
| runCommand Timeout | UC-HOOK-08 | TC-HOOK-035 to TC-HOOK-039 | UT, IT |
| Schema Validation | UC-HOOK-09 | TC-HOOK-040 to TC-HOOK-048 | UT |

---

## 4. Test Approach by Feature

### 4.1 Context Usage Graph

- **Unit Tests**: Token estimation, threshold calculation, payload generation
- **Integration Tests**: Provider sends correct messages to webview
- **E2E-UI**: Visual rendering (manual verification with screenshots)

### 4.2 Hook System

- **Unit Tests**: Schema validation, tool classification, circular detection, placeholder substitution
- **Integration Tests**: Full hook lifecycle (load → event → execute → result)
- **E2E-API**: Pipeline execution with hooks, denial/modification flows

---

## 5. Entry/Exit Criteria

### 5.1 Entry Criteria

- All source code compiled without errors
- Unit tests pass (minimum 80% coverage for new code)
- Test fixtures (hook files) prepared

### 5.2 Exit Criteria

- All Critical/High priority test cases pass
- No known Critical defects open
- Unit test coverage >= 80% for new modules
- Integration tests demonstrate correct hook lifecycle

---

## 6. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Hook circular detection edge cases | High | Comprehensive unit tests with complex scenarios |
| runCommand timeout OS differences | Medium | Test on Windows; note macOS SIGTERM behavior |
| Token estimation drift | Low | Acceptance threshold: +/-5% |
| Webview CSP blocking styles | Medium | Test with CSP enabled |

---

## 7. Test Schedule

| Phase | Duration | Activities |
|-------|----------|-----------|
| Preparation | 1 day | Create fixtures, setup test structure |
| Unit Tests | 2 days | All UT cases |
| Integration | 1 day | IT cases |
| E2E | 1 day | E2E-API + E2E-UI manual |
| Regression | 0.5 day | Existing tests still pass |

---

## 8. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |
