/**
 * Kiro SDLC Agents — VS Code Extension entry point.
 * Registers commands for injecting agents into workspaces.
 */

import * as vscode from "vscode";
import { injectAll, injectSelective, safeUpdate, checkStatus, getVersionReport } from "./injector";
import { isUpgradeAvailable, loadBundledManifest, migrateLegacyVersion } from "./checksum";
import { runIndexer } from "./indexer";

export function activate(context: vscode.ExtensionContext) {
    const statusBar = createStatusBar();
    context.subscriptions.push(statusBar);

    context.subscriptions.push(
        vscode.commands.registerCommand("kiroSdlc.injectAll", () => handleInjectAll(context)),
        vscode.commands.registerCommand("kiroSdlc.injectSelective", () => handleInjectSelective(context)),
        vscode.commands.registerCommand("kiroSdlc.runIndex", () => handleRunIndex()),
        vscode.commands.registerCommand("kiroSdlc.update", () => handleUpdate(context)),
        vscode.commands.registerCommand("kiroSdlc.status", () => handleStatus(context))
    );

    updateStatusBar(statusBar, context);
    checkForUpgrade(context);
}

export function deactivate() {}

async function checkForUpgrade(context: vscode.ExtensionContext) {
    const root = getWorkspaceRoot();
    if (!root) { return; }
    migrateLegacyVersion(root, context.extensionPath);
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
        "Inject all SDLC agents, steering, hooks, templates, and indexer into this workspace?",
        "Yes", "Cancel"
    );
    if (confirm !== "Yes") { return; }

    const injected = await injectAll(root, context.extensionPath);
    vscode.window.showInformationMessage(`✅ Injected ${injected.length} components: ${injected.join(", ")}`);

    const autoIndex = vscode.workspace.getConfiguration("kiroSdlc").get<boolean>("autoIndex", true);
    if (autoIndex && injected.some(id => id.startsWith("indexer"))) {
        await runIndexer(root);
    }
}

async function handleInjectSelective(context: vscode.ExtensionContext) {
    const root = getWorkspaceRoot();
    if (!root) { return; }

    const injected = await injectSelective(root, context.extensionPath);
    if (injected.length > 0) {
        vscode.window.showInformationMessage(`✅ Injected: ${injected.join(", ")}`);
    }
}

async function handleRunIndex() {
    const root = getWorkspaceRoot();
    if (!root) { return; }
    await runIndexer(root);
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
    item.text = allPresent ? "$(check) SDLC Agents" : "$(warning) SDLC Agents";
    item.tooltip = allPresent ? "All SDLC components active" : "Some components missing — click to check";
}
