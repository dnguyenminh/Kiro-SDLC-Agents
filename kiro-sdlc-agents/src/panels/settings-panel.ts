/**
 * SettingsPanel — KSA-210
 * WebviewPanel for LLM provider configuration.
 * Opens as a standalone tab via command `kiroSdlc.openSettings`.
 * Handles provider selection, API key management via SecretStorage, and connection testing.
 */

import * as vscode from "vscode";
import { getNonce } from "../mcp-server-manager";
import { getStaticModels, getDefaultModel, fetchGatewayModels } from "../chat-panel/chat-models";
import type { ChatModelEntry } from "../chat-panel/message-protocol";

/** Messages FROM webview TO extension */
export type SettingsWebviewToExtMsg =
  | { type: "ready" }
  | { type: "getState" }
  | { type: "getModels"; provider: string }
  | { type: "setProvider"; provider: string }
  | { type: "setModel"; model: string }
  | { type: "setOllamaUrl"; url: string }
  | { type: "setBaseUrl"; provider: string; url: string }
  | { type: "saveApiKey"; provider: string; key: string }
  | { type: "clearApiKey"; provider: string }
  | { type: "testOllamaConnection"; url: string }
  | { type: "testLlm" };

/** Messages FROM extension TO webview */
export type SettingsExtToWebviewMsg =
  | { type: "state"; provider: string; model: string; ollamaUrl: string; baseUrl: string; hasAnthropicKey: boolean; hasOpenaiKey: boolean; gatewayEndpoint: string; gatewayApiKey: string }
  | { type: "models"; provider: string; models: ChatModelEntry[]; selected: string; defaultModel: string }
  | { type: "keySaved"; provider: string; success: boolean; error?: string }
  | { type: "keyCleared"; provider: string }
  | { type: "ollamaTestResult"; success: boolean; message: string }
  | { type: "llmTestResult"; success: boolean; message: string; latencyMs?: number; model?: string };

/** Secret storage keys */
const SECRET_KEYS: Record<string, string> = {
  anthropic: "kiroSdlc.anthropicApiKey",
  openai: "kiroSdlc.openaiApiKey",
};

export class SettingsPanel implements vscode.Disposable {
  public static readonly viewType = "kiroSettingsPanel";
  private static instance: SettingsPanel | undefined;

