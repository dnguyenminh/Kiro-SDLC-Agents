# Software Test Cases (STC)

## KB Graph Viewer — KSA-291: KB Graph LOD: Collapse không hoạt động khi zoom out

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-291 |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-06-14 |
| Related STP | STP-v1-KSA-291.docx |

---

## 1. PBT Test Cases

### PBT-1: Centroid within bounding box

| Field | Value |
|-------|-------|
| ID | PBT-1 |
| Property | Centroid x,y,z is always within [min, max] of child node positions |
| Generator | Array of 1-50 objects with x,y,z as float(-1000,1000) |
| Oracle | min(nodes.x) <= centroid.x <= max(nodes.x), same for y and z |
| Iterations | 1000 |

### PBT-2: Distance always non-negative

| Field | Value |
|-------|-------|
| ID | PBT-2 |
| Property | distance(camera, centroid) >= 0 and is finite number |
| Generator | camera and nodes with random positions |
| Oracle | result >= 0 AND not NaN AND isFinite |
| Iterations | 1000 |

---

## 2. Unit Test Cases

### UT-1: Correct average for 3 nodes

| Field | Value |
|-------|-------|
| ID | UT-1 |
| Method | _getExpandedCentroid |
| Input | childNodes at (0,0,0), (10,0,0), (20,0,0) |
| Expected | { x: 10, y: 0, z: 0 } |
| Priority | High |

### UT-2: Fallback to cluster.center when no children

| Field | Value |
|-------|-------|
| ID | UT-2 |
| Method | _getExpandedCentroid |
| Input | cluster.childNodeIds = ['nonexistent'], cluster.center = { x: 5, y: 5, z: 5 } |
| Expected | { x: 5, y: 5, z: 5 } |
| Priority | High |

### UT-3: Handles undefined positions

| Field | Value |
|-------|-------|
| ID | UT-3 |
| Method | _getExpandedCentroid |
| Input | nodes: [{x:10, y:undefined, z:5}, {x:20, y:10, z:undefined}] |
| Expected | { x: 15, y: 5, z: 2.5 } |
| Priority | Medium |

### UT-4: Single node returns its position

| Field | Value |
|-------|-------|
| ID | UT-4 |
| Method | _getExpandedCentroid |
| Input | 1 node at (5, 10, 15) |
| Expected | { x: 5, y: 10, z: 15 } |
| Priority | Medium |

### UT-5: EXPANDED cluster uses dynamic centroid for collapse

| Field | Value |
|-------|-------|
| ID | UT-5 |
| Method | _checkDistances |
| Input | cluster.center=(10,0,0), children at (80,0,0),(100,0,0), camera at (0,0,0), collapseThreshold=50 |
| Expected | collapseCluster() IS called (centroid=(90,0,0), dist=90 > 50) |
| Priority | Critical |

### UT-6: COLLAPSED cluster uses fixed center for expand

| Field | Value |
|-------|-------|
| ID | UT-6 |
| Method | _checkDistances |
| Input | cluster.center=(10,0,0), camera at (12,0,0), expandThreshold=50 |
| Expected | expandCluster() IS called (dist=2 < 50) |
| Priority | High |

### UT-7: Animating clusters are skipped

| Field | Value |
|-------|-------|
| ID | UT-7 |
| Method | _checkDistances |
| Input | cluster in EXPANDING state, animation.isAnimating returns true |
| Expected | Neither expand nor collapse called |
| Priority | Medium |

### UT-8: _freeBudget sorts by dynamic centroid

| Field | Value |
|-------|-------|
| ID | UT-8 |
| Method | _freeBudget |
| Input | clusterA children at (10,0,0), clusterB at (50,0,0), clusterC at (200,0,0). Camera at (0,0,0) |
| Expected | clusterC collapsed first (farthest by centroid) |
| Priority | High |

---

## 3. Integration Test Cases

### IT-1: Full collapse lifecycle after drift

| Field | Value |
|-------|-------|
| ID | IT-1 |
| Setup | LODManager with 1 cluster of 10 nodes. expandThreshold=50, collapseThreshold=70 |
| Steps | 1. Expand cluster. 2. Drift children to (150..200,0,0). 3. Camera at (0,0,0). 4. _checkDistances() |
| Expected | Cluster collapses (centroid ~175, dist=175 > 70) |
| Priority | Critical |

### IT-2: Budget enforcement with dynamic centroid

| Field | Value |
|-------|-------|
| ID | IT-2 |
| Setup | 3 expanded clusters, maxVisibleNodes=100, total > 100 |
| Steps | 1. Position children at different distances. 2. Call _freeBudget() |
| Expected | Farthest cluster (by dynamic centroid) collapses first |
| Priority | High |

### IT-3: Expand regression — still uses fixed center

| Field | Value |
|-------|-------|
| ID | IT-3 |
| Setup | Collapsed cluster, cluster.center = (50, 0, 0) |
| Steps | 1. Camera at (48,0,0). 2. _checkDistances() |
| Expected | expandCluster() triggered (dist=2 < expandThreshold) |
| Priority | High |

---

## 4. E2E-UI Test Cases (Manual)

### E2E-UI-1: Visual collapse on zoom out

| Steps | Expected |
|-------|----------|
| 1. Load KB Graph with LOD. 2. Zoom in to expand cluster. 3. Wait for force settle. 4. Zoom out. | Cluster collapses, super-node reappears |

### E2E-UI-2: Budget enforcement visual

| Steps | Expected |
|-------|----------|
| 1. Expand 3-4 clusters. 2. Zoom toward new cluster. | Farthest auto-collapses when budget hit |

---

## 5. SIT Test Case (Manual)

### SIT-1: Full LOD lifecycle

| Steps | Expected |
|-------|----------|
| 1. Real KB data (100+ nodes). 2. Navigate 5 min. 3. Expand/collapse freely. | Zero stuck clusters, 60fps maintained |

---

## 6. Automation Mapping

| Test ID | Test File | Status |
|---------|-----------|--------|
| PBT-1, PBT-2 | shared/viewer/__tests__/lod-manager.pbt.test.js | To implement |
| UT-1 to UT-8 | shared/viewer/__tests__/lod-manager.test.js | To implement |
| IT-1 to IT-3 | shared/viewer/__tests__/lod-manager.integration.test.js | To implement |
| E2E-UI-1, E2E-UI-2 | Manual | N/A |
| SIT-1 | Manual | N/A |
