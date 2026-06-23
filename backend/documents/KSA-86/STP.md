# Software Test Plan (STP)

## KB Web Viewer — KSA-86: Frontend HTML Update (Dashboard, Tags, Quality, Analytics Pages)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-86 |
| Title | Frontend HTML Update: Dashboard, Tags, Quality, Analytics Pages |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-01-27 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-86.docx |
| Related FSD | FSD-v1-KSA-86.docx |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | QA Agent – QA Engineer | Create document |
| Peer Reviewer | BA Agent – Business Analyst | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-27 | QA Agent | Initiate document — auto-generated from BRD and FSD |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm the test plan in this STP |
| | ☐ I agree and confirm the test plan in this STP |

---

## 1. Introduction

### 1.1 Purpose

This test plan defines the testing strategy, scope, schedule, and resources for verifying the 4 frontend HTML pages (Dashboard, Tags, Quality, Analytics) and shared Navigation component of the KB Web Viewer (port 3201). The pages are server-rendered Python HTML templates with client-side JavaScript for data fetching and Canvas-based charting.

### 1.2 Test Objectives

- Verify all 6 user stories from BRD are implemented correctly
- Validate UI components render data accurately from backend APIs
- Ensure responsive behavior across desktop and mobile viewports
- Verify Canvas chart rendering (gauges, bar charts, line charts)
- Validate XSS prevention for user-generated content
- Confirm error handling for API failures and empty data states
- Verify navigation consistency across all pages

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | documents/KSA-86/BRD.md |
| FSD | documents/KSA-86/FSD.md |
| Implementation | mcp-code-intelligence-python/src/mcp_code_intel/http/viewer_*.py |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Automation | Tools |
|-------|-------|------------|-------|
| UT | JavaScript function unit tests (esc(), color calc, size calc) | Automated | Jest / Vitest |
| IT | API endpoint integration (response format validation) | Automated | Python pytest + httpx |
| E2E-UI | Browser UI E2E (page load, interactions, rendering) | Automated | Playwright |
| SIT | Manual exploratory / visual verification | Manual | Browser (Chrome, Firefox, Edge) |

### 2.2 Test Types

| Type | Description | Applicable |
|------|-------------|------------|
| Functional Testing | Verify features work per FSD use cases | Yes |
| Regression Testing | Ensure Graph page and existing features not broken | Yes |
| Performance Testing | Verify page load < 2s, chart rendering speed | Yes |
| Security Testing | Verify XSS prevention, no script injection | Yes |
| Usability Testing | Verify UI/UX meets dark theme specifications | Yes |
| Compatibility Testing | Verify Chrome, Firefox, Edge rendering | Yes |
| Responsive Testing | Verify breakpoints and layout adaptation | Yes |

### 2.3 Test Approach

**Risk-Based Prioritization:**
- High Priority: Data rendering accuracy (gauges, charts, tables), XSS prevention
- Medium Priority: Responsive layout, empty states, error handling
- Low Priority: Visual polish, hover effects, animation smoothness

**Automation Strategy:**
- E2E-UI tests cover all CRUD-like interactions (click tag → search, verify table data)
- SIT reserved for visual/Canvas rendering verification requiring human judgment
- API integration tests validate response schemas before UI testing

### 2.4 Entry Criteria

| Level | Entry Criteria |
|-------|---------------|
| IT | Backend APIs deployed and returning valid JSON responses |
| E2E-UI | All 4 HTML pages served correctly on port 3201, IT tests passed |
| SIT | E2E-UI tests passed, pages accessible in browser, test data seeded |

### 2.5 Exit Criteria

| Level | Exit Criteria |
|-------|--------------|
| IT | 100% API endpoints return expected schema, 0 failures |
| E2E-UI | 100% test cases executed, 0 Critical defects, ≤2 Major defects |
| SIT | All visual/Canvas tests executed, no Critical defects, sign-off obtained |

---

### 2.6 Test Cases Summary

| Level | Count | Automated | Manual |
|-------|-------|-----------|--------|
| UT | 6 | 6 | 0 |
| IT | 7 | 7 | 0 |
| E2E-UI | 14 | 14 | 0 |
| SIT | 10 | 0 | 10 |
| **Total** | **37** | **27 (73%)** | **10 (27%)** |

---

## 3. Test Scope

### 3.1 Features In Scope

| # | Feature / Story | Priority | FSD Reference | Test Type |
|---|----------------|----------|---------------|-----------|
| 1 | Dashboard — Health Gauge, Metrics, Recommendations, Trends | High | FSD 3.2 | Functional, UI, Performance |
| 2 | Tags — Tag Cloud, Taxonomy Tree, Search by Tag | High | FSD 3.3 | Functional, UI, Security |
| 3 | Quality — Stats Cards, Distribution Chart, Low-Quality Table | High | FSD 3.4 | Functional, UI |
| 4 | Analytics — Trend Line, Popular Queries, Zero-Result Gaps | High | FSD 3.5 | Functional, UI, Responsive |
| 5 | Navigation — Tab Bar, Active State, Routing | High | FSD 3.1 | Functional, UI |
| 6 | Responsive Design — Breakpoints, Grid Adaptation | Medium | FSD 7 | Responsive, Compatibility |
| 7 | Error Handling — API Failures, Empty States | Medium | FSD 6 | Functional, Negative |
| 8 | XSS Prevention — HTML Escaping | High | FSD 6.2 | Security |

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | Backend API development | Already completed (KSA-82), tested separately |
| 2 | Graph visualization page | Pre-existing, not part of KSA-86 |
| 3 | Authentication/Authorization | Not required per BRD (internal tool) |
| 4 | Mobile native app | Out of scope per BRD |
| 5 | Data export (CSV/PDF) | Out of scope per BRD |
| 6 | Light mode theme | Not required (dark theme only) |

