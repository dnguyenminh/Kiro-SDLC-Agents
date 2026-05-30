"use strict";
/**
 * OnnxBootstrap — Self-downloads prebuilt onnxruntime-node binaries when running standalone.
 * Compiled from mcp-code-intelligence-nodejs/src/memory/embedding/onnx-bootstrap.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureOnnxRuntime = ensureOnnxRuntime;
exports.getCachedOnnxPath = getCachedOnnxPath;

const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");
const http = require("http");
const crypto = require("crypto");
const zlib = require("zlib");

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

async function ensureOnnxRuntime() {
    const envPath = process.env.ONNX_RUNTIME_PATH;
    if (envPath && fs.existsSync(path.join(envPath, 'package.json'))) {
        log(`Using ONNX_RUNTIME_PATH from env: ${envPath}`);
        return envPath;
    }
    const cacheDir = getCacheDir();
    const cachedPath = path.join(cacheDir, 'onnxruntime-node');
    const markerFile = path.join(cachedPath, 'package.json');
    if (fs.existsSync(markerFile)) {
        log(`Cache hit: ${cachedPath}`);
        process.env.ONNX_RUNTIME_PATH = cachedPath;
        return cachedPath;
    }
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

function getCacheDir() {
    const version = DEFAULT_MANIFEST.version;
    const platformKey = `${process.platform}-${process.arch}`;
    return path.join(os.homedir(), '.code-intel', 'native-addons', 'onnxruntime-node', `v${version}`, platformKey);
}

async function downloadAndExtract(entry, cacheDir) {
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }
    const tarPath = path.join(cacheDir, 'onnxruntime.tar.gz');
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await downloadFile(entry.url, tarPath);
            const hash = await computeSha256(tarPath);
            if (hash !== entry.sha256) {
                log(`Checksum mismatch (attempt ${attempt}): expected ${entry.sha256.substring(0, 16)}..., got ${hash.substring(0, 16)}...`);
                cleanup(tarPath);
                if (attempt < maxAttempts) { await sleep(2000 * attempt); continue; }
                return null;
            }
            await extractTarGz(tarPath, cacheDir);
            cleanup(tarPath);
            const resultPath = path.join(cacheDir, 'onnxruntime-node');
            if (!fs.existsSync(path.join(resultPath, 'package.json'))) {
                log(`Extraction failed — marker file not found (attempt ${attempt}).`);
                if (attempt < maxAttempts) { await sleep(2000 * attempt); continue; }
                return null;
            }
            return resultPath;
        }
        catch (err) {
            log(`Attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
            cleanup(tarPath);
            if (attempt < maxAttempts) { await sleep(2000 * attempt); }
        }
    }
    return null;
}

function downloadFile(url, target, maxRedirects = 10) {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) { reject(new Error('Too many redirects')); return; }
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
            if (status >= 300 && status < 400 && res.headers.location) {
                res.resume();
                downloadFile(res.headers.location, target, maxRedirects - 1).then(resolve).catch(reject);
                return;
            }
            if (status !== 200) { res.resume(); reject(new Error(`HTTP ${status} from ${parsedUrl.hostname}`)); return; }
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
            file.on('finish', () => { file.close(); resolve(); });
            file.on('error', (err) => { file.close(); cleanup(target); reject(err); });
        });
        req.on('timeout', () => { req.destroy(); reject(new Error('Download timed out (120s)')); });
        req.on('error', (err) => { cleanup(target); reject(err); });
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
            catch (err) { reject(err); }
        });
    });
}

function parseTar(data, targetDir) {
    let offset = 0;
    const BLOCK_SIZE = 512;
    while (offset < data.length - BLOCK_SIZE) {
        const header = data.subarray(offset, offset + BLOCK_SIZE);
        if (header.every(b => b === 0)) break;
        let fileName = header.subarray(0, 100).toString('utf-8').replace(/\0/g, '');
        const prefix = header.subarray(345, 500).toString('utf-8').replace(/\0/g, '');
        if (prefix) fileName = prefix + '/' + fileName;
        if (fileName.startsWith('./')) fileName = fileName.substring(2);
        const sizeStr = header.subarray(124, 136).toString('utf-8').replace(/\0/g, '').trim();
        const fileSize = parseInt(sizeStr, 8) || 0;
        const typeFlag = String.fromCharCode(header[156]);
        offset += BLOCK_SIZE;
        const fullPath = path.join(targetDir, fileName);
        if (!fullPath.startsWith(targetDir)) { offset += Math.ceil(fileSize / BLOCK_SIZE) * BLOCK_SIZE; continue; }
        if (typeFlag === '5' || fileName.endsWith('/')) {
            if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
        }
        else if (typeFlag === '0' || typeFlag === '\0') {
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch { /* ignore */ }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(msg) {
    process.stderr.write(`[onnx-bootstrap] ${msg}\n`);
}
//# sourceMappingURL=onnx-bootstrap.js.map
