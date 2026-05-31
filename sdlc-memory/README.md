# SDLC Memory Engine

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/Kotlin-1.9-purple?style=for-the-badge" alt="Kotlin">
  <img src="https://img.shields.io/badge/transport-stdio+HTTP-green?style=for-the-badge" alt="Transport">
  <img src="https://img.shields.io/badge/search-Hybrid_RRF-orange?style=for-the-badge" alt="Search">
</p>

Persistent Multi-Agent Memory System with Knowledge Graph. Provides hybrid search (BM25 + Vector + Graph), ONNX embeddings, and tier-based memory consolidation for AI agent pipelines.

---

## Architecture

```
+-----------------------------------------------------+
|  SDLC Memory Engine                                  |
|                                                      |
|  +------------------+  +-------------------------+  |
|  | MCP Transport    |  | HTTP Transport          |  |
|  | (stdio JSON-RPC) |  | (Ktor/Netty, port 3200) |  |
|  +--------+---------+  +------------+------------+  |
|           |                         |                |
|  +--------v-------------------------v------------+  |
|  |              Tool Dispatcher                   |  |
|  +--------+----------+----------+----------------+  |
|           |          |          |                    |
|  +--------v--+ +-----v----+ +--v-----------------+  |
|  | SQLite    | | ONNX     | | JGraphT            |  |
|  | FTS5      | | Embeddings| | Knowledge Graph   |  |
|  | sqlite-vec| | MiniLM   | | (in-memory + SQL)  |  |
|  +-----------+ +----------+ +--------------------+  |
|                                                      |
|  Search: Hybrid RRF (BM25 + Vector + Graph)          |
|  Tiers: Working -> Short-term -> Long-term -> Archive|
+-----------------------------------------------------+
```

---

## Quick Start

```bash
# Build
./gradlew shadowJar

# Run
java -jar build/libs/sdlc-memory-0.1.0.jar --workspace . --viewer-port 3200
```

---

## Key Features

- **Dual Transport** - stdio (MCP JSON-RPC) + HTTP (Ktor/Netty web viewer)
- **SQLite + FTS5 + sqlite-vec** - Full-text search + vector similarity in one DB
- **ONNX Runtime Embeddings** - all-MiniLM-L6-v2 (90MB, English) or multilingual (470MB)
- **JGraphT Knowledge Graph** - In-memory graph with SQLite persistence
- **Hybrid RRF Search** - Reciprocal Rank Fusion combining BM25, vector, and graph signals
- **Tier-based Consolidation** - Working -> Short-term -> Long-term -> Archive
- **Agent Handoff** - Transfer context between agents seamlessly

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `memory_ingest` | Store document/observation into memory |
| `memory_observe` | Record agent observation/decision |
| `memory_recall` | Hybrid search across memory tiers |
| `memory_decide` | Record and retrieve decisions |
| `memory_error` | Record error patterns |
| `memory_handoff` | Transfer context between agents |
| `memory_consolidate` | Trigger tier consolidation |
| `memory_stats` | Get memory statistics |
| `memory_graph` | Query knowledge graph |

---

## Web Viewer

The HTTP server (port 3200) provides a web dashboard for browsing the knowledge graph, viewing memory stats, and searching entries visually.

```
http://localhost:3200/          <- Graph visualization
http://localhost:3200/dashboard <- Health metrics
http://localhost:3200/tags      <- Tag browser
```

---

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `--workspace` | Workspace path | Current directory |
| `--viewer-port` | HTTP viewer port | `3200` |

---

## License

MIT
