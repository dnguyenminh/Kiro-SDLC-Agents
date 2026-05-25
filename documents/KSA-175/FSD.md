# Functional Specification Document (FSD)

## Kiro SDLC Agents — KSA-175: Runtime Self-Download better-sqlite3

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-175 |
| Title | Runtime Self-Download better-sqlite3 — Functional Specification |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2025-01-27 |
| Status | Approved |
| Related BRD | BRD-v1-KSA-175.docx |
| Related FSD | FSD-v1-KSA-175.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-27 | BA + TA Agent | Initial FSD — full specification with API contracts and technical enrichment |
| 1.1 | 2025-05-25 | SM Agent | Status → Approved, aligned with actual implementation |

---

## 1. System Context

The `kiro-sdlc-agents` extension bundles `mcp-code-intelligence-nodejs` as a child process. The MCP server uses `better-sqlite3` for SQLite FTS5 indexing. Currently, `better-sqlite3` requires native compilation at `npm install` time, which fails without build tools.

This feature adds a **NativeAddonManager** module to the extension that:
1. Detects the required platform/arch/ABI combination
2. Checks a persistent cache (`globalStorageUri`)
3. Downloads prebuilt binaries from GitHub Releases if not cached
4. Configures the MCP server spawn to use the cached binary

![System Context](diagrams/system-context.png)

---

## 2. Use Cases

### UC-1: First Activation (Binary Not Cached)

| Field | Value |
|-------|-------|
| Actor | Developer |
| Precondition | Extension installed, no cached binary exists |
| Trigger | VS Code activates extension |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | — | Extension activates, calls `NativeAddonManager.ensure()` |
| 2 | — | Detect platform: `process.platform` + `process.arch` |
| 3 | — | Detect ABI: `process.versions.modules` (Node ABI in extension host) |
| 4 | — | Construct cache path: `{globalStorageUri}/native-addons/better-sqlite3/v{version}/{platform}-{arch}-napi-v{napi}/` |
| 5 | — | Check cache: `fs.existsSync(cachePath/better_sqlite3.node)` → false |
| 6 | — | Show progress notification: "Kiro SDLC: Downloading native module..." |
| 7 | — | Construct download URL from release manifest |
| 8 | — | Download `.node` file with progress reporting |
| 9 | — | Verify SHA-256 checksum against manifest |
| 10 | — | Save to cache directory |
| 11 | — | Return cache path to `McpServerManager` |
| 12 | — | Spawn MCP server with `--native-addon-path {cachePath}` |

**Alternative Flow — A1: Download Cancelled:**

| Step | System |
|------|--------|
| 6a | User cancels progress notification |
| 6b | Show info: "Native module required for MCP server. Restart VS Code to retry." |
| 6c | Return null → MCP server NOT spawned |

**Alternative Flow — A2: Network Error with Retry:**

| Step | System |
|------|--------|
| 8a | Download fails (timeout/network error) |
| 8b | Wait 2 seconds, retry (attempt 2/3) |
| 8c | If retry succeeds → continue at step 9 |
| 8d | If all retries fail → show error notification |

**Exception Flow — E1: Unsupported Platform:**

| Step | System |
|------|--------|
| 2a | Platform/arch combination not in manifest |
| 2b | Show error: "Platform {platform}-{arch} not supported. See docs for manual build." |
| 2c | Return null → MCP server NOT spawned |

**Postcondition:** Binary cached, MCP server running with SQLite support.

---

### UC-2: Subsequent Activation (Cache Hit)

| Field | Value |
|-------|-------|
| Actor | Developer |
| Precondition | Binary already cached from previous activation |
| Trigger | VS Code activates extension |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | — | Extension activates, calls `NativeAddonManager.ensure()` |
| 2 | — | Detect platform/arch/ABI |
| 3 | — | Check cache: `fs.existsSync(cachePath/better_sqlite3.node)` → true |
| 4 | — | Verify file size > 0 (basic integrity check) |
| 5 | — | Return cache path immediately (no network call) |
| 6 | — | Spawn MCP server with cached binary |

**Postcondition:** MCP server starts in < 2 seconds.

