/**
 * KBGraphPanel — Knowledge Base graph visualization webview.
 * Implements TDD §5.1 panels/KBGraphPanel.ts, FSD UC-5.
 */
import * as vscode from 'vscode';
export class KBGraphPanel {
    panel = null;
    dataFetcher;
    constructor(dataFetcher, _extensionUri) {
        this.dataFetcher = dataFetcher;
    }
    show() {
        if (this.panel) {
            this.panel.reveal();
            this.refresh();
            return;
        }
        this.panel = vscode.window.createWebviewPanel('codeIntel.kbGraph', 'KB Graph', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
        this.panel.onDidDispose(() => {
            this.panel = null;
        });
        this.panel.webview.onDidReceiveMessage(async (msg) => {
            if (msg.type === 'refresh') {
                await this.refresh();
            }
            else if (msg.type === 'selectNode') {
                await this.loadNodeDetail(msg.nodeId);
            }
        });
        this.panel.webview.html = this.getHtml();
        this.refresh();
    }
    async refresh() {
        if (!this.panel)
            return;
        const data = await this.dataFetcher.fetch('/api/kb/graph');
        this.panel.webview.postMessage({ type: 'update', data });
    }
    close() {
        this.panel?.dispose();
        this.panel = null;
    }
    async loadNodeDetail(nodeId) {
        if (!this.panel)
            return;
        const data = await this.dataFetcher.fetch('/api/kb/graph/node/' + nodeId);
        this.panel.webview.postMessage({ type: 'nodeDetail', data });
    }
    getHtml() {
        return [
            '<!DOCTYPE html>',
            '<html lang="en">',
            '<head>',
            '  <meta charset="UTF-8">',
            '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
            '  <title>KB Graph</title>',
            '  <style>',
            '    body { font-family: var(--vscode-font-family); padding: 16px; color: var(--vscode-foreground); }',
            '    .node-list { list-style: none; padding: 0; }',
            '    .node-item { padding: 8px; margin: 4px 0; border: 1px solid var(--vscode-panel-border); border-radius: 4px; cursor: pointer; }',
            '    .node-item:hover { background: var(--vscode-list-hoverBackground); }',
            '    .stats { opacity: 0.7; font-size: 0.85em; margin-bottom: 12px; }',
            '    .loading { text-align: center; padding: 40px; opacity: 0.7; }',
            '  </style>',
            '</head>',
            '<body>',
            '  <h2>Knowledge Base Graph</h2>',
            '  <div id="root"><div class="loading">Loading graph...</div></div>',
            '  <script>',
            '    const vscode = acquireVsCodeApi();',
            '    window.addEventListener("message", (event) => {',
            '      const msg = event.data;',
            '      if (msg.type === "update" && msg.data) {',
            '        const d = msg.data;',
            '        let html = "<div class=\\"stats\\">" + d.nodes.length + " nodes, " + d.edges.length + " edges</div>";',
            '        html += "<ul class=\\"node-list\\">";',
            '        for (const node of d.nodes) {',
            '          html += "<li class=\\"node-item\\"><strong>" + node.title + "</strong></li>";',
            '        }',
            '        html += "</ul>";',
            '        document.getElementById("root").innerHTML = html;',
            '      }',
            '    });',
            '    function selectNode(id) { vscode.postMessage({ type: "selectNode", nodeId: id }); }',
            '  </script>',
            '</body>',
            '</html>',
        ].join('\n');
    }
}
//# sourceMappingURL=KBGraphPanel.js.map