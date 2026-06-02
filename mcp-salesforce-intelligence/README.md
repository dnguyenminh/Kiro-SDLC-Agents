# mcp-salesforce-intelligence

<p align="center">
  <img src="https://img.shields.io/badge/version-2.1.0-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/Node.js-20+-green?style=for-the-badge" alt="Node.js">
  <img src="https://img.shields.io/badge/Salesforce-SFDX-00A1E0?style=for-the-badge" alt="Salesforce">
  <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License">
</p>

Shared Salesforce Intelligence library — SFDX project detection, Apex/Flow/Object/LWC parsers, SF type definitions, and grammar utilities. Consumed by `mcp-code-intelligence-nodejs` and `kiro-sdlc-agents`.

---

## Architecture

This is a **shared library** (not a standalone server). It provides reusable Salesforce-specific logic that integrates into the existing Code Intelligence pipeline:

```
mcp-salesforce-intelligence/
├── src/
│   ├── index.ts              ← Public API exports
│   ├── types/                ← SF type definitions (SfMetadataType, SfRelationship, etc.)
│   ├── detection/            ← SFDX project detection (sfdx-project.json)
│   ├── parsers/              ← Metadata parsers
│   │   ├── apex-parser.ts    ← Apex class/trigger parsing (Tree-sitter AST)
│   │   ├── flow-parser.ts   ← Flow XML parsing
│   │   ├── object-parser.ts ← Custom Object XML parsing
│   │   └── lwc-parser.ts    ← LWC component parsing
│   ├── graph/                ← SF relationship types for code_dependencies/code_impact
│   └── grammar/              ← Apex Tree-sitter grammar utilities
├── tests/                    ← 44 vitest test cases
└── package.json
```

## How It's Used

```
┌─────────────────────────────────────────────────┐
│  mcp-code-intelligence-nodejs                    │
│                                                  │
│  Indexer ──► SF Detection ──► SF Parsers        │
│     │              │               │             │
│     ▼              ▼               ▼             │
│  code_index_status  SFDX stats    Symbols       │
│  code_search        ──────────────► FTS5 DB     │
│  code_impact        SF graph ────► Graph DB     │
│                                                  │
│  ┌──────────────────────────────────────┐       │
│  │  mcp-salesforce-intelligence (this)   │       │
│  │  Types + Detection + Parsers + Graph  │       │
│  └──────────────────────────────────────┘       │
└─────────────────────────────────────────────────┘
```

## Quick Start

```bash
npm install
npm run build
npm test        # 44 tests (vitest)
```

## Features

### SFDX Project Detection
- Auto-detects `sfdx-project.json` in workspace
- Resolves package directories and namespace
- Reports SFDX project metadata to indexer

### Metadata Parsers

| Parser | Input | Output |
|--------|-------|--------|
| `apex-parser` | `*.cls`, `*.trigger` | Classes, methods, properties, annotations, trigger events |
| `flow-parser` | `*.flow-meta.xml` | Flow name, type, variables, decisions, actions, subflows |
| `object-parser` | `*.object-meta.xml` | Fields, record types, validation rules, relationships |
| `lwc-parser` | `*.js` + `*.html` | Component name, `@api` properties, `@wire` methods |

### SF Type Definitions
- `SfMetadataType` — Enum of all supported SF metadata types
- `SfRelationship` — Relationship types (trigger→object, flow→apex, lwc→apex)
- `SfSymbol` — Parsed symbol with SF-specific metadata
- `SfProject` — SFDX project structure

### Graph Integration
- Provides SF relationship kinds for the code graph
- Trigger→Object, Flow→Apex, LWC→Apex edges
- Used by `code_dependencies` and `code_impact` tools

## Usage (as library)

```typescript
import {
  detectSfdxProject,
  parseApexClass,
  parseFlow,
  parseCustomObject,
  parseLwcComponent,
  SfMetadataType,
  SfRelationship
} from 'mcp-salesforce-intelligence';

// Detect SFDX project
const project = await detectSfdxProject('/path/to/workspace');

// Parse Apex
const symbols = await parseApexClass(apexSource, 'MyClass.cls');

// Parse Flow
const flowSymbols = parseFlow(flowXml, 'MyFlow.flow-meta.xml');
```

## Consumers

| Package | How it uses this library |
|---------|------------------------|
| `mcp-code-intelligence-nodejs` | Parsers + graph + SFDX detection during indexing |
| `kiro-sdlc-agents` | "Index Salesforce Project" command triggers SF-specific indexing |

## Tests

```bash
npm test          # Run all 44 tests
npm run test:watch  # Watch mode
```

Test coverage includes:
- Apex class/trigger parsing (various patterns)
- Flow XML parsing (all flow types)
- Object XML parsing (fields, validation rules)
- LWC component parsing (decorators, templates)
- SFDX project detection (valid/invalid structures)
- SF relationship graph building

---

## License

MIT
