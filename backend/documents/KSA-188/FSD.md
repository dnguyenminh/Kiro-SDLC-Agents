# Functional Specification Document (FSD)

## FEC_CR_Builder — KSA-188: Incremental Prebuilt Binary Pipeline

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-188 |
| Title | Incremental Prebuilt Binary Pipeline for kiro-sdlc-agents extension |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-05-29 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-188.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-29 | BA Agent | Initiate document from BRD KSA-188 |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the Incremental Prebuilt Binary Pipeline — a set of GitHub Actions workflows that automate building, detecting, and releasing prebuilt native binaries for the kiro-sdlc-agents VS Code extension.

### 1.2 Scope

- Modify `build-onnxruntime.yml` to add incremental build logic (matching `build-native.yml`)
- Create `scheduled-prebuild-scan.yml` for automated Node.js version detection
- Create `auto-release.yml` for automated extension version bumping and publishing

### 1.3 Definitions and Acronyms

| Term | Definition |
|------|------------|
| LTS | Long-Term Support — Node.js versions with extended maintenance period |
| N-API | Node.js API for native addons, version-independent binary interface |
| Prebuild | Pre-compiled native binary for a specific platform/arch/node combination |
| Matrix | GitHub Actions strategy for running jobs across multiple configurations |
| Clobber | Overwrite existing release asset with same filename |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-188.docx |
| build-native.yml (reference) | .github/workflows/build-native.yml |
| build-onnxruntime.yml (current) | .github/workflows/build-onnxruntime.yml |
| publish.yml (reference) | .github/workflows/publish.yml |

---

## 2. System Overview

### 2.1 System Context

![System Context](diagrams/system-context.png)

The pipeline interacts with:
- **GitHub Actions** — execution platform for all workflows
- **GitHub Releases** — binary storage (check existence, upload new)
- **Node.js Release API** — source of truth for available Node.js versions
- **VS Code Marketplace / Open VSX** — extension publishing targets (via publish.yml)
- **CI Maintainer** — manual trigger, force rebuild
- **Cron Scheduler** — weekly automated trigger

### 2.2 Workflow Architecture

Three workflows form a pipeline:

1. **build-onnxruntime.yml** (modified) — Builds onnxruntime-node binaries with incremental logic
2. **scheduled-prebuild-scan.yml** (new) — Detects new Node.js versions, triggers builds
3. **auto-release.yml** (new) — Bumps version and triggers publish on new binaries

---

## 3. Functional Requirements

### 3.1 Feature: Incremental Build for build-onnxruntime.yml

**Source:** BRD Story 1, Story 2, Story 3

#### 3.1.1 Description

Add incremental build logic to `build-onnxruntime.yml` matching the pattern already implemented in `build-native.yml`. Before building each platform binary, check if it already exists in the GitHub Release. Skip if exists (unless force_rebuild is true). Verify architecture after build.

#### 3.1.2 Use Case

**Use Case ID:** UC-1
**Actor:** CI Maintainer / Cron Scheduler
**Preconditions:** Workflow triggered with valid onnxruntime_version and node_version inputs
**Postconditions:** New binaries uploaded to release OR all skipped (no change)

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Actor | | Triggers workflow with version inputs |
| 2 | | Prepare job | Generates build matrix (4 platforms x N node versions) |
| 3 | | Build job | For each matrix entry: checks release for existing asset |
| 4 | | Build job | If asset NOT found: installs onnxruntime-node, packages binaries |
| 5 | | Build job | Verifies binary architecture matches expected platform |
| 6 | | Build job | Creates tar.gz archive with checksum |
| 7 | | Build job | Uploads artifact |
| 8 | | Release job | Downloads all artifacts, uploads to GitHub Release |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | Binary already exists AND force_rebuild=false | Step 3 sets skip=true, Steps 4-7 skipped |
| AF-2 | force_rebuild=true | Step 3 skipped entirely, always builds |
| AF-3 | All binaries skipped | Release job detects no artifacts, reports "no new binaries", exits cleanly |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Architecture verification fails | Build job exits with code 1, binary NOT uploaded |
| EF-2 | npm install fails | Retry with --ignore-scripts flag |
| EF-3 | GitHub Release API unavailable | Job fails, GitHub Actions retries on next trigger |

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-1 | Binary existence check uses exact filename match against release assets | BRD Story 1 |
| BR-2 | force_rebuild=true bypasses ALL existence checks | BRD Story 2 |
| BR-3 | Architecture verification MUST pass before upload | BRD Story 3 |
| BR-4 | onnxruntime uses N-API so binary is per-platform, not per-node-version | Technical constraint |
| BR-5 | Release tag format: `onnxruntime-node-v{VERSION}` | Existing convention |
| BR-6 | Archive format: `onnxruntime-node-v{VERSION}-{PLATFORM}-{ARCH}.tar.gz` | Existing convention |

