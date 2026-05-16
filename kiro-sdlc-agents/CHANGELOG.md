# Changelog

## [1.2.0] - 2026-05-16

### Breaking Changes
- **Removed `Kiro SDLC: Run Code Indexer` command** — MCP servers handle indexing automatically
- **Removed `kiroSdlc.preferredIndexer` setting** — replaced by MCP variant selection
- **Removed bundled indexer scripts** — no longer injected into workspace

### Added
- **MCP Code Intelligence integration** — extension now injects MCP server config into `.kiro/settings/mcp.json`
- **MCP variant picker** — choose Python, Node.js, or Kotlin MCP server during injection
- **`src/mcp-injector.ts`** — new module handling MCP config injection and legacy migration
- **Auto-migration on upgrade** — legacy `.analysis/code-intelligence/scripts/` folder automatically removed

### Changed
- **"Inject All" flow** — now asks for MCP variant instead of indexer language
- **"Inject Selective"** — indexer option replaced by "Code Intelligence MCP Server" option
- **Status check** — verifies `code-intelligence` key in `mcp.json` instead of `index-config.json`
- **Version bumped** to 1.2.0

### Removed
- **`src/indexer.ts`** — entire file deleted (deprecated)
- **`INDEXER_BASE`, `INDEXER_OPTIONS`, `INDEXER_SCRIPTS`** from config.ts
- **`resources/.analysis/code-intelligence/scripts/`** — no longer bundled

## [1.0.6] - 2026-05-10

### Fixed (Code Review)
- **Removed dead code** — `recordFileInjected()` and `saveWorkspaceVersion()` no-op stub deleted
- **Removed semver sort bug** — `loadWorkspaceVersion()` used string sort for versions (1.0.9 > 1.0.10); function removed entirely
- **Fixed `updateSkipModified` logic** — now correctly skips user-modified files (state="modified") instead of all hash-diff files
- **Fixed unused `proc` variable** in `indexer.ts` `executeIndexer`
- **Removed `async` from sync functions** — `injectComponent`, `injectComponentFiltered`, `forceUpdate` no longer misleadingly async
- **Cleaned unused imports** — `detectModifiedFiles`, `loadWorkspaceManifest` removed from `extension.ts`

### Added
- **`src/file-utils.ts`** — extracted file copy utilities (single responsibility): `copyDirRecursive`, `copyDirFiltered`, `copySelectedItems`
- **`IndexerScript` interface** in `config.ts` — proper type annotation for `INDEXER_SCRIPTS`

### Changed
- **`injector.ts` refactored** — reduced from 240 to ~190 lines by extracting file utils
- **`checksum.ts` optimized** — `getFileStatuses` skips hash computation for outdated files (version mismatch already sufficient)
- **`updateSkipModified` and `updateWithBackup`** now receive `FileStatus[]` (user-modified only) instead of `ModifiedFile[]`

## [1.0.5] - 2026-05-10

### Added
- **Per-file version tracking** — each injected file now records its own version independently in `.kiro/.sdlc-manifest.json`
- **"Show File Versions" in Status** — output channel shows every file with its version, state (current/outdated/modified/missing)
- **"Show Details" on upgrade notification** — see exactly which files are outdated before updating
- **`getVersionReport()`** — generates human-readable report: `file.md [v1.0.3 → v1.0.5]`
- **Legacy migration** — auto-migrates old `.kiro/.sdlc-version` to new per-file manifest on first run

### Changed
- **Workspace tracking format** — replaced single `.kiro/.sdlc-version` (one global version) with `.kiro/.sdlc-manifest.json` (per-file version + hash + injectedAt)
- **Update flow** — now distinguishes "outdated" (old version) from "modified" (user edited same version), shows both in prompt
- **`safeUpdate`** — auto-overwrites when only outdated files exist (no user modifications); prompts only when user has customized files
- **`buildManifestAfterInject`** — records exact version and hash for each file after inject/update

### Removed
- **`saveWorkspaceVersion()`** — replaced by `buildManifestAfterInject()` (no-op stub kept for compat)
- **Version-gating in `detectModifiedFiles`** — removed the `entry.version !== checkVersion` skip that caused the overwrite bug

