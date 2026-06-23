"use strict";
/**
 * OnnxBootstrap — Self-downloads prebuilt onnxruntime-node binaries when running standalone.
 *
 * When the MCP server is spawned by the Kiro extension, ONNX_RUNTIME_PATH is injected via env.
 * When running standalone (e.g. via `npx mcp-code-intelligence`), this module handles:
 *   1. Check if ONNX_RUNTIME_PATH is already set → use it
 *   2. Check local cache (~/.code-intel/native-addons/onnxruntime-node/...) → use if exists
 *   3. Download from GitHub Release → extract → cache → set path
 *
 * Uses the same release manifest format as the extension's OnnxAddonManager.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureOnnxRuntime = ensureOnnxRuntime;
exports.getCachedOnnxPath = getCachedOnnxPath;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const crypto = __importStar(require("crypto"));
const zlib = __importStar(require("zlib"));
// ─── Default Manifest (embedded for standalone use) ──────────────────────────
const DEFAULT_MANIFEST = {
    version: '1.22.0',
    releaseUrl: 'https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/tag/onnxruntime-node-v1.22.0',
    binaries: {
        'win32-x64': {
            url: 'https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/download/onnxruntime-node-v1.22.0/onnxruntime-node-v1.22.0-win32-x64.tar.gz',
            sha256: '235f2a5021269bb120aa800bc6eb7fbc9e4c947617883313af37128eefae61e3',
            size: 91804177,
        },
        'linux-x64': {
            url: 'https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/download/onnxruntime-node-v1.22.0/onnxruntime-node-v1.22.0-linux-x64.tar.gz',
            sha256: '96f36de42f5939353868f72e10f45e611786be87fec4b9acf9a945e3d2be771f',
            size: 91809078,
        },
        'darwin-x64': {
            url: 'https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/download/onnxruntime-node-v1.22.0/onnxruntime-node-v1.22.0-darwin-x64.tar.gz',
            sha256: 'efcee4bd022abda8af6510d184ae37b2730eff2a65c3e00c598e01c7da61bb96',
            size: 91766237,
        },
        'darwin-arm64': {
            url: 'https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/download/onnxruntime-node-v1.22.0/onnxruntime-node-v1.22.0-darwin-arm64.tar.gz',
            sha256: '1207850febcc02cf62578c4405a086d7d9967203f1e9b574919fd15d75006a12',
            size: 91766233,
        },
    },
};
// ─── Public API ──────────────────────────────────────────────────────────────
/**
 * Ensure onnxruntime-node is available. Returns the path to the onnxruntime-node directory.
 * Sets process.env.ONNX_RUNTIME_PATH as side effect.
 *
 * Priority:
 * 1. ONNX_RUNTIME_PATH env var (set by extension)
 * 2. Local cache
 * 3. Auto-download from GitHub Release
 *
 * @returns Path to onnxruntime-node directory, or null if unavailable.
 */
async function ensureOnnxRuntime() {
    // Priority 1: Already set by extension
    const envPath = process.env.ONNX_RUNTIME_PATH;
    if (envPath && fs.existsSync(path.join(envPath, 'package.json'))) {
        log(`Using ONNX_RUNTIME_PATH from env: ${envPath}`);
        return envPath;
    }
    // Priority 2: Check local cache
    const cacheDir = getCacheDir();
    const cachedPath = path.join(cacheDir, 'onnxruntime-node');
    const markerFile = path.join(cachedPath, 'package.json');
    if (fs.existsSync(markerFile)) {
        log(`Cache hit: ${cachedPath}`);
        process.env.ONNX_RUNTIME_PATH = cachedPath;
        return cachedPath;
    }
    // Priority 3: Download
    const platformKey = `${process.platform}-${process.arch}`;
    const entry = DEFAULT_MANIFEST.binaries[platformKey];
    if (!entry) {
        log(`Platform ${platformKey} not supported for ONNX Runtime prebuilt.`);
        return null;
    }
    log(`Downloading ONNX Runtime for ${platformKey} (${(entry.size / 1024 / 1024).toFixed(0)} MB)...`);
    try {
        const result = await downloadAndExtract(entry, cacheDir);
        if (result) {
            process.env.ONNX_RUNTIME_PATH = result;
            log(`✅ ONNX Runtime ready: ${result}`);
        }
        return result;
    }
    catch (err) {
        log(`❌ Download failed: ${err.message}`);
        return null;
    }
}
/**
 * Get the cached ONNX Runtime path without downloading.
 */