---

### UC-3: Cache Invalidation (Version/ABI Change)

| Field | Value |
|-------|-------|
| Actor | Developer |
| Precondition | Cached binary exists but for different version or ABI |
| Trigger | Extension updated with new better-sqlite3 version, or VS Code updated with new Electron |

**Main Flow:**

| Step | System |
|------|--------|
| 1 | Detect current version + ABI |
| 2 | Construct cache path with new version/ABI |
| 3 | Cache miss (different directory) → trigger download |
| 4 | Download new binary, save to new cache path |
| 5 | Old cache remains (user can manually clean) |

---

### UC-4: Checksum Verification Failure

| Field | Value |
|-------|-------|
| Actor | Developer |
| Precondition | Download completed but file is corrupt |
| Trigger | SHA-256 mismatch after download |

**Main Flow:**

| Step | System |
|------|--------|
| 1 | Compute SHA-256 of downloaded file |
| 2 | Compare with expected checksum from manifest |
| 3 | Mismatch → delete corrupt file |
| 4 | Retry download (up to 2 retries) |
| 5 | If still fails → show error with manual download link |

---

### UC-5: CI Build and Publish Prebuilt Binaries

| Field | Value |
|-------|-------|
| Actor | CI System (GitHub Actions) |
| Precondition | Workflow triggered (manual dispatch or version bump) |
| Trigger | Push to main with version change, or manual workflow_dispatch |

**Main Flow:**

| Step | System |
|------|--------|
| 1 | Checkout repository |
| 2 | Set up Node.js with target Electron headers |
| 3 | Run `node-gyp rebuild` for better-sqlite3 targeting Electron ABI |
| 4 | Rename output to `better-sqlite3-v{ver}-napi-v{napi}-{platform}-{arch}.node` |
| 5 | Compute SHA-256 checksum |
| 6 | Upload as GitHub Release asset |
| 7 | Update `release-manifest.json` with new entry |

---

## 3. Functional Requirements

### 3.1 NativeAddonManager Module

#### 3.1.1 Platform Detection

| Property | Source | Example Values |
|----------|--------|----------------|
| platform | `process.platform` | win32, darwin, linux |
| arch | `process.arch` | x64, arm64 |
| napiVersion | `process.versions.napi` | 9 |
| nodeABI | `process.versions.modules` | 121 |
| electronVersion | `process.versions.electron` | 28.2.0 |

**Business Rule BR-1:** The extension uses N-API (Node-API) versioning, NOT Electron ABI. N-API binaries are forward-compatible across Node/Electron versions as long as the N-API version is supported. This simplifies the build matrix significantly.

**Business Rule BR-2:** Supported platform matrix:

| Platform | Architecture | N-API Version | Status |
|----------|-------------|---------------|--------|
| win32 | x64 | 9 | Supported |
| darwin | x64 | 9 | Supported |
| darwin | arm64 | 9 | Supported |
| linux | x64 | 9 | Supported |
| linux | arm64 | 9 | Future |

#### 3.1.2 Cache Management

**Cache Path Formula:**
```
{globalStorageUri}/native-addons/better-sqlite3/v{version}/napi-v{napiVersion}-{platform}-{arch}/better_sqlite3.node
```

**Example:**
```
~/.vscode/extensions/globalStorage/kiro-sdlc-agents/native-addons/better-sqlite3/v11.7.0/napi-v9-win32-x64/better_sqlite3.node
```

**Business Rule BR-3:** Cache is keyed by `{version}/{napi}-{platform}-{arch}`. Same N-API version across Electron updates = cache hit.

**Business Rule BR-4:** Cache cleanup is NOT automatic. Old versions remain until user manually deletes `globalStorageUri/native-addons/`.

#### 3.1.3 Download Logic

**Download URL Pattern:**
```
https://github.com/{OWNER}/{REPO}/releases/download/v{VERSION}/better-sqlite3-v{VERSION}-napi-v{NAPI}-{PLATFORM}-{ARCH}.node
```

**Business Rule BR-5:** Download uses HTTPS only. No HTTP fallback.

