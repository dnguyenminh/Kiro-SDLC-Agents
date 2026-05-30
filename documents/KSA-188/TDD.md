# Technical Design Document (TDD)

## FEC_CR_Builder — KSA-188: Incremental Prebuilt Binary Pipeline

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-188 |
| Title | Incremental Prebuilt Binary Pipeline for kiro-sdlc-agents extension |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-29 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-188.docx |
| Related FSD | FSD-v1-KSA-188.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-29 | SA Agent | Initiate document from FSD KSA-188 |

---

## 1. Introduction

### 1.1 Purpose

This TDD specifies the technical implementation of the Incremental Prebuilt Binary Pipeline — three GitHub Actions workflows that automate incremental building, version scanning, and auto-releasing of native addon binaries for the kiro-sdlc-agents extension.

### 1.2 Scope

- Modify `.github/workflows/build-onnxruntime.yml` — add incremental build logic
- Create `.github/workflows/scheduled-prebuild-scan.yml` — new workflow
- Create `.github/workflows/auto-release.yml` — new workflow

### 1.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| CI/CD Platform | GitHub Actions | Latest |
| Shell | Bash | 5.x |
| Package Manager | npm | 10.x |
| CLI Tools | gh (GitHub CLI) | 2.x |
| Runtime | Node.js | 20/22/24/25 |
| Native Addon | onnxruntime-node | 1.22.0 |
| Native Addon | better-sqlite3 | 12.10.0 |

### 1.4 Design Principles

- **Idempotency** — Re-running any workflow produces the same result
- **Fail-fast** — Architecture verification catches errors before upload
- **Incremental** — Only build what's missing, skip what exists
- **Observable** — Every decision logged with clear reason
- **Minimal permissions** — Only `contents: write` where needed

### 1.5 Constraints

- GitHub Actions runners determine available architectures (macos-13=x64, macos-14=arm64)
- `GITHUB_TOKEN` cannot trigger other workflows (need PAT for auto-release tag push)
- `file` command not available on Windows runners (arch verification limited)
- GitHub Release API has rate limits (5000 requests/hour for authenticated)
- `workflow_run` trigger only fires on default branch workflows

### 1.6 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-188.docx |
| FSD | FSD-v1-KSA-188.docx |
| build-native.yml (reference impl) | .github/workflows/build-native.yml |

---

## 2. System Architecture

### 2.1 Architecture Overview

![Architecture Diagram](diagrams/architecture.png)

The system consists of three GitHub Actions workflows forming a pipeline:

```
[Trigger] --> [build-onnxruntime.yml] --> [GitHub Releases]
                                              |
[Cron] --> [scheduled-prebuild-scan.yml] --> [Triggers build workflows]
                                              |
[workflow_run] --> [auto-release.yml] --> [Version bump] --> [publish.yml]
```

### 2.2 Component Diagram

![Component Diagram](diagrams/component.png)

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| build-onnxruntime.yml | Build + upload onnxruntime binaries incrementally | GitHub Actions + bash |
| scheduled-prebuild-scan.yml | Detect new Node.js versions, trigger builds | GitHub Actions + curl + jq |
| auto-release.yml | Bump version + tag on new binaries | GitHub Actions + git + jq |
| GitHub Releases | Store prebuilt binaries | GitHub platform |
| publish.yml (existing) | Publish extension to marketplaces | GitHub Actions + vsce |

### 2.3 Workflow Trigger Chain

| Workflow | Triggered By | Triggers |
|---------|-------------|----------|
| build-onnxruntime.yml | workflow_dispatch, workflow_call, scheduled-prebuild-scan | auto-release.yml (via workflow_run) |
| scheduled-prebuild-scan.yml | schedule (cron), workflow_dispatch | build-native.yml, build-onnxruntime.yml (via workflow_dispatch) |
| auto-release.yml | workflow_run (build workflows complete) | publish.yml (via tag push) |

### 2.4 Communication Patterns

| From | To | Protocol | Pattern | Description |
|------|----|----------|---------|-------------|
| scan workflow | nodejs.org | HTTPS GET | Sync | Fetch release index |
| build workflow | GitHub Releases | HTTPS (gh CLI) | Sync | Check/upload assets |
| auto-release | Git remote | HTTPS (git push) | Sync | Push commit + tag |
| scan workflow | build workflows | GitHub API | Async | workflow_dispatch trigger |

