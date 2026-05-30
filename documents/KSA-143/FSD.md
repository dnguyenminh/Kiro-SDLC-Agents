# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-143: KB Graph — Level of Detail (LOD) / Semantic Zoom

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-143 |
| Title | KB Graph — Level of Detail (LOD) / Semantic Zoom |
| Author | BA Agent + TA Agent |
| Version | 2.0 |
| Date | 2026-05-28 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-143.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-25 | BA+TA | Initial — incorrect architecture |
| 2.0 | 2026-05-28 | BA+TA | Full redo — shared viewer arch |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies LOD/Semantic Zoom for the 3D KB Graph. The LOD code lives in `shared/viewer/` and is consumed by 4 components.

### 1.2 Scope

**Architecture:** The viewer is a shared single source of truth at `shared/viewer/graph.js`.

LOD requires changes in:
1. **Frontend (shared):** `shared/viewer/` — LOD module
2. **Backend (3 servers):** API changes on NodeJS, Python, Kotlin
3. **Extension:** VS Code webview loads shared viewer

### 1.3 Definitions

| Term | Definition |
|------|------------|
| LOD | Level of Detail |
| Super Node | Cluster representative at far zoom |
| Shared Viewer | `shared/viewer/` — single source of truth |
| basePath | Relative URL helper for sub-path deploy |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-143.docx |
| Shared Viewer | `shared/viewer/graph.js` |
| NodeJS Server | `mcp-code-intelligence-nodejs/src/http/viewer-server.ts` |
| Python Server | `mcp-code-intelligence-python/src/mcp_code_intel/http/viewer_server.py` |
| Kotlin Server | `mcp-code-intelligence-kotlin/src/main/kotlin/com/codeintel/http/MemoryApiRoutes.kt` |
| Extension Panel | `kiro-sdlc-agents/src/panels/graph-panel.ts` |

---

## 2. System Overview

### 2.1 Component Architecture

The LOD system spans 4 deployment targets sharing one viewer codebase:

```
shared/viewer/ (single source of truth)
  graph.js        ← existing, will import LOD modules
  lod-manager.js  ← NEW: orchestrates LOD lifecycle
  lod-clustering.js ← NEW: Louvain community detection
  lod-animation.js  ← NEW: expand/collapse animations
```

Consumers:
- NodeJS MCP: `viewer-server.ts` serves shared/ via HTTP
- Python MCP: `viewer_server.py` serves shared/ via HTTP
- Kotlin MCP: copies shared/ to `build/resources/main/viewer/`
- Extension: VS Code webview loads shared viewer HTML

### 2.2 API Changes Required (All 3 MCP Servers)

**Current endpoint:** `GET /api/memory/graph/data?limit=500`

**Enhanced endpoint:** `GET /api/memory/graph/data?limit=5000&lod=true`

The `limit` parameter increases because LOD handles rendering budget client-side. Server returns full graph data; client clusters and manages visibility.

No new endpoints needed — LOD is purely a client-side rendering optimization using existing data.

---

## 3. Functional Requirements

### 3.1 Feature: LOD Module in Shared Viewer

**Source:** BRD Stories 1-6

#### 3.1.1 New Files in `shared/viewer/`

| File | Purpose |
|------|---------|
| `lod-manager.js` | Orchestrates LOD lifecycle, integrates with ForceGraph3D |
| `lod-clustering.js` | Louvain community detection algorithm |
| `lod-animation.js` | Expand/collapse animations with easing |

#### 3.1.2 Integration Point in `graph.js`

```javascript
// In initGraph() after ForceGraph3D initialization:
import { LODManager } from './lod-manager.js';
const lodManager = new LODManager(graph3d, { maxVisibleNodes: 100 });
lodManager.initialize(allNodes, links);
```

#### 3.1.3 Use Case: UC-01 — Initial Graph Clustering

**Actor:** System (on graph load)
**Preconditions:** Graph data fetched, ForceGraph3D instance created
**Postconditions:** Clusters computed, super nodes displayed

**Main Flow:**

| Step | Action |
|------|--------|
| 1 | `graph.js` fetches `API + '/graph/data?limit=5000'` |
| 2 | Creates ForceGraph3D with full data |
| 3 | `lodManager.initialize(nodes, edges)` called |
| 4 | Clustering algorithm groups nodes (Louvain) |
| 5 | Super nodes replace clusters in scene |
| 6 | Camera distance checker starts (rAF loop) |

**Alternative Flows:**

| ID | Condition | Action |
|----|-----------|--------|
| AF-01a | Graph < 100 nodes | Skip LOD, render all directly |
| AF-01b | Isolated nodes (0 edges) | Render as regular nodes |

**Exception Flows:**

| ID | Condition | Action |
|----|-----------|--------|
| EF-01a | Clustering > 2s | Fallback to octree |
| EF-01b | Empty graph | Show message |

---

