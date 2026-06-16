/**
 * McpConfigPanel — Webview for MCP server configuration (Jira, DrawIO, Export).
 * Implements TDD §5.2 McpConfigWebview, FSD UC-9.
 */

import * as vscode from 'vscode';
import { AuthManager } from '../../auth/AuthManager';
import { AuthInterceptor } from '../../auth/AuthInterceptor';

interface McpConfigData {
  servers: {
    jira?: { url: string; username: string; token_configured: boolean; project_key?: string };
    drawio?: { path?: string; format?: string };
    export?: { output_dir?: string };
  };
  last_updated: string | null;
}

export class McpConfigPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | null = null;
  private readonly baseUrl: string;
  private readonly authInterceptor: AuthInterceptor;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    authManager: AuthManager,
    private readonly extensionUri: vscode.Uri,
    baseUrl: string,
  ) {
    this.baseUrl = baseUrl;
    this.authInterceptor = new AuthInterceptor(authManager);
  }

  show(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'codeIntel.mcpConfig',
      'MCP Server Configuration',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri],
      },
    );

    this.panel.webview.html = this.getHtml();

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'load':
            await this.handleLoad();
            break;
          case 'save':
            await this.handleSave(message.config);
            break;
          case 'test':
            await this.handleTest(message.server);
            break;
        }
      },
      null,
      this.disposables,
    );

    this.panel.onDidDispose(() => {
      this.panel = null;
    }, null, this.disposables);

    // Trigger initial load
    setTimeout(() => this.handleLoad(), 100);
  }

  close(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = null;
    }
  }

  private async handleLoad(): Promise<void> {
    try {
      const headers = await this.authInterceptor.injectHeaders({ 'Content-Type': 'application/json' });
      const response = await fetch(`${this.baseUrl}/api/config/mcp-servers`, { headers });

      if (!response.ok) {
        this.postMessage({ type: 'error', message: 'Failed to load configuration.' });
        return;
      }

      const data = (await response.json()) as McpConfigData;
      this.postMessage({ type: 'loaded', config: data });
    } catch {
      this.postMessage({ type: 'error', message: 'Backend unavailable.' });
    }
  }

  private async handleSave(config: Record<string, unknown>): Promise<void> {
    try {
      const headers = await this.authInterceptor.injectHeaders({ 'Content-Type': 'application/json' });
      const response = await fetch(`${this.baseUrl}/api/config/mcp-servers`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const err = await response.json() as { error?: { message?: string } };
        this.postMessage({ type: 'saveResult', success: false, message: err?.error?.message ?? 'Save failed.' });
        return;
      }

      this.postMessage({ type: 'saveResult', success: true, message: 'Configuration saved successfully.' });
    } catch {
      this.postMessage({ type: 'saveResult', success: false, message: 'Backend unavailable.' });
    }
  }

  private async handleTest(server: string): Promise<void> {
    try {
      const headers = await this.authInterceptor.injectHeaders({ 'Content-Type': 'application/json' });
      const response = await fetch(`${this.baseUrl}/api/config/mcp-servers/test`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ server }),
      });

      const data = await response.json() as { status: string; message: string };
      this.postMessage({ type: 'testResult', server, ...data });
    } catch {
      this.postMessage({ type: 'testResult', server, status: 'failed', message: 'Backend unavailable.' });
    }
  }

  private postMessage(message: unknown): void {
    this.panel?.webview.postMessage(message);
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP Configuration</title>
  <style>
    body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); }
    h1 { font-size: 1.3em; margin-bottom: 20px; }
    .tabs { display: flex; gap: 0; border-bottom: 1px solid var(--vscode-panel-border); margin-bottom: 20px; }
    .tab { padding: 8px 16px; cursor: pointer; border: none; background: none; color: var(--vscode-foreground); opacity: 0.7; border-bottom: 2px solid transparent; }
    .tab.active { opacity: 1; border-bottom-color: var(--vscode-focusBorder); }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .form-group { margin-bottom: 14px; }
    label { display: block; margin-bottom: 4px; font-size: 0.9em; color: var(--vscode-descriptionForeground); }
    input { width: 100%; box-sizing: border-box; padding: 6px 10px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 3px; }
    .btn { padding: 8px 16px; border: none; border-radius: 3px; cursor: pointer; margin-right: 8px; margin-top: 10px; }
    .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .status { margin-top: 12px; font-size: 0.85em; padding: 8px; border-radius: 3px; }
    .status.success { background: rgba(0,200,0,0.1); color: var(--vscode-testing-iconPassed); }
    .status.error { background: rgba(200,0,0,0.1); color: var(--vscode-errorForeground); }
  </style>
