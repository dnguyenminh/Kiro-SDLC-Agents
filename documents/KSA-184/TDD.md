# Technical Design Document (TDD)

## KSA-184: Migrate Extension Build from tsc to esbuild

| Field | Value |
|-------|-------|
| Ticket | KSA-184 |
| Type | Task (DevOps/Build) |
| Priority | Medium |
| Version | 1.0 |
| Date | 2026-05-29 |
| Related FSD | FSD-v1-KSA-184.docx |

---

## 1. Architecture Overview

### 1.1 Build Architecture (Before vs After)

**Before (tsc):**
```
src/
  extension.ts
  commands/*.ts
  providers/*.ts
  utils/*.ts
        |
        v (tsc compiles each file individually)
out/
  extension.js
  commands/*.js
  providers/*.js
  utils/*.js    (many individual .js files)
        |
        v (vsce packages all .js + node_modules)
kiro-sdlc-agents-1.x.x.vsix  (LARGE)
```

**After (esbuild):**
```
src/
  extension.ts
  commands/*.ts
  providers/*.ts
  utils/*.ts
        |
        v (esbuild bundles + tree-shakes + minifies)
out/
  extension.js  (SINGLE bundled file)
        |
        v (vsce packages only bundled file, no node_modules)
kiro-sdlc-agents-1.x.x.vsix  (SMALL)
```

### 1.2 Component Diagram

```
+------------------+     +------------------+     +------------------+
|   esbuild.js     |     |  package.json    |     |  .vscodeignore   |
|  (build config)  |     |  (scripts)       |     |  (VSIX filter)   |
+--------+---------+     +--------+---------+     +--------+---------+
         |                         |                        |
         v                         v                        v
+--------+---------+     +--------+---------+     +--------+---------+
| esbuild bundler  |<----|  npm scripts     |     | vsce packager    |
| - bundle         |     | - prepublish     |---->| - include/exclude|
| - minify         |     | - esbuild-prod   |     | - .vsix output   |
| - tree-shake     |     | - esbuild-watch  |     +------------------+
+--------+---------+     +------------------+
         |
         v
+--------+---------+
| out/extension.js |
| (single file)    |
+------------------+
```

## 2. Detailed Design

### 2.1 esbuild.js Implementation

```javascript
// File: kiro-sdlc-agents/esbuild.js
const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  external: ['vscode'],       // VS Code API - provided by host
  format: 'cjs',              // CommonJS required by VS Code
  platform: 'node',           // Node.js runtime
  target: 'node18',           // VS Code 1.85+ ships Node 18
  sourcemap: !production,     // Dev only
  minify: production,         // Prod only
  treeShaking: true,          // Always - remove dead code
};

async function main() {
  if (watch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
  } else {
    await esbuild.build(buildOptions);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

**Design Decisions:**

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Format | CJS | VS Code extension host requires CommonJS |
| External | `['vscode']` | VS Code API injected at runtime |
| Target | node18 | Matches VS Code 1.85+ minimum |
| Single entry | `src/extension.ts` | Standard VS Code extension pattern |
| No code splitting | Single outfile | VS Code loads single main file |

### 2.2 Script Configuration

```json
{
  "scripts": {
    "vscode:prepublish": "npm run copy-resources && npm run gen-checksums && npm run esbuild-production",
    "esbuild": "node esbuild.js",
    "esbuild-production": "node esbuild.js --production",
    "esbuild-watch": "node esbuild.js --watch",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./"
  }
}
```

**Note:** `compile` and `watch` (tsc) are kept for type-checking during development. They are NOT used for production builds.

### 2.3 .vscodeignore Configuration

```gitignore
# Exclude source and build tools (bundled into out/extension.js)
node_modules/**
esbuild.js
src/**
tsconfig.json

# Keep MCP server runtime dependencies
!mcp-server/node_modules/**
```

### 2.4 CI/CD Workflow

```yaml
# publish.yml - simplified
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with: { node-version: 20 }
  - run: npm ci
  - run: npx vsce package --no-dependencies
  # vsce package triggers: prepublish -> copy-resources -> gen-checksums -> esbuild-production
```

## 3. Security Considerations

| Concern | Assessment |
|---------|-----------|
| Supply chain (esbuild dep) | esbuild is widely used, maintained by Evan Wallace (Go binary) |
| Minification hiding malicious code | N/A — we control all source code |
| Source map exposure | Disabled in production builds |

## 4. Performance Impact

| Metric | Before (tsc) | After (esbuild) | Improvement |
|--------|-------------|-----------------|-------------|
| Build time (prod) | ~8-12s | ~1-3s | 3-4x faster |
| Watch rebuild | ~3-5s | <100ms | 30-50x faster |
| VSIX size | ~15-25MB (with node_modules) | ~5-8MB (bundled only) | 50-70% smaller |
| Extension load | Multiple file reads | Single file read | Faster activation |

## 5. Implementation Checklist

| # | File | Action | Status |
|---|------|--------|--------|
| 1 | `esbuild.js` | Create new file | Done |
| 2 | `package.json` | Update scripts, add esbuild devDep | Done |
| 3 | `.vscodeignore` | Add node_modules/**, esbuild.js exclusions | Done |
| 4 | `.github/workflows/publish.yml` | Simplify to let vsce trigger prepublish | Done |

## 6. Rollback Plan

If esbuild migration causes issues:
1. Revert `vscode:prepublish` to `npm run compile` (tsc)
2. Remove esbuild-related scripts
3. Remove `node_modules/**` from `.vscodeignore`
4. Remove `esbuild.js`
5. Remove esbuild from devDependencies

All changes are in 4 files — simple git revert.

## 7. Testing Strategy

| Test | Method | Expected Result |
|------|--------|-----------------|
| Build succeeds | `npm run esbuild-production` | Exit code 0, `out/extension.js` exists |
| Bundle is single file | Check `out/` directory | Only `extension.js` (no other .js) |
| Extension activates | Install VSIX in VS Code | No activation errors |
| Commands work | Run each command | All commands functional |
| Watch mode | `npm run esbuild-watch` + edit file | Rebuild triggered |
| CI/CD | Push tag | VSIX published successfully |

---

*Document Version: 1.0 | Created: 2026-05-29*
