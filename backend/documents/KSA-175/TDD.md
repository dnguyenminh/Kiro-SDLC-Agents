# Technical Design Document (TDD)

## Kiro SDLC Agents — KSA-175: Runtime Self-Download better-sqlite3

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-175 |
| Title | Runtime Self-Download better-sqlite3 — Technical Design |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2025-01-27 |
| Status | Approved |
| Related BRD | BRD-v1-KSA-175.docx |
| Related FSD | FSD-v1-KSA-175.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-27 | SA Agent | Initial TDD — architecture and implementation design |
| 1.1 | 2025-05-25 | SM Agent | Updated URLs to dnguyenminh/Kiro-SDLC-Agents, status → Approved |

---

## 1. Architecture Overview

### 1.1 Current Architecture

The extension spawns `mcp-server/http-entry.js` as a child process. The MCP server uses `better-sqlite3` loaded via standard `require()` from `node_modules/`. This requires the native `.node` binary to be compiled during `npm install`.

### 1.2 Proposed Architecture

Add a `NativeAddonManager` class to the extension that intercepts the MCP server spawn flow:

```
Extension activate()
    → NativeAddonManager.ensure()
        → Check cache (globalStorageUri)
        → Download if missing (GitHub Releases)
        → Return binding path
    → McpServerManager.spawn(env: { BETTER_SQLITE3_BINDING: path })
        → MCP Server loads better-sqlite3 with nativeBinding option
```

![Architecture Diagram](diagrams/architecture.png)

### 1.3 Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Binary distribution | GitHub Releases | Free, reliable CDN, no auth needed for public repos |
| ABI strategy | N-API (not Electron ABI) | N-API is forward-compatible, fewer builds needed |
| Cache location | globalStorageUri | Persists across extension updates per VS Code API |
| Integrity check | SHA-256 from bundled manifest | No network call for verification, tamper-proof |
| Server integration | `nativeBinding` constructor option | Supported by better-sqlite3 since v9.0, cleanest approach |
| Download library | Node.js built-in `https` | No extra dependencies, redirect handling included |

---

## 2. Component Design

### 2.1 New Files

| File | Module | Purpose |
|------|--------|---------|
| `src/native-addon-manager.ts` | Extension | Core download/cache logic |
| `src/native-addon-manager.test.ts` | Extension | Unit tests |
| `resources/release-manifest.json` | Extension | Binary URLs + checksums |
| `.github/workflows/build-native.yml` | CI | Build prebuilt binaries |

### 2.2 Modified Files

| File | Change |
|------|--------|
| `src/extension.ts` | Initialize NativeAddonManager, pass to McpServerManager |
| `src/mcp-server-manager.ts` | Accept addon path, set env var on spawn |
| `mcp-code-intelligence-nodejs/src/db/database-manager.ts` | Use `nativeBinding` option |

### 2.3 Component Diagram

![Component Diagram](diagrams/component.png)

---

## 3. Detailed Design

### 3.1 NativeAddonManager Class