**Business Rule BR-6:** Retry policy: max 3 attempts, exponential backoff (2s, 4s, 8s).

**Business Rule BR-7:** Timeout: 60 seconds per attempt.

#### 3.1.4 Integrity Verification

**Business Rule BR-8:** SHA-256 checksum verification is MANDATORY after every download.

**Checksum Source:** `release-manifest.json` bundled with the extension (updated at build time).

```json
{
  "better-sqlite3": {
    "version": "11.7.0",
    "binaries": {
      "napi-v9-win32-x64": {
        "url": "https://github.com/.../better-sqlite3-v11.7.0-napi-v9-win32-x64.node",
        "sha256": "abc123...",
        "size": 5242880
      }
    }
  }
}
```

#### 3.1.5 API Contract — NativeAddonManager

```typescript
interface NativeAddonManager {
  /**
   * Ensure the native addon is available. Downloads if not cached.
   * @returns Path to directory containing better_sqlite3.node, or null if unavailable.
   */
  ensure(progress?: vscode.Progress<{message?: string; increment?: number}>): Promise<string | null>;

  /**
   * Get the cached binary path without downloading.
   * @returns Path if cached, null if not.
   */
  getCachedPath(): string | null;

  /**
   * Force re-download (e.g., after corruption detected).
   */
  redownload(): Promise<string | null>;

  /**
   * Get platform info for diagnostics.
   */
  getPlatformInfo(): PlatformInfo;
}

interface PlatformInfo {
  platform: string;
  arch: string;
  napiVersion: string;
  electronVersion: string;
  supported: boolean;
  cacheDir: string;
}
```

### 3.2 MCP Server Integration

#### 3.2.1 Server Spawn Modification

The `McpServerManager.spawn()` method must be modified to:

1. Call `NativeAddonManager.ensure()` BEFORE spawning the child process
2. If `ensure()` returns a path → set environment variable for the child process
3. If `ensure()` returns null → do NOT spawn, set status to "stopped", show error

**Modified spawn flow:**
```
spawn() {
  const addonPath = await nativeAddonManager.ensure();
  if (!addonPath) {
    this.setStatus("stopped");
    showError("Native module unavailable. MCP server cannot start.");
    return;
  }
  
  const child = spawn("node", [entryPath, ...args], {
    env: {
      ...process.env,
      BETTER_SQLITE3_BINDING: path.join(addonPath, "better_sqlite3.node")
    }
  });
}
```

#### 3.2.2 MCP Server Binary Loading

The MCP server (`mcp-code-intelligence-nodejs`) must be modified to load `better-sqlite3` from the path specified by `BETTER_SQLITE3_BINDING` environment variable instead of the default `node_modules` location.

**Approach:** Create a custom require hook or modify the `DatabaseManager` to use the explicit binding path.

```typescript
// In database-manager.ts
import Database from 'better-sqlite3';

function createDatabase(dbPath: string): Database.Database {
  const bindingPath = process.env.BETTER_SQLITE3_BINDING;
  if (bindingPath) {
    return new Database(dbPath, { nativeBinding: bindingPath });
  }
  return new Database(dbPath);
}
```

**Note:** `better-sqlite3` supports `nativeBinding` option in its constructor since v9.0.0.

### 3.3 Progress Notification

#### 3.3.1 UI Specification

| Element | Type | Description |
|---------|------|-------------|
| Title | Text | "Kiro SDLC: Downloading native module..." |
| Progress | Bar | Percentage based on bytes downloaded / total size |
| Message | Text | "{filename} ({downloaded}MB / {total}MB)" |
| Cancel | Button | Cancels download, shows info message |

**Business Rule BR-9:** Progress notification uses `vscode.ProgressLocation.Notification` (bottom-right toast).

**Business Rule BR-10:** Progress updates every 100KB or 500ms, whichever comes first.

### 3.4 Error Handling

#### 3.4.1 Error Classification

