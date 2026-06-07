# Software Test Plan (STP)

## KSA-237: Integrate chat completions endpoint into MCP server (kiro-ts)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-237 |
| Title | Integrate chat completions endpoint into MCP server (kiro-ts) |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-06-05 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-237.docx |
| Related FSD | FSD-v1-KSA-237.docx |
| Related TDD | TDD-v1-KSA-237.docx |

---

## 1. Test Strategy

### 1.1 Objectives

- Verify all 5 user stories from BRD are fully covered
- Validate Anthropic Messages API compatibility (request/response format)
- Verify credential resolution chain (Kiro > AWS file > env vars)
- Validate SigV4 signing correctness
- Verify SSE streaming with zero buffering
- Confirm health check diagnostics accuracy
- Validate tool calling (ReAct loop) with tool_use_id tracking

### 1.2 Test Levels

| Level | Description | Automation | Count |
|-------|-------------|------------|-------|
| PBT (Property-Based Testing) | Randomized input generation for validators | 100% | 4 |
| UT (Unit Testing) | Individual module functions in isolation | 100% | 10 |
| IT (Integration Testing) | Module interactions with real HTTP/file system | 100% | 6 |
| E2E-API (End-to-End API) | Full HTTP request lifecycle against running server | 100% | 4 |
| E2E-UI (End-to-End UI) | Chat Panel integration (Gherkin scenarios) | Manual | 2 |
| SIT (System Integration Testing) | Visual/UX validation in Kiro IDE | Manual | 2 |

**Total: 28 test cases**

### 1.3 Test Approach

- **PBT**: Use `fast-check` (already in devDependencies) for input fuzzing
- **UT/IT**: Use `vitest` (already configured in project)
- **E2E-API**: Use Node.js http module to make real requests to running server
- **E2E-UI**: Manual Gherkin scenarios for Chat Panel interaction
- **SIT**: Manual visual verification in Kiro IDE

### 1.4 Entry/Exit Criteria

**Entry:**
- Code compiles without errors (npx tsc)
- All source files exist per TDD implementation checklist

**Exit:**
- All PBT, UT, IT, E2E-API tests pass (100% automated pass)
- E2E-UI manual scenarios executed and documented
- No Critical/High severity defects open

---

## 2. Test Environment

| Component | Details |
|-----------|---------|
| OS | Windows 11 (primary), cross-platform via CI |
| Node.js | 20.x |
| Test Framework | Vitest 4.x |
| PBT Library | fast-check 4.x |
| Mock HTTP | Node.js http.createServer (local mock) |
| Credential Mocks | Temp files in os.tmpdir() |

---

## 3. Requirements Traceability Matrix (RTM)

| Requirement | Source | Test Cases |
|-------------|--------|------------|
| UC-01: Send Chat Message (Streaming) | FSD 3.1.2 | PBT-01, UT-01, UT-02, IT-01, E2E-API-01, E2E-UI-01 |
| UC-02: Resolve Credentials | FSD 3.2.2 | UT-03, UT-04, IT-02, E2E-API-02 |
| UC-03: Tool Use Cycle | FSD 3.3.2 | UT-05, UT-06, IT-03, E2E-API-03, E2E-UI-02 |
| UC-04: Health Check | FSD 3.4.2 | UT-07, IT-04, E2E-API-04 |
| UC-05: Stream SSE Response | FSD 3.5.2 | PBT-02, UT-08, IT-05, E2E-API-01 |
| BR-01: Auth priority | FSD 3.1.3 | UT-03, IT-02 |
| BR-02: Tool ID passthrough | FSD 3.3.3 | UT-05, IT-03, E2E-API-03 |
| BR-04: Proxy overhead <100ms | BRD NFR | IT-06 |
| BR-05: Token delay <50ms | BRD NFR | IT-05 |
| BR-06: Localhost only | BRD NFR | IT-06 |
| BR-07: No credential leaks | BRD NFR | PBT-03, UT-04 |
| BR-10: Health check <5s | BRD Story 4 | IT-04, E2E-API-04 |
| BR-16: Tool ID validation | FSD 3.3.3 | UT-06, E2E-API-03 |
| BR-19-22: SSE format rules | FSD 3.5.3 | PBT-02, UT-08, IT-05 |
| Validation: model, messages, max_tokens | FSD 3.1.4 | PBT-01, UT-01, PBT-04 |
| Error format (Anthropic) | FSD 9.2 | UT-02, UT-09, IT-01 |
| SigV4 signing | FSD 6.3, TDD 6.1 | UT-10, IT-02 |

**RTM Coverage: 100%** — All BRD stories and FSD use cases have at least 2 test cases.

---

## 4. Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| AWS credential unavailable in test env | High | Medium | Use mock credential files |
| Kiro AI API rate limiting during E2E | Medium | Low | Mock upstream in E2E-API tests |
| Streaming timing flaky in CI | Medium | Medium | Use relaxed timing assertions (100ms buffer) |
| Cross-platform path differences | Low | Medium | Use path.join() in tests |

---

## 5. Test Schedule

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| PBT + UT | 1 hour | Code exists |
| IT | 1 hour | UT pass |
| E2E-API | 30 min | IT pass |
| E2E-UI + SIT | Manual | E2E-API pass |

