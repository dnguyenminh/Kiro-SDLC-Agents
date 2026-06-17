# Functional Specification Document (FSD)

## KB Graph Viewer — KSA-291: KB Graph LOD: Collapse không hoạt động khi zoom out

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-291 |
| Title | KB Graph LOD: Collapse không hoạt động khi zoom out |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-06-14 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-291.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-14 | BA Agent | Initial document |
| 1.0 | 2026-06-14 | TA Agent | Technical enrichment — API contracts, pseudocode |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the bug fix for LOD collapse in the KB Graph Viewer. It details how `_checkDistances()` and `_freeBudget()` must be modified to use dynamic centroid instead of fixed `cluster.center` for expanded clusters.

### 1.2 Scope

- Modify distance calculation logic in `LODManager._checkDistances()`
- Modify distance sorting in `LODManager._freeBudget()`
- Add new private method `_getExpandedCentroid(cluster)` for dynamic centroid computation
- No changes to expand logic, animation, or clustering algorithm

### 1.3 Definitions and Acronyms

| Term | Definition |
|------|------------|
| LOD | Level of Detail — shows/hides nodes based on camera distance |
| Centroid | Average position (x,y,z) of a set of nodes |
| Dynamic centroid | Centroid computed from current child node positions (updated every frame) |
| Fixed center | `cluster.center` — computed once at clustering time, never updated |
| Hysteresis | Gap between expand/collapse thresholds to prevent oscillation |
| Super-node | Visual representation of a collapsed cluster |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-291.docx |
| LOD Manager source | shared/viewer/lod-manager.js |
| LOD Clustering source | shared/viewer/lod-clustering.js |
| LOD Animation source | shared/viewer/lod-animation.js |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

The LOD system sits between the user (camera controls) and ForceGraph3D (rendering + force simulation). The LODManager observes camera position every frame and decides which clusters to expand/collapse.

### 2.2 Current vs Fixed Behavior

| Aspect | Current (Bug) | Fixed |
|--------|---------------|-------|
| Distance reference for COLLAPSED clusters | cluster.center | cluster.center (unchanged) |
| Distance reference for EXPANDED clusters | cluster.center (WRONG) | dynamic centroid of child nodes |
| _freeBudget sorting | cluster.center | dynamic centroid |
| Collapse trigger reliability | Fails when children drift | Always works |

---

## 3. Functional Requirements

### 3.1 Use Cases

---

#### UC-1: Automatic Collapse on Zoom Out

| Field | Value |
|-------|-------|
| ID | UC-1 |
| Actor | Graph User |
| Precondition | Cluster is in EXPANDED state, child nodes are visible |
| Trigger | Camera distance from expanded children exceeds collapseThreshold |

**Main Flow:**

| Step | Action | System Response |
|------|--------|-----------------|
| 1 | User zooms out (camera moves away) | System detects camera position change |
| 2 | System computes dynamic centroid of expanded child nodes | centroid = avg(child.x, child.y, child.z) |
| 3 | System calculates distance from camera to centroid | dist = sqrt((cam.x-cx)^2 + (cam.y-cy)^2 + (cam.z-cz)^2) |
| 4 | dist > collapseThreshold | System calls collapseCluster(clusterId) |
| 5 | Collapse animation plays (400ms) | Children animate to center, super-node appears |
| 6 | Cluster state = COLLAPSED | visibleNodes updated |

**Alternative Flow A — Children near camera:**

| Step | Action | System Response |
|------|--------|-----------------|
| 4a | dist <= collapseThreshold | No action, cluster stays expanded |

**Alternative Flow B — Cluster is animating:**

| Step | Action | System Response |
|------|--------|-----------------|
| 2b | Animation in progress for this cluster | Skip this cluster, check next tick |

**Exception Flow E1 — No child nodes found:**

| Step | Action | System Response |
|------|--------|-----------------|
| 2e | _getChildNodes returns empty array | Fall back to cluster.center for distance |

---

#### UC-2: Budget Enforcement with Correct Distance

| Field | Value |
|-------|-------|
| ID | UC-2 |
| Actor | System (automatic) |
| Precondition | User expands a cluster, visible node count would exceed maxVisibleNodes |
| Trigger | expandCluster() called, _budgetAllows() returns false |

**Main Flow:**

