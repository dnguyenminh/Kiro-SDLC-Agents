# Technical Design Document (TDD)

## Kiro SDLC Agents — KSA-238: LangGraph Workflow Visualization Panel

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-238 |
| Title | LangGraph Workflow Visualization Panel - D3.js + dagre interactive graph |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-06-07 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-238.docx |
| Related FSD | FSD-v1-KSA-238.docx |

---

## 1. Architecture Overview

Extension Host (TypeScript) communicates with Webview (HTML/JS) via postMessage. WorkflowPanel extends BasePanel, sends static graph data to webview where D3.js + dagre renders interactive SVG.

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Graph layout | dagre (not force-directed) | DAG preserves hierarchy; force creates spaghetti |
| Rendering | D3.js SVG (not Canvas) | SVG supports CSS, DOM events, accessibility |
| Data source | Static constant | Zero runtime dep on TS compiler |
| Asset bundling | Separate webview-assets JS | CSP nonce loading; matches existing pattern |

---

## 2. Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Extension | TypeScript | 5.4+ |
| Layout | dagre | 0.8.x |
| SVG rendering | D3.js | 7.x |
| Build | esbuild | 0.21+ |
| Webview | VS Code Webview API | 1.85+ |

---

## 3. File Structure — New/Modified Files

### New Files

| File | Purpose |
|------|---------|
| src/panels/workflow-panel.ts | WorkflowPanel class extending BasePanel |
| src/langgraph/workflow-graph-data.ts | Static SDLC_GRAPH_DEFINITION constant |
| webview-assets/workflow-graph.js | D3 + dagre rendering logic |
| webview-assets/workflow-graph.css | Theme-aware styles |

### Modified Files

| File | Change |
|------|--------|
| src/types.ts | Add "workflow" to PanelType, PANEL_VIEW_TYPES, PANEL_TITLES |
| src/webview-panel-manager.ts | Add case "workflow" in createPanel() |
| src/extension.ts | Register kiroSdlc.openWorkflowGraph command |
| package.json | Add command to contributes.commands |

---

## 4. Class Design

### 4.1 WorkflowPanel

```typescript
export class WorkflowPanel extends BasePanel {
  constructor(mcpManager: McpServerManager, extensionUri: vscode.Uri) {
    super("workflow", mcpManager, extensionUri);
  }

  getHtml(webview: vscode.Webview): string {
    const bodyContent = `
      <div id="toolbar">
        <button id="fit-btn" title="Fit to view">Fit</button>
        <span id="zoom-level">100%</span>
      </div>
      <div id="graph-container"></div>
      <div id="node-detail" class="hidden"></div>
    `;
    return this.getBaseHtml(webview, bodyContent, ["workflow-graph.js"], ["workflow-graph.css"]);
  }

  async loadData(): Promise<void> {
    this.sendMessage({ type: "workflowData", ...SDLC_GRAPH_DEFINITION } as any);
  }

  async handleMessage(msg: WebviewToExtMessage): Promise<void> {
    if (msg.type === "ready" || msg.type === "refresh") await this.loadData();
  }
}
```

### 4.2 Graph Data (workflow-graph-data.ts)

Static constant with 35 nodes and ~48 edges. Full definition in Appendix A.

### 4.3 Type Modifications

```typescript
// types.ts additions:
export type PanelType = "graph" | "dashboard" | "tags" | "quality" | "analytics" | "workflow";

// PANEL_VIEW_TYPES:
workflow: "kiroWorkflowGraph",

// PANEL_TITLES:
workflow: "SDLC Workflow Graph",
```

### 4.4 WebviewPanelManager Addition

```typescript
case "workflow":
  return new WorkflowPanel(this.mcpManager, this.extensionUri);
```

### 4.5 Extension.ts Addition

```typescript
vscode.commands.registerCommand("kiroSdlc.openWorkflowGraph", () => panelManager?.openPanel("workflow"))
```

