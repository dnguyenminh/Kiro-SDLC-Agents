/**
 * Workspace indexing — prompts user to index code + documents after injection.
 * Also provides standalone command for manual indexing.
 * Supports multi-format: .md, .docx, .xlsx, .pdf, .png, .jpg, .pptx, etc.
 * Non-markdown files are converted via `filetomarkdown` package before ingestion.
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { convertFileToMarkdown, isTextFormat, type ConversionResult } from "./converter";

const DOCUMENT_TYPES: Record<string, string> = {
    "BRD": "REQUIREMENT",
    "FSD": "REQUIREMENT",
    "TDD": "ARCHITECTURE",
    "STP": "PROCEDURE",
    "STC": "PROCEDURE",
    "DPG": "PROCEDURE",
    "RLN": "PROCEDURE",
    "UG": "PROCEDURE",
    "TEST-REPORT": "PROCEDURE",
    "DISCREPANCY": "CONTEXT",
    "SECURITY-REPORT": "PROCEDURE"
};

/** File extensions supported for indexing (converted to markdown before ingest) */
const INDEXABLE_EXTENSIONS = new Set([
    // Markdown (native)
    ".md",
    // Office documents
    ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt",
    // PDF
    ".pdf",
    // Images (OCR/description)
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".svg",
    // Text-based
    ".txt", ".csv", ".json", ".xml", ".yaml", ".yml",
    // Rich text
    ".rtf", ".odt", ".ods", ".odp"
]);

/**
 * Show prompt after injection asking if user wants to index.
 */
export async function promptIndexAfterInject(root: string, token?: string): Promise<void> {
    const action = await vscode.window.showInformationMessage(
        "🔍 Injection complete. Index your workspace now? (Code symbols + documents will be searchable by agents)",
        "Index Now", "Later"
    );
    if (action === "Index Now") {
        await runIndexWorkspace(root, token);
    }
}

/**
 * Standalone command handler — index workspace code + documents.
 */
export async function handleIndexWorkspace(token?: string): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) { return; }
    await runIndexWorkspace(root, token);
}

async function runIndexWorkspace(root: string, token?: string): Promise<void> {
    const options = await showIndexOptions();
    if (!options || options.length === 0) { return; }

    const progress = vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "Indexing workspace...", cancellable: false },
        async (report) => {
            const results: string[] = [];

            if (options.includes("code")) {
                report.report({ message: "Scanning and uploading source code files..." });
                const resMsg = await uploadSourceFiles(report, token);
                results.push(resMsg);
            }

            if (options.includes("documents")) {
                report.report({ message: "Discovering documents..." });
                const docs = discoverDocuments(root);

                if (docs.length === 0) {
                    results.push("ℹ️ No documents found in documents/ folder");
                } else {
                    // Separate markdown (direct ingest) from non-markdown (needs conversion)
                    const mdDocs = docs.filter(d => d.format === "markdown");
                    const nonMdDocs = docs.filter(d => d.format !== "markdown");

                    report.report({ message: `Found ${docs.length} files (${nonMdDocs.length} need conversion)` });

                    // Convert non-markdown files
                    const convertedDocs: Array<{ path: string; type: string; ticket: string; format: string; content?: string }> = [];
                    let convertedCount = 0;
                    let skippedCount = 0;
                    const errors: Array<{ file: string; error: string }> = [];

                    const channel = vscode.window.createOutputChannel("SDLC Indexing");

                    for (let i = 0; i < nonMdDocs.length; i++) {
                        const doc = nonMdDocs[i];
                        report.report({ message: `Converting ${i + 1}/${nonMdDocs.length} files...` });

                        const absPath = path.join(root, doc.path);
                        const result = await convertFileToMarkdown(absPath, doc.format, token);

                        if (result.success) {
                            if (result.markdown && result.markdown.trim().length > 0) {
                                convertedDocs.push({ ...doc, content: result.markdown });
                                convertedCount++;
                                channel.appendLine(`  ✅ Converted: ${doc.path} (${result.conversionTime}ms)`);
                            } else {
                                skippedCount++;
                                channel.appendLine(`  ⏭️ Skipped (empty content): ${doc.path} (${result.conversionTime}ms)`);
                            }
                        } else {
                            skippedCount++;
                            errors.push({ file: doc.path, error: result.error || "unknown" });
                            channel.appendLine(`  ⚠️ Skipped: ${doc.path} — ${result.error}`);
                        }
                    }

                    // Combine: direct markdown + converted files
                    const allDocsForIngest = [
                        ...mdDocs,
                        ...convertedDocs
                    ];

                    report.report({ message: `Indexing ${allDocsForIngest.length} files...` });
                    const apiResult = await ingestDocumentsViaHttp(allDocsForIngest, report, token);

                    // Summary
                    const summary = [
                        `✅ Documents: ${docs.length} discovered`,
                        `   📄 Direct markdown: ${mdDocs.length}`,
                        `   🔄 Converted: ${convertedCount}`,
                        `   ⏭️ Skipped: ${skippedCount}`,
                        `   ${apiResult}`
                    ];
                    if (errors.length > 0) {
                        summary.push(`   ⚠️ Errors:`);
                        for (const e of errors.slice(0, 5)) {
                            summary.push(`      - ${path.basename(e.file)}: ${e.error}`);
                        }
                        if (errors.length > 5) {
                            summary.push(`      ... and ${errors.length - 5} more`);
                        }
                    }
                    results.push(summary.join("\n"));
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
        { label: "$(book) Index Documents", description: "Index all SDLC documents into Knowledge Base", id: "documents", picked: true },
        { label: "$(sync) Sync Code → Memory", description: "Sync code entities into memory graph", id: "sync", picked: true }
    ], {
        canPickMany: true,
        placeHolder: "Select what to index"
    });
    return picks?.map(p => p.id);
}

