# Software Test Plan (STP)

## Kiro SDLC Agents — KSA-293: Refactor kiro-sdlc-agents Extension to Light Client

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-293 |
| Title | Refactor kiro-sdlc-agents Extension to Light Client of Remote Backend |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-293.docx |
| Related FSD | FSD-v1-KSA-293.docx |
| Related TDD | TDD-v1-KSA-293.docx |
| Architecture Pattern | Plugin (VS Code Extension Thin Client) |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | QA Agent – QA Engineer | Create document |
| Peer Reviewer | SM Agent – Scrum Master | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-14 | QA Agent | Initiate document — auto-generated from BRD, FSD, and TDD |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm the test plan in this STP |
| | ☐ I agree and confirm the test plan in this STP |

---

## 1. Introduction

### 1.1 Purpose

This test plan covers verification and validation of the refactored `kiro-sdlc-agents` VS Code extension. The refactoring transforms a monolithic extension (local MCP server, SQLite indexing, ONNX models, LangGraph) into a lightweight thin client that delegates heavy computation to a remote Kiro backend server.

### 1.2 Test Objectives

- Verify all 14 user stories from BRD are implemented correctly
- Validate removal of local heavy components (MCP server, SQLite, ONNX, LangGraph) is complete
- Ensure remote backend connectivity (ConnectionManager, HealthChecker) is reliable
- Validate authentication flows (JWT credentials + PKCE SSO) are secure
- Verify MCP tool call forwarding works for all 52+ backend tools
- Ensure extension activation time < 2s with no blocking
- Validate graceful degradation when backend is unavailable
- Verify bundle size < 500KB with zero production dependencies

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-293.docx |
| FSD | FSD-v1-KSA-293.docx |
| TDD | TDD-v1-KSA-293.docx |
| KSA-292 TDD | documents/KSA-292/TDD.md |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | ID | Scope | Responsibility | Tools | Automation |
|-------|----|-------|---------------|-------|------------|
| Property-Based Testing (PBT) | PBT | Data invariants, state machine properties | Developer | fast-check | 100% automated |
| Unit Testing (UT) | UT | Individual classes/methods | Developer | Vitest | 100% automated |
| Integration Testing (IT) | IT | Component interactions, HTTP mocking | Developer + QA | Vitest + msw/nock | 100% automated |
| E2E API Testing (E2E-API) | E2E-API | Backend API contracts via real HTTP | QA | Vitest + real server | 100% automated |
| E2E UI Testing (E2E-UI) | E2E-UI | Full extension activation, commands, panels | QA | @vscode/test-electron + Playwright | 90% automated |
| System Integration Testing (SIT) | SIT | Visual/UX verification, manual exploratory | QA | Manual | 0% (visual only) |

### 2.2 Test Types

| Type | Description | Applicable |
|------|-------------|------------|
| Functional Testing | Verify features per FSD use cases (UC-01 to UC-13) | Yes |
| Regression Testing | Ensure local ops (inject, config) unchanged | Yes |
| Performance Testing | Activation < 2s, bundle < 500KB, proxy < 500ms | Yes |
| Security Testing | Token storage, PKCE, no secrets in logs | Yes |
| Compatibility Testing | Windows/Mac/Linux, VS Code 1.85+ | Yes |
| Usability Testing | Status bar indicators, login panel UX | Yes |

### 2.3 Test Approach

**Risk-based prioritization:**
- **High Risk:** ConnectionManager state machine, AuthManager token lifecycle, ToolProxy routing (core functionality)
- **Medium Risk:** WorkspaceSyncService, IndexingService, Panel data fetching (supporting features)
- **Low Risk:** StatusBar UI, command registration, config migration (cosmetic/utility)

**Automation strategy:**
- PBT for state machine invariants (Connection, Auth states)
- Unit tests for all pure logic (PkceService, HttpClient headers, file filtering)
- Integration tests with HTTP mocking (msw) for backend communication
- E2E-API tests against real running backend
- E2E-UI tests with @vscode/test-electron for extension lifecycle
- Manual SIT only for visual verification of webview panels

### 2.4 Entry Criteria

