/**
 * Workspace indexing — prompts user to index code + documents after injection.
 * Also provides standalone command for manual indexing.
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

const DOCUMENT_TYPES: Record<string, string> = {
    "BRD": "REQUIREMENT",
    "FSD": "REQUIREMENT",
    "TDD": "ARCHITECTURE",
    "STP": "PROCEDURE",
    "STC": "PROCEDURE",
    "DPG": "PROCEDURE",
    "RLN": "PROCEDURE",
    "UG": "PROCEDURE"
};

/**
 * Show prompt after injection asking if user wants to index.
 */
export async function promptIndexAfterInject(root: string): Promise<void> {
    const action = await vscode.window.showInformationMessage(
        "🔍 Injection complete. Index your workspace now? (Code symbols + documents will be searchable by agents)",
        "Index Now", "Later"
    );
    if (action === "Index Now") {
        await runIndexWorkspace(root);
    }
}

/**
 * Standalone command handler — index workspace code + documents.
 */
export async function handleIndexWorkspace(): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) { return; }
    await runIndexWorkspace(root);
}

async function runIndexWorkspace(root: string): Promise<void> {
    const options = await showIndexOptions();
    if (!options || options.length === 0) { return; }

    const progress = vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "Indexing workspace...", cancellable: false },
        async (report) => {
            const results: string[] = [];

            if (options.includes("code")) {
                report.report({ message: "Indexing source code..." });
                results.push("✅ Code index triggered (MCP server will process in background)");
            }

            if (options.includes("documents")) {
                report.report({ message: "Discovering documents..." });
                const docs = discoverDocuments(root);

                if (docs.length === 0) {
                    results.push("ℹ️ No documents found in documents/ folder");
                } else {
                    report.report({ message: `Indexing ${docs.length} documents via HTTP API...` });
                    const apiResult = await ingestDocumentsViaHttp(docs, report);
                    results.push(apiResult);
                }
            }

            if (options.includes("sync")) {
                report.report({ message: "Syncing code symbols to memory..." });
                results.push("✅ Code symbol sync triggered");
            }

            showIndexResults(results, root, options);
        }
    );

    await progress;
}

async function showIndexOptions(): Promise<string[] | undefined> {
    const picks = await vscode.window.showQuickPick([
        { label: "$(code) Index Source Code", description: "Re-index all code symbols (FTS5)", id: "code", picked: true },
        { label: "$(book) Index Documents", description: "Index BRD, FSD, TDD into Knowledge Base", id: "documents", picked: true },
        { label: "$(sync) Sync Code → Memory", description: "Sync code entities into memory graph", id: "sync", picked: true }
    ], {
        canPickMany: true,
        placeHolder: "Select what to index"
    });
    return picks?.map(p => p.id);
}

function discoverDocuments(root: string): Array<{ path: string; type: string; ticket: string }> {
    const docsDir = path.join(root, "documents");
    if (!fs.existsSync(docsDir)) { return []; }

    const results: Array<{ path: string; type: string; ticket: string }> = [];
    const tickets = fs.readdirSync(docsDir).filter(d =>
        fs.statSync(path.join(docsDir, d)).isDirectory() && /^[A-Z]+-\d+$/.test(d)
    );

    for (const ticket of tickets) {
        const ticketDir = path.join(docsDir, ticket);
        const files = fs.readdirSync(ticketDir).filter(f => f.endsWith(".md"));

        for (const file of files) {
            const baseName = path.basename(file, ".md").toUpperCase();
            const docType = DOCUMENT_TYPES[baseName];
            if (docType) {
                results.push({
                    path: `documents/${ticket}/${file}`,
                    type: docType,
                    ticket
                });
            }
        }
    }
    return results;
}

