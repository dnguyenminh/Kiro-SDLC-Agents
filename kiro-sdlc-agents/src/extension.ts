/**
 * Kiro SDLC Agents — VS Code Extension entry point.
 * Registers commands for injecting agents, managing MCP server, and KB panels.
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
    injectAll, injectSelective, safeUpdate, checkStatus,
    getVersionReport, migrateLegacyScripts
} from "./injector";
import { isUpgradeAvailable, loadBundledManifest, migrateLegacyVersion } from "./checksum";
import { promptIndexAfterInject, handleIndexWorkspace } from "./indexer";
import { handleDownloadModel } from "./model-downloader";
import { McpServerManager } from "./mcp-server-manager";
import { WebviewPanelManager } from "./webview-panel-manager";
import { KiroTreeViewProvider } from "./sidebar/tree-view-provider";
import { writeBundledMcpConfig, removeBundledMcpConfig } from "./mcp-injector";
import { ConfigWatcher } from "./config-watcher";

let mcpManager: McpServerManager | undefined;
let panelManager: WebviewPanelManager | undefined;
let configWatcher: ConfigWatcher | undefined;

export function activate(context: vscode.ExtensionContext) {
    const statusBar = createStatusBar();
    context.subscriptions.push(statusBar);

    // Initialize MCP server manager
    const workspaceRoot = getWorkspaceRoot();
    if (workspaceRoot) {
        const outputChannel = vscode.window.createOutputChannel("Kiro MCP Server");
        context.subscriptions.push(outputChannel);

        mcpManager = new McpServerManager(context.extensionPath, workspaceRoot, outputChannel);
        context.subscriptions.push(mcpManager);

        panelManager = new WebviewPanelManager(mcpManager, context.extensionUri);
        context.subscriptions.push(panelManager);

        // Register tree view (use createTreeView for badge support)
        const treeProvider = new KiroTreeViewProvider(mcpManager);
        const treeView = vscode.window.createTreeView("kiroSdlcTree", { treeDataProvider: treeProvider });
        treeProvider.setTreeView(treeView);
        context.subscriptions.push(treeView);

        // Initialize config watcher for mcp.json changes
        configWatcher = new ConfigWatcher(workspaceRoot, mcpManager, outputChannel);
        context.subscriptions.push(configWatcher);

        // Broadcast server status to all panels
        mcpManager.onStatusChange((status) => {
            const webviewStatus = status === "running" ? "connected" : status === "crashed" ? "failed" : "disconnected";
            panelManager?.notifyAllPanels({ type: "serverStatus", status: webviewStatus });
            updateStatusBar(statusBar, context);

            // Write mcp.json with HTTP URL once server reports its port
            if (status === "running" && mcpManager?.port) {
                configWatcher?.suppressNextChange();
                writeBundledMcpConfig(workspaceRoot!, mcpManager.port);
            }
        });

        // Auto-spawn server on activation (if enabled in settings)
        const config = vscode.workspace.getConfiguration("kiroSdlc");
        const serverEnabled = config.get<boolean>("enableMcpServer", true);
        if (serverEnabled) {
            mcpManager.spawn().catch((err) => {
                outputChannel.appendLine(`[WARN] Auto-spawn failed: ${(err as Error).message}`);
            });
        } else {
            outputChannel.appendLine("[MCP] Server disabled by setting kiroSdlc.enableMcpServer");
        }
    }

    // Register existing commands
    context.subscriptions.push(
        vscode.commands.registerCommand("kiroSdlc.injectAll", () => handleInjectAll(context)),
        vscode.commands.registerCommand("kiroSdlc.injectSelective", () => handleInjectSelective(context)),
        vscode.commands.registerCommand("kiroSdlc.update", () => handleUpdate(context)),
        vscode.commands.registerCommand("kiroSdlc.status", () => handleStatus(context)),
        vscode.commands.registerCommand("kiroSdlc.indexWorkspace", () => handleIndexWorkspace()),
        vscode.commands.registerCommand("kiroSdlc.downloadModel", () => handleDownloadModel()),
    );

    // Register KB panel commands
    context.subscriptions.push(
        vscode.commands.registerCommand("kiroSdlc.openKbGraph", () => panelManager?.openPanel("graph")),
        vscode.commands.registerCommand("kiroSdlc.openKbDashboard", () => panelManager?.openPanel("dashboard")),
        vscode.commands.registerCommand("kiroSdlc.openKbTags", () => panelManager?.openPanel("tags")),
        vscode.commands.registerCommand("kiroSdlc.openKbQuality", () => panelManager?.openPanel("quality")),
        vscode.commands.registerCommand("kiroSdlc.openKbAnalytics", () => panelManager?.openPanel("analytics")),
    );

    // Register MCP server commands
    context.subscriptions.push(
        vscode.commands.registerCommand("kiroSdlc.restartMcpServer", () => handleRestartServer()),
        vscode.commands.registerCommand("kiroSdlc.stopMcpServer", () => handleStopServer()),
        vscode.commands.registerCommand("kiroSdlc.openKbBrowser", () => handleOpenKbBrowser()),
        vscode.commands.registerCommand("kiroSdlc.changePort", () => handleChangePort()),
        vscode.commands.registerCommand("kiroSdlc.editConfig", () => handleEditConfig()),
        vscode.commands.registerCommand("kiroSdlc.changeConfig", () => handleChangeConfig()),
    );

    updateStatusBar(statusBar, context);
    checkForUpgrade(context);
}

export function deactivate() {
    configWatcher?.dispose();
    mcpManager?.kill().catch(() => {});
    panelManager?.disposeAll();
}

async function handleOpenKbBrowser(): Promise<void> {
    if (!mcpManager || mcpManager.status !== "running" || !mcpManager.port) {
        vscode.window.showErrorMessage("MCP server not running. Start it first.");
        return;
    }
    const url = `http://localhost:${mcpManager.port}/`;
    await vscode.env.openExternal(vscode.Uri.parse(url));
}

async function handleRestartServer(): Promise<void> {
    if (!mcpManager) {
        vscode.window.showErrorMessage("No workspace open — cannot manage MCP server.");
        return;
    }
    try {
        await mcpManager.restart();
        vscode.window.showInformationMessage("MCP server restarted.");
    } catch (err) {
        vscode.window.showErrorMessage(`Restart failed: ${(err as Error).message}`);
    }
}

async function handleStopServer(): Promise<void> {
    if (!mcpManager) {
        vscode.window.showErrorMessage("No workspace open — cannot manage MCP server.");
        return;
    }
    try {
        configWatcher?.suppressNextChange();
        await mcpManager.kill();
        // Remove code-intelligence entry from mcp.json so Kiro IDE doesn't try to reconnect
        const workspaceRoot = getWorkspaceRoot();
        if (workspaceRoot) {
            configWatcher?.suppressNextChange();
            removeBundledMcpConfig(workspaceRoot);
        }
        vscode.window.showInformationMessage("MCP server stopped.");
    } catch (err) {
        vscode.window.showErrorMessage(`Stop failed: ${(err as Error).message}`);
    }
}

async function handleChangePort(): Promise<void> {
    const config = vscode.workspace.getConfiguration("kiroSdlc");
    const currentPort = config.get<number>("mcpServerPort", 9180);
    const input = await vscode.window.showInputBox({
        prompt: "Enter MCP server port",
        value: String(currentPort),
        validateInput: (v) => {
            const n = parseInt(v, 10);
            if (isNaN(n) || n < 1 || n > 65535) { return "Port must be 1-65535"; }
            return null;
        },
    });
    if (!input) { return; }
    const newPort = parseInt(input, 10);
    if (newPort === currentPort) { return; }
    await config.update("mcpServerPort", newPort, vscode.ConfigurationTarget.Workspace);
    vscode.window.showInformationMessage(`Port changed to ${newPort}. Restarting server...`);
    await handleRestartServer();
}

async function handleEditConfig(): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) { vscode.window.showErrorMessage("No workspace open."); return; }
    const config = vscode.workspace.getConfiguration("kiroSdlc");
    const relPath = config.get<string>("configPath", ".code-intel/orchestration.json");
    const fullPath = path.join(root, relPath);
    if (!fs.existsSync(fullPath)) {
        const create = await vscode.window.showWarningMessage(
            `Config file not found: ${relPath}. Create it?`, "Create", "Cancel"
        );
        if (create !== "Create") { return; }
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
        fs.writeFileSync(fullPath, JSON.stringify({ servers: [], routing: {} }, null, 2));
    }
    const doc = await vscode.workspace.openTextDocument(fullPath);
    await vscode.window.showTextDocument(doc);
}

async function handleChangeConfig(): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) { vscode.window.showErrorMessage("No workspace open."); return; }
    const config = vscode.workspace.getConfiguration("kiroSdlc");
    const currentRelPath = config.get<string>("configPath", ".code-intel/orchestration.json");
    const currentFullPath = path.join(root, currentRelPath);
    const defaultUri = fs.existsSync(path.dirname(currentFullPath))
        ? vscode.Uri.file(path.dirname(currentFullPath))
        : vscode.Uri.file(root);
    const result = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        defaultUri,
        filters: { "JSON files": ["json"] },
        title: "Select Orchestration Config File",
    });
    if (!result || result.length === 0) { return; }
    const selected = result[0].fsPath;
    const relPath = path.relative(root, selected).replace(/\\/g, "/");
    await config.update("configPath", relPath, vscode.ConfigurationTarget.Workspace);
    vscode.window.showInformationMessage(`Config changed to: ${relPath}. Restarting server...`);
    await handleRestartServer();
}

async function checkForUpgrade(context: vscode.ExtensionContext) {
    const root = getWorkspaceRoot();
    if (!root) { return; }
    migrateLegacyVersion(root, context.extensionPath);

    const migration = migrateLegacyScripts(root);
    if (migration.removed) {
        vscode.window.showInformationMessage(
            "🧹 Legacy indexer scripts removed. Use MCP server config instead (Kiro SDLC: Inject All)."
        );
    }

    if (!isUpgradeAvailable(root, context.extensionPath)) { return; }

    const manifest = loadBundledManifest(context.extensionPath);
    const newVer = manifest?.version || "unknown";

    const action = await vscode.window.showInformationMessage(
        `🆕 SDLC Agents update available → v${newVer}`,
        "Update Now", "Show Details", "Later"
    );
    if (action === "Update Now") {
        vscode.commands.executeCommand("kiroSdlc.update");
    } else if (action === "Show Details") {
        const channel = vscode.window.createOutputChannel("SDLC Version Report");
        channel.show();
        channel.appendLine(getVersionReport(root, context.extensionPath));
    }
}

async function handleInjectAll(context: vscode.ExtensionContext) {
    const root = getWorkspaceRoot();
    if (!root) { return; }

    const confirm = await vscode.window.showInformationMessage(
        "Inject all SDLC agents, steering, hooks, templates, and MCP config into this workspace?",
        "Yes", "Cancel"
    );
    if (confirm !== "Yes") { return; }

    const injected = await injectAll(root, context.extensionPath);
    vscode.window.showInformationMessage(`✅ Injected ${injected.length} components: ${injected.join(", ")}`);
    await promptIndexAfterInject(root);
}

async function handleInjectSelective(context: vscode.ExtensionContext) {
    const root = getWorkspaceRoot();
    if (!root) { return; }

    const injected = await injectSelective(root, context.extensionPath);
    if (injected.length > 0) {
        vscode.window.showInformationMessage(`✅ Injected: ${injected.join(", ")}`);
        await promptIndexAfterInject(root);
    }
}

async function handleUpdate(context: vscode.ExtensionContext) {
    const root = getWorkspaceRoot();
    if (!root) { return; }

    const injected = await safeUpdate(root, context.extensionPath);
    if (injected.length > 0) {
        vscode.window.showInformationMessage(`✅ Updated ${injected.length} components`);
    }
}

async function handleStatus(context: vscode.ExtensionContext) {
    const root = getWorkspaceRoot();
    if (!root) { return; }

    const status = checkStatus(root);
    const report = getVersionReport(root, context.extensionPath);
    const lines = Object.entries(status).map(([id, exists]) =>
        `${exists ? "✅" : "❌"} ${id}`
    );

    const action = await vscode.window.showInformationMessage(
        `SDLC Status:\n${lines.join("\n")}`,
        "Show File Versions", "Inject Missing", "Close"
    );
    if (action === "Show File Versions") {
        const channel = vscode.window.createOutputChannel("SDLC File Versions");
        channel.show();
        channel.appendLine(report);
    } else if (action === "Inject Missing") {
        vscode.commands.executeCommand("kiroSdlc.injectSelective");
    }
}

function getWorkspaceRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        vscode.window.showErrorMessage("No workspace folder open.");
        return undefined;
    }
    return folders[0].uri.fsPath;
}

function createStatusBar(): vscode.StatusBarItem {
    const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    item.command = "kiroSdlc.status";
    item.show();
    return item;
}

function updateStatusBar(item: vscode.StatusBarItem, context: vscode.ExtensionContext) {
    const root = getWorkspaceRoot();
    if (!root) {
        item.text = "$(circle-slash) SDLC";
        item.tooltip = "No workspace open";
        return;
    }
    const status = checkStatus(root);
    const allPresent = Object.values(status).every(v => v);
    const serverIcon = mcpManager?.status === "running" ? "$(check)" : "$(warning)";
    item.text = allPresent ? `${serverIcon} SDLC Agents` : `$(warning) SDLC Agents`;
    const portInfo = mcpManager?.port ? ` | Port: ${mcpManager.port}` : "";
    item.tooltip = allPresent
        ? `All SDLC components active | MCP: ${mcpManager?.status || "N/A"}${portInfo}`
        : "Some components missing — click to check";
}