---

## 3. Implementation Design

### 3.1 build-onnxruntime.yml Modifications

**Changes from current implementation:**

| Section | Current | New |
|---------|---------|-----|
| Inputs | onnxruntime_version, node_version | + force_rebuild (boolean) |
| workflow_call | Not supported for force_rebuild | Add force_rebuild input |
| Build job | Always builds | Check existing first, skip if found |
| Build job | No arch verification | Add verification step |
| Release job | Always uploads | Handle "no artifacts" case |

**New Steps (in order within build job):**

```yaml
# Step 1: Check if binary already exists
- name: Check if binary already exists in release
  id: check_existing
  if: inputs.force_rebuild != true
  shell: bash
  env:
    GH_TOKEN: ${{ github.token }}
  run: |
    VERSION="${{ needs.prepare.outputs.version }}"
    TAG="onnxruntime-node-v${VERSION}"
    FILENAME="onnxruntime-node-v${VERSION}-${{ matrix.platform }}-${{ matrix.arch }}.tar.gz"
    
    if gh release view "$TAG" --json assets -q ".assets[].name" 2>/dev/null | grep -qF "$FILENAME"; then
      echo "skip=true" >> $GITHUB_OUTPUT
      echo "⏭️ $FILENAME already exists in release $TAG — skipping build"
    else
      echo "skip=false" >> $GITHUB_OUTPUT
      echo "🔨 $FILENAME not found — will build"
    fi

# Step 2: Verify architecture (after package step)
- name: Verify architecture
  if: steps.check_existing.outputs.skip != 'true'
  shell: bash
  run: |
    # Find native binary
    ORT_DIR="build-temp/node_modules/onnxruntime-node"
    NATIVE_FILE=$(find "$ORT_DIR/bin" -type f \( -name "*.so" -o -name "*.dylib" -o -name "*.dll" \) | head -1)
    
    if [ -z "$NATIVE_FILE" ]; then
      echo "⚠️ No native binary found for verification — skipping"
      exit 0
    fi
    
    if command -v file &>/dev/null; then
      FILE_INFO=$(file "$NATIVE_FILE")
      echo "File info: $FILE_INFO"
      
      EXPECTED_ARCH="${{ matrix.arch }}"
      if [ "$EXPECTED_ARCH" = "x64" ]; then
        if echo "$FILE_INFO" | grep -qi "arm64\|aarch64"; then
          echo "❌ ERROR: Binary is arm64 but expected x64!"
          exit 1
        fi
        echo "✅ Architecture verified: x64"
      elif [ "$EXPECTED_ARCH" = "arm64" ]; then
        if echo "$FILE_INFO" | grep -qi "x86_64\|x86-64"; then
          echo "❌ ERROR: Binary is x64 but expected arm64!"
          exit 1
        fi
        echo "✅ Architecture verified: arm64"
      fi
    else
      echo "⚠️ 'file' command not available — skipping arch verification"
    fi
```

**Release job modification:**

```yaml
- name: Check for new binaries
  id: check_binaries
  run: |
    if ls *.tar.gz 1>/dev/null 2>&1; then
      echo "has_binaries=true" >> $GITHUB_OUTPUT
      echo "Found $(ls *.tar.gz | wc -l) new archives to upload"
    else
      echo "has_binaries=false" >> $GITHUB_OUTPUT
      echo "ℹ️ No new binaries to upload — all builds were skipped"
    fi

- name: Upload to GitHub Release
  if: steps.check_binaries.outputs.has_binaries == 'true'
  # ... existing upload logic with --clobber
```

---

### 3.2 scheduled-prebuild-scan.yml (New)

**Complete workflow structure:**