#### 3.1.4 Data Specifications

**Workflow Inputs:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| onnxruntime_version | string | Yes | Semver format (e.g., 1.22.0) | Version to build |
| node_version | choice | Yes | One of: 20, 22, 24, 25, all | Node.js major version |
| force_rebuild | boolean | No | true/false, default: false | Skip existence check |

**Build Matrix Output:**

| Field | Type | Description |
|-------|------|-------------|
| os | string | GitHub runner (windows-latest, ubuntu-latest, macos-13, macos-14) |
| platform | string | Target platform (win32, linux, darwin) |
| arch | string | Target architecture (x64, arm64) |
| node_version | string | Node.js major version for testing |

**Release Asset:**

| Field | Type | Description |
|-------|------|-------------|
| filename | string | `onnxruntime-node-v{VERSION}-{PLATFORM}-{ARCH}.tar.gz` |
| checksum | string | SHA-256 hash in `.sha256` file |
| contents | tar.gz | Contains: onnxruntime-node/bin/, onnxruntime-node/dist/, onnxruntime-node/package.json, onnxruntime-common/ |

#### 3.1.5 API Contract (GitHub Release Check)

**Endpoint:** `gh release view {TAG} --json assets -q ".assets[].name"`
**Purpose:** Check if binary already exists in release

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| TAG | string | Yes | BR-5 | Release tag (e.g., onnxruntime-node-v1.22.0) |
| FILENAME | string | Yes | BR-6 | Expected asset filename |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| exists | boolean | Whether filename appears in release assets list |

**Business Error Scenarios:**

| Scenario | Behavior | Trigger Condition |
|----------|----------|-------------------|
| Release does not exist | skip=false (will build) | First time building this version |
| API rate limited | Job fails, retry on next trigger | Too many API calls |

---

### 3.2 Feature: Scheduled Prebuild Scan

**Source:** BRD Story 4

#### 3.2.1 Description

A new workflow that runs weekly to detect new Node.js LTS versions and automatically trigger build workflows for any versions not yet covered.

#### 3.2.2 Use Case

**Use Case ID:** UC-2
**Actor:** Cron Scheduler (weekly) / CI Maintainer (manual)
**Preconditions:** Workflow exists and is enabled
**Postconditions:** Build workflows triggered for new versions OR no action (all covered)

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Cron/Manual | | Triggers scheduled-prebuild-scan.yml |
| 2 | | Scan job | Fetches Node.js release index from nodejs.org |
| 3 | | Scan job | Extracts active LTS major versions |
| 4 | | Scan job | Compares with configured supported versions |
| 5 | | Scan job | For each supported version: checks if all platform binaries exist in releases |
| 6 | | Scan job | If any binaries missing: triggers build-native.yml via workflow_dispatch |
| 7 | | Scan job | If any binaries missing: triggers build-onnxruntime.yml via workflow_dispatch |
| 8 | | Scan job | Logs summary of actions taken |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | All versions fully built | Steps 6-7 skipped, log "all up to date" |
| AF-2 | New LTS version detected not in supported list | Log warning, do NOT auto-add (requires manual config update) |
| AF-3 | nodejs.org API unavailable | Job fails with clear error, retry next week |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | API response format unexpected | Log error with response body, exit 1 |
| EF-2 | workflow_dispatch trigger fails | Log error, continue with remaining versions |

#### 3.2.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-7 | Only check versions listed in SUPPORTED_VERSIONS config | BRD Story 4 |
| BR-8 | LTS detection: version.lts field is not false in nodejs.org API | BRD Story 4 |
| BR-9 | Check ALL platforms for each version before deciding to trigger | BRD Story 4 |
| BR-10 | Trigger builds with latest patch version of each major (e.g., 22.x.y) | Technical requirement |
| BR-11 | Cron schedule: weekly, Monday 00:00 UTC | BRD Story 4 |

#### 3.2.4 Data Specifications

**Configuration (hardcoded in workflow):**

