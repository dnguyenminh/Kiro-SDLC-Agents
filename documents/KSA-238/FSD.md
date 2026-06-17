# Functional Specification Document (FSD)

## Kiro SDLC Agents — KSA-238: LangGraph Workflow Visualization Panel

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-238 |
| Title | LangGraph Workflow Visualization Panel - D3.js + dagre interactive graph |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-06-07 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-238.docx |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the Workflow Visualization Panel — a new VS Code webview panel that renders the full SDLC LangGraph pipeline as an interactive D3.js + dagre directed graph.

### 1.2 Scope

- New WorkflowPanel class extending BasePanel
- New PanelType "workflow" added to type system
- New command kiroSdlc.openWorkflowGraph registered in extension
- New webview asset workflow-graph.js bundled with D3.js + dagre
- Graph data extraction from sdlc-graph.ts node/edge definitions

### 1.3 Definitions

| Term | Definition |
|------|------------|
| DAG | Directed Acyclic Graph |
| dagre | JavaScript library for directed graph layout |
| D3.js | Data-Driven Documents — SVG visualization library |
| CSP | Content Security Policy |
| LangGraph | LangChain graph-based workflow framework |

---

## 2. System Overview

### 2.1 System Context

The WorkflowPanel operates within the VS Code extension host. It reads static graph structure data (nodes and edges defined in sdlc-graph.ts), serializes it, and sends to a webview that renders it using D3.js + dagre.

### 2.2 Component Interaction

- Extension Host to Webview: graph data via postMessage
- Webview to Extension Host: user actions (node click, refresh) via postMessage
- Extension Host reads graph definition at panel creation time

---

## 3. Functional Requirements

### 3.1 Feature: Open Workflow Graph Panel

**Use Case ID:** UC-1
**Actor:** Developer
**Preconditions:** Extension is activated
**Postconditions:** Workflow graph panel is visible with full pipeline rendered

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Executes command | | "Kiro SDLC: Open Workflow Graph" |
| 2 | | WebviewPanelManager.openPanel("workflow") | Creates or reveals |
| 3 | | WorkflowPanel.create() | Creates webview with HTML |
| 4 | | WorkflowPanel.loadData() | Extracts graph structure |
| 5 | | postMessage workflowData | Sends nodes+edges JSON |
| 6 | | dagre.layout() + D3.js render | Computes layout, renders SVG |
| 7 | Views graph | | Graph is interactive |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | Panel already open | Reveal existing panel, no re-render |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Graph extraction fails | Show error overlay with retry |

**Business Rules:**

| Rule ID | Rule |
|---------|------|
| BR-1 | Only one workflow panel instance (singleton via PanelManager) |
| BR-2 | Panel retains context when hidden |
| BR-3 | Graph data is static, computed once at open |
| BR-4 | All 35 nodes from sdlc-graph.ts must render |
| BR-5 | Node colors differentiate by type category |

---

### 3.2 Feature: Node Interaction

**Use Case ID:** UC-2
**Actor:** Developer

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Hovers node | | Mouse enters node |
| 2 | | Highlight + dim others | Connected edges glow, others 30% opacity |
| 3 | | Show tooltip | Node ID, type, agent class |
| 4 | Clicks node | | Mouse click |
| 5 | | Show detail sidebar | Upstream, downstream, edge labels |
| 6 | Clicks background | | Deselect |
| 7 | | Reset all opacity | Normal state |

---

### 3.3 Feature: Pan and Zoom

**Use Case ID:** UC-3

**Business Rules:**

| Rule ID | Rule |
|---------|------|
| BR-6 | Zoom range: 25% to 400% |
| BR-7 | Zoom centers on cursor position |
| BR-8 | Fit button shows all nodes with 10% padding |

---

### 3.4 Feature: Visual Edge Classification

**Business Rules:**

| Rule ID | Rule |
|---------|------|
| BR-9 | Direct edges: solid 2px line with arrowhead |
| BR-10 | Conditional edges: dashed 2px line with arrowhead |
| BR-11 | Edge labels at midpoint |
| BR-12 | Conditional edges colored by routing outcome |

---

### 3.5 Feature: Theme Integration

**Business Rules:**

| Rule ID | Rule |
|---------|------|
| BR-13 | Background: var(--vscode-editor-background) |
| BR-14 | Text: var(--vscode-foreground) |
| BR-15 | Node fill uses semi-transparent theme-aware colors |
| BR-16 | No hardcoded hex colors in rendering |

---

## 4. Data Model

### 4.1 Graph Data Types

```typescript
interface WorkflowGraphData {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  metadata: { totalNodes: number; totalEdges: number; generatedAt: string; };
}

interface WorkflowNode {
  id: string;
  label: string;
  type: "agent" | "quality_gate" | "verify" | "security" | "control";
  agentClass?: string;
  description?: string;
}

interface WorkflowEdge {
  source: string;
  target: string;
  type: "direct" | "conditional";
  label?: string;
  routingFn?: string;
}
```

