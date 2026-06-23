# Deployment Guide (DPG)

## Kiro SDLC Agents Extension — KSA-2: Extension Core — Commands & Activation

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-2 |
| Title | Extension Core — Commands & Activation |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2025-01-20 |
| Status | Draft |
| Related TDD | TDD-v1.0-KSA-2.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-20 | DevOps Agent | Initiate document — auto-generated from TDD and project context |

---

## Sign-Off

| Name | Role | Signature and date |
|------|------|--------------------|
| | Dev Lead | ☐ Approved for deployment |
| | QA Lead | ☐ Testing completed |
| | Ops Lead | ☐ Infrastructure ready |

---

## 1. Overview

### 1.1 Feature Summary

The **Extension Core — Commands & Activation** component is the entry point of the Kiro SDLC Agents VS Code extension. It provides:

- Startup activation (extension loads immediately when VS Code/Kiro IDE starts)
- Five Command Palette commands for injecting SDLC agents, running code indexer, updating agents, and checking status
- A status bar indicator showing SDLC component health (present/missing/no workspace)
- Confirmation dialogs before destructive operations (inject all, update)

This is a **client-side VS Code extension** — no server deployment, no database, no containers. Deployment means publishing the `.vsix` package to VS Code Marketplace and/or Open VSX Registry.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| kiro-sdlc-agents extension | New | VS Code extension packaged as `.vsix` |
| GitHub Actions CI | New | Build + compile verification on push/PR |
| GitHub Actions Publish | New | Automated publish to Marketplace on tag push |
| VS Code Marketplace listing | New | Public extension listing |
| Open VSX Registry listing | New | Kiro IDE / open-source marketplace listing |

### 1.3 Target Environments

| Environment | Distribution Channel | Deploy Order | Approval Required |
|-------------|---------------------|-------------|-------------------|
| DEV | Local `.vsix` install | 1st | No |
| BETA | Pre-release flag on Marketplace | 2nd | Dev Lead |
| PROD (Marketplace) | VS Code Marketplace | 3rd | Dev Lead + QA Sign-off |
| PROD (Open VSX) | Open VSX Registry | 3rd | Dev Lead + QA Sign-off |

---

## 2. Prerequisites

### 2.1 Infrastructure

| Requirement | Status | Notes |
|-------------|--------|-------|
| GitHub repository | Ready | Source code hosted on GitHub |
| GitHub Actions enabled | Ready | CI/CD workflows in `.github/workflows/` |
| VS Code Marketplace publisher account | Pending | Publisher ID: `your-publisher-id` (must be registered) |
| Open VSX namespace | Pending | Namespace must be claimed on open-vsx.org |

### 2.2 Software Dependencies

| Dependency | Version | Status |
|-----------|---------|--------|
| Node.js | 20.x LTS | Required for build |
| TypeScript | ^5.4.0 | devDependency |
| @vscode/vsce | ^2.24.0 | Packaging & publishing tool |
| VS Code Engine | ^1.85.0 | Minimum compatible version |

### 2.3 Access Requirements

| Access | Type | Who Needs It |
|--------|------|-------------|
| GitHub repository write | SSH key / PAT | Dev team |
| VS Code Marketplace PAT | Personal Access Token | CI/CD (secret: `VSCE_PAT`) |
| Open VSX Token | API Token | CI/CD (secret: `OVSX_TOKEN`) |
| GitHub Actions secrets | Repository settings | Repository admin |

### 2.4 Backup Requirements

- [ ] Previous `.vsix` artifact saved (download from GitHub Actions artifacts)
- [ ] Git tag for previous release exists (enables rollback via `git checkout`)
- [ ] Marketplace allows unpublishing/reverting to previous version

---

## 3. Pre-Deployment Checklist

| # | Item | Responsible | Status |
|---|------|-------------|--------|
| 1 | Code merged to `main` branch | Developer | ☐ |
| 2 | All TypeScript compilation passes (`npm run compile`) | Developer | ☐ |
| 3 | CI workflow passes (GitHub Actions) | Automated | ☐ |
| 4 | VSIX package builds successfully (`npm run package`) | Developer | ☐ |
| 5 | Manual testing in VS Code (5 commands work) | QA | ☐ |
| 6 | Status bar displays correctly (3 states) | QA | ☐ |
| 7 | Confirmation dialogs appear for inject/update | QA | ☐ |
| 8 | Extension activates on startup without errors | QA | ☐ |
| 9 | `package.json` version bumped to target version | Developer | ☐ |
| 10 | `publisher` field updated from `your-publisher-id` | Developer | ☐ |
| 11 | `CHANGELOG.md` updated with release notes | Developer | ☐ |
| 12 | GitHub secrets configured (`VSCE_PAT`, `OVSX_TOKEN`) | DevOps | ☐ |
| 13 | README.md has accurate installation instructions | Developer | ☐ |
| 14 | Icon file exists at `resources/icon.png` (128x128) | Developer | ☐ |

