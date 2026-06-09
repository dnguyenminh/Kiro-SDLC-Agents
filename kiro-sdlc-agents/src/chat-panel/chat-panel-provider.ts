/**
 * ChatPanelProvider — KSA-210
 * WebviewViewProvider for the Chat Panel sidebar.
 * Renders chat UI, connects to LangGraph engine, handles postMessage.
 */

import * as vscode from "vscode";
import { getNonce } from "../mcp-server-manager";
import { debugLog, debugError } from "../debug-logger";
import { McpServerManager } from "../mcp-server-manager";
import { LangGraphEngine } from "../langgraph/langgraph-engine";
import { createLlmProvider } from "../langgraph/providers";
import { MessageHandler } from "./message-handler";
import { ChatWebviewToExtMessage, ChatExtToWebviewMessage } from "./message-protocol";
import { getStaticModels, getDefaultModel, fetchGatewayModels } from "./chat-models";
import { ContextUsageTracker } from "./context-usage-tracker";

export class ChatPanelProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = "kiroChatPanel";

  private view: vscode.WebviewView | undefined;
  private engine: LangGraphEngine | null = null;
  private messageHandler: MessageHandler | null = null;
  private messageBuffer: ChatExtToWebviewMessage[] = [];
  private contextUsageTracker: ContextUsageTracker = new ContextUsageTracker();
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly mcpManager: McpServerManager,
    private readonly workspaceRoot: string,
    private readonly secrets?: vscode.SecretStorage,
    private readonly workspaceState?: vscode.Memento
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "webview-assets"),
        vscode.Uri.joinPath(this.extensionUri, "out"),
      ],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      (msg: ChatWebviewToExtMessage) => {
        // Handle executeCommand from webview (e.g. Workflow Graph button)
        if ((msg as any).type === "executeCommand" && (msg as any).command) {
          vscode.commands.executeCommand((msg as any).command);
          return;
        }
        // KSA-240: Handle state persistence directly
        if (msg.type === "chat:saveState") {
          this.saveChatState(msg.payload);
          return;
        }
        // KSA-240: Webview debug log round-trip
        if ((msg as any).type === "chat:debugLog") {
          debugLog(`[webview] ${(msg as any).text}`);
          return;
        }
        // On ready, send initial MCP server status
        if (msg.type === "ready") {
          const currentStatus = this.mcpManager.status;
          const webviewStatus = currentStatus === "running" ? "connected"
            : currentStatus === "crashed" ? "failed"
            : "disconnected";
          this.sendToWebview({ type: "serverStatus", status: webviewStatus });
          // Send the provider-aware model list to populate the dropdown
          void this.sendModels();
          // KSA-240: Restore persisted chat state
          this.restoreChatState();
          // KSA-240: Send loaded steering rules
          this.sendSteeringInfo();
        }
        this.handleMessage(msg);
      },
      undefined,
      this.disposables
    );

    webviewView.onDidDispose(() => {
      this.view = undefined;
    });

    // Flush buffered messages when view becomes visible
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible && this.messageBuffer.length > 0) {
        for (const msg of this.messageBuffer) {
          webviewView.webview.postMessage(msg);
        }
        this.messageBuffer = [];
      }
    });

    // Subscribe to MCP server status changes
    this.mcpManager.onStatusChange((status) => {
      const webviewStatus = status === "running" ? "connected"
        : status === "crashed" ? "failed"
        : "disconnected";
      this.sendToWebview({ type: "serverStatus", status: webviewStatus });
    }, undefined, this.disposables);

    // Re-send the model list whenever the LLM provider / model settings change.
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (
          e.affectsConfiguration("kiroSdlc.llmProvider") ||
          e.affectsConfiguration("kiroSdlc.llmModel")
        ) {
          // Rebuild the engine's provider so requests use the new settings.
          if (this.engine && this.secrets) {
            this.engine.setLlmProvider(createLlmProvider(this.secrets));
          }
          void this.sendModels();
        }
      })
    );
  }

  /**
   * Build and send the provider-aware model list to the webview.
   * For the kiro provider, attempts the local gateway /v1/models first,
   * falling back to the static catalog.
   */
  private async sendModels(): Promise<void> {
    const config = vscode.workspace.getConfiguration("kiroSdlc");
    const provider = config.get<string>("llmProvider", "anthropic");
    const anthropicBaseUrl = config.get<string>("anthropicBaseUrl", "");

    let models = getStaticModels(provider);

    // KSA-237: When the base URL points at the local gateway,
    // fetch models dynamically — returns ALL Kiro models (14 incl. deepseek etc).
    const isGatewayBaseUrl =
      (provider === "anthropic" && anthropicBaseUrl.includes("127.0.0.1"));

    if (isGatewayBaseUrl) {
      const gatewayModels = await fetchGatewayModels(anthropicBaseUrl);
      if (gatewayModels && gatewayModels.length > 0) {
        models = gatewayModels;
      }
    }

    // Resolve the currently selected model id.
    const llmModel = config.get<string>("llmModel", "");
    let selected = llmModel;
    if (!selected || !models.some((m) => m.id === selected)) {
      selected = models.length > 0 ? models[0].id : getDefaultModel(provider);
    }

    // Auto-routing is only meaningful for the pipeline; expose it for all
    // providers as a convenience entry that lets the backend pick a default.
    this.sendToWebview({
      type: "chat:models",
      provider,
      models,
      selected,
      supportsAuto: true,
    });
  }

  private sendToWebview(msg: ChatExtToWebviewMessage): void {
    // retainContextWhenHidden keeps the webview alive, so postMessage works even
    // when the panel is not focused/visible. Always deliver directly; only buffer
    // if the view hasn't been resolved yet.
    if (this.view) {
      this.view.webview.postMessage(msg);
    } else {
      this.messageBuffer.push(msg);
      if (this.messageBuffer.length > 200) {
        this.messageBuffer.shift();
      }
    }
  }

  // === KSA-240: Chat State Persistence ===
  private static readonly STATE_KEY = "chatPanel.state";

  /** Save current chat state (called from webview via message) */
  saveChatState(state: { tabs: unknown[]; activeTabId: string; messageHistory?: string[] }): void {
    if (this.workspaceState) {
      debugLog(` saveChatState: ${(state.tabs as any[])?.length || 0} tabs, activeTab=${state.activeTabId}, history=${state.messageHistory?.length || 0}`);
      void this.workspaceState.update(ChatPanelProvider.STATE_KEY, state);
    }
  }

  /** Restore chat state on webview ready */
  private restoreChatState(): void {
    if (!this.workspaceState) return;
    const state = this.workspaceState.get<{ tabs: unknown[]; activeTabId: string; messageHistory?: string[] }>(ChatPanelProvider.STATE_KEY);
    debugLog(` restoreChatState: state=${state ? "found" : "null"}, tabs=${state?.tabs?.length || 0}, activeTab=${state?.activeTabId || "none"}`);
    if (state && state.tabs && state.tabs.length > 0) {
      this.sendToWebview({
        type: "tab:updated",
        payload: { tabs: state.tabs as any, activeTabId: state.activeTabId, messageHistory: state.messageHistory } as any,
      });
      // Also send chat history for active tab and restore LLM context
      const activeTab = (state.tabs as any[]).find((t: any) => t.id === state.activeTabId);
      if (activeTab && activeTab.messages && activeTab.messages.length > 0) {
        this.sendToWebview({
          type: "chat:chatHistory",
          messages: activeTab.messages,
        });
        // KSA-240: Restore LLM conversation context in engine
        try {
          const engine = this.getEngine();
          const chatMsgs = (activeTab.messages as any[])
            .filter((m: any) => m.role === "user" || m.role === "assistant")
            .slice(-20) // Keep last 20 for token budget
            .map((m: any) => ({
              id: m.id || require("crypto").randomUUID(),
              role: m.role,
              content: m.content,
              timestamp: m.timestamp || new Date().toISOString(),
            }));
          debugLog(` restoreChatState: restoring ${chatMsgs.length} messages to engine for tab ${state.activeTabId}`);
          engine.setChatHistory(chatMsgs, state.activeTabId);
        } catch (e) {
          debugError(` restoreChatState: engine restore failed:`, (e as Error));
        }
      }
    }
  }

  /** Send steering files and hooks info to webview */
  private sendSteeringInfo(): void {
    try {
      const fs = require("fs");
      const path = require("path");
      const steeringDir = path.join(this.workspaceRoot, ".kiro", "steering");
      const rules: Array<{ name: string; file: string }> = [];

      if (fs.existsSync(steeringDir)) {
        const files = this.getSteeringFilesRecursive(steeringDir, steeringDir);
        for (const file of files) {
          const name = path.basename(file, ".md").replace(/-/g, " ");
          rules.push({ name, file });
        }
      }

      if (rules.length > 0) {
        this.sendToWebview({ type: "chat:steeringLoaded", rules });
      }
    } catch {
      // Non-fatal
    }
  }

  private getSteeringFilesRecursive(dir: string, baseDir: string): string[] {
    const fs = require("fs");
    const path = require("path");
    const results: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...this.getSteeringFilesRecursive(fullPath, baseDir));
        } else if (entry.name.endsWith(".md")) {
          results.push(path.relative(baseDir, fullPath).replace(/\\/g, "/"));
        }
      }
    } catch { /* ignore */ }
    return results;
  }

  /** Lazy-init LangGraph engine (BR-11: zero activation impact) */
  private getEngine(): LangGraphEngine {
    if (!this.engine) {
      // Create LLM provider from VS Code settings + secrets
      const llmProvider = this.secrets ? createLlmProvider(this.secrets) : undefined;

      this.engine = new LangGraphEngine(
        this.mcpManager,
        this.workspaceRoot,
        (msg) => this.sendToWebview(msg),
        llmProvider
      );
    }
    return this.engine;
  }

  /** Lazy-init message handler */
  private getMessageHandler(): MessageHandler {
    if (!this.messageHandler) {
      this.messageHandler = new MessageHandler(
        () => this.getEngine(),
        (msg) => this.sendToWebview(msg),
        // Context picker handler
        (contextType) => this.handlePickContext(contextType),
        // Attachment picker handler
        () => this.handlePickAttachment(),
        // Apply code handler
        (code, _filePath) => this.handleApplyCode(code),
        // Insert code handler
        (code) => this.handleInsertCode(code),
        // Set model handler — persist selection to settings
        (model) => this.handleSetModel(model)
      );
    }
    return this.messageHandler;
  }

  /**
   * Persist the chat model selection. "auto" lets the pipeline/provider pick a
   * default, so it clears the explicit override.
   */
  private async handleSetModel(model: string): Promise<void> {
    const config = vscode.workspace.getConfiguration("kiroSdlc");
    const value = model === "auto" ? "" : model;
    try {
      await config.update("llmModel", value, vscode.ConfigurationTarget.Global);
    } catch {
      // Non-fatal — selection still applies for the session via MessageHandler.
    }
  }

  /** Handle context picker — show VS Code file/folder picker */
  private async handlePickContext(contextType: string): Promise<void> {
    let item: { type: string; label: string; path?: string } | undefined;

    switch (contextType) {
      case "file": {
        const uris = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          title: "Select File for Context",
        });
        if (uris && uris.length > 0) {
          const relativePath = vscode.workspace.asRelativePath(uris[0]);
          item = { type: "file", label: relativePath, path: uris[0].fsPath };
        }
        break;
      }
      case "folder": {
        const uris = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          title: "Select Folder for Context",
        });
        if (uris && uris.length > 0) {
          const relativePath = vscode.workspace.asRelativePath(uris[0]);
          item = { type: "folder", label: relativePath, path: uris[0].fsPath };
        }
        break;
      }
      case "problems": {
        const diagnostics = vscode.languages.getDiagnostics();
        const problemCount = diagnostics.reduce((sum, [, diags]) => sum + diags.length, 0);
        item = { type: "problems", label: `Problems (${problemCount})` };
        break;
      }
      case "gitDiff": {
        item = { type: "gitDiff", label: "Git Diff" };
        break;
      }
      case "terminal": {
        item = { type: "terminal", label: "Terminal" };
        break;
      }
    }

    if (item) {
      this.sendToWebview({ type: "chat:contextPicked", item: item as any });
    }
  }

  /** Handle attachment picker */
  private async handlePickAttachment(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: true,
      title: "Attach Files",
      filters: {
        "All Files": ["*"],
        "Images": ["png", "jpg", "jpeg", "gif", "svg", "webp"],
        "Documents": ["pdf", "docx", "md", "txt"],
      },
    });
    if (uris && uris.length > 0) {
      for (const uri of uris) {
        const relativePath = vscode.workspace.asRelativePath(uri);
        this.sendToWebview({
          type: "chat:contextPicked",
          item: { type: "file", label: relativePath, path: uri.fsPath },
        });
      }
    }
  }

  /** Handle apply code — insert into active editor replacing selection */
  private async handleApplyCode(code: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      await editor.edit((editBuilder) => {
        if (editor.selection.isEmpty) {
          editBuilder.insert(editor.selection.active, code);
        } else {
          editBuilder.replace(editor.selection, code);
        }
      });
    } else {
      vscode.window.showWarningMessage("No active editor to apply code to.");
    }
  }

  /** Handle insert code — insert at cursor in active editor */
  private async handleInsertCode(code: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      await editor.edit((editBuilder) => {
        editBuilder.insert(editor.selection.active, code);
      });
    } else {
      const doc = await vscode.workspace.openTextDocument({ content: code });
      await vscode.window.showTextDocument(doc);
    }
  }

  private async handleMessage(msg: ChatWebviewToExtMessage): Promise<void> {
    try {
      await this.getMessageHandler().handle(msg);
    } catch (error) {
      this.sendToWebview({
        type: "chat:error",
        code: "HANDLER_ERROR",
        message: (error as Error).message,
        retryable: true,
      });
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const cspSource = webview.cspSource;

    // Resolve webview asset URIs
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "webview-assets", "chat", "chat.css")
    );
    const chatJsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "webview-assets", "chat", "chat.js")
    );
    const mdRendererUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "webview-assets", "chat", "markdown-renderer.js")
    );
    const graphVizUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "webview-assets", "chat", "graph-viz.js")
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} data:; font-src ${cspSource}; connect-src 'none';">
    <link rel="stylesheet" href="${cssUri}">
    <title>Chat Panel</title>