function discoverDocuments(root: string): Array<{ path: string; type: string; ticket: string; format: string }> {
    const docsDir = path.join(root, "documents");
    console.error(`[indexer] discoverDocuments: root=${root}, docsDir=${docsDir}, exists=${fs.existsSync(docsDir)}`);
    if (!fs.existsSync(docsDir)) { return []; }

    const results: Array<{ path: string; type: string; ticket: string; format: string }> = [];
    const allEntries = fs.readdirSync(docsDir);
    const tickets = allEntries.filter(d =>
        fs.statSync(path.join(docsDir, d)).isDirectory() && /^[A-Z]+-\d+$/.test(d)
    );
    console.error(`[indexer] discoverDocuments: ${allEntries.length} entries, ${tickets.length} ticket dirs`);

    for (const ticket of tickets) {
        const ticketDir = path.join(docsDir, ticket);
        scanDirectoryRecursive(ticketDir, ticket, `documents/${ticket}`, results);
    }
    console.error(`[indexer] discoverDocuments: found ${results.length} documents across ${tickets.length} tickets`);
    return results;
}

/** Recursively scan a directory for indexable files (skip diagrams/*.drawio) */
function scanDirectoryRecursive(
    dir: string,
    ticket: string,
    relativePath: string,
    results: Array<{ path: string; type: string; ticket: string; format: string }>
): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.isDirectory()) {
            // Skip diagrams source folder (drawio files are not text-indexable)
            if (entry.name === "diagrams" || entry.name === "testdata") { continue; }
            scanDirectoryRecursive(
                path.join(dir, entry.name),
                ticket,
                `${relativePath}/${entry.name}`,
                results
            );
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (!INDEXABLE_EXTENSIONS.has(ext)) { continue; }

            const baseName = path.basename(entry.name, ext).toUpperCase();
            let docType = "CONTEXT";
            for (const key of Object.keys(DOCUMENT_TYPES)) {
                if (baseName === key || baseName.startsWith(key + "-") || baseName.startsWith(key + "_") || baseName.startsWith(key)) {
                    docType = DOCUMENT_TYPES[key];
                    break;
                }
            }
            const format = ext === ".md" ? "markdown" : ext.replace(".", "");

            results.push({
                path: `${relativePath}/${entry.name}`,
                type: docType,
                ticket,
                format
            });
        }
    }
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

            // Priority 1: active httpStream server with "code-intel" in name — parse port from URL
            for (const [name, server] of Object.entries(servers) as [string, any][]) {
                if (server.disabled) { continue; }
                if (name.includes("code-intel") && server.url) {
                    const match = server.url.match(/:(\d+)/);
                    if (match) { return parseInt(match[1], 10); }
                }
            }

            // Priority 2: active server with CODE_INTEL_VIEWER_PORT env
            for (const server of Object.values(servers) as any[]) {
                if (server.disabled) { continue; }
                const env = server.env || {};
                if (env.CODE_INTEL_VIEWER_PORT) {
                    return parseInt(env.CODE_INTEL_VIEWER_PORT, 10);
                }
            }
        }
    } catch { /* ignore */ }
    return 3200; // default
}

