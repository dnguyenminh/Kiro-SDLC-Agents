# Software Test Plan (STP)

## Code Intelligence Extension — KSA-284: Split Extension: Lightweight Proxy + Backend MCP Server

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-284 |
| Title | Split Extension: Lightweight Proxy + Backend MCP Server |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-07-11 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-284.docx |
| Related FSD | FSD-v1-KSA-284.docx |
| Related TDD | TDD-v1-KSA-284.docx |

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
| 1.0 | 2025-07-11 | QA Agent | Initiate document — auto-generated from BRD, FSD, and TDD |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm the test plan in this STP |
| | ☐ I agree and confirm the test plan in this STP |

---

## 1. Introduction

### 1.1 Purpose

This test plan defines the strategy, scope, schedule, and resources for testing the split architecture of the Code Intelligence VS Code/Kiro extension (KSA-284). The split separates the monolithic extension into a Lightweight Extension (Thin Proxy, <5MB) and a Backend MCP Server (standalone Node.js HTTP process), connected via localhost HTTP.

### 1.2 Test Objectives

- Verify Extension activates within 2s and .vsix is <5MB with no native binaries
- Validate transparent proxying of all 52 MCP tools with <50ms overhead (p99)
- Confirm crash isolation — Backend crash does NOT affect Extension stability
- Validate auto-reconnect with exponential backoff recovers within 30s
- Verify all 5 Webview panels (Dashboard, KB Graph, Analytics, Tags, Quality) fetch data from Backend APIs
- Confirm independent Backend versioning and version compatibility checks
- Validate multi-IDE readiness — zero vscode imports in Backend, IDE-agnostic HTTP API
- Verify security — localhost-only binding (127.0.0.1), no auth needed, response validation
- Validate all 38 Business Rules (BR-1 through BR-38) are enforced

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-284.docx |
| FSD | FSD-v1-KSA-284.docx |
| TDD | TDD-v1-KSA-284.docx |
| Tool Inventory | .code-intel/tool-list.txt (52 tools) |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Automation | Tools |
|-------|-------|------------|-------|
| PBT | Property-based tests for proxy correctness, backoff timing, configuration validation | Automated | vitest + fast-check |
| UT | Unit tests for ConnectionManager, ToolProxy, HealthChecker, HttpClient, ToolRouter, ToolValidator | Automated | vitest |
| IT | Integration tests with Hono testApplication — HTTP endpoint verification, module routing | Automated | vitest + supertest |
| E2E-API | REST endpoint E2E — real Backend server process, full HTTP lifecycle | Automated | vitest + node fetch |
| E2E-UI | Browser UI E2E — VS Code Extension test host, Webview panel verification | Automated | @vscode/test-electron + Playwright |
| SIT | Manual exploratory — visual verification, UX timing, edge cases | Manual | Browser + VS Code |

![Test Execution Flow](diagrams/test-execution-flow.png)

### 2.2 Test Types

| Type | Description | Applicable |
|------|-------------|------------|
| Functional Testing | Verify all 7 Use Cases (UC-1→UC-7) and 52 tool proxies | Yes |
| Regression Testing | Ensure tool parity with monolithic version (all 52 tools identical output) | Yes |
| Performance Testing | Activation <2s, proxy latency <50ms, Backend startup <10s | Yes |
| Security Testing | Localhost binding, no 0.0.0.0, response validation | Yes |
| Reliability Testing | Crash isolation, auto-reconnect, graceful degradation | Yes |
| Compatibility Testing | VS Code >=1.85, Node.js >=18, Windows/macOS/Linux | Yes |

### 2.3 Test Approach

- **Risk-based prioritization**: Proxy correctness (52 tools) and crash isolation are highest risk
- **Property-based testing**: Random tool names/arguments to verify proxy transparency
- **Parallel module testing**: Backend modules tested independently via IT
- **Parity testing**: Compare proxy responses vs direct Backend calls for all 52 tools
- **State machine testing**: ConnectionState transitions cover all paths
- **Performance profiling**: VS Code Extension Host profiler for activation timing

### 2.4 Entry Criteria

| Level | Entry Criteria |
|-------|---------------|
| PBT/UT | Source code compiles, dependencies installed |
| IT | Backend builds successfully, Hono app starts |
| E2E-API | Backend deployed locally, port 48721 accessible |
| E2E-UI | Extension packaged (.vsix), VS Code test host available |
| SIT | All automated tests pass, Backend + Extension running on dev machine |
| UAT | SIT complete with 0 Critical defects, UAT environment ready |