```yaml
name: Scheduled Prebuild Scan

on:
  schedule:
    - cron: '0 0 * * 1'  # Every Monday at 00:00 UTC
  workflow_dispatch:

env:
  SUPPORTED_NODE_VERSIONS: "20 22 24 25"
  BETTER_SQLITE3_VERSION: "12.10.0"
  ONNXRUNTIME_VERSION: "1.22.0"
  PLATFORMS: "win32-x64 linux-x64 darwin-x64 darwin-arm64"

permissions:
  contents: read
  actions: write

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check Node.js versions
        id: check_versions
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          # Fetch Node.js release index
          RELEASES=$(curl -sf https://nodejs.org/dist/index.json)
          if [ $? -ne 0 ]; then
            echo "❌ Failed to fetch Node.js release index"
            exit 1
          fi

          NEEDS_BUILD=""
          
          for MAJOR in $SUPPORTED_NODE_VERSIONS; do
            echo "--- Checking Node.js v${MAJOR} ---"
            
            # Check if all platform binaries exist for better-sqlite3
            for PLAT_ARCH in $PLATFORMS; do
              PLAT=$(echo $PLAT_ARCH | cut -d- -f1)
              ARCH=$(echo $PLAT_ARCH | cut -d- -f2)
              TAG="better-sqlite3-v${BETTER_SQLITE3_VERSION}"
              FILENAME="better-sqlite3-v${BETTER_SQLITE3_VERSION}-node-v${MAJOR}-${PLAT}-${ARCH}.node"
              
              if ! gh release view "$TAG" --json assets -q ".assets[].name" 2>/dev/null | grep -qF "$FILENAME"; then
                echo "  ⚠️ Missing: $FILENAME"
                NEEDS_BUILD="${NEEDS_BUILD} ${MAJOR}"
                break
              fi
            done
          done

          # Deduplicate
          NEEDS_BUILD=$(echo $NEEDS_BUILD | tr ' ' '\n' | sort -u | tr '\n' ' ')
          
          if [ -z "$NEEDS_BUILD" ]; then
            echo "✅ All versions up to date"
            echo "needs_build=false" >> $GITHUB_OUTPUT
          else
            echo "🔨 Versions needing build: $NEEDS_BUILD"
            echo "needs_build=true" >> $GITHUB_OUTPUT
            echo "versions=$NEEDS_BUILD" >> $GITHUB_OUTPUT
          fi

      - name: Trigger build-native
        if: steps.check_versions.outputs.needs_build == 'true'
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          for VER in ${{ steps.check_versions.outputs.versions }}; do
            echo "Triggering build-native for Node.js v${VER}..."
            gh workflow run build-native.yml \
              -f better_sqlite3_version="${BETTER_SQLITE3_VERSION}" \
              -f node_version="${VER}"
          done

      - name: Trigger build-onnxruntime
        if: steps.check_versions.outputs.needs_build == 'true'
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          for VER in ${{ steps.check_versions.outputs.versions }}; do
            echo "Triggering build-onnxruntime for Node.js v${VER}..."
            gh workflow run build-onnxruntime.yml \
              -f onnxruntime_version="${ONNXRUNTIME_VERSION}" \
              -f node_version="${VER}"
          done
```

---

### 3.3 auto-release.yml (New)

**Complete workflow structure:**

```yaml
name: Auto-release Extension

on:
  workflow_run:
    workflows:
      - "Build Native Addons (better-sqlite3)"
      - "Build ONNX Runtime Native (onnxruntime-node)"
    types: [completed]
  workflow_dispatch:

concurrency:
  group: auto-release
  cancel-in-progress: false

permissions:
  contents: write

jobs:
  check-and-release:
    runs-on: ubuntu-latest
    if: >
      github.event_name == 'workflow_dispatch' ||
      github.event.workflow_run.conclusion == 'success'
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.PAT || github.token }}
          fetch-depth: 0

      - name: Check if new binaries were uploaded
        id: check_new
        if: github.event_name != 'workflow_dispatch'
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          # Check the triggering workflow's artifacts
          RUN_ID="${{ github.event.workflow_run.id }}"
          WORKFLOW_NAME="${{ github.event.workflow_run.name }}"
          
          echo "Checking workflow run: $WORKFLOW_NAME (#$RUN_ID)"
          
          # Get jobs for the run, check if any build job actually ran (not skipped)
          JOBS=$(gh api repos/${{ github.repository }}/actions/runs/$RUN_ID/jobs --jq '.jobs[] | select(.name | startswith("build")) | .conclusion')
          
          if echo "$JOBS" | grep -q "success"; then
            echo "has_new=true" >> $GITHUB_OUTPUT
            echo "✅ New binaries were built"
          else
            echo "has_new=false" >> $GITHUB_OUTPUT
            echo "ℹ️ All builds were skipped — no version bump needed"
          fi

      - name: Bump version
        id: bump
        if: >
          github.event_name == 'workflow_dispatch' ||
          steps.check_new.outputs.has_new == 'true'
        run: |
          # Read current version
          CURRENT=$(jq -r .version kiro-sdlc-agents/package.json)
          echo "Current version: $CURRENT"
          
          # Increment patch
          MAJOR=$(echo $CURRENT | cut -d. -f1)
          MINOR=$(echo $CURRENT | cut -d. -f2)
          PATCH=$(echo $CURRENT | cut -d. -f3)
          NEW_PATCH=$((PATCH + 1))
          NEW_VERSION="${MAJOR}.${MINOR}.${NEW_PATCH}"
          
          echo "New version: $NEW_VERSION"
          echo "version=$NEW_VERSION" >> $GITHUB_OUTPUT
          
          # Update package.json
          jq ".version = \"$NEW_VERSION\"" kiro-sdlc-agents/package.json > tmp.json
          mv tmp.json kiro-sdlc-agents/package.json

      - name: Commit and tag
        if: steps.bump.outputs.version != ''
        run: |
          VERSION="${{ steps.bump.outputs.version }}"
          
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          
          git add kiro-sdlc-agents/package.json
          git commit -m "chore: bump extension to v${VERSION} (new prebuilds)"
          git tag "v${VERSION}"
          git push origin main --tags
          
          echo "✅ Pushed v${VERSION} — publish.yml will be triggered"
```

