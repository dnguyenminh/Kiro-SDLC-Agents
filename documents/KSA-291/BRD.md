# Business Requirements Document (BRD)

## KB Graph Viewer — KSA-291: KB Graph LOD: Collapse không hoạt động khi zoom out

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-291 |
| Title | KB Graph LOD: Collapse không hoạt động khi zoom out |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-06-14 |
| Status | Draft |
| Type | Bug Fix |
| Priority | High |
| Labels | bug, frontend, graph, lod |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-14 | BA Agent | Initial document — auto-generated from Jira ticket KSA-291 |

---

## 1. Introduction

### 1.1 Scope

This ticket addresses a critical bug in the KB Graph LOD (Level of Detail) system where cluster collapse fails to trigger when the user zooms out. The root cause is that `LODManager._checkDistances()` computes distance from the camera to `cluster.center` (a fixed position calculated at clustering time), but after a cluster is expanded, child nodes drift away from this center due to the ForceGraph3D force simulation. As a result, the distance check never exceeds `collapseThreshold` even when the camera is far away, because the reference point (cluster.center) remains near the camera while actual child nodes are scattered elsewhere.

**Key deliverables:**
- Fix distance calculation in `_checkDistances()` to use dynamic bounding position of expanded child nodes instead of fixed `cluster.center`
- Ensure collapse triggers correctly when camera moves away from expanded cluster region
- Maintain expand behavior unchanged (still uses cluster.center for proximity detection)

### 1.2 Out of Scope

- Changes to clustering algorithm (`LODClustering`)
- Changes to animation system (`LODAnimation`)
- New LOD features (progressive loading, streaming)
- Performance optimization of force simulation itself
- Changes to graph rendering pipeline

### 1.3 Preliminary Requirements

- Existing LOD system (KSA-143) must be functional
- ForceGraph3D instance must expose camera position and node positions
- `shared/viewer/lod-manager.js` and `backend/src/admin-ui/dist/lod-manager.js` must be in sync

---

## 2. Business Requirements

### 2.1 High Level Process Map

The LOD system manages semantic zoom for the KB Graph:

1. **Initialize** — Cluster nodes into groups of 5-50, show super-nodes
2. **Expand** — When camera zooms in close to a cluster (distance < expandThreshold), expand cluster to show individual child nodes
3. **Collapse** — When camera zooms out far from an expanded cluster (distance > collapseThreshold), collapse children back to super-node
4. **Budget** — Maintain max visible nodes by auto-collapsing distant clusters

**Current Bug:** Step 3 fails because distance is measured to a stale position.

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|-----------------|----------|---------------|
| 1 | As a user, I want expanded clusters to automatically collapse when I zoom out so that the graph remains performant and readable | MUST HAVE | KSA-291 |
| 2 | As a user, I want the collapse to trigger based on the actual position of the expanded nodes (not the original cluster center) so that the behavior feels natural | MUST HAVE | KSA-291 |
| 3 | As a user, I want the budget enforcement to correctly free up node slots by collapsing the truly farthest clusters | SHOULD HAVE | KSA-291 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Current (Broken) Flow:**

**Step 1:** User views KB Graph with LOD enabled, sees super-nodes (clusters)

**Step 2:** User zooms in toward a cluster — camera distance < expandThreshold — cluster expands, child nodes appear

**Step 3:** Force simulation runs, child nodes drift away from original cluster.center position

**Step 4:** User zooms out — camera distance from cluster.center is calculated — BUG: because cluster.center is now between camera and the drifted child nodes, distance may still be < collapseThreshold even though camera is far from actual nodes

**Step 5:** Cluster never collapses — node budget exceeded — performance degrades

**Expected (Fixed) Flow:**

**Step 1-3:** Same as above

**Step 4:** User zooms out — camera distance is calculated from dynamic centroid of expanded child nodes — distance correctly exceeds collapseThreshold

**Step 5:** Cluster collapses — super-node reappears — budget maintained

---

#### STORY 1: Collapse triggers correctly on zoom out

> As a user, I want expanded clusters to automatically collapse when I zoom out so that the graph remains performant and readable.

**Requirement Details:**

1. When a cluster is in EXPANDED state and camera distance exceeds `collapseThreshold`, the cluster MUST collapse
2. Distance calculation for expanded clusters MUST use the dynamic centroid (average position) of visible child nodes, NOT the fixed `cluster.center`
3. The collapse threshold ratio (1.4x of expandThreshold) remains unchanged
4. Collapse animation behavior remains unchanged

**Acceptance Criteria:**

1. GIVEN a cluster is expanded AND camera zooms out beyond collapseThreshold from child nodes' centroid, WHEN the next tick fires, THEN collapseCluster() is called
2. GIVEN child nodes have drifted significantly from cluster.center due to force simulation, WHEN distance is checked, THEN the dynamic centroid is used (not cluster.center)
3. GIVEN collapse is triggered, THEN animation plays correctly (children move to center, super-node appears)

---

#### STORY 2: Dynamic centroid tracks child node positions

> As a user, I want the collapse to trigger based on the actual position of the expanded nodes so that the behavior feels natural.

**Requirement Details:**

