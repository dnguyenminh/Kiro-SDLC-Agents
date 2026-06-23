/**
 * AnalyticsPanel — analytics and quality overview webview.
 * Implements TDD §5.1 panels/AnalyticsPanel.ts, FSD UC-5.
 */

import * as vscode from 'vscode';
import { WebviewDataFetcher } from '../WebviewDataFetcher';

export interface AnalyticsData {
  totalQueries: number;
  avgLatency: number;
  topTools: Array<{ name: string; count: number }>;
}

export class AnalyticsPanel {
  private panel: vscode.WebviewPanel | null = null;
  private readonly dataFetcher: WebviewDataFetcher;

  constructor(dataFetcher: WebviewDataFetcher, _extensionUri: vscode.Uri) {
    this.dataFetcher = dataFetcher;
  }

  show(): void {
    if (this.panel) {
      this.panel.reveal();
      this.refresh();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'codeIntel.analytics',
      'Analytics',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true },
    );

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

  async refresh(): Promise<void> {
    if (!this.panel) return;
    const data = await this.dataFetcher.fetch<AnalyticsData>('/api/analytics/overview');
    this.panel.webview.postMessage({ type: 'update', data });
  }

  close(): void {
    this.panel?.dispose();
    this.panel = null;
  }

  private getHtml(): string {
    return [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '<head>',
      '  <meta charset="UTF-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
      '  <title>Analytics</title>',
      '  <style>',
      '    body { font-family: var(--vscode-font-family); padding: 16px; color: var(--vscode-foreground); }',
      '    .card { border: 1px solid var(--vscode-panel-border); border-radius: 4px; padding: 16px; margin: 8px 0; }',
      '    .metric { font-size: 2em; font-weight: bold; }',
      '    .label { opacity: 0.7; font-size: 0.85em; }',
      '    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }',
      '    .tool-list { margin-top: 16px; }',
      '    .tool-item { padding: 4px 0; display: flex; justify-content: space-between; }',
      '    .loading { text-align: center; padding: 40px; opacity: 0.7; }',
      '  </style>',
      '</head>',
      '<body>',
      '  <h2>Analytics</h2>',
      '  <div id="root"><div class="loading">Loading analytics...</div></div>',
      '  <script>',
      '    const vscode = acquireVsCodeApi();',
      '    window.addEventListener("message", (event) => {',
      '      const msg = event.data;',
      '      if (msg.type === "update" && msg.data) {',
      '        const d = msg.data;',
      '        let html = "<div class=\\"grid\\">";',
      '        html += "<div class=\\"card\\"><div class=\\"metric\\">" + d.totalQueries + "</div><div class=\\"label\\">Total Queries</div></div>";',
      '        html += "<div class=\\"card\\"><div class=\\"metric\\">" + d.avgLatency + "ms</div><div class=\\"label\\">Avg Latency</div></div>";',
      '        html += "</div>";',
      '        if (d.topTools && d.topTools.length) {',
      '          html += "<div class=\\"tool-list\\"><h3>Top Tools</h3>";',
      '          for (const t of d.topTools) {',
      '            html += "<div class=\\"tool-item\\"><span>" + t.name + "</span><span>" + t.count + "</span></div>";',
      '          }',
      '          html += "</div>";',
      '        }',
      '        document.getElementById("root").innerHTML = html;',
      '      }',
      '    });',
      '  </script>',
      '</body>',
      '</html>',
    ].join('\n');
  }
}
