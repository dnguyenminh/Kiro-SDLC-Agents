# Kiro SDLC Agents — VS Code Extension

Inject a complete multi-agent SDLC pipeline into any workspace with one command.

## Features

| Command | Description |
|---------|-------------|
| `Kiro SDLC: Inject All Agents` | Copy all agents, steering, hooks, templates, indexer |
| `Kiro SDLC: Inject (Select Components)` | Pick which components to inject |
| `Kiro SDLC: Run Code Indexer` | Auto-detect runtime and index source code |
| `Kiro SDLC: Update Agents` | Update to latest version (overwrites) |
| `Kiro SDLC: Show Status` | Check which components are present |

## What Gets Injected

```
your-workspace/
├── .kiro/
│   ├── agents/       ← 9 agents (SM, BA, TA, SA, QA, DEV, DevOps, UI, Security)
│   ├── steering/     ← Code standards, self-learning, drawio, jira-workflow
│   └── hooks/        ← Code indexing triggers, drawio validation
├── .analysis/
│   └── code-intelligence/
│       └── scripts/  ← Indexer in Python, Java, PowerShell, Bash, Node.js
└── documents/
    └── templates/    ← BRD, FSD, TDD, STP, STC, DPG, RLN, UG templates
```

## Usage

1. Open any workspace in VS Code / Kiro
2. `Ctrl+Shift+P` → "Kiro SDLC: Inject All Agents"
3. Done! Your workspace now has the full SDLC pipeline

## Auto-Indexing

After injection, the extension automatically detects your runtime (Python > Java > Node.js > PowerShell > Bash) and runs the code indexer to generate `.analysis/code-intelligence/project-structure.md`.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `kiroSdlc.autoIndex` | `true` | Run indexer after injection |
| `kiroSdlc.preferredIndexer` | `auto` | Force specific indexer (python/java/nodejs/powershell/bash) |

## Development

```bash
cd kiro-sdlc-agents
npm install
npm run compile
# Press F5 to launch Extension Development Host
```

## Packaging

```bash
npm run package
# Creates kiro-sdlc-agents-1.0.0.vsix
```
