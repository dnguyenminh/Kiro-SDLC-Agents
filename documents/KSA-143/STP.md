# Software Test Plan (STP)

## KSA-143: KB Graph — Level of Detail (LOD) / Semantic Zoom

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-143 |
| Version | 2.0 |
| Date | 2026-05-29 |
| Related FSD | FSD-v2-KSA-143.docx |
| Related TDD | TDD-v2-KSA-143.docx |

---

## 1. Test Strategy

### 1.1 Scope

Test the LOD/Semantic Zoom feature across:
- 3 new JS modules in shared/viewer/
- Backend API changes on 3 servers (NodeJS, Python, Kotlin)
- Integration with ForceGraph3D in graph.js
- UI controls in index.html

### 1.2 Test Levels (6 Levels)

| Level | Scope | Automation |
|-------|-------|-----------|
| PBT (Property-Based) | Clustering invariants | 100% automated |
| UT (Unit Test) | Individual module functions | 100% automated |
| IT (Integration Test) | Module interactions, API | 100% automated |
| E2E-API | Backend endpoint with lod param | 100% automated |
| E2E-UI | Browser-based LOD interactions | 90% automated |
| SIT (System Integration) | Full stack visual verification | Manual |

### 1.3 Test Environment

| Component | Environment |
|-----------|------------|
| Browser | Chrome 120+, headless for automation |
| Backend | Local dev servers (NodeJS, Python, Kotlin) |
| Test Framework | Vitest (unit), Playwright (E2E) |
| PBT Framework | fast-check |

---

## 2. Requirements Traceability Matrix (RTM)

| Requirement | BRD Story | FSD UC | Test Cases |
|-------------|-----------|--------|-----------|
| Clustering at zoom-out | S1 | UC-01 | PBT-01..03, UT-01..05, IT-01 |
| Expand on zoom-in | S2 | UC-02 | UT-06..08, IT-02, E2E-UI-01 |
| Collapse on zoom-out | S3 | UC-03 | UT-09..11, IT-03, E2E-UI-02 |
| Node budget <= 100 | S4 | BR-10 | PBT-04, UT-12..14, IT-04 |
| Animation 400ms | S5 | Sec 5 | UT-15..17, E2E-UI-03 |
| Backend lod param | S6 | Sec 3.4 | E2E-API-01..04 |
| LOD toggle UI | - | Sec 6.2 | E2E-UI-04 |
| Hysteresis (BR-06) | - | BR-06 | PBT-05, UT-18 |
| Deterministic (BR-02) | - | BR-02 | PBT-06 |
| basePath URLs (BR-12) | - | BR-12 | IT-05, E2E-API-05 |

---

## 3. Test Cases Summary

### 3.1 PBT (Property-Based Testing) — 6 cases

| ID | Property | Generator |
|----|----------|-----------|
| PBT-01 | All nodes assigned to exactly 1 cluster | Random graphs 10-5000 nodes |
| PBT-02 | Cluster size within [5, 50] | Random graphs |
| PBT-03 | Isolated nodes never clustered | Graphs with 0-edge nodes |
| PBT-04 | Visible nodes never exceed budget | Random expand sequences |
| PBT-05 | Hysteresis prevents oscillation | Camera distance sequences |
| PBT-06 | Same input = same clusters | Repeated runs |

### 3.2 UT (Unit Tests) — 18 cases

| ID | Module | Test |
|----|--------|------|
| UT-01 | clustering | Empty graph returns 0 clusters |
| UT-02 | clustering | Single node returns 0 clusters |
| UT-03 | clustering | 5 connected nodes = 1 cluster |
| UT-04 | clustering | 100 nodes, 2 communities = 2 clusters |
| UT-05 | clustering | Respects maxClusterSize (splits) |
| UT-06 | manager | expandCluster changes state to EXPANDING |
| UT-07 | manager | Budget check rejects when full |
| UT-08 | manager | Budget overflow collapses farthest |
| UT-09 | manager | collapseCluster changes state to COLLAPSING |
| UT-10 | manager | Interaction lock prevents collapse |
| UT-11 | manager | dispose() cancels rAF |
| UT-12 | manager | getVisibleNodeCount accurate |
| UT-13 | manager | setConfig updates thresholds |
| UT-14 | manager | Skip LOD when < 100 nodes |
| UT-15 | animation | Expand completes in 400ms |
| UT-16 | animation | Collapse completes in 400ms |
| UT-17 | animation | Cancel mid-animation works |
| UT-18 | manager | Hysteresis: no collapse at expand+10 |

### 3.3 IT (Integration Tests) — 5 cases

| ID | Test | Components |
|----|------|-----------|
| IT-01 | LODManager initializes with ForceGraph3D mock | manager + clustering |
| IT-02 | Expand updates ForceGraph3D graphData | manager + animation + graph |
| IT-03 | Collapse restores super nodes | manager + animation + graph |
| IT-04 | Budget enforced across multiple expands | manager + clustering |
| IT-05 | API URL uses basePath (no absolute) | graph.js + LOD init |

### 3.4 E2E-API (Endpoint Tests) — 5 cases

| ID | Endpoint | Test |
|----|----------|------|
| E2E-API-01 | GET /api/memory/graph/data?lod=true | Returns totalNodes, totalEdges |
| E2E-API-02 | GET /api/memory/graph/data?lod=true&limit=5000 | Respects limit |
| E2E-API-03 | GET /api/memory/graph/data (no lod) | No totalNodes field |
| E2E-API-04 | GET /api/memory/graph/data?lod=invalid | Treats as false |
| E2E-API-05 | Endpoint via basePath | Works under sub-path deploy |

### 3.5 E2E-UI (Browser Tests) — 4 cases

| ID | Scenario | Automation |
|----|----------|-----------|
| E2E-UI-01 | Load graph > 100 nodes, verify clusters appear | Playwright |
| E2E-UI-02 | Zoom in to cluster, verify expand animation | Playwright |
| E2E-UI-03 | Zoom out, verify collapse | Playwright |
| E2E-UI-04 | Toggle LOD off, verify all nodes render | Playwright |

### 3.6 SIT (System Integration) — 3 cases (Manual)

| ID | Scenario | Verification |
|----|----------|-------------|
| SIT-01 | Visual: super node appearance correct | Manual inspection |
| SIT-02 | Visual: animation smoothness (no jank) | Manual 60fps check |
| SIT-03 | Visual: orbital layout looks natural | Manual inspection |

---

## 4. Test Data

### 4.1 Graph Fixtures

| Fixture | Nodes | Edges | Purpose |
|---------|-------|-------|---------|
| small-graph.json | 50 | 80 | Below LOD threshold |
| medium-graph.json | 200 | 500 | Standard LOD scenario |
| large-graph.json | 5000 | 12000 | Performance testing |
| disconnected-graph.json | 100 | 30 | Isolated nodes test |
| two-communities.json | 100 | 200 | Clear 2-cluster case |

---

## 5. Pass/Fail Criteria

| Level | Pass Criteria |
|-------|--------------|
| PBT | All properties hold for 1000 random inputs |
| UT | 100% pass |
| IT | 100% pass |
| E2E-API | All 5 cases pass on all 3 servers |
| E2E-UI | All 4 cases pass |
| SIT | No critical visual defects |

---

## 6. Risks

| Risk | Mitigation |
|------|-----------|
| ForceGraph3D API changes | Pin version, mock in tests |
| Flaky animation timing | Use tolerance (+-50ms) |
| Browser differences | Test Chrome only (primary target) |

---
