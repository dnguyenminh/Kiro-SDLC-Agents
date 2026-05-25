# Business Requirements Document (BRD)

## Kiro SDLC Agents — KSA-175: Runtime Self-Download better-sqlite3

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-175 |
| Title | Runtime Self-Download better-sqlite3 Prebuilt Binary |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-01-27 |
| Status | Approved |
| Related BRD | BRD-v1-KSA-175.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-27 | BA Agent | Initial document — requirements from user discussion on native addon installation issues |
| 1.1 | 2025-05-25 | SM Agent | Updated URLs to actual repo (dnguyenminh/Kiro-SDLC-Agents), status → Approved, aligned with N-API strategy |

---

## 1. Introduction

### 1.1 Scope

The `kiro-sdlc-agents` VS Code extension bundles `mcp-code-intelligence-nodejs` which depends on `better-sqlite3`, a native Node.js addon requiring C++ compilation. Users without build tools (Visual Studio Build Tools, Python, node-gyp) cannot install the extension successfully.

This CR implements a **runtime self-download mechanism** where the extension automatically downloads a prebuilt `better-sqlite3` native binary on first activation, eliminating the need for local compilation toolchains.

### 1.2 Out of Scope

- Replacing better-sqlite3 with a pure-JS SQLite implementation (e.g., sql.js)
- Supporting architectures beyond win32-x64, linux-x64, darwin-x64, darwin-arm64
- Modifying the MCP server's SQLite usage patterns
- Auto-updating better-sqlite3 when a new version is released (manual trigger only)

### 1.3 Preliminary Requirement

- GitHub repository with Releases enabled for hosting prebuilt binaries
- CI/CD pipeline (GitHub Actions) capable of building native addons for multiple platforms
- Extension must have `globalStorageUri` access (standard VS Code extension API)

---

## 2. Business Requirements

### 2.1 High Level Process Map

The extension activation flow changes from:

**Current:** Extension activates → spawns MCP server → `require('better-sqlite3')` → **FAILS** if no build tools

**Proposed:** Extension activates → check cache for prebuilt binary → if missing, download from GitHub Releases → place in cache → spawns MCP server → `require('better-sqlite3')` from cache → **SUCCESS**

![Business Flow](diagrams/business-flow.png)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a developer, I want the extension to work without installing C++ build tools so that I can use it immediately after install | MUST HAVE | KSA-175 |
| 2 | As a developer, I want to see download progress so that I know the extension is working during first activation | MUST HAVE | KSA-175 |
| 3 | As a developer, I want the downloaded binary to persist across extension updates so that I don't re-download every time | MUST HAVE | KSA-175 |
| 4 | As a developer, I want a clear error message if download fails so that I can troubleshoot network issues | MUST HAVE | KSA-175 |
| 5 | As a CI maintainer, I want automated builds of prebuilt binaries for each platform so that releases are consistent | SHOULD HAVE | KSA-175 |
| 6 | As a developer, I want the extension to detect the correct Electron ABI version so that the binary is compatible with my VS Code version | MUST HAVE | KSA-175 |
| 7 | As a developer behind a corporate proxy, I want proxy settings to be respected during download so that it works in enterprise environments | SHOULD HAVE | KSA-175 |

![Use Case Diagram](diagrams/use-case.png)

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Extension activates (VS Code starts or workspace opens)

**Step 2:** Extension checks `globalStorageUri/native-addons/better-sqlite3/{platform}-{arch}-{abi}/` for cached binary

**Step 3:** If binary exists and checksum matches → proceed to Step 7

**Step 4:** If binary missing or corrupt → show VS Code progress notification "Downloading better-sqlite3..."

**Step 5:** Download prebuilt `.node` file from GitHub Releases URL matching current platform/arch/ABI

**Step 6:** Verify download integrity (SHA-256 checksum) → save to cache directory

**Step 7:** Set `NODE_PATH` or configure module resolution to use cached binary

**Step 8:** Spawn MCP server process with correct native addon path

**Step 9:** MCP server starts successfully with SQLite support

> **Note:** If download fails (network error, 404, checksum mismatch), show error notification with troubleshooting steps and do NOT spawn MCP server.

---

#### STORY 1: Zero-Config Installation

> As a developer, I want the extension to work without installing C++ build tools so that I can use it immediately after install.

**Requirement Details:**

1. Extension MUST NOT require `node-gyp`, Python, or Visual Studio Build Tools on the user's machine
2. The prebuilt binary MUST be downloaded automatically on first activation
3. Download MUST happen transparently — user only sees a progress notification
4. After successful download, subsequent activations MUST NOT trigger re-download (cache hit)

**Acceptance Criteria:**

