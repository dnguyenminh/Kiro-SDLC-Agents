import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import * as crypto from "crypto";
import { execSync } from "child_process";

interface NativeAddonManifestEntry {
    url: string;
    size: number;
    sha256: string;
}

interface NativeAddonManifest {
    "better-sqlite3": {
        version: string;
        releaseUrl: string;
        binaries: Record<string, NativeAddonManifestEntry>;
    };
}

interface PlatformInfo {
    platform: string;
    arch: string;
    napiVersion: string;
    nodeMajorVersion: string;
    electronVersion: string;
    supported: boolean;
    cacheKey: string;
    cacheDir: string;
}

export class NativeAddonManager {
    private readonly globalStoragePath: string;
    private readonly extensionPath: string;
    private readonly outputChannel: vscode.OutputChannel;
    private readonly manifest: NativeAddonManifest;

    constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        this.globalStoragePath = context.globalStorageUri.fsPath;
        this.extensionPath = context.extensionPath;
        this.outputChannel = outputChannel;
        this.manifest = this.loadManifest();
    }

    /**
     * Ensure native addon is available. Downloads if not cached.
     * @returns Path to the .node file, or null if unavailable.
     */
    public async ensure(): Promise<string | null> {
        const info = this.getPlatformInfo();
        if (!info.supported) {
            this.showUnsupportedError(info);
            return null;
        }

        const bindingPath = path.join(info.cacheDir, "better_sqlite3.node");
        if (fs.existsSync(bindingPath)) {
            const stat = fs.statSync(bindingPath);
            if (stat.size > 0) {
                this.outputChannel.appendLine(`[NativeAddon] Cache hit: ${bindingPath} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
                return bindingPath;
            }
            fs.unlinkSync(bindingPath);
        }

        return this.downloadWithProgress(info);
    }

    /**
     * Get cached path without downloading.
     */
    public getCachedPath(): string | null {
        const info = this.getPlatformInfo();
        const bindingPath = path.join(info.cacheDir, "better_sqlite3.node");
        if (fs.existsSync(bindingPath) && fs.statSync(bindingPath).size > 0) {
            return bindingPath;
        }
        return null;
    }

    /**
     * Force re-download (after corruption detected).
     */
    public async redownload(): Promise<string | null> {
        const info = this.getPlatformInfo();
        const bindingPath = path.join(info.cacheDir, "better_sqlite3.node");
        if (fs.existsSync(bindingPath)) {
            fs.unlinkSync(bindingPath);
        }
        return this.downloadWithProgress(info);
    }

    public getPlatformInfo(): PlatformInfo {
        const platform = process.platform;
        const arch = process.arch;
        const napiVersion = process.versions.napi || "9";
        const nodeMajorVersion = this.getSystemNodeMajorVersion();
        const electronVersion = process.versions.electron || "unknown";
        const version = this.manifest["better-sqlite3"].version;
        const binaries = this.manifest["better-sqlite3"].binaries;

        let cacheKey = `node-v${nodeMajorVersion}-${platform}-${arch}`;
        let supported = cacheKey in binaries;

        if (!supported) {
            const runtimeMajor = parseInt(nodeMajorVersion, 10);
            const nodeCandidates = Object.keys(binaries)
                .filter(k => k.startsWith("node-v") && k.endsWith(`-${platform}-${arch}`))
                .map(k => ({ key: k, major: parseInt(k.match(/node-v(\d+)/)?.[1] || "0", 10) }))
                .filter(c => c.major <= runtimeMajor)
                .sort((a, b) => b.major - a.major);
            if (nodeCandidates.length > 0) {
                cacheKey = nodeCandidates[0].key;
                supported = true;
                this.outputChannel.appendLine(`[NativeAddon] Node v${nodeMajorVersion}, using compatible binary: ${cacheKey}`);
            }
        }

        if (!supported) {
            const runtimeNapi = parseInt(napiVersion, 10);
            const legacyCandidates = Object.keys(binaries)
                .filter(k => k.startsWith("napi-v") && k.endsWith(`-${platform}-${arch}`))
                .map(k => ({ key: k, napi: parseInt(k.match(/napi-v(\d+)/)?.[1] || "0", 10) }))
                .filter(c => c.napi <= runtimeNapi)
                .sort((a, b) => b.napi - a.napi);
            if (legacyCandidates.length > 0) {
                cacheKey = legacyCandidates[0].key;
                supported = true;
                this.outputChannel.appendLine(`[NativeAddon] Legacy fallback — N-API v${napiVersion}, using: ${cacheKey}`);
            }
        }

        const cacheDir = path.join(this.globalStoragePath, "native-addons", "better-sqlite3", `v${version}`, cacheKey);
        return { platform, arch, napiVersion, nodeMajorVersion, electronVersion, supported, cacheKey, cacheDir };
    }

    private loadManifest(): NativeAddonManifest {
        const manifestPath = path.join(this.extensionPath, "resources", "release-manifest.json");
        if (!fs.existsSync(manifestPath)) {
            throw new Error(`Release manifest not found: ${manifestPath}`);
        }
        return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    }

    private getSystemNodeMajorVersion(): string {
        try {
            try {
                const moduleVersion = execSync(`"${process.execPath}" -p "process.versions.modules"`, { encoding: "utf-8", timeout: 5000 }).trim();
                const major = this.moduleVersionToNodeMajor(moduleVersion);
                if (major) {
                    this.outputChannel.appendLine(`[NativeAddon] Runtime Node MODULE_VERSION=${moduleVersion} → Node v${major}`);
                    return major;
                }
            }
            catch {
                // Fallback to node --version using process.execPath
            }
            const output = execSync(`"${process.execPath}" --version`, { encoding: "utf-8", timeout: 5000 }).trim();
            const major = output.replace("v", "").split(".")[0];
            this.outputChannel.appendLine(`[NativeAddon] System Node: ${output} (major: ${major})`);
            return major;
        }
        catch {
            const fallback = process.versions.node.split(".")[0];
            this.outputChannel.appendLine(`[NativeAddon] Cannot detect system Node, using host: v${fallback}`);
            return fallback;
        }
    }

    private moduleVersionToNodeMajor(moduleVersion: string): string | null {
        const map: Record<string, string> = {
            "83": "14",
            "93": "16",
            "108": "18",
            "115": "20",
            "127": "22",
            "131": "22",
            "132": "23",
            "135": "24",
            "137": "24",
            "139": "24",
            "141": "25",
        };
        return map[moduleVersion] || null;
    }

    private async downloadWithProgress(info: PlatformInfo): Promise<string | null> {
        const entry = this.manifest["better-sqlite3"].binaries[info.cacheKey];
        if (!entry) {
            this.showUnsupportedError(info);
            return null;
        }

        if (!fs.existsSync(info.cacheDir)) {
            fs.mkdirSync(info.cacheDir, { recursive: true });
        }

        const bindingPath = path.join(info.cacheDir, "better_sqlite3.node");
        this.outputChannel.appendLine(`[NativeAddon] Downloading: ${entry.url}`);
        this.outputChannel.appendLine(`[NativeAddon] Target: ${bindingPath}`);
        this.outputChannel.appendLine(`[NativeAddon] Expected size: ${(entry.size / 1024 / 1024).toFixed(1)} MB`);

        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Kiro SDLC: Downloading native module...",
            cancellable: true,
        }, async (progress, token) => {
            const maxAttempts = 3;
            const backoffs = [0, 2000, 4000];
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                if (token.isCancellationRequested) {
                    vscode.window.showInformationMessage("Native module download cancelled. MCP server will not start. Restart VS Code to retry.");
                    return null;
                }
                if (attempt > 0) {
                    this.outputChannel.appendLine(`[NativeAddon] Retry ${attempt + 1}/${maxAttempts}...`);
                    progress.report({ message: `Retrying (${attempt + 1}/${maxAttempts})...` });
                    await this.sleep(backoffs[attempt]);
                }
                try {
                    await this.downloadFile(entry.url, bindingPath, entry.size, progress, token);
                    progress.report({ message: "Verifying integrity..." });
                    const hash = await this.computeSha256(bindingPath);
                    if (hash !== entry.sha256) {
                        this.outputChannel.appendLine(`[NativeAddon] Checksum mismatch: expected ${entry.sha256.substring(0, 16)}..., got ${hash.substring(0, 16)}...`);
                        if (fs.existsSync(bindingPath)) {
                            fs.unlinkSync(bindingPath);
                        }
                        continue;
                    }
                    this.outputChannel.appendLine(`[NativeAddon] ✅ Downloaded and verified: ${bindingPath}`);
                    return bindingPath;
                }
                catch (err: any) {
                    this.outputChannel.appendLine(`[NativeAddon] Attempt ${attempt + 1} failed: ${err.message}`);
                    if (fs.existsSync(bindingPath)) {
                        try {
                            fs.unlinkSync(bindingPath);
                        }
                        catch { }
                    }
                }
            }
            this.showDownloadError(info);
            return null;
        });
    }

    private downloadFile(url: string, target: string, expectedSize: number, progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken, maxRedirects = 10): Promise<void> {
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
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.pathname + parsedUrl.search,
                timeout: 60000,
                headers: {
                    "User-Agent": "kiro-sdlc-agents/1.0",
                },
            } as https.RequestOptions;
            const proxyUrl = this.getProxyUrl();
            if (proxyUrl) {
                this.outputChannel.appendLine(`[NativeAddon] Using proxy: ${proxyUrl}`);
            }
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
                res.on("data", (chunk) => {
                    downloadedBytes += chunk.length;
                    const percent = Math.floor((downloadedBytes / totalBytes) * 100);
                    if (percent > lastReportedPercent) {
                        const mb = (downloadedBytes / 1024 / 1024).toFixed(1);
                        const totalMb = (totalBytes / 1024 / 1024).toFixed(1);
                        progress.report({ message: `${mb} MB / ${totalMb} MB (${percent}%)`, increment: percent - lastReportedPercent });
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
                    if (fs.existsSync(target)) {
                        fs.unlinkSync(target);
                    }
                    reject(err);
                });
                token.onCancellationRequested(() => {
                    req.destroy();
                    file.close();
                    if (fs.existsSync(target)) {
                        fs.unlinkSync(target);
                    }
                    reject(new Error("Cancelled"));
                });
            });
            req.on("timeout", () => {
                req.destroy();
                reject(new Error("Download timed out (60s)"));
            });
            req.on("error", (err) => {
                if (fs.existsSync(target)) {
                    try {
                        fs.unlinkSync(target);
                    }
                    catch { }
                }
                reject(err);
            });
        });
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

    private getProxyUrl(): string | undefined {
        try {
            const config = vscode.workspace.getConfiguration("http");
            return config.get<string>("proxy") || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
        }
        catch {
            return process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
        }
    }

    private showUnsupportedError(info: PlatformInfo): void {
        const msg = `Platform ${info.platform}-${info.arch} (Node v${info.nodeMajorVersion}, N-API v${info.napiVersion}) is not supported. MCP server cannot start.`;
        this.outputChannel.appendLine(`[NativeAddon] ❌ ${msg}`);
        vscode.window.showErrorMessage(msg, "View Documentation").then((action) => {
            if (action === "View Documentation") {
                vscode.env.openExternal(vscode.Uri.parse(this.manifest["better-sqlite3"].releaseUrl));
            }
        });
    }

    private showDownloadError(info: PlatformInfo): void {
        const releaseUrl = this.manifest["better-sqlite3"].releaseUrl;
        this.outputChannel.appendLine(`[NativeAddon] ❌ All download attempts failed for ${info.cacheKey}`);
        vscode.window.showErrorMessage("Failed to download native module after 3 attempts. MCP server cannot start.", "Retry", "Manual Download").then((action) => {
            if (action === "Retry") {
                this.redownload();
            }
            else if (action === "Manual Download") {
                vscode.env.openExternal(vscode.Uri.parse(releaseUrl));
            }
        });
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