#### 3.1.4 Use Case: UC-02 — Expand on Zoom In

**Actor:** Developer
**Trigger:** Camera distance < expandThreshold

| Step | Action |
|------|--------|
| 1 | User zooms toward super node |
| 2 | Distance check detects threshold crossed |
| 3 | Budget check: visible + childCount <= 100 |
| 4 | Expand animation: children orbit out |
| 5 | Show intra-cluster edges |

**Alt:** AF-02a: Budget exceeded → collapse farthest first

---

#### 3.1.5 Use Case: UC-03 — Collapse on Zoom Out

**Actor:** Developer
**Trigger:** Camera distance > collapseThreshold

| Step | Action |
|------|--------|
| 1 | User zooms away |
| 2 | Collapse animation: children to center |
| 3 | Show super node, hide children |

---

### 3.2 Business Rules

| ID | Rule | Description |
|----|------|-------------|
| BR-01 | Cluster Size | Min 5, Max 50 nodes per cluster |
| BR-02 | Deterministic | Same input produces same clusters |
| BR-03 | Connectivity Priority | Edge weight 2x type weight |
| BR-04 | Isolated Nodes | 0-edge nodes never clustered |
| BR-05 | Max Super Nodes | 100 or fewer at max zoom-out |
| BR-06 | Hysteresis | collapseThreshold = expand x 1.4 |
| BR-07 | Frame Budget | Distance checks under 2ms per frame |
| BR-08 | Expand Priority | Closest to camera first |
| BR-09 | Interaction Lock | No collapse while hovering |
| BR-10 | Node Budget | visibleNodes never exceeds 100 |
| BR-11 | Collapse Priority | Farthest from camera first |
| BR-12 | Relative Paths | All URLs use basePath helper |

### 3.3 Configuration Parameters

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| expandThreshold | 50 | 20-200 | World units to expand |
| collapseThreshold | 70 | 28-280 | Auto = expand x 1.4 |
| animationDuration | 400 | 200-1000 | ms for transitions |
| maxVisibleNodes | 100 | 50-500 | Max rendered nodes |
| minClusterSize | 5 | 2-20 | Min per cluster |
| maxClusterSize | 50 | 20-200 | Max per cluster |
| lodEnabled | true | bool | Toggle LOD |

---

### 3.4 Backend API Contract

Implemented in all 3 MCP servers (NodeJS, Python, Kotlin).

**Endpoint:** `GET /api/memory/graph/data`

**New parameter:** `lod=true` — returns totalNodes/totalEdges counts so client knows if LOD is needed.

**Response with lod=true adds:**
- `totalNodes: number` — total nodes in KB (may exceed limit)
- `totalEdges: number` — total edges in KB

No new endpoints. LOD clustering is 100% client-side in shared/viewer/.

#### 3.4.1 Server Implementation Changes

**NodeJS** (`api-routes.ts` handleGraphData):
- Parse `lod` query param
- If lod=true: add totalNodes/totalEdges to response
- Increase default limit from 500 to 5000

**Python** (`api_routes.py` _handle_graph_data):
- Same changes as NodeJS

**Kotlin** (`MemoryApiRoutes.kt` handleGraphData):
- Same changes as NodeJS

---

### 3.5 Frontend LOD API

```typescript
interface LODManager {
  initialize(nodes: GraphNode[], edges: GraphEdge[]): void
  update(cameraPosition: Vector3): void
  expandCluster(clusterId: string): void
  collapseCluster(clusterId: string): void
  getVisibleNodeCount(): number
  setConfig(config: Partial<LODConfig>): void
  dispose(): void
}

interface LODConfig {
  expandThreshold: number
  collapseThreshold: number
  animationDuration: number
  maxVisibleNodes: number
  minClusterSize: number
  maxClusterSize: number
  lodEnabled: boolean
}

interface Cluster {
  id: string
  label: string
  childNodeIds: string[]
  center: { x: number, y: number, z: number }
  radius: number
  dominantType: string
  state: 'COLLAPSED'|'EXPANDING'|'EXPANDED'|'COLLAPSING'
}
```

### 3.6 Integration with graph.js

LOD hooks into existing ForceGraph3D in `shared/viewer/graph.js`:

```javascript
// In initGraph() after ForceGraph3D setup:
if (allNodes.length > 100 && window.LODManager) {
  window.lodInstance = new LODManager(graph3d, allNodes, links);
  window.lodInstance.initialize();
}
```

Uses existing `API` variable (basePath-relative). No absolute URLs.


## 4. State Machine

### 4.1 Cluster States

| State | Description | Visual |
|-------|-------------|--------|
| COLLAPSED | Default state | Super node with count badge |
| EXPANDING | Animating open | Children emerging |
| EXPANDED | Detail visible | Individual nodes and edges |
| COLLAPSING | Animating close | Children returning to center |

### 4.2 State Transitions

