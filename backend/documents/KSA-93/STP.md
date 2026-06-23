# Software Test Plan (STP)

## KB Web Viewer — KSA-93: UX Improvement & Zero-Training User Guide

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-93 |
| Title | UX Improvement & Zero-Training User Guide for KB Web Viewer |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-01-28 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-93.docx |
| Related FSD | FSD-v1-KSA-93.docx |
| Related TDD | TDD-v1-KSA-93.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-28 | QA Agent | Initiate document — auto-generated from BRD, FSD, and TDD |

---

## 1. Introduction

### 1.1 Purpose

This test plan covers the UX Improvement & Zero-Training User Guide features for KB Web Viewer. The scope includes 7 features: Onboarding Tour, Contextual Tooltips, Smart Empty States, Actionable Recommendations, Graph Auto-Analysis, User Guide Integration, and UI Redesign.

### 1.2 Test Objectives

- Verify all 7 features function correctly per FSD use cases (UC-01 through UC-06)
- Validate 30 business rules (BR-01 through BR-30) are enforced
- Ensure non-functional requirements (performance, accessibility, code quality) are met
- Confirm progressive enhancement — UX features never break existing functionality
- Verify client-side persistence (localStorage) works correctly

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-93.docx |
| FSD | FSD-v1-KSA-93.docx |
| TDD | TDD-v1-KSA-93.docx |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Automation | Tools |
|-------|-------|------------|-------|
| UT | Individual JS modules (tour.js, tooltips.js, etc.) | Automated | Jest (jsdom) |
| IT | API integration (Python endpoints) | Automated | pytest + httpx |
| E2E-UI | Browser UI E2E (full user flows) | Automated | Playwright |
| SIT | Manual exploratory / visual verification | Manual | Browser (Chrome) |

### 2.2 Test Types

| Type | Description | Applicable |
|------|-------------|------------|
| Functional Testing | Verify features work per FSD use cases | Yes |
| UI/UX Testing | Verify tooltips, tour, empty states render correctly | Yes |
| Performance Testing | Verify rendering times (< 100ms tooltip, < 2s analysis) | Yes |
| Accessibility Testing | WCAG 2.1 AA, keyboard navigation, ARIA labels | Yes |
| Compatibility Testing | Chrome/Firefox/Edge last 2 versions | Yes |
| Regression Testing | Existing viewer features still work | Yes |

### 2.3 Test Approach

- **Risk-based prioritization**: MUST HAVE features (Tour, Tooltips, Empty States) tested first
- **Progressive**: Each feature tested independently, then integration between features
- **Client-side focus**: Most testing is browser-based (E2E-UI and SIT)
- **API testing**: 3 new endpoints tested via IT level

### 2.4 Entry/Exit Criteria

| Level | Entry Criteria | Exit Criteria |
|-------|---------------|--------------|
| UT | JS modules implemented, Jest configured | 100% pass, ≥80% branch coverage |
| IT | API endpoints deployed to test server | All API contracts verified, 0 failures |
| E2E-UI | All features deployed, test env stable | 100% executed, 0 Critical defects |
| SIT | E2E-UI passed, visual review needed | All visual/UX scenarios verified |

### 2.5 Test Cases Summary

| Level | Count | Automated | Manual |
|-------|-------|-----------|--------|
| UT | 8 | 8 | 0 |
| IT | 5 | 5 | 0 |
| E2E-UI | 12 | 12 | 0 |
| SIT | 6 | 0 | 6 |
| **Total** | **31** | **25 (81%)** | **6 (19%)** |

---

## 3. Test Scope

### 3.1 Features In Scope

