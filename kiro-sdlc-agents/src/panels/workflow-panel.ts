/**
 * WorkflowPanel — Interactive D3.js + dagre visualization of the SDLC pipeline graph.
 * Renders all LangGraph nodes, edges, and conditional routing in a VS Code webview.
 * KSA-238
 */

import * as vscode from "vscode";
import { WebviewToExtMessage } from "../types";
import { McpServerManager } from "../mcp-server-manager";
import { BasePanel } from "./base-panel";
import { SDLC_GRAPH_DEFINITION } from "../langgraph/workflow-graph-data";

export class WorkflowPanel extends BasePanel {
  constructor(mcpManager: McpServerManager, extensionUri: vscode.Uri) {
    super("workflow", mcpManager, extensionUri);
  }

  getHtml(webview: vscode.Webview): string {
    return this.getIframeHtml();
  }

  async loadData(): Promise<void> {
    // No-op
  }

  async handleMessage(msg: WebviewToExtMessage): Promise<void> {
    // No-op
  }
}
