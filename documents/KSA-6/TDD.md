# Technical Design Document (TDD)

## Kiro SDLC Agents Extension — KSA-6: Bundled Resources — Agents, Steering, Hooks, Templates

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-6 |
| Title | Bundled Resources — Agents, Steering, Hooks, Templates |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-10 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-6.docx |
| Related FSD | FSD-v1-KSA-6.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-10 | SA Agent | Initial TDD from FSD |

---

## 1. Introduction

### 1.1 Purpose

This TDD specifies the technical implementation of the bundled resources system for the Kiro SDLC Agents VS Code extension. It covers the build-time bundling scripts, runtime injection logic, checksum integrity system, and the resource directory structure.

### 1.2 Scope

- Build scripts: `copy-resources.js`, `gen-checksums.js`
- Runtime modules: `config.ts`, `injector.ts`, `checksum.ts`
- Resource directory layout and file conventions
- Sync script: `sync-from-source.ps1`

### 1.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | 5.4+ |
| Runtime | Node.js | 18+ |
| Platform | VS Code Extension API | 1.85+ |
| Build Tool | npm + tsc | — |
| Packaging | vsce | 2.24+ |
| Sync Script | PowerShell | 5.1+ |

### 1.4 Design Principles

- **Zero external runtime dependencies** — extension uses only Node.js built-in modules + VS Code API
- **Immutable bundled resources** — resources in extension package are read-only reference
- **Checksum-based integrity** — SHA-256 hashes detect modifications without storing original content
- **Convention over configuration** — source paths mirror target paths (`.kiro/agents` → `.kiro/agents`)

### 1.5 Constraints

- Extension must work offline (no network calls)
- Build scripts use only Node.js stdlib (fs, path, crypto)
- PowerShell sync script must work on Windows (PowerShell 5.1+)
- VSIX package size must stay under 5 MB

---

## 2. System Architecture

### 2.1 Architecture Overview

![Architecture Diagram](diagrams/architecture.png)

The system has two execution contexts:

**Build-Time (Developer Machine):**
```
MCPOrchestration/ ──[sync-from-source.ps1]──> FEC_CR_Builder/
FEC_CR_Builder/   ──[copy-resources.js]────> kiro-sdlc-agents/resources/
resources/        ──[gen-checksums.js]─────> .sdlc-checksums.json
```

**Runtime (End-User VS Code):**
```
Extension resources/ ──[injector.ts]──> Target Workspace (.kiro/, documents/)
Workspace files      ──[checksum.ts]──> Modification detection
```

### 2.2 Component Diagram

![Component Diagram](diagrams/component.png)

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| extension.ts | Command registration, activation, status bar | VS Code API |
| config.ts | Component definitions (CORE_COMPONENTS, INDEXER_OPTIONS) | TypeScript constants |
| injector.ts | File copy logic, user prompts, safe update | Node.js fs + VS Code API |
| checksum.ts | Hash computation, manifest loading, modification detection | Node.js crypto |
| indexer.ts | Code intelligence indexer execution | Node.js child_process |
| copy-resources.js | Build-time resource bundling | Node.js fs |
| gen-checksums.js | Build-time checksum manifest generation | Node.js crypto |
| sync-from-source.ps1 | Cross-project file synchronization | PowerShell |

### 2.3 Deployment Architecture

The extension is distributed as a `.vsix` file containing:
```
kiro-sdlc-agents-{version}.vsix
├── extension/
│   ├── out/              ← Compiled JS (extension.js, injector.js, etc.)
│   ├── resources/        ← Bundled SDLC resources
│   │   ├── .kiro/agents/
│   │   ├── .kiro/steering/
│   │   ├── .kiro/hooks/
│   │   ├── documents/templates/
│   │   ├── .analysis/code-intelligence/
│   │   └── .sdlc-checksums.json
│   ├── package.json
│   └── node_modules/     ← (empty, no runtime deps)
└── [Content_Types].xml
```

---

## 3. Build Scripts Design

### 3.1 copy-resources.js

**Implements:** UC-1 (Bundle Resources), BR-1, BR-2

**Algorithm:**

