# Technical Design Document (TDD)

## kiro-sdlc-agents — KSA-111: Prebuilt onnxruntime-node binaries — auto-download at runtime

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-111 |
| Title | Prebuilt onnxruntime-node binaries — auto-download at runtime |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2025-05-27 |
| Status | Draft (Retroactive) |
| Related BRD | BRD-v1-KSA-111.docx |
| Related FSD | FSD-v1-KSA-111.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-05-27 | SA Agent | Initiate document — retroactive TDD from implemented KSA-111 |

---

## 1. Introduction

### 1.1 Purpose

Technical design cho hệ thống auto-download prebuilt onnxruntime-node native binaries. Mô tả architecture, class design, integration patterns, security mechanisms, và deployment considerations.

### 1.2 Scope

- `OnnxAddonManager` class design (TypeScript, VS Code Extension API)
- CI workflow architecture (GitHub Actions, multi-platform matrix)
- Release manifest schema
- MCP server integration (env var injection)
- Tar parser implementation
- Error handling & retry logic

### 1.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | 5.x |
| Runtime | Node.js | 20/22/24 |
| Platform | VS Code Extension API | 1.85+ |
| CI/CD | GitHub Actions | v4 |
| Package Format | tar.gz (gzip + tar) | — |
| Crypto | Node.js crypto (SHA-256) | built-in |
| Network | Node.js https/http | built-in |
| Compression | Node.js zlib | built-in |

### 1.4 Design Principles

- **Same pattern as NativeAddonManager** — consistency with existing better-sqlite3 approach
- **Zero external dependencies** — uses only Node.js built-in modules (crypto, zlib, https, fs)
- **Fail-safe** — extension never crashes due to ONNX unavailability
- **Security-first** — SHA-256 verification, path traversal prevention
- **Minimal footprint** — custom tar parser instead of heavy npm packages

### 1.5 Constraints

- Cannot bundle binaries in VSIX (total ~55MB exceeds marketplace limits)
- Must support N-API (ABI-stable) — one binary per platform, not per Node version
- GitHub Release download URLs require redirect following (302 → actual CDN)
- VS Code `globalStorageUri` is the only persistent writable location
- No access to npm at runtime (extension sandbox)

### 1.6 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-111.docx |
| FSD | FSD-v1-KSA-111.docx |
| NativeAddonManager | `kiro-sdlc-agents/src/native-addon-manager.ts` |

---

## 2. System Architecture

### 2.1 Architecture Overview

![Architecture Diagram](diagrams/architecture.png)

The system follows a **download-verify-cache-inject** pattern:

1. **Extension Layer** — Orchestrates download lifecycle via OnnxAddonManager
2. **Storage Layer** — globalStorage cache with version-specific directories
3. **Network Layer** — HTTPS download with redirect following and retry
4. **Process Layer** — MCP server spawned with env var pointing to cached binary
5. **CI Layer** — GitHub Actions builds and publishes platform-specific archives

### 2.2 Component Diagram

![Component Diagram](diagrams/component.png)

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| OnnxAddonManager | Download, verify, cache, provide path | TypeScript, VS Code API |
| MCP Server Manager | Spawn child process with env vars | TypeScript, child_process |
| onnx-provider.ts | Load ONNX Runtime, run inference | TypeScript, onnxruntime-node |
| release-manifest.json | Store URLs, checksums, sizes | JSON (static resource) |
| build-onnxruntime.yml | Build binaries for 4 platforms | GitHub Actions YAML |
| update-onnx-manifest.js | Helper to update manifest after CI build | Node.js script |

### 2.3 Communication Patterns

| From | To | Protocol | Pattern | Description |
|------|----|----------|---------|-------------|
| Extension | GitHub Releases | HTTPS | Sync (download) | Download tar.gz binary |
| Extension | File System | fs API | Sync/Async | Read/write cache |
| Extension | MCP Server | child_process.spawn | Process env | Inject ONNX_RUNTIME_PATH |
| MCP Server | onnxruntime-node | require() | Sync | Load native addon |
| CI | GitHub Releases | gh CLI | Sync | Upload release assets |

---

## 3. API Design

> No REST APIs in this feature. The "API" is the OnnxAddonManager class interface.

### 3.1 OnnxAddonManager Public Interface

```typescript
class OnnxAddonManager {
    constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel)
    
    /** Download if needed, return path or null */
    async ensure(): Promise<string | null>
    
    /** Get cached path without downloading */
    getCachedPath(): string | null
    
    /** Force re-download (delete cache first) */
    async redownload(): Promise<string | null>
    
    /** Get platform diagnostics */
    getPlatformInfo(): OnnxPlatformInfo
}
```

