# Business Requirements Document (BRD)

## KSA-184: Migrate Extension Build from tsc to esbuild

| Field | Value |
|-------|-------|
| Ticket | KSA-184 |
| Type | Task (DevOps/Build) |
| Priority | Medium |
| Version | 1.0 |
| Date | 2026-05-29 |

---

## 1. Executive Summary

Migrate the `kiro-sdlc-agents` VS Code extension build pipeline from plain TypeScript compiler (`tsc`) to `esbuild` bundler to produce a significantly smaller VSIX package with faster load times.

## 2. Business Objectives

| # | Objective | Success Metric |
|---|-----------|----------------|
| OBJ-1 | Reduce VSIX package size | ≥50% reduction in .vsix file size |
| OBJ-2 | Improve extension load time | Faster activation (single bundled file vs many) |
| OBJ-3 | Simplify CI/CD pipeline | Fewer build steps in publish workflow |
| OBJ-4 | Maintain development experience | Watch mode, source maps in dev |

## 3. Scope

### 3.1 In Scope

- Replace `tsc` compilation with `esbuild` bundling for production builds
- Configure tree-shaking and minification for production
- Update `package.json` scripts (`vscode:prepublish`, new esbuild scripts)
- Update `.vscodeignore` to exclude `node_modules` and build config from VSIX
- Simplify `publish.yml` GitHub Actions workflow
- Maintain `tsc` for type-checking during development

### 3.2 Out of Scope

- Runtime behavior changes to the extension
- MCP server bundling (remains separate)
- Test framework changes
- Feature additions

## 4. User Stories

### STORY-1: Developer builds extension for publishing

**As a** developer,  
**I want** the extension to be bundled into a single minified file when packaging,  
**So that** the VSIX is smaller and installs/loads faster for end users.

**Acceptance Criteria:**
- AC-1.1: `npm run esbuild-production` produces single `out/extension.js` (bundled + minified)
- AC-1.2: `vsce package` triggers esbuild production build via `vscode:prepublish`
- AC-1.3: VSIX excludes `node_modules/**` and `esbuild.js`
- AC-1.4: Extension activates correctly from bundled output

### STORY-2: Developer uses watch mode during development

**As a** developer,  
**I want** esbuild watch mode for fast incremental rebuilds,  
**So that** I can iterate quickly during development.

**Acceptance Criteria:**
- AC-2.1: `npm run esbuild-watch` starts esbuild in watch mode
- AC-2.2: Source maps are generated in non-production mode
- AC-2.3: Changes to `.ts` files trigger automatic rebuild

### STORY-3: CI/CD publishes extension automatically

**As a** CI/CD pipeline,  
**I want** the publish workflow to produce a valid VSIX via esbuild,  
**So that** releases are automated and consistent.

**Acceptance Criteria:**
- AC-3.1: `publish.yml` runs `npm ci` then `vsce package` (which triggers prepublish then esbuild)
- AC-3.2: VSIX is published to VS Code Marketplace and Open VSX
- AC-3.3: Version is synced from git tag

## 5. Dependencies

| # | Dependency | Type | Impact |
|---|-----------|------|--------|
| DEP-1 | esbuild ^0.21.0 | devDependency | Build tool |
| DEP-2 | Node.js 18+ | Runtime target | esbuild target setting |
| DEP-3 | vscode external | Bundle config | Must not bundle vscode API |

## 6. Non-Functional Requirements

| # | Requirement | Target |
|---|-------------|--------|
| NFR-1 | VSIX size reduction | ≥50% smaller than tsc output |
| NFR-2 | Build time | ≤5 seconds for production build |
| NFR-3 | Watch rebuild time | ≤500ms incremental |
| NFR-4 | Backward compatibility | Extension behavior unchanged |

## 7. Risks

| # | Risk | Probability | Impact | Mitigation |
|---|------|-------------|--------|------------|
| R-1 | Dynamic requires not bundled | Low | High | Mark as external or use require() patterns esbuild supports |
| R-2 | Source maps missing in prod debug | Low | Low | Can enable sourcemap for debugging builds |
| R-3 | Tree-shaking removes needed code | Low | High | Test extension activation after bundling |

---

*Document Version: 1.0 | Created: 2026-05-29*
