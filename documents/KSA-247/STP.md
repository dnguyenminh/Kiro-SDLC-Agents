# Software Test Plan (STP)

## Kiro SDLC Agents — KSA-247: Chat Panel: Restore collapsible tool call UI blocks with icons

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-247 |
| Title | Chat Panel: Restore collapsible tool call UI blocks with icons |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-06-09 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-247.docx |
| Related FSD | FSD-v1-KSA-247.docx |
| Related TDD | TDD-v1-KSA-247.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-09 | QA Agent | Initial STP — auto-generated from BRD, FSD, and TDD |

---

## 1. Introduction

### 1.1 Purpose

This test plan defines the strategy, scope, schedule, and resources for testing the restoration of collapsible tool call UI blocks with category icons in the VS Code Chat Panel webview. The feature addresses a regression where tool blocks are wiped during streaming, adds accessibility improvements (keyboard navigation, ARIA attributes), and implements state persistence for tool call data across panel reload.

### 1.2 Test Objectives

- Verify category icon mapping correctly identifies tool types (UC-1, BR-1, BR-2)
- Validate tool call blocks survive streaming responses without data loss (UC-2, BR-5–BR-8)
- Ensure full state persistence and restoration across panel reload (UC-3, BR-9–BR-11)
- Confirm expand/collapse interaction works via mouse and keyboard (UC-4, BR-12–BR-17)
- Validate accessibility compliance (tabindex, aria-expanded, focus-visible)
- Verify "interrupted" status for stale running tools on restore (OI-3)
- Confirm duration display guard prevents duplication (OI-6)
- Ensure escapeHtml prevents XSS in tool names and results

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-247.docx |
| FSD | FSD-v1-KSA-247.docx |
| TDD | TDD-v1-KSA-247.docx |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Automation | Tools |
|-------|-------|------------|-------|
| PBT | Correctness properties for categorizeTool, escapeHtml, formatDuration | Automated | fast-check (JS property-based) |
| UT | Unit tests for pure functions: categorizeTool(), formatDuration(), statusIcon(), escapeHtml() | Automated | Jest / Mocha |
| IT | postMessage integration flow (Extension Host ↔ Webview), state persistence round-trip | Automated | VS Code Extension Test API |
| E2E-UI | Full tool call lifecycle via actual webview rendering | Automated | Playwright + VS Code Extension Test |
| SIT | Visual/UX verification: animations, timing, layout alignment | Manual | Browser (VS Code webview) |

![Test Execution Flow](diagrams/test-execution-flow.png)

### 2.2 Test Types

| Type | Description | Applicable |
|------|-------------|------------|
| Functional Testing | Verify features per FSD use cases UC-1 through UC-4 | Yes |
| Regression Testing | Ensure streaming, tab switching, existing chat features unbroken | Yes |
| Security Testing | XSS prevention via escapeHtml, CSP compliance | Yes |
| Accessibility Testing | Keyboard navigation, ARIA attributes, focus management | Yes |
| Performance Testing | Block render < 16ms, expand/collapse < 200ms | Yes |
| Compatibility Testing | VS Code 1.85+ on Windows/Mac/Linux | Yes |

### 2.3 Test Approach

- **Risk-based prioritization**: Streaming protection (regression fix) is highest priority
- **Bottom-up**: PBT/UT first (pure functions), then IT (message flow), then E2E-UI (full lifecycle)
- **Automation-first**: Only visual/timing tests remain manual (SIT)
- **State-based testing**: Focus on state transitions (running → completed → persisted → restored)

### 2.4 Entry/Exit Criteria

| Level | Entry Criteria | Exit Criteria |
|-------|---------------|---------------|
| PBT | Pure functions implemented | All properties hold for 1000+ random inputs |
| UT | Functions implemented in chat.js | 100% branch coverage on target functions |
| IT | Extension host + webview compiled | All message flows verified, state round-trip passes |
| E2E-UI | Extension packaged, test environment ready | All E2E scenarios pass in headless mode |
| SIT | E2E-UI complete, no Critical defects | All visual checks pass, animations smooth |

