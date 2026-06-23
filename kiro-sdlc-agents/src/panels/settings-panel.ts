import * as vscode from "vscode";
import { getNonce } from "../mcp-server-manager";
import { getStaticModels, fetchGatewayModels, getDefaultModel } from "../chat-panel/chat-models";

/** Secret storage keys */
const SECRET_KEYS: Record<string, string> = {
  anthropic: "kiroSdlc.anthropicApiKey",
  openai: "kiroSdlc.openaiApiKey",
};

export class SettingsPanel {
  public static readonly viewType = "kiroSettingsPanel";
  public static instance: SettingsPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
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
      (msg) => this.handleMessage(msg),
      undefined,
      this.disposables
    );

    this.panel.onDidDispose(
      () => {
        SettingsPanel.instance = undefined;
        this.disposeInternal();
      },
      null,
      this.disposables
    );
  }

  /**
   * Open or reveal the settings panel (singleton).
   */
  public static open(extensionUri: vscode.Uri, secrets: vscode.SecretStorage): void {
    if (SettingsPanel.instance) {
      SettingsPanel.instance.panel.reveal();
      return;
    }
    SettingsPanel.instance = new SettingsPanel(extensionUri, secrets);
  }

  public dispose(): void {
    this.panel.dispose();
  }

  private disposeInternal(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }

  private async handleMessage(msg: any): Promise<void> {
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
      case "setBackendUrl":
        await vscode.workspace.getConfiguration("kiroSdlc").update("backend.url", msg.url, vscode.ConfigurationTarget.Workspace);
        break;
      case "testBackendConnection":
        await this.handleTestBackendConnection(msg.url);
        break;
      case "setMcpServerPort": {
        const cfg = vscode.workspace.getConfiguration("kiroSdlc");
        await cfg.update("mcpServerPort", msg.port, vscode.ConfigurationTarget.Workspace);
        break;
      }
      case "setEnableMcpServer": {
        const cfg = vscode.workspace.getConfiguration("kiroSdlc");
        await cfg.update("enableMcpServer", msg.enabled, vscode.ConfigurationTarget.Workspace);
        break;
      }
      case "restartMcpServer":
        await this.handleRestartMcpServer();
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

    const backendUrl = config.get<string>("backend.url", "http://127.0.0.1:48721");
    const mcpServerPort = config.get<number>("mcpServerPort", 9181);
    const enableMcpServer = config.get<boolean>("enableMcpServer", true);

    const anthropicKey = await this.secrets.get(SECRET_KEYS.anthropic);
    const openaiKey = await this.secrets.get(SECRET_KEYS.openai);

    this.postMessage({
      type: "state",
      provider,
      model,
      ollamaUrl,
      baseUrl: baseUrl || "",
      hasAnthropicKey: !!anthropicKey,
      hasOpenaiKey: !!openaiKey,
      backendUrl,
      mcpServerPort,
      enableMcpServer,
    });

    // Push the provider-aware model catalog to the webview
    await this.sendModels(provider, model);
  }

  /**
   * Build and send the provider-aware model list to the webview.
   */
  private async sendModels(provider: string, currentModel: string): Promise<void> {
    let models = getStaticModels(provider);
    
    const config = vscode.workspace.getConfiguration("kiroSdlc");
    const anthropicBaseUrl = config.get<string>("anthropicBaseUrl", "");
    const openaiBaseUrl = config.get<string>("openaiBaseUrl", "");
    
    const gatewayBaseUrl = 
      provider === "anthropic" ? anthropicBaseUrl :
      provider === "openai" ? openaiBaseUrl : "";

    // KSA-242: Always try to fetch models from gateway (not just 127.0.0.1)
    if (gatewayBaseUrl) {
      const gatewayModels = await fetchGatewayModels(gatewayBaseUrl);
      if (gatewayModels && gatewayModels.length > 0) {
        models = gatewayModels;
      }
    }

    let selected = currentModel;
    if (!selected || !models.some((m: any) => m.id === selected)) {
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

  private async updateConfig(key: string, value: any): Promise<void> {
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
    } catch (err: any) {
      this.postMessage({ type: "keySaved", provider, success: false, error: err.message });
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

      if (response.ok) {
        this.postMessage({ type: "ollamaTested", success: true });
      } else {
        this.postMessage({ type: "ollamaTested", success: false, error: `HTTP ${response.status}` });
      }
    } catch (err: any) {
      this.postMessage({ type: "ollamaTested", success: false, error: err.message });
    }
  }

  private async handleTestLlm(): Promise<void> {
    try {
      await vscode.commands.executeCommand("kiroSdlc.testLlm");
      this.postMessage({ type: "llmTested", success: true });
    } catch (err: any) {
      this.postMessage({ type: "llmTested", success: false, error: err.message });
    }
  }

  private async handleTestBackendConnection(url: string): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${url}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        this.postMessage({ type: "backendTested", success: true });
      } else {
        this.postMessage({ type: "backendTested", success: false, error: `HTTP ${response.status}` });
      }
    } catch (err: any) {
      this.postMessage({ type: "backendTested", success: false, error: err.message });
    }
  }

  private async handleRestartMcpServer(): Promise<void> {
    try {
      await vscode.commands.executeCommand("kiroSdlc.restartMcpServer");
      this.postMessage({ type: "mcpServerRestarted", success: true, message: "MCP wrapper server restarted successfully." });
    } catch (err: any) {
      this.postMessage({ type: "mcpServerRestarted", success: false, message: `Restart failed: ${err.message}` });
    }
  }

  private postMessage(msg: any): void {
    this.panel.webview.postMessage(msg);
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const cspSource = webview.cspSource;

    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "webview-assets", "settings", "settings.css"));
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "webview-assets", "settings", "settings.js"));

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
            <p class="subtitle">Configure LLM provider and server connections</p>
        </header>

        <!-- Tab Navigation -->
        <div class="tab-bar" role="tablist">
            <button class="tab-btn active" id="tab-llm" data-tab="pane-llm" role="tab" aria-selected="true">&#129302; LLM Provider</button>
            <button class="tab-btn" id="tab-server" data-tab="pane-server" role="tab" aria-selected="false">&#127760; Server Settings</button>
        </div>

        <!-- Tab 1: LLM Provider -->
        <div class="tab-pane active" id="pane-llm" role="tabpanel">

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

        <!-- Tab 2: Server Settings -->
        <div class="tab-pane" id="pane-server" role="tabpanel">

            <section class="card" id="backend-mcp-section">
                <h2>&#127760; Backend MCP Server</h2>
                <p class="card-desc">Configure the remote backend server URL that this extension forwards all MCP tool requests to.</p>
                <div class="form-group">
                    <label for="backend-url-input">Backend URL</label>
                    <input type="text" id="backend-url-input" placeholder="http://127.0.0.1:48721">
                </div>
                <div class="btn-row">
                    <button id="save-backend-url-btn" class="btn primary">Save URL</button>
                    <button id="test-backend-btn" class="btn secondary">Test Connection</button>
                </div>
                <div id="backend-test-result" class="status-indicator"></div>
            </section>

            <section class="card" id="wrapper-mcp-section">
                <h2>&#9881; MCP Wrapper Server (Local)</h2>
                <p class="card-desc">Configure the local MCP wrapper server port that the IDE connects to. This in-process server forwards requests to the backend above.</p>
                <div class="form-group">
                    <label for="mcp-port-input">Wrapper Server Port</label>
                    <input type="number" id="mcp-port-input" min="1" max="65535" placeholder="9181">
                </div>
                <div class="form-group checkbox-group">
                    <label>
                        <input type="checkbox" id="enable-mcp-server-chk">
                        Enable MCP wrapper server on startup
                    </label>
                </div>
                <div class="btn-row">
                    <button id="save-wrapper-btn" class="btn primary">Save</button>
                    <button id="restart-mcp-btn" class="btn secondary">Restart Wrapper Server</button>
                </div>
                <div id="wrapper-result" class="status-indicator"></div>
            </section>

        </div>
    </div>

    <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }
}
