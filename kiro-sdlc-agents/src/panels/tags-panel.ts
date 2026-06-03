/**
 * TagsPanel — Tag cloud and taxonomy tree with CRUD operations.
 * Real-time updates via KbEventBus SSE subscription + polling fallback.
 */

import * as vscode from "vscode";
import { WebviewToExtMessage, SERVER_CONSTANTS } from "../types";
import { McpServerManager } from "../mcp-server-manager";
import { BasePanel } from "./base-panel";
import { KbEventBus } from "../kb-event-bus";

export class TagsPanel extends BasePanel {
  private refreshTimer: NodeJS.Timeout | undefined;
  private eventSubscription: vscode.Disposable | undefined;

  constructor(mcpManager: McpServerManager, extensionUri: vscode.Uri, eventBus?: KbEventBus) {
    super("tags", mcpManager, extensionUri);
    this.startFallbackPolling();
    if (eventBus) {
      this.eventSubscription = eventBus.onTagsChange(() => {
        if (this.isAlive && this.mcpManager.status === "running") {
          this.loadData().catch(() => {});
        }
      });
    }
  }

  getHtml(webview: vscode.Webview): string {
    const body = `
    <div id="tags-panel" style="padding:16px;">
      <div class="loading" id="loading">Loading tags...</div>
      <div id="content" style="display:none;">
        <div class="section">
          <h2>Popular Tags</h2>
          <div id="tag-cloud" style="line-height:2;"></div>
        </div>
        <div class="section">
          <h2>Tag Taxonomy</h2>
          <div id="tag-tree"></div>
        </div>
        <div class="section">
          <h2>Search by Tag</h2>
          <input id="tag-search" type="text" placeholder="Type a tag name..."
            style="width:100%;max-width:300px;padding:6px 10px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);border-radius:3px;font-size:12px;margin-bottom:12px;" />
          <div id="entries-list"></div>
        </div>
      </div>
    </div>`;
    return this.getBaseHtml(webview, body, ["tags.js"], ["ui-tokens.css", "panel-common.css"]);
  }

  async loadData(): Promise<void> {
    try {
      const taxRaw = await this.mcpManager.invokeTool("mem_tags", { action: "taxonomy" });
      const popRaw = await this.mcpManager.invokeTool("mem_tags", { action: "popular", limit: 50 });

      let taxonomy: any;
      let popular: any;
      try { taxonomy = JSON.parse(taxRaw); } catch { taxonomy = []; }
      try { popular = JSON.parse(popRaw); } catch { popular = []; }

      // Normalize: taxonomy can be array or {categories: {...}}
      if (taxonomy && taxonomy.categories) taxonomy = taxonomy.categories;
      // popular can be array or {tags: [...]}
      if (popular && popular.tags) popular = popular.tags;
      if (!Array.isArray(popular)) popular = [];

      this.sendMessage({ type: "tagsData", taxonomy, popular });
    } catch (err) {
      this.sendMessage({ type: "error", message: `Tags load failed: ${(err as Error).message}`, retryable: true });
    }
  }

  async handleMessage(msg: WebviewToExtMessage): Promise<void> {
    switch (msg.type) {
      case "ready": case "refresh": await this.loadData(); break;
      case "filterByTag":
        if (msg.type === "filterByTag") {
          try {
            const r = await this.mcpManager.invokeTool("mem_tags", { action: "search", tags: msg.tag, limit: 500 });
            let entries: any[];
            try { const parsed = JSON.parse(r); entries = Array.isArray(parsed) ? parsed : (parsed.entries || []); }
            catch { entries = []; }
            const offset = msg.offset || 0;
              const limit = msg.limit || 20;
              const total = entries.length;
              const page = entries.slice(offset, offset + limit);
              this.sendMessage({ type: "filteredEntries", entries: page, total });
          } catch (err) {
            this.sendMessage({ type: "filteredEntries", entries: [] });
          }
        }
        break;
      case "createTag":
        if (msg.type === "createTag") {
          try { await this.mcpManager.invokeTool("mem_tags", { action: "create", tag: msg.tag, category: msg.category }); await this.loadData(); } catch {}
        }
        break;
      case "manualRetry":
        try { await this.mcpManager.restart(); } catch { this.sendMessage({ type: "serverStatus", status: "failed" }); }
        break;
    }
  }

  private startFallbackPolling(): void {
    this.refreshTimer = setInterval(() => {
      if (this.isAlive && this.mcpManager.status === "running") {
        this.loadData().catch(() => {});
      }
    }, SERVER_CONSTANTS.PANEL_FALLBACK_REFRESH_MS);
  }

  dispose(): void {
    if (this.refreshTimer) { clearInterval(this.refreshTimer); this.refreshTimer = undefined; }
    this.eventSubscription?.dispose();
    super.dispose();
  }
}