### 2.5 Exit Criteria

| Level | Exit Criteria |
|-------|--------------|
| PBT/UT | 100% of properties hold, unit tests pass, coverage ≥80% |
| IT | All API endpoints return correct responses, error codes match FSD |
| E2E-API | Full tool lifecycle works, health check returns correct data |
| E2E-UI | All 5 Webview panels render data, status bar shows correct state |
| SIT | 100% test cases executed, 0 Critical, ≤2 Major defects open |
| UAT | All acceptance criteria from BRD Stories 1-7 validated by stakeholder |

### 2.6 Test Cases Summary

| Level | Count | Automated | Manual |
|-------|-------|-----------|--------|
| PBT | 8 | 8 | 0 |
| UT | 18 | 18 | 0 |
| IT | 15 | 15 | 0 |
| E2E-API | 12 | 12 | 0 |
| E2E-UI | 8 | 8 | 0 |
| SIT | 6 | 0 | 6 |
| **Total** | **67** | **61 (91%)** | **6 (9%)** |

---

## 3. Test Scope

### 3.1 Features In Scope

| # | Feature / Story | Priority | FSD Reference | Test Type |
|---|----------------|----------|---------------|-----------|
| 1 | Extension Activation (<2s, <5MB, no native binaries) | High | UC-1, BR-1..BR-5 | Functional + Performance |
| 2 | MCP Tool Proxying (52 tools, <50ms latency) | High | UC-2, BR-6..BR-11 | Functional + Performance + Regression |
| 3 | Crash Isolation (Backend crash ≠ Extension crash) | High | UC-3, BR-12..BR-16 | Reliability |
| 4 | Auto-Reconnect (exponential backoff, <30s) | High | UC-4, BR-17..BR-21 | Reliability |
| 5 | Webview UI Proxying (5 panels) | Medium | UC-5, BR-22..BR-25 | Functional + UI |
| 6 | Independent Backend Updates (version check) | Medium | UC-6, BR-26..BR-30 | Functional |
| 7 | Multi-IDE Readiness (no vscode in Backend) | Medium | UC-7, BR-31..BR-34 | Architecture |
| 8 | Security (localhost-only, validation) | High | BR-35..BR-38 | Security |
| 9 | Performance (all NFRs) | High | FSD §8 | Non-Functional |

![Test Coverage](diagrams/test-coverage.png)

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | Backend business logic correctness (memory, code intel internals) | Unchanged from monolith — tested separately |
| 2 | Multi-machine/remote deployment | Explicitly out of scope per BRD §1.2 |
| 3 | Authentication/authorization | Not required per BR-36 (localhost trust) |
| 4 | Supporting IDEs other than VS Code/Kiro | Future phase per BRD Story 7 |
| 5 | Child MCP server internals (Jira, Draw.io, Export) | Tested via orchestration proxy only |

---

## 4. Test Environment

### 4.1 Environment Requirements

| Environment | Configuration | Purpose |
|-------------|---------------|---------|
| Dev Local | Windows/macOS, VS Code >=1.85, Node.js >=18 | Unit + Integration tests |
| CI | GitHub Actions, Node.js 18/20, no GUI | PBT + UT + IT + E2E-API |
| E2E | Windows/macOS, VS Code test host, Playwright | E2E-UI tests |
| SIT | Developer machine, VS Code/Kiro, Backend running | Manual SIT |

### 4.2 System Requirements

| Component | Requirement | Notes |
|-----------|-------------|-------|
| VS Code | >= 1.85.0 | Extension Host API |
| Node.js | >= 18.0 | Backend runtime |
| OS | Windows 10+, macOS 12+, Ubuntu 20.04+ | Cross-platform |
| Port | 48721 (configurable) | Backend HTTP |
| Disk | <5MB (Extension), <250MB (Backend) | Size constraints |
| RAM | ~20MB (Extension), ~300MB (Backend) | Memory budget |

### 4.3 Test Data Requirements

| Data Type | Description | Preparation |
|-----------|-------------|-------------|
| Tool definitions | 52 MCP tool schemas | From .code-intel/tool-list.txt |
| SQLite database | Pre-seeded KB entries | Backend test fixtures |
| ONNX model | Embedding model | Backend data directory |
| Orchestration config | Child server definitions | .code-intel/orchestration.json |
| Mock Backend | Configurable HTTP server | For Extension isolation tests |

### 4.4 External Dependencies