| # | Feature / Story | Priority | FSD Reference | Test Type |
|---|----------------|----------|---------------|-----------|
| 1 | Onboarding Tour | MUST HAVE | UC-01, BR-01–BR-04 | Functional, UI, E2E |
| 2 | Contextual Tooltips | MUST HAVE | UC-02, BR-05–BR-08 | Functional, UI, E2E |
| 3 | Smart Empty States | MUST HAVE | UC-03, BR-09–BR-11 | Functional, UI, E2E |
| 4 | Actionable Recommendations | SHOULD HAVE | UC-04, BR-12–BR-15 | Functional, Integration, E2E |
| 5 | Graph Auto-Analysis | SHOULD HAVE | UC-05, BR-16–BR-20 | Functional, Performance, E2E |
| 6 | User Guide Integration | SHOULD HAVE | UC-06, BR-21–BR-24 | Functional, UI, E2E |
| 7 | UI Redesign for Clarity | SHOULD HAVE | BR-25–BR-30 | UI, Visual, Accessibility |

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | Backend API refactoring | BRD explicitly excludes |
| 2 | Mobile-native app | Out of scope per BRD |
| 3 | Multi-language/i18n | Out of scope per BRD |
| 4 | Light theme | Dark theme only per constraints |
| 5 | 3D graph rendering performance | Out of scope per BRD |

---

## 4. Test Environment

### 4.1 Environment Requirements

| Environment | URL | Purpose |
|-------------|-----|---------|
| Local Dev | http://localhost:3201 | Development + SIT testing |
| CI | GitHub Actions | Automated UT + IT |

### 4.2 Browser Requirements

| Browser | Version | Required |
|---------|---------|----------|
| Chrome | Last 2 versions | Yes |
| Firefox | Last 2 versions | Yes |
| Edge | Last 2 versions | Yes |

### 4.3 Test Data Requirements

| Data Type | Description | Preparation |
|-----------|-------------|-------------|
| Empty KB | 0 entries, 0 tags, 0 relationships | Fresh server start |
| Populated KB | 50+ entries with varied quality scores | Seed via API |
| Large Graph | 500 nodes, 1000+ edges | Seed via API |
| Stale entries | Entries with updated_at > 90 days ago | Seed with old timestamps |

### 4.4 External Dependencies

| System | Dependency | Mock Available |
|--------|-----------|----------------|
| KB API | Existing /api/kb/* endpoints | No (use real server) |
| localStorage | Browser Web Storage | Yes (jsdom for UT) |

---

## 5. Test Schedule

| Phase | Duration | Milestone |
|-------|----------|-----------|
| Test Planning | 1 day | STP + STC approved |
| UT + IT Execution | 2 days | Automated tests pass |
| E2E-UI Execution | 2 days | All E2E scenarios pass |
| SIT (Manual) | 1 day | Visual/UX verified |
| Defect Fix & Retest | 2 days | All Critical/Major fixed |

---

## 6. Resources & Responsibilities

| Role | Responsibility |
|------|---------------|
| QA Agent | Test planning, case design, execution, reporting |
| Developer | Bug fixing, unit test coverage |
| BA Agent | Acceptance criteria clarification |

---

## 7. Risk & Mitigation

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 1 | localStorage unavailable in test env | Medium | Test graceful degradation path |
| 2 | Graph analysis timeout on large datasets | Medium | Test with 500-node boundary |
| 3 | Tour/tooltip CSS conflicts with existing styles | High | Visual regression testing |
| 4 | API endpoints not ready for IT | Medium | Mock server fallback |

---

## 8. Defect Management

### 8.1 Severity Levels

| Severity | Definition |
|----------|-----------|
| Critical | Feature completely broken, no workaround |
| Major | Feature partially broken, workaround exists |
| Minor | UI cosmetic issue, doesn't block functionality |
| Trivial | Typo, minor alignment |

### 8.2 Priority & SLA

| Priority | SLA |
|----------|-----|
| P1 | 4 hours |
| P2 | 1 business day |
| P3 | 3 business days |
| P4 | Next release |

---

## 9. Test Metrics

| Metric | Target |
|--------|--------|
| Test Execution Rate | 100% |
| Pass Rate | ≥ 95% |
| Critical Defect Count | 0 |
| Automation Coverage | ≥ 80% |

