# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-143: KB Graph — Level of Detail (LOD) / Semantic Zoom

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-143 |
| Title | KB Graph — Level of Detail (LOD) / Semantic Zoom |
| Author | SA Agent |
| Version | 2.0 |
| Date | 2026-05-29 |
| Status | Final |
| Related FSD | FSD-v2-KSA-143.docx |
| Related BRD | BRD-v1-KSA-143.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-25 | SA | Initial — based on FSD v1 |
| 2.0 | 2026-05-29 | SA | Full redo — shared viewer arch per FSD v2 |

---

## 1. Architecture Overview

### 1.1 Design Philosophy

LOD is a client-side rendering optimization in `shared/viewer/`.
No new backend endpoints. Minimal server changes (add `lod` param).

### 1.2 Component Diagram

All LOD code lives in `shared/viewer/` as ES modules:

- `lod-manager.js` — orchestrator, integrates with ForceGraph3D
- `lod-clustering.js` — Louvain community detection
- `lod-animation.js` — expand/collapse with easing

Consumers: NodeJS MCP, Python MCP, Kotlin MCP, VS Code Extension.

### 1.3 Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Language | Vanilla JS (ES2020) | Matches shared/viewer/ |
| 3D Engine | ForceGraph3D (three.js) | Already in use |
| Clustering | Louvain (custom impl) | Deterministic, fast |
| Animation | requestAnimationFrame | Native, no deps |
| Module System | ES modules (import/export) | Browser-native |

---

## 2. Module Design

### 2.1 lod-manager.js — LOD Orchestrator

**Responsibility:** Lifecycle management, camera distance checks, budget enforcement.

```javascript
export class LODManager {
  constructor(graph3dInstance, config = {}) { ... }
  initialize(nodes, edges) { ... }
  update(cameraPosition) { ... }
  expandCluster(clusterId) { ... }
  collapseCluster(clusterId) { ... }
  getVisibleNodeCount() { ... }
  setConfig(config) { ... }
  dispose() { ... }
}
```

**Internal State:**

| Property | Type | Description |
|----------|------|-------------|
| `_clusters` | Map | All computed clusters |
| `_visibleNodes` | Set | Currently rendered node IDs |
| `_config` | Object | Runtime configuration |
| `_animating` | Set | Clusters mid-animation |
| `_graph` | ForceGraph3D | Reference to 3D graph |
| `_rafId` | number | requestAnimationFrame ID |

**Camera Distance Loop (rAF):**

Per-frame check runs under 2ms budget (BR-07). Iterates clusters,
compares camera distance to thresholds, triggers expand/collapse.

**Budget Enforcement (BR-10):**

Before expanding: `visibleNodes.size + cluster.childCount <= maxVisibleNodes`.
If over budget: collapse farthest expanded cluster first (BR-11).


### 2.2 lod-clustering.js — Louvain Community Detection

**Responsibility:** Deterministic graph clustering using Louvain algorithm.

```javascript
export class LODClustering {
  constructor(options = {}) { ... }
  compute(nodes, edges) { ... }  // returns Cluster[]
  recompute(nodes, edges) { ... }
  getClusterForNode(nodeId) { ... }
}
```

**Algorithm Steps:**

1. Build adjacency list from edges
2. Initialize each node as own community
3. Louvain Phase 1: move nodes to neighbor community maximizing modularity
4. Louvain Phase 2: aggregate communities into super-nodes
5. Repeat until convergence
6. Post-process: enforce min/max cluster size (split large, merge small)
7. Compute cluster centers (centroid of member positions)

**Constraints:**

| Rule | Implementation |
|------|---------------|
| BR-01 | Min 5, Max 50 nodes per cluster (post-process) |
| BR-02 | Deterministic: sort nodes by ID before processing |
| BR-03 | Edge weight 2x type weight in modularity calc |
| BR-04 | Skip isolated nodes (0 edges) |
| BR-05 | Merge smallest if > 100 super nodes |

**Performance:** Under 2s for 5000 nodes. Fallback to octree if timeout.

### 2.3 lod-animation.js — Expand/Collapse Animations

**Responsibility:** Smooth 400ms transitions with easing.

```javascript
export class LODAnimation {
  constructor(graph3dInstance) { ... }
  expand(cluster, onComplete) { ... }
  collapse(cluster, onComplete) { ... }
  cancel(clusterId) { ... }
}
```

**Expand Sequence (400ms):**

| Phase | Time | Action |
|-------|------|--------|
| 1 | 0-80ms | Super node opacity 1.0 to 0.0 |
| 2 | 80ms | Create children at center (scale 0) |
| 3 | 80-320ms | Animate to orbital positions (easeOutCubic) |
| 4 | 320-400ms | Fade in intra-cluster edges |