function getCachedOnnxPath() {
    const envPath = process.env.ONNX_RUNTIME_PATH;
    if (envPath && fs.existsSync(path.join(envPath, 'package.json'))) {
        return envPath;
    }
    const cachedPath = path.join(getCacheDir(), 'onnxruntime-node');
    if (fs.existsSync(path.join(cachedPath, 'package.json'))) {
        return cachedPath;
    }
    return null;
}
// ─── Private Implementation ──────────────────────────────────────────────────
function getCacheDir() {
    const version = DEFAULT_MANIFEST.version;
    const platformKey = `${process.platform}-${process.arch}`;
    return path.join(os.homedir(), '.code-intel', 'native-addons', 'onnxruntime-node', `v${version}`, platformKey);
}
async function downloadAndExtract(entry, cacheDir) {
    // Ensure cache directory
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }
    const tarPath = path.join(cacheDir, 'onnxruntime.tar.gz');
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            // Download
            await downloadFile(entry.url, tarPath);
            // Verify SHA-256
            const hash = await computeSha256(tarPath);
            if (hash !== entry.sha256) {
                log(`Checksum mismatch (attempt ${attempt}): expected ${entry.sha256.substring(0, 16)}..., got ${hash.substring(0, 16)}...`);
                cleanup(tarPath);
                if (attempt < maxAttempts) {
                    await sleep(2000 * attempt);
                    continue;
                }
                return null;
            }
            // Extract
            await extractTarGz(tarPath, cacheDir);
            cleanup(tarPath);
            // Verify extraction
            const resultPath = path.join(cacheDir, 'onnxruntime-node');
            if (!fs.existsSync(path.join(resultPath, 'package.json'))) {
                log(`Extraction failed — marker file not found (attempt ${attempt}).`);
                if (attempt < maxAttempts) {
                    await sleep(2000 * attempt);
                    continue;
                }
                return null;
            }
            return resultPath;
        }
        catch (err) {
            log(`Attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
            cleanup(tarPath);
            if (attempt < maxAttempts) {
                await sleep(2000 * attempt);
            }
        }
    }
    return null;
}
function downloadFile(url, target, maxRedirects = 10) {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) {
            reject(new Error('Too many redirects'));
            return;
        }
        const parsedUrl = new URL(url);
        const client = parsedUrl.protocol === 'https:' ? https : http;
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            timeout: 120000,
            headers: { 'User-Agent': 'mcp-code-intelligence/1.0' },
        };
        const req = client.get(options, (res) => {
            const status = res.statusCode ?? 0;
            // Handle redirects (GitHub returns 302 to CDN)
            if (status >= 300 && status < 400 && res.headers.location) {
                res.resume();
                downloadFile(res.headers.location, target, maxRedirects - 1)
                    .then(resolve)
                    .catch(reject);
                return;
            }
            if (status !== 200) {
                res.resume();
                reject(new Error(`HTTP ${status} from ${parsedUrl.hostname}`));
                return;
            }
            const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
            let downloadedBytes = 0;
            let lastLoggedPercent = 0;
            const file = fs.createWriteStream(target);
            res.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                if (totalBytes > 0) {
                    const percent = Math.floor((downloadedBytes / totalBytes) * 100);
                    if (percent >= lastLoggedPercent + 20) {
                        log(`  ${(downloadedBytes / 1024 / 1024).toFixed(1)} MB / ${(totalBytes / 1024 / 1024).toFixed(1)} MB (${percent}%)`);
                        lastLoggedPercent = percent;
                    }
                }
            });
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
            file.on('error', (err) => {
                file.close();
                cleanup(target);
                reject(err);
            });
        });
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Download timed out (120s)'));
        });
        req.on('error', (err) => {
            cleanup(target);
            reject(err);
        });
    });
}
function extractTarGz(archivePath, targetDir) {
    return new Promise((resolve, reject) => {
        const input = fs.createReadStream(archivePath);
        const gunzip = zlib.createGunzip();
        const chunks = [];
        input.pipe(gunzip);
        gunzip.on('data', (chunk) => chunks.push(chunk));
        gunzip.on('error', reject);
        gunzip.on('end', () => {
            try {
                const tarData = Buffer.concat(chunks);
                parseTar(tarData, targetDir);
                resolve();
            }
            catch (err) {
                reject(err);
            }
        });
    });
}
/**
 * Minimal tar parser — extracts files from uncompressed tar buffer.
 */
function parseTar(data, targetDir) {
    let offset = 0;
    const BLOCK_SIZE = 512;
    while (offset < data.length - BLOCK_SIZE) {
        const header = data.subarray(offset, offset + BLOCK_SIZE);
        // End-of-archive (two zero blocks)
        if (header.every(b => b === 0))
            break;
        // Filename (bytes 0-99)
        let fileName = header.subarray(0, 100).toString('utf-8').replace(/\0/g, '');
        // Prefix (bytes 345-499) — POSIX ustar
        const prefix = header.subarray(345, 500).toString('utf-8').replace(/\0/g, '');
        if (prefix)
            fileName = prefix + '/' + fileName;
        // Strip leading ./
        if (fileName.startsWith('./'))
            fileName = fileName.substring(2);
        // File size (bytes 124-135, octal)
        const sizeStr = header.subarray(124, 136).toString('utf-8').replace(/\0/g, '').trim();
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
        if (typeFlag === '5' || fileName.endsWith('/')) {
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }
        }
        else if (typeFlag === '0' || typeFlag === '\0') {
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const fileData = data.subarray(offset, offset + fileSize);
            fs.writeFileSync(fullPath, fileData);
        }
        offset += Math.ceil(fileSize / BLOCK_SIZE) * BLOCK_SIZE;
    }
}
function computeSha256(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}
function cleanup(filePath) {
    try {
        if (fs.existsSync(filePath))
            fs.unlinkSync(filePath);
    }
    catch { /* ignore */ }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function log(msg) {
    process.stderr.write(`[onnx-bootstrap] ${msg}\n`);
}
//# sourceMappingURL=onnx-bootstrap.js.map