# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-143: KB Graph — Level of Detail (LOD) / Semantic Zoom

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-143 |
| Title | KB Graph — Level of Detail (LOD) / Semantic Zoom |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-25 |
| Status | Draft |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | SA Agent – Solution Architect | Review technical feasibility |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-25 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-143 |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

This change request implements **Level of Detail (LOD) / Semantic Zoom** for the 3D Knowledge Graph visualization in the VS Code extension. The feature addresses performance degradation when rendering large graphs (10k+ nodes) by dynamically clustering nodes based on camera distance and progressively revealing detail as the user zooms in.

Key capabilities:
1. **Clustering Algorithm** — Group related nodes into clusters based on edge connectivity and type
2. **Camera Distance Detection** — Monitor camera position relative to each cluster in 3D space
3. **Dynamic Load/Unload** — Progressively load child nodes when zooming in, unload when zooming out
4. **Smooth Transitions** — Animated expand/collapse for cluster-to-child-node transitions

### 1.2 Out of Scope

- Changes to the underlying Knowledge Base data model or storage
- Server-side clustering (all clustering is client-side in the extension)
- 2D graph visualization (this feature targets the 3D WebGL renderer only)
- Custom user-defined clustering rules (automatic clustering only in v1)
- Network/API changes to fetch partial graph data (full graph is loaded, LOD is rendering-only)

### 1.3 Preliminary Requirement

- 3D Knowledge Graph renderer must be functional (Three.js / WebGL-based)
- Graph data structure with nodes and edges must be available in memory
- Camera controls (orbit, zoom, pan) must be implemented
- Node type metadata must be available for type-based clustering

---

## 2. Business Requirements

### 2.1 High Level Process Map

The LOD system operates as a real-time rendering optimization pipeline:

1. **Graph Loading** — Full graph data loaded into memory (nodes + edges)
2. **Clustering** — Algorithm groups nodes into clusters based on connectivity/type
3. **Initial Render** — At default zoom, only super nodes (cluster representatives) are rendered
4. **Camera Movement** — User zooms/pans in 3D space
5. **Distance Check** — System evaluates camera distance to each cluster
6. **LOD Transition** — When camera enters threshold distance, cluster expands to show child nodes
7. **Reverse Transition** — When camera moves away, child nodes collapse back into super node

![Business Flow](diagrams/business-flow.png)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a developer, I want the graph to cluster distant nodes into super nodes so that I can navigate large graphs without performance issues | MUST HAVE | KSA-143 |
| 2 | As a developer, I want to zoom into a super node to see its child nodes with smooth animation so that I can explore graph details intuitively | MUST HAVE | KSA-143 |
| 3 | As a developer, I want super nodes to display the count of child nodes inside so that I know the cluster size before zooming in | MUST HAVE | KSA-143 |
| 4 | As a developer, I want the system to maintain less than 100 visible nodes at any zoom level so that rendering stays performant | MUST HAVE | KSA-143 |
| 5 | As a developer, I want zooming out to collapse expanded clusters back into super nodes so that the view stays clean | MUST HAVE | KSA-143 |
| 6 | As a developer, I want the clustering to be based on edge connectivity and node type so that related nodes are grouped logically | SHOULD HAVE | KSA-143 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** System loads full graph data (nodes, edges, types) into memory

**Step 2:** Clustering algorithm processes graph and produces cluster hierarchy (super nodes + child nodes)

**Step 3:** Renderer displays only super nodes at initial zoom level (far view)

**Step 4:** User zooms toward a specific super node using mouse wheel / trackpad

**Step 5:** System detects camera distance crosses threshold for that cluster

**Step 6:** Super node expands with animation and child nodes appear in orbital positions around cluster center

**Step 7:** User can interact with individual child nodes (hover, click, select)

**Step 8:** User zooms out and camera distance exceeds threshold causing child nodes to collapse back into super node with reverse animation

> **Note:** The system must handle multiple clusters at different LOD levels simultaneously. A user may have one cluster expanded while others remain collapsed.

---

#### STORY 1: Cluster Distant Nodes into Super Nodes

> As a developer, I want the graph to cluster distant nodes into super nodes so that I can navigate large graphs without performance issues.