| Field | Type | Required | Description | Default |
|-------|------|----------|-------------|---------|
| SUPPORTED_NODE_VERSIONS | string | Yes | Space-separated major versions | "20 22 24 25" |
| BETTER_SQLITE3_VERSION | string | Yes | Current better-sqlite3 version | "12.10.0" |
| ONNXRUNTIME_VERSION | string | Yes | Current onnxruntime-node version | "1.22.0" |
| PLATFORMS | string | Yes | Platform-arch combinations to check | "win32-x64 linux-x64 darwin-x64 darwin-arm64" |

**Node.js API Response (relevant fields):**

| Field | Type | Description |
|-------|------|-------------|
| version | string | Full version (e.g., "v22.15.0") |
| lts | string/false | LTS codename or false |
| date | string | Release date |

#### 3.2.5 API Contract (Node.js Release Index)

**Endpoint:** `GET https://nodejs.org/dist/index.json`
**Purpose:** Get all Node.js releases to determine active LTS versions

**Output Data (array of objects):**

| Field | Type | Description |
|-------|------|-------------|
| version | string | e.g., "v22.15.0" |
| lts | string or false | e.g., "Jod" or false |
| security | boolean | Whether this is a security release |
| modules | string | N-API module version |

**Processing Logic:**
1. Filter entries where `lts !== false`
2. Group by major version (extract from `version` field)
3. For each major version in SUPPORTED_NODE_VERSIONS: get latest patch
4. Check if binaries exist for all platforms

---

### 3.3 Feature: Auto-release

**Source:** BRD Story 5

#### 3.3.1 Description

A new workflow triggered after build workflows complete. If new binaries were actually uploaded (not all skipped), automatically bump the extension's patch version, commit, tag, and push to trigger the publish workflow.

#### 3.3.2 Use Case

**Use Case ID:** UC-3
**Actor:** System (workflow_run trigger)
**Preconditions:** build-native.yml or build-onnxruntime.yml completed successfully
**Postconditions:** Extension version bumped + tag pushed OR no action (all skipped)

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | System | | build workflow completes with conclusion=success |
| 2 | | Auto-release | Checks if triggering workflow actually uploaded new binaries |
| 3 | | Auto-release | Reads current version from kiro-sdlc-agents/package.json |
| 4 | | Auto-release | Increments patch version (e.g., 1.2.3 -> 1.2.4) |
| 5 | | Auto-release | Updates package.json with new version |
| 6 | | Auto-release | Commits: "chore: bump extension to v{VERSION} (new prebuilds)" |
| 7 | | Auto-release | Creates git tag: v{VERSION} |
| 8 | | Auto-release | Pushes commit + tag to origin |
| 9 | System | | publish.yml triggered by v* tag push |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | Triggering workflow had all builds skipped | Step 2 detects no new binaries, exits with "no bump needed" |
| AF-2 | Manual trigger via workflow_dispatch | Skip Step 2 check, always bump |
| AF-3 | Another auto-release already running | Concurrency group queues this run |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Git push fails (conflict) | Pull --rebase, retry push once |
| EF-2 | package.json not found | Exit with error, log path issue |
| EF-3 | Tag already exists | Increment patch again, retry |

#### 3.3.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-12 | Only bump if new binaries were actually uploaded | BRD Story 5 |
| BR-13 | Version bump is always patch increment | BRD Story 5 |
| BR-14 | Commit message format: "chore: bump extension to v{VERSION} (new prebuilds)" | BRD Story 5 |
| BR-15 | Tag format: v{VERSION} (e.g., v1.2.4) | Matches publish.yml trigger |
| BR-16 | Concurrency group prevents parallel version bumps | BRD Risk mitigation |
| BR-17 | Must use a token with push permissions (not GITHUB_TOKEN for tag-triggered workflows) | Technical constraint |

#### 3.3.4 Data Specifications

**Workflow Trigger:**

| Field | Type | Description |
|-------|------|-------------|
| workflow_run.workflows | string[] | ["Build Native Addons (better-sqlite3)", "Build ONNX Runtime Native (onnxruntime-node)"] |
| workflow_run.types | string[] | ["completed"] |
| workflow_run.conclusion | string | Must be "success" |

**Version Bump Logic:**

| Current Version | New Version | Commit Message |
|----------------|-------------|----------------|
| 1.2.3 | 1.2.4 | chore: bump extension to v1.2.4 (new prebuilds) |
| 1.2.99 | 1.2.100 | chore: bump extension to v1.2.100 (new prebuilds) |

**Concurrency:**

