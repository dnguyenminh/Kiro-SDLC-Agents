# Business Requirements Document (BRD)

## Kiro SDLC Agents — KSA-238: LangGraph Workflow Visualization Panel - D3.js + dagre interactive graph

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-238 |
| Title | LangGraph Workflow Visualization Panel - D3.js + dagre interactive graph |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-06-07 |
| Status | Draft |
| Architecture Pattern | Plugin (VS Code Extension) |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-07 | BA Agent | Initial BRD from Jira ticket KSA-238 |

---

## 1. Introduction

### 1.1 Scope

Create an interactive workflow visualization panel (`workflow-panel.ts`) within the Kiro SDLC Agents VS Code extension that renders the full SDLC pipeline graph (35 nodes, conditional edges, feedback loops, quality gates) using D3.js + dagre layout algorithm. The panel allows users to visually inspect the LangGraph workflow structure including nodes, edges, and conditional routing paths directly inside VS Code.

### 1.2 Out of Scope

- Live execution state tracking (highlighting active nodes during pipeline run)
- Editing the graph structure via the panel (read-only visualization)
- Integration with external graph databases
- Exporting graph as image/PDF from the panel
- Mobile/browser standalone version

### 1.3 Preliminary Requirements

- VS Code extension host (v1.85.0+)
- Existing BasePanel abstract class for webview lifecycle management
- Existing PanelType enum and PANEL_VIEW_TYPES / PANEL_TITLES constants
- Existing WebviewPanelManager factory pattern
- Access to sdlc-graph.ts structure (node definitions, edge definitions, conditional routing)

---

## 2. Business Requirements

### 2.1 High Level Process Map

The workflow visualization panel provides developers and project managers with a visual representation of the SDLC pipeline. Users open the panel via a VS Code command, the extension reads the graph structure from sdlc-graph.ts, transforms it into a renderable format, and D3.js + dagre renders an interactive directed acyclic graph in a webview.

### 2.2 List of User Stories

| # | Story / Use Case | Priority | Source Ticket |
|---|-----------------|----------|---------------|
| 1 | As a developer, I want to see the full SDLC pipeline graph so that I can understand the workflow structure | MUST HAVE | KSA-238 |
| 2 | As a developer, I want to interact with graph nodes (hover, click) so that I can see node details | MUST HAVE | KSA-238 |
| 3 | As a developer, I want to pan and zoom the graph so that I can navigate large pipeline structures | MUST HAVE | KSA-238 |
| 4 | As a developer, I want conditional edges visually distinct so that I can understand routing logic | SHOULD HAVE | KSA-238 |
| 5 | As a developer, I want the panel to follow VS Code theme so that it integrates seamlessly | SHOULD HAVE | KSA-238 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** User executes command "Kiro SDLC: Open Workflow Graph" from command palette or sidebar

**Step 2:** Extension creates/reveals WorkflowPanel webview (singleton pattern via WebviewPanelManager)

**Step 3:** Extension reads graph structure (nodes, edges, conditional edges) from sdlc-graph definition

**Step 4:** Extension serializes graph data and sends to webview via postMessage

**Step 5:** Webview JavaScript (D3.js + dagre) computes layout and renders SVG graph

**Step 6:** User interacts with graph (pan, zoom, hover nodes, click nodes for details)

---

#### STORY 1: View Full SDLC Pipeline Graph

> As a developer, I want to see the full SDLC pipeline graph so that I can understand the workflow structure including all 35 nodes, edges, and conditional routing.

**Requirement Details:**

1. Render all nodes from sdlc-graph.ts: sm, ba_brd, ba_fsd, ta_enrich, sa_tdd, feedback_check, ba_fix_fsd, sa_review, qa_plan, dev_code, dev_ug, ba_review_ug, qa_verify_ug, qa_test, devops_deploy, security_review_fsd, security_review_tdd, security_review_code, quality_gate_* (8 gates), verify_* (6 verify nodes), strategy_switch, ug_join
2. Render all edges including conditional edges with labels showing routing conditions
3. Use dagre for automatic hierarchical layout (top-to-bottom)
4. Node colors differentiate node types: agent nodes, quality gates, verify nodes, strategy switch

**Acceptance Criteria:**

1. All 35 nodes from sdlc-graph.ts are rendered in the panel
2. All edges (direct + conditional) are rendered with directional arrows
3. Graph layout is readable without manual positioning
4. Graph renders within 2 seconds for the full pipeline
5. Panel opens without errors in VS Code 1.85+

---

#### STORY 2: Interactive Node Inspection

> As a developer, I want to interact with graph nodes (hover, click) so that I can see node details like agent type, connected edges, and routing conditions.

**Requirement Details:**

1. Hover on node: highlight node + connected edges, show tooltip with node name and type
2. Click on node: show detail panel with full node info (agent class, connected nodes)
3. Hover on edge: show edge label (routing condition or "always")

**Acceptance Criteria:**