### 3.2 Environment Variable Contract

| Variable | Set By | Read By | Value |
|----------|--------|---------|-------|
| ONNX_RUNTIME_PATH | MCP Server Manager (spawn env) | onnx-provider.ts | Absolute path to `onnxruntime-node/` directory |

---

## 4. Data Design

> No database in this feature. Data is file-based (manifest + cache).

### 4.1 Release Manifest Schema

**File:** `kiro-sdlc-agents/resources/release-manifest.json`

```json
{
  "onnxruntime-node": {
    "version": "1.22.0",
    "releaseUrl": "https://github.com/{owner}/{repo}/releases/tag/onnxruntime-node-v1.22.0",
    "binaries": {
      "win32-x64": {
        "url": "https://github.com/{owner}/{repo}/releases/download/onnxruntime-node-v1.22.0/onnxruntime-node-v1.22.0-win32-x64.tar.gz",
        "sha256": "c0ad166ab389b7a3c4c0e7015c73e412f42b6b3991db4ad6382b40da05722efc",
        "size": 26126051
      }
    }
  }
}
```

### 4.2 Cache Directory Layout

```
{globalStorageUri}/
└── native-addons/
    └── onnxruntime-node/
        └── v1.22.0/
            └── win32-x64/
                ├── onnxruntime-node/       ← ONNX_RUNTIME_PATH points here
                │   ├── bin/               ← Native .dll/.so/.dylib files
                │   │   └── napi-v3/
                │   │       └── onnxruntime_binding.node
                │   ├── dist/              ← JS wrappers
                │   │   └── binding.js
                │   └── package.json       ← Cache marker file
                └── onnxruntime-common/    ← JS peer dependency
                    ├── dist/
                    └── package.json
```

### 4.3 Archive Contents (tar.gz)

| Entry | Type | Purpose |
|-------|------|---------|
| `onnxruntime-node/bin/` | Directory | Native binary files (.node, .dll, .so, .dylib) |
| `onnxruntime-node/dist/` | Directory | JavaScript wrapper files |
| `onnxruntime-node/package.json` | File | Package metadata + require() entry point |
| `onnxruntime-common/dist/` | Directory | Common JS utilities |
| `onnxruntime-common/package.json` | File | Peer dependency metadata |

---

## 5. Class / Module Design

### 5.1 Package Structure

```
kiro-sdlc-agents/src/
├── onnx-addon-manager.ts      ← NEW: OnnxAddonManager class
├── native-addon-manager.ts    ← EXISTING: better-sqlite3 (reference pattern)
├── mcp-server-manager.ts      ← MODIFIED: inject ONNX_RUNTIME_PATH
└── extension.ts               ← MODIFIED: initialize OnnxAddonManager

kiro-sdlc-agents/resources/
└── release-manifest.json      ← MODIFIED: add onnxruntime-node section

kiro-sdlc-agents/scripts/
└── update-onnx-manifest.js   ← NEW: helper to update manifest

.github/workflows/
└── build-onnxruntime.yml      ← NEW: CI workflow

mcp-code-intelligence-nodejs/src/memory/embedding/
└── onnx-provider.ts           ← MODIFIED: load from ONNX_RUNTIME_PATH env
```

### 5.2 Class Design: OnnxAddonManager

```typescript
export class OnnxAddonManager {
    // ─── Fields ───
    private readonly globalStoragePath: string;
    private readonly extensionPath: string;
    private readonly outputChannel: vscode.OutputChannel;
    private manifest: OnnxReleaseManifest | null;

    // ─── Constructor ───
    constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel)

    // ─── Public Methods ───
    async ensure(): Promise<string | null>
    getCachedPath(): string | null
    async redownload(): Promise<string | null>
    getPlatformInfo(): OnnxPlatformInfo

    // ─── Private Methods ───
    private loadManifest(): OnnxReleaseManifest | null
    private async downloadWithProgress(info: OnnxPlatformInfo): Promise<string | null>
    private downloadFile(url, target, expectedSize, progress, token, maxRedirects): Promise<void>
    private extractTarGz(archivePath: string, targetDir: string): Promise<void>
    private parseTar(data: Buffer, targetDir: string): void
    private computeSha256(filePath: string): Promise<string>
    private sleep(ms: number): Promise<void>
}
```

### 5.3 Design Patterns

