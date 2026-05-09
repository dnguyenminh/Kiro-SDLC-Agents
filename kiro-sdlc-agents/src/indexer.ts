/**
 * Code indexer — auto-detects runtime and runs appropriate indexer script.
 */

import * as vscode from "vscode";
import * as cp from "child_process";
import * as path from "path";
import { INDEXER_SCRIPTS } from "./config";

type IndexerKey = keyof typeof INDEXER_SCRIPTS;

export async function runIndexer(workspaceRoot: string): Promise<boolean> {
    const preferred = vscode.workspace.getConfiguration("kiroSdlc").get<string>("preferredIndexer", "auto");

    const indexerKey = preferred === "auto"
        ? await detectAvailableIndexer()
        : preferred as IndexerKey;

    if (!indexerKey) {
        vscode.window.showWarningMessage("No compatible runtime found. Install Python, Java, or Node.js.");
        return false;
    }

    const command = buildCommand(indexerKey, workspaceRoot);
    if (!command) { return false; }

    return await executeIndexer(command, workspaceRoot, indexerKey);
}

async function detectAvailableIndexer(): Promise<IndexerKey | null> {
    const priority: IndexerKey[] = ["python", "java", "nodejs", "powershell", "bash"];
    for (const key of priority) {
        const script = INDEXER_SCRIPTS[key];
        const checkCmd = "check" in script ? script.check : null;
        if (checkCmd && await commandExists(checkCmd)) {
            return key;
        }
    }
    return isWindows() ? "powershell" : "bash";
}

function buildCommand(key: IndexerKey, workspaceRoot: string): string | null {
    const script = INDEXER_SCRIPTS[key];
    switch (key) {
        case "python":
            return `python ${path.join(workspaceRoot, ".analysis/code-intelligence/scripts/python/main.py")} "${workspaceRoot}"`;
        case "java":
            if (isWindows()) {
                return `"${path.join(workspaceRoot, ".analysis\\code-intelligence\\scripts\\java\\run.bat")}" "${workspaceRoot}"`;
            }
            return `bash "${path.join(workspaceRoot, ".analysis/code-intelligence/scripts/java/run.sh")}" "${workspaceRoot}"`;
        case "nodejs":
            const nodeDir = path.join(workspaceRoot, ".analysis/code-intelligence/scripts/nodejs");
            return `cd "${nodeDir}" && npm install && npx tsx src/full-indexer.ts "${workspaceRoot}"`;
        case "powershell":
            const psScript = path.join(workspaceRoot, ".analysis\\code-intelligence\\scripts\\powershell\\full-indexer.ps1");
            return `powershell -ExecutionPolicy Bypass -File "${psScript}" -RootDir "${workspaceRoot}"`;
        case "bash":
            const bashScript = path.join(workspaceRoot, ".analysis/code-intelligence/scripts/bash/full-indexer.sh");
            return `bash "${bashScript}" "${workspaceRoot}"`;
        default:
            return null;
    }
}

async function executeIndexer(command: string, cwd: string, key: IndexerKey): Promise<boolean> {
    return new Promise((resolve) => {
        const channel = vscode.window.createOutputChannel("Kiro Code Indexer");
        channel.show();
        channel.appendLine(`[Kiro] Running ${INDEXER_SCRIPTS[key].label} indexer...`);
        channel.appendLine(`[Kiro] Command: ${command}`);
        channel.appendLine("");

        const proc = cp.exec(command, { cwd, timeout: 120000 }, (err, stdout, stderr) => {
            if (stdout) { channel.appendLine(stdout); }
            if (stderr) { channel.appendLine(stderr); }
            if (err) {
                channel.appendLine(`[Kiro] ERROR: ${err.message}`);
                vscode.window.showErrorMessage(`Indexer failed: ${err.message}`);
                resolve(false);
            } else {
                channel.appendLine("[Kiro] ✅ Indexing complete!");
                vscode.window.showInformationMessage("Code indexing complete!");
                resolve(true);
            }
        });
    });
}

function commandExists(cmd: string): Promise<boolean> {
    return new Promise((resolve) => {
        cp.exec(cmd, { timeout: 5000 }, (err) => resolve(!err));
    });
}

function isWindows(): boolean {
    return process.platform === "win32";
}
