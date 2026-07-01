/**
 * ChatPanelProvider — KSA-210
 * WebviewViewProvider for the Chat Panel sidebar.
 * Renders chat UI, connects to LangGraph engine, handles postMessage.
 */

import * as vscode from "vscode";
import * as path from "path";
import { getNonce } from "../mcp-server-manager";
import { debugLog, debugError } from "../debug-logger";
import { McpServerManager } from "../mcp-server-manager";
import { LangGraphEngine } from "../langgraph/langgraph-engine";
import { createLlmProvider } from "../langgraph/providers";
import { MessageHandler } from "./message-handler";
import { ChatWebviewToExtMessage, ChatExtToWebviewMessage } from "./message-protocol";
import { getStaticModels, getDefaultModel, fetchGatewayModels } from "./chat-models";
import { ContextUsageTracker } from "./context-usage-tracker";
import { mapServerStatusToWebview } from "../types";

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
          const webviewStatus = mapServerStatusToWebview(currentStatus);
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
      const webviewStatus = mapServerStatusToWebview(status);
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
      // Restore LLM conversation context in engine for active tab
      // (Webview handles rendering via switchToTab in handleTabsUpdated)
      const activeTab = (state.tabs as any[]).find((t: any) => t.id === state.activeTabId);
      if (activeTab && activeTab.messages && activeTab.messages.length > 0) {
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

  /** Send steering files and hooks info to webview.
   * KSA-279: Only sends rules with inclusion "always" or "auto" (not "manual" or "fileMatch")
   * to reduce noise — webview only shows actively-loaded rules.
   */
  private sendSteeringInfo(): void {
    try {
      const fs = require("fs");
      const path = require("path");
      const steeringDir = path.join(this.workspaceRoot, ".kiro", "steering");
      const rules: Array<{ name: string; file: string }> = [];
      const autoInjectInclusions = new Set(["always", "auto"]);

      if (fs.existsSync(steeringDir)) {
        const files = this.getSteeringFilesRecursive(steeringDir, steeringDir);
        for (const file of files) {
          // Read file and check front-matter inclusion field
          const fullPath = path.join(steeringDir, file);
          let shouldInclude = false; // KSA-279: no front-matter = manual (NOT auto-loaded)
          try {
            const content: string = fs.readFileSync(fullPath, "utf-8");
            const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
            if (fmMatch) {
              const fm = fmMatch[1];
              const inclusionMatch = fm.match(/^inclusion\s*:\s*["']?(\w+)["']?\s*$/m);
              if (inclusionMatch) {
                const inclusion = inclusionMatch[1].toLowerCase();
                shouldInclude = autoInjectInclusions.has(inclusion);
              }
              // front-matter present but no inclusion field -> default manual (exclude)
            }
          } catch (err) {
            debugError(`[ChatPanel] Failed to read steering file ${file}`, err as Error);
          }

          if (shouldInclude) {
            const name = path.basename(file, ".md").replace(/-/g, " ");
            rules.push({ name, file });
          }
        }
      }

      if (rules.length > 0) {
        this.sendToWebview({ type: "chat:steeringLoaded", rules });
      }
    } catch (err) {
      debugError("[ChatPanel] sendSteeringInfo failed", err as Error);
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
    try {
      if (model === "auto") {
        await config.update("llmModel", undefined, vscode.ConfigurationTarget.Global);
      } else {
        await config.update("llmModel", model, vscode.ConfigurationTarget.Global);
      }
    } catch {
      // Non-fatal — selection still applies for the session via MessageHandler.
    }
  }

  /** Handle context picker — show VS Code file/folder picker */
  private async handlePickContext(contextType: string): Promise<void> {
    let item: { type: string; label: string; path?: string; content?: string } | undefined;

    switch (contextType) {
      case "file": {
        // Show workspace file picker (like Kiro native) — QuickPick with fuzzy search
        const workspaceFiles = await vscode.workspace.findFiles(
          "**/*",
          "{**/node_modules/**,**/.git/**,**/out/**,**/dist/**}",
          500
        );
        if (workspaceFiles.length === 0) break;
        const fileItems = workspaceFiles.map(f => ({
          label: path.basename(f.fsPath),
          description: vscode.workspace.asRelativePath(f),
          uri: f,
        })).sort((a, b) => a.label.localeCompare(b.label));

        const picked = await vscode.window.showQuickPick(fileItems, {
          title: "Select File",
          placeHolder: "Type to search (supports line ranges: file.ts:42 or file.ts:42-64)",
          matchOnDescription: true,
        });
        if (picked) {
          const relativePath = vscode.workspace.asRelativePath(picked.uri);
          const doc = await vscode.workspace.openTextDocument(picked.uri);
          const content = doc.getText().slice(0, 50000);
          item = { type: "file", label: relativePath, path: picked.uri.fsPath, content };
        }
        break;
      }
      case "folder": {
        // Show workspace folder picker (QuickPick)
        const allFiles = await vscode.workspace.findFiles(
          "**/*",
          "{**/node_modules/**,**/.git/**,**/out/**,**/dist/**}",
          1000
        );
        // Extract unique folder paths
        const folderSet = new Set<string>();
        for (const f of allFiles) {
          const rel = vscode.workspace.asRelativePath(f);
          const dir = path.dirname(rel);
          if (dir && dir !== ".") {
            folderSet.add(dir);
            // Also add parent folders
            const parts = dir.split(/[/\\]/);
            for (let i = 1; i < parts.length; i++) {
              folderSet.add(parts.slice(0, i).join("/"));
            }
          }
        }
        const folderItems = Array.from(folderSet).sort().map(f => ({
          label: path.basename(f),
          description: f,
          folderPath: f,
        }));

        const pickedFolder = await vscode.window.showQuickPick(folderItems, {
          title: "Select Folder",
          placeHolder: "Type to search folders...",
          matchOnDescription: true,
        });
        if (pickedFolder) {
          const folderUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, pickedFolder.folderPath);
          const filesInFolder = await vscode.workspace.findFiles(
            new vscode.RelativePattern(folderUri, "**/*"),
            "**/node_modules/**",
            100
          );
          const listing = filesInFolder.map(f => vscode.workspace.asRelativePath(f)).sort().join("\n");
          item = { type: "folder", label: pickedFolder.folderPath, path: folderUri.fsPath, content: listing };
        }
        break;
      }
      case "problems": {
        const diagnostics = vscode.languages.getDiagnostics();
        const lines: string[] = [];
        let totalCount = 0;
        for (const [uri, diags] of diagnostics) {
          if (diags.length === 0) continue;
          const relPath = vscode.workspace.asRelativePath(uri);
          for (const d of diags) {
            const severity = d.severity === vscode.DiagnosticSeverity.Error ? "ERROR"
              : d.severity === vscode.DiagnosticSeverity.Warning ? "WARN"
              : d.severity === vscode.DiagnosticSeverity.Information ? "INFO" : "HINT";
            lines.push(`[${severity}] ${relPath}:${d.range.start.line + 1}: ${d.message}`);
            totalCount++;
          }
        }
        const content = lines.length > 0 ? lines.join("\n") : "No problems found.";
        item = { type: "problems", label: `Problems (${totalCount})`, content };
        break;
      }
      case "gitDiff": {
        try {
          const gitExt = vscode.extensions.getExtension("vscode.git");
          let diffContent = "";
          if (gitExt) {
            const git = gitExt.exports.getAPI(1);
            if (git && git.repositories.length > 0) {
              const repo = git.repositories[0];
              diffContent = await repo.diff(true) || await repo.diff() || "";
            }
          }
          if (!diffContent) {
            // Fallback: use terminal command
            const cp = require("child_process");
            diffContent = cp.execSync("git diff --stat && echo --- && git diff", {
              cwd: this.workspaceRoot,
              encoding: "utf-8",
              timeout: 10000,
            }).toString().slice(0, 50000);
          }
          item = { type: "gitDiff", label: "Git Diff", content: diffContent || "No changes detected." };
        } catch (e) {
          item = { type: "gitDiff", label: "Git Diff", content: `Error getting git diff: ${(e as Error).message}` };
        }
        break;
      }
      case "terminal": {
        // Read recent terminal output from active terminal
        let terminalContent = "";
        const activeTerminal = vscode.window.activeTerminal;
        if (activeTerminal) {
          // VS Code doesn't expose terminal buffer directly.
          // Use shell integration or clipboard workaround.
          try {
            await vscode.commands.executeCommand("workbench.action.terminal.selectAll");
            await vscode.commands.executeCommand("workbench.action.terminal.copySelection");
            const clipboard = await vscode.env.clipboard.readText();
            terminalContent = clipboard.slice(-20000); // Last 20KB
            await vscode.commands.executeCommand("workbench.action.terminal.clearSelection");
          } catch {
            terminalContent = `Terminal "${activeTerminal.name}" is active but content could not be read. VS Code API does not expose terminal buffer directly.`;
          }
        } else {
          terminalContent = "No active terminal.";
        }
        item = { type: "terminal", label: "Terminal", content: terminalContent };
        break;
      }
      case "spec": {
        const specFiles = await vscode.workspace.findFiles(".kiro/specs/**/*.md");
        if (specFiles.length === 0) break;
        const specItems = specFiles.map(f => ({
          label: vscode.workspace.asRelativePath(f),
          uri: f
        }));
        const pickedSpec = await vscode.window.showQuickPick(specItems, { title: "Select Spec" });
        if (pickedSpec) {
          const doc = await vscode.workspace.openTextDocument(pickedSpec.uri);
          const content = doc.getText().slice(0, 50000);
          item = { type: "spec", label: path.basename(pickedSpec.label), path: pickedSpec.uri.fsPath, content };
        }
        break;
      }
      case "currentFile": {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
          const content = editor.document.getText().slice(0, 50000);
          item = { type: "currentFile", label: relativePath, path: editor.document.uri.fsPath, content };
        }
        break;
      }
      case "steering": {
        const steeringFiles = await vscode.workspace.findFiles(".kiro/steering/**/*.md");
        if (steeringFiles.length === 0) break;
        const steeringItems = steeringFiles.map(f => ({
          label: path.basename(f.fsPath, ".md"),
          description: vscode.workspace.asRelativePath(f),
          uri: f
        }));
        const pickedSteering = await vscode.window.showQuickPick(steeringItems, { title: "Select Steering Rule" });
        if (pickedSteering) {
          const doc = await vscode.workspace.openTextDocument(pickedSteering.uri);
          const content = doc.getText().slice(0, 50000);
          item = { type: "steering", label: pickedSteering.label, path: pickedSteering.uri.fsPath, content };
        }
        break;
      }
      case "mcp": {
        // Show MCP servers → tools as tree QuickPick
        try {
          const fs = require("fs");
          const http = require("http");
          const mcpConfigPath = path.join(this.workspaceRoot, ".kiro", "settings", "mcp.json");
          if (!fs.existsSync(mcpConfigPath)) {
            vscode.window.showWarningMessage("No MCP configuration found at .kiro/settings/mcp.json");
            break;
          }
          const config = JSON.parse(fs.readFileSync(mcpConfigPath, "utf-8"));
          const servers = config.mcpServers || {};
          const serverNames = Object.keys(servers).filter(k => !servers[k].disabled);

          if (serverNames.length === 0) {
            vscode.window.showWarningMessage("No active MCP servers found.");
            break;
          }

          // Fetch tools from each server
          const quickPickItems: Array<{ label: string; description?: string; detail?: string; kind?: vscode.QuickPickItemKind; toolName?: string; serverName?: string }> = [];

          for (const serverName of serverNames) {
            const serverConf = servers[serverName];
            const url = serverConf.url;
            if (!url) continue;

            // Add server as separator
            quickPickItems.push({ label: serverName, kind: vscode.QuickPickItemKind.Separator });

            // Fetch tool list
            try {
              const tools = await new Promise<Array<{ name: string; description?: string }>>((resolve) => {
                const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
                const parsedUrl = new URL(url);
                const req = http.request({
                  hostname: parsedUrl.hostname,
                  port: parsedUrl.port,
                  path: parsedUrl.pathname,
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
                  timeout: 5000,
                }, (res: any) => {
                  let data = "";
                  res.on("data", (chunk: string) => data += chunk);
                  res.on("end", () => {
                    try {
                      const json = JSON.parse(data);
                      resolve(json.result?.tools || []);
                    } catch { resolve([]); }
                  });
                });
                req.on("error", () => resolve([]));
                req.on("timeout", () => { req.destroy(); resolve([]); });
                req.write(body);
                req.end();
              });

              for (const tool of tools.sort((a: any, b: any) => a.name.localeCompare(b.name))) {
                quickPickItems.push({
                  label: `  $(symbol-method) ${tool.name}`,
                  description: tool.description?.slice(0, 80) || "",
                  toolName: tool.name,
                  serverName,
                });
              }
            } catch {
              quickPickItems.push({ label: `  $(warning) Error loading tools`, description: serverName });
            }
          }

          const picked = await vscode.window.showQuickPick(quickPickItems, {
            title: "Select MCP Tool",
            placeHolder: "Choose a tool to include as context...",
            matchOnDescription: true,
          });

          if (picked && (picked as any).toolName) {
            const toolName = (picked as any).toolName;
            const sName = (picked as any).serverName;
            item = {
              type: "mcp",
              label: `${sName}/${toolName}`,
              content: `MCP Tool: ${toolName} (server: ${sName})\nUser wants to reference this MCP tool in the conversation.`,
            };
          }
        } catch (e) {
          vscode.window.showErrorMessage(`MCP error: ${(e as Error).message}`);
        }
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
                <div id="chat-input" contenteditable="true" role="textbox" aria-multiline="true" aria-placeholder="Ask a question or describe a task..."></div>
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
                        <button data-ctx="file"><span class="ctx-icon">&#x1F4C4;</span> Files</button>
                        <button data-ctx="spec"><span class="ctx-icon">&#x1F4CB;</span> Spec</button>
                        <button data-ctx="gitDiff"><span class="ctx-icon">&#x1F500;</span> Git Diff</button>
                        <button data-ctx="terminal"><span class="ctx-icon">&#x1F4BB;</span> Terminal</button>
                        <button data-ctx="problems"><span class="ctx-icon">&#x26A0;</span> Problems</button>
                        <button data-ctx="folder"><span class="ctx-icon">&#x1F4C1;</span> Folder</button>
                        <button data-ctx="currentFile"><span class="ctx-icon">&#x1F4DD;</span> Current File</button>
                        <button data-ctx="steering"><span class="ctx-icon">&#x1F9ED;</span> Steering</button>
                        <button data-ctx="mcp"><span class="ctx-icon">&#x1F50C;</span> MCP</button>
                    </div>
                    <!-- Slash Command Popup -->
                    <div class="slash-popup hidden" id="slash-popup" role="listbox" aria-label="Slash commands">
                        <div class="slash-section">
                            <div class="slash-section-title">Agents</div>
                            <button type="button" class="slash-item" data-slash="/qa-agent" role="option"><span class="slash-icon">&#x1F9EA;</span><span class="slash-label">qa-agent</span><span class="slash-desc">QA Engineer</span></button>
                            <button type="button" class="slash-item" data-slash="/sa-agent" role="option"><span class="slash-icon">&#x1F3D7;</span><span class="slash-label">sa-agent</span><span class="slash-desc">Solution Architect</span></button>
                            <button type="button" class="slash-item" data-slash="/sm-agent" role="option"><span class="slash-icon">&#x1F4CB;</span><span class="slash-label">sm-agent</span><span class="slash-desc">Scrum Master</span></button>
                            <button type="button" class="slash-item" data-slash="/ta-agent" role="option"><span class="slash-icon">&#x1F527;</span><span class="slash-label">ta-agent</span><span class="slash-desc">Technical Architect</span></button>
                            <button type="button" class="slash-item" data-slash="/ui-agent" role="option"><span class="slash-icon">&#x1F3A8;</span><span class="slash-label">ui-agent</span><span class="slash-desc">UI/UX Designer</span></button>
                            <button type="button" class="slash-item" data-slash="/security-agent" role="option"><span class="slash-icon">&#x1F6E1;</span><span class="slash-label">security-agent</span><span class="slash-desc">Security Expert</span></button>
                        </div>
                        <div class="slash-section">
                            <div class="slash-section-title">Steering Rules</div>
                            <div id="slash-steering-list"></div>
                        </div>
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