```typescript
// src/native-addon-manager.ts

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as crypto from "crypto";

interface BinaryManifestEntry {
  url: string;
  sha256: string;
  size: number;
}

interface ReleaseManifest {
  "better-sqlite3": {
    version: string;
    releaseUrl: string;
    binaries: Record<string, BinaryManifestEntry>;
  };
}

interface PlatformInfo {
  platform: NodeJS.Platform;
  arch: string;
  napiVersion: string;
  electronVersion: string;
  supported: boolean;
  cacheKey: string;
  cacheDir: string;
}

export class NativeAddonManager {
  private readonly globalStoragePath: string;
  private readonly extensionPath: string;
  private readonly outputChannel: vscode.OutputChannel;
  private manifest: ReleaseManifest;

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
   * Ensure native addon is available. Downloads if not cached.
   * Returns path to the .node file, or null if unavailable.
   */
  async ensure(): Promise<string | null> {
    const info = this.getPlatformInfo();
    
    if (!info.supported) {
      this.showUnsupportedError(info);
      return null;
    }

    // Check cache
    const bindingPath = path.join(info.cacheDir, "better_sqlite3.node");
    if (fs.existsSync(bindingPath) && fs.statSync(bindingPath).size > 0) {
      this.outputChannel.appendLine(
        `[NativeAddon] Cache hit: ${bindingPath}`
      );
      return bindingPath;
    }

    // Download with progress
    return this.downloadWithProgress(info);
  }

  /**
   * Get cached path without downloading.
   */
  getCachedPath(): string | null {
    const info = this.getPlatformInfo();
    const bindingPath = path.join(info.cacheDir, "better_sqlite3.node");
    return fs.existsSync(bindingPath) ? bindingPath : null;
  }

  /**
   * Force re-download (after corruption).
   */
  async redownload(): Promise<string | null> {
    const info = this.getPlatformInfo();
    const bindingPath = path.join(info.cacheDir, "better_sqlite3.node");
    
    // Delete existing
    if (fs.existsSync(bindingPath)) {
      fs.unlinkSync(bindingPath);
    }
    
    return this.downloadWithProgress(info);
  }

  getPlatformInfo(): PlatformInfo {
    const platform = process.platform;
    const arch = process.arch;
    const napiVersion = process.versions.napi || "9";
    const electronVersion = process.versions.electron || "unknown";
    const cacheKey = `napi-v${napiVersion}-${platform}-${arch}`;
    const version = this.manifest["better-sqlite3"].version;
    const cacheDir = path.join(
      this.globalStoragePath,
      "native-addons",
      "better-sqlite3",
      `v${version}`,
      cacheKey
    );
    const supported = cacheKey in this.manifest["better-sqlite3"].binaries;

    return { platform, arch, napiVersion, electronVersion, supported, cacheKey, cacheDir };
  }

  // --- Private methods ---

  private loadManifest(): ReleaseManifest {
    const manifestPath = path.join(
      this.extensionPath, "resources", "release-manifest.json"
    );
    return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  }

  private async downloadWithProgress(info: PlatformInfo): Promise<string | null> {
    const entry = this.manifest["better-sqlite3"].binaries[info.cacheKey];
    if (!entry) {
      this.showUnsupportedError(info);
      return null;
    }

    // Ensure cache directory exists
    if (!fs.existsSync(info.cacheDir)) {
      fs.mkdirSync(info.cacheDir, { recursive: true });
    }

    const bindingPath = path.join(info.cacheDir, "better_sqlite3.node");

    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Kiro SDLC: Downloading native module...",
        cancellable: true,
      },
      async (progress, token) => {
        const maxAttempts = 3;
        const backoffs = [0, 2000, 4000];

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          if (token.isCancellationRequested) {
            vscode.window.showInformationMessage(
              "Native module download cancelled. MCP server will not start. Restart VS Code to retry."
            );
            return null;
          }

          if (attempt > 0) {
            progress.report({ message: `Retrying (${attempt + 1}/${maxAttempts})...` });
            await this.sleep(backoffs[attempt]);
          }

          try {
            await this.downloadFile(entry.url, bindingPath, entry.size, progress);

            // Verify checksum
            progress.report({ message: "Verifying integrity..." });
            const hash = await this.computeSha256(bindingPath);
            
            if (hash !== entry.sha256) {
              this.outputChannel.appendLine(
                `[NativeAddon] Checksum mismatch: expected ${entry.sha256}, got ${hash}`
              );
              fs.unlinkSync(bindingPath);
              continue; // retry
            }

            this.outputChannel.appendLine(
              `[NativeAddon] Downloaded and verified: ${bindingPath}`
            );
            return bindingPath;
          } catch (err: any) {
            this.outputChannel.appendLine(
              `[NativeAddon] Download attempt ${attempt + 1} failed: ${err.message}`
            );
            if (fs.existsSync(bindingPath)) {
              fs.unlinkSync(bindingPath);
            }
          }
        }

        // All attempts failed
        this.showDownloadError(info);
        return null;
      }
    );
  }

  private downloadFile(
    url: string,
    target: string,
    expectedSize: number,
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    maxRedirects = 5
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (maxRedirects <= 0) {
        reject(new Error("Too many redirects"));
        return;
      }

      const parsedUrl = new URL(url);
      const options: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        timeout: 60000,
      };

      const req = https.get(options, (res) => {
        const status = res.statusCode ?? 0;

        // Handle redirects
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          this.downloadFile(res.headers.location, target, expectedSize, progress, maxRedirects - 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (status !== 200) {
          res.resume();
          reject(new Error(`HTTP ${status}`));
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
              message: `${mb} MB / ${totalMb} MB (${percent}%)`,
              increment: percent - lastReportedPercent,
            });
            lastReportedPercent = percent;
          }
        });

        res.pipe(file);
        file.on("finish", () => { file.close(); resolve(); });
        file.on("error", (err) => {
          file.close();
          if (fs.existsSync(target)) { fs.unlinkSync(target); }
          reject(err);
        });
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Download timed out (60s)"));
      });

      req.on("error", (err) => {
        if (fs.existsSync(target)) { fs.unlinkSync(target); }
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
    const config = vscode.workspace.getConfiguration("http");
    return config.get<string>("proxy") || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  }

  private showUnsupportedError(info: PlatformInfo): void {
    vscode.window.showErrorMessage(
      `Platform ${info.platform}-${info.arch} (N-API ${info.napiVersion}) is not supported. ` +
      `MCP server cannot start. See documentation for manual build instructions.`
    );
  }

  private showDownloadError(info: PlatformInfo): void {
    const releaseUrl = this.manifest["better-sqlite3"].releaseUrl;
    vscode.window.showErrorMessage(
      `Failed to download native module after 3 attempts. MCP server cannot start.`,
      "Retry", "Manual Download"
    ).then((action) => {
      if (action === "Retry") {
        this.redownload();
      } else if (action === "Manual Download") {
        vscode.env.openExternal(vscode.Uri.parse(releaseUrl));
      }
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

### 3.2 McpServerManager Modifications

```typescript
// Changes to src/mcp-server-manager.ts