| From | To | Trigger | Guard |
|------|-----|---------|-------|
| COLLAPSED | EXPANDING | distance < expandThreshold | budget allows |
| EXPANDING | EXPANDED | animation done | none |
| EXPANDED | COLLAPSING | distance > collapseThreshold | not interacting |
| COLLAPSING | COLLAPSED | animation done | none |
| EXPANDING | COLLAPSED | rapid zoom out cancels | none |
| COLLAPSING | EXPANDED | rapid zoom in cancels | none |

---

## 5. Animation Specs

### 5.1 Expand (400ms)

| Phase | Time | Action |
|-------|------|--------|
| 1 | 0-80ms | Super node fades out |
| 2 | 80ms | Create children at center (scale 0) |
| 3 | 80-320ms | Animate to orbital positions (easeOutCubic) |
| 4 | 320-400ms | Fade in intra-cluster edges |

### 5.2 Collapse (400ms)

| Phase | Time | Action |
|-------|------|--------|
| 1 | 0-80ms | Fade out edges |
| 2 | 80-320ms | Children animate to center (easeInCubic) |
| 3 | 320ms | Remove children |
| 4 | 320-400ms | Super node fades in |

### 5.3 Orbital Layout

Children positioned radially around cluster center:
- 20 or fewer nodes: single ring
- More than 20: two concentric rings
- Y-axis variation for 3D depth perception


---

## 6. UI Specifications

### 6.1 Super Node Visual

| Property | Value |
|----------|-------|
| Shape | Sphere, larger than regular nodes |
| Size | radius = 2.0 + log(childCount) x 0.5 |
| Color | Dominant node type color |
| Opacity | 0.8 |
| Badge | White circle with count |
| Label | Cluster name below |

### 6.2 LOD Controls (graph toolbar)

| Control | Type | Default |
|---------|------|---------|
| LOD Toggle | Checkbox | ON |
| Node Budget | Slider | 100 |
| Expand Distance | Slider | 50 |

### 6.3 URL Rules

All fetches use existing `API` variable (basePath-relative):
```
const API = basePath + '/api/memory';
```
No absolute paths. No hardcoded ports.


---

## 7. Deployment Across 4 Components

| Component | Modified | Added |
|-----------|----------|-------|
| shared/viewer/ | graph.js, index.html | lod-manager.js, lod-clustering.js, lod-animation.js |
| NodeJS MCP | api-routes.ts | none |
| Python MCP | api_routes.py | none |
| Kotlin MCP | MemoryApiRoutes.kt | none |
| Extension | graph-panel.ts | none |

Kotlin copies shared/ at build time. Extension loads via webview HTML.

---

## 8. Error Handling

| Code | Condition | Response |
|------|-----------|----------|
| LOD-001 | Clustering timeout | Fallback to octree |
| LOD-002 | WebGL context lost | Attempt restore |
| LOD-003 | Frame drop | Skip to end state |
| LOD-004 | Memory limit | Reduce maxVisibleNodes |
| LOD-005 | Invalid data | Show error message |

---

## 9. Non-Functional Requirements

| ID | Category | Metric |
|----|----------|--------|
| NFR-01 | Clustering perf | 2s max for 10k nodes |
| NFR-02 | Frame rate | 30+ FPS with 100 visible |
| NFR-03 | Distance check | under 2ms/frame |
| NFR-04 | Memory | under 500MB for 10k |
| NFR-05 | Animation | No visible jank |
| NFR-06 | Determinism | Same input = same output |
| NFR-07 | Cross-component | Same behavior in all 4 |

---

## 10. Open Issues

| ID | Issue | Owner | Status |
|----|-------|-------|--------|
| OI-01 | Optimal threshold values | Dev | Needs user testing |
| OI-02 | Multi-level clustering (v2) | SA | Deferred |
| OI-03 | Edge bundling | Dev | Nice-to-have |

---

## 11. Appendix

### 11.1 Pseudocode: LOD Update Loop

```
function updateLOD(camera, clusters):
  for each cluster in clusters:
    dist = camera.position.distanceTo(cluster.center)
    if cluster.state == COLLAPSED and dist < expandThreshold:
      if canExpand(cluster): expandCluster(cluster)
      else: collapseFarthest(); expandCluster(cluster)
    elif cluster.state == EXPANDED and dist > collapseThreshold:
      if not isInteracting(cluster): collapseCluster(cluster)
```

### 11.2 Pseudocode: Louvain Clustering

```
function louvainCluster(nodes, edges):
  communities = assignInitial(nodes)
  repeat until no improvement:
    for each node: move to best community
  splitOversized(maxClusterSize)
  mergeTiny(minClusterSize)
  return communities
```

### Diagram Index

| # | Diagram | Source |
|---|---------|--------|
| 1 | System Context | diagrams/system-context.drawio |
| 2 | Cluster State Machine | diagrams/state-cluster.drawio |
| 3 | Sequence: Expand | diagrams/sequence-expand.drawio |