</head>
<body>
    <div id="chat-root">
        <div id="chat-header">
            <div class="header-left">
                <div class="context-usage-icon" id="context-usage-icon" aria-label="Context window usage">
                    <svg viewBox="0 0 20 20">
                        <circle class="arc-bg" cx="10" cy="10" r="8" />
                        <circle class="arc-progress safe" cx="10" cy="10" r="8"
                            stroke-dasharray="50.27"
                            stroke-dashoffset="50.27"
                            transform="rotate(-90 10 10)" />
                    </svg>
                    <span class="context-usage-tooltip" id="context-tooltip">0 / 128,000 tokens (0%)</span>
                </div>
                <span class="header-title">SDLC Pipeline</span>
            </div>
            <span id="status-indicator" class="status disconnected">disconnected</span>
        </div>

        <!-- Tab Bar (KSA-240) -->
        <div id="tab-bar" role="tablist" aria-label="Conversation tabs">
            <button class="tab-add-btn" id="tab-add-btn" title="New conversation (Ctrl+Shift+T)" aria-label="New tab">+</button>
        </div>

        <!-- Steering Rules (KSA-240) -->
        <div class="steering-section" id="steering-section">
            <div class="steering-header" id="steering-header">
                <span class="steering-chevron">&#x25B6;</span>
                <span>Included Rules</span>
                <span id="steering-count">(0)</span>
            </div>
            <div class="steering-list" id="steering-list"></div>
        </div>

        <!-- Context full warning -->
        <div class="context-full-warning" id="context-full-warning">
            <span>Context window is full.</span>
            <span class="new-tab-link" id="full-new-tab">Start new tab</span>
        </div>

        <!-- Context notification toast -->
        <div class="context-toast" id="context-toast">
            <span id="toast-text">Context usage at 95%</span>
            <button class="toast-dismiss" id="toast-dismiss">&times;</button>
        </div>

        <!-- Working status bar (Kiro-style) -->
        <div id="working-bar">
            <span class="working-label"><span id="working-text">Working...</span></span>
            <div class="working-actions">
                <button id="cancel-btn" title="Cancel">Cancel</button>
                <button id="follow-btn" title="Follow output">Follow &#x1F441;</button>
            </div>
        </div>

        <!-- Welcome / Empty State -->
        <div id="welcome-state">
            <h3>SDLC Pipeline Agent</h3>
            <p>Ask a question or describe a task. Use ticket keys to trigger the full pipeline.</p>
            <div class="welcome-suggestions">
                <button data-cmd="KSA-XXX tao BRD">&#x1F4CB; Create BRD from ticket</button>
                <button data-cmd="KSA-XXX tao FSD">&#x1F4D0; Create FSD from ticket</button>
                <button data-cmd="KSA-XXX tao tai lieu day du">&#x1F4DA; Full pipeline (BRD→FSD→TDD)</button>
                <button data-cmd="status">&#x1F4CA; Show pipeline status</button>
                <button data-cmd="resume">&#x25B6; Resume paused pipeline</button>
                <button data-action="openWorkflowGraph">&#x1F5FA; Open Workflow Graph</button>
            </div>
        </div>

        <!-- Chat messages -->
        <div id="chat-messages" class="hidden"></div>

        <!-- Input Area (Kiro-style) -->
        <div id="chat-input-area">
            <div id="input-context-chips"></div>
            <div class="input-wrapper">
                <textarea id="chat-input" placeholder="Ask a question or describe a task..." rows="1"></textarea>
                <div id="input-attachments"></div>
                <div class="input-toolbar">
                    <div class="input-toolbar-left">
                        <button class="toolbar-btn" id="ctx-btn" title="Add context (#)">#</button>
                        <button class="toolbar-btn" id="attach-btn" title="Attach file">&#x1F4CE;</button>
                        <button class="toolbar-btn" id="stop-btn" title="Stop" style="display:none;">&#x23F9;</button>
                    </div>
                    <div class="input-toolbar-right">
                        <button class="model-selector" id="model-btn">
                            <span id="model-label">Auto</span>
                            <span class="model-chevron">&#x25BC;</span>
                        </button>
                        <div class="autopilot-toggle on" id="autopilot-toggle">
                            <span class="toggle-label">Autopilot</span>
                            <div class="toggle-track"><div class="toggle-thumb"></div></div>
                        </div>
                        <button id="send-btn" title="Send">&#x2191;</button>
                    </div>
                    <!-- Dropdowns -->
                    <div class="model-dropdown hidden" id="model-dropdown">
                        <button data-model="auto" class="active">Auto</button>
                    </div>
                    <div class="context-menu hidden" id="context-menu">
                        <button data-ctx="file"><span class="ctx-icon">&#x1F4C4;</span> File</button>
                        <button data-ctx="folder"><span class="ctx-icon">&#x1F4C1;</span> Folder</button>
                        <button data-ctx="problems"><span class="ctx-icon">&#x26A0;</span> Problems</button>
                        <button data-ctx="gitDiff"><span class="ctx-icon">&#x1F500;</span> Git Diff</button>
                        <button data-ctx="terminal"><span class="ctx-icon">&#x1F4BB;</span> Terminal</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <script nonce="${nonce}" src="${mdRendererUri}"></script>
    <script nonce="${nonce}" src="${graphVizUri}"></script>
    <script nonce="${nonce}" src="${chatJsUri}"></script>
</body>
</html>`;
  }

  /**
   * Send context usage update to webview for a given tab.
   * Call this after engine responses, tool calls, or steering loads.
   */
  sendContextUsage(tabId: string): void {
    const payload = this.contextUsageTracker.getUsagePayload(tabId);
    this.sendToWebview({ type: "chat:contextUsage", payload });
  }

  /** Get the context usage tracker instance (for MessageHandler integration). */
  getContextUsageTracker(): ContextUsageTracker {
    return this.contextUsageTracker;
  }

  dispose(): void {
    this.engine?.dispose();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}

