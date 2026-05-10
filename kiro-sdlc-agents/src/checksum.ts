/**
 * Checksum management — detects user modifications by comparing workspace files
 * against the bundled manifest stored inside the extension (tamper-proof).
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

export interface ModifiedFile {
    relativePath: string;
    expectedHash: string;
    actualHash: string;
    injectedVersion: string;
}

export interface VersionInfo {
    version: string;
    injectedAt: string;
}

const VERSION_FILE = ".kiro/.sdlc-version";
const BUNDLED_MANIFEST = "resources/.sdlc-checksums.json";

export function computeFileHash(filePath: string): string {
    const content = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(content).digest("hex");
}

export function loadBundledManifest(extensionPath: string): ChecksumManifest | null {
    const manifestFile = path.join(extensionPath, BUNDLED_MANIFEST);
    if (!fs.existsSync(manifestFile)) { return null; }
    try {
        const raw = fs.readFileSync(manifestFile, "utf-8");
        return JSON.parse(raw) as ChecksumManifest;
    } catch {
        return null;
    }
}

export function loadWorkspaceVersion(workspaceRoot: string): VersionInfo | null {
    const versionFile = path.join(workspaceRoot, VERSION_FILE);
    if (!fs.existsSync(versionFile)) { return null; }
    try {
        const raw = fs.readFileSync(versionFile, "utf-8");
        return JSON.parse(raw) as VersionInfo;
    } catch {
        return null;
    }
}

export function saveWorkspaceVersion(workspaceRoot: string, version: string): void {
    const versionFile = path.join(workspaceRoot, VERSION_FILE);
    fs.mkdirSync(path.dirname(versionFile), { recursive: true });
    const info: VersionInfo = { version, injectedAt: new Date().toISOString() };
    fs.writeFileSync(versionFile, JSON.stringify(info, null, 2), "utf-8");
}

export function detectModifiedFiles(workspaceRoot: string, extensionPath: string): ModifiedFile[] {
    const manifest = loadBundledManifest(extensionPath);
    if (!manifest) { return []; }

    const modified: ModifiedFile[] = [];
    for (const [relativePath, entry] of Object.entries(manifest.files)) {
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

export function isUpgradeAvailable(workspaceRoot: string, extensionPath: string): boolean {
    const manifest = loadBundledManifest(extensionPath);
    if (!manifest) { return false; }
    const wsVersion = loadWorkspaceVersion(workspaceRoot);
    if (!wsVersion) { return true; }
    return wsVersion.version !== manifest.version;
}