  private panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly secrets: vscode.SecretStorage
  ) {
    this.panel = vscode.window.createWebviewPanel(
      SettingsPanel.viewType,
      "SDLC Pipeline Settings",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, "webview-assets"),
        ],
      }
    );

    this.panel.iconPath = new vscode.ThemeIcon("gear");
    this.panel.webview.html = this.getHtml(this.panel.webview);

    this.panel.webview.onDidReceiveMessage(
      (msg: SettingsWebviewToExtMsg) => this.handleMessage(msg),
      undefined,
      this.disposables
    );

    this.panel.onDidDispose(() => {
      SettingsPanel.instance = undefined;
      this.disposeInternal();
    }, null, this.disposables);
  }

  /**
   * Open or reveal the settings panel (singleton).
   */
  static open(extensionUri: vscode.Uri, secrets: vscode.SecretStorage): void {
    if (SettingsPanel.instance) {
      SettingsPanel.instance.panel.reveal();
      return;
    }
    SettingsPanel.instance = new SettingsPanel(extensionUri, secrets);
  }

  dispose(): void {
    this.panel.dispose();
  }

  private disposeInternal(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }

  private async handleMessage(msg: SettingsWebviewToExtMsg): Promise<void> {
    switch (msg.type) {
      case "ready":
      case "getState":
        await this.sendCurrentState();
        break;

      case "setProvider":
        await this.updateConfig("llmProvider", msg.provider);
        await this.sendCurrentState();
        break;

      case "getModels": {
        const config = vscode.workspace.getConfiguration("kiroSdlc");
        const currentModel = config.get<string>("llmModel", "");
        await this.sendModels(msg.provider, currentModel);
        break;
      }

      case "setModel":
        await this.updateConfig("llmModel", msg.model);
        break;

      case "setOllamaUrl":
        await this.updateConfig("ollamaUrl", msg.url);
        break;

      case "setBaseUrl":
        if (msg.provider === "anthropic") {
          await this.updateConfig("anthropicBaseUrl", msg.url);
        } else if (msg.provider === "openai") {
          await this.updateConfig("openaiBaseUrl", msg.url);
        }
        break;

      case "saveApiKey":
        await this.handleSaveApiKey(msg.provider, msg.key);
        break;

      case "clearApiKey":
        await this.handleClearApiKey(msg.provider);
        break;

      case "testOllamaConnection":
        await this.handleTestOllama(msg.url);
        break;

      case "testLlm":
        await this.handleTestLlm();
        break;
    }
  }

  private async sendCurrentState(): Promise<void> {
    const config = vscode.workspace.getConfiguration("kiroSdlc");
    const provider = config.get<string>("llmProvider", "anthropic");
    const model = config.get<string>("llmModel", "");
    const ollamaUrl = config.get<string>("ollamaUrl", "http://localhost:11434");
    const anthropicBaseUrl = config.get<string>("anthropicBaseUrl", "");
    const openaiBaseUrl = config.get<string>("openaiBaseUrl", "");
    const baseUrl = provider === "anthropic" ? anthropicBaseUrl : openaiBaseUrl;

    const anthropicKey = await this.secrets.get(SECRET_KEYS.anthropic);
    const openaiKey = await this.secrets.get(SECRET_KEYS.openai);

    // Gateway info (for the Kiro provider) — endpoint + stable gateway key the
    // user copies into external agents (Cline/Cursor/...).
    const port = config.get<number>("mcpServerPort", 9181);
    // Base URL for external Anthropic-compatible clients. Clients append
    // `/v1/messages` themselves, so we expose the `/anthropic` base prefix.
    const gatewayEndpoint = `http://127.0.0.1:${port}/anthropic`;
    const gatewayApiKey = await this.fetchGatewayApiKey(port);

    this.postMessage({
      type: "state",
      provider,
      model,
      ollamaUrl,
      baseUrl: baseUrl || "",
      hasAnthropicKey: !!anthropicKey,
      hasOpenaiKey: !!openaiKey,
      gatewayEndpoint,
      gatewayApiKey,
    });

    // Push the provider-aware model catalog to the webview (single source of
    // truth — same module the Chat Panel uses). For gateway base URLs, fetch
    // /v1/models so Settings + Chat box show the identical list.
    await this.sendModels(provider, model);
  }

  /**
   * Build and send the provider-aware model list to the webview.
   * KSA-237: When the base URL points at the local gateway (127.0.0.1),
   * fetch models dynamically so the dropdown shows all available Kiro models.
   */
  private async sendModels(provider: string, currentModel: string): Promise<void> {
    let models: ChatModelEntry[] = getStaticModels(provider);

    // KSA-237: When the base URL points at the local gateway,
    // fetch models dynamically from the gateway — it returns the REAL Kiro
    // model list (14 models including deepseek/minimax/etc.). This ensures
    // Settings shows all available models regardless of provider label.
    const config = vscode.workspace.getConfiguration("kiroSdlc");
    const port = config.get<number>("mcpServerPort", 9181);
    const anthropicBaseUrl = config.get<string>("anthropicBaseUrl", "");
    const openaiBaseUrl = config.get<string>("openaiBaseUrl", "");
    const isGatewayBaseUrl =
      (provider === "anthropic" && anthropicBaseUrl.includes("127.0.0.1")) ||
      (provider === "openai" && openaiBaseUrl.includes("127.0.0.1"));

    if (isGatewayBaseUrl) {
      const gatewayModels = port ? await fetchGatewayModels(port) : null;
      if (gatewayModels && gatewayModels.length > 0) {
        models = gatewayModels;
      }
    }

    let selected = currentModel;
    if (!selected || !models.some((m) => m.id === selected)) {
      selected = models.length > 0 ? models[0].id : getDefaultModel(provider);
    }

    this.postMessage({
      type: "models",
      provider,
      models,
      selected,
      defaultModel: getDefaultModel(provider),
    });
  }

  /**
   * Fetch the stable gateway API key from the local MCP server.
   * Returns an empty string if the server is not running (the panel shows a
   * hint to start the server in that case).
   */
  private async fetchGatewayApiKey(port: number): Promise<string> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(`http://127.0.0.1:${port}/v1/gateway-key`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) { return ""; }
      const data = await response.json() as { gatewayApiKey?: string };
      return data.gatewayApiKey || "";
    } catch {
      return "";
    }
  }

  private async updateConfig(key: string, value: string): Promise<void> {
    const config = vscode.workspace.getConfiguration("kiroSdlc");
    await config.update(key, value || undefined, vscode.ConfigurationTarget.Global);
  }

  private async handleSaveApiKey(provider: string, key: string): Promise<void> {
    const secretKey = SECRET_KEYS[provider];
    if (!secretKey) {
      this.postMessage({ type: "keySaved", provider, success: false, error: "Unknown provider" });
      return;
    }
    try {
      await this.secrets.store(secretKey, key);
      this.postMessage({ type: "keySaved", provider, success: true });
    } catch (err) {
      this.postMessage({ type: "keySaved", provider, success: false, error: (err as Error).message });
    }
  }

  private async handleClearApiKey(provider: string): Promise<void> {
    const secretKey = SECRET_KEYS[provider];
    if (!secretKey) { return; }
    await this.secrets.delete(secretKey);
    this.postMessage({ type: "keyCleared", provider });
  }

  private async handleTestOllama(url: string): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${url}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        this.postMessage({
          type: "ollamaTestResult",
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`,
        });
        return;
      }

      const data = await response.json() as { models?: Array<{ name: string }> };
      const modelCount = data.models?.length ?? 0;
      this.postMessage({
        type: "ollamaTestResult",
        success: true,
        message: `Connected (${modelCount} model${modelCount !== 1 ? "s" : ""} available)`,
      });
    } catch (err) {
      const message = (err as Error).name === "AbortError"
        ? "Connection timed out (5s)"
        : `Cannot reach server: ${(err as Error).message}`;
      this.postMessage({ type: "ollamaTestResult", success: false, message });
    }
  }

  private async handleTestLlm(): Promise<void> {
    const config = vscode.workspace.getConfiguration("kiroSdlc");
    const provider = config.get<string>("llmProvider", "anthropic");
    const customModel = config.get<string>("llmModel", "");
    const ollamaUrl = config.get<string>("ollamaUrl", "http://localhost:11434");

    const start = Date.now();

    try {
      if (provider === "onnx") {
        this.postMessage({
          type: "llmTestResult",
          success: false,
          message: "ONNX test not supported via this panel. ONNX runs in-process (CPU-only) and has no HTTP test endpoint.",
        });
      } else if (provider === "ollama") {
        const model = customModel || "llama3.1";
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(`${ollamaUrl}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, prompt: "Say hello in 5 words.", stream: false }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json() as { response?: string };
        const latencyMs = Date.now() - start;
        this.postMessage({
          type: "llmTestResult",
          success: true,
          message: data.response || "(empty response)",
          latencyMs,
          model,
        });
      } else {
        // Anthropic / OpenAI — use API key from secrets
        const secretKey = SECRET_KEYS[provider];
        const apiKey = secretKey ? await this.secrets.get(secretKey) : undefined;
        const anthropicBaseUrl = config.get<string>("anthropicBaseUrl", "");
        const openaiBaseUrl = config.get<string>("openaiBaseUrl", "");
        const hasCustomUrl = provider === "anthropic" ? !!anthropicBaseUrl : !!openaiBaseUrl;
        const isGatewayUrl = (provider === "anthropic" && anthropicBaseUrl.includes("127.0.0.1"));

        if (!apiKey && !hasCustomUrl && !isGatewayUrl) {
          this.postMessage({
            type: "llmTestResult",
            success: false,
            message: `No API key set for ${provider}. Save a key first (or set a Base URL for keyless endpoints).`,
          });
          return;
        }

        if (provider === "anthropic") {
          const model = customModel || "claude-sonnet-4-20250514";
          const baseUrl = anthropicBaseUrl || "https://api.anthropic.com";
          const isGateway = baseUrl.includes("127.0.0.1");
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 30000);

          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01",
          };
          if (apiKey) {
            headers["x-api-key"] = apiKey;
          } else if (isGateway) {
            // Gateway mode: fetch the gateway API key for authentication
            const port = config.get<number>("mcpServerPort", 9181);
            const gatewayKey = await this.fetchGatewayApiKey(port);
            if (gatewayKey) {
              headers["x-api-key"] = gatewayKey;
            }
          }

          const response = await fetch(`${baseUrl}/v1/messages`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              model,
              max_tokens: 50,
              messages: [{ role: "user", content: "Say hello in 5 words." }],
              // Force non-streaming so the response is a single JSON object.
              // Without this, a gateway/proxy base URL defaults to SSE and the
              // response.json() parse fails ("Unexpected token 'e', event mes").
              stream: false,
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`HTTP ${response.status}: ${errBody.slice(0, 200)}`);
          }
          const data = await response.json() as { content?: Array<{ text?: string }> };
          const latencyMs = Date.now() - start;
          const text = data.content?.[0]?.text || "(empty)";
          this.postMessage({ type: "llmTestResult", success: true, message: text, latencyMs, model });
        } else if (provider === "openai") {
          const model = customModel || "gpt-4o";
          const baseUrl = (openaiBaseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 30000);

          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (apiKey) {
            headers["Authorization"] = `Bearer ${apiKey}`;
          }

          const response = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              model,
              max_tokens: 50,
              messages: [{ role: "user", content: "Say hello in 5 words." }],
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`HTTP ${response.status}: ${errBody.slice(0, 200)}`);
          }
          const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
          const latencyMs = Date.now() - start;
          const text = data.choices?.[0]?.message?.content || "(empty)";
          this.postMessage({ type: "llmTestResult", success: true, message: text, latencyMs, model });
        }
      }
    } catch (err) {
      const latencyMs = Date.now() - start;
      const message = (err as Error).name === "AbortError"
        ? "Request timed out (30s)"
        : (err as Error).message;
      this.postMessage({ type: "llmTestResult", success: false, message, latencyMs });
    }
  }

  private postMessage(msg: SettingsExtToWebviewMsg): void {
    this.panel.webview.postMessage(msg);
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const cspSource = webview.cspSource;

    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "webview-assets", "settings", "settings.css")
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "webview-assets", "settings", "settings.js")
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} data:; font-src ${cspSource}; connect-src 'none';">
    <link rel="stylesheet" href="${cssUri}">
    <title>SDLC Pipeline Settings</title>
