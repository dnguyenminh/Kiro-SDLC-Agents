# Business Requirements Document (BRD)

## FEC_CR_Builder — KSA-188: Incremental Prebuilt Binary Pipeline for kiro-sdlc-agents extension

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-188 |
| Title | Incremental Prebuilt Binary Pipeline for kiro-sdlc-agents extension |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-29 |
| Status | Draft |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | SA Agent – Solution Architect | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-29 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-188 |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

This change request implements an **Incremental Prebuilt Binary Pipeline** for the kiro-sdlc-agents VS Code extension. Currently, every time a new Node.js version or OS platform is added, ALL binary combinations must be rebuilt from scratch, wasting CI resources and time.

The solution introduces three phases:
1. **Incremental Build** — Skip building binaries that already exist in GitHub Releases
2. **Scheduled Scan** — Automatically detect new Node.js LTS versions and trigger builds
3. **Auto-release** — Automatically bump extension version and publish when new prebuilds are available

### 1.2 Out of Scope

- Changes to the extension's core functionality (MCP servers, code intelligence)
- Changes to the publish.yml workflow logic (only triggered by auto-release)
- Support for non-LTS Node.js versions in scheduled scans
- ARM64 Linux platform support (not currently in matrix)
- GPU/CUDA builds for onnxruntime

### 1.3 Preliminary Requirement

- GitHub Actions workflows `build-native.yml` and `build-onnxruntime.yml` must exist (already exist)
- GitHub Releases must be used as binary storage (already in use)
- `gh` CLI must be available in GitHub Actions runners (pre-installed)
- Repository must have `contents: write` permission for workflows (already configured)

---

## 2. Business Requirements

### 2.1 High Level Process Map

The pipeline operates in three automated layers:

1. **Build Layer** (Phase 1): When a build is triggered (manually or by scan), check if binary already exists -> skip if yes, build if no -> verify architecture -> upload to release
2. **Detection Layer** (Phase 2): Weekly cron job checks Node.js release schedule -> detects new LTS versions -> triggers build workflows
3. **Release Layer** (Phase 3): When new prebuilds are uploaded -> bump extension patch version -> commit + tag -> trigger publish workflow -> extension published to marketplace

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a CI maintainer, I want builds to skip existing binaries so that CI resources are not wasted on redundant builds | MUST HAVE | KSA-188 |
| 2 | As a CI maintainer, I want to force rebuild specific binaries when needed so that I can fix corrupted or outdated builds | MUST HAVE | KSA-188 |
| 3 | As a CI maintainer, I want architecture verification after each build so that wrong-arch binaries are never uploaded | MUST HAVE | KSA-188 |
| 4 | As a CI maintainer, I want automatic detection of new Node.js LTS versions so that prebuilds stay current without manual intervention | SHOULD HAVE | KSA-188 |
| 5 | As an extension user, I want the extension to auto-publish when new prebuilds are available so that I always have compatible binaries | SHOULD HAVE | KSA-188 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Developer or scheduled scan triggers `build-native.yml` or `build-onnxruntime.yml` with version + node_version parameters

**Step 2:** Prepare job generates build matrix (platforms x node versions)

**Step 3:** For each matrix entry, check GitHub Release for existing binary asset

**Step 4:** If binary exists AND `force_rebuild` is false -> skip build for that entry

**Step 5:** If binary does not exist OR `force_rebuild` is true -> proceed with build

**Step 6:** After build completes, verify binary architecture matches expected platform

**Step 7:** Package binary with checksum, upload as artifact

**Step 8:** Release job collects all new artifacts and uploads to GitHub Release

**Step 9:** (Phase 2) Weekly cron checks nodejs.org for new LTS versions

**Step 10:** If new LTS detected -> trigger build workflows via `workflow_dispatch`

**Step 11:** (Phase 3) After new binaries uploaded -> bump extension patch version in `package.json`

**Step 12:** Commit version bump + create git tag -> push triggers `publish.yml`

**Step 13:** Extension published to VS Code Marketplace and Open VSX

> **Note:** Phase 1 is already partially implemented in `build-native.yml`. Phase 1 needs to be applied to `build-onnxruntime.yml` as well.

---

#### STORY 1: Incremental Build — Skip Existing Binaries

> As a CI maintainer, I want builds to skip existing binaries so that CI resources are not wasted on redundant builds

**Requirement Details:**

1. Before building, each matrix job MUST check if the target binary already exists in the corresponding GitHub Release
2. For `build-native.yml`: Check release tag `better-sqlite3-v{VERSION}` for asset `better-sqlite3-v{VERSION}-node-v{NODE}-{PLATFORM}-{ARCH}.node`
3. For `build-onnxruntime.yml`: Check release tag `onnxruntime-node-v{VERSION}` for asset `onnxruntime-node-v{VERSION}-{PLATFORM}-{ARCH}.tar.gz`
4. If asset exists -> set output `skip=true` -> all subsequent build steps are skipped
5. The release job MUST handle the case where ALL builds were skipped (no artifacts to upload)

