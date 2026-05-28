# Business Requirements Document (BRD)

## kiro-sdlc-agents — KSA-111: Prebuilt onnxruntime-node binaries — auto-download at runtime

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-111 |
| Title | Prebuilt onnxruntime-node binaries — auto-download at runtime |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-05-27 |
| Status | Draft (Retroactive) |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | Duc Nguyen Minh – Product Owner | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-05-27 | BA Agent | Initiate document — retroactive BRD from implemented KSA-111 |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| Duc Nguyen Minh | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

Extension kiro-sdlc-agents bundle MCP Code Intelligence server cần `onnxruntime-node` native binary để chạy ONNX embedding model (semantic search, KB graph). Trước đây user phải tự `npm install onnxruntime-node` thủ công — gây lỗi khi mở graph features.

Giải pháp: Tương tự pattern đã có cho `better-sqlite3` (NativeAddonManager) — prebuilt binaries được build sẵn trong CI, host trên GitHub Releases, và auto-download tại runtime khi extension activate.

**Scope bao gồm:**
1. CI workflow build binaries cho 4 platforms (win32-x64, linux-x64, darwin-x64, darwin-arm64)
2. `OnnxAddonManager` class — download, verify SHA-256, extract, cache
3. Release manifest với URLs + checksums
4. Environment variable injection (`ONNX_RUNTIME_PATH`) vào MCP server process
5. MCP server onnx-provider load binary từ env var
6. Graceful fallback khi download fail (embedding disabled, no crash)

### 1.2 Out of Scope

- Thay đổi ONNX model (vẫn dùng all-MiniLM-L6-v2, 384d)
- Thay đổi embedding logic/algorithm
- Support thêm platforms ngoài 4 platforms trên (linux-arm64, win32-arm64)
- UI changes (download progress notification là VS Code native API)
- Bundling binary trực tiếp trong VSIX (quá lớn, ~55MB total)

### 1.3 Preliminary Requirement

- Extension kiro-sdlc-agents đã hoạt động với MCP Code Intelligence server
- NativeAddonManager pattern cho better-sqlite3 đã implement
- GitHub repository có quyền tạo Releases và upload assets
- GitHub Actions CI/CD đã configured
- `release-manifest.json` structure đã tồn tại (cho better-sqlite3)

---

## 2. Business Requirements

### 2.1 High Level Process Map

Khi user cài extension lần đầu hoặc upgrade version mới, extension tự động download ONNX Runtime native binary phù hợp với platform, verify integrity, cache locally, và inject path vào MCP server. User không cần thao tác gì thêm.

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a developer, I want ONNX Runtime to auto-download when I activate the extension so that I don't need to manually install native dependencies | MUST HAVE | KSA-111 |
| 2 | As a developer, I want downloaded binaries to be cached so that subsequent activations don't re-download | MUST HAVE | KSA-111 |
| 3 | As a developer, I want SHA-256 verification before using downloaded binaries so that I'm protected from corrupted/tampered downloads | MUST HAVE | KSA-111 |
| 4 | As a developer, I want graceful fallback when download fails so that the extension still works (without embedding features) | MUST HAVE | KSA-111 |
| 5 | As a developer on any major platform, I want prebuilt binaries available for my OS/arch so that I can use embedding features | MUST HAVE | KSA-111 |

---

### 2.3 Details of User Stories

---

#### Business Flow

![Business Flow](diagrams/business-flow.png)

**Step 1:** Extension activates → `OnnxAddonManager` initialized

**Step 2:** `ensure()` called → check if binary already cached at `{globalStorageUri}/native-addons/onnxruntime-node/v{version}/{platform}-{arch}/`

**Step 3:** If cached (marker file `onnxruntime-node/package.json` exists) → return cached path immediately

**Step 4:** If not cached → read `release-manifest.json` → get URL + SHA-256 for current platform

**Step 5:** Download `.tar.gz` from GitHub Release with progress notification (VS Code notification API)

**Step 6:** Compute SHA-256 of downloaded file → compare with manifest

**Step 7:** If checksum matches → extract tar.gz to cache directory

**Step 8:** If checksum fails → retry (max 3 attempts with backoff: 0s, 2s, 4s)

**Step 9:** After extraction → verify marker file exists → return path

**Step 10:** MCP server spawned with `ONNX_RUNTIME_PATH` env var → onnx-provider loads binary from path

> **Note:** If all download attempts fail, extension shows warning message and continues without embedding features. User can retry manually or download from release page.