| Pattern | Where Used | Rationale |
|---------|-----------|-----------|
| Singleton-like | OnnxAddonManager (one per extension) | Only one instance needed per activation |
| Template Method | downloadWithProgress (retry loop) | Consistent retry logic with progress reporting |
| Strategy | onnx-provider (env path vs npm import) | Multiple ways to load ONNX Runtime |
| Builder | CI workflow matrix | Dynamic platform matrix generation |

### 5.4 Key Implementation Details

**Download with Redirect Following:**
```typescript
// GitHub Release URLs redirect: github.com → objects.githubusercontent.com
// Must follow up to 10 redirects
if (status >= 300 && status < 400 && res.headers.location) {
    this.downloadFile(res.headers.location, target, expectedSize, progress, token, maxRedirects - 1)
}
```

**Tar Parser — Path Traversal Prevention:**
```typescript
const fullPath = path.join(targetDir, fileName);
if (!fullPath.startsWith(targetDir)) {
    // Skip malicious entry — prevents writing outside cache
    offset += Math.ceil(fileSize / BLOCK_SIZE) * BLOCK_SIZE;
    continue;
}
```

**ONNX Provider — Dual Loading Strategy:**
```typescript
// Priority 1: Prebuilt binary from extension (via env var)
const onnxPath = process.env.ONNX_RUNTIME_PATH;
if (onnxPath) {
    ort = require(onnxPath);
}
// Priority 2: npm-installed package (fallback)
else {
    ort = await import('onnxruntime-node');
}
```

---

## 6. Integration Design

### 6.1 External System: GitHub Releases

| Attribute | Value |
|-----------|-------|
| Protocol | HTTPS (TLS 1.2+) |
| Endpoint | `https://github.com/{owner}/{repo}/releases/download/{tag}/{filename}` |
| Authentication | None (public release) |
| Timeout | 120,000 ms |
| Retry Policy | 3 attempts, backoff [0, 2000, 4000] ms |
| Redirect | Follow up to 10 redirects (302 → CDN) |

**Request:**
```
GET /releases/download/onnxruntime-node-v1.22.0/onnxruntime-node-v1.22.0-{platform}-{arch}.tar.gz
Host: github.com
User-Agent: kiro-sdlc-agents/1.0
```

**Response Flow:**
```
302 → Location: https://objects.githubusercontent.com/...
200 OK → Content-Type: application/octet-stream, Content-Length: {size}
```

### 6.2 Internal Integration: MCP Server Process

| Attribute | Value |
|-----------|-------|
| Mechanism | `child_process.spawn()` with env option |
| Variable | `ONNX_RUNTIME_PATH` |
| Value | Absolute path to extracted `onnxruntime-node/` directory |
| Lifecycle | Set once at spawn, immutable during process lifetime |

**Spawn Configuration:**
```typescript
spawn("node", [entryPath, "--port", port, "--config", configPath], {
    env: {
        ...process.env,
        ONNX_RUNTIME_PATH: onnxRuntimePath,  // from OnnxAddonManager.ensure()
    }
});
```

---

## 7. Security Design

### 7.1 Integrity Verification

| Mechanism | Implementation | Threat Mitigated |
|-----------|---------------|------------------|
| SHA-256 checksum | `crypto.createHash('sha256')` stream hash | Corrupted download, MITM tampering |
| HTTPS only | URL scheme validation | Eavesdropping, injection |
| Path traversal check | `fullPath.startsWith(targetDir)` | Malicious tar entries |

### 7.2 Trust Model

| Component | Trust Level | Verification |
|-----------|-------------|-------------|
| release-manifest.json | High (shipped with extension) | Part of signed VSIX |
| GitHub Release binary | Medium (verified by SHA-256) | Hash in manifest |
| Extracted files | High (after verification) | Marker file check |

### 7.3 Attack Surface

| Attack Vector | Mitigation |
|--------------|------------|
| Compromised GitHub Release | SHA-256 verification against manifest shipped with extension |
| DNS spoofing / MITM | HTTPS + hash verification |
| Malicious tar entry (path traversal) | `startsWith(targetDir)` check |
| Symlink attack in tar | Only handle type '0' (file) and '5' (directory) |
| Binary replacement in cache | Marker file check on every activation |

---

## 8. Performance & Scalability

### 8.1 Performance Characteristics

| Operation | Expected Time | Notes |
|-----------|--------------|-------|
| Cache hit (ensure()) | < 5ms | Single `fs.existsSync()` call |
| Download (first time) | 5-60s | Depends on network speed and binary size |
| SHA-256 computation | < 1s | Streaming hash, ~25MB max |
| Tar extraction | < 2s | In-memory buffer, sequential write |
| Total first-time setup | 10-65s | Download dominates |

