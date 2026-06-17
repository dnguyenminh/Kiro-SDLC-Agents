# Software Test Plan (STP)

## KB Graph Viewer — KSA-291: KB Graph LOD: Collapse không hoạt động khi zoom out

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-291 |
| Title | KB Graph LOD: Collapse không hoạt động khi zoom out |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-06-14 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-291.docx |
| Related FSD | FSD-v1-KSA-291.docx |
| Related TDD | TDD-v1-KSA-291.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-14 | QA Agent | Initial test plan |

---

## 1. Introduction

### 1.1 Purpose

This document defines the test strategy for verifying the bug fix in KSA-291 — LOD collapse not triggering when user zooms out from an expanded cluster. The fix modifies `_checkDistances()`, `_freeBudget()`, and adds `_getExpandedCentroid()` in `shared/viewer/lod-manager.js`.

### 1.2 Scope

- Unit tests for `_getExpandedCentroid()` method
- Unit tests for modified `_checkDistances()` logic
- Unit tests for modified `_freeBudget()` logic
- Integration test: expand then drift then zoom out then collapse triggers
- Regression: expand behavior remains unchanged

### 1.3 Test Strategy Summary

| Level | Test Count | Automation | Tool |
|-------|-----------|------------|------|
| PBT (Property-Based Testing) | 2 | 100% Auto | fast-check |
| UT (Unit Test) | 8 | 100% Auto | vitest |
| IT (Integration Test) | 3 | 100% Auto | vitest |
| E2E-API | N/A | N/A | N/A (no API — frontend only) |
| E2E-UI | 2 | Manual | Browser visual test |
| SIT (System Integration) | 1 | Manual | Browser visual test |

**Total: 16 test cases (13 automated, 3 manual)**

---

## 2. Test Levels

### 2.1 PBT — Property-Based Testing

| ID | Property | Input Generator | Oracle |
|----|----------|-----------------|--------|
| PBT-1 | Centroid is always within bounding box of child nodes | Random array of 1-50 nodes with x,y,z in [-1000, 1000] | centroid.x between min(child.x) and max(child.x), same for y, z |
| PBT-2 | Distance from camera to centroid >= 0 for any position | Random camera + random nodes | dist >= 0, always a number (not NaN) |

### 2.2 UT — Unit Tests

| ID | Target | Description | Input | Expected |
|----|--------|-------------|-------|----------|
| UT-1 | _getExpandedCentroid | Returns correct average for 3 nodes | nodes at (0,0,0), (10,0,0), (20,0,0) | { x: 10, y: 0, z: 0 } |
| UT-2 | _getExpandedCentroid | Returns cluster.center when no children | empty childNodeIds | cluster.center value |
| UT-3 | _getExpandedCentroid | Handles undefined node positions | nodes with x=undefined | Uses 0 for undefined |
| UT-4 | _getExpandedCentroid | Single node returns that node position | 1 node at (5, 10, 15) | { x: 5, y: 10, z: 15 } |
| UT-5 | _checkDistances | EXPANDED cluster uses dynamic centroid | cluster EXPANDED, children drifted far | collapseCluster called |
| UT-6 | _checkDistances | COLLAPSED cluster still uses cluster.center | cluster COLLAPSED, cam near center | expandCluster called |
| UT-7 | _checkDistances | Skips animating clusters | cluster EXPANDING | No action |
| UT-8 | _freeBudget | Sorts by dynamic centroid, collapses farthest first | 3 clusters at different drifted positions | Farthest collapsed first |

### 2.3 IT — Integration Tests

| ID | Scenario | Setup | Verification |
|----|----------|-------|--------------|
| IT-1 | Expand then drift then zoom out then collapse | Create LODManager, expand cluster, move child nodes, move camera far | cluster.state becomes COLLAPSED |
| IT-2 | Budget enforcement with drifted clusters | 3 expanded clusters, exceed budget | Farthest (by centroid) collapsed |
| IT-3 | Expand still works with fixed center | Move camera close to collapsed cluster | expandCluster triggered correctly |

### 2.4 E2E-API

Not applicable — this is a pure frontend fix with no API endpoints.

### 2.5 E2E-UI (Manual)

| ID | Scenario | Steps | Expected Result |
|----|----------|-------|-----------------|
| E2E-UI-1 | Visual collapse on zoom out | 1. Load KB Graph with LOD enabled. 2. Zoom into a cluster (it expands). 3. Wait for force sim to settle. 4. Zoom out past threshold. | Cluster collapses, super-node reappears |
| E2E-UI-2 | Budget enforcement visual | 1. Expand multiple clusters. 2. Try expanding one more when at budget. | Farthest cluster auto-collapses, new one expands |

### 2.6 SIT — System Integration Test (Manual)

| ID | Scenario | Steps | Expected Result |
|----|----------|-------|-----------------|
| SIT-1 | Full LOD lifecycle in production-like graph | 1. Load real KB data (100+ nodes). 2. Navigate graph, expand/collapse multiple clusters. 3. Verify no stuck expanded clusters. 4. Verify performance stays smooth. | All clusters collapse/expand correctly, no stuck states, 60fps maintained |

---

## 3. Requirements Traceability Matrix (RTM)

| Requirement (BRD) | UC (FSD) | BR (FSD) | Test Cases |
|-------------------|----------|----------|------------|
| STORY 1: Collapse triggers on zoom out | UC-1 | BR-2, BR-3 | UT-5, IT-1, E2E-UI-1 |
| STORY 2: Dynamic centroid tracks positions | UC-1, UC-3 | BR-2, BR-3, BR-8 | PBT-1, PBT-2, UT-1, UT-2, UT-3, UT-4 |
| STORY 3: Budget uses correct distances | UC-2 | BR-7 | UT-8, IT-2, E2E-UI-2 |
| AC: Collapsed still uses fixed center | UC-3 | BR-1 | UT-6, IT-3 |
| AC: Skip animating clusters | UC-1 Alt B | BR-4 | UT-7 |
| AC: Fallback when no children | UC-1 Exception E1 | BR-8 | UT-2 |

**RTM Coverage: 100%** — All BRD user stories and FSD use cases have corresponding test cases.

---

## 4. Test Environment

| Component | Specification |
|-----------|---------------|
| OS | Windows 10/11, macOS 13+ |
| Browser | Chrome 90+, Firefox 88+ |
| Node.js | v18+ (for vitest) |
| Test Runner | vitest |
| PBT Library | fast-check |
| Mocking | vitest built-in mocks |

---

## 5. Entry / Exit Criteria

### Entry Criteria
- Code fix implemented in `shared/viewer/lod-manager.js`
- All unit tests written and executable
- Dev environment functional

### Exit Criteria
- All UT and IT tests PASS (13/13)
- PBT passes 1000 iterations without failure
- Manual E2E-UI tests PASS (2/2)
- SIT test PASS (1/1)
- No regression in expand behavior

---

## 6. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Force simulation behavior hard to mock | Medium | Use deterministic node positions in tests |
| Oscillation between expand/collapse | High | Test with positions near threshold boundary |
| Performance regression with many clusters | Low | PBT tests with 50-node clusters verify O(n) |

---

## 7. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |
