# Software Test Plan (STP)

## KSA-184: Migrate Extension Build from tsc to esbuild

| Field | Value |
|-------|-------|
| Ticket | KSA-184 |
| Type | Task (DevOps/Build) |
| Priority | Medium |
| Version | 1.0 |
| Date | 2026-05-29 |
| Related TDD | TDD-v1-KSA-184.docx |

---

## 1. Test Scope

This test plan covers verification of the build pipeline migration from `tsc` to `esbuild`. Since this is a DevOps/build tooling change with no runtime code changes, testing focuses on:
- Build process correctness
- Output artifact validation
- CI/CD workflow verification
- Extension activation (smoke test)

## 2. Test Strategy

| Level | Applicable | Rationale |
|-------|-----------|-----------|
| Unit Tests | No | No new runtime code — build config only |
| Integration Tests | Yes | Verify esbuild produces valid bundle |
| E2E Tests | Yes | Verify extension activates from bundled output |
| CI/CD Tests | Yes | Verify publish workflow works end-to-end |

## 3. Test Cases

### 3.1 Build Process Tests (Integration)

| TC-ID | Test Case | Steps | Expected Result | Priority |
|-------|-----------|-------|-----------------|----------|
| TC-001 | Production build succeeds | Run `npm run esbuild-production` | Exit code 0, no errors | Critical |
| TC-002 | Output is single file | Check `out/` after production build | Only `extension.js` exists (no .js.map) | Critical |
| TC-003 | Dev build includes sourcemap | Run `npm run esbuild` (no --production) | `out/extension.js` + `out/extension.js.map` exist | High |
| TC-004 | Watch mode starts | Run `npm run esbuild-watch` | Console shows "[esbuild] watching..." | Medium |
| TC-005 | Watch mode rebuilds on change | Edit a .ts file while watch running | Rebuild triggered, new output | Medium |
| TC-006 | vscode module not bundled | Inspect `out/extension.js` | No vscode module code inlined, uses require('vscode') | Critical |
| TC-007 | Prepublish chain works | Run `npm run vscode:prepublish` | copy-resources + gen-checksums + esbuild-production all succeed | Critical |

### 3.2 VSIX Package Tests

| TC-ID | Test Case | Steps | Expected Result | Priority |
|-------|-----------|-------|-----------------|----------|
| TC-008 | VSIX packages successfully | Run `vsce package --no-dependencies` | .vsix file created without errors | Critical |
| TC-009 | VSIX excludes node_modules | Unzip .vsix, check contents | No `node_modules/` in extension root (mcp-server/node_modules OK) | Critical |
| TC-010 | VSIX excludes esbuild.js | Unzip .vsix, check contents | No `esbuild.js` in package | High |
| TC-011 | VSIX excludes src/ | Unzip .vsix, check contents | No `src/` directory | High |
| TC-012 | VSIX size reduced | Compare .vsix size before/after | At least 50% smaller | High |
| TC-013 | VSIX includes mcp-server deps | Unzip .vsix, check contents | `mcp-server/node_modules/` present | Critical |

### 3.3 Extension Activation Tests (E2E)

| TC-ID | Test Case | Steps | Expected Result | Priority |
|-------|-----------|-------|-----------------|----------|
| TC-014 | Extension activates | Install .vsix in VS Code, open workspace | Extension activates, tree view appears | Critical |
| TC-015 | Commands register | Open command palette | All kiroSdlc.* commands visible | Critical |
| TC-016 | Inject All works | Run "Kiro SDLC: Inject All Agents" | Files injected successfully | High |
| TC-017 | MCP server starts | Check extension output | MCP server starts on configured port | High |

### 3.4 CI/CD Workflow Tests

| TC-ID | Test Case | Steps | Expected Result | Priority |
|-------|-----------|-------|-----------------|----------|
| TC-018 | Workflow triggers on tag | Push tag `v1.x.x` | publish.yml workflow starts | Critical |
| TC-019 | Version synced from tag | Push tag `v1.12.0` | package.json version = 1.12.0 in build | High |
| TC-020 | VSIX artifact uploaded | Check workflow artifacts | .vsix file in artifacts | High |
| TC-021 | Marketplace publish | Complete workflow run | Extension published to VS Code Marketplace | Critical |
| TC-022 | Open VSX publish | Complete workflow run | Extension published to Open VSX | High |

## 4. Requirements Traceability Matrix (RTM)

| Requirement | Test Cases | Coverage |
|-------------|-----------|----------|
| AC-1.1: esbuild-production produces single file | TC-001, TC-002 | Full |
| AC-1.2: vsce package triggers esbuild via prepublish | TC-007, TC-008 | Full |
| AC-1.3: VSIX excludes node_modules and esbuild.js | TC-009, TC-010 | Full |
| AC-1.4: Extension activates correctly | TC-014, TC-015 | Full |
| AC-2.1: Watch mode works | TC-004, TC-005 | Full |
| AC-2.2: Source maps in dev | TC-003 | Full |
| AC-3.1: CI runs npm ci then vsce package | TC-018, TC-019 | Full |
| AC-3.2: Published to Marketplace + Open VSX | TC-021, TC-022 | Full |
| AC-3.3: Version synced from tag | TC-019 | Full |
| NFR-1: VSIX size reduction >= 50% | TC-012 | Full |

## 5. Test Environment

| Component | Requirement |
|-----------|-------------|
| Node.js | v20 (matches CI) |
| OS | Windows/Linux/macOS (CI uses ubuntu-latest) |
| VS Code | v1.85+ |
| npm | v10+ |

## 6. Test Execution Plan

| Phase | Tests | Method | Responsible |
|-------|-------|--------|-------------|
| 1. Local build | TC-001 to TC-007 | Manual CLI | Developer |
| 2. Package validation | TC-008 to TC-013 | Manual + script | Developer |
| 3. Extension smoke test | TC-014 to TC-017 | Manual in VS Code | Developer/QA |
| 4. CI/CD verification | TC-018 to TC-022 | Push test tag | Developer |

## 7. Pass/Fail Criteria

- **Pass:** All Critical test cases pass, no High-priority failures
- **Fail:** Any Critical test case fails
- **Conditional Pass:** All Critical pass, 1-2 High failures with documented workaround

---

*Document Version: 1.0 | Created: 2026-05-29*