### 8.2 Storage Impact

| Platform | Archive Size | Extracted Size | Total |
|----------|-------------|---------------|-------|
| win32-x64 | 25 MB | ~30 MB | ~55 MB (temp) → 30 MB (final) |
| linux-x64 | 11 MB | ~15 MB | ~26 MB (temp) → 15 MB (final) |
| darwin-x64 | 10 MB | ~14 MB | ~24 MB (temp) → 14 MB (final) |
| darwin-arm64 | 9 MB | ~13 MB | ~22 MB (temp) → 13 MB (final) |

> tar.gz is deleted after extraction, so final storage = extracted size only.

---

## 9. Monitoring & Observability

### 9.1 Logging (Output Channel)

| Log Event | Level | Message Pattern |
|-----------|-------|-----------------|
| Cache hit | Info | `[OnnxAddon] Cache hit: {cacheDir}` |
| Download start | Info | `[OnnxAddon] Downloading: {url}` |
| Download target | Info | `[OnnxAddon] Target: {cacheDir}` |
| Download size | Info | `[OnnxAddon] Expected size: {mb} MB` |
| Checksum mismatch | Warn | `[OnnxAddon] Checksum mismatch: expected {hash16}..., got {hash16}...` |
| Retry | Info | `[OnnxAddon] Retry {n}/{max}...` |
| Success | Info | `[OnnxAddon] ✅ Downloaded and extracted: {cacheDir}` |
| All failed | Error | `[OnnxAddon] ❌ All download attempts failed.` |
| Platform unsupported | Info | `[OnnxAddon] Platform {p}-{a} not supported for ONNX Runtime.` |
| No manifest | Info | `[OnnxAddon] No onnxruntime-node entry in release-manifest.json — skipping.` |

---

## 10. Deployment Considerations

### 10.1 VSIX Packaging

| Item | Included in VSIX | Reason |
|------|-----------------|--------|
| `onnx-addon-manager.ts` (compiled) | ✅ Yes | Extension code |
| `release-manifest.json` | ✅ Yes | Needed at runtime |
| `update-onnx-manifest.js` | ❌ No | Dev-only script |
| onnxruntime-node binaries | ❌ No | Too large, downloaded at runtime |

**.vscodeignore additions:**
```
**/node_modules/onnxruntime-node/**
**/node_modules/onnxruntime-common/**
```

### 10.2 Version Upgrade Strategy

1. Update `release-manifest.json` with new version, URLs, checksums
2. Publish new VSIX
3. On next activation, OnnxAddonManager detects new version (different cache path)
4. Downloads new binary to new version-specific directory
5. Old version cache remains (user can manually clean)

### 10.3 Rollback Strategy

- Revert `release-manifest.json` to previous version
- Publish hotfix VSIX
- Users' existing cache for old version still valid (no re-download needed)

---

## 11. Implementation Checklist

### Files to Create

| # | File | Description |
|---|------|-------------|
| 1 | `kiro-sdlc-agents/src/onnx-addon-manager.ts` | OnnxAddonManager class |
| 2 | `.github/workflows/build-onnxruntime.yml` | CI workflow |
| 3 | `kiro-sdlc-agents/scripts/update-onnx-manifest.js` | Manifest update helper |

### Files to Modify

| # | File | Change |
|---|------|--------|
| 1 | `kiro-sdlc-agents/resources/release-manifest.json` | Add `onnxruntime-node` section |
| 2 | `kiro-sdlc-agents/src/mcp-server-manager.ts` | Inject `ONNX_RUNTIME_PATH` env var |
| 3 | `kiro-sdlc-agents/src/extension.ts` | Initialize OnnxAddonManager |
| 4 | `mcp-code-intelligence-nodejs/src/memory/embedding/onnx-provider.ts` | Load from env var |
| 5 | `kiro-sdlc-agents/mcp-server/memory/embedding/onnx-provider.js` | Bundled JS version |
| 6 | `kiro-sdlc-agents/.vscodeignore` | Exclude onnxruntime from VSIX |

---

## 12. Appendix

### Glossary

| Term | Definition |
|------|------------|
| N-API | Node.js native addon API — ABI-stable across Node.js versions |
| POSIX ustar | Standard tar archive format with prefix field for long paths |
| globalStorageUri | VS Code API providing persistent per-extension storage path |
| VSIX | VS Code extension package format (ZIP with manifest) |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture Overview | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