### 4.2 Message Protocol

**Extension to Webview:**

| Message Type | Payload | Trigger |
|-------------|---------|---------|
| workflowData | WorkflowGraphData | loadData() |
| serverStatus | { status } | MCP status change |
| error | { message, retryable } | On error |

**Webview to Extension:**

| Message Type | Payload | Trigger |
|-------------|---------|---------|
| ready | {} | DOM loaded |
| refresh | {} | User requests re-render |
| nodeClick | { nodeId } | User clicks node |

---

## 5. Integration: Graph Data Source

**Source:** sdlc-graph.ts buildSdlcSubgraph()

**Extraction Strategy:** Maintain a static SDLC_GRAPH_DEFINITION constant that mirrors the graph structure. This avoids runtime TypeScript parsing.

**Node extraction from code patterns:**
- `.addNode("name", handler)` → node with ID "name"
- Node type classified by naming convention: quality_gate_* = gate, verify_* = verify, security_* = security, *_join/feedback_check/strategy_switch = control, all others = agent

**Edge extraction from code patterns:**
- `.addEdge("source", "target")` → direct edge
- `.addConditionalEdges("source", routeFn, { key: "target" })` → conditional edges, one per map entry

---

## 6. Processing Logic

### 6.1 dagre Layout Configuration

```typescript
const g = new dagre.graphlib.Graph();
g.setGraph({ rankdir: "TB", nodesep: 50, ranksep: 80, marginx: 20, marginy: 20 });
g.setDefaultEdgeLabel(() => ({}));

// Add nodes with fixed dimensions
nodes.forEach(n => g.setNode(n.id, { label: n.label, width: 160, height: 50 }));

// Add edges
edges.forEach(e => g.setEdge(e.source, e.target, { label: e.label || "" }));

dagre.layout(g);
```

### 6.2 D3.js Rendering

- SVG container with `d3.zoom()` behavior attached
- Nodes rendered as `<g>` groups with `<rect>` + `<text>`
- Edges rendered as `<path>` with `d3.line().curve(d3.curveBasis)`
- Arrowheads via SVG `<marker>` definitions

---

## 7. Security

- CSP: `script-src 'nonce-{n}'; style-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} data:; connect-src 'none'`
- All assets bundled locally in webview-assets/
- No external network access

---

## 8. Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| Performance | Initial render | < 2 seconds |
| Performance | Pan/zoom | 60fps |
| Memory | Webview usage | < 50MB |
| Compatibility | VS Code | 1.85+ |
| Accessibility | Keyboard nav | Tab between nodes |

---

## 9. Error Handling

| Scenario | Severity | Message | Behavior |
|----------|----------|---------|----------|
| Graph data unavailable | Warning | "Unable to load workflow graph" | Error overlay + retry |
| dagre layout fails | Warning | "Layout failed" | Fall back to grid |
| Webview init fails | Critical | VS Code standard error | Panel not created |

---

## 10. Testing Considerations

| ID | Scenario | Expected | Priority |
|----|----------|----------|----------|
| TC-1 | Open panel first time | 35 nodes rendered | High |
| TC-2 | Singleton behavior | Reveal, not duplicate | High |
| TC-3 | Hover node | Tooltip + highlight | High |
| TC-4 | Click node | Detail sidebar | Medium |
| TC-5 | Zoom | Smooth scaling | High |
| TC-6 | Pan | Viewport moves | High |
| TC-7 | Fit to view | All nodes visible | Medium |
| TC-8 | Dark theme | Correct contrast | Medium |
| TC-9 | Light theme | Correct contrast | Medium |

---

## 11. Appendix

### Node Type Classification (35 nodes)

| Category | Count | Nodes |
|----------|-------|-------|
| Agent | 14 | sm, ba_brd, ba_fsd, ta_enrich, sa_tdd, qa_plan, dev_code, dev_ug, ba_review_ug, qa_verify_ug, qa_test, devops_deploy, ba_fix_fsd, sa_review |
| Quality Gate | 8 | quality_gate_requirements, _specification, _design, _test_planning, _implementation, _user_guide, _testing, _deployment |
| Verify | 6 | verify_ba_brd, verify_ba_fsd, verify_sa_tdd, verify_qa_plan, verify_dev_code, verify_dev_ug |
| Security | 3 | security_review_fsd, security_review_tdd, security_review_code |
| Control | 4 | feedback_check, ug_join, strategy_switch, __start__ |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence: Open Panel | [sequence-open-panel.png](diagrams/sequence-open-panel.png) | [sequence-open-panel.drawio](diagrams/sequence-open-panel.drawio) |
| 3 | State: Panel Lifecycle | [state-panel.png](diagrams/state-panel.png) | [state-panel.drawio](diagrams/state-panel.drawio) |