---

## 4. Data Model

Not applicable — no database. Data is stored in:
- GitHub Release assets (binary files)
- `kiro-sdlc-agents/package.json` (version field)
- Workflow environment variables (configuration)

---

## 5. Module Design

### 5.1 File Structure (Changes)

```
.github/workflows/
├── build-native.yml          # Existing (Phase 1 already applied)
├── build-onnxruntime.yml     # MODIFIED — add incremental logic
├── scheduled-prebuild-scan.yml  # NEW
├── auto-release.yml          # NEW
├── publish.yml               # Existing (no changes)
└── ci.yml                    # Existing (no changes)
```

### 5.2 Shared Patterns

All workflows follow these patterns:

| Pattern | Implementation | Rationale |
|---------|---------------|-----------|
| Existence check | `gh release view + grep` | Fast, uses authenticated API |
| Skip logic | `if: steps.check.outputs.skip != 'true'` | GitHub Actions conditional |
| Arch verify | `file` command + grep | Cross-platform binary inspection |
| Error handling | `continue-on-error` + explicit checks | Graceful degradation |
| Concurrency | `concurrency: group` | Prevent race conditions |

### 5.3 Error Handling

| Error | Workflow | Handling |
|-------|---------|----------|
| Release doesn't exist | build-onnxruntime | Treat as "not found" → build |
| npm install fails | build-onnxruntime | Retry with --ignore-scripts |
| Arch verification fails | build-onnxruntime | Exit 1, no upload |
| nodejs.org unavailable | scheduled-scan | Exit 1, retry next week |
| workflow_dispatch fails | scheduled-scan | Log error, continue others |
| Git push conflict | auto-release | Pull --rebase, retry once |
| Tag exists | auto-release | Increment patch again |

---

## 6. Security Design

### 6.1 Permissions Model

| Workflow | Permission | Scope | Justification |
|---------|-----------|-------|---------------|
| build-onnxruntime.yml | contents: write | Release uploads | Upload binary assets |
| scheduled-prebuild-scan.yml | contents: read | Release checks | Read asset lists |
| scheduled-prebuild-scan.yml | actions: write | Workflow triggers | Dispatch other workflows |
| auto-release.yml | contents: write | Git push + tags | Commit version bump |

### 6.2 Secrets

| Secret | Required | Used By | Purpose |
|--------|----------|---------|---------|
| GITHUB_TOKEN | Auto | All | Standard API access |
| PAT | Optional | auto-release | Push tags that trigger publish.yml (GITHUB_TOKEN limitation) |

### 6.3 Security Considerations

- No external secrets exposed in logs (GH_TOKEN is masked)
- `--clobber` only overwrites same-named assets (no arbitrary file access)
- Concurrency group prevents parallel writes to package.json
- `workflow_run` only triggers from default branch (no PR-based attacks)

