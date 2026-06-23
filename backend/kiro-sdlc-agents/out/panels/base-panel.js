"use strict";
/**
 * BasePanel — Abstract base class for all KB webview panels.
 * Provides common lifecycle management, message handling, and server status subscription.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasePanel = exports.getNonce = void 0;
const vscode = __importStar(require("vscode"));
const types_1 = require("../types");
const mcp_server_manager_1 = require("../mcp-server-manager");
Object.defineProperty(exports, "getNonce", { enumerable: true, get: function () { return mcp_server_manager_1.getNonce; } });
class BasePanel {
    panelType;
    mcpManager;
    extensionUri;
    static authTokenProvider;
    _panel;
    _disposables = [];
    _onDisposeEmitter = new vscode.EventEmitter();
    constructor(panelType, mcpManager, extensionUri) {
        this.panelType = panelType;
        this.mcpManager = mcpManager;
        this.extensionUri = extensionUri;
        this.create();
    }
    get viewType() {
        return types_1.PANEL_VIEW_TYPES[this.panelType];
    }
    get panel() {
        return this._panel;
    }
    get isAlive() {
        return this._panel !== undefined;
    }
    /**
     * Register a callback for when this panel is disposed.
     */
    onDispose(callback) {
        this._onDisposeEmitter.event(callback);
    }
    /**
     * Create the webview panel with proper options.
     */
    create(column = vscode.ViewColumn.One) {
        this._panel = vscode.window.createWebviewPanel(types_1.PANEL_VIEW_TYPES[this.panelType], types_1.PANEL_TITLES[this.panelType], column, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.extensionUri, "webview-assets"),
                vscode.Uri.joinPath(this.extensionUri, "out"),
            ],
        });
        // Set HTML content
        this._panel.webview.html = this.getHtml(this._panel.webview);
        // Handle messages from webview
        this._panel.webview.onDidReceiveMessage((msg) => {
            if (msg.type === 'auth_error') {
                // Trigger a token refresh command (which AuthManager handles)
                vscode.commands.executeCommand('kiroSdlc.refreshToken').then(() => {
                    // Once refreshed, reload the panel to get the new token
                    if (this._panel) {
                        this._panel.webview.html = this.getHtml(this._panel.webview);
                    }
                });
                return;
            }
            this.handleMessage(msg);
        }, undefined, this._disposables);
        // Handle panel disposal
        this._panel.onDidDispose(() => {
            this._panel = undefined;
            this._onDisposeEmitter.fire();
            this.disposeInternal();
        }, null, this._disposables);
        // Subscribe to server status changes
        this.mcpManager.onStatusChange((status) => {
            const webviewStatus = status === "running" ? "connected" : status === "crashed" ? "failed" : "disconnected";
            this.sendMessage({ type: "serverStatus", status: webviewStatus });
        }, null, this._disposables);
    }
    reveal() {
        this._panel?.reveal();
    }
    sendMessage(msg) {
        if (this._panel) {
            this._panel.webview.postMessage(msg);
        }
    }
    dispose() {
        this._panel?.dispose();
    }
    disposeInternal() {
        this._disposables.forEach((d) => d.dispose());
        this._disposables = [];
        this._onDisposeEmitter.dispose();
    }
    getNonce() {
        return (0, mcp_server_manager_1.getNonce)();
    }
    getWebviewUri(webview, ...pathSegments) {
        return webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, ...pathSegments));
    }
    /**
     * Generates an iframe that embeds the backend server's UI for this panel.
     */
    getIframeHtml() {
        const config = vscode.workspace.getConfiguration("kiroSdlc");
        const backendUrl = config.get("backend.url") || "http://127.0.0.1:48721";
        const token = BasePanel.authTokenProvider ? BasePanel.authTokenProvider() : "";
        const pageMapping = {
            dashboard: "dashboard",
            graph: "graph",
            tags: "tags",
            quality: "quality",
            analytics: "analytics",
            workflow: "workflow",
        };
        const page = pageMapping[this.panelType] || "dashboard";
        const src = `${backendUrl}/admin?embed=true&page=${page}&token=${token}`;
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src * http://127.0.0.1:* http://localhost:* https://*; style-src 'unsafe-inline';">
    <title>${types_1.PANEL_TITLES[this.panelType]}</title>
    <style>
      body { padding: 0; margin: 0; height: 100vh; width: 100vw; overflow: hidden; background-color: var(--vscode-editor-background); }
      iframe { border: none; width: 100%; height: 100%; display: block; }
    </style>
</head>
<body>
    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: var(--vscode-descriptionForeground); text-align: center; z-index: -1;">
        <p>Loading Dashboard UI from backend...</p>
        <p style="font-size: 0.8em; opacity: 0.7;">If this message persists, the backend server may be down or your security settings may be blocking the iframe.</p>
    </div>
    <iframe src="${src}" allow="clipboard-read; clipboard-write"></iframe>
    <script>
      const vscode = acquireVsCodeApi();
      window.addEventListener('message', (event) => {
        // Forward auth errors from the iframe to the extension
        if (event.data && (event.data.type === 'auth_error' || event.data.status === 401)) {
          vscode.postMessage({ type: 'auth_error' });
        }
      });
    </script>
</body>
</html>`;
    }
    /**
     * Generate the base HTML wrapper with CSP headers.
     */
    getBaseHtml(webview, bodyContent, scripts, styles) {
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
    <title>${types_1.PANEL_TITLES[this.panelType]}</title>
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
}
exports.BasePanel = BasePanel;
//# sourceMappingURL=base-panel.js.map