---

## 4. Database Migration

> **Not Applicable.** This is a client-side VS Code extension with no database. The extension operates entirely within the user's local file system.

---

## 5. Application Deployment

### 5.1 Deployment Flow

![Deployment Flow](diagrams/deployment-flow.png)

### 5.2 Method A: Automated Publish via GitHub Actions (Recommended)

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Ensure all changes merged to `main` | `git log --oneline -5` | Latest commit is the release commit |
| 2 | Update version in `package.json` | Edit `"version": "1.0.0"` | `npm pkg get version` returns correct version |
| 3 | Commit version bump | `git commit -am "chore: bump version to 1.0.0"` | Commit in log |
| 4 | Create and push git tag | `git tag v1.0.0 && git push origin v1.0.0` | Tag visible on GitHub |
| 5 | GitHub Actions triggers `publish.yml` | Automatic on tag push | Check Actions tab for green build |
| 6 | Verify VSIX artifact uploaded | GitHub Actions → Artifacts | `kiro-sdlc-agents-1.0.0.vsix` present |
| 7 | Verify Marketplace publish | VS Code Marketplace website | Extension visible and installable |
| 8 | Verify Open VSX publish | open-vsx.org | Extension visible and installable |

### 5.3 Method B: Manual Publish (Fallback)

```bash
# Step 1: Install dependencies
npm ci

# Step 2: Compile TypeScript
npm run compile

# Step 3: Package VSIX
npx vsce package --no-dependencies

# Step 4: Verify VSIX created
ls -la kiro-sdlc-agents-1.0.0.vsix

# Step 5: Publish to VS Code Marketplace
npx vsce publish --packagePath kiro-sdlc-agents-1.0.0.vsix -p <VSCE_PAT>

# Step 6: Publish to Open VSX
npx ovsx publish kiro-sdlc-agents-1.0.0.vsix -p <OVSX_TOKEN>
```

### 5.4 Method C: Local VSIX Distribution (DEV/Testing)

```bash
# Install locally for testing
code --install-extension kiro-sdlc-agents-1.0.0.vsix

# Verify installation
code --list-extensions | grep kiro-sdlc-agents

# Uninstall if needed
code --uninstall-extension your-publisher-id.kiro-sdlc-agents
```

---

## 6. Configuration Changes

### 6.1 GitHub Repository Secrets (Required for CI/CD)

| Secret Name | Description | Where to Get |
|-------------|-------------|-------------|
| `VSCE_PAT` | VS Code Marketplace Personal Access Token | https://dev.azure.com → User Settings → PAT → Marketplace (Manage) scope |
| `OVSX_TOKEN` | Open VSX Registry API Token | https://open-vsx.org → User Settings → Access Tokens |

### 6.2 Extension Settings (User-Facing)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `kiroSdlc.autoIndex` | boolean | `true` | Auto-run code indexer after injection |
| `kiroSdlc.preferredIndexer` | enum | `"auto"` | Preferred indexer: auto, python, java, nodejs, powershell, bash |

### 6.3 package.json Changes Before Publish

| Field | Current Value | Required Value |
|-------|---------------|----------------|
| `publisher` | `your-publisher-id` | Actual registered publisher ID |
| `repository.url` | `https://github.com/YOUR_USERNAME/kiro-sdlc-agents` | Actual GitHub URL |
| `version` | `1.0.0` | Target release version |

---

## 7. Post-Deployment Verification

### 7.1 Health Checks

| Check | Method | Expected Result | Timeout |
|-------|--------|-----------------|---------|
| Extension activates | Open VS Code with extension installed | No errors in Extension Host output | 5s |
| Commands registered | Open Command Palette, type "Kiro SDLC" | All 5 commands visible | 2s |
| Status bar visible | Look at bottom-right status bar | Icon + "SDLC Agents" text visible | 2s |
| Marketplace listing | Visit marketplace URL | Extension page loads with correct metadata | 30s |
| Open VSX listing | Visit open-vsx.org | Extension page loads with correct metadata | 30s |

### 7.2 Smoke Tests

| # | Scenario | Steps | Expected Result |
|---|----------|-------|-----------------|
| 1 | Extension activates on startup | Install extension → Restart VS Code | Status bar shows, no errors in Developer Tools console |
| 2 | Inject All command works | Ctrl+Shift+P → "Kiro SDLC: Inject All" → Yes | Confirmation dialog → files injected → success message |
| 3 | Status command works | Ctrl+Shift+P → "Kiro SDLC: Show Status" | Status report shows ✅/❌ for each component |
| 4 | Confirmation dialog blocks | Ctrl+Shift+P → "Kiro SDLC: Inject All" → Cancel | No files modified |
| 5 | No workspace error | Open VS Code without folder → run any command | Error message: "No workspace folder open" |

