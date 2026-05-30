/**
 * GraphPanel — KB Graph viewer via iframe (shared viewer on MCP port).
 * Uses same viewer as browser (http://localhost:PORT/) for consistent results.
 */

import * as vscode from "vscode";
import { WebviewToExtMessage } from "../types";
import { McpServerManager } from "../mcp-server-manager";
import { BasePanel } from "./base-panel";

export class GraphPanel extends BasePanel {
  constructor(mcpManager: McpServerManager, extensionUri: vscode.Uri) {
    super("graph", mcpManager, extensionUri);
  }

  getHtml(webview: vscode.Webview): string {
    const port = this.mcpManager.port || 9181;
    const cspSource = webview.cspSource;
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src http://127.0.0.1:* http://localhost:*; style-src ${cspSource} 'unsafe-inline';">
    <title>KB Graph</title>
    <style>
      body { padding: 0; margin: 0; overflow: hidden; height: 100vh; }
      iframe { width: 100%; height: 100%; border: none; }
    </style>
</head>
<body>
    <iframe id="kb-graph-frame" 
      src="http://127.0.0.1:${port}/" 
      style="width:100%;height:100vh;border:none;"
      sandbox="allow-scripts allow-same-origin allow-popups">
    </iframe>
</body>
</html>`;
  }

  async loadData(): Promise<void> {
    // No-op: iframe loads data directly from MCP server API
  }

  async handleMessage(msg: WebviewToExtMessage): Promise<void> {
    // No-op: iframe handles all interactions internally
  }
}
