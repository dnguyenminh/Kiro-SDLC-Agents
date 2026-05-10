/**
 * Checksum management — tracks per-file version and detects modifications.
 * Workspace manifest stores version of each injected file individually.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export interface ChecksumManifest {
    version: string;
    generatedAt: string;
    files: Record<string, FileChecksum>;
}

export interface FileChecksum {
    hash: string;
    version: string;
    injectedAt: string;
}

export interface WorkspaceManifest {
    lastUpdated: string;
    files: Record<string, WorkspaceFileEntry>;
}

export interface WorkspaceFileEntry {
    version: string;
    hash: string;
    injectedAt: string;
}

export interface FileStatus {
    relativePath: string;
    workspaceVersion: string;
    bundledVersion: string;
    state: "current" | "outdated" | "modified" | "missing";
}

export interface ModifiedFile {
    relativePath: string;
    expectedHash: string;
    actualHash: string;
    injectedVersion: string;
}

const WORKSPACE_MANIFEST = ".kiro/.sdlc-manifest.json";
const LEGACY_VERSION_FILE = ".kiro/.sdlc-version";
const BUNDLED_MANIFEST = "resources/.sdlc-checksums.json";

export function computeFileHash(filePath: string): string {
    const content = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(content).digest("hex");
}

export function loadBundledManifest(extensionPath: string): ChecksumManifest | null {
    const manifestFile = path.join(extensionPath, BUNDLED_MANIFEST);
    if (!fs.existsSync(manifestFile)) { return null; }
    try {
        return JSON.parse(fs.readFileSync(manifestFile, "utf-8"));
    } catch {
        return null;
    }
}

export function loadWorkspaceManifest(workspaceRoot: string): WorkspaceManifest | null {
    const manifestFile = path.join(workspaceRoot, WORKSPACE_MANIFEST);
    if (!fs.existsSync(manifestFile)) { return null; }
    try {
        return JSON.parse(fs.readFileSync(manifestFile, "utf-8"));
    } catch {
        return null;
    }
}

export function saveWorkspaceManifest(workspaceRoot: string, manifest: WorkspaceManifest): void {
    const manifestFile = path.join(workspaceRoot, WORKSPACE_MANIFEST);
    fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
    manifest.lastUpdated = new Date().toISOString();
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), "utf-8");
}

/** Record that a file was injected at a specific version. */
export function recordFileInjected(
    manifest: WorkspaceManifest, relativePath: string, version: string, hash: string
): void {
    manifest.files[relativePath] = {
        version,
        hash,
        injectedAt: new Date().toISOString()
    };
}

/** Get per-file status comparing workspace vs bundled manifest. */
export function getFileStatuses(workspaceRoot: string, extensionPath: string): FileStatus[] {
    const bundled = loadBundledManifest(extensionPath);
    if (!bundled) { return []; }
    const wsManifest = loadWorkspaceManifest(workspaceRoot);

    const statuses: FileStatus[] = [];
    for (const [relativePath, entry] of Object.entries(bundled.files)) {
        const fullPath = path.join(workspaceRoot, relativePath);
        const wsEntry = wsManifest?.files[relativePath];
        const wsVersion = wsEntry?.version || "0.0.0";

        if (!fs.existsSync(fullPath)) {
            statuses.push({ relativePath, workspaceVersion: wsVersion, bundledVersion: entry.version, state: "missing" });
            continue;
        }

        const currentHash = computeFileHash(fullPath);
        if (wsVersion !== entry.version) {
            statuses.push({ relativePath, workspaceVersion: wsVersion, bundledVersion: entry.version, state: "outdated" });
        } else if (currentHash !== entry.hash) {
            statuses.push({ relativePath, workspaceVersion: wsVersion, bundledVersion: entry.version, state: "modified" });
        } else {
            statuses.push({ relativePath, workspaceVersion: wsVersion, bundledVersion: entry.version, state: "current" });
        }
    }
    return statuses;
}

/** Detect files that differ from bundled (for update prompts). */
export function detectModifiedFiles(workspaceRoot: string, extensionPath: string): ModifiedFile[] {
    const bundled = loadBundledManifest(extensionPath);
    if (!bundled) { return []; }

    const modified: ModifiedFile[] = [];
    for (const [relativePath, entry] of Object.entries(bundled.files)) {
        const fullPath = path.join(workspaceRoot, relativePath);
        if (!fs.existsSync(fullPath)) { continue; }
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
export function isUpgradeAvailable(workspaceRoot: string, extensionPath: string): boolean {
    const bundled = loadBundledManifest(extensionPath);
    if (!bundled) { return false; }
    const wsManifest = loadWorkspaceManifest(workspaceRoot);
    if (!wsManifest) { return true; }

    for (const [relativePath, entry] of Object.entries(bundled.files)) {
        const wsEntry = wsManifest.files[relativePath];
        if (!wsEntry || wsEntry.version !== entry.version) { return true; }
    }
    return false;
}

/** Migrate from legacy .sdlc-version to new per-file manifest. */
export function migrateLegacyVersion(workspaceRoot: string, extensionPath: string): void {
    const legacyFile = path.join(workspaceRoot, LEGACY_VERSION_FILE);
    if (!fs.existsSync(legacyFile)) { return; }

    const bundled = loadBundledManifest(extensionPath);
    if (!bundled) { return; }

    let legacyVersion = "1.0.0";
    try {
        const raw = JSON.parse(fs.readFileSync(legacyFile, "utf-8"));
        legacyVersion = raw.version || "1.0.0";
    } catch { /* use default */ }

    const wsManifest: WorkspaceManifest = { lastUpdated: new Date().toISOString(), files: {} };
    for (const [relativePath] of Object.entries(bundled.files)) {
        const fullPath = path.join(workspaceRoot, relativePath);
        if (fs.existsSync(fullPath)) {
            wsManifest.files[relativePath] = {
                version: legacyVersion,
                hash: computeFileHash(fullPath),
                injectedAt: new Date().toISOString()
            };
        }
    }

    saveWorkspaceManifest(workspaceRoot, wsManifest);
    fs.unlinkSync(legacyFile);
}

/** Build workspace manifest after a full inject (all files at bundled version). */
export function buildManifestAfterInject(workspaceRoot: string, extensionPath: string): void {
    const bundled = loadBundledManifest(extensionPath);
    if (!bundled) { return; }

    const wsManifest: WorkspaceManifest = { lastUpdated: new Date().toISOString(), files: {} };
    for (const [relativePath, entry] of Object.entries(bundled.files)) {
        const fullPath = path.join(workspaceRoot, relativePath);
        if (fs.existsSync(fullPath)) {
            wsManifest.files[relativePath] = {
                version: entry.version,
                hash: computeFileHash(fullPath),
                injectedAt: new Date().toISOString()
            };
        }
    }
    saveWorkspaceManifest(workspaceRoot, wsManifest);
}

// Legacy compat — keep for extension.ts checkForUpgrade
export interface VersionInfo {
    version: string;
    injectedAt: string;
}

export function loadWorkspaceVersion(workspaceRoot: string): VersionInfo | null {
    const wsManifest = loadWorkspaceManifest(workspaceRoot);
    if (!wsManifest) { return null; }
    const versions = Object.values(wsManifest.files).map(f => f.version);
    if (versions.length === 0) { return null; }
    const latest = versions.sort().pop() || "0.0.0";
    return { version: latest, injectedAt: wsManifest.lastUpdated };
}

export function saveWorkspaceVersion(workspaceRoot: string, version: string): void {
    // No-op — replaced by buildManifestAfterInject
}