```
function main():
    for each mapping in MAPPINGS:
        src = resolve(WORKSPACE_ROOT, mapping.src)
        dst = resolve(RESOURCES_DIR, mapping.dst)
        count = copyRecursive(src, dst)
        log("{mapping.src} → resources/{mapping.dst} ({count} files)")
    log("Copied {total} files into resources/")

function copyRecursive(src, dst):
    if src is file:
        if basename(src) in SKIP_FILES: return 0
        mkdirSync(dirname(dst))
        copyFileSync(src, dst)
        return 1
    if src is directory:
        mkdirSync(dst)
        for entry in readdirSync(src):
            if entry.isDirectory and entry.name in SKIP_DIRS: continue
            if entry.isFile and entry.name in SKIP_FILES: continue
            count += copyRecursive(join(src, entry.name), join(dst, entry.name))
        return count
```

**MAPPINGS Configuration:**

| # | Source | Destination | Type |
|---|--------|-------------|------|
| 1 | .kiro/agents | .kiro/agents | Directory |
| 2 | .kiro/hooks | .kiro/hooks | Directory |
| 3 | .kiro/steering | .kiro/steering | Directory |
| 4 | documents/templates | documents/templates | Directory |
| 5 | .analysis/code-intelligence/index-config.json | .analysis/code-intelligence/index-config.json | File |
| 6 | .analysis/code-intelligence/scripts/python | .analysis/code-intelligence/scripts/python | Directory |
| 7 | .analysis/code-intelligence/scripts/java | .analysis/code-intelligence/scripts/java | Directory |
| 8 | .analysis/code-intelligence/scripts/powershell | .analysis/code-intelligence/scripts/powershell | Directory |
| 9 | .analysis/code-intelligence/scripts/bash | .analysis/code-intelligence/scripts/bash | Directory |
| 10 | .analysis/code-intelligence/scripts/nodejs/src | .analysis/code-intelligence/scripts/nodejs/src | Directory |
| 11 | .analysis/code-intelligence/scripts/nodejs/package.json | .analysis/code-intelligence/scripts/nodejs/package.json | File |
| 12 | .analysis/code-intelligence/scripts/nodejs/tsconfig.json | .analysis/code-intelligence/scripts/nodejs/tsconfig.json | File |

### 3.2 gen-checksums.js

**Implements:** UC-1, BR-3, BR-4

**Algorithm:**

```
function main():
    version = readPackageVersion()
    timestamp = new Date().toISOString()
    files = {}
    
    scanRecursive(RESOURCES_DIR, (filePath) => {
        relativePath = relative(RESOURCES_DIR, filePath)
        hash = sha256(readFileSync(filePath))
        files[relativePath] = { hash, version, injectedAt: timestamp }
    })
    
    manifest = { version, generatedAt: timestamp, files }
    writeFileSync(".sdlc-checksums.json", JSON.stringify(manifest, null, 2))
```

**Output Schema (.sdlc-checksums.json):**

```json
{
  "version": "1.0.3",
  "generatedAt": "2026-05-10T03:09:17.371Z",
  "files": {
    ".kiro/agents/ba-agent.json": {
      "hash": "180a3a21d3a94ffce110df1273b3a8bee8771f77e74fa53a3d3170d4f36d5532",
      "version": "1.0.3",
      "injectedAt": "2026-05-10T03:09:17.371Z"
    }
  }
}
```

### 3.3 sync-from-source.ps1

**Implements:** Resource synchronization from MCPOrchestration

**Algorithm:**

```
for each mapping in MAPPINGS:
    srcDir = join(SOURCE_ROOT, mapping.Src)
    dstDir = join(DEST_ROOT, mapping.Dst)
    
    for each file in Get-ChildItem(srcDir, -Recurse):
        if Should-Skip(relativePath): continue
        if Should-SkipFile(fileName): continue
        
        dstFile = join(dstDir, relativePath)
        if not exists(dstFile):
            copy(file → dstFile)  // NEW
        else:
            if MD5(file) != MD5(dstFile):
                copy(file → dstFile)  // CHANGED
```

**Key Design Decisions:**
- Uses MD5 for sync comparison (speed over security — not integrity-critical)
- Supports `-DryRun` flag for preview
- Reports summary: new/changed/skipped counts

---

## 4. Runtime Module Design

### 4.1 config.ts — Component Definitions

**Implements:** BR-5 through BR-8 (resource counts), BR-9 (path mirroring)

