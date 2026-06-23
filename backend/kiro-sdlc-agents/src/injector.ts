/**
 * Core injection logic — copies resources to target workspace.
 * Delegates MCP config injection to mcp-injector module.
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { Component, CORE_COMPONENTS } from "./config";
import {
    detectModifiedFiles, loadBundledManifest, buildManifestAfterInject,
    getFileStatuses, migrateLegacyVersion, FileStatus
} from "./checksum";
import { copyDirRecursive, copyDirFiltered, copySelectedItems } from "./file-utils";
import { injectMcpConfig, migrateLegacyScripts, hasMcpConfig } from "./mcp-injector";

export { migrateLegacyScripts, injectMcpConfig } from "./mcp-injector";

export async function injectAll(root: string, extensionPath: string): Promise<string[]> {
    migrateLegacyVersion(root, extensionPath);
    const injected: string[] = [];

    for (const component of CORE_COMPONENTS) {
        if (injectComponent(component, root, extensionPath)) {
            injected.push(component.id);
        }
    }

    const variantId = await injectMcpConfig(root);
    if (variantId) { injected.push(`mcp-${variantId}`); }

    buildManifestAfterInject(root, extensionPath);
    return injected;
}

export async function injectSelective(root: string, extensionPath: string): Promise<string[]> {
    migrateLegacyVersion(root, extensionPath);
    const selected = await showComponentPicker();
    if (!selected || selected.length === 0) { return []; }

    const injected: string[] = [];
    for (const pick of selected) {
        if (pick.id === "mcp-config") {
            const variantId = await injectMcpConfig(root);
            if (variantId) { injected.push(`mcp-${variantId}`); }
        } else {
            const component = CORE_COMPONENTS.find(c => c.id === pick.id);
            if (component && injectComponent(component, root, extensionPath)) {
                injected.push(component.id);
            }
        }
    }

    buildManifestAfterInject(root, extensionPath);
    return injected;
}

export async function safeUpdate(root: string, extensionPath: string): Promise<string[]> {
    migrateLegacyVersion(root, extensionPath);
    const modified = detectModifiedFiles(root, extensionPath);
    if (modified.length === 0) {
        vscode.window.showInformationMessage("All files match bundled version. No update needed.");
        return [];
    }
    const statuses = getFileStatuses(root, extensionPath);
    const outdated = statuses.filter(s => s.state === "outdated");
    const userModified = statuses.filter(s => s.state === "modified");

    if (outdated.length > 0 && userModified.length === 0) {
        return forceUpdate(root, extensionPath);
    }

    const action = await promptUpdateWithDetails(outdated, userModified);
    if (action === "overwrite") { return forceUpdate(root, extensionPath); }
    if (action === "skip") { return updateSkipModified(root, extensionPath, userModified); }
    if (action === "backup") { return updateWithBackup(root, extensionPath, userModified); }
    return [];
}

export function checkStatus(workspaceRoot: string): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    for (const c of CORE_COMPONENTS) {
        status[c.id] = fs.existsSync(path.join(workspaceRoot, c.targetPath));
    }
    status["mcp-config"] = hasMcpConfig(workspaceRoot);
    return status;
}

/** Get per-file version report for status display. */
export function getVersionReport(root: string, extensionPath: string): string {
    migrateLegacyVersion(root, extensionPath);
    const statuses = getFileStatuses(root, extensionPath);
    const bundled = loadBundledManifest(extensionPath);
    const bundledVersion = bundled?.version || "unknown";

    const outdated = statuses.filter(s => s.state === "outdated");
    const modified = statuses.filter(s => s.state === "modified");
    const missing = statuses.filter(s => s.state === "missing");
    const current = statuses.filter(s => s.state === "current");

    const lines: string[] = [
        `Extension version: ${bundledVersion}`,
        `Files: ${current.length} current, ${outdated.length} outdated, ${modified.length} modified, ${missing.length} missing`
    ];

    if (outdated.length > 0) {
        lines.push("\n⬆️ Outdated (need update):");
        for (const f of outdated.slice(0, 15)) {
            lines.push(`  ${f.relativePath}  [v${f.workspaceVersion} → v${f.bundledVersion}]`);
        }
        if (outdated.length > 15) { lines.push(`  ...and ${outdated.length - 15} more`); }
    }

    if (modified.length > 0) {
        lines.push("\n✏️ Modified by user:");
        for (const f of modified.slice(0, 10)) {
            lines.push(`  ${f.relativePath}  [v${f.workspaceVersion}]`);
        }
        if (modified.length > 10) { lines.push(`  ...and ${modified.length - 10} more`); }
    }

    return lines.join("\n");
}

