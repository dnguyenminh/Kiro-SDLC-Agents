# Software Test Cases (STC)

## KSA-143: KB Graph — Level of Detail (LOD) / Semantic Zoom

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-143 |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-25 |
| Related STP | STP-v1-KSA-143.docx |

---

## 1. Property-Based Tests (PBT)

### TC-PBT-01: Clustering Determinism

| Field | Value |
|-------|-------|
| ID | TC-PBT-01 |
| Level | PBT |
| Priority | Critical |
| Automation | Yes |
| Property | For any graph G, cluster(G) always produces the same result |

**Generator:** Random graphs with 10-1000 nodes, 20-5000 edges, 3-10 types
**Property:** `cluster(G) === cluster(G)` (deep equality)
**Runs:** 100

### TC-PBT-02: Budget Invariant

| Field | Value |
|-------|-------|
| ID | TC-PBT-02 |
| Level | PBT |
| Priority | Critical |
| Automation | Yes |
| Property | At any point, visibleNodeCount <= maxVisibleNodes |

**Generator:** Random camera positions, random expand/collapse sequences
**Property:** After each operation, `getVisibleNodeCount() <= config.maxVisibleNodes`
**Runs:** 200

### TC-PBT-03: Cluster Size Bounds

| Field | Value |
|-------|-------|
| ID | TC-PBT-03 |
| Level | PBT |
| Priority | High |
| Automation | Yes |
| Property | All clusters have size between minClusterSize and maxClusterSize |

**Generator:** Random graphs with 100-5000 nodes
**Property:** `clusters.every(c => c.childNodeIds.length >= min && c.childNodeIds.length <= max)`
**Exception:** Isolated nodes (0 edges) are excluded

---

## 2. Unit Tests (UT)

### 2.1 ClusteringAlgorithm

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| TC-UT-01 | Cluster connected graph | 20 nodes, 3 dense groups | 3 clusters | Critical |
| TC-UT-02 | Handle empty graph | 0 nodes, 0 edges | Empty hierarchy, no error | High |
| TC-UT-03 | Handle single node | 1 node, 0 edges | 1 isolated node, 0 clusters | High |
| TC-UT-04 | Respect max cluster size | 100 nodes all connected | Multiple clusters, each <= 50 | Critical |
| TC-UT-05 | Respect min cluster size | 10 nodes, 2 groups of 3 + 4 isolated | Merge small groups or keep isolated | High |
| TC-UT-06 | Type affinity | 20 nodes (10 type A, 10 type B), mixed edges | Type A nodes tend to cluster together | Medium |

### 2.2 DistanceChecker

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| TC-UT-07 | Trigger expand | Camera at distance 40, threshold 50 | EXPAND event emitted | Critical |
| TC-UT-08 | No trigger in hysteresis zone | Camera at distance 60, expand=50, collapse=70 | No event | Critical |
| TC-UT-09 | Trigger collapse | Camera at distance 80, collapse threshold 70 | COLLAPSE event emitted | Critical |
| TC-UT-10 | Multiple clusters | 3 clusters at different distances | Correct events for each | High |

### 2.3 BudgetManager

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| TC-UT-12 | Allow expand within budget | Current 60, cluster has 30 children, max 100 | canExpand = true | Critical |
| TC-UT-13 | Deny expand over budget | Current 80, cluster has 30 children, max 100 | canExpand = false | Critical |
| TC-UT-14 | Get farthest expanded | 3 expanded clusters at distances 30, 50, 70 | Returns cluster at 70 | High |

### 2.4 AnimationController

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| TC-UT-15 | Expand animation completes | Cluster with 10 children | All children at orbital positions after 400ms | High |
| TC-UT-16 | Collapse animation completes | Expanded cluster | All children at center, removed after 400ms | High |
| TC-UT-17 | Cancel animation | Start expand, cancel at 200ms | Snap to nearest stable state | Medium |

### 2.5 OrbitalLayout

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| TC-UT-18 | Single ring (<=20 nodes) | 10 nodes, center (0,0,0), radius 5 | 10 positions evenly spaced on circle | High |
| TC-UT-19 | Double ring (>20 nodes) | 30 nodes | 10 inner + 20 outer positions | High |
| TC-UT-20 | No overlap | Any count | Min distance between positions > node radius | Medium |

### 2.6 SuperNodeFactory

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| TC-UT-11 | Badge shows correct count | Cluster with 42 children | Badge text = "42" | High |
| TC-UT-21 | Size scales with count | Clusters of 5, 20, 50 | Radius increases with count | Medium |
| TC-UT-22 | Color matches dominant type | Cluster dominant type = "class" | Color = class color | Medium |

---

## 3. Integration Tests (IT)

| ID | Test Case | Components | Scenario | Expected | Priority |
|----|-----------|-----------|----------|----------|----------|
| TC-IT-01 | Full expand flow | LODManager + Distance + Budget + Animation | Camera moves close to cluster | Cluster expands, children visible | Critical |
| TC-IT-02 | Budget auto-collapse | LODManager + Budget + Animation | Expand 3rd cluster exceeding budget | Farthest cluster auto-collapses | Critical |
| TC-IT-03 | Rapid zoom in/out | LODManager + Animation | Quick zoom in then out | No crash, consistent state | High |
| TC-IT-04 | Full collapse flow | LODManager + Distance + Animation | Camera moves away | Cluster collapses smoothly | Critical |
| TC-IT-05 | Initialize pipeline | LODManager + Clustering + SuperNodeFactory | Load 500-node graph | Clusters created, super nodes in scene | High |