| Error Code | Category | User Message | Recovery |
|------------|----------|-------------|----------|
| ENOTFOUND | Network | "Cannot reach download server. Check internet connection." | Retry on next activation |
| ETIMEDOUT | Network | "Download timed out after 60s. Try again later." | Retry on next activation |
| HTTP_404 | Server | "Binary not available for {platform}-{arch}. Report issue." | Manual build required |
| HTTP_5xx | Server | "Download server error. Try again later." | Retry on next activation |
| CHECKSUM_MISMATCH | Integrity | "Downloaded file is corrupt. Retrying..." | Auto-retry |
| ENOSPC | Disk | "Insufficient disk space. Free space and restart." | Manual fix |
| EPERM | Permission | "Cannot write to cache directory. Check permissions." | Manual fix |
| UNSUPPORTED_PLATFORM | Compatibility | "Platform {platform}-{arch} not supported." | Manual build |

#### 3.4.2 Error Notification Format

```
❌ Kiro SDLC: Native module download failed

{Error message}

[Retry] [Manual Download] [Dismiss]
```

- **Retry:** Calls `NativeAddonManager.redownload()`
- **Manual Download:** Opens browser to GitHub Releases page
- **Dismiss:** Closes notification, MCP server remains stopped

### 3.5 Release Manifest

#### 3.5.1 Manifest Schema

File: `resources/release-manifest.json` (bundled with extension)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "better-sqlite3": {
      "type": "object",
      "properties": {
        "version": { "type": "string" },
        "releaseUrl": { "type": "string", "format": "uri" },
        "binaries": {
          "type": "object",
          "additionalProperties": {
            "type": "object",
            "properties": {
              "url": { "type": "string", "format": "uri" },
              "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
              "size": { "type": "integer" }
            },
            "required": ["url", "sha256", "size"]
          }
        }
      },
      "required": ["version", "binaries"]
    }
  }
}
```

#### 3.5.2 Manifest Update Process

1. CI builds binaries → computes checksums
2. CI updates `release-manifest.json` in the extension source
3. Extension build includes updated manifest
4. Extension reads manifest at runtime to get URLs + checksums

### 3.6 CI/CD Workflow

#### 3.6.1 GitHub Actions Workflow

**Trigger:** `workflow_dispatch` with inputs for better-sqlite3 version and N-API target.

**Build Matrix:**

| Runner | Platform | Arch | Output |
|--------|----------|------|--------|
| ubuntu-latest | linux | x64 | better-sqlite3-v{ver}-napi-v9-linux-x64.node |
| macos-latest | darwin | x64 | better-sqlite3-v{ver}-napi-v9-darwin-x64.node |
| macos-14 | darwin | arm64 | better-sqlite3-v{ver}-napi-v9-darwin-arm64.node |
| windows-latest | win32 | x64 | better-sqlite3-v{ver}-napi-v9-win32-x64.node |

**Steps per platform:**
1. Checkout
2. Setup Node.js 20
3. `npm install better-sqlite3@{version}` (triggers native build)
4. Copy `.node` file from `node_modules/better-sqlite3/build/Release/`
5. Rename to standard naming convention
6. Compute SHA-256
7. Upload as release asset

### 3.7 Proxy Support

**Business Rule BR-11:** Download respects VS Code proxy settings:
- `http.proxy` configuration
- `http.proxyStrictSSL` configuration
- `HTTP_PROXY` / `HTTPS_PROXY` environment variables

**Implementation:** Use Node.js `https` module with proxy agent when proxy is configured.

---

## 4. Data Model

### 4.1 Release Manifest (Static — bundled with extension)

```
release-manifest.json
├── better-sqlite3
│   ├── version: "11.7.0"
│   ├── releaseUrl: "https://github.com/.../releases/tag/v11.7.0"
│   └── binaries
│       ├── napi-v9-win32-x64: { url, sha256, size }
│       ├── napi-v9-darwin-x64: { url, sha256, size }
│       ├── napi-v9-darwin-arm64: { url, sha256, size }
│       └── napi-v9-linux-x64: { url, sha256, size }
```

### 4.2 Cache Directory (Dynamic — on user's machine)

```
{globalStorageUri}/
└── native-addons/
    └── better-sqlite3/
        └── v11.7.0/
            └── napi-v9-win32-x64/
                └── better_sqlite3.node  (5-8 MB)
