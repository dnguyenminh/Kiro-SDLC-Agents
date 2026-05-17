# SDLC Memory Engine

Persistent Multi-Agent Memory System with Knowledge Graph.

## Quick Start

```bash
# Build
./gradlew shadowJar

# Run
java -jar build/libs/sdlc-memory-0.1.0.jar --workspace . --viewer-port 3200
```

## Architecture

- **Transport**: Dual — stdio (MCP JSON-RPC) + HTTP (Ktor/Netty)
- **Storage**: SQLite + FTS5 + sqlite-vec
- **Embeddings**: ONNX Runtime (all-MiniLM-L6-v2)
- **Graph**: JGraphT in-memory with SQLite persistence
- **Search**: Hybrid RRF (BM25 + Vector + Graph)

## MCP Tools

| Tool | Description |
|------|-------------|
| memory_ingest | Store document/observation into memory |
| memory_observe | Record agent observation/decision |
| memory_recall | Hybrid search across memory tiers |
| memory_decide | Record and retrieve decisions |
| memory_error | Record error patterns |
| memory_handoff | Transfer context between agents |
| memory_consolidate | Trigger tier consolidation |
| memory_stats | Get memory statistics |
| memory_graph | Query knowledge graph |
