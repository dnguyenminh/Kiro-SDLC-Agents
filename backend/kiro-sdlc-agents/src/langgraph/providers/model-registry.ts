/**
 * ModelRegistry — KSA-231
 * Fetches and caches available models from Kiro API with 1-hour TTL.
 * Supports ETag conditional requests for bandwidth efficiency.
 * Integrates with VS Code settings for model selection persistence.
 */

import * as vscode from "vscode";
import { TokenManager } from "./token-manager";
import { AnthropicAdapter } from "./anthropic-adapter";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KiroModel {
  id: string;
  displayName: string;
  provider: string;
  contextWindow: number;
  capabilities: { chat: boolean; code: boolean; vision: boolean };
  maxOutputTokens?: number;
}

interface ModelCache {
  models: KiroModel[];
  fetchedAt: number;
  etag: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes — force refresh when Settings opened
const REQUEST_TIMEOUT_MS = 10_000;

// ─── ModelRegistry ────────────────────────────────────────────────────────────

export class ModelRegistry implements vscode.Disposable {
  private cache: ModelCache | null = null;
  private backgroundRefreshInProgress = false;
  private readonly adapter = new AnthropicAdapter();

  private readonly _onModelsChanged = new vscode.EventEmitter<KiroModel[]>();
  readonly onModelsChanged: vscode.Event<KiroModel[]> = this._onModelsChanged.event;

  private readonly tokenManager: TokenManager;
  private readonly outputChannel: vscode.OutputChannel;

  constructor(tokenManager: TokenManager, outputChannel: vscode.OutputChannel) {
    this.tokenManager = tokenManager;
    this.outputChannel = outputChannel;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Get available models. Uses cache when valid, otherwise fetches from API.
   * @param forceRefresh - bypass cache TTL and fetch fresh
   */
  async getModels(forceRefresh = false): Promise<KiroModel[]> {
    const now = Date.now();

    // If force refresh requested or no cache exists
    if (forceRefresh || !this.cache) {
      return this.fetchModels();
    }

    const cacheAge = now - this.cache.fetchedAt;

    // Cache < 5 minutes: return immediately
    if (cacheAge < STALE_THRESHOLD_MS) {
      return this.cache.models;
    }

    // Cache 5min–1h: return cached, background refresh
    if (cacheAge < CACHE_TTL_MS) {
      this.backgroundRefresh();
      return this.cache.models;
    }

    // Cache > 1h: block on refresh
    return this.fetchModels();
  }

  /**
   * Get the currently selected model ID from VS Code settings.
   */
  getSelectedModel(): string {
    const config = vscode.workspace.getConfiguration("kiroSdlc");
    return config.get<string>("kiroModel", "");
  }

  /**
   * Persist model selection to VS Code settings.
   */
  async setSelectedModel(modelId: string): Promise<void> {
    const config = vscode.workspace.getConfiguration("kiroSdlc");
    await config.update("kiroModel", modelId, vscode.ConfigurationTarget.Global);
  }

  dispose(): void {
    this._onModelsChanged.dispose();
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private async fetchModels(): Promise<KiroModel[]> {
    try {
      // SINGLE SOURCE OF TRUTH (KSA-237): read models from the local kiro-ts
      // gateway `/v1/models`, which in turn calls the REAL Kiro backend
      // (CodeWhisperer ListAvailableModels) with a static fallback. The old
      // `kiro.api.{region}.amazonaws.com/v1/models` host is DEAD (no DNS), so
      // we no longer call it. No bearer token needed — the gateway binds to
      // 127.0.0.1 and resolves Kiro SSO credentials itself.
      const port = vscode.workspace.getConfiguration("kiroSdlc").get<number>("mcpServerPort", 9181);
      const url = this.adapter.getModelsEndpointUrl(port);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Conditional request with ETag (gateway may not send one — harmless).
      if (this.cache?.etag) {
        headers["If-None-Match"] = this.cache.etag;
      }

      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      // 304 Not Modified — cache is still valid
      if (response.status === 304) {
        this.cache!.fetchedAt = Date.now();
        return this.cache!.models;
      }

      if (!response.ok) {
        this.log("WARN", `Models gateway returned ${response.status}`);
        return this.cache?.models || [];
      }

      const data = await response.json() as { data?: any[]; models?: any[] };
      const models = this.parseModelsResponse(data);

      const etag = response.headers.get("ETag") || null;
      const previousModels = this.cache?.models || [];

      this.cache = {
        models,
        fetchedAt: Date.now(),
        etag,
      };

      // Notify if models changed
      if (this.modelsChanged(previousModels, models)) {
        this._onModelsChanged.fire(models);
        this.log("INFO", `Models updated: ${models.length} models`);
      }

      // If no model selected yet, auto-select first chat-capable model
      const selected = this.getSelectedModel();
      if (!selected && models.length > 0) {
        const defaultModel = models.find(m => m.capabilities.chat) || models[0];
        await this.setSelectedModel(defaultModel.id);
      }

      return models;
    } catch (err) {
      this.log("ERROR", `Failed to fetch models: ${(err as Error).message}`);
      // Return cached if available
      if (this.cache) {
        return this.cache.models;
      }
      return [];
    }
  }

  private backgroundRefresh(): void {
    if (this.backgroundRefreshInProgress) { return; }
    this.backgroundRefreshInProgress = true;

    this.fetchModels().finally(() => {
      this.backgroundRefreshInProgress = false;
    });
  }

  private parseModelsResponse(data: { data?: any[]; models?: any[] }): KiroModel[] {
    // Gateway /v1/models returns the Anthropic envelope: { data: [{ id, display_name }] }.
    // Older Kiro API shape was { models: [{ id, displayName, ... }] }. Support both.
    if (Array.isArray(data.data)) {
      return data.data
        .filter((m: any) => m.id)
        .map((m: any) => ({
          id: m.id,
          displayName: m.display_name || m.displayName || m.id,
          provider: "kiro",
          contextWindow: m.contextWindow || 0,
          capabilities: {
            chat: m.capabilities?.chat ?? true,
            code: m.capabilities?.code ?? false,
            vision: m.capabilities?.vision ?? false,
          },
          maxOutputTokens: m.maxOutputTokens || undefined,
        }));
    }

    if (!data.models || !Array.isArray(data.models)) { return []; }

    return data.models
      .filter((m: any) => m.id && m.displayName)
      .map((m: any) => ({
        id: m.id,
        displayName: m.displayName || m.id,
        provider: m.provider || "unknown",
        capabilities: {
          chat: m.capabilities?.chat ?? true,
          code: m.capabilities?.code ?? false,
          vision: m.capabilities?.vision ?? false,
        },
        contextWindow: m.contextWindow || 0,
        maxOutputTokens: m.maxOutputTokens || undefined,
      }));
  }

  private modelsChanged(prev: KiroModel[], next: KiroModel[]): boolean {
    if (prev.length !== next.length) { return true; }
    const prevIds = new Set(prev.map(m => m.id));
    return next.some(m => !prevIds.has(m.id));
  }

  private log(level: string, message: string): void {
    this.outputChannel.appendLine(`[${level}] ModelRegistry: ${message}`);
  }
}