export class McpServerManager implements IServerManager, vscode.Disposable {
  private nativeAddonManager: NativeAddonManager | undefined;

  // Add to constructor or setter
  setNativeAddonManager(manager: NativeAddonManager): void {
    this.nativeAddonManager = manager;
  }

  async spawn(): Promise<void> {
    if (this._status === "running") { return; }
    this.setStatus("starting");

    // NEW: Ensure native addon is available before spawning
    let nativeBindingPath: string | undefined;
    if (this.nativeAddonManager) {
      const addonPath = await this.nativeAddonManager.ensure();
      if (!addonPath) {
        this.setStatus("stopped");
        this.outputChannel.appendLine("[MCP] Native addon unavailable. Server not started.");
        return;
      }
      nativeBindingPath = addonPath;
    }

    // ... existing port check and bundle verification ...

    // Modified spawn with BETTER_SQLITE3_BINDING env var
    const child = spawn("node", [entryPath, "--port", String(configuredPort), "--config", configPath], {
      cwd: this.workspaceFolder,
      env: {
        ...process.env,
        NODE_ENV: "production",
        CODE_INTEL_VIEWER_PORT: "0",
        ...(nativeBindingPath ? { BETTER_SQLITE3_BINDING: nativeBindingPath } : {}),
      },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    // ... rest unchanged ...
  }
}
```

### 3.3 MCP Server Database Manager Modification

```typescript
// Changes to mcp-code-intelligence-nodejs/src/db/database-manager.ts

import Database from "better-sqlite3";

export class DatabaseManager {
  private db: Database.Database;

  constructor(dbPath: string) {
    const bindingPath = process.env.BETTER_SQLITE3_BINDING;
    
    if (bindingPath) {
      // Use prebuilt binary from extension cache
      this.db = new Database(dbPath, { nativeBinding: bindingPath });
    } else {
      // Fallback: use default require resolution (dev mode / standalone)
      this.db = new Database(dbPath);
    }
  }
}
```

### 3.4 Extension Initialization

```typescript
// Changes to src/extension.ts

import { NativeAddonManager } from "./native-addon-manager";

let nativeAddonManager: NativeAddonManager | undefined;

export function activate(context: vscode.ExtensionContext) {
  // ... existing code ...

  // Initialize NativeAddonManager
  const outputChannel = vscode.window.createOutputChannel("Kiro MCP Server");
  nativeAddonManager = new NativeAddonManager(context, outputChannel);

  // Pass to McpServerManager
  if (mcpManager) {
    mcpManager.setNativeAddonManager(nativeAddonManager);
  }

  // ... rest unchanged ...
}
```

### 3.5 Release Manifest

```json
{
  "better-sqlite3": {
    "version": "11.7.0",
    "releaseUrl": "https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/tag/better-sqlite3-v11.7.0",
    "binaries": {
      "napi-v9-win32-x64": {
        "url": "https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/download/better-sqlite3-v11.7.0/better-sqlite3-v11.7.0-napi-v9-win32-x64.node",
        "sha256": "placeholder-will-be-filled-by-ci",
        "size": 5242880
      },
      "napi-v9-darwin-x64": {
        "url": "https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/download/better-sqlite3-v11.7.0/better-sqlite3-v11.7.0-napi-v9-darwin-x64.node",
        "sha256": "placeholder-will-be-filled-by-ci",
        "size": 4194304
      },
      "napi-v9-darwin-arm64": {
        "url": "https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/download/better-sqlite3-v11.7.0/better-sqlite3-v11.7.0-napi-v9-darwin-arm64.node",
        "sha256": "placeholder-will-be-filled-by-ci",
        "size": 4194304
      },
      "napi-v9-linux-x64": {
        "url": "https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/download/better-sqlite3-v11.7.0/better-sqlite3-v11.7.0-napi-v9-linux-x64.node",
        "sha256": "placeholder-will-be-filled-by-ci",
        "size": 5242880
      }
    }
  }
}
```

### 3.6 CI Workflow

```yaml
# .github/workflows/build-native.yml
name: Build Native Addons

on:
  workflow_dispatch:
    inputs:
      better_sqlite3_version:
        description: 'better-sqlite3 version'
        required: true
        default: '11.7.0'

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: windows-latest
            platform: win32
            arch: x64
          - os: ubuntu-latest
            platform: linux
            arch: x64
          - os: macos-latest
            platform: darwin
            arch: x64
          - os: macos-14
            platform: darwin
            arch: arm64

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install better-sqlite3
        run: |
          mkdir build-temp && cd build-temp
          npm init -y
          npm install better-sqlite3@${{ inputs.better_sqlite3_version }}

      - name: Copy and rename binary
        shell: bash
        run: |
          VERSION=${{ inputs.better_sqlite3_version }}
          NAPI=9
          PLATFORM=${{ matrix.platform }}
          ARCH=${{ matrix.arch }}
          FILENAME="better-sqlite3-v${VERSION}-napi-v${NAPI}-${PLATFORM}-${ARCH}.node"
          
          find build-temp/node_modules/better-sqlite3 -name "*.node" -exec cp {} "$FILENAME" \;
          
          if [[ "$PLATFORM" == "darwin" ]]; then
            shasum -a 256 "$FILENAME" > "${FILENAME}.sha256"
          else
            sha256sum "$FILENAME" > "${FILENAME}.sha256"
          fi

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: native-${{ matrix.platform }}-${{ matrix.arch }}
          path: |
            *.node
            *.sha256

  release:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          merge-multiple: true

      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          tag_name: better-sqlite3-v${{ inputs.better_sqlite3_version }}
          files: |
            *.node
            *.sha256
```

---

## 4. Error Handling Design

### 4.1 Error Hierarchy

```
NativeAddonError (base)
├── PlatformNotSupportedError
├── DownloadError
│   ├── NetworkTimeoutError
│   ├── HttpError (404, 5xx)
│   └── ProxyError
├── IntegrityError (checksum mismatch)
└── StorageError (disk full, permission denied)
```

### 4.2 Error Recovery Matrix

| Error | Retry? | User Action | Extension State |
|-------|--------|-------------|-----------------|
| PlatformNotSupported | No | Manual build | MCP stopped, other features work |
| NetworkTimeout | Yes (3x) | Check internet | MCP stopped until retry |
| HTTP 404 | No | Report issue | MCP stopped |
| HTTP 5xx | Yes (3x) | Wait and retry | MCP stopped until retry |
| Checksum mismatch | Yes (3x) | Auto-retry | MCP stopped until success |
| Disk full | No | Free space | MCP stopped |
| Permission denied | No | Fix permissions | MCP stopped |

### 4.3 Graceful Degradation

When native addon is unavailable:
- Extension still activates (commands, tree view, etc. work)
- MCP server does NOT start
- Status bar shows warning icon
- "Kiro SDLC: Restart MCP Server" command retries download

---

## 5. Security Design

### 5.1 Binary Integrity

- SHA-256 checksums bundled in `release-manifest.json` (part of extension package)
- Extension package is signed by VS Code Marketplace
- Chain of trust: Marketplace → extension → manifest → binary

### 5.2 Transport Security

- HTTPS only for all downloads
- GitHub's TLS certificates validated by Node.js
- Proxy SSL verification respects VS Code's `http.proxyStrictSSL` setting

### 5.3 Cache Security

- Cache stored in `globalStorageUri` (user-writable, not world-writable)
- No executable permissions needed (loaded via `dlopen` by Node.js)
- Checksum re-verified if file size changes unexpectedly

---

## 6. Testing Strategy

### 6.1 Unit Tests

| Test | Description |
|------|-------------|
| `getPlatformInfo()` | Returns correct platform/arch/napi for current system |
| `getCachedPath()` | Returns path when file exists, null when not |
| `loadManifest()` | Parses release-manifest.json correctly |
| `computeSha256()` | Computes correct hash for known file |
| `ensure() - cache hit` | Returns immediately without network call |
| `ensure() - unsupported` | Returns null, shows error |

### 6.2 Integration Tests

| Test | Description |
|------|-------------|
| Download + verify | Downloads real file, verifies checksum |
| Retry on failure | Simulates network error, verifies retry |
| MCP spawn with binding | Spawns server with BETTER_SQLITE3_BINDING env |
| Cache persistence | Verify file persists across test runs |

### 6.3 Manual Tests

| Test | Platform | Steps |
|------|----------|-------|
| Fresh install | Windows x64 | Install extension, verify download + MCP start |
| Cache hit | All | Restart VS Code, verify no download |
| Network offline | All | Disconnect, activate, verify error message |
| Proxy | Windows | Configure proxy, verify download works |

---

## 7. Implementation Checklist

### Phase 1: Core (Must Have)

- [ ] Create `src/native-addon-manager.ts`
- [ ] Create `resources/release-manifest.json` (with placeholder checksums)
- [ ] Modify `src/extension.ts` to initialize NativeAddonManager
- [ ] Modify `src/mcp-server-manager.ts` to accept addon path
- [ ] Modify `mcp-code-intelligence-nodejs/src/db/database-manager.ts` for `nativeBinding`
- [ ] Create `.github/workflows/build-native.yml`
- [ ] Unit tests for NativeAddonManager

### Phase 2: Polish (Should Have)

- [ ] Proxy support (read VS Code http.proxy settings)
- [ ] "Retry" and "Manual Download" buttons in error notification
- [ ] Output channel logging for all download operations
- [ ] Cache cleanup command (optional)

### Phase 3: CI (Should Have)

- [ ] Run CI workflow for all 4 platforms
- [ ] Update `release-manifest.json` with real checksums
- [ ] Test extension package with bundled manifest
- [ ] Publish GitHub Release with binaries

---

## 8. Performance Considerations

| Scenario | Target | Approach |
|----------|--------|----------|
| First activation | < 30s | Parallel: show progress while downloading |
| Cache hit | < 100ms | Single `fs.existsSync` + `statSync` |
| Large binary (8MB) | Streaming | `res.pipe(file)`, no memory buffering |
| Checksum verification | < 500ms | Streaming SHA-256, not load-all-then-hash |

---

## 9. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
