# Software Test Plan (STP)

## FEC CR Builder — KSA-254: Chat Panel: Slash Command Menu

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-254 |
| Title | Chat Panel: Slash Command Menu (Agents + Steering Rules) |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-06-15 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-254.docx |
| Related FSD | FSD-v1-KSA-254.docx |
| Related TDD | TDD-v1-KSA-254.docx |

---

## 1. Introduction

### 1.1 Purpose

This test plan covers the Slash Command Menu (`/` trigger) for the Chat Panel webview. The feature provides inline agent selection and steering rule attachment via a two-section popup triggered by the `/` character.

### 1.2 Test Objectives

- Verify all 7 user stories from BRD
- Validate all 31 business rules (BR-01 through BR-31)
- Verify state machine transitions (CLOSED / OPEN / FILTERING)
- Ensure two-section popup rendering (Agents + Steering)
- Confirm filter behavior across both sections (case-insensitive, substring)
- Validate keyboard navigation crossing section boundaries
- Confirm agent selection inserts `/agent-name ` prefix
- Confirm steering selection adds context chip
- Verify accessibility (ARIA, keyboard-only operation)
- Confirm performance targets (popup < 50ms, filter < 16ms)

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-254.docx |
| FSD | FSD-v1-KSA-254.docx |
| TDD | TDD-v1-KSA-254.docx |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | ID Prefix | Scope | Tools | Automation |
|-------|-----------|-------|-------|------------|
| Property-Based Testing (PBT) | PBT-01..12 | Filter invariants, state machine properties, trigger detection | vitest + fast-check | 100% automated |
| Unit Testing (UT) | UT-01..30 | SlashMenuItems, SlashMenuController state, trigger detection | vitest | 100% automated |
| Integration Testing (IT) | IT-01..15 | Controller+View DOM, keyboard nav, selection callbacks | vitest + jsdom | 100% automated |
| E2E-API | N/A | No backend API (webview-only feature) | N/A | N/A |
| E2E-UI | E2E-01..06 | Full popup lifecycle in VS Code extension host | Manual in VS Code | Manual |
| SIT | SIT-01..04 | Visual consistency, cross-theme, accessibility | Manual + axe | Manual |

### 2.2 Test Approach

- **PBT**: Verify algebraic properties of filter function (subset, case-insensitive, bounded) and state machine (reachability, stability, determinism)
- **UT**: Cover individual functions in isolation (agents data, steering parsing, filter logic, trigger detection, state transitions)
- **IT**: Test Controller+View together in jsdom — verify DOM manipulation, keyboard events, callback invocations
- **E2E-UI**: Manual testing in running VS Code with the extension loaded
- **SIT**: Visual inspection across light/dark themes, accessibility audit

### 2.3 Entry Criteria

| Level | Entry Criteria |
|-------|---------------|
| PBT/UT | Source code committed to feature branch |
| IT | SlashMenuController + SlashMenuView compiled |
| E2E-UI | Extension packaged as VSIX and installed |
| SIT | All automated tests pass |

### 2.4 Exit Criteria

| Level | Exit Criteria |
|-------|---------------|
| PBT | All 12 properties hold (200-1000 runs each) |
| UT | 30/30 tests pass |
| IT | 15/15 tests pass |
| E2E-UI | 6/6 scenarios pass |
| SIT | 0 Critical, <=1 Minor visual issue |

---

## 3. Test Case Summary

| Level | Count | Automated | Manual |
|-------|-------|-----------|--------|
| PBT | 12 | 12 | 0 |
| UT | 30 | 30 | 0 |
| IT | 15 | 15 | 0 |
| E2E-UI | 6 | 0 | 6 |
| SIT | 4 | 0 | 4 |
| **Total** | **67** | **57** | **10** |

---

## 4. Requirements Traceability Matrix (RTM)

| Requirement | BRD Story | Business Rules | PBT | UT | IT | E2E-UI | SIT |
|-------------|-----------|----------------|-----|----|----|--------|-----|
| Trigger Detection | Story 1 | BR-01..BR-05 | PBT-10..12 | UT-24..30 | IT-01..02 | E2E-01 | — |
| Two-Section Display | Story 2,3 | BR-06..BR-11 | — | UT-01..07 | IT-03..05 | E2E-02 | SIT-01 |
| Type-Ahead Filter | Story 4 | BR-12..BR-17 | PBT-01..05 | UT-08..15 | IT-06..08 | E2E-03 | — |
| Keyboard Navigation | Story 5 | BR-18..BR-23 | PBT-06..09 | UT-16..23 | IT-09..11 | E2E-04 | SIT-02 |
| Agent Selection | Story 6 | BR-24..BR-27 | — | — | IT-12..13 | E2E-05 | — |
| Steering Selection | Story 7 | BR-28..BR-31 | — | — | IT-14..15 | E2E-06 | — |
| Accessibility | NFR | ARIA, keyboard | — | — | IT-05 | — | SIT-03,04 |
| Performance | NFR | <50ms popup, <16ms filter | PBT-05 | — | — | — | — |

**RTM Coverage: 100%** — All 7 stories and 31 business rules mapped.

---

## 5. Test Environment

| Component | Details |
|-----------|---------|
| Runtime | Node.js 20+ (vitest), VS Code 1.90+ (E2E) |
| OS | Windows 11 |
| Frameworks | vitest 2.x, fast-check 3.x, jsdom 25.x |
| Test Data | Static agent list (6), mock steering rules (4) |

---

## 6. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| jsdom lacks scrollIntoView | Low | High | Mock in test setup |
| fast-check finds filter edge case | Medium | Low | Fix filter, add regression |
| Keyboard event simulation incomplete | Medium | Medium | Test both programmatic + E2E |
| DOM state leaks between tests | High | Low | Fresh DOM in beforeEach |

---

## 7. Test Schedule

| Phase | Duration | Status |
|-------|----------|--------|
| PBT + UT implementation | Done | Done |
| IT implementation | 0.5 day | Pending |
| Test execution (automated) | 0.5 day | Pending |
| E2E-UI manual | 0.5 day | Pending |
| SIT | 0.5 day | Pending |
