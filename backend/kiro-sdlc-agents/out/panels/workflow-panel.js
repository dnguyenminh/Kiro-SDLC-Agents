"use strict";
/**
 * WorkflowPanel — Interactive D3.js + dagre visualization of the SDLC pipeline graph.
 * Renders all LangGraph nodes, edges, and conditional routing in a VS Code webview.
 * KSA-238
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowPanel = void 0;
const base_panel_1 = require("./base-panel");
const workflow_graph_data_1 = require("../langgraph/workflow-graph-data");
class WorkflowPanel extends base_panel_1.BasePanel {
    constructor(mcpManager, extensionUri) {
        super("workflow", mcpManager, extensionUri);
    }
    getHtml(webview) {
        const nonce = this.getNonce();
        const cspSource = webview.cspSource;
        const threeUri = this.getWebviewUri(webview, "webview-assets", "three.min.js");
        const forceGraphUri = this.getWebviewUri(webview, "webview-assets", "3d-force-graph.min.js");
        const cssUri = this.getWebviewUri(webview, "webview-assets", "workflow-graph.css");
        const jsUri = this.getWebviewUri(webview, "webview-assets", "workflow-graph.js");
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' 'unsafe-eval'; style-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} data: blob:; connect-src 'none';">
    <title>SDLC Workflow Graph</title>
    <link rel="stylesheet" href="${cssUri}">
</head>
<body>
    <div id="toolbar">
      <button id="refresh-btn" title="Refresh">&#x21BB; Refresh</button>
    </div>
    <div id="phase-bar"></div>
    <div id="graph-3d"></div>
    <div id="node-info" class="hidden"></div>
    <div id="graph-container" style="display:none"></div>
    <div id="path-section" class="hidden" style="display:none"><div id="path-header"><span id="path-title"></span><button id="path-close"></button></div><div id="path-graph"></div></div>
    <div id="node-detail" class="hidden" style="display:none"><div id="detail-header"><span id="detail-title"></span><button id="detail-close"></button></div><div id="detail-body"></div></div>

    <script nonce="${nonce}" src="${threeUri}"></script>
    <script nonce="${nonce}" src="${forceGraphUri}"></script>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      window.addEventListener('message', (event) => {
        const msg = event.data;
        if (typeof handlePanelMessage === 'function') handlePanelMessage(msg);
      });
      vscode.postMessage({ type: 'ready' });
    </script>
    <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
    }
    async loadData() {
        this.sendMessage({
            type: "workflowData",
            nodes: workflow_graph_data_1.SDLC_GRAPH_DEFINITION.nodes,
            edges: workflow_graph_data_1.SDLC_GRAPH_DEFINITION.edges,
            metadata: workflow_graph_data_1.SDLC_GRAPH_DEFINITION.metadata,
        });
    }
    async handleMessage(msg) {
        switch (msg.type) {
            case "ready":
                await this.loadData();
                break;
            case "refresh":
                await this.loadData();
                break;
        }
    }
}
exports.WorkflowPanel = WorkflowPanel;
//# sourceMappingURL=workflow-panel.js.map