**Collapse Sequence (400ms):**

| Phase | Time | Action |
|-------|------|--------|
| 1 | 0-80ms | Fade out intra-cluster edges |
| 2 | 80-320ms | Children animate to center (easeInCubic) |
| 3 | 320ms | Remove children from scene |
| 4 | 320-400ms | Super node opacity 0.0 to 1.0 |

**Orbital Layout:**

- 20 or fewer children: single ring, radius = cluster.radius
- More than 20: two concentric rings (inner 60%, outer 100%)
- Y-axis variation for 3D depth

**Easing:** easeOutCubic, easeInCubic (cubic bezier)

---

## 3. Integration with graph.js

### 3.1 Initialization Hook

In `shared/viewer/graph.js` `initGraph()`, after ForceGraph3D setup:

```javascript
// After graph3d is created and data loaded:
import { LODManager } from './lod-manager.js';

if (allNodes.length > 100 && d.totalNodes) {
  const lodManager = new LODManager(graph3d, {
    maxVisibleNodes: 100,
    expandThreshold: 50,
    collapseThreshold: 70,
    animationDuration: 400
  });
  lodManager.initialize(allNodes, links);
  window.lodInstance = lodManager;
}
```

### 3.2 API URL Change

Current: `fetch(API + '/graph/data?limit=500')`
New: `fetch(API + '/graph/data?limit=5000&lod=true')`

Uses existing `API` variable (basePath-relative). No absolute URLs.

### 3.3 LOD Toggle UI

Add to graph toolbar in `index.html`:

```html
<label><input type="checkbox" id="lod-toggle" checked> LOD</label>
<label>Budget: <input type="range" id="lod-budget" min="50" max="500" value="100"></label>
```

Event handlers in graph.js delegate to `lodManager.setConfig()`.

---

## 4. Backend Changes

### 4.1 Scope

Minimal changes to 3 servers. No new endpoints.

### 4.2 NodeJS Server (`mcp-code-intelligence-nodejs`)

**File:** `src/http/api-routes.ts` (handleGraphData function)

Changes:
1. Parse `lod` query parameter (boolean)
2. If `lod=true`: include `totalNodes` and `totalEdges` in response
3. Increase default limit from 500 to 5000 when lod=true

```typescript
// In handleGraphData:
const lod = req.query.lod === 'true';
const limit = lod ? Math.min(Number(req.query.limit) || 5000, 10000) : 500;
// ... existing query logic with new limit ...
if (lod) {
  response.totalNodes = await db.countNodes();
  response.totalEdges = await db.countEdges();
}
```

### 4.3 Python Server (`mcp-code-intelligence-python`)

**File:** `src/mcp_code_intel/http/api_routes.py` (_handle_graph_data)

Same logic as NodeJS. Parse `lod` param, add counts.

### 4.4 Kotlin Server (`mcp-code-intelligence-kotlin`)

**File:** `src/main/kotlin/com/codeintel/http/MemoryApiRoutes.kt` (handleGraphData)

Same logic. Parse `lod` param from query string, add counts.

### 4.5 Response Schema (with lod=true)

```json
{
  "nodes": [...],
  "edges": [...],
  "totalNodes": 5432,
  "totalEdges": 12890
}
```

---

## 5. Data Structures

### 5.1 Cluster Object

```javascript
{
  id: "cluster-001",
  label: "Architecture Decisions",
  childNodeIds: ["n1", "n2", "n3", ...],
  center: { x: 10.5, y: -3.2, z: 7.8 },
  radius: 15.0,
  dominantType: "ARCHITECTURE",
  state: "COLLAPSED",  // COLLAPSED | EXPANDING | EXPANDED | COLLAPSING
  superNode: { /* three.js mesh reference */ },
  childMeshes: []
}
```

### 5.2 LODConfig

```javascript
{
  expandThreshold: 50,      // world units
  collapseThreshold: 70,    // auto = expand * 1.4
  animationDuration: 400,   // ms
  maxVisibleNodes: 100,     // budget
  minClusterSize: 5,
  maxClusterSize: 50,
  lodEnabled: true
}
```

### 5.3 State Machine

| State | Description | Transitions |
|-------|-------------|-------------|
| COLLAPSED | Super node visible | -> EXPANDING (distance < threshold) |
| EXPANDING | Animation running | -> EXPANDED (done) or COLLAPSED (cancel) |
| EXPANDED | Children visible | -> COLLAPSING (distance > threshold) |
| COLLAPSING | Animation running | -> COLLAPSED (done) or EXPANDED (cancel) |

Hysteresis: collapseThreshold = expandThreshold * 1.4 (BR-06)

---

## 6. Error Handling