| System | Dependency | Mock Available |
|--------|-----------|----------------|
| Backend MCP Server | Full HTTP API | Yes — mock server for Extension UT/IT |
| VS Code Extension Host | Extension API | Yes — @vscode/test-electron |
| Child MCP Servers (Jira, etc.) | stdio orchestration | Yes — Backend manages internally |
| ONNX Runtime | Embedding generation | N/A — Backend internal |

---

## 5. Test Schedule

| Phase | Start Date | End Date | Duration | Milestone |
|-------|-----------|----------|----------|-----------|
| Test Planning | Day 1 | Day 2 | 2 days | STP + STC approved |
| Test Environment Setup | Day 2 | Day 3 | 1 day | Mock servers ready |
| PBT + UT Development | Day 3 | Day 5 | 3 days | Unit coverage ≥80% |
| IT Development | Day 5 | Day 7 | 2 days | All API endpoints tested |
| E2E-API Development | Day 7 | Day 9 | 2 days | Full lifecycle tests pass |
| E2E-UI Development | Day 9 | Day 11 | 2 days | Webview panels verified |
| SIT Execution | Day 11 | Day 12 | 2 days | Manual cases executed |
| Defect Fix & Retest | Day 12 | Day 14 | 2 days | All Critical/Major fixed |
| UAT | Day 14 | Day 16 | 2 days | Business sign-off |

---

## 6. Resources & Responsibilities

| Role | Name | Responsibility |
|------|------|---------------|
| Test Lead | QA Agent | Test planning, coordination, reporting |
| QA Engineer | QA Agent | Test case design, execution, automation |
| BA | BA Agent | UAT support, acceptance criteria clarification |
| Developer | DEV Agent | Bug fixing, unit test coverage, mock servers |
| DevOps | DevOps Agent | CI pipeline, test environments |

---

## 7. Risk & Mitigation

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | 52-tool parity testing is time-intensive | High | Medium | Property-based testing to cover random tool calls |
| 2 | VS Code Extension test host flaky in CI | Medium | Medium | Run E2E-UI on dedicated machine, retry logic |
| 3 | Port conflicts in shared CI environment | Low | Medium | Random port selection in tests |
| 4 | ONNX model load time varies across machines | Medium | Low | Mock ONNX in IT tests, only real model in E2E |
| 5 | Backend startup timing race conditions | High | Medium | Proper health check polling with configurable timeout |
| 6 | Cross-platform path handling differences | Medium | Medium | Test on all 3 OS in CI matrix |

---

## 8. Defect Management

### 8.1 Severity Levels

| Severity | Definition | Example |
|----------|-----------|---------|
| Critical | Extension crash, all tools unavailable, data loss | Extension activate() throws unhandled error |
| Major | Feature broken, workaround exists | One tool category fails, others work |
| Minor | UI cosmetic, non-blocking | Status bar icon wrong color |
| Trivial | Typo, minor log formatting | Log message misspelled |

### 8.2 Priority Levels

| Priority | Definition | SLA (Fix Time) |
|----------|-----------|----------------|
| P1 | Blocks release | 4 hours |
| P2 | Must fix before release | 1 business day |
| P3 | Should fix if time permits | 3 business days |
| P4 | Nice to fix, can defer | Next release |

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
| Automation Rate | Automated / Total × 100% | ≥ 90% |
| Defect Density | Defects / Test Cases | ≤ 0.1 |
| Critical Defect Count | Count of Critical severity | 0 |
| Proxy Latency p99 | 99th percentile overhead | < 50ms |
| Activation Time | activate() duration | < 2000ms |

### 9.2 Reporting Schedule

| Report | Frequency | Audience |
|--------|-----------|----------|
| Daily Test Status | Daily during SIT | Project team |
| Automation Results | Per CI run | Dev team |
| Test Completion Report | End of SIT/UAT | All stakeholders |

---

## 10. Appendix

### Glossary

| Term | Definition |
|------|------------|
| MCP | Model Context Protocol |
| PBT | Property-Based Testing |
| UT | Unit Testing |
| IT | Integration Testing |
| E2E-API | End-to-End API Testing |
| E2E-UI | End-to-End UI Testing |
| SIT | System Integration Testing (Manual) |
| UAT | User Acceptance Testing |
| ONNX | Open Neural Network Exchange |

### Assumptions

- Backend and Extension run on same localhost machine
- Port 48721 is available (or configurable alternative)
- VS Code >=1.85 provides stable `vscode.lm.registerTool()` API
- Node.js native fetch available (>=18.0)
- CI has no GUI — E2E-UI runs separately on dedicated agent

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |
