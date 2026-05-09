# Changelog

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
