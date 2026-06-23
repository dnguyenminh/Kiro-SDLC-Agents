# SA Agent Context — KSA-120 TDD Creation

## Task
Tạo Technical Design Document (TDD) cho KSA-120: Bundle MCP NodeJS Server + Native VS Code Webview KB Panels.

## Template
Dùng template: documents/templates/TDD-TEMPLATE.md

## Output
- documents/KSA-120/TDD.md
- Diagrams tại documents/KSA-120/diagrams/ (draw.io + PNG export)

## Required Diagrams (MANDATORY)
1. architecture.drawio + .png — Overall extension architecture
2. component.drawio + .png — Internal component diagram
3. deployment.drawio + .png — Extension packaging and deployment
4. class-diagram.drawio + .png — Key classes/interfaces
5. api-sequence-panel-open.drawio + .png — Sequence: user opens KB panel
6. api-sequence-server-crash.drawio + .png — Sequence: server crash recovery

## Key Technical Context

### Current Source Code
kiro-sdlc-agents/src/ has: extension.ts, injector.ts, mcp-injector.ts, checksum.ts, config.ts, file-utils.ts, indexer.ts, model-downloader.ts

### MCP Server Structure
mcp-code-intelligence-nodejs/src/ has: index.ts, config.ts, db/, memory/, tools/, orchestration/, http/, indexer/, scanner/, query/, ollama/

### Shared Viewer Assets
shared/viewer/ has: graph.js, dashboard.js, tags.js, quality.js, analytics.js, ui-tokens.css, ux-components.css, modules/

### Communication: JSON-RPC 2.0 over stdio, postMessage for webview
### Platforms: win-x64, mac-arm64, linux-x64
### Package size target: less than 50MB
### VS Code API: 1.85.0+
