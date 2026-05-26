/**
 * DashboardPanel — KB Dashboard using MCP invokeTool for data.
 * mem_admin(dashboard) returns valid JSON: { metrics: {...}, recommendations: [...] }
 */

import * as vscode from "vscode";
import { WebviewToExtMessage, SERVER_CONSTANTS } from "../types";
import { McpServerManager } from "../mcp-server-manager";
import { BasePanel } from "./base-panel";

export class DashboardPanel extends BasePanel {
  private refreshTimer: NodeJS.Timeout | undefined;

  constructor(mcpManager: McpServerManager, extensionUri: vscode.Uri) {
    super("dashboard", mcpManager, extensionUri);
    this.startAutoRefresh();
  }

  getHtml(webview: vscode.Webview): string {
    const body = `
    <div id="dashboard" style="padding:16px;">
      <div class="loading" id="loading">Loading dashboard...</div>
      <div id="content" style="display:none;">
        <div id="health-section" class="section">
          <h2>Health Score</h2>
          <div class="gauge-container"><svg viewBox="0 0 120 120" id="gauge"></svg></div>
          <div id="health-label" class="health-label"></div>
        </div>
        <div id="metrics-section" class="grid-metrics"></div>
        <div id="recs-section" class="section">
          <h2>Recommendations</h2>
          <ul class="recs-list" id="recs-list"></ul>
        </div>
        <div id="trend-section" class="section">
          <h2>Trends (7 days)</h2>
          <div class="trend-container">
            <canvas id="chart-search" width="300" height="140"></canvas>
            <canvas id="chart-ingest" width="300" height="140"></canvas>
          </div>
        </div>
      </div>
    </div>`;
    return this.getBaseHtml(webview, body, ["dashboard.js"], ["ui-tokens.css", "panel-common.css", "dashboard.css"]);
  }

  async loadData(): Promise<void> {
    try {
      const dashRaw = await this.mcpManager.invokeTool("mem_admin", { action: "dashboard" });
      if (dashRaw.startsWith("Unknown tool")) {
        this.sendMessage({ type: "dashboardData", healthScore: 0, totalEntries: 0, qualityAvg: 0, staleCount: 0, unownedCount: 0, recommendations: [], tierBreakdown: {}, typeBreakdown: {} } as any);
        return;
      }
      const dash = JSON.parse(dashRaw);

      // New unified format returns top-level fields directly
      const healthScore = dash.health_score ?? 0;
      const totalEntries = dash.total_entries ?? (dash.metrics?.total_entries ?? 0);
      const qualityAvg = dash.quality_avg ?? (dash.metrics?.quality_avg ?? 0);
      const staleCount = dash.stale_count ?? (dash.metrics?.stale_count ?? 0);
      const unownedCount = dash.unowned_count ?? (dash.metrics?.unowned_count ?? 0);

      this.sendMessage({
        type: "dashboardData",
        healthScore,
        totalEntries,
        qualityAvg,
        staleCount,
        unownedCount,
        recommendations: dash.recommendations || [],
        reviews: [],
        types: {},
        tiers: {},
        trends: dash.trends || {},
        trend: [],
        recent: [],
      } as any);
    } catch (err) {
      this.sendMessage({ type: "error", message: `Dashboard load failed: ${(err as Error).message}`, retryable: true });
    }
  }

  async handleMessage(msg: WebviewToExtMessage): Promise<void> {
    switch (msg.type) {
      case "ready":
      case "refresh":
        await this.loadData();
        break;
      case "manualRetry":
        try { await this.mcpManager.restart(); } catch { this.sendMessage({ type: "serverStatus", status: "failed" }); }
        break;
    }
  }

  private startAutoRefresh(): void {
    this.refreshTimer = setInterval(() => {
      if (this.isAlive && this.mcpManager.status === "running") {
        this.loadData().catch(() => {});
      }
    }, SERVER_CONSTANTS.DASHBOARD_REFRESH_MS);
  }

  dispose(): void {
    if (this.refreshTimer) { clearInterval(this.refreshTimer); this.refreshTimer = undefined; }
    super.dispose();
  }
}