1. Hovering a node highlights it and dims non-connected nodes
2. Tooltip shows: node ID, node type (agent/gate/verify/switch)
3. Clicking a node shows detail info (connected upstream/downstream nodes)
4. Hovering an edge shows routing label

---

#### STORY 3: Pan and Zoom Navigation

> As a developer, I want to pan and zoom the graph so that I can navigate the large pipeline (35+ nodes) comfortably.

**Requirement Details:**

1. Mouse wheel zoom (smooth, centered on cursor)
2. Click-drag to pan
3. Fit-to-view button to reset zoom/position

**Acceptance Criteria:**

1. Mouse wheel zooms in/out smoothly
2. Click-drag pans the viewport
3. "Fit" button resets view to show entire graph
4. Zoom range: 25% to 400%

---

#### STORY 4: Visual Distinction for Conditional Edges

> As a developer, I want conditional edges visually distinct from direct edges so that I can understand routing logic at a glance.

**Requirement Details:**

1. Direct edges: solid line with arrow
2. Conditional edges: dashed line, colored by routing type
3. Edge labels show routing function name or simplified condition

**Acceptance Criteria:**

1. Conditional edges are visually different from direct edges (dashed vs solid)
2. Edge labels are readable at default zoom level
3. Legend shows edge type meanings

---

#### STORY 5: VS Code Theme Integration

> As a developer, I want the panel to follow VS Code theme (dark/light) so that it integrates seamlessly with my editor.

**Requirement Details:**

1. Use VS Code CSS variables for colors (--vscode-foreground, --vscode-editor-background, etc.)
2. Node colors adapt to dark/light theme
3. Edge colors have sufficient contrast in both themes

**Acceptance Criteria:**

1. Panel background matches editor background
2. Text is readable in both dark and light themes
3. No hardcoded colors that break in either theme

---

## 3. Dependencies

| Dependency | Type | Description |
|------------|------|-------------|
| D3.js | Library | SVG rendering and interaction (zoom, pan, events) |
| dagre / dagre-d3 | Library | Directed graph layout algorithm |
| BasePanel | Internal | Abstract base class for webview lifecycle |
| PanelType enum | Internal | Must add "workflow" type |
| WebviewPanelManager | Internal | Must register WorkflowPanel in factory |
| sdlc-graph.ts | Internal | Source of graph structure data (nodes/edges) |
| VS Code Webview API | Platform | Webview panel, postMessage, CSP |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| D3.js bundle size affects extension startup | Medium | Low | Lazy-load webview assets, not on extension activate |
| CSP restrictions block D3.js execution | High | Medium | Use nonce-based CSP, bundle D3.js as local asset |
| dagre layout struggles with 35+ nodes | Medium | Low | Test with full graph, use spacing/ranking hints |
| Webview memory usage with large SVG | Low | Low | Viewport culling for off-screen nodes |

### 5.2 Assumptions

- D3.js and dagre can be bundled as webview-assets and loaded via CSP nonce
- Graph structure can be extracted statically from sdlc-graph.ts node/edge definitions
- VS Code webview retainContextWhenHidden preserves graph state when panel hidden
- No WebSocket/live connection needed: graph data sent once via postMessage

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Graph renders in < 2 seconds | Full 35-node graph with layout computation |
| Performance | Pan/zoom at 60fps | Smooth interaction without jank |
| Memory | < 50MB webview memory | SVG graph should not cause excessive memory |
| Compatibility | VS Code 1.85+ | Minimum engine version from package.json |
| Accessibility | Keyboard navigation | Tab through nodes, Enter for details |
| Security | CSP compliant | No inline scripts, nonce-based script loading |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-238 | LangGraph Workflow Visualization Panel | In Progress | Task | Main ticket |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| DAG | Directed Acyclic Graph — graph with directional edges and no cycles |
| dagre | JavaScript library for directed graph layout algorithms |
| D3.js | Data-Driven Documents — JavaScript library for SVG visualization |
| LangGraph | LangChain's graph-based workflow framework used for SDLC pipeline |
| CSP | Content Security Policy — webview security restriction |
| Webview | VS Code panel that renders HTML/CSS/JS content |

### Node Type Categories (from sdlc-graph.ts)

| Category | Nodes | Color |
|----------|-------|-------|
| Agent | sm, ba_brd, ba_fsd, ta_enrich, sa_tdd, qa_plan, dev_code, dev_ug, ba_review_ug, qa_verify_ug, qa_test, devops_deploy | Blue variants |
| Security | security_review_fsd, security_review_tdd, security_review_code | Red/Orange |
| Quality Gate | quality_gate_requirements, _specification, _design, _test_planning, _implementation, _user_guide, _testing, _deployment | Green |
| Verify | verify_ba_brd, verify_ba_fsd, verify_sa_tdd, verify_qa_plan, verify_dev_code, verify_dev_ug | Yellow |
| Control | feedback_check, ba_fix_fsd, sa_review, ug_join, strategy_switch | Purple |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
