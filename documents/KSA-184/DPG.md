# Deployment Guide (DPG)

## KSA-184: Migrate Extension Build from tsc to esbuild

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-184 |
| Title | Migrate Extension Build from tsc to esbuild |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2025-07-15 |
| Status | Final |
| Related TDD | TDD-v1-KSA-184.docx |

---

## 1. Overview

### 1.1 Feature Summary

Migrated the VS Code extension build pipeline from plain TypeScript compiler (tsc) to esbuild bundler, producing a significantly smaller VSIX package with faster load times and simplified CI/CD.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| esbuild.mjs | New | Build script configuration |
| package.json scripts | Modified | Build commands updated |
| tsconfig.json | Modified | Adjusted for esbuild compatibility |
| CI workflow | Modified | Updated build steps |

### 1.3 Target Environments

| Environment | Deploy Order |
|-------------|-------------|
| DEV (local build) | 1st |
| CI/CD pipeline | 2nd |
| Marketplace publish | 3rd |

---

## 2. Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node.js 20.x | Build-time |
| esbuild (devDependency) | Added to package.json |

---

## 3. Pre-Deployment Checklist

| # | Item | Status |
|---|------|--------|
| 1 | esbuild config produces valid bundle | Done |
| 2 | VSIX size reduced 50%+ | Done |
| 3 | Extension activates correctly from bundle | Done |
| 4 | Source maps work in dev mode | Done |
| 5 | Watch mode functional | Done |
| 6 | CI pipeline updated | Done |

---

## 4. Database Migration

Not applicable.

---

## 5. Application Deployment

### 5.1 Build Steps

| Step | Command | Verification |
|------|---------|-------------|
| 1 | `npm ci` | Dependencies + esbuild installed |
| 2 | `npm run build` | Single bundled output file |
| 3 | `vsce package` | VSIX smaller than before |

### 5.2 Deployment Steps

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Update CI workflow to use new build commands | CI passes |
| 2 | Build VSIX with esbuild | Size reduced |
| 3 | Install and test extension | Activates normally |
| 4 | Publish to marketplace | Published successfully |

---

## 6. Configuration Changes

### Modified Scripts (package.json)

| Script | Before | After |
|--------|--------|-------|
| build | tsc -p ./ | node esbuild.mjs |
| watch | tsc -watch -p ./ | node esbuild.mjs --watch |

---

## 7. Post-Deployment Verification

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Check VSIX size | 50%+ smaller than tsc version |
| 2 | Activate extension | Less than 200ms activation |
| 3 | All features work | No regressions |
| 4 | Dev watch mode | Incremental rebuilds fast |

---

## 8. Rollback Plan

| Step | Action |
|------|--------|
| 1 | Revert package.json scripts to tsc |
| 2 | Remove esbuild.mjs |
| 3 | Rebuild with tsc |

Rollback Time: ~5 minutes.
