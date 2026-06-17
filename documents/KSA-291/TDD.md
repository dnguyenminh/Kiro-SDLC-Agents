# Technical Design Document (TDD)

## KB Graph Viewer — KSA-291: KB Graph LOD: Collapse không hoạt động khi zoom out

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-291 |
| Title | KB Graph LOD: Collapse không hoạt động khi zoom out |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-06-14 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-291.docx |
| Related BRD | BRD-v1-KSA-291.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-14 | SA Agent | Initial document |

---

## 1. Architecture Overview

### 1.1 Current Architecture

The LOD system consists of three modules:

```
LODManager (orchestrator)
  ├── LODClustering (Louvain community detection)
  └── LODAnimation (expand/collapse transitions)
```

LODManager runs a `requestAnimationFrame` loop that calls `_checkDistances()` every frame. This method compares camera position to cluster positions and triggers expand/collapse.

### 1.2 Bug Location

**File:** `shared/viewer/lod-manager.js`  
**Method:** `_checkDistances()` (line ~120)  
**Secondary:** `_freeBudget()` (line ~130)

**Root Cause:** Both methods use `cluster.center` (a fixed point computed at clustering time) for distance calculation of EXPANDED clusters. After expand, ForceGraph3D's force simulation repositions child nodes far from this center, making the distance check incorrect.

### 1.3 Architecture Diagram

![Architecture](diagrams/architecture.png)

---

## 2. Design Approach

### 2.1 Strategy: Conditional Distance Reference

- **COLLAPSED clusters:** Continue using `cluster.center` (correct — no child nodes visible)
- **EXPANDED clusters:** Compute dynamic centroid from current child node positions

This is the minimal change that fixes the bug without altering the expand logic or requiring changes to the data model.

### 2.2 Why Not Cache Centroid?

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| Compute every frame | Always accurate, zero stale data | Slightly more CPU per frame | CHOSEN |
| Cache on cluster object | Slightly less CPU | Stale when force sim moves nodes | Rejected |
| Update cluster.center | Simple | Breaks animation target (collapse animates TO center) | Rejected |

### 2.3 Performance Analysis

```
Worst case per frame:
- 100 clusters, each with 50 child nodes
- _getExpandedCentroid: 50 additions + 3 divisions = O(50) = negligible
- Total: 100 clusters * 50 nodes = 5000 property reads
- Estimated time: < 0.5ms (vs ~16ms frame budget)
```

---

## 3. Detailed Design

### 3.1 New Method: `_getExpandedCentroid(cluster)`

```javascript
/**
 * Compute dynamic centroid of an expanded cluster's visible child nodes.
 * Uses current ForceGraph3D node positions (updated by force simulation).
 * Falls back to cluster.center if no children are found in graph data.
 *
 * @param {Object} cluster - cluster object with childNodeIds
 * @returns {{ x: number, y: number, z: number }}
 */
_getExpandedCentroid(cluster) {
  const childNodes = this._getChildNodes(cluster);
  if (childNodes.length === 0) return cluster.center;

  let sumX = 0, sumY = 0, sumZ = 0;
  const len = childNodes.length;
  for (let i = 0; i < len; i++) {
    sumX += childNodes[i].x || 0;
    sumY += childNodes[i].y || 0;
    sumZ += childNodes[i].z || 0;
  }
  return { x: sumX / len, y: sumY / len, z: sumZ / len };
}
```

**Design decisions:**
- Uses `for` loop instead of `reduce()` — avoids closure allocation in hot path
- `|| 0` handles undefined positions gracefully
- Returns new object (acceptable — called max once per expanded cluster per frame)
- Reuses existing `_getChildNodes()` method

### 3.2 Modified Method: `_checkDistances()`

