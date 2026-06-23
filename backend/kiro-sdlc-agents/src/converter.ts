/**
 * Multi-format document converter — converts non-markdown files to markdown text.
 * Uses `filetomarkdown` npm package for binary formats (docx, pdf, xlsx, images).
 * Text-based formats (txt, csv, json, xml, yaml) are read directly and wrapped in code blocks.
 *
 * Design principles:
 * - Error Isolation: One file failure must not abort the batch
 * - Lazy Loading: filetomarkdown loaded only when needed
 * - Progressive Enhancement: Extension works if filetomarkdown fails to load
 * - Timeout: 30 seconds max per file conversion
 */

import * as fs from "fs";
import * as http from "http";
import * as vscode from "vscode";

// --- Types ---

export interface ConversionResult {
    markdown: string;
    success: boolean;
    error: string | null;
    bytesProcessed: number;
    conversionTime: number;
}

// --- Constants ---

/** Size limits per format category (in bytes) */
const SIZE_LIMITS: Record<string, number> = {
    pdf: 50 * 1024 * 1024,       // 50MB
    png: 20 * 1024 * 1024,       // 20MB
    jpg: 20 * 1024 * 1024,       // 20MB
    jpeg: 20 * 1024 * 1024,      // 20MB
    gif: 20 * 1024 * 1024,       // 20MB
    bmp: 20 * 1024 * 1024,       // 20MB
    webp: 20 * 1024 * 1024,      // 20MB
    svg: 20 * 1024 * 1024,       // 20MB
    default: 50 * 1024 * 1024    // 50MB for all others
};

/** Text-based formats that can be read directly (no binary conversion needed) */
const TEXT_FORMATS = new Set(["txt", "csv", "json", "xml", "yaml", "yml"]);

/** Conversion timeout in milliseconds */
const CONVERSION_TIMEOUT_MS = 30000;

// --- Lazy-loaded filetomarkdown reference ---
let filetomarkdownModule: any = null;
let filetomarkdownLoadAttempted = false;

// --- Public API ---

/**
 * Check if a file exceeds the size limit for its format.
 * @param format File extension without dot (e.g., "pdf", "png")
 * @param sizeBytes File size in bytes
 * @returns true if file is too large to process
 */
export function isFileTooLarge(format: string, sizeBytes: number): boolean {
    const limit = SIZE_LIMITS[format.toLowerCase()] ?? SIZE_LIMITS.default;
    return sizeBytes > limit;
}

/**
 * Check if a format is text-based (can be read directly without conversion).
 */
export function isTextFormat(format: string): boolean {
    return TEXT_FORMATS.has(format.toLowerCase());
}

/**
 * Wrap text content in a markdown code block with the appropriate language tag.
 * @param content Raw text content
 * @param format File format for syntax highlighting (e.g., "json", "yaml")
 * @returns Markdown-wrapped content
 */
export function wrapTextContent(content: string, format: string): string {
    const lang = format.toLowerCase() === "yml" ? "yaml" : format.toLowerCase();
    return `\`\`\`${lang}\n${content}\n\`\`\``;
}

/**
 * Call Remote Backend to convert document to markdown using markitdown/convert_to_markdown tool.
 */