### 7.3 Log Verification

| Log Entry | Level | Expected | Location |
|-----------|-------|----------|----------|
| Extension activated | DEBUG | Within 100ms of VS Code start | Extension Host Output |
| Command registered | DEBUG | During activation | Extension Host Output |
| Indexer output | INFO | When "Run Code Indexer" executed | Output Channel: "Kiro Code Indexer" |

### 7.4 Monitoring Dashboard

- [ ] VS Code Marketplace analytics shows installs increasing
- [ ] No crash reports in Marketplace publisher dashboard
- [ ] GitHub Issues — no critical bug reports within 24h of release
- [ ] Open VSX download count visible

---

## 8. Rollback Plan

### 8.1 Rollback Flow

![Rollback Flow](diagrams/rollback-flow.png)

### 8.2 Rollback Decision Criteria

| Condition | Action |
|-----------|--------|
| Extension crashes VS Code on startup | Immediate rollback — unpublish version |
| Commands throw unhandled errors | Immediate rollback — publish previous version |
| Extension fails to activate (silent) | Hotfix — patch and publish new version |
| Minor UI issue (tooltip text wrong) | No rollback — fix in next patch |
| Marketplace listing metadata wrong | No rollback — update listing metadata |

### 8.3 Rollback Steps

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Unpublish broken version | `npx vsce unpublish your-publisher-id.kiro-sdlc-agents` | Marketplace shows extension removed |
| 2 | Checkout previous release tag | `git checkout v0.9.0` (previous tag) | Source matches previous release |
| 3 | Build previous version | `npm ci && npm run compile && npx vsce package` | VSIX created |
| 4 | Publish previous version | `npx vsce publish --packagePath *.vsix -p <PAT>` | Previous version live on Marketplace |
| 5 | Verify rollback | Install from Marketplace | Previous behavior restored |

**Alternative: Version-specific unpublish (keep extension, remove bad version):**
```bash
# Unpublish specific version only
npx vsce unpublish your-publisher-id.kiro-sdlc-agents --version 1.0.0
```

### 8.4 Rollback Time Estimate

| Action | Estimated Time |
|--------|---------------|
| Decision to rollback | 5 minutes |
| Unpublish from Marketplace | 2 minutes |
| Build previous version | 3 minutes |
| Publish previous version | 5 minutes |
| Verification | 5 minutes |
| **Total** | **~20 minutes** |

---

## 9. Environment-Specific Notes

### 9.1 DEV (Local Testing)

- Install directly from `.vsix` file: `code --install-extension kiro-sdlc-agents-1.0.0.vsix`
- Use VS Code's "Run Extension" (F5) for debugging during development
- Extension Host output visible in Debug Console
- No approval required

### 9.2 BETA (Pre-release)

- Publish with `--pre-release` flag: `npx vsce publish --pre-release`
- Only users who opt-in to pre-release versions will receive it
- Monitor feedback via GitHub Issues
- Requires Dev Lead approval

### 9.3 PROD (VS Code Marketplace)

- **Deployment Window:** Any time (Marketplace publishes are instant, users update asynchronously)
- **Approval Required From:** Dev Lead + QA Lead
- **Communication Plan:** Update CHANGELOG.md, create GitHub Release with notes
- **Propagation Time:** ~5-10 minutes for Marketplace CDN, users get update on next VS Code restart
- **Rollback:** Unpublish via `vsce unpublish` or publish patched version

### 9.4 PROD (Open VSX Registry)

- Published simultaneously with VS Code Marketplace via GitHub Actions
- Serves Kiro IDE and other open-source VS Code forks
- Same approval requirements as Marketplace
- Rollback: `npx ovsx unpublish` or publish patched version

---

## 10. Appendix

### Contacts

| Role | Name | Contact |
|------|------|---------|
| Dev Lead | TBD | TBD |
| QA Lead | TBD | TBD |
| DevOps | DevOps Agent | Automated |
| Publisher Admin | TBD | TBD |

### Related Tickets

| Ticket | Summary | Relationship |
|--------|---------|-------------|
| KSA-2 | Extension Core — Commands & Activation | Main ticket |
| KSA-1 | Kiro SDLC Agents — VS Code/Kiro Extension | Parent epic |
| KSA-11 | Publish to Marketplace | Related (distribution) |

### CI/CD Pipeline Reference

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `.github/workflows/ci.yml` | Push to `main`, PR to `main` | Build verification (compile + package) |
| `.github/workflows/publish.yml` | Tag push `v*`, manual dispatch | Publish to Marketplace + Open VSX |
