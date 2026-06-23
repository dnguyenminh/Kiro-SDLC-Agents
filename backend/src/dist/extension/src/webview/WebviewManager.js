"use strict";
/**
 * WebviewManager — manages Webview panel lifecycle and data loading.
 * Implements TDD §5.3 IWebviewManager, FSD BR-22, BR-23, BR-24, BR-25.
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
exports.WebviewManager = void 0;
const vscode = __importStar(require("vscode"));
const WebviewDataFetcher_1 = require("./WebviewDataFetcher");
const PANEL_CONFIGS = {
    dashboard: { title: 'Dashboard', viewType: 'codeIntel.dashboard', dataEndpoint: '/api/dashboard/summary' },
    kbGraph: { title: 'KB Graph', viewType: 'codeIntel.kbGraph', dataEndpoint: '/api/kb/graph' },
    analytics: { title: 'Analytics', viewType: 'codeIntel.analytics', dataEndpoint: '/api/analytics/overview' },
    tags: { title: 'Tags', viewType: 'codeIntel.tags', dataEndpoint: '/api/tags/list' },
    quality: { title: 'Quality', viewType: 'codeIntel.quality', dataEndpoint: '/api/quality/summary' },
};
class WebviewManager {
    panels = new Map();
    dataFetcher;
    extensionUri;
    disposables = [];
    constructor(connectionManager, extensionUri) {
        this.dataFetcher = new WebviewDataFetcher_1.WebviewDataFetcher(connectionManager);
        this.extensionUri = extensionUri;
        // Refresh panels when backend reconnects
        const stateDisposable = connectionManager.onStateChange((state) => {
            if (state.state === 'CONNECTED') {
                this.refreshAllPanels();
            }
        });
        this.disposables.push(stateDisposable);
    }
    openPanel(panelId) {
        const existing = this.panels.get(panelId);
        if (existing) {
            existing.reveal();
            this.refreshPanel(panelId);
            return;
        }
        const config = PANEL_CONFIGS[panelId];
        const panel = vscode.window.createWebviewPanel(config.viewType, config.title, vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [this.extensionUri],
        });
        panel.onDidDispose(() => {
            this.panels.delete(panelId);
        });
        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.type === 'refresh') {
                await this.refreshPanel(panelId);
            }
            else if (message.type === 'fetch') {
                const data = await this.dataFetcher.fetch(message.path);
                panel.webview.postMessage({ type: 'data', id: message.id, data });
            }
            else if (message.type === 'post') {
                const data = await this.dataFetcher.post(message.path, message.body);
                panel.webview.postMessage({ type: 'data', id: message.id, data });
            }
        });
        this.panels.set(panelId, panel);
        panel.webview.html = this.getWebviewHtml(panelId);
        this.refreshPanel(panelId);
    }
    closePanel(panelId) {
        const panel = this.panels.get(panelId);
        if (panel) {
            panel.dispose();
            this.panels.delete(panelId);
        }
    }
    async refreshPanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel)
            return;
        const config = PANEL_CONFIGS[panelId];
        const data = await this.dataFetcher.fetch(config.dataEndpoint);
        panel.webview.postMessage({ type: 'update', data });
    }
    refreshAllPanels() {
        for (const panelId of this.panels.keys()) {
            this.refreshPanel(panelId);
        }
    }
    getWebviewHtml(panelId) {
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
    dispose() {
        for (const panel of this.panels.values()) {
            panel.dispose();
        }
        this.panels.clear();
        for (const d of this.disposables) {
            d.dispose();
        }
    }
}
exports.WebviewManager = WebviewManager;
//# sourceMappingURL=WebviewManager.js.map