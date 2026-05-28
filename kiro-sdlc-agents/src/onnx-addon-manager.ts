/**
 * OnnxAddonManager — Downloads and caches prebuilt onnxruntime-node native binaries.
 * Same pattern as NativeAddonManager (better-sqlite3) but for ONNX Runtime.
 *
 * Flow: check cache → download tar.gz if missing → extract → verify SHA-256 → return path
 * Cache: {globalStorageUri}/native-addons/onnxruntime-node/v{version}/{platform}-{arch}/
 *
 * The extracted directory contains:
 *   onnxruntime-node/    (bin/, dist/, package.json)
 *   onnxruntime-common/  (JS peer dependency)
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import * as crypto from "crypto";
import * as zlib from "zlib";

interface OnnxBinaryEntry {
    url: string;
    sha256: string;
    size: number;
}

interface OnnxReleaseManifest {
    "onnxruntime-node": {
        version: string;
        releaseUrl: string;
        binaries: Record<string, OnnxBinaryEntry>;
    };
}

export interface OnnxPlatformInfo {
    platform: NodeJS.Platform;
    arch: string;
    supported: boolean;
    cacheKey: string;
    cacheDir: string;
}

export class OnnxAddonManager {
    private readonly globalStoragePath: string;
    private readonly extensionPath: string;
    private readonly outputChannel: vscode.OutputChannel;
    private manifest: OnnxReleaseManifest | null;

    constructor(
        context: vscode.ExtensionContext,
        outputChannel: vscode.OutputChannel
    ) {
        this.globalStoragePath = context.globalStorageUri.fsPath;
        this.extensionPath = context.extensionPath;
        this.outputChannel = outputChannel;
        this.manifest = this.loadManifest();
    }

    /**
     * Ensure ONNX Runtime native binaries are available. Downloads if not cached.
     * @returns Path to the extracted onnxruntime-node directory, or null if unavailable.
     */
    async ensure(): Promise<string | null> {
        if (!this.manifest) {
            this.outputChannel.appendLine("[OnnxAddon] No onnxruntime-node entry in release-manifest.json — skipping.");
            return null;
        }

        const info = this.getPlatformInfo();

        if (!info.supported) {
            this.outputChannel.appendLine(
                `[OnnxAddon] Platform ${info.platform}-${info.arch} not supported for ONNX Runtime.`
            );
            return null;
        }

        // Check cache — look for extracted package.json as marker
        const markerFile = path.join(info.cacheDir, "onnxruntime-node", "package.json");
        if (fs.existsSync(markerFile)) {
            this.outputChannel.appendLine(`[OnnxAddon] Cache hit: ${info.cacheDir}`);
            return path.join(info.cacheDir, "onnxruntime-node");
        }

        // Download and extract
        return this.downloadWithProgress(info);
    }

    /**
     * Get cached path without downloading.
     */
    getCachedPath(): string | null {
        if (!this.manifest) { return null; }
        const info = this.getPlatformInfo();
        const markerFile = path.join(info.cacheDir, "onnxruntime-node", "package.json");
        if (fs.existsSync(markerFile)) {
            return path.join(info.cacheDir, "onnxruntime-node");
        }
        return null;
    }

    /**
     * Force re-download.
     */
    async redownload(): Promise<string | null> {
        if (!this.manifest) { return null; }
        const info = this.getPlatformInfo();

        // Remove cached directory
        if (fs.existsSync(info.cacheDir)) {
            fs.rmSync(info.cacheDir, { recursive: true, force: true });
        }

        return this.downloadWithProgress(info);
    }

    /**
     * Get platform info for diagnostics.
     */
    getPlatformInfo(): OnnxPlatformInfo {
        const platform = process.platform;
        const arch = process.arch;
        const version = this.manifest?.["onnxruntime-node"]?.version ?? "unknown";
        const binaries = this.manifest?.["onnxruntime-node"]?.binaries ?? {};

        const cacheKey = `${platform}-${arch}`;
        const supported = cacheKey in binaries;

        const cacheDir = path.join(
            this.globalStoragePath,
            "native-addons",
            "onnxruntime-node",
            `v${version}`,
            cacheKey
        );

        return { platform, arch, supported, cacheKey, cacheDir };
    }

    // ─── Private Methods ─────────────────────────────────────────────────────

    private loadManifest(): OnnxReleaseManifest | null {
        const manifestPath = path.join(this.extensionPath, "resources", "release-manifest.json");
        if (!fs.existsSync(manifestPath)) {
            return null;
        }
        const data = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        if (!data["onnxruntime-node"]) {
            return null;
        }
        return data as OnnxReleaseManifest;
    }

    private async downloadWithProgress(info: OnnxPlatformInfo): Promise<string | null> {
        const entry = this.manifest!["onnxruntime-node"].binaries[info.cacheKey];
        if (!entry) {
            return null;
        }

        // Ensure cache directory exists
        if (!fs.existsSync(info.cacheDir)) {
            fs.mkdirSync(info.cacheDir, { recursive: true });
        }

        const tarPath = path.join(info.cacheDir, "onnxruntime.tar.gz");

        this.outputChannel.appendLine(`[OnnxAddon] Downloading: ${entry.url}`);
        this.outputChannel.appendLine(`[OnnxAddon] Target: ${info.cacheDir}`);
        this.outputChannel.appendLine(`[OnnxAddon] Expected size: ${(entry.size / 1024 / 1024).toFixed(1)} MB`);

        return vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Kiro SDLC: Downloading ONNX Runtime...",
                cancellable: true,
            },
            async (progress, token) => {
                const maxAttempts = 3;
                const backoffs = [0, 2000, 4000];

                for (let attempt = 0; attempt < maxAttempts; attempt++) {
                    if (token.isCancellationRequested) {
                        vscode.window.showInformationMessage(
                            "ONNX Runtime download cancelled. Embedding features will be disabled."
                        );
                        return null;
                    }

                    if (attempt > 0) {
                        this.outputChannel.appendLine(`[OnnxAddon] Retry ${attempt + 1}/${maxAttempts}...`);
                        progress.report({ message: `Retrying (${attempt + 1}/${maxAttempts})...` });
                        await this.sleep(backoffs[attempt]);
                    }

                    try {
                        // Download tar.gz
                        await this.downloadFile(entry.url, tarPath, entry.size, progress, token);

                        // Verify checksum
                        progress.report({ message: "Verifying integrity..." });
                        const hash = await this.computeSha256(tarPath);

                        if (hash !== entry.sha256) {
                            this.outputChannel.appendLine(
                                `[OnnxAddon] Checksum mismatch: expected ${entry.sha256.substring(0, 16)}..., got ${hash.substring(0, 16)}...`
                            );
                            if (fs.existsSync(tarPath)) { fs.unlinkSync(tarPath); }
                            continue;
                        }

                        // Extract tar.gz
                        progress.report({ message: "Extracting..." });
                        await this.extractTarGz(tarPath, info.cacheDir);

                        // Clean up tar.gz
                        if (fs.existsSync(tarPath)) { fs.unlinkSync(tarPath); }

                        // Verify extraction
                        const markerFile = path.join(info.cacheDir, "onnxruntime-node", "package.json");
                        if (!fs.existsSync(markerFile)) {
                            this.outputChannel.appendLine("[OnnxAddon] Extraction failed — marker file not found.");
                            continue;
                        }

                        this.outputChannel.appendLine(`[OnnxAddon] ✅ Downloaded and extracted: ${info.cacheDir}`);
                        return path.join(info.cacheDir, "onnxruntime-node");
                    } catch (err: any) {
                        this.outputChannel.appendLine(`[OnnxAddon] Attempt ${attempt + 1} failed: ${err.message}`);
                        if (fs.existsSync(tarPath)) {
                            try { fs.unlinkSync(tarPath); } catch { /* ignore */ }
                        }
                    }
                }

                // All attempts failed
                this.outputChannel.appendLine("[OnnxAddon] ❌ All download attempts failed.");
                vscode.window.showWarningMessage(
                    "Failed to download ONNX Runtime. Embedding/graph features will be disabled.",
                    "Retry",
                    "Manual Download"
                ).then((action) => {
                    if (action === "Retry") {
                        this.redownload();
                    } else if (action === "Manual Download") {
                        const url = this.manifest!["onnxruntime-node"].releaseUrl;
                        vscode.env.openExternal(vscode.Uri.parse(url));
                    }
                });
                return null;
            }
        );
    }

    private downloadFile(
        url: string,
        target: string,
        expectedSize: number,
        progress: vscode.Progress<{ message?: string; increment?: number }>,
        token: vscode.CancellationToken,
        maxRedirects = 10
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            if (maxRedirects <= 0) {
                reject(new Error("Too many redirects"));
                return;
            }
            if (token.isCancellationRequested) {
                reject(new Error("Cancelled"));
                return;
            }

            const parsedUrl = new URL(url);
            const client = parsedUrl.protocol === "https:" ? https : http;

            const options: https.RequestOptions = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.pathname + parsedUrl.search,
                timeout: 120000,
                headers: { "User-Agent": "kiro-sdlc-agents/1.0" },
            };

            const req = client.get(options, (res) => {
                const status = res.statusCode ?? 0;

                if (status >= 300 && status < 400 && res.headers.location) {
                    res.resume();
                    this.downloadFile(res.headers.location, target, expectedSize, progress, token, maxRedirects - 1)
                        .then(resolve)
                        .catch(reject);
                    return;
                }

                if (status !== 200) {
                    res.resume();
                    reject(new Error(`HTTP ${status} from ${parsedUrl.hostname}`));
                    return;
                }

                const totalBytes = parseInt(res.headers["content-length"] || String(expectedSize), 10);
                let downloadedBytes = 0;
                let lastReportedPercent = 0;

                const file = fs.createWriteStream(target);

                res.on("data", (chunk: Buffer) => {
                    downloadedBytes += chunk.length;
                    const percent = Math.floor((downloadedBytes / totalBytes) * 100);
                    if (percent > lastReportedPercent) {
                        const mb = (downloadedBytes / 1024 / 1024).toFixed(1);
                        const totalMb = (totalBytes / 1024 / 1024).toFixed(1);
                        progress.report({
                            message: `ONNX Runtime: ${mb} MB / ${totalMb} MB (${percent}%)`,
                            increment: percent - lastReportedPercent,
                        });
                        lastReportedPercent = percent;
                    }
                });

                res.pipe(file);

                file.on("finish", () => {
                    file.close();
                    resolve();
                });

                file.on("error", (err) => {
                    file.close();
                    if (fs.existsSync(target)) { fs.unlinkSync(target); }
                    reject(err);
                });

                token.onCancellationRequested(() => {
                    req.destroy();
                    file.close();
                    if (fs.existsSync(target)) { fs.unlinkSync(target); }
                    reject(new Error("Cancelled"));
                });
            });

            req.on("timeout", () => {
                req.destroy();
                reject(new Error("Download timed out (120s)"));
            });

            req.on("error", (err) => {
                if (fs.existsSync(target)) {
                    try { fs.unlinkSync(target); } catch { /* ignore */ }
                }
                reject(err);
            });
        });
    }

    /**
     * Extract a .tar.gz archive to target directory.
     * Uses Node.js built-in zlib + minimal tar parsing.
     */
    private extractTarGz(archivePath: string, targetDir: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const input = fs.createReadStream(archivePath);
            const gunzip = zlib.createGunzip();
            const chunks: Buffer[] = [];

            input.pipe(gunzip);

            gunzip.on("data", (chunk: Buffer) => chunks.push(chunk));
            gunzip.on("error", reject);
            gunzip.on("end", () => {
                try {
                    const tarData = Buffer.concat(chunks);
                    this.parseTar(tarData, targetDir);
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        });
    }

    /**
     * Minimal tar parser — extracts files from uncompressed tar buffer.
     * Supports regular files and directories (types '0', '5', and '\0').
     */
    private parseTar(data: Buffer, targetDir: string): void {
        let offset = 0;
        const BLOCK_SIZE = 512;

        while (offset < data.length - BLOCK_SIZE) {
            const header = data.subarray(offset, offset + BLOCK_SIZE);

            // Check for end-of-archive (two zero blocks)
            if (header.every(b => b === 0)) {
                break;
            }

            // Extract filename (bytes 0-99)
            let fileName = header.subarray(0, 100).toString("utf-8").replace(/\0/g, "");

            // Check for prefix (bytes 345-499) — POSIX ustar format
            const prefix = header.subarray(345, 500).toString("utf-8").replace(/\0/g, "");
            if (prefix) {
                fileName = prefix + "/" + fileName;
            }

            // Strip leading ./ if present
            if (fileName.startsWith("./")) {
                fileName = fileName.substring(2);
            }

            // File size (bytes 124-135, octal)
            const sizeStr = header.subarray(124, 136).toString("utf-8").replace(/\0/g, "").trim();
            const fileSize = parseInt(sizeStr, 8) || 0;

            // File type (byte 156)
            const typeFlag = String.fromCharCode(header[156]);

            offset += BLOCK_SIZE;

            const fullPath = path.join(targetDir, fileName);

            // Security: prevent path traversal
            if (!fullPath.startsWith(targetDir)) {
                offset += Math.ceil(fileSize / BLOCK_SIZE) * BLOCK_SIZE;
                continue;
            }

            if (typeFlag === "5" || fileName.endsWith("/")) {
                if (!fs.existsSync(fullPath)) {
                    fs.mkdirSync(fullPath, { recursive: true });
                }
            } else if (typeFlag === "0" || typeFlag === "\0") {
                const dir = path.dirname(fullPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                const fileData = data.subarray(offset, offset + fileSize);
                fs.writeFileSync(fullPath, fileData);
            }

            // Advance past file data (rounded up to block boundary)
            offset += Math.ceil(fileSize / BLOCK_SIZE) * BLOCK_SIZE;
        }
    }

    private computeSha256(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash("sha256");
            const stream = fs.createReadStream(filePath);
            stream.on("data", (chunk) => hash.update(chunk));
            stream.on("end", () => resolve(hash.digest("hex")));
            stream.on("error", reject);
        });
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