---

## 7. Performance and Scalability

### 7.1 Performance Targets

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Existence check (per binary) | < 5 seconds | Time from step start to output |
| All-skipped workflow | < 3 minutes total | Workflow run duration |
| Full build (one platform) | < 10 minutes | Build job duration |
| Scan workflow | < 2 minutes | Total scan duration |
| Auto-release | < 1 minute | Version bump + push |

### 7.2 Scalability

| Dimension | Current | Scalable To | Limitation |
|-----------|---------|-------------|------------|
| Platforms | 4 | 8+ | Matrix size limit (256 jobs) |
| Node versions | 4 | 10+ | Matrix size limit |
| Concurrent builds | 4 | 20 | GitHub Actions concurrency limit |

---

## 8. Monitoring and Observability

### 8.1 Logging

Each workflow step produces structured log output:

| Event | Format | Example |
|-------|--------|---------|
| Skip decision | `⏭️ {filename} already exists — skipping` | Clear skip reason |
| Build decision | `🔨 {filename} not found — will build` | Clear build reason |
| Arch verified | `✅ Architecture verified: {arch}` | Confirmation |
| Arch failed | `❌ ERROR: Binary is {actual} but expected {expected}!` | Clear error |
| Scan result | `✅ All versions up to date` or `🔨 Versions needing build: {list}` | Summary |
| Version bump | `✅ Pushed v{version} — publish.yml will be triggered` | Confirmation |

### 8.2 Failure Notifications

GitHub Actions provides built-in email notifications on workflow failure. No additional monitoring needed for this scope.

---

## 9. Deployment Considerations

### 9.1 Rollout Plan

| Phase | Action | Verification |
|-------|--------|-------------|
| 1 | Modify build-onnxruntime.yml | Manual trigger, verify skip logic works |
| 2 | Create scheduled-prebuild-scan.yml | Manual trigger, verify scan + trigger |
| 3 | Create auto-release.yml | Manual trigger, verify version bump |
| 4 | Enable cron schedule | Wait for Monday, verify auto-run |

### 9.2 Rollback Strategy

| Workflow | Rollback Method |
|---------|----------------|
| build-onnxruntime.yml | Revert commit (git revert) |
| scheduled-prebuild-scan.yml | Delete file or disable workflow in GitHub UI |
| auto-release.yml | Delete file or disable workflow in GitHub UI |

### 9.3 Configuration

| Config | Location | How to Update |
|--------|----------|---------------|
| better-sqlite3 version | build-native.yml `DEFAULT_VERSION` env | Edit workflow file |
| onnxruntime version | build-onnxruntime.yml `DEFAULT_VERSION` env | Edit workflow file |
| Supported Node versions | scheduled-prebuild-scan.yml `SUPPORTED_NODE_VERSIONS` env | Edit workflow file |
| Platform matrix | Each workflow's prepare job | Edit matrix generation script |

---

## 10. Implementation Checklist

### Files to Create

| # | File | Type | Description |
|---|------|------|-------------|
| 1 | `.github/workflows/scheduled-prebuild-scan.yml` | New | Weekly scan workflow |
| 2 | `.github/workflows/auto-release.yml` | New | Auto version bump workflow |

### Files to Modify

| # | File | Changes |
|---|------|---------|
| 1 | `.github/workflows/build-onnxruntime.yml` | Add force_rebuild input, check_existing step, verify_arch step, release job skip handling |

### Files Unchanged (Reference Only)

| # | File | Reason |
|---|------|--------|
| 1 | `.github/workflows/build-native.yml` | Already has Phase 1 (reference implementation) |
| 2 | `.github/workflows/publish.yml` | Triggered by tag, no changes needed |
| 3 | `.github/workflows/ci.yml` | Unrelated |

---

## 11. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture Overview | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |

### Open Questions

| # | Question | Status | Answer |
|---|----------|--------|--------|
| 1 | Do we need PAT secret or can we use GITHUB_TOKEN? | Resolved | PAT needed — GITHUB_TOKEN cannot trigger workflows via tag push |
| 2 | Should auto-release bump minor for new Node version support? | Resolved | No — always patch. Minor bumps are for feature changes. |
| 3 | Should scan workflow auto-add new LTS versions to supported list? | Resolved | No — requires manual config update for safety |