| Field | Value | Description |
|-------|-------|-------------|
| group | auto-release | Only one auto-release runs at a time |
| cancel-in-progress | false | Queue, don't cancel |

---

## 4. Data Model

Not applicable — this feature operates on GitHub Release assets and package.json files. No database entities.

### 4.1 Release Asset Model

| Entity | Attributes | Description |
|--------|-----------|-------------|
| Release | tag, title, notes, assets[] | GitHub Release containing binaries |
| Asset | filename, size, download_url, sha256 | Individual binary file in a release |

### 4.2 Configuration Model

| Config Location | Fields | Managed By |
|----------------|--------|------------|
| build-onnxruntime.yml inputs | onnxruntime_version, node_version, force_rebuild | CI Maintainer |
| scheduled-prebuild-scan.yml env | SUPPORTED_NODE_VERSIONS, BETTER_SQLITE3_VERSION, ONNXRUNTIME_VERSION | CI Maintainer |
| kiro-sdlc-agents/package.json | version | auto-release.yml |

---

## 5. Integration Specifications

### 5.1 External System: Node.js Release API

| Attribute | Value |
|-----------|-------|
| Purpose | Detect available Node.js versions for prebuild scanning |
| Direction | Inbound (read-only) |
| Data Format | JSON array |
| Frequency | Weekly (cron) or on-demand |
| Endpoint | https://nodejs.org/dist/index.json |

### 5.2 External System: GitHub Releases API

| Attribute | Value |
|-----------|-------|
| Purpose | Check existing binaries, upload new binaries |
| Direction | Bidirectional |
| Data Format | JSON (API) + binary files (upload) |
| Frequency | On every build workflow run |
| Access | Via `gh` CLI with GITHUB_TOKEN |

### 5.3 External System: VS Code Marketplace / Open VSX

| Attribute | Value |
|-----------|-------|
| Purpose | Publish updated extension |
| Direction | Outbound |
| Data Format | VSIX package |
| Frequency | On each version bump |
| Access | Via publish.yml (existing, not modified) |

---

## 6. Processing Logic

### 6.1 Binary Existence Check

**Trigger:** Each build matrix job starts
**Input:** Release tag, expected filename
**Output:** skip=true/false

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Construct release tag from version input | N/A (deterministic) |
| 2 | Construct expected filename from matrix vars | N/A (deterministic) |
| 3 | Call `gh release view {TAG} --json assets` | If release doesn't exist: skip=false |
| 4 | Grep output for exact filename match | If not found: skip=false |
| 5 | Set output variable skip=true/false | N/A |

### 6.2 Architecture Verification

**Trigger:** After successful binary build
**Input:** Built binary file path, expected architecture
**Output:** PASS/FAIL

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Locate native binary in build output | If not found: FAIL |
| 2 | Run `file` command on binary | If command unavailable (Windows): skip verification with warning |
| 3 | Parse output for architecture markers | N/A |
| 4 | If expected=x64: verify NO arm64/aarch64 in output | If found: FAIL with error message |
| 5 | If expected=arm64: verify NO x86_64/x86-64 in output | If found: FAIL with error message |
| 6 | Print verification result | N/A |

### 6.3 Node.js Version Scan

**Trigger:** Weekly cron or manual dispatch
**Input:** SUPPORTED_NODE_VERSIONS config, Node.js API response
**Output:** List of versions needing builds

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Fetch https://nodejs.org/dist/index.json | If fails: exit 1 with error |
| 2 | Parse JSON, filter where lts !== false | If parse fails: exit 1 |
| 3 | Group by major version, get latest patch for each | N/A |
| 4 | For each version in SUPPORTED_NODE_VERSIONS | N/A |
| 5 | Check if all platform binaries exist in releases | Use same logic as 6.1 |
| 6 | If any missing: add to "needs build" list | N/A |
| 7 | Trigger build workflows for versions in list | If trigger fails: log error, continue |

### 6.4 Version Bump

**Trigger:** Build workflow completes with new binaries
**Input:** Current package.json version
**Output:** New version committed + tagged

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Check triggering workflow conclusion = success | If not success: exit 0 (no action) |
| 2 | Check if new binaries were uploaded (not all skipped) | If all skipped: exit 0 |
| 3 | Read current version from package.json | If file not found: exit 1 |
| 4 | Parse semver, increment patch | N/A |
| 5 | Write new version to package.json | N/A |
| 6 | Git add + commit with standard message | N/A |
| 7 | Git tag v{VERSION} | If tag exists: increment patch again |
| 8 | Git push origin main --tags | If conflict: pull --rebase, retry once |