**Acceptance Criteria:**

1. Running build workflow with all binaries already in release -> all build jobs report "skipped" -> release job reports "no new binaries"
2. Running build workflow with some binaries missing -> only missing binaries are built -> new binaries uploaded to release
3. Running build workflow with `force_rebuild=true` -> all binaries are rebuilt regardless of existing assets
4. Build time for "all skipped" scenario < 2 minutes per matrix job

---

#### STORY 2: Force Rebuild Override

> As a CI maintainer, I want to force rebuild specific binaries when needed so that I can fix corrupted or outdated builds

**Requirement Details:**

1. Both `build-native.yml` and `build-onnxruntime.yml` MUST have a `force_rebuild` input parameter
2. Type: boolean, default: false
3. When `force_rebuild=true`, the "check existing" step is skipped entirely
4. The rebuilt binary overwrites the existing one in the release (using `--clobber` flag)
5. Available for both `workflow_dispatch` (manual) and `workflow_call` (programmatic) triggers

**Acceptance Criteria:**

1. `force_rebuild` input appears in GitHub Actions UI when manually triggering workflow
2. Setting `force_rebuild=true` causes all binaries to be rebuilt even if they exist
3. Rebuilt binaries successfully overwrite existing release assets
4. `force_rebuild` works correctly when called via `workflow_call` from other workflows

---

#### STORY 3: Architecture Verification

> As a CI maintainer, I want architecture verification after each build so that wrong-arch binaries are never uploaded

**Requirement Details:**

1. After building a native binary, verify the binary's architecture matches the expected target
2. Use `file` command (Unix) to inspect binary metadata
3. For x64 targets: verify binary does NOT contain "arm64" or "aarch64" markers
4. For arm64 targets: verify binary does NOT contain "x86_64" or "x86-64" markers
5. If verification fails -> exit with error code 1 -> binary is NOT uploaded
6. Print clear success/failure message with architecture details

**Acceptance Criteria:**

1. Building on macos-13 (Intel) produces x64 binary -> verification passes
2. Building on macos-14 (Apple Silicon) produces arm64 binary -> verification passes
3. If somehow wrong-arch binary is produced -> verification fails -> job fails -> no upload
4. Verification step output clearly shows "Architecture verified: {arch}" or "ERROR"

---

#### STORY 4: Scheduled Scan for New Node.js Versions

> As a CI maintainer, I want automatic detection of new Node.js LTS versions so that prebuilds stay current without manual intervention

**Requirement Details:**

1. Create new workflow: `.github/workflows/scheduled-prebuild-scan.yml`
2. Trigger: `schedule` with weekly cron (e.g., every Monday at 00:00 UTC)
3. Also support `workflow_dispatch` for manual triggering
4. Check Node.js release schedule via official API (`https://nodejs.org/dist/index.json`)
5. Determine current LTS versions (versions with `lts` field not false)
6. Compare with currently supported versions in build matrix (20, 22, 24, 25)
7. If new LTS version detected -> trigger `build-native.yml` and `build-onnxruntime.yml` via `workflow_dispatch`
8. Log which versions were checked and which triggered builds

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| node_versions_supported | string[] | Yes | Currently supported Node.js major versions | ["20", "22", "24", "25"] |
| node_versions_lts | string[] | Yes | Active LTS versions from nodejs.org | ["20", "22"] |
| new_versions_detected | string[] | No | Newly detected versions not yet built | ["24"] |

**Acceptance Criteria:**

1. Workflow runs automatically every Monday at 00:00 UTC
2. Workflow can be triggered manually via `workflow_dispatch`
3. Correctly identifies active Node.js LTS versions from official API
4. Does NOT trigger builds for versions that already have all binaries in releases
5. Successfully triggers `build-native.yml` and `build-onnxruntime.yml` for new versions
6. Provides clear log output showing scan results and actions taken

---

#### STORY 5: Auto-release on New Prebuilds

> As an extension user, I want the extension to auto-publish when new prebuilds are available so that I always have compatible binaries

**Requirement Details:**

1. Create new workflow: `.github/workflows/auto-release.yml`
2. Trigger: `workflow_run` — triggered when `build-native.yml` or `build-onnxruntime.yml` completes successfully
3. Also support `workflow_dispatch` for manual triggering
4. Check if new binaries were actually uploaded (not all skipped)
5. If new binaries exist -> bump patch version in `kiro-sdlc-agents/package.json`
6. Commit the version bump with message: `chore: bump extension to v{NEW_VERSION} (new prebuilds)`
7. Create git tag `v{NEW_VERSION}`
8. Push commit + tag -> triggers `publish.yml` -> extension published
9. Do NOT bump version if no new binaries were uploaded

