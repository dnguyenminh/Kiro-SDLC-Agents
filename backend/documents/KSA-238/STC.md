# Software Test Cases (STC)

## Kiro SDLC Agents — KSA-238: LangGraph Workflow Visualization Panel

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-238 |
| Title | LangGraph Workflow Visualization Panel |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-06-17 |
| Status | Final |
| Related STP | STP-v1-KSA-238.docx |

---

## 1. PBT — Property-Based Tests

| ID | Property | Generator | Assertions |
|----|----------|-----------|------------|
| PBT-01 | No overlapping node bounding boxes | Random node count (5-50) | All pairs: no rect intersection |
| PBT-02 | All edges connect valid nodes | Random graph structure | edge.source and edge.target exist in nodes |
| PBT-03 | Layout dimensions positive | Random graph | width > 0, height > 0, all x/y >= 0 |
| PBT-04 | DAG topological order preserved | Random DAG | y(source) < y(target) for all edges |

---

## 2. UT — Unit Tests

| ID | Component | Test | Expected |
|----|-----------|------|----------|
| TC-01 | GraphData | SDLC_GRAPH_DEFINITION has all nodes | 7+ nodes (BA, TA, SA, QA, DEV, DevOps, SM) |
| TC-02 | GraphData | All edges reference valid node IDs | No dangling edges |
| TC-03 | GraphData | Node metadata complete | Each node has id, label, type, description |
| TC-04 | DagreLayout | Layout computation succeeds | No errors, all nodes have x/y |
| TC-05 | DagreLayout | Node separation respected | Min distance between nodes >= configured sep |
| TC-06 | DagreLayout | Edge routing computed | All edges have points array |
| TC-07 | WorkflowPanel | Panel creates webview | webview.html contains graph container |
| TC-08 | WorkflowPanel | Panel sends graph data | postMessage called with graph payload |
| TC-09 | WorkflowPanel | Panel dispose cleanup | No memory leaks, listeners removed |
| TC-10 | ZoomHandler | Zoom in | Transform scale increases |
| TC-11 | ZoomHandler | Zoom out with limit | Scale >= minZoom (0.1) |
| TC-12 | NodeInteraction | Click node | Node highlighted, connected edges highlighted |
| TC-13 | NodeInteraction | Click background | All highlights cleared |
| TC-14 | ThemeAdapter | Dark theme | Correct color palette applied |
| TC-15 | ThemeAdapter | Light theme | Correct color palette applied |
| TC-16 | ThemeAdapter | High contrast | Borders thickened, contrast colors |
| TC-17 | ResizeHandler | Panel width decreases | Graph scales to fit |
| TC-18 | ResizeHandler | Panel width increases | Graph re-centers |
| TC-19 | KeyboardNav | Tab between nodes | Focus moves to next node |
| TC-20 | KeyboardNav | Enter on focused node | Node selected/highlighted |

---

## 3. IT — Integration Tests

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| TC-21 | Panel open renders graph | 1. Create panel 2. Verify SVG in DOM | SVG with nodes and edges |
| TC-22 | Theme change re-renders | 1. Render 2. Change theme 3. Verify colors | Colors match new theme |
| TC-23 | Panel resize triggers relayout | 1. Render 2. Resize 3. Verify positions | Positions updated |
| TC-24 | Node click posts message | 1. Click node 2. Verify message sent | nodeSelected message to host |

---

## 4. E2E-UI — Manual Tests

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| E2E-01 | Open workflow panel | Cmd+Shift+P > Show Workflow | Graph renders with all SDLC nodes |
| E2E-02 | Zoom with scroll | Mouse wheel | Graph zooms smoothly |
| E2E-03 | Pan with drag | Click+drag background | Graph pans |
| E2E-04 | Click node | Click a node | Node highlights, tooltip shows |
| E2E-05 | Theme switch | Change VS Code theme | Graph colors update |

---

## 5. SIT — Manual

| ID | Scenario | Type |
|----|----------|------|
| SIT-01 | Graph visual quality in dark theme | Visual |
| SIT-02 | Graph visual quality in light theme | Visual |
| SIT-03 | Large graph performance (50+ nodes) | Performance |
| SIT-04 | Screen reader announces node info | A11y |