---

#### STORY 1: Auto-download with progress notification

> As a developer, I want ONNX Runtime to auto-download when I activate the extension so that I don't need to manually install native dependencies

**Requirement Details:**

1. On extension activation, `OnnxAddonManager.ensure()` is called
2. If binary not in cache, download starts automatically
3. VS Code notification shows download progress (MB downloaded / total MB, percentage)
4. Download is cancellable by user via notification cancel button
5. If cancelled, show info message: "ONNX Runtime download cancelled. Embedding features will be disabled."
6. Download uses HTTPS with redirect following (max 10 redirects for GitHub Release URLs)
7. Timeout: 120 seconds per download attempt
8. User-Agent header: `kiro-sdlc-agents/1.0`

**Acceptance Criteria:**

1. ✅ AC1: When extension activates and binary not cached, download starts with progress notification showing percentage and MB
2. ✅ AC1.1: Download can be cancelled via notification button
3. ✅ AC1.2: After successful download, no notification remains (auto-dismiss)

---

#### STORY 2: Cache — no re-download

> As a developer, I want downloaded binaries to be cached so that subsequent activations don't re-download

**Requirement Details:**

1. Cache location: `{globalStorageUri}/native-addons/onnxruntime-node/v{version}/{platform}-{arch}/`
2. Cache marker: `onnxruntime-node/package.json` file existence
3. If marker exists → skip download, return path immediately
4. Cache is version-specific — upgrading onnxruntime version creates new cache directory
5. Old version caches are NOT automatically cleaned (manual cleanup by user)

**Acceptance Criteria:**

1. ✅ AC2: Second activation with same version → no download, instant path return
2. ✅ AC2.1: `getCachedPath()` returns path without triggering download
3. ✅ AC2.2: Different version → new download to new directory

---

#### STORY 3: SHA-256 verification before use

> As a developer, I want SHA-256 verification before using downloaded binaries so that I'm protected from corrupted/tampered downloads

**Requirement Details:**

1. After download completes, compute SHA-256 hash of `.tar.gz` file
2. Compare with `sha256` field in `release-manifest.json`
3. If mismatch → delete downloaded file, retry download
4. Only extract after checksum passes
5. Manifest contains pre-computed checksums for all 4 platform binaries

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| sha256 | string (hex) | Yes | SHA-256 hash of tar.gz archive | `c0ad166ab389b7a3c...` |
| size | number | Yes | Expected file size in bytes | `26126051` |
| url | string (URL) | Yes | Download URL on GitHub Releases | `https://github.com/.../onnxruntime-node-v1.22.0-win32-x64.tar.gz` |

**Acceptance Criteria:**

1. ✅ AC3: Corrupted download (hash mismatch) → file deleted, retry triggered
2. ✅ AC3.1: After max retries with hash mismatch → warning shown, embedding disabled
3. ✅ AC3.2: Successful verification logged to output channel

---

#### STORY 4: Graceful fallback (embedding disabled, no crash)

> As a developer, I want graceful fallback when download fails so that the extension still works (without embedding features)

**Requirement Details:**

1. If `OnnxAddonManager.ensure()` returns `null` → MCP server spawned WITHOUT `ONNX_RUNTIME_PATH`
2. MCP server onnx-provider: if `ONNX_RUNTIME_PATH` not set → try `import('onnxruntime-node')` (npm installed)
3. If both fail → embedding features disabled, semantic search falls back to BM25-only
4. Extension core features (code intelligence, file tools, memory CRUD) continue working
5. Warning message with "Retry" and "Manual Download" actions

**Acceptance Criteria:**

1. ✅ AC4: Download fails → extension activates normally, no crash
2. ✅ AC4.1: Warning message shown with actionable buttons (Retry / Manual Download)
3. ✅ AC4.2: "Retry" button triggers `redownload()`
4. ✅ AC4.3: "Manual Download" opens release page in browser

---

#### STORY 5: 4 platforms supported

> As a developer on any major platform, I want prebuilt binaries available for my OS/arch so that I can use embedding features

**Requirement Details:**

1. CI workflow builds binaries for: win32-x64, linux-x64, darwin-x64, darwin-arm64
2. Each binary is a tar.gz containing: `onnxruntime-node/` (bin/, dist/, package.json) + `onnxruntime-common/`
3. Binary sizes: win32-x64 (~25MB), linux-x64 (~11MB), darwin-x64 (~10MB), darwin-arm64 (~9MB)
4. CI uses `onnxruntime-node@1.22.0` from npm, repackages native files only
5. Unsupported platform → `getPlatformInfo().supported = false` → skip download, log message