```

### 4.3 Download State (In-memory during activation)

| Field | Type | Description |
|-------|------|-------------|
| status | enum | idle, downloading, verifying, done, failed |
| bytesDownloaded | number | Current progress |
| totalBytes | number | Expected total (from manifest) |
| attempts | number | Current retry count (0-2) |
| error | string? | Last error message |

---

## 5. Non-Functional Requirements

| Category | Requirement | Target | Measurement |
|----------|-------------|--------|-------------|
| Performance | First activation (with download) | < 30s on 10 Mbps | Time from activate() to MCP running |
| Performance | Subsequent activation (cache hit) | < 2s | Time from activate() to MCP running |
| Reliability | Download success rate | > 99% | With retries, stable internet |
| Security | Binary integrity | SHA-256 verified | Every download checked |
| Security | Transport | HTTPS only | No HTTP fallback |
| Storage | Cache size per platform | < 10 MB | Single .node file |
| Compatibility | VS Code versions | 1.85+ | Electron 28+ / N-API 9 |
| Compatibility | Platforms | 4 targets | win32-x64, darwin-x64, darwin-arm64, linux-x64 |

---

## 6. State Diagram

![State Diagram](diagrams/state-download.png)

**States:**

| State | Description |
|-------|-------------|
| IDLE | Extension not yet activated |
| CHECKING_CACHE | Verifying if binary exists in cache |
| CACHE_HIT | Binary found, proceeding to spawn |
| DOWNLOADING | Downloading binary from GitHub |
| VERIFYING | Checking SHA-256 checksum |
| SAVING | Writing to cache directory |
| READY | Binary available, MCP can spawn |
| FAILED | Download/verification failed |
| RETRYING | Waiting before retry attempt |

---

## 7. Sequence Diagrams

### 7.1 First Activation (Download Required)

![Sequence — First Activation](diagrams/sequence-first-activation.png)

### 7.2 Subsequent Activation (Cache Hit)

![Sequence — Cache Hit](diagrams/sequence-cache-hit.png)

---

## 8. Integration Requirements

### 8.1 GitHub Releases API

| Aspect | Detail |
|--------|--------|
| Protocol | HTTPS |
| Auth | None (public release assets) |
| Rate Limit | 60 req/hour (unauthenticated) |
| Response | Binary file stream |
| Redirect | GitHub returns 302 → follow redirect to CDN |

### 8.2 VS Code Extension API

| API | Usage |
|-----|-------|
| `context.globalStorageUri` | Persistent cache location |
| `vscode.window.withProgress` | Download progress notification |
| `vscode.workspace.getConfiguration("http")` | Proxy settings |
| `vscode.env.openExternal` | Open manual download URL |

### 8.3 MCP Server (Child Process)

| Aspect | Detail |
|--------|--------|
| Communication | Environment variable `BETTER_SQLITE3_BINDING` |
| Startup | Server reads env var, passes to `better-sqlite3` constructor |
| Fallback | If env var not set, use default `require('better-sqlite3')` |

---

## 9. Open Issues

| # | Issue | Impact | Decision Needed |
|---|-------|--------|-----------------|
| 1 | Should old cached versions be auto-cleaned? | Disk space accumulation | Product decision |
| 2 | Should we support `linux-arm64` in v1? | Raspberry Pi / ARM servers | Scope decision |
| 3 | Should manifest be fetched from network (for updates without extension rebuild)? | Flexibility vs complexity | Architecture decision |

---

## 10. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | State Diagram | [state-download.png](diagrams/state-download.png) | [state-download.drawio](diagrams/state-download.drawio) |
| 3 | Sequence — First Activation | [sequence-first-activation.png](diagrams/sequence-first-activation.png) | [sequence-first-activation.drawio](diagrams/sequence-first-activation.drawio) |
| 4 | Sequence — Cache Hit | [sequence-cache-hit.png](diagrams/sequence-cache-hit.png) | [sequence-cache-hit.drawio](diagrams/sequence-cache-hit.drawio) |