1. Fresh install on Windows without build tools → extension activates successfully within 30 seconds (including download)
2. Fresh install on macOS without Xcode Command Line Tools → extension activates successfully
3. Fresh install on Linux without build-essential → extension activates successfully
4. No `npm install` or `node-gyp rebuild` commands are executed during activation

---

#### STORY 2: Download Progress Notification

> As a developer, I want to see download progress so that I know the extension is working during first activation.

**Requirement Details:**

1. Show VS Code `window.withProgress` notification during download
2. Display download percentage (bytes received / total bytes)
3. Notification title: "Kiro SDLC: Downloading native module..."
4. Allow cancellation (user can dismiss, but extension won't work without the binary)

**Acceptance Criteria:**

1. Progress notification appears within 1 second of activation when binary is not cached
2. Progress updates at least every 500ms during download
3. Notification disappears automatically on success
4. If cancelled, show info message explaining the extension needs the binary

---

#### STORY 3: Persistent Cache Across Updates

> As a developer, I want the downloaded binary to persist across extension updates so that I don't re-download every time.

**Requirement Details:**

1. Cache location: `context.globalStorageUri` (persists across extension updates, per VS Code API)
2. Cache structure: `native-addons/better-sqlite3/{version}/electron-v{abi}-{platform}-{arch}/better_sqlite3.node`
3. Cache invalidation: only when better-sqlite3 version changes OR Electron ABI changes
4. Extension update (same better-sqlite3 version, same ABI) → cache hit, no download

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| platform | string | Yes | OS identifier | win32, darwin, linux |
| arch | string | Yes | CPU architecture | x64, arm64 |
| abi | string | Yes | Electron/Node ABI version | 121, 125 |
| version | string | Yes | better-sqlite3 version | 11.7.0 |
| checksum | string | Yes | SHA-256 of .node file | a1b2c3... |

**Acceptance Criteria:**

1. After extension update (same better-sqlite3 version), activation takes < 2 seconds (no download)
2. After VS Code update that changes Electron ABI, binary is re-downloaded for new ABI
3. Cache directory size is < 10MB per platform (single .node file ~5MB)
4. Corrupt cache (checksum mismatch) triggers automatic re-download

---

#### STORY 4: Graceful Error Handling

> As a developer, I want a clear error message if download fails so that I can troubleshoot network issues.

**Requirement Details:**

1. Network timeout: 60 seconds per download attempt
2. Retry: 2 retries with exponential backoff (2s, 4s)
3. Error scenarios: network unreachable, 404 (binary not published), checksum mismatch, disk full
4. Error notification MUST include: what failed, why, and how to fix

**Error Handling:**

| Error | User Message | Recovery |
|-------|-------------|----------|
| Network timeout | "Download timed out. Check your internet connection and try restarting VS Code." | Retry on next activation |
| HTTP 404 | "Prebuilt binary not available for your platform ({platform}-{arch}-{abi}). Please report this issue." | Link to GitHub Issues |
| Checksum mismatch | "Downloaded file is corrupt. Retrying..." | Auto-retry, then show error |
| Disk full | "Cannot save native module — disk full. Free space in {globalStoragePath}." | Manual fix required |
| Proxy/SSL error | "Download blocked by network policy. Configure VS Code proxy settings." | Link to VS Code proxy docs |

**Acceptance Criteria:**

1. All error messages are actionable (user knows what to do next)
2. Failed download does NOT crash the extension — other features still work (minus MCP server)
3. Error state is recoverable — next activation retries download
4. Errors are logged to "Kiro MCP Server" output channel with full details

---

#### STORY 5: CI Workflow for Prebuilt Binaries

> As a CI maintainer, I want automated builds of prebuilt binaries for each platform so that releases are consistent.

**Requirement Details:**

1. GitHub Actions workflow triggered on: new better-sqlite3 version bump, manual dispatch
2. Build matrix: win32-x64, linux-x64, darwin-x64, darwin-arm64
3. Each build targets the Electron ABI version used by current VS Code stable
4. Output: `.node` files uploaded as GitHub Release assets
5. Release naming: `better-sqlite3-v{VERSION}-electron-v{ABI}-{PLATFORM}-{ARCH}.node`

**Acceptance Criteria:**

1. CI builds complete in < 10 minutes per platform
2. All 4 platform binaries are published as release assets
3. SHA-256 checksums are published alongside binaries (checksums.txt)
4. Workflow can be manually triggered for new Electron ABI versions

---

#### STORY 6: Electron ABI Detection

> As a developer, I want the extension to detect the correct Electron ABI version so that the binary is compatible with my VS Code version.

**Requirement Details:**

1. Detect Electron version from `process.versions.electron` (available in VS Code extension host)
2. Map Electron version → Node ABI number (e.g., Electron 28 → ABI 121)
3. Use detected ABI to construct download URL and cache path
4. If ABI mapping is unknown (very new VS Code), fall back to latest known ABI

**Acceptance Criteria:**

1. Extension correctly identifies ABI for VS Code 1.85+ (Electron 28+)
2. ABI detection works on all platforms (win32, darwin, linux)
3. Unknown Electron version → graceful fallback with warning message
4. ABI is logged to output channel for debugging

---

#### STORY 7: Proxy Support

> As a developer behind a corporate proxy, I want proxy settings to be respected during download so that it works in enterprise environments.

**Requirement Details:**

1. Respect VS Code's `http.proxy` and `http.proxyStrictSSL` settings
2. Respect environment variables: `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`
3. Use VS Code's built-in `https` module or `vscode.env` for proxy-aware requests

**Acceptance Criteria:**

1. Download works behind HTTP proxy configured in VS Code settings
2. Download works with `HTTPS_PROXY` environment variable
3. Self-signed proxy certificates work when `http.proxyStrictSSL` is false

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| GitHub Releases | Infrastructure | N/A | Hosting prebuilt binaries |
| GitHub Actions | Infrastructure | N/A | CI pipeline for building binaries |
| VS Code globalStorageUri | System | N/A | Persistent cache location |
| better-sqlite3 v11.7.0 | External Library | N/A | The native addon being pre-built |
| Electron ABI compatibility | System | N/A | Binary must match VS Code's Electron version |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Developer | Extension Users | End users who install the extension | N/A |
| Maintainer | dnguyenminh | Build and publish prebuilt binaries | Ticket reporter |
| CI/CD | GitHub Actions | Automated binary builds | Infrastructure |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| GitHub Releases unavailable (outage) | High — new users can't activate | Low | Cache persists; only affects first-time users during outage |
| Electron ABI changes frequently | Medium — need to rebuild binaries | Medium | CI workflow auto-triggers on VS Code release; maintain ABI mapping table |
| Binary size too large for slow connections | Low — poor UX on slow networks | Medium | Binary is ~5MB; show progress; support resume |
| Corporate firewalls block GitHub | High — enterprise users blocked | Medium | Document manual download option; support proxy |
| Platform not supported (e.g., linux-arm64) | Medium — some users excluded | Low | Document supported platforms; accept contributions |

### 5.2 Assumptions

- VS Code's `globalStorageUri` is writable and persists across extension updates
- GitHub Releases has sufficient bandwidth for binary distribution (no rate limiting for small files)
- better-sqlite3 prebuilt binaries are ABI-stable within the same Electron major version
- Users have internet access at least once (for initial download)
- VS Code extension host runs in the same Electron process (ABI detection is accurate)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | First activation < 30s | Including download on broadband (>10 Mbps) |
| Performance | Subsequent activation < 2s | Cache hit, no network call |
| Reliability | 99.9% download success | With retries, on stable internet |
| Security | SHA-256 checksum verification | Prevent tampered binaries |
| Security | HTTPS-only downloads | No HTTP fallback |
| Storage | < 10MB cache per platform | Single .node file ~5MB |
| Compatibility | VS Code 1.85+ | Electron 28+ ABI support |
| Compatibility | win32-x64, linux-x64, darwin-x64, darwin-arm64 | 4 platform targets |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-175 | Runtime Self-Download better-sqlite3 | To Do | Story | Main ticket |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| ABI | Application Binary Interface — defines binary compatibility between Node.js/Electron and native addons |
| Native Addon | A compiled C/C++ module loaded by Node.js via `require()` |
| better-sqlite3 | Synchronous SQLite3 binding for Node.js, requires native compilation |
| globalStorageUri | VS Code API providing persistent storage path that survives extension updates |
| Prebuilt Binary | A pre-compiled `.node` file for a specific platform/arch/ABI combination |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| better-sqlite3 GitHub | https://github.com/WiseLibs/better-sqlite3 |
| VS Code Extension API - globalStorageUri | https://code.visualstudio.com/api/references/vscode-api#ExtensionContext |
| Node.js ABI Version Table | https://nodejs.org/en/download/releases |
| Electron Releases | https://releases.electronjs.org/ |

### Download URL Pattern

```
https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/download/better-sqlite3-v{VERSION}/better-sqlite3-v{VERSION}-napi-v{NAPI}-{PLATFORM}-{ARCH}.node
```

Example:
```
https://github.com/dnguyenminh/Kiro-SDLC-Agents/releases/download/better-sqlite3-v11.7.0/better-sqlite3-v11.7.0-napi-v9-win32-x64.node
```

### Cache Directory Structure

```
{globalStorageUri}/
└── native-addons/
    └── better-sqlite3/
        └── v11.7.0/
            └── napi-v9-win32-x64/
                └── better_sqlite3.node
```

---

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
