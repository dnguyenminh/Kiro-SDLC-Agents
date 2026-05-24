/**
 * BasePanel — Abstract base class for all KB webview panels.
 * Provides common lifecycle management, message handling, and server status subscription.
 */

import * as vscode from "vscode";
import {
  IKbPanel,
  ExtToWebviewMessage,
  WebviewToExtMessage,
  PanelType,
  PANEL_VIEW_TYPES,
  PANEL_TITLES,
} from "../types";
import { McpServerManager, getNonce } from "../mcp-server-manager";

export abstract class BasePanel implements IKbPanel, vscode.Disposable {
  protected _panel: vscode.WebviewPanel | undefined;
  private _disposables: vscode.Disposable[] = [];
  private _onDisposeEmitter = new vscode.EventEmitter<void>();

  constructor(
    protected readonly panelType: PanelType,
    protected readonly mcpManager: McpServerManager,
    protected readonly extensionUri: vscode.Uri
  ) {
    this.create();
  }

  get viewType(): string {
    return PANEL_VIEW_TYPES[this.panelType];
  }

  get panel(): vscode.WebviewPanel {
    return this._panel!;
  }

  get isAlive(): boolean {
    return this._panel !== undefined;
  }

  /**
   * Register a callback for when this panel is disposed.
   */
  onDispose(callback: () => void): void {
    this._onDisposeEmitter.event(callback);
  }

  /**
   * Create the webview panel with proper options.
   */
  protected create(column: vscode.ViewColumn = vscode.ViewColumn.One): void {
    this._panel = vscode.window.createWebviewPanel(
      PANEL_VIEW_TYPES[this.panelType],
      PANEL_TITLES[this.panelType],
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, "webview-assets"),
          vscode.Uri.joinPath(this.extensionUri, "out"),
        ],
      }
    );

    // Set HTML content
    this._panel.webview.html = this.getHtml(this._panel.webview);

    // Handle messages from webview
    this._panel.webview.onDidReceiveMessage(
      (msg: WebviewToExtMessage) => this.handleMessage(msg),
      undefined,
      this._disposables
    );

    // Handle panel disposal
    this._panel.onDidDispose(
      () => {
        this._panel = undefined;
        this._onDisposeEmitter.fire();
        this.disposeInternal();
      },
      null,
      this._disposables
    );

    // Subscribe to server status changes
    this.mcpManager.onStatusChange(
      (status) => {
        const webviewStatus = status === "running" ? "connected" : status === "crashed" ? "failed" : "disconnected";
        this.sendMessage({ type: "serverStatus", status: webviewStatus });
      },
      null,
      this._disposables
    );
  }

  reveal(): void {
    this._panel?.reveal();
  }

  sendMessage(msg: ExtToWebviewMessage): void {
    if (this._panel) {
      this._panel.webview.postMessage(msg);
    }
  }

  dispose(): void {
    this._panel?.dispose();
  }

  private disposeInternal(): void {
    this._disposables.forEach((d) => d.dispose());
    this._disposables = [];
    this._onDisposeEmitter.dispose();
  }

  protected getNonce(): string {
    return getNonce();
  }

  protected getWebviewUri(webview: vscode.Webview, ...pathSegments: string[]): vscode.Uri {
    return webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, ...pathSegments));
  }

  /**
   * Generate the base HTML wrapper with CSP headers.
   */
  protected getBaseHtml(webview: vscode.Webview, bodyContent: string, scripts: string[], styles: string[]): string {
    const nonce = this.getNonce();
    const cspSource = webview.cspSource;

    const styleLinks = styles
      .map((s) => `<link rel="stylesheet" href="${this.getWebviewUri(webview, "webview-assets", s)}">`)
      .join("\n    ");

    const scriptTags = scripts
      .map((s) => `<script nonce="${nonce}" src="${this.getWebviewUri(webview, "webview-assets", s)}"></script>`)
      .join("\n    ");

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} data:; font-src ${cspSource}; connect-src 'none';">
    <title>${PANEL_TITLES[this.panelType]}</title>
    ${styleLinks}
    <style>
      body { padding: 0; margin: 0; font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background-color: var(--vscode-editor-background); }
      .loading { display: flex; align-items: center; justify-content: center; height: 100vh; opacity: 0.7; }
      .error-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: none; align-items: center; justify-content: center; z-index: 9999; }
      .error-overlay.visible { display: flex; }
      .error-box { background: var(--vscode-editor-background); border: 1px solid var(--vscode-editorWidget-border); border-radius: 4px; padding: 20px; text-align: center; max-width: 400px; }
      .error-box button { margin-top: 12px; padding: 6px 14px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 2px; cursor: pointer; }
      .error-box button:hover { background: var(--vscode-button-hoverBackground); }
    </style>
</head>
<body>
    <div id="error-overlay" class="error-overlay">
      <div class="error-box">
        <p id="error-message">Server disconnected. Reconnecting...</p>
        <button id="retry-btn" onclick="handleRetry()" style="display:none">Retry</button>
      </div>
    </div>
    ${bodyContent}
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      window.addEventListener('message', (event) => {
        const msg = event.data;
        if (msg.type === 'serverStatus') {
          const overlay = document.getElementById('error-overlay');
          const errorMsg = document.getElementById('error-message');
          const retryBtn = document.getElementById('retry-btn');
          if (msg.status === 'connected') { overlay.classList.remove('visible'); vscode.postMessage({ type: 'refresh' }); }
          else if (msg.status === 'disconnected') { errorMsg.textContent = 'Server disconnected. Reconnecting...'; retryBtn.style.display = 'none'; overlay.classList.add('visible'); }
          else if (msg.status === 'failed') { errorMsg.textContent = 'Server unavailable. Click to retry.'; retryBtn.style.display = 'inline-block'; overlay.classList.add('visible'); }
        }
        if (msg.type === 'error') { const o = document.getElementById('error-overlay'); document.getElementById('error-message').textContent = msg.message; document.getElementById('retry-btn').style.display = msg.retryable ? 'inline-block' : 'none'; o.classList.add('visible'); }
        if (typeof handlePanelMessage === 'function') { handlePanelMessage(msg); }
      });
      function handleRetry() { document.getElementById('error-overlay').classList.remove('visible'); vscode.postMessage({ type: 'manualRetry' }); }
      vscode.postMessage({ type: 'ready' });
    </script>
    ${scriptTags}
</body>
</html>`;
  }

  // === Abstract methods ===
  abstract getHtml(webview: vscode.Webview): string;
  abstract loadData(): Promise<void>;
  abstract handleMessage(msg: WebviewToExtMessage): Promise<void>;
}