| Level | Entry Criteria |
|-------|---------------|
| UT/IT | Code compiles, dev dependencies installed |
| E2E-API | Backend running at test URL, auth credentials available |
| E2E-UI | Extension built (.vsix), VS Code test instance available |
| SIT | All automated tests pass, extension installed in dev VS Code |
| UAT | SIT completed, 0 Critical defects, extension published to private marketplace |

### 2.5 Exit Criteria

| Level | Exit Criteria |
|-------|--------------|
| UT/IT | 100% executed, ≥90% pass rate, ≥80% code coverage on new modules |
| E2E-API | All API contracts verified, auth flows tested |
| E2E-UI | Extension activates < 2s, all commands functional |
| SIT | 0 Critical, ≤2 Major defects open, all panels render correctly |
| UAT | Business sign-off, all 14 stories accepted |

---

## 3. Test Scope

### 3.1 Features In Scope

| # | Feature / Story | Priority | FSD Reference | Test Levels |
|---|----------------|----------|---------------|-------------|
| 1 | Remove Local MCP Server Spawn | High | UC-01 | UT, IT, E2E-UI |
| 2 | Remove Local Indexing (SQLite + ONNX) | High | UC-09, UC-10 | UT, E2E-UI |
| 3 | Remove Native Addon Management | High | — | UT, E2E-UI |
| 4 | Remote Backend Connection Manager | High | UC-01, UC-02 | PBT, UT, IT, E2E-API |
| 5 | Auth Manager + Login Panel (JWT/SSO) | High | UC-03, UC-04, UC-05 | PBT, UT, IT, E2E-API, E2E-UI |
| 6 | IndexingService — Upload to Remote | High | UC-09, UC-10 | UT, IT, E2E-API |
| 7 | WorkspaceSyncService — File Tree Sync | High | UC-08, BR-01..04 | UT, IT, E2E-API |
| 8 | MCP Tool Call Forwarding (HttpClient) | High | UC-06 | UT, IT, E2E-API |
| 9 | Webview Panels — Remote Data | High | UC-11 | IT, E2E-UI, SIT |
| 10 | Chat Panel — Remote LLM via SSE | High | UC-12 | UT, IT, E2E-API, E2E-UI |
| 11 | Keep Local Operations | High | UC-13 | UT, E2E-UI |
| 12 | Extension Fast Activation (< 2s) | High | NFR | E2E-UI, PBT |
| 13 | Remove Heavy Dependencies | Medium | NFR | UT (bundle check) |
| 14 | Remote Backend Config Panel | Medium | — | E2E-UI, SIT |

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | Backend server modifications | Backend already exists (KSA-292 scope) |
| 2 | Injected agent/steering file content | Unchanged, tested in separate tickets |
| 3 | Backend deployment infra | DevOps scope, not extension |
| 4 | Mobile/web clients | Not part of this refactoring |

---

## 4. Test Environment

### 4.1 Environment Requirements

| Environment | URL | Purpose |
|-------------|-----|---------|
| Unit/IT | N/A (in-process + HTTP mocking) | Automated unit and integration tests |
| E2E-API | http://127.0.0.1:48721 | Real backend for API contract verification |
| E2E-UI | VS Code test instance | Extension activation and command testing |
| SIT | Developer workstation with VS Code | Manual visual verification |

### 4.2 Platform Requirements

| Platform | VS Code Version | Node.js | Required |
|----------|----------------|---------|----------|
| Windows 11 | 1.85+ | 18+ | Yes |
| macOS 14+ | 1.85+ | 18+ | Yes |
| Linux (Ubuntu 22.04) | 1.85+ | 18+ | Yes |

### 4.3 Test Data Requirements

| Data Type | Description | Source |
|-----------|-------------|--------|
| Backend credentials | Test user/password for JWT login | Backend /api/admin/auth/login |
| Workspace files | Sample .md + source files for indexing | Fixture files in test directory |
| Mock backend responses | Health, tools/list, tools/call responses | msw handlers |
| SSO test provider | Mock OAuth2 provider for PKCE | In-memory mock |

### 4.4 External Dependencies

