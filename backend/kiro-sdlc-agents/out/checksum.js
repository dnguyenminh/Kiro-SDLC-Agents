"use strict";
/**
 * Checksum management — tracks per-file version and detects modifications.
 * Workspace manifest stores version of each injected file individually.
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
exports.computeFileHash = computeFileHash;
exports.loadBundledManifest = loadBundledManifest;
exports.loadWorkspaceManifest = loadWorkspaceManifest;
exports.saveWorkspaceManifest = saveWorkspaceManifest;
exports.getFileStatuses = getFileStatuses;
exports.detectModifiedFiles = detectModifiedFiles;
exports.isUpgradeAvailable = isUpgradeAvailable;
exports.migrateLegacyVersion = migrateLegacyVersion;
exports.buildManifestAfterInject = buildManifestAfterInject;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const WORKSPACE_MANIFEST = ".kiro/.sdlc-manifest.json";
const LEGACY_VERSION_FILE = ".kiro/.sdlc-version";
const BUNDLED_MANIFEST = "resources/.sdlc-checksums.json";
/** Compute SHA-256 hash of a file's content. */
function computeFileHash(filePath) {
    const content = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(content).digest("hex");
}
/** Load bundled checksums manifest from extension package. */
function loadBundledManifest(extensionPath) {
    const manifestFile = path.join(extensionPath, BUNDLED_MANIFEST);
    if (!fs.existsSync(manifestFile)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(manifestFile, "utf-8"));
    }
    catch {
        return null;
    }
}
/** Load per-file workspace manifest. */
function loadWorkspaceManifest(root) {
    const manifestFile = path.join(root, WORKSPACE_MANIFEST);
    if (!fs.existsSync(manifestFile)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(manifestFile, "utf-8"));
    }
    catch {
        return null;
    }
}
/** Save workspace manifest to disk. */
function saveWorkspaceManifest(root, manifest) {
    const manifestFile = path.join(root, WORKSPACE_MANIFEST);
    fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
    manifest.lastUpdated = new Date().toISOString();
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), "utf-8");
}
/** Get per-file status comparing workspace vs bundled manifest. */
function getFileStatuses(root, extensionPath) {
    const bundled = loadBundledManifest(extensionPath);
    if (!bundled) {
        return [];
    }
    const wsManifest = loadWorkspaceManifest(root);
    const statuses = [];
    for (const [relativePath, entry] of Object.entries(bundled.files)) {
        const fullPath = path.join(root, relativePath);
        const wsEntry = wsManifest?.files[relativePath];
        const wsVersion = wsEntry?.version || "0.0.0";
        if (!fs.existsSync(fullPath)) {
            statuses.push({ relativePath, workspaceVersion: wsVersion, bundledVersion: entry.version, state: "missing" });
            continue;
        }
        if (wsVersion !== entry.version) {
            statuses.push({ relativePath, workspaceVersion: wsVersion, bundledVersion: entry.version, state: "outdated" });
        }
        else {
            const currentHash = computeFileHash(fullPath);
            if (currentHash !== entry.hash) {
                statuses.push({ relativePath, workspaceVersion: wsVersion, bundledVersion: entry.version, state: "modified" });
            }
            else {
                statuses.push({ relativePath, workspaceVersion: wsVersion, bundledVersion: entry.version, state: "current" });
            }
        }
    }
    return statuses;
}
/** Detect files whose hash differs from bundled (for update prompts). */
function detectModifiedFiles(root, extensionPath) {
    const bundled = loadBundledManifest(extensionPath);
    if (!bundled) {
        return [];
    }
    const modified = [];
    for (const [relativePath, entry] of Object.entries(bundled.files)) {
        const fullPath = path.join(root, relativePath);
        if (!fs.existsSync(fullPath)) {
            continue;
        }
        const currentHash = computeFileHash(fullPath);
        if (currentHash !== entry.hash) {
            modified.push({
                relativePath,
                expectedHash: entry.hash,
                actualHash: currentHash,
                injectedVersion: entry.version
            });
        }
    }
    return modified;
}
/** Check if any bundled file is newer than workspace version. */
function isUpgradeAvailable(root, extensionPath) {
    const bundled = loadBundledManifest(extensionPath);
    if (!bundled) {
        return false;
    }
    const wsManifest = loadWorkspaceManifest(root);
    if (!wsManifest) {
        return true;
    }
    for (const [relativePath, entry] of Object.entries(bundled.files)) {
        const wsEntry = wsManifest.files[relativePath];
        if (!wsEntry || wsEntry.version !== entry.version) {
            return true;
        }
    }
    return false;
}
/** Migrate from legacy .sdlc-version to new per-file manifest. */
function migrateLegacyVersion(root, extensionPath) {
    const legacyFile = path.join(root, LEGACY_VERSION_FILE);
    if (!fs.existsSync(legacyFile)) {
        return;
    }
    const bundled = loadBundledManifest(extensionPath);
    if (!bundled) {
        return;
    }
    let legacyVersion = "1.0.0";
    try {
        const raw = JSON.parse(fs.readFileSync(legacyFile, "utf-8"));
        legacyVersion = raw.version || "1.0.0";
    }
    catch { /* default to 1.0.0 */ }
    const wsManifest = { lastUpdated: new Date().toISOString(), files: {} };
    for (const [relativePath] of Object.entries(bundled.files)) {
        const fullPath = path.join(root, relativePath);
        if (fs.existsSync(fullPath)) {
            wsManifest.files[relativePath] = {
                version: legacyVersion,
                hash: computeFileHash(fullPath),
                injectedAt: new Date().toISOString()
            };
        }
    }
    saveWorkspaceManifest(root, wsManifest);
    fs.unlinkSync(legacyFile);
}
/** Build workspace manifest after a full inject. */
function buildManifestAfterInject(root, extensionPath) {
    const bundled = loadBundledManifest(extensionPath);
    if (!bundled) {
        return;
    }
    const wsManifest = { lastUpdated: new Date().toISOString(), files: {} };
    for (const [relativePath, entry] of Object.entries(bundled.files)) {
        const fullPath = path.join(root, relativePath);
        if (fs.existsSync(fullPath)) {
            wsManifest.files[relativePath] = {
                version: entry.version,
                hash: computeFileHash(fullPath),
                injectedAt: new Date().toISOString()
            };
        }
    }
    saveWorkspaceManifest(root, wsManifest);
}
//# sourceMappingURL=checksum.js.map