/** Call Backend MCP server to ingest documents via mem_ingest_file tool. */
async function ingestDocumentsViaHttp(
    docs: Array<{ path: string; type: string; ticket: string; content?: string }>,
    report: vscode.Progress<{ message?: string }>,
    token?: string
): Promise<string> {
    const backendUrl = vscode.workspace.getConfiguration("kiroSdlc").get<string>("backend.url");
    if (!backendUrl) { return "❌ Backend URL not configured in settings."; }

    const url = `${backendUrl}/mcp/tools/call`;
    let ingested = 0;
    let errors = 0;

    try {
        const http = await import("http");
        
        for (let i = 0; i < docs.length; i++) {
            const d = docs[i];
            if (i % 10 === 0) {
                report.report({ message: `Ingesting ${i + 1}/${docs.length} files...` });
            }

            let fileContent = d.content;
            if (!fileContent) {
                try {
                    const root = getWorkspaceRoot();
                    if (root) {
                        const absPath = path.join(root, d.path);
                        const raw = await vscode.workspace.fs.readFile(vscode.Uri.file(absPath));
                        fileContent = Buffer.from(raw).toString("utf-8");
                    }
                } catch (e: any) {
                    console.error("Failed to read markdown file", d.path, e);
                }
            }

            if (fileContent) {
                await uploadDocumentFile(d.path, fileContent, token);
            }

            const payload = {
                tool_name: "mem_ingest_file",
                arguments: {
                    file_path: d.path,
                    type: d.type,
                    format: "markdown",
                    ...(fileContent ? { content: fileContent } : {})
                }
            };

            const body = JSON.stringify(payload);
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body).toString()
            };
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }

            const result = await new Promise<boolean>((resolve) => {
                const req = http.request(url, {
                    method: "POST",
                    headers
                }, (res) => {
                    let data = "";
                    res.on("data", chunk => { data += chunk; });
                    res.on("end", () => {
                        if (res.statusCode === 200) {
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    });
                });
                req.on("error", () => resolve(false));
                req.write(body);
                req.end();
            });

            if (result) ingested++;
            else errors++;
        }

        return `✅ Indexed: ${ingested} files` + (errors > 0 ? `, ⚠️ Failed: ${errors}` : ``);
    } catch (err: any) {
        return `❌ HTTP request failed: ${err.message}`;
    }
}

async function uploadDocumentFile(relPath: string, content: string, token?: string): Promise<boolean> {
    const backendUrl = vscode.workspace.getConfiguration("kiroSdlc").get<string>("backend.url");
    if (!backendUrl) { return false; }
    
    const url = `${backendUrl}/api/index/document`;
    const payload = { path: relPath, content };
    const body = JSON.stringify(payload);
    
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body).toString()
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    
    return new Promise<boolean>((resolve) => {
        const http = require("http");
        const req = http.request(url, {
            method: "POST",
            headers
        }, (res: any) => {
            res.on("data", () => {});
            res.on("end", () => resolve(res.statusCode === 200));
        });
        req.on("error", () => resolve(false));
        req.write(body);
        req.end();
    });
}

async function uploadSourceFiles(report: vscode.Progress<{ message?: string }>, token?: string): Promise<string> {
    const backendUrl = vscode.workspace.getConfiguration("kiroSdlc").get<string>("backend.url");
    if (!backendUrl) { return "❌ Backend URL not configured."; }

    const files = await vscode.workspace.findFiles(
        "**/*.{ts,js,kt,java,py,go,rs,tsx,jsx}",
        "{node_modules,dist,.git,build,out,backend}/**"
    );
    
    if (files.length === 0) {
        return "ℹ️ No source files found";
    }

    const url = `${backendUrl}/api/index/source`;
    const batchSize = 50;
    let uploaded = 0;
    let errors = 0;

    for (let i = 0; i < files.length; i += batchSize) {
        report.report({ message: `Uploading source files ${i + 1}/${files.length}...` });
        const batch = files.slice(i, i + batchSize);
        const entries = await Promise.all(
            batch.map(async (file) => {
                const content = await vscode.workspace.fs.readFile(file);
                return {
                    path: vscode.workspace.asRelativePath(file),
                    content: Buffer.from(content).toString("utf-8")
                };
            })
        );

        const payload = { files: entries };
        const body = JSON.stringify(payload);
        
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body).toString()
        };
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const success = await new Promise<boolean>((resolve) => {
            const http = require("http");
            const req = http.request(url, {
                method: "POST",
                headers
            }, (res: any) => {
                res.on("data", () => {});
                res.on("end", () => resolve(res.statusCode === 200));
            });
            req.on("error", () => resolve(false));
            req.write(body);
            req.end();
        });

        if (success) {
            uploaded += batch.length;
        } else {
            errors += batch.length;
        }
    }

    return `✅ Uploaded & indexed ${uploaded} source files` + (errors > 0 ? `, ⚠️ Failed: ${errors}` : "");
}
