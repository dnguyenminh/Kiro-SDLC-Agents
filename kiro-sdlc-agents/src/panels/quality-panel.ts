/**
 * QualityPanel — Quality scores histogram, low-quality table, bulk actions.
 */

import * as vscode from "vscode";
import { WebviewToExtMessage } from "../types";
import { McpServerManager } from "../mcp-server-manager";
import { BasePanel } from "./base-panel";

export class QualityPanel extends BasePanel {
  constructor(mcpManager: McpServerManager, extensionUri: vscode.Uri) {
    super("quality", mcpManager, extensionUri);
  }

  getHtml(webview: vscode.Webview): string {
    const body = `
    <div id="quality-panel" style="padding:16px;">
      <div class="loading" id="loading">Loading quality data...</div>
      <div id="content" style="display:none;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
          <div id="histogram-wrap"><canvas id="quality-histogram" width="300" height="160"></canvas></div>
          <div id="confidence-wrap"><canvas id="confidence-chart" width="300" height="160"></canvas></div>
        </div>
        <div id="low-quality-section"><h3>Low Quality Entries</h3><table id="low-quality-table"></table></div>
        <div id="unreliable-section" style="margin-top:16px;"><h3>Unreliable Entries</h3><table id="unreliable-table"></table></div>
      </div>
    </div>`;
    return this.getBaseHtml(webview, body, ["quality.js"], ["ui-tokens.css", "panel-common.css"]);
  }

  async loadData(): Promise<void> {
    try {
      const statsRaw = await this.mcpManager.invokeTool("mem_scoring", { action: "quality_stats" });
      const lowRaw = await this.mcpManager.invokeTool("mem_scoring", { action: "low_quality", threshold: 40, limit: 20 });
      const confRaw = await this.mcpManager.invokeTool("mem_scoring", { action: "confidence_stats" });

      let stats: any, lowQuality: any[], confidence: any, unreliable: any[];
      try { stats = JSON.parse(statsRaw); } catch { stats = {}; }
      try { const lq = JSON.parse(lowRaw); lowQuality = Array.isArray(lq) ? lq : (lq.entries || []); } catch { lowQuality = []; }
      try { confidence = JSON.parse(confRaw); } catch { confidence = {}; }
      unreliable = [];

      this.sendMessage({
        type: "qualityData",
        stats,
        lowQuality,
        confidence,
        unreliable,
      });
    } catch (err) {
      this.sendMessage({ type: "error", message: `Quality load failed: ${(err as Error).message}`, retryable: true });
    }
  }

  async handleMessage(msg: WebviewToExtMessage): Promise<void> {
    switch (msg.type) {
      case "ready": case "refresh": await this.loadData(); break;
      case "bulkAction":
        if (msg.type === "bulkAction") {
          for (const id of msg.entryIds) {
            try {
              if (msg.action === "archive") { await this.mcpManager.invokeTool("mem_lifecycle", { action: "archive", entry_id: id }); }
              else if (msg.action === "delete") { await this.mcpManager.invokeTool("mem_crud", { action: "delete", id }); }
              else if (msg.action === "review") { await this.mcpManager.invokeTool("mem_lifecycle", { action: "mark_reviewed", entry_id: id }); }
            } catch { /* continue */ }
          }
          await this.loadData();
        }
        break;
      case "manualRetry":
        try { await this.mcpManager.restart(); } catch { this.sendMessage({ type: "serverStatus", status: "failed" }); }
        break;
    }
  }
}
