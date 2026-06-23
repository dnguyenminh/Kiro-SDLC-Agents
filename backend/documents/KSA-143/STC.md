# Software Test Cases (STC)

## KSA-143: KB Graph — Level of Detail (LOD) / Semantic Zoom

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-143 |
| Version | 2.0 |
| Date | 2026-05-29 |
| Related STP | STP-v2-KSA-143.docx |

---

## 1. PBT (Property-Based Testing)

### PBT-01: All Nodes Assigned to Exactly 1 Cluster

| Field | Value |
|-------|-------|
| Property | For any graph with > 100 nodes, every non-isolated node belongs to exactly 1 cluster |
| Generator | Random graphs: 101-5000 nodes, 1-3x edges |
| Runs | 1000 |
| Framework | fast-check |
| Assertion | `clusters.flatMap(c => c.childNodeIds).length === nonIsolatedNodes.length` |
| No duplicates | `new Set(allChildIds).size === allChildIds.length` |

### PBT-02: Cluster Size Bounds

| Field | Value |
|-------|-------|
| Property | Every cluster has 5 <= size <= 50 |
| Generator | Random graphs 200-5000 nodes |
| Assertion | `clusters.every(c => c.childNodeIds.length >= 5 && c.childNodeIds.length <= 50)` |

### PBT-03: Isolated Nodes Never Clustered

| Field | Value |
|-------|-------|
| Property | Nodes with 0 edges are not in any cluster |
| Generator | Graphs with 10-50% isolated nodes |
| Assertion | `isolatedIds.every(id => !clusterNodeIds.includes(id))` |

### PBT-04: Budget Never Exceeded

| Field | Value |
|-------|-------|
| Property | visibleNodeCount <= maxVisibleNodes at all times |
| Generator | Random camera position sequences (100 steps) |
| Assertion | After each step: `manager.getVisibleNodeCount() <= config.maxVisibleNodes` |

### PBT-05: Hysteresis Prevents Oscillation

| Field | Value |
|-------|-------|
| Property | Camera at distance between expand and collapse thresholds causes no state change |
| Generator | Distances in range [expandThreshold, collapseThreshold] |
| Assertion | Cluster state unchanged after 100 ticks |

### PBT-06: Deterministic Clustering

| Field | Value |
|-------|-------|
| Property | Same input always produces same output |
| Generator | Fixed random seed graphs |
| Assertion | `JSON.stringify(run1) === JSON.stringify(run2)` for 10 runs |

---

## 2. Unit Tests (UT)

### UT-01: Empty Graph Returns 0 Clusters

| Field | Value |
|-------|-------|
| Module | lod-clustering.js |
| Input | nodes=[], edges=[] |
| Expected | clusters.length === 0 |
| Setup | `const c = new LODClustering(); const result = c.compute([], []);` |

### UT-02: Single Node Returns 0 Clusters

| Field | Value |
|-------|-------|
| Module | lod-clustering.js |
| Input | nodes=[{id:'n1'}], edges=[] |
| Expected | clusters.length === 0 (isolated, not clustered) |

### UT-03: 5 Connected Nodes = 1 Cluster

| Field | Value |
|-------|-------|
| Module | lod-clustering.js |
| Input | 5 nodes fully connected (10 edges) |
| Expected | clusters.length === 1, cluster.childNodeIds.length === 5 |

### UT-04: Two Communities Detected

| Field | Value |
|-------|-------|
| Module | lod-clustering.js |
| Input | 100 nodes, 2 dense groups with 1 bridge edge |
| Expected | clusters.length === 2, each ~50 nodes |

### UT-05: Max Cluster Size Enforced

| Field | Value |
|-------|-------|
| Module | lod-clustering.js |
| Input | 200 nodes in 1 dense community |
| Expected | Multiple clusters, each <= 50 nodes |

### UT-06: Expand Changes State

| Field | Value |
|-------|-------|
| Module | lod-manager.js |
| Setup | Manager with 1 collapsed cluster |
| Action | `manager.expandCluster('c1')` |
| Expected | cluster.state === 'EXPANDING' |

### UT-07: Budget Rejects Expand

