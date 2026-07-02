# Software Test Plan (STP)

## Kiro Chatbox — KSA-297: Internet/Network Tools

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-297 |
| Title | Internet/Network Tools (WebModule) — Test Plan |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-07-03 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-297.docx |
| Related FSD | FSD-v1-KSA-297.docx |
| Related TDD | TDD-v1-KSA-297.docx |
| Architecture Pattern | Plugin (Backend Module) |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-03 | QA Agent | Initial STP — 6 test levels, RTM, test strategy |

---

## 1. Test Scope

### 1.1 In Scope

- WebModule lifecycle (initialize, shutdown, tool registration)
- SSRF Guard — IP blocklist validation, DNS rebinding prevention, protocol enforcement
- Rate Limiter — Token bucket algorithm, per-tool limiting, reset timing
- Content Truncator — Size enforcement for responses
- FetchUrlHandler — HTTP fetch, 3 modes (full/truncated/selective), redirect following
- WebSearchHandler — SearXNG integration, fallback to DuckDuckGo, result parsing
- GitBrowseHandler — GitHub/GitLab API calls, tree listing, file reading, README
- DownloadFileHandler — Streaming download, size/extension validation, path safety
- ApiCallHandler — Multi-method HTTP calls, header/body handling
- ReadWebpageHandler — Playwright rendering, wait strategies, resource blocking
- URL Validator — Format validation, protocol checks
- HTML Extractor — HTML to text conversion, CSS selector extraction
- Git URL Parser — GitHub/GitLab URL parsing, owner/repo extraction
- Error handling and error codes (8 error types)
- Configuration loading and defaults
- MCP tool schema registration (6 tools in 'web' category)

### 1.2 Out of Scope

- MCP server/bridge transport layer (already tested)
- ModuleRegistry core (already tested)
- LangGraph agent tool selection logic
- External search engine availability/SLA
- Playwright browser installation
- Frontend chatbox UI

---

## 2. Test Strategy

### 2.1 Test Levels Overview

| Level | Abbreviation | Focus | Automation | Tools |
|-------|-------------|-------|------------|-------|
| Property-Based Testing | PBT | Algorithmic invariants (SSRF CIDR, rate limiter math, URL parsing) | 100% Automated | fast-check + Vitest |
| Unit Testing | UT | Individual classes/functions (SsrfGuard, RateLimiter, parsers, validators) | 100% Automated | Vitest |
| Integration Testing | IT | Handler + middleware pipeline, HTTP mock servers | 100% Automated | Vitest + msw (Mock Service Worker) |
| E2E-API Testing | E2E-API | Full MCP tool calls through WebModule (real HTTP to test servers) | 100% Automated | Vitest + local HTTP test server |
| E2E-UI Testing | E2E-UI | Not applicable (backend module, no UI) | N/A | N/A |
| System Integration Testing | SIT | Real external service calls (httpbin.org, GitHub API) | 30% Automated, 70% Manual | Manual verification + smoke tests |

### 2.2 Test Pyramid

```
         /   SIT   \         <- 8 cases (real external services, manual)
        / E2E-API   \        <- 24 cases (MCP protocol, real local server)
       / Integration \       <- 32 cases (handler pipelines with mocks)
      /     Unit      \      <- 48 cases (individual components)
     /      PBT        \     <- 12 cases (invariants)
```

**Total: 124 test cases**

### 2.3 Test Automation Strategy

| Level | % Automated | Reason |
|-------|------------|--------|
| PBT | 100% | Pure functions, mathematical properties |
| UT | 100% | Isolated, no external deps |
| IT | 100% | Mock HTTP servers via msw |
| E2E-API | 100% | Local test HTTP server + MCP call |
| SIT | 30% | External services may be rate-limited/unavailable |

**Overall: ~95% automated, ~5% manual**

### 2.4 Entry Criteria

| Level | Entry Criteria |
|-------|---------------|
| UT/PBT | Source code compiled without errors, dependencies installed |
| IT | All UT pass, mock servers configured |
| E2E-API | All IT pass, WebModule registered in test server, local HTTP echo server running |
| SIT | All E2E-API pass, internet connectivity available, GitHub API accessible |

### 2.5 Exit Criteria

| Level | Exit Criteria |
|-------|--------------|
| UT/PBT | 100% executed, 100% pass, >=90% line coverage for utilities |
| IT | 100% executed, 100% pass, all handlers exercised |
| E2E-API | 100% executed, >=95% pass (network flakiness tolerated) |
| SIT | All manual scenarios executed, no Critical defects |

---

## 3. Test Scope by Feature

### 3.1 Features In Scope