---

## 4. Test Environment

### 4.1 Environment Requirements

| Environment | URL | Purpose |
|-------------|-----|---------|
| Local Dev | http://localhost:3201 | Development and SIT testing |
| CI | GitHub Actions | Automated IT + E2E-UI tests |

### 4.2 Browser / Device Requirements

| Browser | Version | OS | Required |
|---------|---------|-----|----------|
| Chrome | 90+ | Windows/Mac/Linux | Yes |
| Firefox | 88+ | Windows/Mac/Linux | Yes |
| Edge | 90+ | Windows | Yes |
| Safari | 14+ | Mac | Nice to have |

### 4.3 Test Data Requirements

| Data Type | Description | Source | Preparation |
|-----------|-------------|--------|-------------|
| KB Entries | 50+ entries with varied quality scores | SQLite DB | Seed via API or direct DB insert |
| Tags | 30+ tags with taxonomy hierarchy | SQLite DB | Seed via mem_tags tool |
| Search History | 20+ search queries with varied result counts | SQLite DB | Seed via mem_search calls |
| Quality Scores | Entries with scores 0-100 (distribution) | SQLite DB | Seed via mem_scoring tool |

### 4.4 External Dependencies

| System | Dependency | Mock/Stub Available |
|--------|-----------|---------------------|
| SQLite Memory DB | KB data store | Yes — pre-seeded test database |
| Python HTTP Server | Page serving | No — must run actual server |
| Canvas API | Chart rendering | No — requires real browser |

---

## 5. Test Schedule

| Phase | Duration | Milestone |
|-------|----------|-----------|
| Test Planning | 1 day | STP + STC approved |
| Test Data Preparation | 0.5 day | Test data seeded in DB |
| IT Execution | 0.5 day | API schema validation complete |
| E2E-UI Execution | 1 day | Automated browser tests pass |
| SIT Execution | 1 day | Visual/Canvas verification complete |
| Defect Fix & Retest | 1 day | All Critical/Major fixed |
| Sign-off | 0.5 day | Test completion report |

---

## 6. Resources & Responsibilities

| Role | Name | Responsibility |
|------|------|---------------|
| Test Lead | QA Agent | Test planning, coordination, reporting |
| QA Engineer | QA Agent | Test case design, execution, defect reporting |
| BA | BA Agent | Acceptance criteria clarification |
| Developer | Dev Agent | Bug fixing, implementation |
| DevOps | DevOps Agent | CI pipeline, environment setup |

---

## 7. Risk & Mitigation

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | Canvas charts render differently across browsers | Medium | Medium | Test on Chrome, Firefox, Edge; use pixel tolerance |
| 2 | API response format changes break UI | High | Low | IT tests validate schema before E2E-UI |
| 3 | Large dataset (>1000 tags) causes performance issues | Low | Low | API limits responses (top 30 tags, top 20 entries) |
| 4 | Dark theme color contrast insufficient | Medium | Low | Verify contrast ratios meet WCAG AA |
| 5 | Responsive breakpoints not consistent | Medium | Medium | Test at exact 768px breakpoint |

---

## 8. Defect Management

### 8.1 Severity Levels

| Severity | Definition | Example |
|----------|-----------|---------|
| Critical | Page crash, data not displayed, XSS vulnerability | Script injection executes in tag cloud |
| Major | Feature not working, chart not rendering | Health gauge shows wrong score |
| Minor | UI misalignment, wrong color, truncation issue | Score bar color wrong at boundary |
| Trivial | Typo, minor spacing | Extra pixel gap between cards |

### 8.2 Priority Levels

| Priority | Definition | SLA (Fix Time) |
|----------|-----------|----------------|
| P1 | Must fix immediately (security, data corruption) | 4 hours |
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
| Defect Density | Defects / Test Cases | ≤ 0.1 |
| Critical Defect Count | Count of Critical severity | 0 |
| Automation Coverage | Automated / Total × 100% | ≥ 70% |

### 9.2 Reporting Schedule

| Report | Frequency | Audience |
|--------|-----------|----------|
| Daily Test Status | Daily during SIT | Project team |
| Defect Summary | Daily | Dev team |
| Test Completion Report | End of SIT | All stakeholders |

---

## 10. Appendix

### Glossary

| Term | Definition |
|------|------------|
| SIT | System Integration Testing |
| STP | Software Test Plan |
| STC | Software Test Cases |
| KB | Knowledge Base |
| XSS | Cross-Site Scripting |
| Canvas API | HTML5 2D drawing API for charts |

### Assumptions

- Backend APIs are stable and return correct JSON format
- Dark theme is the only theme (no light mode toggle needed)
- No authentication required (internal tool)
- Vanilla JS implementation (no framework-specific testing needed)
- Canvas charts tested visually (no pixel-perfect comparison)