**Acceptance Criteria:**

1. ✅ AC5: All 4 platform binaries available on GitHub Release
2. ✅ AC5.1: Each binary has corresponding `.sha256` checksum file
3. ✅ AC5.2: Unsupported platform (e.g., linux-arm64) → graceful skip, no error

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| NativeAddonManager pattern | System | N/A | Existing pattern for better-sqlite3 — OnnxAddonManager follows same architecture |
| GitHub Releases | Infrastructure | N/A | Host prebuilt binaries (tar.gz + sha256 files) |
| GitHub Actions CI | Infrastructure | N/A | Build workflow for 4 platforms |
| release-manifest.json | System | N/A | Manifest file with URLs, checksums, sizes |
| VS Code Extension API | System | N/A | globalStorageUri, Progress notification, OutputChannel |
| onnxruntime-node npm package | External | N/A | Source of native binaries (v1.22.0) |
| onnxruntime-common npm package | External | N/A | JS peer dependency bundled with binary |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Product Owner | Duc Nguyen Minh | Approve requirements, prioritize | Jira reporter |
| Developer | Duc Nguyen Minh | Implement OnnxAddonManager, CI workflow | Jira assignee |
| End User | VS Code extension users | Use embedding/graph features | Target audience |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| GitHub Release unavailable (rate limit, outage) | High — new users can't download | Low | Retry with backoff, manual download option, consider mirror |
| Binary size too large for slow connections | Medium — poor UX | Medium | Progress notification, cancellable download, cache prevents re-download |
| SHA-256 mismatch due to release re-upload | Medium — download loop | Low | Clear error message, manual download fallback |
| Platform detection incorrect | High — wrong binary | Very Low | Use `process.platform` + `process.arch` (Node.js standard) |
| Tar extraction fails on some systems | Medium — no embedding | Low | Minimal custom tar parser, tested on all 4 platforms |

### 5.2 Assumptions

- GitHub Releases are accessible from user's network (no corporate proxy blocking)
- `globalStorageUri` has sufficient disk space (~25MB max per platform)
- Extension has network access (VS Code allows HTTPS outbound)
- onnxruntime-node N-API binary is compatible across Node.js versions (20, 22, 24)
- User's antivirus won't quarantine downloaded `.node` native files

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Download timeout ≤ 120s | Single attempt timeout, 3 attempts total |
| Performance | Cache hit = instant | No I/O beyond `fs.existsSync()` check |
| Security | SHA-256 integrity verification | Every download verified before extraction |
| Security | Path traversal prevention | Tar parser validates all paths stay within target directory |
| Reliability | 3 retry attempts with backoff | Backoff: 0s, 2s, 4s |
| Reliability | Graceful degradation | Extension works without ONNX (embedding disabled) |
| Usability | Progress notification | Real-time MB/percentage during download |
| Usability | Cancellable download | User can cancel via notification button |
| Storage | ~9-25 MB per platform | Cached in globalStorage, persists across sessions |
| Compatibility | 4 platforms | win32-x64, linux-x64, darwin-x64, darwin-arm64 |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-111 | Prebuilt onnxruntime-node binaries — auto-download at runtime | Done | Story | Main ticket |
| KSA-110 | KB System Upgrade v0.6.0 | Done | Epic | Parent — ONNX needed for embedding in KB |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| ONNX | Open Neural Network Exchange — format for ML models |
| onnxruntime-node | Node.js binding for ONNX Runtime inference engine |
| N-API | Node.js native addon API — ABI-stable across Node versions |
| globalStorageUri | VS Code API — persistent storage path per extension |
| tar.gz | Gzip-compressed tar archive format |
| SHA-256 | Cryptographic hash function for integrity verification |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| NativeAddonManager (better-sqlite3) | `kiro-sdlc-agents/src/native-addon-manager.ts` |
| OnnxAddonManager implementation | `kiro-sdlc-agents/src/onnx-addon-manager.ts` |
| CI Workflow | `.github/workflows/build-onnxruntime.yml` |
| Release Manifest | `kiro-sdlc-agents/resources/release-manifest.json` |
| ONNX Provider (MCP server) | `mcp-code-intelligence-nodejs/src/memory/embedding/onnx-provider.ts` |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
