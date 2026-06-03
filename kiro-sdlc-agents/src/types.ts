/**
 * Shared TypeScript interfaces and types for Kiro SDLC Agents v2.0.0.
 * Defines contracts for MCP server communication, webview messaging, and panel management.
 */

import * as vscode from "vscode";

// === Server Management ===

export type ServerStatus = "starting" | "running" | "crashed" | "stopped";

export interface IServerManager {
  readonly status: ServerStatus;
  readonly pid: number | null;
  readonly port: number | null;
  spawn(): Promise<void>;
  kill(): Promise<void>;
  restart(): Promise<void>;
  invokeTool(name: string, args: Record<string, unknown>): Promise<string>;
  onStatusChange: vscode.Event<ServerStatus>;
}

// === JSON-RPC 2.0 Protocol ===

export interface McpRequest {
  jsonrpc: "2.0";
  id: number;
  method: "tools/call";
  params: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface McpResponse {
  jsonrpc: "2.0";
  id: number;
  result?: {
    content: Array<{ type: "text"; text: string }>;
  };
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// === Panel Management ===

export type PanelType = "graph" | "dashboard" | "tags" | "quality" | "analytics";

export interface IPanelManager {
  openPanel(type: PanelType): void;
  getPanel(type: PanelType): IKbPanel | undefined;
  disposeAll(): void;
  notifyAllPanels(message: ExtToWebviewMessage): void;
}

export interface IKbPanel {
  readonly viewType: string;
  readonly panel: vscode.WebviewPanel;
  reveal(): void;
  dispose(): void;
  sendMessage(msg: ExtToWebviewMessage): void;
  loadData(): Promise<void>;
}

// === Webview Message Protocol ===

// Messages FROM Webview TO Extension
export type WebviewToExtMessage =
  | { type: "ready" }
  | { type: "refresh" }
  | { type: "filterByType"; types: string[] }
  | { type: "filterByTier"; tiers: string[] }
  | { type: "filterByTag"; tag: string; offset?: number; limit?: number }
  | { type: "nodeClick"; entryId: number }
  | { type: "createTag"; tag: string; category?: string }
  | { type: "searchNodes"; query: string }
  | { type: "bulkAction"; action: "archive" | "delete" | "review"; entryIds: number[] }
  | { type: "createEntry"; title: string; content: string; entryType: string }
  | { type: "markReviewed"; entryId: number }
  | { type: "manualRetry" };

// Messages FROM Extension TO Webview
export type ExtToWebviewMessage =
  | { type: "graphData"; nodes: GraphNode[]; edges: GraphEdge[] }
  | { type: "dashboardData"; healthScore: number; totalEntries: number; qualityAvg: number; staleCount: number; unownedCount: number; recommendations: DashboardRec[]; reviews: DashboardReview[]; types: Record<string, number>; tiers: Record<string, number>; trends: Record<string, unknown>; trend: TrendPoint[]; recent: RecentEntry[] }
  | { type: "reviewMarked"; entryId: number; success: boolean; error?: string }
  | { type: "tagsData"; taxonomy: TagTaxonomy; popular: PopularTag[] }
  | { type: "qualityData"; stats: QualityStats; lowQuality: QualityEntry[]; confidence: ConfidenceStats; unreliable: QualityEntry[] }
  | { type: "analyticsData"; volume: VolumePoint[]; popular: PopularQuery[]; gaps: GapEntry[]; recommendations: Recommendation[] }
  | { type: "filteredEntries"; entries: KbEntry[]; total?: number }
  | { type: "entryDetail"; entry: KbEntry }
  | { type: "serverStatus"; status: "connected" | "disconnected" | "failed" }
  | { type: "error"; message: string; retryable: boolean };

// === Data Models ===

export interface GraphNode {
  id: number;
  title: string;
  type: string;
  tier: string;
  color: string;
  size: number;
}

export interface GraphEdge {
  source: number;
  target: number;
  relation: string;
}

export interface TrendPoint {
  date: string;
  count: number;
}

export interface RecentEntry {
  id: number;
  title: string;
  type: string;
  createdAt: string;
}

export interface DashboardRec {
  message?: string;
  action?: string;
  priority?: "high" | "low";
}

export interface DashboardReview {
  id?: number;
  entry_id?: number;
  summary?: string;
  last_reviewed_at?: string;
  last_reviewed?: string;
  days_overdue?: number;
  overdue_days?: number;
}

export interface TagTaxonomy {
  [category: string]: string[];
}

export interface PopularTag {
  tag: string;
  count: number;
  category?: string;
}

export interface QualityStats {
  average: number;
  median: number;
  distribution: Record<string, number>;
}

export interface QualityEntry {
  id: number;
  title: string;
  score: number;
  type: string;
  createdAt: string;
}

export interface ConfidenceStats {
  average: number;
  distribution: Record<string, number>;
}

export interface VolumePoint {
  date: string;
  searches: number;
}

export interface PopularQuery {
  query: string;
  count: number;
}

export interface GapEntry {
  query: string;
  count: number;
  suggestion?: string;
}

export interface Recommendation {
  title: string;
  reason: string;
  type: string;
}

export interface KbEntry {
  id: number;
  title: string;
  content: string;
  type: string;
  tier: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// === Error Types ===

export class McpServerNotRunningError extends Error {
  constructor() {
    super("MCP Server is not running.");
    this.name = "McpServerNotRunningError";
  }
}

export class McpTimeoutError extends Error {
  constructor(toolName: string, timeoutMs: number) {
    super(`MCP tool '${toolName}' timed out after ${timeoutMs}ms.`);
    this.name = "McpTimeoutError";
  }
}

export class McpSpawnError extends Error {
  constructor(reason: string) {
    super(`MCP server failed to start: ${reason}`);
    this.name = "McpSpawnError";
  }
}

export class McpBundleMissingError extends Error {
  constructor() {
    super("MCP server bundle not found. Reinstall extension.");
    this.name = "McpBundleMissingError";
  }
}

// === Tree View ===

export interface TreeSection {
  label: string;
  icon: string;
  children: TreeItem[];
}

export interface TreeItem {
  label: string;
  icon: string;
  command?: string;
  description?: string;
}

// === Constants ===

export const PANEL_VIEW_TYPES: Record<PanelType, string> = {
  graph: "kiroKbGraph",
  dashboard: "kiroKbDashboard",
  tags: "kiroKbTags",
  quality: "kiroKbQuality",
  analytics: "kiroKbAnalytics",
};

export const PANEL_TITLES: Record<PanelType, string> = {
  graph: "KB Graph",
  dashboard: "KB Dashboard",
  tags: "KB Tags",
  quality: "KB Quality",
  analytics: "KB Analytics",
};

export const NODE_TYPE_COLORS: Record<string, string> = {
  DECISION: "#3b82f6",
  ERROR_PATTERN: "#ef4444",
  ARCHITECTURE: "#8b5cf6",
  API_DESIGN: "#14b8a6",
  REQUIREMENT: "#ec4899",
  LESSON_LEARNED: "#06b6d4",
  PROCEDURE: "#10b981",
  CONTEXT: "#f59e0b",
  CODE_ENTITY: "#6366f1",
};

export const SERVER_CONSTANTS = {
  DEFAULT_PORT: 9180,
  MAX_RESTARTS: 3,
  BACKOFF_MS: [5000, 15000, 30000] as const,
  STARTUP_TIMEOUT_MS: 5000,
  REQUEST_TIMEOUT_MS: 30000,
  KILL_TIMEOUT_MS: 5000,
  DASHBOARD_REFRESH_MS: 60000,
  /** Fallback polling interval for event-driven panels (5 min safety net). */
  PANEL_FALLBACK_REFRESH_MS: 300000,
  GRAPH_MAX_NODES: 500,
};