function forceUpdate(root: string, extensionPath: string): string[] {
    const injected: string[] = [];
    for (const component of CORE_COMPONENTS) {
        if (injectComponent(component, root, extensionPath)) {
            injected.push(component.id);
        }
    }
    buildManifestAfterInject(root, extensionPath);
    return injected;
}

function updateSkipModified(root: string, extensionPath: string, userModified: FileStatus[]): string[] {
    const skipPaths = new Set(userModified.map(m => m.relativePath));
    const injected: string[] = [];

    for (const component of CORE_COMPONENTS) {
        if (injectComponentFiltered(component, root, extensionPath, skipPaths)) {
            injected.push(component.id);
        }
    }
    buildManifestAfterInject(root, extensionPath);
    return injected;
}

function updateWithBackup(root: string, extensionPath: string, userModified: FileStatus[]): string[] {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = path.join(root, ".kiro/.sdlc-backup", timestamp);
    for (const file of userModified) {
        const src = path.join(root, file.relativePath);
        const dest = path.join(backupDir, file.relativePath);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        if (fs.existsSync(src)) { fs.copyFileSync(src, dest); }
    }
    vscode.window.showInformationMessage(`Backed up ${userModified.length} files to .kiro/.sdlc-backup/${timestamp}`);
    return forceUpdate(root, extensionPath);
}

async function promptUpdateWithDetails(outdated: FileStatus[], userModified: FileStatus[]): Promise<string> {
    const lines: string[] = [];
    if (outdated.length > 0) {
        lines.push(`⬆️ ${outdated.length} file(s) outdated`);
        outdated.slice(0, 5).forEach(f => lines.push(`  • ${f.relativePath}`));
    }
    if (userModified.length > 0) {
        lines.push(`✏️ ${userModified.length} file(s) modified by you`);
        userModified.slice(0, 5).forEach(f => lines.push(`  • ${f.relativePath}`));
    }
    const action = await vscode.window.showWarningMessage(
        lines.join("\n"), { modal: true },
        "Overwrite All", "Skip Modified", "Backup & Overwrite", "Cancel"
    );
    if (action === "Overwrite All") { return "overwrite"; }
    if (action === "Skip Modified") { return "skip"; }
    if (action === "Backup & Overwrite") { return "backup"; }
    return "cancel";
}

async function showComponentPicker() {
    const corePicks = CORE_COMPONENTS.map(c => ({
        label: c.label, description: c.description, id: c.id, picked: true
    }));
    const mcpPick = {
        label: "Code Intelligence MCP Server (choose variant next)",
        description: "MCP server config — replaces legacy indexer scripts",
        id: "mcp-config", picked: true
    };
    return vscode.window.showQuickPick([...corePicks, mcpPick], {
        canPickMany: true, placeHolder: "Select components to inject"
    });
}

function injectComponent(component: Component, root: string, extensionPath: string): boolean {
    const source = path.join(extensionPath, "resources", component.sourcePath);
    const target = path.join(root, component.targetPath);

    if (!fs.existsSync(source)) {
        vscode.window.showWarningMessage(`Source not found: ${component.sourcePath}`);
        return false;
    }
    try {
        if (component.filter) {
            copySelectedItems(source, target, component.filter);
        } else {
            copyDirRecursive(source, target);
        }
        return true;
    } catch (err) {
        vscode.window.showErrorMessage(`Failed to inject ${component.id}: ${err}`);
        return false;
    }
}

function injectComponentFiltered(
    component: Component, root: string, extensionPath: string, skipPaths: Set<string>
): boolean {
    const source = path.join(extensionPath, "resources", component.sourcePath);
    const target = path.join(root, component.targetPath);

    if (!fs.existsSync(source)) { return false; }
    try {
        copyDirFiltered({ source, target, workspaceRoot: root, skipPaths });
        return true;
    } catch (err) {
        vscode.window.showErrorMessage(`Failed to inject ${component.id}: ${err}`);
        return false;
    }
}