| Step | Action | System Response |
|------|--------|-----------------|
| 1 | Budget check fails (too many nodes) | System calls _freeBudget(needed) |
| 2 | System collects all EXPANDED non-interacting clusters | Filter clusters by state |
| 3 | For each expanded cluster, compute dynamic centroid | Use _getExpandedCentroid() |
| 4 | Sort by distance to camera (descending) | Farthest cluster first |
| 5 | Collapse farthest cluster | collapseCluster() called |
| 6 | Check if budget now allows | Repeat from step 5 if still over |

**Alternative Flow — All clusters too close:**

| Step | Action | System Response |
|------|--------|-----------------|
| 6a | After collapsing all possible, still over budget | Return false, expansion denied |

---

#### UC-3: Expand Detection (unchanged)

| Field | Value |
|-------|-------|
| ID | UC-3 |
| Actor | Graph User |
| Precondition | Cluster is in COLLAPSED state |
| Trigger | Camera moves close to cluster |

**Main Flow:**

| Step | Action | System Response |
|------|--------|-----------------|
| 1 | User zooms in | Camera position changes |
| 2 | System calculates distance from camera to cluster.center | Uses FIXED center (unchanged behavior) |
| 3 | dist < expandThreshold | System calls expandCluster(clusterId) |

> Note: Expand detection continues to use `cluster.center` because collapsed clusters have no visible child nodes to compute centroid from.

---

### 3.2 Business Rules

| ID | Rule | Details |
|----|------|---------|
| BR-1 | Collapsed clusters use fixed center | For expand distance check, use cluster.center (computed at clustering time) |
| BR-2 | Expanded clusters use dynamic centroid | For collapse distance check, compute centroid from current child positions |
| BR-3 | Centroid = average position | centroid.x = sum(child.x)/count, same for y and z |
| BR-4 | Skip animating clusters | If cluster.state is EXPANDING or COLLAPSING, skip distance check |
| BR-5 | Skip interacting clusters | If cluster.interacting is true, do not collapse |
| BR-6 | Hysteresis ratio 1.4x | collapseThreshold = expandThreshold * 1.4 (unchanged) |
| BR-7 | Budget sorts by dynamic centroid | _freeBudget uses same dynamic centroid for distance sorting |
| BR-8 | Fallback to fixed center | If no child nodes found (edge case), use cluster.center |

---

### 3.3 Data Specifications

#### Input: Cluster Object

```javascript
{
  id: "cluster-001",
  label: "ARCHITECTURE (12)",
  childNodeIds: ["node-1", "node-2", ...],
  center: { x: 10, y: 0, z: 5 },  // FIXED at clustering time
  radius: 25,
  dominantType: "ARCHITECTURE",
  state: "EXPANDED" | "COLLAPSED" | "EXPANDING" | "COLLAPSING",
  interacting: false
}
```

#### Input: Child Node (from graph data)

```javascript
{
  id: "node-1",
  x: 80,   // CURRENT position (updated by force sim)
  y: -20,
  z: 60,
  fx: null, // Fixed position (null = free to move)
  fy: null,
  fz: null
}
```

#### Output: Dynamic Centroid

```javascript
{ x: 87.5, y: -5, z: 65 }  // Average of all child positions
```

---

### 3.4 API Contracts

#### New Method: `_getExpandedCentroid(cluster)`

| Property | Value |
|----------|-------|
| Access | Private |
| Parameters | `cluster` — cluster object with childNodeIds and state |
| Returns | `{ x, y, z }` — dynamic centroid position |
| Performance | O(n) where n = childNodeIds.length, max 50 |
| Side effects | None (pure computation) |

**Contract:**
```javascript
/**
 * Compute dynamic centroid of an expanded cluster's child nodes.
 * Uses current node positions (after force simulation).
 * Falls back to cluster.center if no children found.
 * 
 * @param {Object} cluster - cluster with childNodeIds
 * @returns {{ x: number, y: number, z: number }}
 */
_getExpandedCentroid(cluster) -> { x, y, z }
```

#### Modified Method: `_checkDistances()`

**Before (current):**
```javascript
_checkDistances() {
  const cam = this._graph.camera().position;
  for (const [id, cluster] of this._clusters) {
    if (this._animation.isAnimating(id)) continue;
    const dist = this._distance(cam, cluster.center);  // ALWAYS fixed center
    // ... expand/collapse logic
  }
}
```