### 4.6 Package.json Addition

```json
{ "command": "kiroSdlc.openWorkflowGraph", "title": "Kiro SDLC: Open Workflow Graph" }
```

---

## 5. Webview Rendering Design

### 5.1 workflow-graph.js Structure

```javascript
function handlePanelMessage(msg) {
  if (msg.type === "workflowData") buildAndRenderGraph(msg.nodes, msg.edges);
}

function buildAndRenderGraph(nodes, edges) {
  // 1. Create dagre graph (rankdir=TB, nodesep=60, ranksep=100)
  // 2. Add nodes (width=160, height=50)
  // 3. Add edges
  // 4. dagre.layout(g)
  // 5. D3 SVG render with zoom behavior
}

function renderGraph(g, nodes, edges) {
  // SVG + inner group for zoom transform
  // Nodes as <g> with <rect> + <text>
  // Edges as <path> with d3.curveBasis
  // Arrowheads via <marker>
  // Event listeners: hover (highlight), click (detail)
}

function fitToView(svg, inner, zoom) {
  // Calculate bounds, set transform to fit all nodes
}
```

### 5.2 Interaction Logic

- **Hover node:** Add "highlighted" class to node + connected edges; add "dimmed" to others
- **Click node:** Populate #node-detail with upstream/downstream info
- **Hover edge:** Show tooltip with routing label
- **Fit button:** Reset zoom to fit bounding box with 10% padding

### 5.3 Theme Integration

All colors via CSS variables or semi-transparent RGBA (works in both dark/light):
- Node fills: 15% opacity colored backgrounds
- Node strokes: 60% opacity colored borders  
- Text: var(--vscode-foreground)
- Background: var(--vscode-editor-background)

---

## 6. Security

CSP inherited from BasePanel: `script-src 'nonce-{n}'; style-src ${cspSource} 'unsafe-inline'; connect-src 'none'`

All assets bundled locally. No CDN, no network access.

---

## 7. Error Handling

| Error | Recovery |
|-------|----------|
| Graph data missing | Show "Graph unavailable" in error overlay |
| dagre layout crash | Fall back to grid layout (nodes in rows of 5) |
| D3 render error | Show text-only node list |

---

## 8. Performance

- dagre layout 35 nodes: ~10-50ms
- D3 SVG render 35 nodes + 48 edges: ~50-100ms
- Total: well under 2s target
- Zoom/pan: native SVG transform, 60fps

---

## 9. Implementation Checklist

| # | Task | File | Priority |
|---|------|------|----------|
| 1 | Add "workflow" to PanelType + constants | src/types.ts | P0 |
| 2 | Add WorkflowPanel case in factory | src/webview-panel-manager.ts | P0 |
| 3 | Register command | src/extension.ts | P0 |
| 4 | Add command to package.json | package.json | P0 |
| 5 | Create workflow-graph-data.ts | src/langgraph/ | P0 |
| 6 | Create workflow-panel.ts | src/panels/ | P0 |
| 7 | Create workflow-graph.css | webview-assets/ | P0 |
| 8 | Create workflow-graph.js (D3+dagre) | webview-assets/ | P0 |

---

## 10. Appendix A: Full Graph Definition

35 nodes across 5 categories:
- Agent (14): sm, ba_brd, ba_fsd, ta_enrich, sa_tdd, qa_plan, dev_code, dev_ug, ba_review_ug, qa_verify_ug, qa_test, devops_deploy, ba_fix_fsd, sa_review
- Quality Gate (8): quality_gate_requirements/specification/design/test_planning/implementation/user_guide/testing/deployment
- Verify (6): verify_ba_brd/ba_fsd/sa_tdd/qa_plan/dev_code/dev_ug
- Security (3): security_review_fsd/tdd/code
- Control (4): feedback_check, ug_join, strategy_switch, __start__

~48 edges connecting the full pipeline with conditional routing.

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
