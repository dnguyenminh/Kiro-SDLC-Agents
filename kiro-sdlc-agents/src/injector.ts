/**
 * Core injection logic — copies resources to target workspace.
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { Component, CORE_COMPONENTS, INDEXER_BASE, INDEXER_OPTIONS } from "./config";

export async function injectAll(workspaceRoot: string, extensionPath: string): Promise<string[]> {
    const injected: string[] = [];

    for (const component of CORE_COMPONENTS) {
        if (await injectComponent(component, workspaceRoot, extensionPath)) {
            injected.push(component.id);
        }
    }

    const indexerChoice = await pickIndexer();
    if (indexerChoice) {
        await injectComponent(INDEXER_BASE, workspaceRoot, extensionPath);
        if (await injectComponent(indexerChoice, workspaceRoot, extensionPath)) {
            injected.push(indexerChoice.id);
        }
    }
    return injected;
}

export async function injectSelective(workspaceRoot: string, extensionPath: string): Promise<string[]> {
    const corePicks = CORE_COMPONENTS.map(c => ({
        label: c.label, description: c.description, id: c.id, picked: true
    }));
    const indexerPick = {
        label: "Code Intelligence Indexer (choose language next)",
        description: "Source code indexer — will ask which language",
        id: "indexer", picked: true
    };

    const selected = await vscode.window.showQuickPick([...corePicks, indexerPick], {
        canPickMany: true,
        placeHolder: "Select components to inject into workspace"
    });
    if (!selected || selected.length === 0) { return []; }

    const injected: string[] = [];
    for (const pick of selected) {
        if (pick.id === "indexer") {
            const indexerChoice = await pickIndexer();
            if (indexerChoice) {
                await injectComponent(INDEXER_BASE, workspaceRoot, extensionPath);
                if (await injectComponent(indexerChoice, workspaceRoot, extensionPath)) {
                    injected.push(indexerChoice.id);
                }
            }
        } else {
            const component = CORE_COMPONENTS.find(c => c.id === pick.id);
            if (component && await injectComponent(component, workspaceRoot, extensionPath)) {
                injected.push(component.id);
            }
        }
    }
    return injected;
}

async function pickIndexer(): Promise<Component | undefined> {
    const picks = INDEXER_OPTIONS.map(c => ({
        label: c.label, description: c.description, component: c
    }));

    const selected = await vscode.window.showQuickPick(picks, {
        canPickMany: false,
        placeHolder: "Choose ONE indexer language for this workspace"
    });
    return selected?.component;
}

async function injectComponent(component: Component, workspaceRoot: string, extensionPath: string): Promise<boolean> {
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
    const entries = fs.readdirSync(source, { withFileTypes: true });
    for (const entry of entries) {
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

function shouldSkipDir(name: string): boolean {
    return ["node_modules", "__pycache__", "out", "dist", ".git"].includes(name);
}

export function checkStatus(workspaceRoot: string): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    for (const c of CORE_COMPONENTS) {
        status[c.id] = fs.existsSync(path.join(workspaceRoot, c.targetPath));
    }
    status["indexer"] = fs.existsSync(path.join(workspaceRoot, ".analysis/code-intelligence/index-config.json"));
    return status;
}
