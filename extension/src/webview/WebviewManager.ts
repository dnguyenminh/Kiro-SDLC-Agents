/**
 * WebviewManager — manages VS Code Webview panels.
 * Creates panels for Dashboard, KB Graph, Analytics, Tags, Quality views.
 * Implements: UC-5, BR-22..BR-25
 */

import * as vscode from 'vscode';
import type { HttpClient } from '../proxy/HttpClient';

export type PanelType = 'dashboard' | 'kbGraph' | 'analytics' | 'tags' | 'quality';

interface PanelConfig {
  title: string;
  viewType: string;
  dataEndpoint: string;
}

const PANEL_CONFIGS: Record<PanelType, PanelConfig> = {
  dashboard: { title: 'Code Intelligence Dashboard', viewType: 'codeIntel.dashboard', dataEndpoint: '/api/dashboard/summary' },
  kbGraph: { title: 'KB Graph', viewType: 'codeIntel.kbGraph', dataEndpoint: '/api/kb/graph' },
  analytics: { title: 'Analytics', viewType: 'codeIntel.analytics', dataEndpoint: '/api/analytics/overview' },
  tags: { title: 'Tags', viewType: 'codeIntel.tags', dataEndpoint: '/api/tags/list' },
  quality: { title: 'Quality Scores', viewType: 'codeIntel.quality', dataEndpoint: '/api/quality/summary' },
};

export class WebviewManager implements vscode.Disposable {
  private panels: Map<PanelType, vscode.WebviewPanel> = new Map();
  private httpClient: HttpClient;
  private outputChannel: vscode.OutputChannel;

  constructor(httpClient: HttpClient, outputChannel: vscode.OutputChannel) {
    this.httpClient = httpClient;
    this.outputChannel = outputChannel;
  }

  openPanel(panelId: PanelType): void {
    const existing = this.panels.get(panelId);
    if (existing) {
      existing.reveal();
      return;
    }

    const config = PANEL_CONFIGS[panelId];
    const panel = vscode.window.createWebviewPanel(
      config.viewType,
      config.title,
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    panel.webview.html = this.getLoadingHtml(config.title);
    this.panels.set(panelId, panel);

    panel.onDidDispose(() => {
      this.panels.delete(panelId);
    });

    // Fetch data and render
    this.refreshPanel(panelId);
  }

  async refreshPanel(panelId: PanelType): Promise<void> {
    const panel = this.panels.get(panelId);
    if (!panel) return;

    const config = PANEL_CONFIGS[panelId];

    try {
      const data = await this.httpClient.fetchWebviewData(config.dataEndpoint);
      panel.webview.html = this.renderPanel(config.title, data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.outputChannel.appendLine(`[WebviewManager] Failed to load ${panelId}: ${message}`);
      panel.webview.html = this.getErrorHtml(config.title, message);
    }
  }

  closePanel(panelId: PanelType): void {
    const panel = this.panels.get(panelId);
    if (panel) {
      panel.dispose();
      this.panels.delete(panelId);
    }
  }

  private getLoadingHtml(title: string): string {
    return `<!DOCTYPE html><html><head><title>${title}</title></head><body><h1>${title}</h1><p>Loading...</p></body></html>`;
  }

  private getErrorHtml(title: string, error: string): string {
    return `<!DOCTYPE html><html><head><title>${title}</title></head><body><h1>${title}</h1><p style="color:red">Error: ${error}</p></body></html>`;
  }

  private renderPanel(title: string, data: unknown): string {
    return `<!DOCTYPE html><html><head><title>${title}</title></head><body><h1>${title}</h1><pre>${JSON.stringify(data, null, 2)}</pre></body></html>`;
  }

  dispose(): void {
    for (const panel of this.panels.values()) {
      panel.dispose();
    }
    this.panels.clear();
  }
}
