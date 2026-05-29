# Functional Specification Document (FSD)

## KSA-184: Migrate Extension Build from tsc to esbuild

| Field | Value |
|-------|-------|
| Ticket | KSA-184 |
| Type | Task (DevOps/Build) |
| Priority | Medium |
| Version | 1.0 |
| Date | 2026-05-29 |
| Related BRD | BRD-v1-KSA-184.docx |

---

## 1. Overview

This document specifies the functional changes required to migrate the `kiro-sdlc-agents` extension build from TypeScript compiler (`tsc`) to `esbuild` bundler.

## 2. System Context

![System Context: esbuild Build Pipeline](diagrams/system-context.png)

*[Edit in draw.io](diagrams/system-context.drawio)*

## 3. Functional Specifications

### 3.1 esbuild Configuration (esbuild.js)

**Purpose:** Central build configuration for bundling the extension.

| Property | Value | Rationale |
|----------|-------|-----------|
| entryPoints | `['src/extension.ts']` | Single entry point for VS Code extension |
| bundle | `true` | Bundle all imports into one file |
| outfile | `'out/extension.js'` | Standard VS Code extension output path |
| external | `['vscode']` | VS Code API provided at runtime, must not bundle |
| format | `'cjs'` | VS Code extensions use CommonJS |
| platform | `'node'` | Extension runs in Node.js |
| target | `'node18'` | Minimum Node.js version for VS Code 1.85+ |
| sourcemap | `!production` | Only in dev for debugging |
| minify | `production` | Reduce file size in production |
| treeShaking | `true` | Remove unused code |

**Modes:**
- `--production`: Minified, no sourcemaps, tree-shaken
- `--watch`: Incremental rebuilds on file change
- Default (no flags): Development build with sourcemaps

### 3.2 Package.json Script Changes

| Script | Before (tsc) | After (esbuild) |
|--------|-------------|-----------------|
| `vscode:prepublish` | `npm run compile` (tsc) | `npm run copy-resources && npm run gen-checksums && npm run esbuild-production` |
| `esbuild` | N/A | `node esbuild.js` |
| `esbuild-production` | N/A | `node esbuild.js --production` |
| `esbuild-watch` | N/A | `node esbuild.js --watch` |
| `compile` | `tsc -p ./` | `tsc -p ./` (kept for type-checking) |
| `watch` | `tsc -watch -p ./` | `tsc -watch -p ./` (kept for type-checking) |

### 3.3 .vscodeignore Changes

**New exclusions added:**
- `node_modules/**` — Not needed since all code is bundled
- `esbuild.js` — Build config, not needed at runtime

**Existing exclusions maintained:**
- `src/**`, `.vscode/**`, `tsconfig.json`, etc.

**Critical inclusion maintained:**
- `!mcp-server/node_modules/**` — MCP server JS wrappers still needed at runtime

### 3.4 Publish Workflow (publish.yml)

**Simplified flow:**
1. Checkout code
2. Setup Node.js 20
3. Sync version from git tag (if tag push)
4. `npm ci` — Install dependencies (including esbuild)
5. `npx vsce package --no-dependencies` — Triggers `vscode:prepublish` which runs esbuild production build
6. Upload VSIX artifact
7. Publish to VS Code Marketplace / Open VSX

**Key change:** Removed explicit compile step — `vsce package` triggers prepublish which handles everything.

## 4. Data Flow

![Data Flow: Publish Pipeline](diagrams/data-flow.png)

*[Edit in draw.io](diagrams/data-flow.drawio)*

## 5. Error Handling

| Scenario | Behavior |
|----------|----------|
| esbuild build fails | Process exits with code 1, error logged to stderr |
| Missing dependency in bundle | esbuild reports unresolved import at build time |
| `vscode` accidentally bundled | Prevented by `external: ['vscode']` config |
| Watch mode crash | Error logged, process continues watching |

## 6. Validation Rules

| Rule | Check |
|------|-------|
| VR-1 | `out/extension.js` must exist after build |
| VR-2 | `out/extension.js` must be a single file (no chunks) |
| VR-3 | Extension must activate without errors |
| VR-4 | All commands must register correctly |
| VR-5 | MCP server must start correctly (not affected by bundling) |

## 7. Impact Analysis

| Component | Impact | Risk |
|-----------|--------|------|
| Extension activation | None — same entry point `out/extension.js` | Low |
| MCP server | None — separate process, not bundled | None |
| Tests | None — tests run against source, not bundle | None |
| CI/CD | Simplified — fewer explicit steps | Low |
| Dev workflow | Improved — faster rebuilds with watch | None |

---

*Document Version: 1.0 | Created: 2026-05-29*
