/**
 * DashboardPanel — summary metrics webview.
 * Implements TDD §5.1 panels/DashboardPanel.ts, FSD UC-5.
 */
import * as vscode from 'vscode';
export class DashboardPanel {
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
        this.panel = vscode.window.createWebviewPanel('codeIntel.dashboard', 'Dashboard', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
        this.panel.onDidDispose(() => {
            this.panel = null;
        });
        this.panel.webview.onDidReceiveMessage(async (msg) => {
            if (msg.type === 'refresh') {
                await this.refresh();
            }
        });
        this.panel.webview.html = this.getHtml();
        this.refresh();
    }
    async refresh() {
        if (!this.panel)
            return;
        const data = await this.dataFetcher.fetch('/api/dashboard/summary');
        this.panel.webview.postMessage({ type: 'update', data });
    }
    close() {
        this.panel?.dispose();
        this.panel = null;
    }
    getHtml() {
        return [
            '<!DOCTYPE html>',
            '<html lang="en">',
            '<head>',
            '  <meta charset="UTF-8">',
            '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
            '  <title>Dashboard</title>',
            '  <style>',
            '    body { font-family: var(--vscode-font-family); padding: 16px; color: var(--vscode-foreground); }',
            '    .card { border: 1px solid var(--vscode-panel-border); border-radius: 4px; padding: 16px; margin: 8px 0; }',
            '    .metric { font-size: 2em; font-weight: bold; }',
            '    .label { opacity: 0.7; font-size: 0.85em; }',
            '    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }',
            '    .loading { text-align: center; padding: 40px; opacity: 0.7; }',
            '  </style>',
            '</head>',
            '<body>',
            '  <h2>Code Intelligence Dashboard</h2>',
            '  <div id="root"><div class="loading">Loading dashboard...</div></div>',
            '  <script>',
            '    const vscode = acquireVsCodeApi();',
            '    window.addEventListener("message", (event) => {',
            '      const msg = event.data;',
            '      if (msg.type === "update" && msg.data) {',
            '        const d = msg.data;',
            '        document.getElementById("root").innerHTML =',
            '          "<div class=\\"grid\\">" +',
            '          "<div class=\\"card\\"><div class=\\"metric\\">" + d.totalEntries + "</div><div class=\\"label\\">Total Entries</div></div>" +',
            '          "<div class=\\"card\\"><div class=\\"metric\\">" + d.recentCount + "</div><div class=\\"label\\">Recent</div></div>" +',
            '          "<div class=\\"card\\"><div class=\\"metric\\">" + (d.modulesReady ? "Ready" : "Starting") + "</div><div class=\\"label\\">Modules</div></div>" +',
            '          "</div>";',
            '      } else if (msg.type === "update") {',
            '        document.getElementById("root").innerHTML = "<div class=\\"loading\\">Backend offline</div>";',
            '      }',
            '    });',
            '  </script>',
            '</body>',
            '</html>',
        ].join('\n');
    }
}
//# sourceMappingURL=DashboardPanel.js.map