**Current implementation (buggy):**
```javascript
_checkDistances() {
  const cam = this._graph.camera().position;
  for (const [id, cluster] of this._clusters) {
    if (this._animation.isAnimating(id)) continue;
    const dist = this._distance(cam, cluster.center);  // BUG: always fixed
    if (cluster.state === 'COLLAPSED' && dist < this._config.expandThreshold) {
      if (this._budgetAllows(cluster)) this.expandCluster(id);
    } else if (cluster.state === 'EXPANDED' && dist > this._config.collapseThreshold) {
      if (!cluster.interacting) this.collapseCluster(id);
    }
  }
}
```

**Fixed implementation:**
```javascript
_checkDistances() {
  const cam = this._graph.camera().position;
  for (const [id, cluster] of this._clusters) {
    if (this._animation.isAnimating(id)) continue;

    if (cluster.state === 'COLLAPSED') {
      const dist = this._distance(cam, cluster.center);
      if (dist < this._config.expandThreshold) {
        if (this._budgetAllows(cluster)) this.expandCluster(id);
      }
    } else if (cluster.state === 'EXPANDED') {
      const centroid = this._getExpandedCentroid(cluster);
      const dist = this._distance(cam, centroid);
      if (dist > this._config.collapseThreshold) {
        if (!cluster.interacting) this.collapseCluster(id);
      }
    }
  }
}
```

**Changes:**
- Split the single `dist` calculation into two branches
- COLLAPSED: uses `cluster.center` (unchanged behavior)
- EXPANDED: uses `this._getExpandedCentroid(cluster)` (fix)

### 3.3 Modified Method: `_freeBudget(needed)`

**Current implementation (buggy):**
```javascript
_freeBudget(needed) {
  const cam = this._graph.camera().position;
  const expanded = Array.from(this._clusters.values())
    .filter(c => c.state === 'EXPANDED' && !c.interacting)
    .sort((a, b) => this._distance(cam, b.center) - this._distance(cam, a.center));
  for (const cluster of expanded) {
    this.collapseCluster(cluster.id);
    if (this._visibleNodes.size - 1 + needed <= this._config.maxVisibleNodes) return true;
  }
  return false;
}
```

**Fixed implementation:**
```javascript
_freeBudget(needed) {
  const cam = this._graph.camera().position;
  const expanded = Array.from(this._clusters.values())
    .filter(c => c.state === 'EXPANDED' && !c.interacting)
    .sort((a, b) => {
      const distA = this._distance(cam, this._getExpandedCentroid(a));
      const distB = this._distance(cam, this._getExpandedCentroid(b));
      return distB - distA;
    });
  for (const cluster of expanded) {
    this.collapseCluster(cluster.id);
    if (this._visibleNodes.size - 1 + needed <= this._config.maxVisibleNodes) return true;
  }
  return false;
}
```

**Changes:**
- Sort comparator now uses `_getExpandedCentroid()` instead of fixed `cluster.center`
- This ensures the truly farthest cluster (by actual child positions) is collapsed first

---

## 4. Component Diagram

![Component](diagrams/component.png)

---

## 5. Files to Create/Modify

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `shared/viewer/lod-manager.js` | MODIFY | Add `_getExpandedCentroid()`, fix `_checkDistances()`, fix `_freeBudget()` |
| 2 | `backend/src/admin-ui/dist/lod-manager.js` | SYNC | Copy from shared/ (deployed bundle) |

### 5.1 Diff Summary