| Field | Value |
|-------|-------|
| Module | lod-manager.js |
| Setup | visibleNodes = 95, cluster has 10 children |
| Action | `manager.expandCluster('c1')` |
| Expected | Returns false, state unchanged |

### UT-08: Budget Overflow Collapses Farthest

| Field | Value |
|-------|-------|
| Module | lod-manager.js |
| Setup | 2 expanded clusters, budget at limit |
| Action | Attempt expand 3rd cluster |
| Expected | Farthest cluster collapsed first, then expand succeeds |

### UT-09: Collapse Changes State

| Field | Value |
|-------|-------|
| Module | lod-manager.js |
| Setup | 1 expanded cluster |
| Action | `manager.collapseCluster('c1')` |
| Expected | cluster.state === 'COLLAPSING' |

### UT-10: Interaction Lock

| Field | Value |
|-------|-------|
| Module | lod-manager.js |
| Setup | Expanded cluster with interacting=true |
| Action | Camera moves beyond collapseThreshold |
| Expected | Cluster stays EXPANDED |

### UT-11: Dispose Cancels rAF

| Field | Value |
|-------|-------|
| Module | lod-manager.js |
| Action | `manager.dispose()` |
| Expected | _rafId is null, no more ticks |

### UT-12: Visible Count Accurate

| Field | Value |
|-------|-------|
| Module | lod-manager.js |
| Setup | 3 clusters: 1 expanded (15 children), 2 collapsed |
| Expected | getVisibleNodeCount() === 15 + 2 (super nodes) |

### UT-13: setConfig Updates Thresholds

| Field | Value |
|-------|-------|
| Module | lod-manager.js |
| Action | `manager.setConfig({ expandThreshold: 30 })` |
| Expected | _config.expandThreshold === 30, collapseThreshold === 42 |

### UT-14: Skip LOD Below 100 Nodes

| Field | Value |
|-------|-------|
| Module | lod-manager.js |
| Input | 50 nodes |
| Expected | initialize() returns early, no clusters created |

### UT-15: Expand Animation Duration

| Field | Value |
|-------|-------|
| Module | lod-animation.js |
| Action | expand(cluster, onComplete) |
| Expected | onComplete called after 400ms (+-50ms tolerance) |

### UT-16: Collapse Animation Duration

| Field | Value |
|-------|-------|
| Module | lod-animation.js |
| Action | collapse(cluster, onComplete) |
| Expected | onComplete called after 400ms (+-50ms tolerance) |

### UT-17: Cancel Mid-Animation

| Field | Value |
|-------|-------|
| Module | lod-animation.js |
| Action | expand(cluster), then cancel(clusterId) at 200ms |
| Expected | Animation stops, onComplete not called |

### UT-18: Hysteresis Gap

| Field | Value |
|-------|-------|
| Module | lod-manager.js |
| Setup | Expanded cluster, camera at expandThreshold + 5 |
| Expected | No collapse (distance < collapseThreshold) |

---

## 3. Integration Tests (IT)

### IT-01: LODManager Initializes with Graph

| Field | Value |
|-------|-------|
| Components | LODManager + LODClustering + ForceGraph3D mock |
| Setup | Create ForceGraph3D mock, 200 nodes |
| Action | `new LODManager(mockGraph).initialize(nodes, edges)` |
| Expected | Clusters computed, super nodes in graphData |

### IT-02: Expand Updates GraphData

| Field | Value |
|-------|-------|
| Components | LODManager + LODAnimation + ForceGraph3D mock |
| Setup | Initialized manager with collapsed clusters |
| Action | expandCluster('c1'), wait 500ms |
| Expected | graphData.nodes includes children, super node removed |

### IT-03: Collapse Restores Super Nodes

| Field | Value |
|-------|-------|
| Components | LODManager + LODAnimation + ForceGraph3D mock |
| Setup | 1 expanded cluster |
| Action | collapseCluster('c1'), wait 500ms |
| Expected | Children removed, super node restored in graphData |

### IT-04: Budget Across Multiple Expands

| Field | Value |
|-------|-------|
| Components | LODManager + LODClustering |
| Setup | 10 clusters, budget=100 |
| Action | Expand clusters sequentially |
| Expected | Stops expanding when budget reached |

### IT-05: basePath URL Compliance