async function convertRemote(filePath: string, token?: string): Promise<string | null> {
    const config = vscode.workspace.getConfiguration("kiroSdlc");
    const backendUrl = config.get<string>("backend.url") || "http://127.0.0.1:48721";
    
    // Normalize path to file:/// URI format
    let fileUri = filePath.replace(/\\/g, "/");
    if (!fileUri.startsWith("/")) {
        fileUri = "/" + fileUri;
    }
    const uri = `file://${fileUri}`;

    const payload = {
        tool_name: "execute_dynamic_tool",
        arguments: {
            toolName: "convert_to_markdown",
            arguments: { uri }
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

    return new Promise<string | null>((resolve) => {
        const req = http.request(`${backendUrl}/mcp/tools/call`, {
            method: "POST",
            headers,
            timeout: 30000 // 30s timeout
        }, (res) => {
            let data = "";
            res.on("data", chunk => { data += chunk; });
            res.on("end", () => {
                if (res.statusCode === 200) {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed && parsed.content && Array.isArray(parsed.content)) {
                            const textObj = parsed.content.find((c: any) => c.type === "text");
                            if (textObj && typeof textObj.text === "string") {
                                resolve(textObj.text);
                                return;
                            }
                        }
                        resolve(null);
                    } catch {
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            });
        });
        req.on("error", () => resolve(null));
        req.write(body);
        req.end();
    });
}

/**
 * Convert a file to markdown text.
 *
 * Routing logic:
 * 1. Check file exists and get size
 * 2. Check size limit (skip if too large)
 * 3. If text format: read as UTF-8, wrap in code block
 * 4. If binary: try remote conversion first, then fallback to local filetomarkdown
 *
 * @param filePath Absolute path to the file
 * @param format File extension without dot (e.g., "docx", "pdf", "txt")
 * @param token Optional authorization token
 * @returns ConversionResult with markdown content or error
 */
export async function convertFileToMarkdown(filePath: string, format: string, token?: string): Promise<ConversionResult> {
    const startTime = Date.now();

    // Step 1: Check file exists and get size
    let fileSize: number;
    try {
        const stat = fs.statSync(filePath);
        fileSize = stat.size;
    } catch (err: any) {
        return {
            markdown: "",
            success: false,
            error: `File not found or inaccessible: ${err.code || err.message}`,
            bytesProcessed: 0,
            conversionTime: Date.now() - startTime
        };
    }

    // Step 2: Check size limit
    if (isFileTooLarge(format, fileSize)) {
        const limitMB = ((SIZE_LIMITS[format.toLowerCase()] ?? SIZE_LIMITS.default) / (1024 * 1024)).toFixed(0);
        const fileMB = (fileSize / (1024 * 1024)).toFixed(1);
        return {
            markdown: "",
            success: false,
            error: `Exceeds size limit: ${fileMB}MB > ${limitMB}MB limit for .${format}`,
            bytesProcessed: fileSize,
            conversionTime: Date.now() - startTime
        };
    }

    // Step 3: Text formats — read directly
    if (isTextFormat(format)) {
        try {
            const content = fs.readFileSync(filePath, "utf-8");
            return {
                markdown: wrapTextContent(content, format),
                success: true,
                error: null,
                bytesProcessed: fileSize,
                conversionTime: Date.now() - startTime
            };
        } catch (err: any) {
            return {
                markdown: "",
                success: false,
                error: `Failed to read text file: ${err.message}`,
                bytesProcessed: fileSize,
                conversionTime: Date.now() - startTime
            };
        }
    }



    // Step 4: Remote Conversion via Backend MCP
    try {
        const remoteMarkdown = await convertRemote(filePath, token);
        if (remoteMarkdown !== null) {
            return {
                markdown: remoteMarkdown,
                success: true,
                error: null,
                bytesProcessed: fileSize,
                conversionTime: Date.now() - startTime
            };
        }
    } catch (err: any) {
        // Proceed to local fallback on failure
    }

    // Step 5: Binary formats fallback — convert via filetomarkdown with timeout
    try {
        const ftm = loadFileToMarkdown();
        if (!ftm) {
            return {
                markdown: "",
                success: false,
                error: "filetomarkdown package unavailable — cannot convert binary formats. Install with: npm install filetomarkdown",
                bytesProcessed: fileSize,
                conversionTime: Date.now() - startTime
            };
        }

        const markdown = await convertWithTimeout(ftm, filePath, CONVERSION_TIMEOUT_MS);

        if (!markdown || markdown.trim().length === 0) {
            return {
                markdown: "",
                success: false,
                error: "Conversion returned empty content",
                bytesProcessed: fileSize,
                conversionTime: Date.now() - startTime
            };
        }

        return {
            markdown,
            success: true,
            error: null,
            bytesProcessed: fileSize,
            conversionTime: Date.now() - startTime
        };
    } catch (err: any) {
        const isTimeout = err.message?.includes("timeout");
        return {
            markdown: "",
            success: false,
            error: isTimeout
                ? `Conversion timeout: exceeded ${CONVERSION_TIMEOUT_MS / 1000}s limit`
                : `Conversion failed: ${err.message}`,
            bytesProcessed: fileSize,
            conversionTime: Date.now() - startTime
        };
    }
}

// --- Internal helpers ---

/**
 * Lazy-load the filetomarkdown package.
 * Returns the module or null if unavailable.
 */
function loadFileToMarkdown(): any {
    if (filetomarkdownModule) { return filetomarkdownModule; }
    if (filetomarkdownLoadAttempted) { return null; }

    filetomarkdownLoadAttempted = true;
    try {
        filetomarkdownModule = require("filetomarkdown");
        return filetomarkdownModule;
    } catch {
        return null;
    }
}

/**
 * Run filetomarkdown conversion with a timeout.
 * @param ftm The filetomarkdown module
 * @param filePath Absolute file path
 * @param timeoutMs Timeout in milliseconds
 * @returns Converted markdown string
 * @throws Error if timeout or conversion fails
 */
async function convertWithTimeout(ftm: any, filePath: string, timeoutMs: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Conversion timeout: file took longer than ${timeoutMs / 1000}s`));
        }, timeoutMs);

        const conversionPromise = typeof ftm.convert === "function"
            ? ftm.convert(filePath)
            : typeof ftm.default === "function"
                ? ftm.default(filePath)
                : typeof ftm === "function"
                    ? ftm(filePath)
                    : Promise.reject(new Error("filetomarkdown: no convert function found"));

        Promise.resolve(conversionPromise)
            .then((result: any) => {
                clearTimeout(timer);
                if (typeof result === "string") {
                    resolve(result);
                } else if (result && typeof result.content === "string") {
                    resolve(result.content);
                } else if (result && typeof result.markdown === "string") {
                    resolve(result.markdown);
                } else {
                    resolve(String(result || ""));
                }
            })
            .catch((err: any) => {
                clearTimeout(timer);
                reject(err);
            });
    });
}