**After (fixed):**
```javascript
_checkDistances() {
  const cam = this._graph.camera().position;
  for (const [id, cluster] of this._clusters) {
    if (this._animation.isAnimating(id)) continue;
    
    if (cluster.state === 'COLLAPSED') {
      const dist = this._distance(cam, cluster.center);  // Fixed center for expand
      if (dist < this._config.expandThreshold) {
        if (this._budgetAllows(cluster)) this.expandCluster(id);
      }
    } else if (cluster.state === 'EXPANDED') {
      const centroid = this._getExpandedCentroid(cluster);  // Dynamic for collapse
      const dist = this._distance(cam, centroid);
      if (dist > this._config.collapseThreshold) {
        if (!cluster.interacting) this.collapseCluster(id);
      }
    }
  }
}
```

#### Modified Method: `_freeBudget(needed)`

**Before:**
```javascript
_freeBudget(needed) {
  const cam = this._graph.camera().position;
  const expanded = Array.from(this._clusters.values())
    .filter(c => c.state === 'EXPANDED' && !c.interacting)
    .sort((a, b) => this._distance(cam, b.center) - this._distance(cam, a.center));
  // ...
}
```

**After:**
```javascript
_freeBudget(needed) {
  const cam = this._graph.camera().position;
  const expanded = Array.from(this._clusters.values())
    .filter(c => c.state === 'EXPANDED' && !c.interacting)
    .sort((a, b) => {
      const distA = this._distance(cam, this._getExpandedCentroid(a));
      const distB = this._distance(cam, this._getExpandedCentroid(b));
      return distB - distA;  // Farthest first
    });
  // ...
}
```

---

### 3.5 Pseudocode: _getExpandedCentroid

```
FUNCTION _getExpandedCentroid(cluster):
    childNodes = _getChildNodes(cluster)
    
    IF childNodes.length == 0:
        RETURN cluster.center   // Fallback
    
    sumX = 0, sumY = 0, sumZ = 0
    count = childNodes.length
    
    FOR EACH node IN childNodes:
        sumX += node.x OR 0
        sumY += node.y OR 0
        sumZ += node.z OR 0
    
    RETURN { x: sumX/count, y: sumY/count, z: sumZ/count }
END FUNCTION
```

---

### 3.6 Error Handling

| Scenario | Handling |
|----------|----------|
| _getChildNodes returns empty | Use cluster.center as fallback |
| Node has undefined x/y/z | Treat as 0 (node.x or 0) |
| Cluster in EXPANDING/COLLAPSING state | Skip entirely (handled by animation check) |
| Graph not initialized | _checkDistances exits early (existing guard) |

---

### 3.7 State Diagram

![State Diagram](diagrams/state-cluster.png)

Cluster states and transitions:

```
COLLAPSED -> EXPANDING (when dist < expandThreshold)
EXPANDING -> EXPANDED (when animation completes)
EXPANDED -> COLLAPSING (when dynamic dist > collapseThreshold)
COLLAPSING -> COLLAPSED (when animation completes)
```

---

## 4. Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| Performance | _getExpandedCentroid() latency | < 0.1ms for 50 nodes |
| Performance | No GC pressure from centroid calculation | Zero allocations in hot path (reuse object) |
| Performance | Total _checkDistances() per frame | < 2ms for 100 clusters |
| Compatibility | Browser support | Chrome 90+, Firefox 88+, Safari 14+ |
| Maintainability | Code change size | < 40 lines added/modified |

---

## 5. Sequence Diagrams

### 5.1 Collapse Triggered by Zoom Out

![Sequence — Collapse Flow](diagrams/sequence-collapse.png)

### 5.2 Budget Enforcement with Dynamic Centroid

![Sequence — Budget Enforcement](diagrams/sequence-budget.png)

---

## 6. Open Issues

| # | Issue | Status | Decision |
|---|-------|--------|----------|
| 1 | Should centroid be cached between frames? | Resolved | No — force sim updates positions every frame, caching would be stale |
| 2 | Should we update cluster.center after expand? | Resolved | No — cluster.center is needed for collapse animation target. Use separate centroid. |
| 3 | Performance concern for 100+ clusters each with 50 nodes | Resolved | 5000 position reads per frame = negligible vs rendering cost |

---

## 7. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Cluster State Machine | [state-cluster.png](diagrams/state-cluster.png) | [state-cluster.drawio](diagrams/state-cluster.drawio) |
| 3 | Sequence — Collapse | [sequence-collapse.png](diagrams/sequence-collapse.png) | [sequence-collapse.drawio](diagrams/sequence-collapse.drawio) |
| 4 | Sequence — Budget | [sequence-budget.png](diagrams/sequence-budget.png) | [sequence-budget.drawio](diagrams/sequence-budget.drawio) |