### 2.5 E2E Automation Coverage

| Scenario Type | Classification | Rationale |
|---------------|---------------|-----------|
| Tool call rendering (category, icon, status) | E2E-UI | DOM verification, deterministic |
| Streaming protection (blocks persist) | E2E-UI | Message sequence + DOM check |
| State persistence round-trip | IT | Extension API + workspaceState |
| Expand/collapse toggle | E2E-UI | Click + verify class/aria |
| Keyboard toggle (Enter/Space) | E2E-UI | Keyboard event + verify |
| Duration display correctness | UT | Pure function |
| Animation timing (200ms transition) | SIT (manual) | Visual timing judgment |
| Focus ring visibility | SIT (manual) | Visual verification |

### 2.6 Test Cases Summary

| Level | Count | Automated | Manual |
|-------|-------|-----------|--------|
| PBT | 4 | 4 | 0 |
| UT | 12 | 12 | 0 |
| IT | 6 | 6 | 0 |
| E2E-UI | 10 | 10 | 0 |
| SIT | 5 | 0 | 5 |
| **Total** | **37** | **32 (86%)** | **5 (14%)** |

---

## 3. Test Scope

### 3.1 Features In Scope

| # | Feature / Story | Priority | FSD Reference | Test Type |
|---|----------------|----------|---------------|-----------|
| 1 | Category icon mapping (prefixMap-based) | High | UC-1, BR-1, BR-2 | PBT + UT + E2E-UI |
| 2 | Tool call block rendering with accessibility | High | UC-1, BR-4, BR-17 | UT + E2E-UI |
| 3 | Streaming protection (blocks persist during stream) | Critical | UC-2, BR-5–BR-8 | IT + E2E-UI |
| 4 | State persistence and restoration | High | UC-3, BR-9–BR-11 | IT + E2E-UI |
| 5 | Expand/collapse with keyboard support | High | UC-4, BR-12–BR-17 | E2E-UI + SIT |
| 6 | Interrupted status for stale running tools | Medium | OI-3 | UT + IT |
| 7 | Duration display (no duplication) | Medium | OI-6 | UT + E2E-UI |
| 8 | XSS prevention (escapeHtml) | High | TDD 6.3 | PBT + UT |
| 9 | CSS additions (interrupted, focus, duration) | Medium | TDD 3.4 | SIT |

![Test Coverage](diagrams/test-coverage.png)

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | LangGraph engine tool execution logic | Not modified (KSA-247 scope is webview only) |
| 2 | ChatPanelProvider message routing | No changes per TDD Section 10.2 |
| 3 | Tool result syntax highlighting | Future enhancement per BRD Section 1.2 |
| 4 | Virtual scrolling for large tool lists | Not modified, existing functionality |
| 5 | workspaceState quota management | Tech debt (OI-5), deferred |

---

## 4. Test Environment

### 4.1 Environment Requirements

| Environment | Configuration | Purpose |
|-------------|--------------|---------|
| Dev Local | VS Code 1.85+, Extension Development Host | Unit + Integration testing |
| CI | GitHub Actions, headless VS Code | Automated PBT/UT/IT/E2E-UI |
| Manual | VS Code 1.85+ with extension loaded | SIT visual testing |

### 4.2 Platform Requirements

| Platform | VS Code Version | Node.js | Required |
|----------|----------------|---------|----------|
| Windows 10/11 | 1.85+ | 18.x+ | Yes |
| macOS 13+ | 1.85+ | 18.x+ | Yes |
| Linux (Ubuntu 22.04) | 1.85+ | 18.x+ | Yes (CI) |

### 4.3 Test Data Requirements