---

## 7. Security Requirements

### 7.1 Permissions

| Workflow | Permission | Reason |
|---------|-----------|--------|
| build-onnxruntime.yml | contents: write | Upload to releases |
| scheduled-prebuild-scan.yml | contents: read, actions: write | Read releases, trigger workflows |
| auto-release.yml | contents: write | Push commits + tags |

### 7.2 Secrets

| Secret | Used By | Purpose |
|--------|---------|---------|
| GITHUB_TOKEN (auto) | All workflows | API access |
| PAT (optional) | auto-release.yml | Push tags that trigger other workflows (GITHUB_TOKEN cannot trigger workflows) |

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | Skip check completes quickly | < 10 seconds per matrix job |
| Performance | All-skipped workflow exits fast | < 5 minutes total |
| Reliability | Idempotent operations | Re-running produces same result |
| Reliability | Graceful degradation | If one platform fails, others continue |
| Observability | Clear step-by-step logging | Each decision logged with reason |
| Maintainability | Single config location | Version numbers in env block, easy to update |

---

## 9. Error Handling

### 9.1 Error Scenarios

| Scenario | Severity | Behavior | Recovery |
|----------|----------|----------|----------|
| GitHub API rate limit | Warning | Job fails | Retry on next trigger (cron or manual) |
| npm install fails | Warning | Retry with --ignore-scripts | If still fails: job fails |
| Architecture mismatch | Critical | Job fails, no upload | Investigate runner configuration |
| Tag already exists | Warning | Increment patch, retry | Automatic recovery |
| Git push conflict | Warning | Pull --rebase, retry once | If still fails: manual intervention |
| nodejs.org unavailable | Warning | Scan job fails | Retry next week |

---

## 10. Testing Considerations

### 10.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-1 | All binaries exist, no force | Trigger build-onnxruntime | All jobs skip, "no new binaries" | High |
| TC-2 | Some binaries missing | Trigger with missing platform | Only missing built + uploaded | High |
| TC-3 | Force rebuild | force_rebuild=true | All rebuilt, overwrite existing | High |
| TC-4 | Arch verification pass | Build on correct runner | "Architecture verified" logged | High |
| TC-5 | Scan finds all up to date | All binaries exist | "all up to date" logged | Medium |
| TC-6 | Scan finds missing version | Remove one binary from release | Build triggered for that version | Medium |
| TC-7 | Auto-release with new binaries | Build uploads new binary | Version bumped, tag pushed | High |
| TC-8 | Auto-release all skipped | Build skips all | No version bump | High |
| TC-9 | Concurrent auto-releases | Two builds complete simultaneously | Sequential execution, no conflict | Medium |

---

## 11. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence — Incremental Build | [sequence-build.png](diagrams/sequence-build.png) | [sequence-build.drawio](diagrams/sequence-build.drawio) |
| 3 | State — Workflow Lifecycle | [state-workflow.png](diagrams/state-workflow.png) | [state-workflow.drawio](diagrams/state-workflow.drawio) |

### Pseudocode: Binary Existence Check

```bash
TAG="onnxruntime-node-v${VERSION}"
FILENAME="onnxruntime-node-v${VERSION}-${PLATFORM}-${ARCH}.tar.gz"

if gh release view "$TAG" --json assets -q ".assets[].name" 2>/dev/null | grep -qF "$FILENAME"; then
  echo "skip=true" >> $GITHUB_OUTPUT
else
  echo "skip=false" >> $GITHUB_OUTPUT
fi
```

### Pseudocode: Version Bump

```bash
# Read current version
CURRENT=$(jq -r .version kiro-sdlc-agents/package.json)
# Increment patch
NEW=$(echo $CURRENT | awk -F. '{print $1"."$2"."$3+1}')
# Update package.json
jq ".version = \"$NEW\"" kiro-sdlc-agents/package.json > tmp && mv tmp kiro-sdlc-agents/package.json
# Commit + tag + push
git add kiro-sdlc-agents/package.json
git commit -m "chore: bump extension to v${NEW} (new prebuilds)"
git tag "v${NEW}"
git push origin main --tags
```

### Change Log from BRD

- No deviations from BRD requirements
- Added technical detail: N-API means onnxruntime binary is per-platform (not per-node-version)
- Added concurrency group for auto-release to prevent race conditions
- Clarified PAT requirement for tag-triggered workflow chains