</head>
<body>
    <div id="settings-root">
        <header class="settings-header">
            <h1>&#9881; SDLC Pipeline Settings</h1>
            <p class="subtitle">Configure LLM provider for agent pipeline</p>
        </header>

        <section class="card" id="provider-section">
            <h2>&#129302; LLM Provider</h2>
            <div class="provider-select-group">
                <label for="provider-select">Choose provider</label>
                <select id="provider-select">
                    <option value="anthropic">Anthropic — Claude models (recommended)</option>
                    <option value="openai">OpenAI — GPT models</option>
                    <option value="ollama">Ollama — Local models (no API key needed)</option>
                    <option value="onnx">ONNX — CPU-only local (Phi-3, SmolLM2)</option>
                </select>
            </div>
        </section>

        <section class="card" id="gateway-section" style="display:none;">
            <h2>&#128268; Gateway Info (Anthropic-compatible)</h2>
            <p class="card-desc">No API key needed — gateway uses Kiro IDE credentials. Copy endpoint + key below to configure external agents (Cline/Cursor/...).</p>
            <div class="form-group">
                <label for="gateway-endpoint-input">Gateway Endpoint</label>
                <div class="input-with-toggle">
                    <input type="text" id="gateway-endpoint-input" readonly value="">
                    <button class="icon-btn" id="copy-gateway-endpoint" title="Copy endpoint" aria-label="Copy gateway endpoint">&#128203;</button>
                </div>
            </div>
            <div class="form-group">
                <label for="gateway-key-input">Gateway API Key</label>
                <div class="input-with-toggle">
                    <input type="password" id="gateway-key-input" readonly value="">
                    <button class="icon-btn" id="toggle-gateway-key" title="Show/Hide" aria-label="Toggle gateway key visibility">&#128065;</button>
                    <button class="icon-btn" id="copy-gateway-key" title="Copy key" aria-label="Copy gateway key">&#128203;</button>
                </div>
                <div id="gateway-status" class="status-indicator"></div>
            </div>
        </section>

        <section class="card" id="api-section" style="display:none;">
            <h2>&#128273; API Configuration</h2>
            <div class="form-group">
                <label for="api-key-input">API Key</label>
                <div class="input-with-toggle">
                    <input type="password" id="api-key-input" placeholder="Enter API key..." autocomplete="off">
                    <button class="icon-btn" id="toggle-key-visibility" title="Show/Hide" aria-label="Toggle API key visibility">&#128065;</button>
                </div>
                <div id="key-status" class="status-indicator"></div>
            </div>
            <div class="form-group">
                <label for="base-url-input">Base URL <span style="opacity:0.6">(optional — for custom endpoints)</span></label>
                <input type="text" id="base-url-input" placeholder="Leave empty for official API">
            </div>
            <div class="form-group">
                <label for="model-input">Model</label>
                <select id="model-input">
                    <option value="">— Select model —</option>
                </select>
            </div>
            <div class="btn-row">
                <button id="save-key-btn" class="btn primary" disabled>Save API Key</button>
                <button id="clear-key-btn" class="btn danger-outline">Clear Key</button>
            </div>
        </section>

        <section class="card" id="ollama-section" style="display:none;">
            <h2>&#129433; Ollama Configuration</h2>
            <div class="form-group">
                <label for="ollama-url-input">Server URL</label>
                <input type="text" id="ollama-url-input" value="http://localhost:11434">
            </div>
            <div class="form-group">
                <label for="ollama-model-input">Model</label>
                <input type="text" id="ollama-model-input" placeholder="llama3.1">
            </div>
            <div class="btn-row">
                <button id="test-ollama-btn" class="btn secondary">Test Connection</button>
            </div>
            <div id="ollama-status" class="status-indicator"></div>
        </section>

        <section class="card" id="test-section">
            <h2>&#129514; Connection Test</h2>
            <p class="card-desc">Send a test prompt to verify your LLM configuration works end-to-end.</p>
            <div class="btn-row">
                <button id="test-llm-btn" class="btn primary">Test LLM</button>
            </div>
            <div id="test-result" class="test-result" style="display:none;"></div>
        </section>
    </div>

    <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }
}