| Code | Condition | Recovery |
|------|-----------|----------|
| LOD-001 | Clustering > 2s | Fallback to octree spatial partitioning |
| LOD-002 | WebGL context lost | Attempt context restore, re-init LOD |
| LOD-003 | Frame drop (< 30fps) | Skip animation, jump to end state |
| LOD-004 | Invalid graph data | Disable LOD, render all nodes directly |

### 6.1 Graceful Degradation

If LOD fails at any point, system falls back to standard rendering
(all nodes visible, no clustering). User sees console warning.

---

## 7. Security Considerations

### 7.1 Input Validation

- `limit` param: clamp to [1, 10000], reject non-numeric
- `lod` param: strict boolean parse ("true"/"false")
- Node/edge data: validate structure before clustering

### 7.2 Resource Limits

- Max 10000 nodes from API (server-enforced)
- Clustering timeout: 2s hard limit (Web Worker if available)
- Animation frame budget: skip if > 16ms per frame

### 7.3 No New Attack Surface

LOD is purely client-side rendering logic. No new auth, no new
data exposure. Same data already available via existing endpoint.

---

## 8. Performance Design

### 8.1 Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Clustering 5000 nodes | < 2s | performance.now() |
| Frame time (distance check) | < 2ms | rAF budget |
| Expand animation | 60fps | no jank |
| Memory overhead | < 50MB | Chrome DevTools |
| Visible nodes at any time | <= 100 | budget enforced |

### 8.2 Optimization Strategies

1. **Spatial indexing:** Octree for fast distance queries
2. **Lazy clustering:** Only cluster when node count > 100
3. **Object pooling:** Reuse three.js meshes for super nodes
4. **Batch updates:** Group ForceGraph3D data updates
5. **Early exit:** Skip distance check for far clusters

---

## 9. Implementation Checklist

### 9.1 Files to Create

| # | File | Location | Lines (est) |
|---|------|----------|-------------|
| 1 | lod-manager.js | shared/viewer/ | ~250 |
| 2 | lod-clustering.js | shared/viewer/ | ~200 |
| 3 | lod-animation.js | shared/viewer/ | ~150 |

### 9.2 Files to Modify

| # | File | Change |
|---|------|--------|
| 1 | shared/viewer/graph.js | Import LODManager, init after graph load |
| 2 | shared/viewer/index.html | Add LOD toggle controls to toolbar |
| 3 | mcp-code-intelligence-nodejs/src/http/api-routes.ts | Add lod param, totalNodes/totalEdges |
| 4 | mcp-code-intelligence-python/src/mcp_code_intel/http/api_routes.py | Same |
| 5 | mcp-code-intelligence-kotlin/src/main/kotlin/com/codeintel/http/MemoryApiRoutes.kt | Same |

### 9.3 Implementation Order

1. `lod-clustering.js` — standalone, testable in isolation
2. `lod-animation.js` — standalone, testable with mock meshes
3. `lod-manager.js` — integrates 1 + 2 + ForceGraph3D
4. `graph.js` modifications — hook LODManager into existing flow
5. Backend changes (3 servers) — add lod param
6. `index.html` — UI controls

### 9.4 Dependencies

No new npm packages. All implemented with:
- Native ES modules
- ForceGraph3D (already loaded)
- three.js (already loaded via ForceGraph3D)
- requestAnimationFrame (browser native)

---

## 10. Testing Strategy

### 10.1 Unit Tests

| Module | Test Focus |
|--------|-----------|
| lod-clustering.js | Determinism, min/max size, isolated nodes |
| lod-animation.js | Timing, easing correctness, cancel behavior |
| lod-manager.js | Budget enforcement, state transitions |

### 10.2 Integration Tests

- LODManager + ForceGraph3D: expand/collapse with real graph
- API endpoint: lod=true returns counts
- graph.js: LOD initializes when > 100 nodes

### 10.3 Performance Tests

- 5000 nodes clustering < 2s
- 60fps during animations
- Memory stable after repeated expand/collapse

---

## 11. Deployment Notes

### 11.1 No Infrastructure Changes

LOD is client-side JS served as static files. No new services,
no new databases, no new ports.

### 11.2 Rollout

- Feature flag: `lodEnabled` config (default true)
- Can disable per-user via UI toggle
- No migration needed — purely additive

### 11.3 Monitoring

- Console warnings for LOD errors
- Performance marks for clustering time
- No server-side metrics needed (client-only feature)

---

## Appendix A: Diagram Index

| # | Diagram | Description |
|---|---------|-------------|
| 1 | architecture.drawio | Component architecture overview |
| 2 | component.drawio | Module interaction diagram |
| 3 | state-machine.drawio | Cluster state transitions |

---