```typescript
interface Component {
    id: string;          // Unique identifier
    label: string;       // QuickPick display name
    description: string; // QuickPick description
    sourcePath: string;  // Path within resources/
    targetPath: string;  // Path in target workspace
    filter?: string[];   // Optional: only copy these items
}

const CORE_COMPONENTS: Component[] = [
    { id: "agents",    sourcePath: ".kiro/agents",       targetPath: ".kiro/agents" },
    { id: "steering",  sourcePath: ".kiro/steering",     targetPath: ".kiro/steering" },
    { id: "hooks",     sourcePath: ".kiro/hooks",        targetPath: ".kiro/hooks" },
    { id: "templates", sourcePath: "documents/templates", targetPath: "documents/templates" }
];
```

### 4.2 injector.ts — Injection Logic

**Implements:** UC-2, UC-3, UC-4 (Inject All, Selective, Safe Update)

**Key Functions:**

| Function | Purpose | Complexity |
|----------|---------|------------|
| `injectAll(root, extPath)` | Copy all CORE_COMPONENTS + indexer | O(n files) |
| `injectSelective(root, extPath)` | User picks components via QuickPick | O(n files) |
| `safeUpdate(root, extPath)` | Detect modifications, prompt user, update | O(n files) |
| `injectComponent(component, root, extPath)` | Copy single component recursively | O(n files in component) |
| `copyDirRecursive(source, target)` | Recursive directory copy with skip rules | O(n) |
| `copyDirRecursiveFiltered(source, target, root, skipPaths)` | Copy excluding user-modified files | O(n) |

**Safe Update Strategy Matrix:**

| Modified Files? | User Choice | Action |
|----------------|-------------|--------|
| None | (auto) | Force update all |
| Some | Skip Modified | Update all except modified |
| Some | Backup & Overwrite | Backup to `.kiro/.sdlc-backup/{timestamp}/`, then overwrite |
| Some | Overwrite All | Force overwrite everything |
| Some | Cancel | No changes |

### 4.3 checksum.ts — Integrity System

**Implements:** UC-4, UC-5, UC-6 (modification detection, status, upgrade check)

**Key Functions:**

| Function | Purpose | Returns |
|----------|---------|---------|
| `computeFileHash(filePath)` | SHA-256 of file content | 64-char hex string |
| `loadBundledManifest(extPath)` | Read .sdlc-checksums.json from extension | ChecksumManifest or null |
| `loadWorkspaceVersion(root)` | Read .kiro/.sdlc-version | VersionInfo or null |
| `saveWorkspaceVersion(root, version)` | Write .kiro/.sdlc-version | void |
| `detectModifiedFiles(root, extPath)` | Compare workspace vs manifest | ModifiedFile[] |
| `isUpgradeAvailable(root, extPath)` | Compare versions | boolean |

**Modification Detection Algorithm:**

```
function detectModifiedFiles(workspaceRoot, extensionPath):
    manifest = loadBundledManifest(extensionPath)
    if not manifest: return []
    
    wsVersion = loadWorkspaceVersion(workspaceRoot)
    checkVersion = wsVersion?.version ?? manifest.version
    
    modified = []
    for (relativePath, entry) in manifest.files:
        if entry.version != checkVersion: continue  // Only check current version
        fullPath = join(workspaceRoot, relativePath)
        if not exists(fullPath): continue  // Missing = not modified, just not injected
        currentHash = sha256(readFile(fullPath))
        if currentHash != entry.hash:
            modified.push({ relativePath, expectedHash: entry.hash, actualHash: currentHash, injectedVersion: entry.version })
    
    return modified
```

### 4.4 extension.ts — Entry Point

**Implements:** Command registration, status bar, upgrade notification

**Activation Flow:**
1. Register 5 commands (injectAll, injectSelective, runIndex, update, status)
2. Create status bar item (right-aligned, shows ✅/⚠️)
3. Check for upgrade (compare workspace version vs bundled manifest version)
4. If upgrade available → show notification

---

## 5. File Structure Design

### 5.1 Extension Package Structure

```
kiro-sdlc-agents/
├── src/
│   ├── extension.ts      ← Entry point (command registration)
│   ├── config.ts         ← Component definitions
│   ├── injector.ts       ← Core injection logic
│   ├── checksum.ts       ← Integrity/modification detection
│   └── indexer.ts        ← Code indexer runner
├── scripts/
│   ├── copy-resources.js ← Build: copy files to resources/
│   └── gen-checksums.js  ← Build: generate manifest
├── resources/            ← Bundled SDLC resources (generated)
│   ├── .sdlc-checksums.json
│   ├── .kiro/agents/     (27 files)
│   ├── .kiro/steering/   (9 files)
│   ├── .kiro/hooks/      (8 files)
│   ├── documents/templates/ (12 files)
│   └── .analysis/code-intelligence/
├── package.json
├── tsconfig.json
└── .vscodeignore
```

