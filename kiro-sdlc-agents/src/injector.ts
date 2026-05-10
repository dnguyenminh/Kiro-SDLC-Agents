/**
 * Core injection logic — copies resources to target workspace.
 * Uses bundled checksum manifest (inside extension) to detect user modifications.
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { Component, CORE_COMPONENTS, INDEXER_BASE, INDEXER_OPTIONS } from "./config";
import {
    detectModifiedFiles, saveWorkspaceVersion, loadWorkspaceVersion,
    loadBundledManifest, ModifiedFile
} from "./checksum";

const EXTENSION_VERSION = getExtensionVersion();

export async function injectAll(root: string, extensionPath: string): Promise<string[]> {
    const injected: string[] = [];
    const manifest = loadBundledManifest(extensionPath);
    const bundledVersion = manifest?.version || EXTENSION_VERSION;

    for (const component of CORE_COMPONENTS) {
        if (await injectComponent(component, root, extensionPath)) {
            injected.push(component.id);
        }
    }

    const indexerChoice = await pickIndexer();
    if (indexerChoice) {
        await injectComponent(INDEXER_BASE, root, extensionPath);
        if (await injectComponent(indexerChoice, root, extensionPath)) {
            injected.push(indexerChoice.id);
        }
    }

    saveWorkspaceVersion(root, bundledVersion);
    return injected;
}

export async function injectSelective(root: string, extensionPath: string): Promise<string[]> {
    const corePicks = CORE_COMPONENTS.map(c => ({
        label: c.label, description: c.description, id: c.id, picked: true
    }));
    const indexerPick = {
        label: "Code Intelligence Indexer (choose language next)",
        description: "Source code indexer — will ask which language",
        id: "indexer", picked: true
    };

    const selected = await vscode.window.showQuickPick([...corePicks, indexerPick], {
        canPickMany: true, placeHolder: "Select components to inject into workspace"
    });
    if (!selected || selected.length === 0) { return []; }

    const injected: string[] = [];
    for (const pick of selected) {
        if (pick.id === "indexer") {
            const indexerChoice = await pickIndexer();
            if (indexerChoice) {
                await injectComponent(INDEXER_BASE, root, extensionPath);
                if (await injectComponent(indexerChoice, root, extensionPath)) {
                    injected.push(indexerChoice.id);
                }
            }
        } else {
            const component = CORE_COMPONENTS.find(c => c.id === pick.id);
            if (component && await injectComponent(component, root, extensionPath)) {
                injected.push(component.id);
            }
        }
    }

    saveWorkspaceVersion(root, EXTENSION_VERSION);
    return injected;
}

export async function safeUpdate(root: string, extensionPath: string): Promise<string[]> {
    const wsVersion = loadWorkspaceVersion(root);
    const manifest = loadBundledManifest(extensionPath);
    const bundledVersion = manifest?.version || EXTENSION_VERSION;

    const isVersionUpgrade = !wsVersion || wsVersion.version !== bundledVersion;

    if (isVersionUpgrade) {
        const modified = detectModifiedFiles(root, extensionPath);
        if (modified.length === 0) {
            return await forceUpdate(root, extensionPath);
        }
        const action = await promptUpgradeWithModified(modified, wsVersion?.version || "unknown", bundledVersion);
        if (action === "cancel") { return []; }
        if (action === "overwrite") { return await forceUpdate(root, extensionPath); }
        if (action === "skip") { return await updateSkipModified(root, extensionPath, modified); }
        if (action === "backup") { return await updateWithBackup(root, extensionPath, modified); }
        return [];
    }

    const modified = detectModifiedFiles(root, extensionPath);
    if (modified.length === 0) {
        vscode.window.showInformationMessage("All files are up to date. No changes needed.");
        return [];
    }

    const action = await promptModifiedFiles(modified);
    if (action === "cancel") { return []; }
    if (action === "overwrite") { return await forceUpdate(root, extensionPath); }
    if (action === "skip") { return await updateSkipModified(root, extensionPath, modified); }
    if (action === "backup") { return await updateWithBackup(root, extensionPath, modified); }
    return [];
}

export function checkStatus(workspaceRoot: string): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    for (const c of CORE_COMPONENTS) {
        status[c.id] = fs.existsSync(path.join(workspaceRoot, c.targetPath));
    }
    status["indexer"] = fs.existsSync(
        path.join(workspaceRoot, ".analysis/code-intelligence/index-config.json")
    );
    return status;
}

async function forceUpdate(root: string, extensionPath: string): Promise<string[]> {
    const manifest = loadBundledManifest(extensionPath);
    const bundledVersion = manifest?.version || EXTENSION_VERSION;
    const injected: string[] = [];
    for (const component of CORE_COMPONENTS) {
        if (await injectComponent(component, root, extensionPath)) {
            injected.push(component.id);
        }
    }
    saveWorkspaceVersion(root, bundledVersion);
    return injected;
}

async function updateSkipModified(
    root: string, extensionPath: string, modified: ModifiedFile[]
): Promise<string[]> {
    const modifiedPaths = new Set(modified.map(m => m.relativePath));
    const injected: string[] = [];

    for (const component of CORE_COMPONENTS) {
        if (await injectComponentFiltered(component, root, extensionPath, modifiedPaths)) {
            injected.push(component.id);
        }
    }
    saveWorkspaceVersion(root, EXTENSION_VERSION);
    return injected;
}

async function updateWithBackup(
    root: string, extensionPath: string, modified: ModifiedFile[]
): Promise<string[]> {
    const backupDir = path.join(root, ".kiro/.sdlc-backup");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    for (const file of modified) {
        const src = path.join(root, file.relativePath);
        const dest = path.join(backupDir, timestamp, file.relativePath);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
    }

    vscode.window.showInformationMessage(
        `Backed up ${modified.length} modified files to .kiro/.sdlc-backup/${timestamp}`
    );
    return await forceUpdate(root, extensionPath);
}

async function promptModifiedFiles(modified: ModifiedFile[]): Promise<string> {
    const fileList = modified.slice(0, 10).map(m => `  • ${m.relativePath}`).join("\n");
    const extra = modified.length > 10 ? `\n  ...and ${modified.length - 10} more` : "";

    const action = await vscode.window.showWarningMessage(
        `⚠️ ${modified.length} file(s) modified since last inject:\n${fileList}${extra}`,
        { modal: true },
        "Skip Modified", "Backup & Overwrite", "Overwrite All", "Cancel"
    );

    switch (action) {
        case "Skip Modified": return "skip";
        case "Backup & Overwrite": return "backup";
        case "Overwrite All": return "overwrite";
        default: return "cancel";
    }
}

async function promptUpgradeWithModified(
    modified: ModifiedFile[], oldVersion: string, newVersion: string
): Promise<string> {
    const fileList = modified.slice(0, 10).map(m => `  • ${m.relativePath}`).join("\n");
    const extra = modified.length > 10 ? `\n  ...and ${modified.length - 10} more` : "";

    const action = await vscode.window.showWarningMessage(
        `🆕 Upgrading ${oldVersion} → ${newVersion}\n` +
        `⚠️ ${modified.length} file(s) differ from new version:\n${fileList}${extra}\n\n` +
        `These may be your customizations or simply outdated files.`,
        { modal: true },
        "Overwrite All (recommended)", "Skip Modified", "Backup & Overwrite", "Cancel"
    );

    switch (action) {
        case "Overwrite All (recommended)": return "overwrite";
        case "Skip Modified": return "skip";
        case "Backup & Overwrite": return "backup";
        default: return "cancel";
    }
}

async function pickIndexer(): Promise<Component | undefined> {
    const picks = INDEXER_OPTIONS.map(c => ({
        label: c.label, description: c.description, component: c
    }));
    const selected = await vscode.window.showQuickPick(picks, {
        canPickMany: false, placeHolder: "Choose ONE indexer language for this workspace"
    });
    return selected?.component;
}

async function injectComponent(
    component: Component, workspaceRoot: string, extensionPath: string
): Promise<boolean> {
    const source = path.join(extensionPath, "resources", component.sourcePath);
    const target = path.join(workspaceRoot, component.targetPath);

    if (!fs.existsSync(source)) {
        vscode.window.showWarningMessage(`Source not found: ${component.sourcePath}`);
        return false;
    }
    try {
        if (component.filter) {
            copyFiltered(source, target, component.filter);
        } else {
            copyDirRecursive(source, target);
        }
        return true;
    } catch (err) {
        vscode.window.showErrorMessage(`Failed to inject ${component.id}: ${err}`);
        return false;
    }
}

async function injectComponentFiltered(
    component: Component, workspaceRoot: string, extensionPath: string, skipPaths: Set<string>
): Promise<boolean> {
    const source = path.join(extensionPath, "resources", component.sourcePath);
    const target = path.join(workspaceRoot, component.targetPath);

    if (!fs.existsSync(source)) { return false; }
    try {
        copyDirRecursiveFiltered(source, target, workspaceRoot, skipPaths);
        return true;
    } catch (err) {
        vscode.window.showErrorMessage(`Failed to inject ${component.id}: ${err}`);
        return false;
    }
}

function copyFiltered(source: string, target: string, filter: string[]): void {
    fs.mkdirSync(target, { recursive: true });
    for (const item of filter) {
        const srcPath = path.join(source, item);
        const tgtPath = path.join(target, item);
        if (!fs.existsSync(srcPath)) { continue; }
        if (fs.statSync(srcPath).isDirectory()) {
            copyDirRecursive(srcPath, tgtPath);
        } else {
            fs.mkdirSync(path.dirname(tgtPath), { recursive: true });
            fs.copyFileSync(srcPath, tgtPath);
        }
    }
}

function copyDirRecursive(source: string, target: string): void {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
        const srcPath = path.join(source, entry.name);
        const tgtPath = path.join(target, entry.name);
        if (entry.isDirectory()) {
            if (shouldSkipDir(entry.name)) { continue; }
            copyDirRecursive(srcPath, tgtPath);
        } else {
            fs.copyFileSync(srcPath, tgtPath);
        }
    }
}

function copyDirRecursiveFiltered(
    source: string, target: string, workspaceRoot: string, skipPaths: Set<string>
): void {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
        const srcPath = path.join(source, entry.name);
        const tgtPath = path.join(target, entry.name);
        if (entry.isDirectory()) {
            if (shouldSkipDir(entry.name)) { continue; }
            copyDirRecursiveFiltered(srcPath, tgtPath, workspaceRoot, skipPaths);
        } else {
            const rel = path.relative(workspaceRoot, tgtPath).replace(/\\/g, "/");
            if (skipPaths.has(rel)) { continue; }
            fs.copyFileSync(srcPath, tgtPath);
        }
    }
}

function shouldSkipDir(name: string): boolean {
    return ["node_modules", "__pycache__", "out", "dist", ".git"].includes(name);
}

function getExtensionVersion(): string {
    try {
        const pkgPath = path.join(__dirname, "..", "package.json");
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        return pkg.version || "0.0.0";
    } catch {
        return "0.0.0";
    }
}