**Requirement Details:**

1. The clustering algorithm MUST group nodes based on edge connectivity (nodes with many shared edges form a cluster)
2. Node type metadata SHOULD be used as a secondary clustering factor (same-type nodes prefer same cluster)
3. Each cluster is represented by a single "super node" in the 3D scene
4. Super node size MUST be visually larger than regular nodes to indicate it represents a group
5. Super node label MUST display the cluster name (derived from dominant node type or most-connected node)
6. The algorithm MUST produce clusters such that at maximum zoom-out, no more than 100 super nodes are visible

**Acceptance Criteria:**

1. At maximum zoom-out, all nodes are grouped into clusters represented by super nodes
2. Super nodes are visually distinct (larger size, different visual style) from regular nodes
3. Total visible objects (super nodes) at max zoom-out is 100 or fewer
4. Clustering completes within 2 seconds for graphs up to 10,000 nodes
5. Cluster membership is deterministic (same graph always produces same clusters)

---

#### STORY 2: Zoom Into Super Node to See Child Nodes

> As a developer, I want to zoom into a super node to see its child nodes with smooth animation so that I can explore graph details intuitively.

**Requirement Details:**

1. When camera distance to a super node crosses the "expand threshold," the super node expands
2. Expansion animation MUST show child nodes emerging from the super node center position
3. Child nodes MUST be positioned in an orbital/radial layout around the cluster center
4. Edges between child nodes within the cluster MUST become visible after expansion
5. Edges from child nodes to nodes in other clusters MUST connect to the respective super node (or expanded child if that cluster is also expanded)
6. Animation duration: 300-500ms with easing

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| expandThreshold | number | Yes | Camera distance at which cluster expands | 50 (world units) |
| collapseThreshold | number | Yes | Camera distance at which cluster collapses (must be greater than expandThreshold to prevent flicker) | 70 (world units) |
| animationDuration | number | No | Duration of expand/collapse animation in ms | 400 |

**Acceptance Criteria:**

1. Zooming toward a super node triggers expansion when camera distance is less than expandThreshold
2. Child nodes appear with smooth animation (no pop-in)
3. Intra-cluster edges are visible after expansion
4. Inter-cluster edges connect correctly to super nodes or expanded children
5. Animation completes within 500ms

---

#### STORY 3: Super Node Displays Child Count

> As a developer, I want super nodes to display the count of child nodes inside so that I know the cluster size before zooming in.

**Requirement Details:**

1. Each super node MUST display a badge/label showing the number of child nodes it contains
2. The count MUST update if the graph data changes (nodes added/removed)
3. Count display MUST be readable at the zoom level where super nodes are visible
4. Count uses format: "N" (e.g., "42") displayed as a badge on the super node

**Acceptance Criteria:**

1. Every super node shows a numeric badge with child count
2. Badge is legible at all zoom levels where the super node is visible
3. Count is accurate (matches actual number of nodes in cluster)

---

#### STORY 4: Maintain Less Than 100 Visible Nodes at Any Zoom Level

> As a developer, I want the system to maintain less than 100 visible nodes at any zoom level so that rendering stays performant.

**Requirement Details:**

1. The LOD system MUST ensure that at any camera position, the total number of rendered nodes (super nodes + expanded child nodes) does not exceed 100
2. If expanding a cluster would exceed the 100-node limit, the system MUST collapse the farthest expanded cluster first
3. Priority for keeping clusters expanded: closest to camera then most recently expanded

**Acceptance Criteria:**

1. At no point during navigation do visible rendered nodes exceed 100
2. Automatic collapse of distant clusters when node budget is exceeded
3. Frame rate maintains 30 FPS or higher with 100 visible nodes on mid-range hardware

---

#### STORY 5: Collapse Clusters When Zooming Out

> As a developer, I want zooming out to collapse expanded clusters back into super nodes so that the view stays clean.

**Requirement Details:**

1. When camera distance to an expanded cluster exceeds the "collapse threshold," child nodes collapse back into super node
2. Collapse threshold MUST be greater than expand threshold (hysteresis to prevent flicker)
3. Collapse animation is the reverse of expand animation
4. All intra-cluster edges disappear during collapse
5. Inter-cluster edges reconnect to the super node