### 5.2 Target Workspace Structure (After Injection)

```
workspace/
├── .kiro/
│   ├── .sdlc-version     ← Version tracking
│   ├── agents/
│   │   ├── {agent}.json  ← Agent config (9 agents)
│   │   ├── {agent}.md    ← Agent description (9 agents)
│   │   └── prompts/
│   │       └── {agent}.md ← Detailed prompts (9 agents)
│   ├── steering/
│   │   └── *.md          ← Steering rules (9 files)
│   └── hooks/
│       └── *             ← Hook definitions (8 files)
├── documents/
│   └── templates/
│       └── *-TEMPLATE.md ← Document templates (12 files)
└── .analysis/
    └── code-intelligence/
        └── index-config.json
```

---

## 6. Resource Inventory Validation

### 6.1 Expected Counts (Acceptance Criteria)

| Resource Type | Expected Count | Actual Count | Location |
|---------------|---------------|--------------|----------|
| Agents (.json + .md) | 9 pairs | 9 pairs (18 files) | .kiro/agents/ |
| Agent Prompts | 9 | 9 | .kiro/agents/prompts/ |
| Steering Files | 9 | 9 | .kiro/steering/ |
| Hooks | 8 | 8 | .kiro/hooks/ |
| Templates | 10 (min) | 12 (actual) | documents/templates/ |

### 6.2 Agent Inventory Validation

| # | Agent | .json | .md | prompts/.md | Status |
|---|-------|-------|-----|-------------|--------|
| 1 | ba-agent | ✅ | ✅ | ✅ | Complete |
| 2 | dev-agent | ✅ | ✅ | ✅ | Complete |
| 3 | devops-agent | ✅ | ✅ | ✅ | Complete |
| 4 | qa-agent | ✅ | ✅ | ✅ | Complete |
| 5 | sa-agent | ✅ | ✅ | ✅ | Complete |
| 6 | security-agent | ✅ | ✅ | ✅ | Complete |
| 7 | sm-agent | ✅ | ✅ | ✅ | Complete |
| 8 | ta-agent | ✅ | ✅ | ✅ | Complete |
| 9 | ui-agent | ✅ | ✅ | ✅ | Complete |

### 6.3 Steering Inventory Validation

| # | File | Purpose | Status |
|---|------|---------|--------|
| 1 | agent-self-learning.md | Agent learning rules | ✅ |
| 2 | backend-structure.md | Backend conventions | ✅ |
| 3 | code-intelligence.md | Indexing rules | ✅ |
| 4 | code-standards.md | General code standards | ✅ |
| 5 | drawio.md | Diagram creation rules | ✅ |
| 6 | file-writing.md | File writing conventions | ✅ |
| 7 | frontend-structure.md | Frontend conventions | ✅ |
| 8 | jira-workflow.md | Jira integration rules | ✅ |
| 9 | kotlin-code-standards.md | Kotlin standards | ✅ |

### 6.4 Hook Inventory Validation

| # | File | Type | Status |
|---|------|------|--------|
| 1 | code-index-create.json | JSON hook | ✅ |
| 2 | code-index-delete.json | JSON hook | ✅ |
| 3 | code-index-edit.json | JSON hook | ✅ |
| 4 | code-index-full.json | JSON hook | ✅ |
| 5 | file-watcher.sh | Shell script | ✅ |
| 6 | validate-drawio-edit.kiro.hook | Kiro hook | ✅ |
| 7 | validate-drawio-xml.kiro.hook | Kiro hook | ✅ |
| 8 | validate-drawio.sh | Shell script | ✅ |

### 6.5 Template Inventory Validation

| # | File | SDLC Phase | Status |
|---|------|-----------|--------|
| 1 | BRD-TEMPLATE.md | Requirements | ✅ |
| 2 | FSD-TEMPLATE.md | Specification | ✅ |
| 3 | TDD-TEMPLATE.md | Design | ✅ |
| 4 | STP-TEMPLATE.md | Test Planning | ✅ |
| 5 | STC-TEMPLATE.md | Test Cases | ✅ |
| 6 | DPG-TEMPLATE.md | Deployment | ✅ |
| 7 | RLN-TEMPLATE.md | Release Notes | ✅ |
| 8 | UG-TEMPLATE.md | User Guide | ✅ |
| 9 | TEST-REPORT-TEMPLATE.md | Test Report | ✅ |
| 10 | SECURITY-REPORT-TEMPLATE.md | Security | ✅ |
| 11 | DESIGN-SYSTEM.md | UI Design | ✅ |
| 12 | UI-SPEC-TEMPLATE.md | UI Spec | ✅ |