```diff
--- shared/viewer/lod-manager.js
+++ shared/viewer/lod-manager.js (fixed)

@@ _checkDistances() @@
   _checkDistances() {
     const cam = this._graph.camera().position;
     for (const [id, cluster] of this._clusters) {
       if (this._animation.isAnimating(id)) continue;
-      const dist = this._distance(cam, cluster.center);
-      if (cluster.state === 'COLLAPSED' && dist < this._config.expandThreshold) {
-        if (this._budgetAllows(cluster)) this.expandCluster(id);
-      } else if (cluster.state === 'EXPANDED' && dist > this._config.collapseThreshold) {
-        if (!cluster.interacting) this.collapseCluster(id);
+      if (cluster.state === 'COLLAPSED') {
+        const dist = this._distance(cam, cluster.center);
+        if (dist < this._config.expandThreshold) {
+          if (this._budgetAllows(cluster)) this.expandCluster(id);
+        }
+      } else if (cluster.state === 'EXPANDED') {
+        const centroid = this._getExpandedCentroid(cluster);
+        const dist = this._distance(cam, centroid);
+        if (dist > this._config.collapseThreshold) {
+          if (!cluster.interacting) this.collapseCluster(id);
+        }
       }
     }
   }

@@ _freeBudget() @@
   _freeBudget(needed) {
     const cam = this._graph.camera().position;
     const expanded = Array.from(this._clusters.values())
       .filter(c => c.state === 'EXPANDED' && !c.interacting)
-      .sort((a, b) => this._distance(cam, b.center) - this._distance(cam, a.center));
+      .sort((a, b) => {
+        const distA = this._distance(cam, this._getExpandedCentroid(a));
+        const distB = this._distance(cam, this._getExpandedCentroid(b));
+        return distB - distA;
+      });
     for (const cluster of expanded) {

@@ NEW METHOD (add before _distance) @@
+  _getExpandedCentroid(cluster) {
+    const childNodes = this._getChildNodes(cluster);
+    if (childNodes.length === 0) return cluster.center;
+    let sumX = 0, sumY = 0, sumZ = 0;
+    const len = childNodes.length;
+    for (let i = 0; i < len; i++) {
+      sumX += childNodes[i].x || 0;
+      sumY += childNodes[i].y || 0;
+      sumZ += childNodes[i].z || 0;
+    }
+    return { x: sumX / len, y: sumY / len, z: sumZ / len };
+  }
```

---

## 6. Error Handling

| Scenario | Handling | Fallback |
|----------|----------|----------|
| `_getChildNodes()` returns [] | Return `cluster.center` | Silent fallback, no crash |
| Node.x/y/z is undefined | Use `|| 0` | Node treated as at origin |
| Cluster in EXPANDING state | Skipped by `isAnimating()` check | No action needed |
| Division by zero (len=0) | Caught by length check | Returns cluster.center |

---

## 7. Security Design

This change is purely computational (no I/O, no network, no user input processing). No security considerations apply.

---

## 8. Testing Strategy

| Level | What to Test | How |
|-------|-------------|-----|
| Unit | `_getExpandedCentroid()` returns correct average | Mock child nodes at known positions |
| Unit | `_getExpandedCentroid()` falls back to cluster.center when no children | Empty childNodeIds |
| Unit | `_checkDistances()` uses dynamic centroid for EXPANDED clusters | Mock graph with drifted children |
| Unit | `_checkDistances()` still uses cluster.center for COLLAPSED clusters | Verify expand behavior unchanged |
| Unit | `_freeBudget()` sorts by dynamic centroid | 3 clusters at different positions |
| Integration | End-to-end collapse after expand + force sim drift | Create graph, expand, move camera |
| Visual | Cluster collapses when zooming out | Manual test in browser |

---

## 9. Implementation Checklist

- [ ] Add `_getExpandedCentroid(cluster)` method to LODManager class
- [ ] Modify `_checkDistances()` to branch on cluster.state
- [ ] Modify `_freeBudget()` to use dynamic centroid in sort
- [ ] Copy fixed file to `backend/src/admin-ui/dist/lod-manager.js`
- [ ] Run existing unit tests (if any)
- [ ] Add unit tests for `_getExpandedCentroid()`
- [ ] Add regression test: expand cluster, drift nodes, verify collapse triggers
- [ ] Manual visual test in KB Graph viewer

---

## 10. Rollback Plan

If the fix causes unexpected behavior:
1. Revert `shared/viewer/lod-manager.js` to previous version
2. Revert `backend/src/admin-ui/dist/lod-manager.js` to previous version
3. No data migration needed (pure client-side code)
4. No configuration changes needed

---

## 11. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