**Acceptance Criteria:**

1. Zooming away from an expanded cluster triggers collapse at collapseThreshold
2. No flickering between expand/collapse states (hysteresis works correctly)
3. Collapse animation is smooth (reverse of expand)
4. After collapse, only the super node is visible for that cluster

---

#### STORY 6: Connectivity-Based Clustering

> As a developer, I want the clustering to be based on edge connectivity and node type so that related nodes are grouped logically.

**Requirement Details:**

1. Primary clustering factor: edge connectivity (nodes with many shared edges cluster together)
2. Secondary clustering factor: node type (same-type nodes prefer same cluster)
3. Algorithm should produce balanced clusters (avoid one giant cluster and many tiny ones)
4. Target cluster size: 5-50 nodes per cluster (configurable)
5. Isolated nodes (no edges) form their own single-node "clusters" (displayed as regular nodes)

**Acceptance Criteria:**

1. Highly connected nodes are in the same cluster
2. Nodes of the same type tend to be in the same cluster
3. No cluster exceeds 50 nodes (default max)
4. Isolated nodes are rendered as regular nodes (not wrapped in a super node)

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| 3D Graph Renderer | System | N/A | Three.js / WebGL renderer must be functional |
| Graph Data Model | System | N/A | Nodes and edges must be loaded in memory with type metadata |
| Camera Controls | System | N/A | Orbit/zoom/pan controls must be implemented |
| VS Code Extension Host | Infrastructure | N/A | Extension must run in VS Code webview with WebGL support |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Product Owner | Duc Nguyen Minh | Define requirements, accept/reject | Reporter |
| Developer | Unassigned | Implement LOD system | Assignee |
| QA | QA Agent | Test performance and visual correctness | Pipeline |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Clustering algorithm too slow for 10k+ nodes | High | Medium | Use efficient graph algorithms (e.g., Louvain community detection) with O(n log n) complexity |
| Animation jank during expand/collapse | Medium | Medium | Use requestAnimationFrame, limit concurrent animations, use GPU-accelerated transforms |
| WebGL memory limits in VS Code webview | High | Low | Implement aggressive unloading of off-screen geometry |
| Hysteresis values cause unexpected behavior | Low | Medium | Make thresholds configurable, test with various graph sizes |

### 5.2 Assumptions

- The 3D graph renderer (Three.js) is already functional and supports dynamic scene graph manipulation
- Graph data is fully loaded in memory (no lazy-loading from server needed for LOD)
- VS Code webview supports WebGL 2.0
- Target hardware: mid-range laptop GPU (Intel Iris / NVIDIA MX series)
- Maximum graph size for v1: 10,000 nodes, 50,000 edges

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Clustering computation 2s or less | For graphs up to 10,000 nodes |
| Performance | Frame rate 30 FPS or higher | With up to 100 visible nodes on mid-range hardware |
| Performance | Visible nodes 100 or fewer | At any zoom level, enforced by LOD system |
| Performance | Animation duration 300-500ms | Expand/collapse transitions |
| Responsiveness | Camera movement lag under 16ms | LOD distance checks must not block render loop |
| Memory | Peak memory under 500MB | For 10k node graph with all LOD data structures |
| Usability | No visual pop-in/pop-out | Smooth transitions only |
| Scalability | Support up to 10,000 nodes | With graceful degradation beyond |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-143 | KB Graph — Level of Detail (LOD) / Semantic Zoom | To Do | Task | Main ticket |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| LOD (Level of Detail) | Technique to reduce rendering complexity by showing less detail for distant objects |
| Semantic Zoom | Zooming that changes the type of information displayed, not just the scale |
| Super Node | A visual representation of a cluster of nodes, displayed when zoomed out |
| Cluster | A group of related nodes determined by the clustering algorithm |
| Expand Threshold | Camera distance at which a super node expands to show child nodes |
| Collapse Threshold | Camera distance at which expanded child nodes collapse back into a super node |
| Hysteresis | Difference between expand and collapse thresholds to prevent flickering |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| Three.js LOD Documentation | https://threejs.org/docs/#api/en/objects/LOD |
| Louvain Community Detection | https://en.wikipedia.org/wiki/Louvain_method |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