| # | Feature / Story | Priority | FSD Reference | Test Levels |
|---|----------------|----------|---------------|-------------|
| 1 | fetch_url — full/truncated/selective modes | High | UC-1, BR-3,5,6 | PBT, UT, IT, E2E-API |
| 2 | web_search — SearXNG + DuckDuckGo fallback | High | UC-2, BR-2,5 | UT, IT, E2E-API |
| 3 | git_clone_browse — tree/read_file/readme | Medium | UC-3, BR-2 | UT, IT, E2E-API, SIT |
| 4 | download_file — streaming, validation | Medium | UC-4, BR-4,8 | UT, IT, E2E-API |
| 5 | api_call — multi-method HTTP | High | UC-5, BR-1,2,3,5 | UT, IT, E2E-API |
| 6 | read_webpage — Playwright rendering | Low | UC-6, BR-9 | UT, IT, SIT |
| 7 | SSRF Protection | Critical | BR-1,7, Story 7 | PBT, UT, IT |
| 8 | Rate Limiting | High | BR-2, Story 8 | PBT, UT, IT |
| 9 | Content Truncation | Medium | BR-3,4 | UT, IT |
| 10 | Error Handling (8 error codes) | High | FSD Section 7 | UT, IT, E2E-API |

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | SearXNG deployment/config | DevOps responsibility |
| 2 | Playwright install | OS-level setup |
| 3 | MCP transport | Tested independently |
| 4 | Chatbox LangGraph tool selection | Separate module |

---

## 4. Test Environment

### 4.1 Environment Requirements

| Environment | Setup | Purpose |
|-------------|-------|---------|
| Local Dev | `npm run test` in backend/ | UT, PBT, IT |
| CI (GitHub Actions) | Docker + Node 18+ | Automated UT, IT, E2E-API |
| SIT | Local machine with internet | Manual SIT with real services |

### 4.2 Test Dependencies

| Dependency | Version | Purpose | Mock Available |
|-----------|---------|---------|----------------|
| Node.js | 18+ | Runtime | N/A |
| Vitest | latest | Test runner | N/A |
| fast-check | latest | Property-based testing | N/A |
| msw | 2.x | HTTP mock server | Yes (primary mock) |
| Playwright | latest | Browser for read_webpage | Yes (mock context) |
| httpbin.org | N/A | Echo server for SIT | Local echo server |

### 4.3 Test Data Requirements

| Data Type | Description | Source |
|-----------|-------------|--------|
| Valid URLs | Public HTTP(S) URLs for fetch tests | Hardcoded + local server |
| Internal IPs | SSRF test IPs (127.0.0.1, 10.x, 172.16.x, 192.168.x) | Hardcoded |
| Git repos | Public GitHub repos | github.com/octocat/Hello-World |
| Search queries | Various search terms | Hardcoded test data |
| Download files | Small test files (1KB-1MB) | Local HTTP server |
| Blocked extensions | .exe, .bat, .cmd, .ps1, .sh files | Generated in test |

### 4.4 External Dependencies

| System | Dependency | Mock Strategy |
|--------|-----------|---------------|
| SearXNG | Search API | msw mock returning JSON |
| GitHub API | REST API | msw mock returning tree/file data |
| GitLab API | REST API | msw mock returning tree/file data |
| Target URLs | Any public URL | Local HTTP test server |
| Playwright | Chromium | Mock browser context for IT |

---

## 5. Test Schedule

| Phase | Duration | Milestone |
|-------|----------|-----------|
| Test Planning (STP + STC) | 1 day | STP + STC approved |
| Test Implementation (PBT + UT) | 2 days | All UT/PBT passing |
| Test Implementation (IT + E2E) | 2 days | All IT/E2E passing |
| SIT Execution | 1 day | Manual scenarios completed |
| Defect Fix & Retest | 1 day | All Critical/Major fixed |

---

## 6. Risk & Mitigation

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | SearXNG not deployed for SIT | Medium | High | DuckDuckGo fallback; mock for automated |
| 2 | GitHub API rate limit (60/hr unauth) | Low | Medium | Use token in SIT; mock in automated |
| 3 | Playwright not in CI | Medium | Low | Skip read_webpage E2E in CI; test locally |
| 4 | Network flakiness in E2E-API | Low | Medium | Retry logic; separate from UT |
| 5 | DNS resolution varies | Low | Low | IP-based test URLs where possible |

---

## 7. Defect Management

### 7.1 Severity Levels

| Severity | Definition | Example |
|----------|-----------|---------|
| Critical | Security bypass, data exposure | SSRF guard bypassed |
| Major | Tool broken, wrong results | fetch_url returns empty |
| Minor | Edge case, cosmetic | Wrong error message text |
| Trivial | Non-functional | Log message typo |

### 7.2 Priority & SLA

| Priority | Definition | Fix Time |
|----------|-----------|----------|
| P1 | Security issue | 4 hours |
| P2 | Tool broken | 1 day |
| P3 | Minor issue | 3 days |
| P4 | Enhancement | Next sprint |

---

## 8. Test Metrics

| Metric | Formula | Target |
|--------|---------|--------|
| Test Execution Rate | Executed / Total x 100% | 100% |
| Pass Rate | Passed / Executed x 100% | >= 95% |
| Code Coverage (UT) | Lines covered / Total | >= 85% |
| SSRF Test Coverage | Vectors tested / Known vectors | 100% |
| Critical Defect Count | Count Critical severity | 0 |

---

## 9. Appendix

### Glossary

| Term | Definition |
|------|------------|
| SSRF | Server-Side Request Forgery |
| PBT | Property-Based Testing |
| MCP | Model Context Protocol |
| msw | Mock Service Worker |
| SIT | System Integration Testing |

### Assumptions

- Backend server can start and register WebModule without errors
- Playwright chromium binary available for read_webpage tests
- Node.js 18+ provides native fetch API
- Vitest is the project's standard test runner
