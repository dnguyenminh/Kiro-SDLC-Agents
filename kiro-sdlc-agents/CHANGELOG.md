# Changelog

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