| System | Dependency | Mock Available |
|--------|-----------|----------------|
| Remote Kiro Backend | /health, /mcp/tools/*, /api/* | Yes — msw mock server |
| SSO Provider | OAuth2 PKCE flow | Yes — mock provider |
| VS Code API | SecretStorage, Webview, StatusBar | Yes — @vscode/test-electron |

---

## 5. Test Schedule

| Phase | Duration | Milestone |
|-------|----------|-----------|
| Test Planning | 1 day | STP + STC approved |
| Test Data Preparation | 0.5 day | Fixtures and mocks ready |
| UT + PBT Execution | 2 days | Unit tests passing |
| IT Execution | 2 days | Integration tests passing |
| E2E-API Execution | 1 day | API contracts verified |
| E2E-UI Execution | 2 days | Extension lifecycle verified |
| SIT (Manual) | 1 day | Visual verification complete |
| Defect Fix & Retest | 2 days | All Critical/Major fixed |
| UAT | 2 days | Business sign-off |

---

## 6. Resources & Responsibilities

| Role | Responsibility |
|------|---------------|
| QA Agent | Test case design, execution, defect reporting |
| Dev Agent | Unit tests, bug fixing, code coverage |
| BA Agent | UAT support, acceptance criteria clarification |
| SM Agent | Coordination, quality gate enforcement |

---

## 7. Risk & Mitigation

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | Backend not available during E2E-API testing | High | Medium | Use msw mocks as fallback, schedule real backend tests |
| 2 | VS Code test-electron instability | Medium | Medium | Pin VS Code version, retry flaky tests |
| 3 | PKCE flow hard to automate | Medium | High | Test PKCE logic in unit tests, manual verify browser redirect |
| 4 | Large workspace sync timeout | Medium | Low | Test with realistic file counts (1000, 5000, 10000) |
| 5 | SSE streaming parsing edge cases | Medium | Medium | Property-based test on chunk boundaries |
| 6 | Platform-specific SecretStorage behavior | Low | Low | Cross-platform CI matrix |

---

## 8. Defect Management

### 8.1 Severity Levels

| Severity | Definition | Example |
|----------|-----------|---------|
| Critical | Extension crashes, data leak, auth bypass | Token exposed in logs, extension won't activate |
| Major | Feature non-functional, no workaround | Cannot connect to backend, tools not forwarded |
| Minor | Feature degraded but usable | Status bar color wrong, panel slow to load |
| Trivial | Cosmetic only | Typo in notification text |

### 8.2 Priority Levels

| Priority | Definition | SLA |
|----------|-----------|-----|
| P1 | Blocker — release cannot proceed | 4 hours |
| P2 | Must fix before release | 1 business day |
| P3 | Should fix if time | 3 business days |
| P4 | Defer to next release | Next sprint |

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
| Code Coverage (new modules) | Lines covered / Total lines | ≥ 80% |
| Automation Rate | Automated / Total × 100% | ≥ 90% |

### 9.2 Reporting

| Report | Frequency | Audience |
|--------|-----------|----------|
| Daily Test Status | Daily during execution | Project team |
| Test Completion Report | End of each test level | All stakeholders |

---

## 10. Test Case Count Summary

| Level | Count | Automation |
|-------|-------|------------|
| PBT | 8 | 100% automated |
| UT | 45 | 100% automated |
| IT | 28 | 100% automated |
| E2E-API | 18 | 100% automated |
| E2E-UI | 22 | 90% automated |
| SIT (Manual) | 9 | 0% (visual/UX) |
| **TOTAL** | **130** | **93% automated** |

---

## 11. Appendix

### Glossary

| Term | Definition |
|------|------------|
| SIT | System Integration Testing |
| UAT | User Acceptance Testing |
| PBT | Property-Based Testing |
| UT | Unit Testing |
| IT | Integration Testing |
| E2E-API | End-to-End API Testing |
| E2E-UI | End-to-End UI Testing |
| MCP | Model Context Protocol |
| PKCE | Proof Key for Code Exchange |
| SSE | Server-Sent Events |
| JWT | JSON Web Token |

### Assumptions

- Backend server running and healthy for E2E-API tests
- VS Code test-electron available for E2E-UI tests
- All platforms (Win/Mac/Linux) available in CI for compatibility
- Backend API contract stable during testing period
- Test credentials provisioned before test execution

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage Overview | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |
