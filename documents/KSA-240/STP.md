# Software Test Plan (STP)

## FEC CR Builder — KSA-240: Chat Panel UI: Context Window Usage Icon + Conversation Tabs

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-240 |
| Title | Chat Panel UI: Context Window Usage Icon + Conversation Tabs |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-06-17 |
| Status | Final |
| Related BRD | BRD-v1-KSA-240.docx |
| Related FSD | FSD-v1-KSA-240.docx |
| Related TDD | TDD-v1-KSA-240.docx |

---

## 1. Introduction

### 1.1 Purpose

This test plan covers verification of the Context Window Usage Icon and Conversation Tabs features in the Chat Panel webview.

### 1.2 Scope

- Context Window Usage Icon (token counter UI, color thresholds, tooltip)
- Conversation Tabs (create, switch, close, rename, state persistence)
- Communication between webview and extension host

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Automation | Tools |
|-------|-------|-----------|-------|
| PBT | Token counter calculations, tab state transitions | 100% | fast-check |
| UT | Individual components (TokenCounter, ConversationManager, TabRenderer) | 100% | Vitest |
| IT | Webview-host message passing, state synchronization | 100% | Vitest + jsdom |
| E2E-API | N/A (no backend API) | — | — |
| E2E-UI | Full panel interaction flows | Manual | VS Code Extension Host |
| SIT | Visual regression, UX validation | Manual | Manual testing |

### 2.2 Entry/Exit Criteria

**Entry:** Code compiles, unit tests framework configured
**Exit:** All automated tests pass, no Critical/High defects open

---

## 3. Test Coverage Summary

| Requirement | Test Cases | Coverage |
|-------------|-----------|----------|
| Token usage icon display | TC-01 to TC-05 | 100% |
| Token color thresholds | TC-06 to TC-10 | 100% |
| Conversation tab create | TC-11 to TC-14 | 100% |
| Conversation tab switch | TC-15 to TC-18 | 100% |
| Conversation tab close | TC-19 to TC-22 | 100% |
| Tab state persistence | TC-23 to TC-26 | 100% |
| postMessage communication | TC-27 to TC-30 | 100% |

---

## 4. Requirements Traceability Matrix (RTM)

| Requirement ID | Requirement | Test Case IDs |
|----------------|-------------|---------------|
| REQ-01 | Display token usage as icon with percentage | TC-01, TC-02, TC-03 |
| REQ-02 | Color changes at 50%, 75%, 90% thresholds | TC-06, TC-07, TC-08, TC-09, TC-10 |
| REQ-03 | Tooltip shows detailed token info | TC-04, TC-05 |
| REQ-04 | Create new conversation tab | TC-11, TC-12, TC-13, TC-14 |
| REQ-05 | Switch between conversation tabs | TC-15, TC-16, TC-17, TC-18 |
| REQ-06 | Close conversation tab with confirmation | TC-19, TC-20, TC-21, TC-22 |
| REQ-07 | Persist tab state across panel reload | TC-23, TC-24, TC-25, TC-26 |
| REQ-08 | Webview-host message protocol | TC-27, TC-28, TC-29, TC-30 |

---

## 5. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Token count accuracy varies by model | High | Test with multiple model configs |
| Tab state loss on crash | Medium | Test persistence after forced close |
| DOM memory leak with many tabs | Medium | PBT with rapid create/close cycles |

---

## 6. Test Environment

| Component | Specification |
|-----------|--------------|
| Runtime | Node.js 20.x |
| Framework | Vitest 2.1.9 |
| DOM | jsdom 25.0 |
| PBT | fast-check 3.23 |
| IDE | VS Code 1.90+ (E2E only) |
