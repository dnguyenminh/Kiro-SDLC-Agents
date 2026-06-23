# Deployment Guide (DPG)

## KSA-239 — Multi-format Document Indexing

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-239 |
| Feature | Multi-format document indexing — support docx/xlsx/pdf/image |
| Version | 1.17.0 |
| Date | 2025-07-14 |
| Status | Ready |
| Related TDD | TDD-v1-KSA-239.docx |

---

## 1. Overview

This deployment adds multi-format document conversion to the "Index Documents" command in the Kiro SDLC Agents VS Code extension. Files in formats .docx, .xlsx, .pdf, .png, .jpg (and other supported formats) are now automatically converted to markdown before ingestion into the Knowledge Base.

## 2. Prerequisites

| Requirement | Details |
|-------------|---------|
| VS Code | >= 1.85.0 |
| Node.js | >= 18 (bundled with VS Code) |
| MCP Server | Running on configured port (default 9381) |
| Previous version | 1.16.0 installed |

## 3. Deployment Steps

### 3.1 Build VSIX

```bash
cd kiro-sdlc-agents
npm run vscode:prepublish
npx vsce package --no-dependencies
```

Output: `kiro-sdlc-agents-1.17.0.vsix`

### 3.2 Install Extension

```bash
code --install-extension kiro-sdlc-agents-1.17.0.vsix --force
```

Or via VS Code: Extensions panel → "..." menu → "Install from VSIX..."

### 3.3 Verify Installation

1. Reload VS Code window (Ctrl+Shift+P → "Reload Window")
2. Open Output panel → "Kiro SDLC Agents"
3. Verify extension activates without errors
4. Run "Kiro SDLC: Index Workspace" command
5. Verify "Index all SDLC documents" label appears in Quick Pick

### 3.4 Verify Multi-format Indexing

1. Place a .docx file in `documents/{TICKET}/` folder
2. Run "Kiro SDLC: Index Workspace" → select "Index Documents"
3. Verify Output panel shows conversion progress
4. Verify converted file is ingested (check KB via dashboard)

## 4. Rollback Plan

### 4.1 Quick Rollback

```bash
code --install-extension kiro-sdlc-agents-1.16.0.vsix --force
```

### 4.2 If VSIX Not Available

```bash
git checkout v1.16.0 -- .
npm run vscode:prepublish
npx vsce package --no-dependencies
code --install-extension kiro-sdlc-agents-1.16.0.vsix --force
```

### 4.3 Rollback Verification

- Run "Index Workspace" → Documents option should NOT convert non-markdown files
- Only .md files should be indexed (pre-KSA-239 behavior)

## 5. Configuration

No new configuration required. The feature uses existing MCP server port configuration.

| Config | Default | Notes |
|--------|---------|-------|
| kiroSdlc.mcpServerPort | 9181 | Ingestion endpoint port |
| filetomarkdown timeout | 30s | Per-file conversion timeout (hardcoded) |
| PDF size limit | 50MB | Files above this are skipped |
| Image size limit | 20MB | Images above this are skipped |

## 6. Post-Deployment Verification

| Check | Expected | Command |
|-------|----------|---------|
| Extension loads | No errors in Output | Reload window |
| Index command works | Quick pick shows 3 options | Cmd: Index Workspace |
| .md indexing (regression) | Still works | Index a .md file |
| .docx conversion | Converted + ingested | Place docx, run index |
| .txt wrapping | Wrapped in code block | Place txt, run index |
| Error isolation | Bad file skipped, others continue | Place corrupt + valid |

## 7. Known Limitations

- `filetomarkdown` package must be bundled in VSIX (esbuild handles this)
- OCR for images depends on filetomarkdown capabilities (may return empty for non-text images)
- Large batches (>50 files) may take up to 2 minutes
- No progress cancellation (runs to completion once started)