## [1.0.4] - 2026-05-10

### Fixed
- **Critical: "Inject All" and "Update" now always overwrite outdated files** — previously `detectModifiedFiles` skipped all entries when version mismatched, causing old agent files to persist after upgrade
- **`detectModifiedFiles` removed version-gating** — now compares ALL manifest files against workspace regardless of version, correctly identifying files that differ from bundled content
- **`safeUpdate` distinguishes version upgrade vs same-version** — on upgrade, shows "Overwrite All (recommended)" as default; on same-version, shows standard "Skip Modified" flow
- **`forceUpdate` and `injectAll` use bundled manifest version** instead of hardcoded `EXTENSION_VERSION` constant

### Changed
- **Upgrade prompt UX** — when upgrading (e.g., 1.0.3 → 1.0.4), dialog clearly shows version transition and recommends overwrite since files are outdated, not user-customized

## [1.0.3] - 2026-05-10

### Added
- **SM agent: Project-level workflow** — SM now supports `KSA workflow` syntax (project key without ticket number) to list all tickets and manage project scope
- **SM agent: jira.conf management** — SM creates/updates `jira.conf` when invoked with project-level input; asks user before overwriting if project key differs

### Changed
- **jira.conf simplified** — removed `JIRA_BASE_URL` (unnecessary), only contains `JIRA_PROJECT_PREFIX`
- **SM agent Input Parsing** — now distinguishes ticket-level (`KSA-1`) vs project-level (`KSA workflow`) inputs
- **SM agent prompt** — updated in all 4 locations (agents, prompts, bundled resources)

### Fixed
- **jira.conf project key** — corrected from `ICL2` to `KSA`

## [1.1.0] - 2025-07-14

### Added
- **Checksum management system** (`src/checksum.ts`) — detects user modifications when updating agents by comparing workspace files against bundled manifest
- **`gen-checksums.js` script** — auto-generates `.sdlc-checksums.json` from git-committed content during CI build
- **`sync-from-source.ps1` script** — syncs extension resources from source workspace for development
- **Node.js indexer scripts** (`.analysis/code-intelligence/scripts/nodejs`) — TypeScript-based code intelligence indexer with Vitest tests
- **704 documents** from MCPOrchestration project (templates, workflows, QA summaries)
- **UI Spec template** (`documents/templates/UI-SPEC-TEMPLATE.md`)
- **Workflow documentation** (`documents/workflows/`)

### Changed
- **Refactored `injector.ts`** — uses bundled manifest (`resources/.sdlc-checksums.json`) instead of workspace manifest for tamper-proof update detection
- **Moved GitHub Actions workflows** to repo root (`.github/workflows/`) for proper CI/CD triggering
- **Updated `.kiro` agents** — revised SM agent architecture, updated UI agent prompts
- **Updated `code-intelligence.md` steering** — improved indexer configuration guidance
- **Updated `extension.ts`** — integrated checksum system into activation flow

### Removed
- Legacy `scrum-master-agent.json` and `scrum-master-agent.md` (replaced by new agent design)

## [1.0.0] - 2026-05-09

### Added
- Initial release
- Command: Inject All Agents — copies full SDLC pipeline to workspace
- Command: Inject Selective — pick components to inject
- Command: Run Code Indexer — auto-detect runtime and index source code
- Command: Update Agents — update to latest version
- Command: Show Status — check which components are present
- 9 agents: SM, BA, TA, SA, QA, DEV, DevOps, UI, Security
- 9 steering rules: code-standards, self-learning, file-writing, drawio, jira-workflow, code-intelligence, backend-structure, frontend-structure, kotlin-code-standards
- 8 hooks: code-index (create/edit/delete/full), drawio validation, file-watcher
- 10 document templates: BRD, FSD, TDD, STP, STC, DPG, RLN, UG, TEST-REPORT, SECURITY-REPORT
- Code Intelligence Indexer in 5 languages: Python, Java, PowerShell, Bash, Node.js
- Auto-detect runtime for indexer execution
- Status bar indicator