**Acceptance Criteria:**

1. After successful build with new binaries -> extension version is bumped (patch increment)
2. After successful build with all skipped -> NO version bump occurs
3. Version bump commit has correct format and message
4. Git tag is created with correct version
5. Push triggers `publish.yml` which publishes to VS Code Marketplace and Open VSX
6. Multiple rapid builds do not cause version conflicts (sequential execution)

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| GitHub Actions | Infrastructure | N/A | CI/CD platform for running workflows |
| GitHub Releases | Infrastructure | N/A | Binary storage for prebuilt native addons |
| Node.js Release API | External | N/A | `https://nodejs.org/dist/index.json` for version detection |
| `gh` CLI | System | N/A | GitHub CLI for release management (pre-installed on runners) |
| publish.yml | System | N/A | Existing publish workflow triggered by version tags |
| build-native.yml | System | N/A | Existing workflow for building better-sqlite3 (Phase 1 already applied) |
| build-onnxruntime.yml | System | N/A | Existing workflow for building onnxruntime-node (needs Phase 1 update) |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Reporter | Duc Nguyen Minh | Define requirements, approve deliverables | Jira reporter |
| CI Maintainer | DevOps Team | Implement and maintain workflows | Implied |
| Extension Users | All kiro-sdlc-agents users | Receive auto-updated prebuilds | End users |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Node.js API format changes | Medium | Low | Pin API endpoint, add error handling for unexpected response format |
| Race condition in auto-release (multiple builds complete simultaneously) | High | Medium | Use `concurrency` group in workflow to serialize version bumps |
| GitHub API rate limiting during release checks | Medium | Low | Add retry logic with exponential backoff |
| Wrong architecture binary passes verification on Windows (no `file` command) | High | Low | Use alternative verification method on Windows (e.g., `dumpbin` or Node.js `process.arch`) |
| Scheduled scan triggers unnecessary builds | Low | Medium | Check release assets before triggering, not just version existence |

### 5.2 Assumptions

- GitHub Actions runners will continue to have `gh` CLI pre-installed
- `macos-13` runner provides Intel x86_64 architecture, `macos-14` provides Apple Silicon arm64
- Node.js release API at `https://nodejs.org/dist/index.json` remains stable and accessible
- The `--clobber` flag in `gh release upload` will continue to work for overwriting assets
- `publish.yml` is triggered by pushing tags matching `v*` pattern
- Extension version follows semver (patch bump for new prebuilds)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Build skip check < 10 seconds | GitHub Release API check should complete quickly |
| Performance | Full "all skipped" workflow < 5 minutes total | When no builds needed, workflow should exit fast |
| Reliability | Retry on transient failures | API calls should retry 2-3 times on 5xx errors |
| Reliability | Idempotent operations | Re-running any workflow should produce same result |
| Observability | Clear logging | Each step must log what it's doing and why (skip/build/verify) |
| Security | Minimal permissions | Workflows use only `contents: write` permission |
| Maintainability | Configurable versions | Supported Node versions defined in one place, easy to update |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-188 | Incremental Prebuilt Binary Pipeline for kiro-sdlc-agents extension | In Progress | Task | Main ticket |

---

## 8. Appendix

### Platform Matrix

| Runner | Platform | Architecture | Use Case |
|--------|----------|-------------|----------|
| windows-latest | win32 | x64 | Windows desktop users |
| ubuntu-latest | linux | x64 | Linux desktop/server users |
| macos-13 | darwin | x64 | Intel Mac users |
| macos-14 | darwin | arm64 | Apple Silicon Mac users |

### Current Workflow Status

| Workflow | Phase 1 Applied | Notes |
|---------|----------------|-------|
| build-native.yml | Yes | Has `force_rebuild`, skip check, arch verify |
| build-onnxruntime.yml | No | Needs same incremental logic applied |

### Binary Naming Convention

- better-sqlite3: `better-sqlite3-v{VERSION}-node-v{NODE_MAJOR}-{PLATFORM}-{ARCH}.node`
- onnxruntime-node: `onnxruntime-node-v{VERSION}-{PLATFORM}-{ARCH}.tar.gz`

### Release Tag Convention

- better-sqlite3: `better-sqlite3-v{VERSION}` (e.g., `better-sqlite3-v12.10.0`)
- onnxruntime-node: `onnxruntime-node-v{VERSION}` (e.g., `onnxruntime-node-v1.22.0`)

### Glossary

| Term | Definition |
|------|------------|
| LTS | Long-Term Support — Node.js versions with extended maintenance |
| Prebuild | Pre-compiled native binary for a specific platform/arch/node combination |
| N-API | Node.js API for native addons — version-independent (onnxruntime uses this) |
| Matrix | GitHub Actions strategy for running jobs across multiple configurations |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