</head>
<body>
  <h1>MCP Server Configuration</h1>
  <div class="tabs">
    <button class="tab active" data-tab="jira">Jira</button>
    <button class="tab" data-tab="drawio">DrawIO</button>
    <button class="tab" data-tab="export">Export</button>
  </div>

  <div class="tab-content active" id="tab-jira">
    <div class="form-group"><label>URL</label><input id="jira-url" placeholder="https://company.atlassian.net" /></div>
    <div class="form-group"><label>Username / Email</label><input id="jira-username" placeholder="john@company.com" /></div>
    <div class="form-group"><label>API Token</label><input id="jira-token" type="password" placeholder="Enter API token" /></div>
    <div class="form-group"><label>Project Key (optional)</label><input id="jira-project" placeholder="KSA" /></div>
    <button class="btn btn-secondary" onclick="testConnection('jira')">Test Connection</button>
  </div>

  <div class="tab-content" id="tab-drawio">
    <div class="form-group"><label>draw.io CLI Path</label><input id="drawio-path" placeholder="C:\\Program Files\\draw.io\\draw.io.exe" /></div>
    <div class="form-group"><label>Export Format</label><input id="drawio-format" placeholder="png" value="png" /></div>
  </div>

  <div class="tab-content" id="tab-export">
    <div class="form-group"><label>Output Directory</label><input id="export-dir" placeholder="./documents" /></div>
  </div>

  <div style="margin-top: 20px;">
    <button class="btn btn-primary" onclick="saveConfig()">Save All</button>
  </div>
  <div class="status" id="statusMsg" style="display:none;"></div>

  <script>
    const vscode = acquireVsCodeApi();

    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      });
    });

    function saveConfig() {
      const config = {};
      const jiraUrl = document.getElementById('jira-url').value.trim();
      const jiraUser = document.getElementById('jira-username').value.trim();
      const jiraToken = document.getElementById('jira-token').value;
      if (jiraUrl || jiraUser) {
        config.jira = { url: jiraUrl, username: jiraUser };
        if (jiraToken) config.jira.token = jiraToken;
        const pk = document.getElementById('jira-project').value.trim();
        if (pk) config.jira.project_key = pk;
      }
      const drawioPath = document.getElementById('drawio-path').value.trim();
      const drawioFmt = document.getElementById('drawio-format').value.trim();
      if (drawioPath || drawioFmt) config.drawio = { path: drawioPath || undefined, format: drawioFmt || undefined };
      const exportDir = document.getElementById('export-dir').value.trim();
      if (exportDir) config.export = { output_dir: exportDir };
      vscode.postMessage({ type: 'save', config });
    }

    function testConnection(server) {
      vscode.postMessage({ type: 'test', server });
    }

    // Load config on init
    vscode.postMessage({ type: 'load' });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      const statusEl = document.getElementById('statusMsg');
      if (msg.type === 'loaded' && msg.config) {
        const s = msg.config.servers || {};
        if (s.jira) {
          document.getElementById('jira-url').value = s.jira.url || '';
          document.getElementById('jira-username').value = s.jira.username || '';
          if (s.jira.project_key) document.getElementById('jira-project').value = s.jira.project_key;
          if (s.jira.token_configured) document.getElementById('jira-token').placeholder = '••••••••';
        }
        if (s.drawio) {
          if (s.drawio.path) document.getElementById('drawio-path').value = s.drawio.path;
          if (s.drawio.format) document.getElementById('drawio-format').value = s.drawio.format;
        }
        if (s.export && s.export.output_dir) {
          document.getElementById('export-dir').value = s.export.output_dir;
        }
      } else if (msg.type === 'saveResult') {
        statusEl.style.display = 'block';
        statusEl.className = 'status ' + (msg.success ? 'success' : 'error');
        statusEl.textContent = msg.message;
      } else if (msg.type === 'testResult') {
        statusEl.style.display = 'block';
        statusEl.className = 'status ' + (msg.status === 'success' ? 'success' : 'error');
        statusEl.textContent = msg.server + ': ' + msg.message;
      } else if (msg.type === 'error') {
        statusEl.style.display = 'block';
        statusEl.className = 'status error';
        statusEl.textContent = msg.message;
      }
    });
  </script>
</body>
</html>`;
  }

  dispose(): void {
    this.close();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