---

## 4. E2E-API Tests

| ID | Test Case | API Method | Scenario | Expected | Priority |
|----|-----------|-----------|----------|----------|----------|
| TC-API-01 | Initialize with valid data | initialize() | 100 nodes, 200 edges | Returns ClusterHierarchy | Critical |
| TC-API-02 | Initialize with empty data | initialize() | 0 nodes | Returns empty hierarchy | High |
| TC-API-03 | Get visible count | getVisibleNodeCount() | After init | Returns cluster count | High |
| TC-API-04 | Manual expand | expandCluster(id) | Valid cluster ID | Cluster state = EXPANDED | High |
| TC-API-05 | Manual collapse | collapseCluster(id) | Expanded cluster | Cluster state = COLLAPSED | High |
| TC-API-06 | Config update | setConfig() | Change thresholds | New thresholds applied | Medium |
| TC-API-07 | Event emission | on('cluster-expanded') | Expand cluster | Event fired with cluster ID | High |
| TC-API-08 | Dispose cleanup | dispose() | After init | No memory leaks, scene cleared | High |

---

## 5. E2E-UI Tests (Gherkin)

### TC-E2E-UI-01: View Clustered Graph

```gherkin
Feature: LOD Graph Visualization
  Scenario: View large graph with clustering
    Given a graph with 500 nodes and 2000 edges is loaded
    When the graph renders in the webview
    Then I should see fewer than 100 super nodes
    And each super node should display a child count badge
    And the frame rate should be above 30 FPS
```

### TC-E2E-UI-02: Zoom to Expand Cluster

```gherkin
  Scenario: Expand cluster by zooming in
    Given a clustered graph is displayed
    When I zoom toward a super node until camera distance is less than 50 units
    Then the super node should disappear with fade animation
    And child nodes should appear with expand animation
    And intra-cluster edges should become visible
    And the animation should complete within 500ms
```

### TC-E2E-UI-03: View Child Count Badge

```gherkin
  Scenario: Super node shows child count
    Given a clustered graph is displayed
    When I look at any super node
    Then it should display a numeric badge
    And the badge number should match the actual child count
```

### TC-E2E-UI-04: Zoom Out to Collapse

```gherkin
  Scenario: Collapse cluster by zooming out
    Given a cluster is expanded showing child nodes
    When I zoom away until camera distance exceeds 70 units
    Then child nodes should collapse with animation
    And the super node should reappear
    And the animation should be smooth (no jank)
```

### TC-E2E-UI-05: Budget Enforcement

```gherkin
  Scenario: Auto-collapse when budget exceeded
    Given two clusters are expanded (total 80 visible nodes)
    When I zoom into a third cluster with 30 children
    Then the farthest expanded cluster should auto-collapse
    And the new cluster should expand
    And total visible nodes should remain under 100
```

---

## 6. Performance Tests

| ID | Test Case | Metric | Target | Dataset | Priority |
|----|-----------|--------|--------|---------|----------|
| TC-PERF-01 | Clustering time | Duration | < 2000ms | 10k nodes, 50k edges | Critical |
| TC-PERF-02 | Frame rate | FPS | >= 30 | 100 visible nodes | Critical |
| TC-PERF-03 | Distance check | Duration | < 2ms | 100 clusters | High |
| TC-PERF-04 | Memory usage | Peak MB | < 500 | 10k nodes | High |
| TC-PERF-05 | Animation smoothness | Frame drops | 0 dropped frames | Expand/collapse | Medium |

---

## 7. SIT (System Integration Tests) — Manual

| ID | Test Case | Steps | Expected | Priority |
|----|-----------|-------|----------|----------|
| SIT-01 | Real graph visualization | 1. Open extension 2. Load real KB graph 3. Observe clustering | Graph clusters correctly, super nodes visible | Critical |
| SIT-02 | Interactive zoom | 1. Zoom into cluster 2. Interact with children 3. Zoom out | Smooth transitions, no crashes | Critical |
| SIT-03 | Large graph performance | 1. Load 5000+ node graph 2. Navigate freely for 2 min | No lag, no memory growth | High |
| SIT-04 | Edge display correctness | 1. Expand cluster 2. Check intra-cluster edges 3. Check inter-cluster edges | All edges connect correctly | High |

---

## 8. Test Summary

| Level | Total Cases | Automated | Manual | Critical | High | Medium |
|-------|-------------|-----------|--------|----------|------|--------|
| PBT | 3 | 3 | 0 | 2 | 1 | 0 |
| UT | 22 | 22 | 0 | 6 | 11 | 5 |
| IT | 5 | 5 | 0 | 3 | 2 | 0 |
| E2E-API | 8 | 8 | 0 | 1 | 5 | 2 |
| E2E-UI | 5 | 4 | 1 | 0 | 3 | 2 |
| Performance | 5 | 5 | 0 | 2 | 2 | 1 |
| SIT | 4 | 0 | 4 | 2 | 2 | 0 |
| **Total** | **52** | **47** | **5** | **16** | **26** | **10** |

**Automation Rate:** 90% (47/52)