---

## 7. Security Design

### 7.1 Threat Model

| Threat | Mitigation |
|--------|-----------|
| Malicious file in resources | Checksums verify integrity; resources are text-only |
| User data exfiltration | Extension makes zero network calls |
| Path traversal in injection | All paths resolved relative to workspace root |
| Symlink attacks | `copyFileSync` follows symlinks safely (Node.js default) |

### 7.2 Security Rules

- No `eval()` or dynamic code execution
- No network requests (no `http`, `https`, `fetch` imports)
- No telemetry or analytics
- File operations restricted to workspace root and extension path
- No secrets stored in bundled resources

---

## 8. Performance Design

### 8.1 Performance Targets

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Inject All (cold) | < 3 seconds | Time from command to success message |
| Inject All (warm) | < 1 second | Files already exist, overwrite |
| Checksum generation | < 2 seconds | ~60 files × SHA-256 |
| Modification detection | < 500 ms | Compare ~60 hashes |
| Status check | < 200 ms | Check file existence only |

### 8.2 Optimization Strategies

- **Lazy manifest loading** — only load manifest when needed (update/status)
- **Early termination** — stop scanning if all components found (status check)
- **Synchronous I/O** — simpler code, acceptable for small file counts (<100)
- **No file content caching** — files are small, re-read is fast

---

## 9. Error Handling Design

### 9.1 Error Categories

| Category | Example | Handling |
|----------|---------|----------|
| Missing source | Component source path doesn't exist | Warning message, skip, continue |
| Write failure | Permission denied on target | Error message, skip component |
| Corrupt manifest | Invalid JSON in checksums file | Return null, treat as no manifest |
| Missing workspace | No folder open | Error message, abort command |

### 9.2 Error Recovery

- All injection operations are **idempotent** — re-running produces same result
- Failed partial injection leaves workspace in usable state (some components injected)
- Backup operation creates timestamped directory — never overwrites previous backups

---

## 10. Implementation Checklist

### 10.1 Files to Verify (Already Exist)

| # | File | Status | Notes |
|---|------|--------|-------|
| 1 | src/config.ts | ✅ Exists | CORE_COMPONENTS + INDEXER_OPTIONS defined |
| 2 | src/injector.ts | ✅ Exists | All injection functions implemented |
| 3 | src/checksum.ts | ✅ Exists | Hash + manifest + detection implemented |
| 4 | src/extension.ts | ✅ Exists | Commands registered |
| 5 | src/indexer.ts | ✅ Exists | Indexer runner |
| 6 | scripts/copy-resources.js | ✅ Exists | Build-time copy |
| 7 | scripts/gen-checksums.js | ✅ Exists | Build-time checksums |
| 8 | scripts/sync-from-source.ps1 | ✅ Exists | Cross-project sync |

### 10.2 Resources to Verify (Bundled)

| # | Resource | Expected Count | Verification Command |
|---|----------|---------------|---------------------|
| 1 | Agents | 9 × (.json + .md) + 9 prompts = 27 | `ls resources/.kiro/agents/ | wc -l` |
| 2 | Steering | 9 | `ls resources/.kiro/steering/ | wc -l` |
| 3 | Hooks | 8 | `ls resources/.kiro/hooks/ | wc -l` |
| 4 | Templates | 12 | `ls resources/documents/templates/ | wc -l` |
| 5 | Checksums | 1 manifest | `cat resources/.sdlc-checksums.json | jq '.files | length'` |

### 10.3 Build Verification

```bash
# Full build pipeline
npm run copy-resources   # Copy from workspace to resources/
npm run gen-checksums    # Generate .sdlc-checksums.json
npm run compile          # TypeScript → JavaScript
npm run package          # Create .vsix

# Verify counts
node -e "const m=require('./resources/.sdlc-checksums.json'); console.log(Object.keys(m.files).length, 'files in manifest')"
```

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
| 1 | Should acceptance criteria be updated from 10 to 12 templates? | Open | Source has 12, AC says 10 |
| 2 | Should scrum-master-agent count as separate from sm-agent? | Resolved | sm-agent IS scrum-master-agent (short name) |
