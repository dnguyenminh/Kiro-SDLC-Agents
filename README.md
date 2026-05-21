# FEC CR Builder — Multi-Agent SDLC Platform

Nền tảng phát triển phần mềm đa agent, tích hợp Jira, Code Intelligence MCP, và Kiro IDE. Pipeline tự động: BA → SA → DEV → QA → DevOps.

## Architecture

```
FEC_CR_Builder/
├── kiro-sdlc-agents/              ← VS Code/Kiro Extension (inject agents + MCP config)
├── mcp-code-intelligence-kotlin/  ← MCP Server — Kotlin/JVM (enterprise)
├── mcp-code-intelligence-nodejs/  ← MCP Server — Node.js (full-featured)
├── mcp-code-intelligence-python/  ← MCP Server — Python (lightweight)
├── sdlc-memory/                   ← Shared memory/knowledge base layer
├── shared/                        ← Shared utilities across modules
├── scripts/                       ← Build & automation scripts
├── documents/                     ← Project documents (BRD, FSD, TDD per ticket)
└── .kiro/                         ← Agents, steering, hooks, settings
```

## Quick Start

### 1. Install Extension

```bash
cd kiro-sdlc-agents
npm install && npm run package
# Install .vsix in Kiro/VS Code
```

### 2. Inject Agents

Open any workspace → `Ctrl+Shift+P` → "Kiro SDLC: Inject All Agents"

### 3. Start Working

Provide a Jira ticket key (e.g., `KSA-14`) → Scrum Master agent orchestrates the pipeline.

### 4. Download Embedding Model (Optional)

`Ctrl+Shift+P` → **"Kiro SDLC: Download Embedding Model"**

Downloads directly from HuggingFace — no MCP server required. Choose from:
- `all-MiniLM-L6-v2` (90MB, English, default — auto-downloaded on first server start)
- `paraphrase-multilingual-MiniLM-L12-v2` (470MB, 50+ languages including Vietnamese)

Models stored at `~/.code-intel/models/`. MCP server auto-detects active model from shared `registry.json`.

## Modules

| Module | Description | Tech |
|--------|-------------|------|
| `kiro-sdlc-agents` | VS Code extension — injects agents, steering, hooks | TypeScript |
| `mcp-code-intelligence-kotlin` | MCP server — FTS5, coroutines, NIO watcher | Kotlin, JDK 21+ |
| `mcp-code-intelligence-nodejs` | MCP server — FTS5, ONNX embeddings | Node.js 20+ |
| `mcp-code-intelligence-python` | MCP server — FTS5, lightweight | Python 3.11+ |
| `sdlc-memory` | Knowledge base, memory tiers, graph | Shared |

## Indexing Guide

Hệ thống hỗ trợ 2 loại indexing:

### Index Workspace Command

Cách nhanh nhất: `Ctrl+Shift+P` → **"Kiro SDLC: Index Workspace (Code + Documents)"**

Chọn những gì cần index:
- Index Source Code — re-index symbols (FTS5)
- Index Documents — discover + ingest BRD/FSD/TDD
- Sync Code → Memory — link code entities vào knowledge graph

> Sau "Inject All" hoặc "Inject (Select Components)", extension tự hỏi bạn có muốn index không.

### Deduplication (Tự động skip file không đổi)

Server tự track mỗi file đã index bằng **filename + mtime + MD5 checksum**:
- File chưa thay đổi → **auto-skip** (không tốn thời gian)
- Chỉ file thực sự modified mới được re-index
- An toàn để chạy lại bất kỳ lúc nào — không duplicate data

### Code Indexing (Tự động)

MCP server tự động index source code khi khởi động. Kiểm tra:

```
Tool: code_index_status
```

Re-index: `code_index_status` với `{ "reindex": true }`

Sync vào memory graph: `mem_sync_code` với `{}`

### Document Indexing

Index tài liệu vào Knowledge Base để agents có thể tìm kiếm:

```
Tool: mem_ingest_file
Arguments: {
  "file_path": "documents/KSA-14/BRD.md",
  "type": "REQUIREMENT"
}
```

| Document Type | `type` Parameter |
|---------------|-----------------|
| BRD, FSD | `REQUIREMENT` |
| TDD | `ARCHITECTURE` |
| STP, STC, DPG, RLN | `PROCEDURE` |
| Decisions | `DECISION` |

### Search Knowledge Base

```
Tool: mem_search
Arguments: { "query": "your search term", "detail": true }
```

> Chi tiết đầy đủ: xem steering file `indexing-guide.md` (activate bằng `#indexing-guide` trong chat)

## Development

### Build MCP Server (Kotlin)

```bash
cd mcp-code-intelligence-kotlin
./gradlew shadowJar
# Output: build/libs/mcp-code-intelligence-*.jar
```

### Build Extension

```bash
cd kiro-sdlc-agents
npm install
npm run compile
# F5 to launch Extension Development Host
```

### Run Tests

```bash
# Kotlin server
cd mcp-code-intelligence-kotlin && ./gradlew test

# Node.js bridge
cd mcp-code-intelligence-nodejs && npm test
```

## Release

See [Release & Versioning Rules](.kiro/steering/release-versioning.md) for full process.

```bash
# Bump versions → commit → tag → push
git tag v1.2.0 -m "Release v1.2.0"
git push origin master --tags
```

## CI/CD

- `.github/workflows/ci.yml` — Build + test on PR
- `.github/workflows/publish.yml` — Publish on tag push (npm, PyPI, GitHub Release)

## License

Private — Internal use only.
