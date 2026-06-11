/**
 * WebviewManager — manages Webview panel lifecycle and data loading.
 * Implements TDD §5.3 IWebviewManager, FSD BR-22, BR-23, BR-24, BR-25.
 */

import * as vscode from 'vscode';
import { PanelType } from '../types/config';
import { WebviewDataFetcher } from './WebviewDataFetcher';
import { ConnectionManager } from '../connection/ConnectionManager';

export interface IWebviewManager {
  openPanel(panelId: PanelType): void;
  closePanel(panelId: PanelType): void;
  refreshPanel(panelId: PanelType): void;
}

interface PanelConfig {
  title: string;
  viewType: string;
  dataEndpoint: string;
}

const PANEL_CONFIGS: Record<PanelType, PanelConfig> = {
  dashboard: { title: 'Dashboard', viewType: 'codeIntel.dashboard', dataEndpoint: '/api/dashboard/summary' },
  kbGraph: { title: 'KB Graph', viewType: 'codeIntel.kbGraph', dataEndpoint: '/api/kb/graph' },
  analytics: { title: 'Analytics', viewType: 'codeIntel.analytics', dataEndpoint: '/api/analytics/overview' },
  tags: { title: 'Tags', viewType: 'codeIntel.tags', dataEndpoint: '/api/tags/list' },
  quality: { title: 'Quality', viewType: 'codeIntel.quality', dataEndpoint: '/api/quality/summary' },
};

export class WebviewManager implements IWebviewManager, vscode.Disposable {
  private readonly panels: Map<PanelType, vscode.WebviewPanel> = new Map();
  private readonly dataFetcher: WebviewDataFetcher;
  private readonly extensionUri: vscode.Uri;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    connectionManager: ConnectionManager,
    extensionUri: vscode.Uri
  ) {
    this.dataFetcher = new WebviewDataFetcher(connectionManager);
    this.extensionUri = extensionUri;

    // Refresh panels when backend reconnects
    const stateDisposable = connectionManager.onStateChange((state) => {
      if (state.state === 'CONNECTED') {
        this.refreshAllPanels();
      }
    });
    this.disposables.push(stateDisposable);
  }

  openPanel(panelId: PanelType): void {
    const existing = this.panels.get(panelId);
    if (existing) {
      existing.reveal();
      this.refreshPanel(panelId);
      return;
    }

    const config = PANEL_CONFIGS[panelId];
    const panel = vscode.window.createWebviewPanel(
      config.viewType,
      config.title,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri],
      }
    );

    panel.onDidDispose(() => {
      this.panels.delete(panelId);
    });

    panel.webview.onDidReceiveMessage(async (message) => {
      if (message.type === 'refresh') {
        await this.refreshPanel(panelId);
      } else if (message.type === 'fetch') {
        const data = await this.dataFetcher.fetch(message.path);
        panel.webview.postMessage({ type: 'data', id: message.id, data });
      } else if (message.type === 'post') {
        const data = await this.dataFetcher.post(message.path, message.body);
        panel.webview.postMessage({ type: 'data', id: message.id, data });
      }
    });

    this.panels.set(panelId, panel);
    panel.webview.html = this.getWebviewHtml(panelId);
    this.refreshPanel(panelId);
  }

  closePanel(panelId: PanelType): void {
    const panel = this.panels.get(panelId);
    if (panel) {
      panel.dispose();
      this.panels.delete(panelId);
    }
  }

  async refreshPanel(panelId: PanelType): Promise<void> {
    const panel = this.panels.get(panelId);
    if (!panel) return;

    const config = PANEL_CONFIGS[panelId];
    const data = await this.dataFetcher.fetch(config.dataEndpoint);
    panel.webview.postMessage({ type: 'update', data });
  }

  private refreshAllPanels(): void {
    for (const panelId of this.panels.keys()) {
      this.refreshPanel(panelId);
    }
  }

  private getWebviewHtml(panelId: PanelType): string {
    const config = PANEL_CONFIGS[panelId];
    return [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '<head>',
      '  <meta charset="UTF-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
      '  <title>' + config.title + '</title>',
      '  <style>',
      '    body { font-family: var(--vscode-font-family); padding: 16px; color: var(--vscode-foreground); }',
      '    .loading { text-align: center; padding: 40px; opacity: 0.7; }',
      '    .error { color: var(--vscode-errorForeground); padding: 16px; }',
      '  </style>',
      '</head>',
      '<body>',
      '  <div id="root"><div class="loading">Loading ' + config.title + '...</div></div>',
      '  <script>',
      '    const vscode = acquireVsCodeApi();',
      '    window.addEventListener("message", (event) => {',
      '      const msg = event.data;',
      '      if (msg.type === "update") {',
      '        document.getElementById("root").innerHTML = msg.data',
      '          ? "<pre>" + JSON.stringify(msg.data, null, 2) + "</pre>"',
      '          : "<div class=\\"error\\">Backend offline</div>";',
      '      }',
      '    });',
      '  </script>',
      '</body>',
      '</html>',
    ].join('\n');
  }

  dispose(): void {
    for (const panel of this.panels.values()) {
      panel.dispose();
    }
    this.panels.clear();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