| Data Type | Description | Source | Preparation |
|-----------|-------------|--------|-------------|
| Tool call events | Simulated chat:toolCall messages | Test fixtures | JSON fixtures with various tool names |
| Streaming chunks | Simulated chat:streamChunk sequences | Test fixtures | Token arrays |
| Persisted state | workspaceState JSON with tool call data | Test fixtures | Serialized conversation state |
| Corrupted state | Invalid/incomplete tool call data | Test fixtures | Missing id/name fields |

### 4.4 External Dependencies

| System | Dependency | Mock Available |
|--------|-----------|----------------|
| VS Code Extension API | Webview + workspaceState | Yes — @vscode/test-electron |
| LangGraph Engine | Tool call event emission | Yes — mock postMessage |
| MCP Tool Servers | Tool execution results | Not needed — only testing UI rendering |

---

## 5. Test Schedule

| Phase | Duration | Milestone |
|-------|----------|-----------|
| Test Planning (this document) | 1 day | STP + STC approved |
| Test Data Preparation | 0.5 day | Fixtures ready |
| PBT + UT Development | 1 day | Pure function tests green |
| IT Development | 1 day | Integration tests green |
| E2E-UI Development | 1.5 days | E2E scenarios pass |
| SIT Execution | 0.5 day | Visual verification complete |
| Defect Fix & Retest | 1 day | All Critical/Major fixed |
| **Total** | **6.5 days** | Test completion report |

---

## 6. Resources & Responsibilities

| Role | Responsibility |
|------|---------------|
| Test Lead (QA Agent) | Test planning, STP/STC creation, test execution coordination |
| QA Engineer | Test case execution, defect reporting, evidence collection |
| Developer | Bug fixing, unit test implementation, code review |
| BA | Acceptance criteria clarification, UAT support |

---

## 7. Risk & Mitigation

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | Webview DOM testing is fragile | High | Medium | Use data-testid attributes, avoid CSS selectors |
| 2 | VS Code version differences affect rendering | Medium | Low | Test on minimum supported version (1.85) |
| 3 | postMessage timing in tests | Medium | Medium | Use waitFor patterns with timeout |
| 4 | workspaceState mock fidelity | Low | Low | Use real VS Code test host for IT |
| 5 | ES5 constraint limits test tooling | Medium | Low | Transpile test helpers, keep webview code ES5 |

---

## 8. Defect Management

### 8.1 Severity Levels

| Severity | Definition | Example |
|----------|-----------|---------|
| Critical | Tool blocks wiped during streaming (regression) | BR-5 violation |
| Major | Tool blocks not restored after reload | BR-9/BR-10 violation |
| Minor | Wrong category icon for a tool name | BR-1 minor mapping error |
| Trivial | Duration display alignment off by 1px | CSS cosmetic |

### 8.2 Priority & SLA

| Priority | Definition | SLA |
|----------|-----------|-----|
| P1 | Streaming regression — blocks wiped | 4 hours |
| P2 | Persistence failure — data lost on reload | 1 business day |
| P3 | Category mismatch — wrong icon shown | 3 business days |
| P4 | Cosmetic — animation timing slightly off | Next release |

### 8.3 Defect Lifecycle

```
New → Open → In Progress → Fixed → Ready for Retest → Verified → Closed
                                                     → Reopened → In Progress
```

---

## 9. Test Metrics & Reporting

| Metric | Formula | Target |
|--------|---------|--------|
| Test Execution Rate | Executed / Total × 100% | 100% |
| Pass Rate | Passed / Executed × 100% | ≥ 95% |
| Automation Rate | Automated / Total × 100% | ≥ 85% |
| Critical Defect Count | Count of Critical severity | 0 |
| PBT Property Violations | Failed properties / Total | 0 |

---

## 10. Appendix

### Glossary

| Term | Definition |
|------|------------|
| PBT | Property-Based Testing — random input generation to verify invariants |
| UT | Unit Testing — isolated function testing |
| IT | Integration Testing — component interaction testing |
| E2E-UI | End-to-End UI Testing — full user flow in real browser |
| SIT | System Integration Testing — manual exploratory testing |
| CSP | Content Security Policy |
| MCP | Model Context Protocol |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |
