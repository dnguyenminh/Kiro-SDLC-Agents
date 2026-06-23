# Functional Specification Document (FSD)

## kiro-sdlc-agents — KSA-111: Prebuilt onnxruntime-node binaries — auto-download at runtime

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-111 |
| Title | Prebuilt onnxruntime-node binaries — auto-download at runtime |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2025-05-27 |
| Status | Draft (Retroactive) |
| Related BRD | BRD-v1-KSA-111.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-05-27 | BA Agent + TA Agent | Initiate document — retroactive FSD from implemented KSA-111 |

---

## 1. Introduction

### 1.1 Purpose

Đặc tả chức năng chi tiết cho hệ thống auto-download prebuilt onnxruntime-node binaries. Document này mô tả use cases, data flows, processing logic, và error handling cho OnnxAddonManager và các components liên quan.

### 1.2 Scope

Bao gồm:
- OnnxAddonManager class (extension side)
- CI workflow build binaries
- Release manifest structure
- MCP server integration (ONNX_RUNTIME_PATH injection)
- onnx-provider loading mechanism

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| ONNX | Open Neural Network Exchange — ML model format |
| N-API | Node.js native addon API — ABI-stable binary interface |
| globalStorageUri | VS Code persistent storage path per extension |
| tar.gz | Gzip-compressed tar archive |
| SHA-256 | Cryptographic hash for integrity verification |
| VSIX | VS Code extension package format |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-111.docx |
| NativeAddonManager source | `kiro-sdlc-agents/src/native-addon-manager.ts` |
| OnnxAddonManager source | `kiro-sdlc-agents/src/onnx-addon-manager.ts` |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

**External Actors:**
- **Developer** — VS Code user who activates the extension
- **GitHub Releases** — Hosts prebuilt binary archives
- **GitHub Actions CI** — Builds and publishes binaries

**Internal Components:**
- **OnnxAddonManager** — Downloads, verifies, caches binaries
- **MCP Server Manager** — Spawns MCP server with env vars
- **ONNX Provider** — Loads onnxruntime-node from provided path

### 2.2 System Architecture

```
┌─────────────────────────────────────────────────────────┐
│ VS Code Extension (kiro-sdlc-agents)                     │
│                                                          │
│  ┌──────────────────┐    ┌─────────────────────────┐    │
│  │ extension.ts     │───▶│ OnnxAddonManager        │    │
│  │ (activation)     │    │ - ensure()              │    │
│  └──────────────────┘    │ - getCachedPath()       │    │
│                          │ - redownload()          │    │
│                          │ - getPlatformInfo()     │    │
│                          └───────────┬─────────────┘    │
│                                      │ path             │
│  ┌──────────────────┐               │                  │
│  │ MCP Server Mgr   │◀──────────────┘                  │
│  │ (spawn child)    │                                   │
│  └────────┬─────────┘                                   │
│           │ env: ONNX_RUNTIME_PATH                      │
└───────────┼─────────────────────────────────────────────┘
            │
┌───────────▼─────────────────────────────────────────────┐
│ MCP Code Intelligence Server (Node.js child process)     │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ onnx-provider.ts                                  │   │
│  │ - require(process.env.ONNX_RUNTIME_PATH)          │   │
│  │ - InferenceSession.create(modelPath)              │   │
│  │ - Tokenize → Run inference → Mean pool → Normalize│   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Functional Requirements

### 3.1 Feature: Binary Download & Cache Management

**Source:** BRD Story 1, 2

#### 3.1.1 Description

OnnxAddonManager manages the lifecycle of prebuilt onnxruntime-node native binaries: checking cache, downloading from GitHub Releases, verifying integrity, extracting, and providing the path to MCP server.

#### 3.1.2 Use Case: UC-1 Auto-Download on First Activation

**Use Case ID:** UC-1
**Actor:** Developer (implicit — extension activation)
**Preconditions:** Extension installed, `release-manifest.json` exists with valid entries
**Postconditions:** Binary cached at `{globalStorageUri}/native-addons/onnxruntime-node/v{version}/{platform}-{arch}/onnxruntime-node/`

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Extension | Extension activates, creates OnnxAddonManager instance |
| 2 | | OnnxAddonManager | Loads `release-manifest.json` from extension resources |
| 3 | | OnnxAddonManager | Calls `getPlatformInfo()` — determines platform/arch/cacheKey |
| 4 | | OnnxAddonManager | Checks marker file: `{cacheDir}/onnxruntime-node/package.json` |
| 5 | | OnnxAddonManager | Marker not found → initiates download with VS Code progress notification |
| 6 | | OnnxAddonManager | Downloads tar.gz via HTTPS (follows redirects, max 10) |
| 7 | | OnnxAddonManager | Reports progress: `"ONNX Runtime: {mb} MB / {total} MB ({percent}%)"` |
| 8 | | OnnxAddonManager | Download complete → computes SHA-256 hash |
| 9 | | OnnxAddonManager | Hash matches manifest → extracts tar.gz to cache directory |
| 10 | | OnnxAddonManager | Verifies marker file exists after extraction |
| 11 | | OnnxAddonManager | Returns path: `{cacheDir}/onnxruntime-node` |
| 12 | | MCP Server Manager | Spawns MCP server with `ONNX_RUNTIME_PATH={path}` |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | Binary already cached (marker exists) | Skip steps 5-10, return cached path immediately |
| AF-2 | User cancels download | Show info message, return null, MCP server starts without ONNX |
| AF-3 | Platform not in manifest | Log to output channel, return null |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | SHA-256 mismatch | Delete tar.gz, retry (max 3 attempts with backoff 0s/2s/4s) |
| EF-2 | Network error / timeout | Retry with backoff, after 3 failures show warning with Retry/Manual buttons |
| EF-3 | Extraction fails (marker not found) | Retry download from scratch |
| EF-4 | Manifest file missing | Return null immediately, log warning |

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-1 | Binary is downloaded only once per version per platform | BRD Story 2 |
| BR-2 | SHA-256 must match before extraction | BRD Story 3 |
| BR-3 | Max 3 download attempts per activation | BRD Story 1 |
| BR-4 | Backoff between retries: 0s, 2s, 4s | Implementation |
| BR-5 | Download timeout: 120 seconds per attempt | Implementation |
| BR-6 | Max 10 HTTP redirects followed | Implementation |
| BR-7 | Extension must not crash if download fails | BRD Story 4 |
| BR-8 | Cache is version-specific (new version = new directory) | BRD Story 2 |

#### 3.1.4 Data Specifications

**Input Data (release-manifest.json):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| onnxruntime-node.version | string | Y | semver format | ONNX Runtime version |
| onnxruntime-node.releaseUrl | string | Y | Valid URL | GitHub Release page URL |
| onnxruntime-node.binaries.{key}.url | string | Y | Valid HTTPS URL | Download URL for tar.gz |
| onnxruntime-node.binaries.{key}.sha256 | string | Y | 64 hex chars | SHA-256 hash of archive |
| onnxruntime-node.binaries.{key}.size | number | Y | > 0 | Expected file size in bytes |

**Output Data (OnnxAddonManager.ensure()):**

| Field | Type | Description |
|-------|------|-------------|
| return value | string \| null | Path to `onnxruntime-node/` directory, or null if unavailable |

**Cache Directory Structure:**

```
{globalStorageUri}/
  native-addons/
    onnxruntime-node/
      v1.22.0/
        win32-x64/
          onnxruntime-node/     ← returned path
            bin/                ← native .dll/.so/.dylib
            dist/               ← JS wrappers
            package.json        ← marker file
          onnxruntime-common/   ← JS peer dependency
```

#### 3.1.5 UI Specifications

**No dedicated UI screens.** Interaction via VS Code notification API:

| No. | Element | Type | Behavior |
|-----|---------|------|----------|
| 1 | Download progress | Notification (ProgressLocation.Notification) | Shows "Kiro SDLC: Downloading ONNX Runtime..." with percentage |
| 2 | Cancel button | Notification cancel | Cancels download, shows info message |
| 3 | Success (implicit) | Notification auto-dismiss | Progress notification disappears on completion |
| 4 | Failure warning | Warning message | "Failed to download ONNX Runtime. Embedding/graph features will be disabled." with Retry/Manual Download buttons |
| 5 | Cancel info | Info message | "ONNX Runtime download cancelled. Embedding features will be disabled." |

---

### 3.2 Feature: SHA-256 Integrity Verification

**Source:** BRD Story 3

#### 3.2.1 Description

Every downloaded archive is verified against the SHA-256 hash stored in `release-manifest.json` before extraction. This prevents use of corrupted or tampered binaries.

#### 3.2.2 Use Case: UC-2 Verify Download Integrity

**Use Case ID:** UC-2
**Actor:** System (automatic after download)
**Preconditions:** tar.gz file downloaded to cache directory
**Postconditions:** File verified and ready for extraction, OR deleted and retry triggered

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | OnnxAddonManager | Read downloaded tar.gz file as stream |
| 2 | | OnnxAddonManager | Compute SHA-256 using `crypto.createHash('sha256')` |
| 3 | | OnnxAddonManager | Compare computed hash with `manifest.binaries[cacheKey].sha256` |
| 4 | | OnnxAddonManager | Match → proceed to extraction |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Hash mismatch | Log mismatch (first 16 chars of each hash), delete tar.gz, increment retry counter |

#### 3.2.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-9 | Hash comparison is case-sensitive hex string comparison | Implementation |
| BR-10 | On mismatch, file MUST be deleted before retry | Security |
| BR-11 | Mismatch details logged to output channel (truncated hashes) | Debugging |

---

### 3.3 Feature: Tar.gz Extraction

**Source:** BRD Story 1 (part of download flow)

#### 3.3.1 Description

Custom minimal tar parser extracts downloaded archive to cache directory. Supports regular files and directories (POSIX ustar format).

#### 3.3.2 Use Case: UC-3 Extract Archive

**Use Case ID:** UC-3
**Actor:** System (automatic after verification)
**Preconditions:** SHA-256 verified tar.gz exists in cache directory
**Postconditions:** Files extracted to `{cacheDir}/onnxruntime-node/` and `{cacheDir}/onnxruntime-common/`

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | OnnxAddonManager | Create read stream from tar.gz |
| 2 | | OnnxAddonManager | Pipe through `zlib.createGunzip()` |
| 3 | | OnnxAddonManager | Parse tar headers (512-byte blocks) |
| 4 | | OnnxAddonManager | For each entry: validate path (no traversal), create dirs/files |
| 5 | | OnnxAddonManager | Delete tar.gz after successful extraction |
| 6 | | OnnxAddonManager | Verify marker file `onnxruntime-node/package.json` exists |

#### 3.3.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-12 | Path traversal prevention: all extracted paths must start with targetDir | Security |
| BR-13 | Supports tar type flags: '0' (file), '5' (directory), '\0' (file) | Implementation |
| BR-14 | POSIX ustar prefix (bytes 345-499) supported for long paths | Implementation |
| BR-15 | Leading "./" stripped from filenames | Implementation |
| BR-16 | tar.gz deleted after successful extraction (cleanup) | Storage |

---

### 3.4 Feature: Graceful Fallback

**Source:** BRD Story 4

#### 3.4.1 Description

When ONNX Runtime binary is unavailable (download failed, unsupported platform, no manifest), the system degrades gracefully — embedding features disabled but extension continues working.

#### 3.4.2 Use Case: UC-4 Fallback to BM25-only Search

**Use Case ID:** UC-4
**Actor:** System
**Preconditions:** `OnnxAddonManager.ensure()` returned null
**Postconditions:** MCP server running without embedding, semantic search uses BM25 only

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | MCP Server Manager | Receives null from OnnxAddonManager |
| 2 | | MCP Server Manager | Spawns MCP server WITHOUT `ONNX_RUNTIME_PATH` env var |
| 3 | | onnx-provider | `process.env.ONNX_RUNTIME_PATH` is undefined |
| 4 | | onnx-provider | Tries `import('onnxruntime-node')` (npm fallback) |
| 5 | | onnx-provider | If import fails → throws error, embedding disabled |
| 6 | | Memory system | Falls back to BM25-only search (no vector similarity) |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | npm `onnxruntime-node` installed | Step 4 succeeds, embedding works via npm package |

---

### 3.5 Feature: CI Build Pipeline

**Source:** BRD Story 5

#### 3.5.1 Description

GitHub Actions workflow builds prebuilt binaries for 4 platforms, packages them as tar.gz archives with checksums, and uploads to GitHub Releases.

#### 3.5.2 Use Case: UC-5 Build and Publish Binaries

**Use Case ID:** UC-5
**Actor:** Developer (triggers workflow_dispatch) or CI automation
**Preconditions:** GitHub Actions configured, repository has release permissions
**Postconditions:** 4 tar.gz archives + 4 .sha256 files uploaded to GitHub Release

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Triggers `build-onnxruntime.yml` workflow (manual dispatch) |
| 2 | | CI (prepare job) | Generates build matrix: 4 platform combinations |
| 3 | | CI (build job x4) | For each platform: setup Node.js, `npm install onnxruntime-node@{version}` |
| 4 | | CI (build job x4) | Package: copy bin/, dist/, package.json + onnxruntime-common → tar.gz |
| 5 | | CI (build job x4) | Generate SHA-256 checksum file |
| 6 | | CI (release job) | Create/update GitHub Release with tag `onnxruntime-node-v{version}` |
| 7 | | CI (release job) | Upload all tar.gz archives (clobber existing) |

#### 3.5.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-17 | Build matrix: windows-latest/win32-x64, ubuntu-latest/linux-x64, macos-latest/darwin-x64, macos-14/darwin-arm64 | Implementation |
| BR-18 | N-API = one binary per platform (not per Node version) | onnxruntime-node design |
| BR-19 | Release tag format: `onnxruntime-node-v{version}` | Convention |
| BR-20 | Archive name format: `onnxruntime-node-v{version}-{platform}-{arch}.tar.gz` | Convention |
| BR-21 | Upload uses `--clobber` to allow re-runs | CI reliability |

---

## 4. Data Model

### 4.1 Release Manifest Schema

```json
{
  "onnxruntime-node": {
    "version": "string (semver)",
    "releaseUrl": "string (URL)",
    "binaries": {
      "{platform}-{arch}": {
        "url": "string (HTTPS URL)",
        "sha256": "string (64 hex chars)",
        "size": "number (bytes)"
      }
    }
  }
}
```

### 4.2 Platform Info Interface

```typescript
interface OnnxPlatformInfo {
    platform: NodeJS.Platform;  // "win32" | "linux" | "darwin"
    arch: string;               // "x64" | "arm64"
    supported: boolean;         // true if platform-arch in manifest
    cacheKey: string;           // "{platform}-{arch}"
    cacheDir: string;           // full path to cache directory
}
```

### 4.3 Supported Platforms

| Platform | Arch | Cache Key | Binary Size | Runner |
|----------|------|-----------|-------------|--------|
| win32 | x64 | win32-x64 | ~25 MB | windows-latest |
| linux | x64 | linux-x64 | ~11 MB | ubuntu-latest |
| darwin | x64 | darwin-x64 | ~10 MB | macos-latest |
| darwin | arm64 | darwin-arm64 | ~9 MB | macos-14 |

---

## 5. Integration Specifications

### 5.1 External System: GitHub Releases

| Attribute | Value |
|-----------|-------|
| Purpose | Host prebuilt binary archives for download |
| Direction | Outbound (extension downloads from GitHub) |
| Data Format | Binary (tar.gz) |
| Frequency | On-demand (first activation or cache miss) |
| Protocol | HTTPS with redirect following |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| Platform key (e.g., win32-x64) | tar.gz archive | Receive | URL from manifest |
| — | SHA-256 checksum | Receive (embedded in manifest) | Verified locally |

### 5.2 Internal Integration: MCP Server Process

| Attribute | Value |
|-----------|-------|
| Purpose | Pass ONNX binary path to child process |
| Direction | Outbound (extension → MCP server) |
| Mechanism | Environment variable (`ONNX_RUNTIME_PATH`) |
| Frequency | Once per MCP server spawn |

**Data Exchange:**

| Extension Side | MCP Server Side | Mechanism |
|---------------|-----------------|-----------|
| `OnnxAddonManager.ensure()` result | `process.env.ONNX_RUNTIME_PATH` | env var in spawn options |
| Path to `onnxruntime-node/` directory | `require(path)` loads native binary | Node.js require() |

---

## 6. Processing Logic

### 6.1 Download with Retry

**Trigger:** Cache miss detected in `ensure()`
**Input:** URL, expected SHA-256, expected size from manifest
**Output:** Extracted binary in cache directory, or null

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Create cache directory (recursive mkdir) | Throw if permission denied |
| 2 | Download tar.gz via HTTPS (follow redirects) | Timeout 120s → retry |
| 3 | Report progress via VS Code notification | — |
| 4 | Compute SHA-256 of downloaded file | — |
| 5 | Compare hash with manifest | Mismatch → delete file, retry |
| 6 | Extract tar.gz (gunzip + tar parse) | Parse error → retry |
| 7 | Delete tar.gz (cleanup) | Ignore errors |
| 8 | Verify marker file exists | Missing → retry |

**Retry Logic:**
```
maxAttempts = 3
backoffs = [0, 2000, 4000]  // milliseconds

for attempt in 0..maxAttempts:
    if cancellationRequested: return null
    if attempt > 0: sleep(backoffs[attempt])
    try:
        download → verify → extract → return path
    catch:
        log error, continue
        
// All failed
showWarning("Failed to download ONNX Runtime...", "Retry", "Manual Download")
return null
```

### 6.2 Tar Parsing

**Trigger:** Successful SHA-256 verification
**Input:** Uncompressed tar buffer (from gunzip)
**Output:** Files written to target directory

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Read 512-byte header block | End-of-archive if all zeros |
| 2 | Extract filename (bytes 0-99) + prefix (bytes 345-499) | — |
| 3 | Strip leading "./" from filename | — |
| 4 | Read file size (bytes 124-135, octal) | Default 0 if parse fails |
| 5 | Read type flag (byte 156) | — |
| 6 | Validate: `path.join(targetDir, fileName)` starts with targetDir | Skip entry if traversal detected |
| 7 | Type '5' or ends with '/': create directory | recursive: true |
| 8 | Type '0' or '\0': write file data | Create parent dirs first |
| 9 | Advance offset by ceil(fileSize / 512) * 512 | — |

---

## 7. Security Requirements

### 7.1 Integrity Verification

| Mechanism | Implementation | Purpose |
|-----------|---------------|---------|
| SHA-256 checksum | `crypto.createHash('sha256')` stream | Detect corrupted/tampered downloads |
| Path traversal prevention | `fullPath.startsWith(targetDir)` check | Prevent malicious tar entries writing outside cache |
| HTTPS only | URL validation in manifest | Prevent MITM attacks |

### 7.2 Data Sensitivity

| Data Type | Classification | Handling |
|-----------|---------------|----------|
| Binary archives | Internal | Downloaded to user's globalStorage only |
| SHA-256 hashes | Public | Stored in manifest, shipped with extension |
| Download URLs | Public | GitHub Release URLs, no auth required |

---

## 8. Non-Functional Requirements

| Category | Requirement | Acceptance Criteria |
|----------|-------------|---------------------|
| Performance | Cache hit < 10ms | `fs.existsSync()` only — no network I/O |
| Performance | Download shows progress | Update notification every 1% |
| Reliability | 3 retries with backoff | Handles transient network failures |
| Reliability | Graceful degradation | Extension works without ONNX |
| Storage | Max 25 MB per platform | Single version cached at a time |
| Security | SHA-256 verification | Every download verified |
| Security | No path traversal | Tar parser validates all paths |
| Usability | Cancellable download | VS Code notification cancel button |
| Compatibility | 4 platforms | win32-x64, linux-x64, darwin-x64, darwin-arm64 |

---

## 9. Error Handling (User-Facing)

### 9.1 Error Scenarios

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| Download timeout | Warning | "Failed to download ONNX Runtime. Embedding/graph features will be disabled." | Retry/Manual Download buttons |
| SHA-256 mismatch (all retries) | Warning | Same as above | Same buttons |
| User cancels download | Info | "ONNX Runtime download cancelled. Embedding features will be disabled." | Extension continues normally |
| Unsupported platform | Info | (Output channel only) "[OnnxAddon] Platform {p}-{a} not supported" | No user notification, silent skip |
| Manifest missing | Info | (Output channel only) "[OnnxAddon] No onnxruntime-node entry in release-manifest.json" | Silent skip |

### 9.2 Notification Requirements

| Event | Who is Notified | Channel | Timing |
|-------|----------------|---------|--------|
| Download progress | Developer | VS Code notification | Real-time during download |
| Download failure | Developer | VS Code warning message | After all retries exhausted |
| Download cancelled | Developer | VS Code info message | Immediately on cancel |
| Cache hit / platform skip | Developer | Output channel (debug) | On activation |

---

## 10. Testing Considerations

### 10.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-1 | First activation, binary not cached | Clean globalStorage | Download starts, binary cached, path returned | High |
| TC-2 | Second activation, binary cached | Existing cache with marker | No download, path returned immediately | High |
| TC-3 | SHA-256 mismatch | Corrupted tar.gz | File deleted, retry triggered | High |
| TC-4 | All retries fail | Network unavailable | Warning shown, null returned, extension works | High |
| TC-5 | User cancels download | Cancel button clicked | Info message, null returned | Medium |
| TC-6 | Unsupported platform | linux-arm64 | Null returned, logged to output | Medium |
| TC-7 | Manifest missing | No release-manifest.json | Null returned, logged | Medium |
| TC-8 | Path traversal in tar | Malicious tar entry `../../etc/passwd` | Entry skipped, no file written outside cache | High |
| TC-9 | Redirect following | GitHub Release URL (302 → actual file) | Follows up to 10 redirects | Medium |
| TC-10 | Version upgrade | New version in manifest | New cache dir created, old untouched | Medium |

---

## 11. Appendix

### State Diagram: OnnxAddonManager Lifecycle

![State Diagram](diagrams/state-onnx-lifecycle.png)

### Sequence Diagram: Download Flow

![Sequence Diagram](diagrams/sequence-download.png)

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | State Diagram | [state-onnx-lifecycle.png](diagrams/state-onnx-lifecycle.png) | [state-onnx-lifecycle.drawio](diagrams/state-onnx-lifecycle.drawio) |
| 3 | Sequence Diagram | [sequence-download.png](diagrams/sequence-download.png) | [sequence-download.drawio](diagrams/sequence-download.drawio) |

### Change Log from BRD

No deviations from BRD. FSD adds technical detail to all 5 user stories while maintaining the same acceptance criteria.
