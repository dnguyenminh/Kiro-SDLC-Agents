/**
 * AnalyticsPanel — Search volume, popular queries, gaps, recommendations.
 */

import * as vscode from "vscode";
import { WebviewToExtMessage } from "../types";
import { McpServerManager } from "../mcp-server-manager";
import { BasePanel } from "./base-panel";

export class AnalyticsPanel extends BasePanel {
  constructor(mcpManager: McpServerManager, extensionUri: vscode.Uri) {
    super("analytics", mcpManager, extensionUri);
  }

  getHtml(webview: vscode.Webview): string {
    const body = `
    <div id="analytics-panel" style="padding:16px;">
      <div class="loading" id="loading">Loading analytics...</div>
      <div id="content" style="display:none;">
        <div id="time-range" style="margin-bottom:12px;">
          <select id="range-select"><option value="7">7 days</option><option value="30" selected>30 days</option><option value="90">90 days</option></select>
        </div>
        <div style="margin-bottom:16px;"><canvas id="volume-chart" width="500" height="180" style="width:100%;max-width:100%;"></canvas></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div><h3>Popular Queries</h3><ol id="popular-list"></ol></div>
          <div><h3>Knowledge Gaps</h3><ul id="gaps-list"></ul></div>
        </div>
        <div id="recommendations" style="margin-top:16px;"><h3>Recommendations</h3><div id="rec-cards"></div></div>
      </div>
    </div>`;
    return this.getBaseHtml(webview, body, ["analytics.js"], ["ui-tokens.css", "panel-common.css"]);
  }

  async loadData(): Promise<void> {
    try {
      // Parallel calls to reduce total wait time
      const [trendRes, popRes, gapsRes, zeroRes, recRes] = await Promise.allSettled([
        this.mcpManager.invokeTool("mem_admin", { action: "trends", days: 30 }),
        this.mcpManager.invokeTool("mem_admin", { action: "popular", limit: 15 }),
        this.mcpManager.invokeTool("mem_admin", { action: "gaps" }),
        this.mcpManager.invokeTool("mem_admin", { action: "zero_results" }),
        this.mcpManager.invokeTool("mem_admin", { action: "recommendations" }),
      ]);

      const trendData = trendRes.status === "fulfilled" ? JSON.parse(trendRes.value) : {};
      const popData = popRes.status === "fulfilled" ? JSON.parse(popRes.value) : [];
      const gapsData = gapsRes.status === "fulfilled" ? JSON.parse(gapsRes.value) : {};
      const zeroData = zeroRes.status === "fulfilled" ? JSON.parse(zeroRes.value) : [];
      const recData = recRes.status === "fulfilled" ? JSON.parse(recRes.value) : [];

      // Volume: from trends → search_volume [{date, count}] → map to [{date, searches}]
      const searchVol = trendData.search_volume || trendData.searchVolume || [];
      const volume = searchVol.map((v: any) => ({ date: v.date, searches: v.count || v.searches || 0 }));

      // Popular: [{query, hit_count, avg_results}] → map to [{query, count}]
      const popularArr = Array.isArray(popData) ? popData : (popData.queries || []);
      const popular = popularArr.map((q: any) => ({ query: q.query || q.term || "", count: q.hit_count || q.count || 0 }));

      // Gaps
      const gapsArr = Array.isArray(gapsData) ? gapsData : (Array.isArray(gapsData.top_gaps) ? gapsData.top_gaps : []);
      const zeroArr = Array.isArray(zeroData) ? zeroData : (Array.isArray(zeroData.queries) ? zeroData.queries : []);
      const gaps = [...gapsArr, ...zeroArr].map((g: any) => ({ query: g.query || g.term || "", count: g.hit_count || g.count || 0, suggestion: g.suggestion }));

      // Recommendations
      const recommendations = Array.isArray(recData) ? recData : (recData.recommendations || []);

      this.sendMessage({
        type: "analyticsData",
        volume,
        popular,
        gaps,
        recommendations,
      });
    } catch (err) {
      this.sendMessage({ type: "error", message: `Analytics load failed: ${(err as Error).message}`, retryable: true });
    }
  }

  async handleMessage(msg: WebviewToExtMessage): Promise<void> {
    switch (msg.type) {
      case "ready": case "refresh": await this.loadData(); break;
      case "createEntry":
        if (msg.type === "createEntry") {
          try { await this.mcpManager.invokeTool("mem_ingest", { content: msg.content, type: msg.entryType, summary: msg.title }); await this.loadData(); } catch {}
        }
        break;
      case "manualRetry":
        try { await this.mcpManager.restart(); } catch { this.sendMessage({ type: "serverStatus", status: "failed" }); }
        break;
    }
  }
}