1. For EXPANDED clusters, compute centroid as average (x, y, z) of all visible child nodes
2. Centroid must be recalculated every tick (nodes move due to force sim)
3. For COLLAPSED clusters, continue using `cluster.center` for expand distance check (unchanged)
4. Performance: centroid calculation must not exceed O(n) per cluster per tick

**Acceptance Criteria:**

1. GIVEN 10 child nodes are visible at positions far from cluster.center, WHEN _checkDistances runs, THEN distance is measured from camera to mean(child.x, child.y, child.z)
2. GIVEN force simulation moves nodes continuously, WHEN centroid is computed, THEN it reflects current node positions (not stale cached values)
3. GIVEN cluster has 50 child nodes, WHEN centroid is computed every frame at 60fps, THEN computation takes < 1ms

---

#### STORY 3: Budget enforcement uses correct distances

> As a user, I want the budget enforcement to correctly free up node slots by collapsing the truly farthest clusters.

**Requirement Details:**

1. `_freeBudget()` sorts expanded clusters by distance — this must also use dynamic centroid
2. The farthest cluster (by dynamic centroid) should be collapsed first
3. This ensures the cluster closest to the user's viewport stays expanded

**Acceptance Criteria:**

1. GIVEN 3 expanded clusters where cluster A's children are closest to camera and cluster C's are farthest, WHEN budget is exceeded, THEN cluster C collapses first
2. GIVEN _freeBudget uses dynamic centroid for sorting, THEN the prioritization is correct regardless of original cluster.center positions

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| LOD System (KSA-143) | System | KSA-143 | Base LOD implementation that this bug exists in |
| ForceGraph3D | External | N/A | 3D graph rendering library providing camera and node position APIs |
| LOD Animation | System | KSA-143 | Animation system for expand/collapse transitions (no changes needed) |
| LOD Clustering | System | KSA-143 | Clustering algorithm (no changes needed) |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Developer | Frontend Team | Fix implementation |
| QA | QA Team | Verify fix with visual and automated tests |
| Product Owner | PO | Accept fix behavior |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Centroid recalculation every frame may impact performance on large graphs (>500 nodes) | Medium | Low | O(n) computation is cheap; profile if needed |
| Force simulation may create oscillation (collapse triggers then expand triggers then collapse) | High | Medium | Hysteresis ratio (1.4x) already prevents this; verify with tests |
| Changing distance reference point may alter expand timing for clusters near threshold boundary | Low | Low | Only affects EXPANDED clusters; COLLAPSED still uses fixed center |

### 5.2 Assumptions

- ForceGraph3D exposes current node positions via node.x, node.y, node.z after force tick
- Child node positions are updated in-place by the force simulation (no copy)
- The 1.4x hysteresis ratio is sufficient to prevent collapse/expand oscillation with dynamic centroid
- Both `shared/viewer/lod-manager.js` and `backend/src/admin-ui/dist/lod-manager.js` must be updated identically

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Centroid calculation < 1ms per tick for 100 nodes | Simple averaging loop, no allocation |
| Performance | No additional memory allocation per tick | Reuse variables, avoid creating new objects in hot path |
| Responsiveness | Collapse triggers within 1 frame (16ms) of threshold crossing | Already guaranteed by requestAnimationFrame tick |
| Compatibility | Fix applies to both shared/ and backend/ copies | Files must remain in sync |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-291 | KB Graph LOD: Collapse khong hoat dong khi zoom out | To Do | Task (Bug) | Main ticket |
| KSA-143 | KB Graph Level of Detail / Semantic Zoom | Done | Story | Parent feature |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| LOD | Level of Detail — system that shows/hides nodes based on camera distance |
| Cluster | Group of 5-50 related nodes displayed as a single super-node when collapsed |
| Super-node | Visual representation of a collapsed cluster |
| Centroid | Average position (x, y, z) of a set of nodes |
| Force simulation | Physics engine that repositions nodes to minimize edge crossings |
| Hysteresis | Gap between expand and collapse thresholds to prevent oscillation |
| collapseThreshold | Distance at which an expanded cluster should collapse (default: expandThreshold x 1.4) |
| expandThreshold | Distance at which a collapsed cluster should expand (default: 50) |

### Affected Files

| File | Role |
|------|------|
| `shared/viewer/lod-manager.js` | Primary source — LODManager class with `_checkDistances()` and `_freeBudget()` |
| `backend/src/admin-ui/dist/lod-manager.js` | Deployed copy — must be updated to match |

### Root Cause Analysis

```
_checkDistances() currently:
  const dist = this._distance(cam, cluster.center);  // BUG: cluster.center is FIXED

After expand, ForceGraph3D force simulation repositions child nodes:
  - cluster.center = { x: 10, y: 0, z: 5 }  (computed at clustering time)
  - actual child positions after sim: { x: 80, y: -20, z: 60 }, { x: 95, y: 10, z: 70 }, ...
  - dynamic centroid = { x: 87.5, y: -5, z: 65 }  (far from cluster.center!)

Camera at { x: 12, y: 0, z: 0 } (just zoomed out slightly from expand position):
  - dist to cluster.center = 5.4   -> < collapseThreshold (NEVER collapses!)
  - dist to dynamic centroid = 96   -> > collapseThreshold (CORRECT!)
```

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
