# Code Intelligence Backend

Standalone MCP HTTP server providing code intelligence, memory/KB management, orchestration, analytics, and admin portal services.

## Architecture

```
backend/
├── src/
│   ├── index.ts                  # Entry point — init modules, start server
│   ├── config/BackendConfig.ts   # Env-based configuration (zod validated)
│   ├── server/
│   │   ├── HttpServer.ts         # Hono HTTP server setup
│   │   ├── routes/               # health, tools, api endpoints
│   │   └── middleware/           # localhost-only, request-logger, error-handler
│   ├── modules/
│   │   ├── ModuleRegistry.ts     # Module lifecycle manager
│   │   ├── memory/               # SQLite + ONNX embeddings, mem_* tools
│   │   ├── code-intel/           # AST indexing, search, symbols
│   │   ├── orchestration/        # Child MCP server management
│   │   ├── analytics/            # Quality scoring, metrics
│   │   ├── kb-graph/             # Knowledge graph operations
│   │   └── utility/              # Misc utility tools
│   ├── tools/
│   │   ├── ToolRouter.ts         # Route tool calls to modules
│   │   ├── ToolDefinitions.ts    # All 52 tool schemas
│   │   └── ToolValidator.ts      # Zod-based argument validation
│   ├── admin/                    # Admin portal types
│   └── types/                    # Shared type definitions
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Quick Start

```bash
# Install dependencies
npm ci

# Development (auto-reload)
npm run dev

# Production
npm run build
npm start
```

## Configuration

Environment variables (all optional, sensible defaults):

| Variable | Default | Description |
|----------|---------|-------------|
| `CODE_INTEL_PORT` | 48721 | HTTP server port |
| `CODE_INTEL_HOST` | 127.0.0.1 | Bind address (localhost only) |
| `CODE_INTEL_DATA_DIR` | .code-intel | Data directory for DB, models |
| `CODE_INTEL_ONNX_MODEL` | models/model.onnx | ONNX embedding model path |
| `CODE_INTEL_DB` | index.db | SQLite database file |
| `CODE_INTEL_ORCHESTRATION` | orchestration.json | Child MCP servers config |
| `CODE_INTEL_LOG_LEVEL` | info | Log level (debug/info/warn/error) |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health + module status |
| `/mcp/tools/list` | GET | List all 52 registered tools |
| `/mcp/tools/call` | POST | Execute an MCP tool |
| `/api/*` | GET | Webview panel data (dashboard, graph, etc.) |

## Modules

| Module | Tools | Description |
|--------|-------|-------------|
| Memory | 17 | mem_search, mem_ingest, mem_graph, mem_consolidate, etc. |
| Code Intel | 15 | code_search, code_symbols, code_callers, code_dependencies, etc. |
| Orchestration | 6 | find_tools, execute_dynamic_tool, orchestration_status, etc. |
| Analytics | 5 | complexity_analysis, find_hot_paths, find_duplicates, etc. |
| KB Graph | 5 | mem_map, mem_discover, git_search, git_index, etc. |
| Utility | 4 | stream_write_file, drawio_auto_layout, drawio_export_png, agent_log |

## Tech Stack

- **Runtime:** Node.js >= 18
- **HTTP:** Hono (14KB, TypeScript-first)
- **Database:** better-sqlite3 (WAL mode)
- **ML:** onnxruntime-node (paraphrase-multilingual-MiniLM-L12-v2 embeddings)
- **Validation:** Zod
- **Logging:** Pino (structured JSON)
- **Testing:** Vitest

## Security

- Binds to `127.0.0.1` only (no network exposure)
- Localhost-only middleware rejects non-local requests
- No authentication required (local tool, same machine)
- Process isolation from IDE (separate PID/memory)

## Testing

```bash
npm test          # Run all tests once
npm run test:watch  # Watch mode
```

## Related

- **Extension** (`../extension/`): VS Code thin proxy that connects to this server
- **Admin Portal** (`../src/admin/`): Web admin UI served on port 48722
- **Orchestration** (`.code-intel/orchestration.json`): Child MCP server inventory