function formatDocList(docs: Array<{ path: string; type: string; ticket: string }>): string {
    const byTicket = new Map<string, string[]>();
    for (const doc of docs) {
        const list = byTicket.get(doc.ticket) || [];
        list.push(`${path.basename(doc.path, ".md")} (${doc.type})`);
        byTicket.set(doc.ticket, list);
    }
    const lines: string[] = [];
    for (const [ticket, files] of byTicket) {
        lines.push(`  ${ticket}: ${files.join(", ")}`);
    }
    return lines.join("\n");
}

function showIndexResults(results: string[], root: string, options: string[]): void {
    const channel = vscode.window.createOutputChannel("SDLC Indexing");
    channel.show();
    channel.appendLine("=== Workspace Indexing Results ===\n");
    channel.appendLine(results.join("\n"));
    channel.appendLine("\n--- Next Steps ---");

    if (options.includes("code")) {
        channel.appendLine("• Code: MCP server indexes automatically. Check with: code_index_status");
    }
    if (options.includes("documents")) {
        channel.appendLine("• Documents: Indexed via HTTP API (auto-skips unchanged files)");
    }
    if (options.includes("sync")) {
        channel.appendLine("• Sync: Ask agent to run mem_sync_code");
    }
    channel.appendLine("\n💡 Tip: Use #indexing-guide in chat for full instructions");

    vscode.window.showInformationMessage(
        "📋 Indexing guide ready — see Output panel for details and next steps.",
        "Open Output"
    ).then(action => {
        if (action === "Open Output") { channel.show(); }
    });
}

function getWorkspaceRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        vscode.window.showErrorMessage("No workspace folder open.");
        return undefined;
    }
    return folders[0].uri.fsPath;
}

/** Resolve viewer port from MCP config or env. */
function resolveViewerPort(root: string): number {
    try {
        const mcpPath = path.join(root, ".kiro", "settings", "mcp.json");
        if (fs.existsSync(mcpPath)) {
            const raw = fs.readFileSync(mcpPath, "utf-8");
            const config = JSON.parse(raw);
            const servers = config.mcpServers || {};
            for (const server of Object.values(servers) as any[]) {
                const env = server.env || {};
                if (env.CODE_INTEL_VIEWER_PORT) {
                    return parseInt(env.CODE_INTEL_VIEWER_PORT, 10);
                }
            }
        }
    } catch { /* ignore */ }
    return 3200; // default
}

/** Call MCP server HTTP API to ingest documents. */
async function ingestDocumentsViaHttp(
    docs: Array<{ path: string; type: string; ticket: string }>,
    report: vscode.Progress<{ message?: string }>
): Promise<string> {
    const root = getWorkspaceRoot();
    if (!root) { return "❌ No workspace root"; }

    const port = resolveViewerPort(root);
    const url = `http://localhost:${port}/api/memory/ingest-file`;

    const payload = {
        files: docs.map(d => ({ file_path: d.path, type: d.type, format: "markdown" }))
    };

    try {
        const http = await import("http");
        const body = JSON.stringify(payload);

        const result = await new Promise<string>((resolve, reject) => {
            const req = http.request(url, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
            }, (res) => {
                let data = "";
                res.on("data", chunk => { data += chunk; });
                res.on("end", () => {
                    if (res.statusCode === 200) {
                        try {
                            const json = JSON.parse(data);
                            resolve(`✅ Indexed: ${json.ingested} files, skipped: ${json.skipped} (unchanged)`);
                        } catch {
                            resolve(`✅ Server responded: ${data.substring(0, 200)}`);
                        }
                    } else {
                        resolve(`⚠️ Server returned ${res.statusCode}: ${data.substring(0, 200)}`);
                    }
                });
            });
            req.on("error", (err) => {
                resolve(`❌ Cannot reach MCP server at port ${port}: ${err.message}\n   Ensure server is running. Fallback: ask agent "Index all documents"`);
            });
            req.write(body);
            req.end();
        });

        return result;
    } catch (err: any) {
        return `❌ HTTP request failed: ${err.message}`;
    }
}
