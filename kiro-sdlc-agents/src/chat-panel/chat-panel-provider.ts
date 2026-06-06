/**
 * ChatPanelProvider — KSA-210
 * WebviewViewProvider for the Chat Panel sidebar.
 * Renders chat UI, connects to LangGraph engine, handles postMessage.
 */

import * as vscode from "vscode";
import { getNonce } from "../mcp-server-manager";
import { McpServerManager } from "../mcp-server-manager";
import { LangGraphEngine } from "../langgraph/langgraph-engine";
import { createLlmProvider } from "../langgraph/providers";
import { MessageHandler } from "./message-handler";
import { ChatWebviewToExtMessage, ChatExtToWebviewMessage } from "./message-protocol";
import { getStaticModels, getDefaultModel, fetchGatewayModels } from "./chat-models";

export class ChatPanelProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = "kiroChatPanel";

  private view: vscode.WebviewView | undefined;
  private engine: LangGraphEngine | null = null;
  private messageHandler: MessageHandler | null = null;
  private messageBuffer: ChatExtToWebviewMessage[] = [];
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly mcpManager: McpServerManager,
    private readonly workspaceRoot: string,
    private readonly secrets?: vscode.SecretStorage
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
        // On ready, send initial MCP server status
        if (msg.type === "ready") {
          const currentStatus = this.mcpManager.status;
          const webviewStatus = currentStatus === "running" ? "connected"
            : currentStatus === "crashed" ? "failed"
            : "disconnected";
          this.sendToWebview({ type: "serverStatus", status: webviewStatus });
          // Send the provider-aware model list to populate the dropdown
          void this.sendModels();
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
      const port = this.mcpManager.port;
      const gatewayModels = port ? await fetchGatewayModels(port) : null;
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
    if (this.view?.visible) {
      this.view.webview.postMessage(msg);
    } else {
      this.messageBuffer.push(msg);
      // Cap buffer at 100 messages
      if (this.messageBuffer.length > 100) {
        this.messageBuffer.shift();
      }
    }
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
            <span class="header-title">SDLC Pipeline</span>
            <span id="status-indicator" class="status disconnected">disconnected</span>
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
                <button data-cmd="status">&#x1F4CA; Show pipeline status</button>
                <button data-cmd="resume">&#x25B6; Resume paused pipeline</button>
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

  dispose(): void {
    this.engine?.dispose();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
