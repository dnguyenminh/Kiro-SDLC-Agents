/**
 * KbEventBus — Extension-side SSE client that subscribes to MCP server's /api/events.
 * Provides event-driven notifications to panels when KB data changes.
 *
 * Architecture:
 *   MCP Server ──SSE(/api/events)──> KbEventBus ──vscode.Event──> Panels
 *
 * Features:
 * - Auto-reconnect with exponential backoff on disconnect
 * - Debounced event batching (multiple rapid changes → single refresh)
 * - Only connects when server is running
 * - Graceful cleanup on dispose
 */

import * as vscode from "vscode";
import * as http from "http";

export type KbEventType =
  | "kb_entry_added"
  | "kb_entry_updated"
  | "kb_entry_deleted"
  | "tag_created"
  | "tag_deleted"
  | "tag_updated"
  | "quality_scored"
  | "bulk_operation"
  | "consolidation_complete";

export interface KbChangeEvent {
  type: KbEventType;
  timestamp: number;
  data: Record<string, unknown>;
}

/** Which panels should refresh for each event type. */
const EVENT_PANEL_MAP: Record<KbEventType, ("tags" | "quality" | "analytics")[]> = {
  kb_entry_added: ["tags", "quality", "analytics"],
  kb_entry_updated: ["quality", "analytics"],
  kb_entry_deleted: ["tags", "quality", "analytics"],
  tag_created: ["tags"],
  tag_deleted: ["tags"],
  tag_updated: ["tags"],
  quality_scored: ["quality"],
  bulk_operation: ["tags", "quality", "analytics"],
  consolidation_complete: ["tags", "quality", "analytics"],
};

export class KbEventBus implements vscode.Disposable {
  private request: http.ClientRequest | null = null;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private reconnectAttempts = 0;
  private disposed = false;
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  /** Debounce interval: batch rapid events within this window. */
  private static readonly DEBOUNCE_MS = 500;
  /** Max reconnect backoff: 30 seconds. */
  private static readonly MAX_BACKOFF_MS = 30000;
  /** Base backoff: 2 seconds. */
  private static readonly BASE_BACKOFF_MS = 2000;

  private readonly _onTagsChange = new vscode.EventEmitter<KbChangeEvent>();
  private readonly _onQualityChange = new vscode.EventEmitter<KbChangeEvent>();
  private readonly _onAnalyticsChange = new vscode.EventEmitter<KbChangeEvent>();

  /** Fires when Tags panel should refresh. */
  readonly onTagsChange = this._onTagsChange.event;
  /** Fires when Quality panel should refresh. */
  readonly onQualityChange = this._onQualityChange.event;
  /** Fires when Analytics panel should refresh. */
  readonly onAnalyticsChange = this._onAnalyticsChange.event;

  constructor(
    private readonly outputChannel: vscode.OutputChannel
  ) {}

  /**
   * Connect to SSE endpoint. Call when MCP server is confirmed running.
   */
  connect(port: number): void {
    if (this.disposed) return;
    this.disconnect();
    this.reconnectAttempts = 0;
    this.startConnection(port);
  }

  /**
   * Disconnect from SSE. Call when server stops or extension disposes.
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    if (this.request) {
      this.request.destroy();
      this.request = null;
    }
    // Clear debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  dispose(): void {
    this.disposed = true;
    this.disconnect();
    this._onTagsChange.dispose();
    this._onQualityChange.dispose();
    this._onAnalyticsChange.dispose();
  }

  private startConnection(port: number): void {
    const url = `http://127.0.0.1:${port}/api/events`;

    this.request = http.get(url, (res) => {
      if (res.statusCode !== 200) {
        this.outputChannel.appendLine(`[KbEventBus] SSE connection failed: HTTP ${res.statusCode}`);
        res.resume(); // drain response
        this.scheduleReconnect(port);
        return;
      }

      this.outputChannel.appendLine(`[KbEventBus] SSE connected to port ${port}`);
      this.reconnectAttempts = 0;

      let buffer = "";

      res.setEncoding("utf-8");
      res.on("data", (chunk: string) => {
        buffer += chunk;
        // Process complete SSE messages (terminated by double newline)
        const messages = buffer.split("\n\n");
        buffer = messages.pop() ?? ""; // Keep incomplete last chunk
        for (const msg of messages) {
          this.parseSseMessage(msg);
        }
      });

      res.on("end", () => {
        this.outputChannel.appendLine("[KbEventBus] SSE connection ended");
        this.request = null;
        if (!this.disposed) this.scheduleReconnect(port);
      });

      res.on("error", (err) => {
        this.outputChannel.appendLine(`[KbEventBus] SSE stream error: ${err.message}`);
        this.request = null;
        if (!this.disposed) this.scheduleReconnect(port);
      });
    });

    this.request.on("error", (err) => {
      // Connection refused = server not ready yet
      if ((err as NodeJS.ErrnoException).code !== "ECONNREFUSED") {
        this.outputChannel.appendLine(`[KbEventBus] SSE request error: ${err.message}`);
      }
      this.request = null;
      if (!this.disposed) this.scheduleReconnect(port);
    });
  }

  private parseSseMessage(raw: string): void {
    // SSE format: "event: <type>\ndata: <json>\n"
    // or ": keepalive\n" (comment, ignore)
    const lines = raw.split("\n");
    let eventType = "";
    let data = "";

    for (const line of lines) {
      if (line.startsWith(":")) continue; // Comment (keepalive)
      if (line.startsWith("event: ")) eventType = line.slice(7);
      else if (line.startsWith("data: ")) data = line.slice(6);
    }

    if (!eventType || eventType === "connected") return;

    try {
      const event: KbChangeEvent = data ? JSON.parse(data) : { type: eventType as KbEventType, timestamp: Date.now(), data: {} };
      this.dispatchEvent(event);
    } catch {
      // Malformed data — ignore
    }
  }

  private dispatchEvent(event: KbChangeEvent): void {
    const panels = EVENT_PANEL_MAP[event.type];
    if (!panels) return;

    for (const panel of panels) {
      this.debouncedEmit(panel, event);
    }
  }

  /**
   * Debounce rapid events for the same panel.
   * If 5 entries are ingested in 200ms, panel refreshes only once (after 500ms quiet).
   */
  private debouncedEmit(panel: "tags" | "quality" | "analytics", event: KbChangeEvent): void {
    const existing = this.debounceTimers.get(panel);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(panel);
      switch (panel) {
        case "tags": this._onTagsChange.fire(event); break;
        case "quality": this._onQualityChange.fire(event); break;
        case "analytics": this._onAnalyticsChange.fire(event); break;
      }
    }, KbEventBus.DEBOUNCE_MS);

    this.debounceTimers.set(panel, timer);
  }

  private scheduleReconnect(port: number): void {
    if (this.disposed || this.reconnectTimer) return;

    const backoff = Math.min(
      KbEventBus.BASE_BACKOFF_MS * Math.pow(2, this.reconnectAttempts),
      KbEventBus.MAX_BACKOFF_MS
    );
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      if (!this.disposed) this.startConnection(port);
    }, backoff);
  }
}
