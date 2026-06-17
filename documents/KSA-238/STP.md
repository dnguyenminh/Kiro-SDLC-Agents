# Software Test Plan (STP)

## Kiro SDLC Agents — KSA-238: LangGraph Workflow Visualization Panel

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-238 |
| Title | LangGraph Workflow Visualization Panel - D3.js + dagre interactive graph |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-06-17 |
| Status | Final |
| Related BRD | BRD-v1-KSA-238.docx |
| Related FSD | FSD-v1-KSA-238.docx |
| Related TDD | TDD-v1-KSA-238.docx |

---

## 1. Introduction

### 1.1 Purpose

Test plan for the LangGraph Workflow Visualization Panel featuring D3.js + dagre interactive graph rendering within a VS Code webview.

### 1.2 Scope

- Graph data generation from static workflow definition
- dagre layout computation
- D3.js SVG rendering
- Node/edge interaction (click, hover, zoom, pan)
- Theme compatibility (dark/light/high-contrast)
- Accessibility (keyboard navigation, screen reader)

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Automation | Tools |
|-------|-------|-----------|-------|
| PBT | Graph layout properties, node positioning | 100% | fast-check |
| UT | WorkflowPanel, graph-data, dagre layout | 100% | Vitest |
| IT | postMessage communication, webview rendering | 100% | Vitest + jsdom |
| E2E-UI | Full panel interaction | Manual | VS Code Extension Host |
| SIT | Visual rendering, theme compat | Manual | Manual |

### 2.2 Entry/Exit Criteria

**Entry:** Code compiles, D3/dagre deps installed
**Exit:** All automated tests pass, graph renders correctly in all themes

---

## 3. Requirements Traceability Matrix (RTM)

| Requirement ID | Requirement | Test Case IDs |
|----------------|-------------|---------------|
| REQ-01 | Display SDLC workflow as DAG | TC-01, TC-02, TC-03 |
| REQ-02 | dagre layout (no overlapping nodes) | PBT-01, PBT-02, TC-04 |
| REQ-03 | Interactive zoom/pan | TC-10, TC-11 |
| REQ-04 | Node click highlights path | TC-12, TC-13 |
| REQ-05 | Theme-aware colors | TC-14, TC-15, TC-16 |
| REQ-06 | Responsive to panel resize | TC-17, TC-18 |
| REQ-07 | Keyboard navigation between nodes | TC-19, TC-20 |

---

## 4. Test Environment

| Component | Specification |
|-----------|--------------|
| Runtime | Node.js 20.x |
| Framework | Vitest 2.1.9 |
| DOM | jsdom 25.0 |
| PBT | fast-check 3.23 |
| D3.js | 7.x (test with actual library) |
| dagre | 0.8.x |