| Field | Value |
|-------|-------|
| Components | graph.js + LOD init |
| Setup | Set window.__MCP_BASE = '/sub/path' |
| Action | Intercept fetch calls during initGraph |
| Expected | All fetches start with '/sub/path/api/' |

---

## 4. E2E-API Tests

### E2E-API-01: LOD Param Returns Counts

| Field | Value |
|-------|-------|
| Endpoint | GET /api/memory/graph/data?lod=true |
| Server | NodeJS (repeat for Python, Kotlin) |
| Expected | Response has totalNodes (number), totalEdges (number) |
| Assertion | `typeof response.totalNodes === 'number'` |

### E2E-API-02: Limit Respected with LOD

| Field | Value |
|-------|-------|
| Endpoint | GET /api/memory/graph/data?lod=true&limit=100 |
| Expected | response.nodes.length <= 100, totalNodes may be higher |

### E2E-API-03: No LOD Param = No Counts

| Field | Value |
|-------|-------|
| Endpoint | GET /api/memory/graph/data |
| Expected | No totalNodes field in response |

### E2E-API-04: Invalid LOD Param

| Field | Value |
|-------|-------|
| Endpoint | GET /api/memory/graph/data?lod=abc |
| Expected | Treated as false, no totalNodes |

### E2E-API-05: Works Under Sub-Path

| Field | Value |
|-------|-------|
| Endpoint | GET /mcp/api/memory/graph/data?lod=true |
| Setup | Server configured with basePath=/mcp |
| Expected | Same response as E2E-API-01 |

---

## 5. E2E-UI Tests (Playwright)

### E2E-UI-01: Clusters Appear on Load

```gherkin
Feature: LOD Clustering
  Scenario: Graph with 200+ nodes shows clusters
    Given the KB has 200 entries with edges
    When I navigate to the graph page
    Then I should see fewer than 100 visible elements
    And I should see super nodes with count badges
```

### E2E-UI-02: Expand on Zoom

```gherkin
Feature: LOD Expand
  Scenario: Zoom into cluster expands it
    Given the graph is loaded with LOD clusters
    When I zoom the camera toward a super node
    And the distance is less than 50 world units
    Then the super node should expand into child nodes
    And the animation should complete within 500ms
```

### E2E-UI-03: Collapse on Zoom Out

```gherkin
Feature: LOD Collapse
  Scenario: Zoom away from expanded cluster collapses it
    Given a cluster is expanded showing child nodes
    When I zoom the camera away beyond 70 world units
    Then the children should collapse back into a super node
    And the animation should complete within 500ms
```

### E2E-UI-04: LOD Toggle

```gherkin
Feature: LOD Toggle
  Scenario: Disable LOD shows all nodes
    Given the graph is loaded with LOD active
    When I uncheck the LOD toggle
    Then all nodes should be visible (no clustering)
    And the node count should exceed 100
```

---

## 6. SIT (Manual)

### SIT-01: Super Node Visual Quality

| Step | Action | Expected |
|------|--------|----------|
| 1 | Load graph with 500+ nodes | Clusters visible |
| 2 | Observe super node appearance | Sphere, larger, count badge visible |
| 3 | Check color matches dominant type | Color correct |

### SIT-02: Animation Smoothness

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open Chrome DevTools Performance tab | Ready |
| 2 | Zoom into a cluster | Expand animation plays |
| 3 | Check frame rate | Consistent 60fps, no jank |

### SIT-03: Orbital Layout

| Step | Action | Expected |
|------|--------|----------|
| 1 | Expand a cluster with 15 nodes | Children appear |
| 2 | Observe layout | Ring pattern, 3D depth variation |
| 3 | Expand cluster with 25 nodes | Two rings visible |

---

## 7. Test Data Files

| File | Content | Used By |
|------|---------|---------|
| testdata/small-graph.csv | 50 nodes, 80 edges | UT, IT |
| testdata/medium-graph.csv | 200 nodes, 500 edges | IT, E2E |
| testdata/large-graph.csv | 5000 nodes, 12000 edges | PBT, Performance |
| testdata/disconnected.csv | 100 nodes, 30 edges, 20 isolated | PBT-03 |
| testdata/two-communities.csv | 100 nodes, 2 groups | UT-04 |

---
