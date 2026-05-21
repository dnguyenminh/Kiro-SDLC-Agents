# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-104: Download Embedding Model

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-104 |
| Title | Download Embedding Model — Technical Design |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-21 |
| Status | Final (Retroactive) |
| Related BRD | BRD-v1-KSA-104.docx |
| Related FSD | FSD-v1-KSA-104.docx |
| Related Ticket | KSA-102 (Adaptive Token Cache + Model Manager) |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-21 | SA Agent | Created retroactively from implemented code |

---

## 1. Introduction

### 1.1 Purpose

This TDD specifies the technical implementation of the Download Embedding Model feature across the VS Code extension and three MCP server modules (Python, Node.js, Kotlin). It documents the architecture, module design, API routing, and integration patterns as implemented.

### 1.2 Scope

- VS Code extension: Command registration + QuickPick UI + HTTP client
- Kotlin MCP server: `ModelApiRoutes.kt` (Ktor routing)
- Python MCP server: `model_routes.py` (BaseHTTPRequestHandler routing)
- Node.js MCP server: `model-routes.ts` (http module routing)
- Shared: `ModelManager`, `ModelRegistry`, `ModelCatalog` (per module)

### 1.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Extension | TypeScript + VS Code API | 1.85+ |
| Kotlin Server | Ktor + kotlinx.serialization | 2.3+ |
| Python Server | http.server (stdlib) | 3.11+ |
| Node.js Server | http (stdlib) | 20+ |
| Model Format | ONNX | 1.16+ |
| Model Source | HuggingFace Hub | — |
| Storage | JSON (registry.json) | — |

### 1.4 Design Principles

- **Implementation parity**: All 3 MCP modules expose identical API contracts
- **Non-blocking downloads**: Background threads/async prevent server blocking
- **Single source of truth**: `ModelCatalog` defines available models; `ModelRegistry` tracks state
- **Graceful degradation**: If ModelManager not initialized → 503 response (not crash)
- **Zero external deps for routing**: Each module uses its native HTTP framework

### 1.5 Constraints

- Max 200 lines per file (workspace code standard)
- Max 20 lines per function
- CORS headers required (extension runs on different origin)
- Model files stored globally (`~/.code-intel/models/`) — shared across workspaces
- No authentication on model API (localhost only)

---

## 2. System Architecture

### 2.1 Architecture Overview

![Architecture](diagrams/architecture.png)

```
┌─────────────────────────────────────────────────────────────────┐
│ VS Code Extension (kiro-sdlc-agents)                            │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ model-downloader.ts                                         │ │
│ │  ├── handleDownloadModel()  ← Command handler               │ │
│ │  ├── fetchModelList()       ← GET /api/models/list          │ │
│ │  ├── showModelPicker()      ← QuickPick UI                  │ │
│ │  ├── downloadModel()        ← POST /api/models/download     │ │
│ │  ├── switchModel()          ← POST /api/models/switch       │ │
│ │  └── resolveViewerPort()    ← Read mcp.json config          │ │
│ └─────────────────────────────────────────────────────────────┘ │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTP (localhost:{port})
┌───────────────────────────────▼─────────────────────────────────┐
│ MCP Server (Kotlin / Python / Node.js)                          │
│ ┌───────────────────┐  ┌──────────────────────────────────────┐ │
│ │ HTTP Router        │  │ orchestration/models/                │ │
│ │ ModelApiRoutes     │──│  ├── ModelManager     (execute)      │ │
│ │ /api/models/*      │  │  ├── ModelRegistry    (state)        │ │
│ └───────────────────┘  │  └── ModelCatalog     (metadata)     │ │
│                         └──────────────┬───────────────────────┘ │
└────────────────────────────────────────┼────────────────────────┘
                                         │ HTTPS (background)
                                         ▼
                              ┌──────────────────────┐
                              │ HuggingFace Hub      │
                              │ model.onnx, vocab.txt│
                              └──────────────────────┘
```

### 2.2 Component Diagram

![Component](diagrams/component.png)

**Components:**

| Component | Module | Responsibility |
|-----------|--------|---------------|
| `model-downloader.ts` | Extension | UI command, HTTP client, QuickPick |
| `ModelApiRoutes.kt` | Kotlin | HTTP route handlers for `/api/models/*` |
| `model_routes.py` | Python | HTTP route handlers for `/api/models/*` |
| `model-routes.ts` | Node.js | HTTP route handlers for `/api/models/*` |
| `ModelManager` | All 3 | Business logic: list, download, status, switch |
| `ModelRegistry` | All 3 | Persistence: registry.json read/write |
| `ModelCatalog` | All 3 | Static model metadata (name, URL, files) |

---

## 3. Module Design

### 3.1 Extension Module: `model-downloader.ts`

**Location:** `kiro-sdlc-agents/src/model-downloader.ts`

**Exported function:**
```typescript
export async function handleDownloadModel(): Promise<void>
```

**Internal functions:**

| Function | Lines | Purpose |
|----------|-------|---------|
| `handleDownloadModel()` | 12 | Entry point: resolve port → fetch list → show picker → act |
| `fetchModelList(port)` | 8 | GET /api/models/list, parse JSON |
| `showModelPicker(models)` | 20 | Build QuickPick items with status icons |
| `downloadModel(port, name)` | 18 | POST /api/models/download with progress notification |
| `switchModel(port, name)` | 12 | POST /api/models/switch |
| `resolveViewerPort(root)` | 14 | Read mcp.json → extract CODE_INTEL_VIEWER_PORT |
| `getWorkspaceRoot()` | 6 | Get first workspace folder path |
| `httpGet(url)` | 8 | Node.js http.get wrapper |
| `httpPost(url, body)` | 16 | Node.js http.request POST wrapper |

**Port Resolution Logic:**
```
1. Read {workspace}/.kiro/settings/mcp.json
2. Iterate mcpServers → find env.CODE_INTEL_VIEWER_PORT
3. If found → parseInt(value)
4. Fallback → 3200
```

---

### 3.2 Kotlin Module: `ModelApiRoutes.kt`

**Location:** `mcp-code-intelligence-kotlin/src/main/kotlin/com/codeintel/http/ModelApiRoutes.kt`

**Route registration:**
```kotlin
fun Route.modelApiRoutes(modelManagerProvider: () -> ModelManager?)
```

**Design decisions:**
- Uses `modelManagerProvider` lambda (not direct injection) — allows lazy initialization
- Returns 503 if ModelManager is null (server starting up, model not ready)
- Parses POST body as raw JSON, merges with `action` field before passing to ModelManager
- Response HTTP code derived from `success` field in ModelManager result

**Route mapping:**

| Method | Path | Handler Logic |
|--------|------|---------------|
| GET | `/api/models/list` | `mgr.execute({action: "list"})` → 200 |
| GET | `/api/models/status` | `mgr.execute({action: "status"})` → 200 |
| POST | `/api/models/download` | Parse body + `action: "download"` → 200/400 |
| POST | `/api/models/switch` | Parse body + `action: "switch"` → 200/400 |

---

### 3.3 Python Module: `model_routes.py`

**Location:** `mcp-code-intelligence-python/src/mcp_code_intel/http/model_routes.py`

**Entry function:**
```python
def handle_model_route(path, query, handler, model_manager, method="GET") -> bool
```

**Design decisions:**
- Returns `bool` — `True` if route was handled, `False` to pass to next handler
- Uses `BaseHTTPRequestHandler` directly (no framework)
- CORS header `Access-Control-Allow-Origin: *` on all responses
- Reads POST body via `Content-Length` header

---

### 3.4 Node.js Module: `model-routes.ts`

**Location:** `mcp-code-intelligence-nodejs/src/http/model-routes.ts`

**Entry function:**
```typescript
export function handleModelRoute(req, url, res, modelManager): boolean
```

**Design decisions:**
- Same bool-return pattern as Python (route handled or not)
- POST body read via stream events (async)
- Uses native `http` module (no Express/Koa)
- CORS header on all responses

---

### 3.5 ModelManager (Kotlin reference implementation)

**Location:** `mcp-code-intelligence-kotlin/src/main/kotlin/com/codeintel/orchestration/models/ModelManager.kt`

**Class design:**
```kotlin
class ModelManager(modelsDir: String? = null) {
    private val dir: String           // ~/.code-intel/models
    private val registry: ModelRegistry
    private val downloading: MutableSet<String>  // concurrent download guard
    
    fun execute(args: JsonObject): String  // Main dispatch
    fun getActiveModel(): String
    fun getActiveModelPath(): String
    fun autoDownloadIfNeeded()             // Called on server startup
}
```

**Action dispatch:**

| Action | Method | Behavior |
|--------|--------|----------|
| `list` | `handleList()` | Iterate MODELS catalog, enrich with download/active status |
| `download` | `handleDownload()` | Validate model exists → spawn background thread |
| `status` | `handleStatus()` | Return active model name, path, dimensions |
| `switch` | `handleSwitch()` | Validate downloaded → update registry |

**Concurrency control:**
```kotlin
private val downloading = mutableSetOf<String>()

// In backgroundDownload():
synchronized(downloading) {
    if (modelName in downloading) return  // Already downloading
    downloading.add(modelName)
}
// ... download ...
finally {
    synchronized(downloading) { downloading.remove(modelName) }
}
```

---

### 3.6 ModelRegistry

**Location:** `mcp-code-intelligence-kotlin/src/main/kotlin/com/codeintel/orchestration/models/ModelRegistry.kt`

**Persistence file:** `~/.code-intel/models/registry.json`

**Operations:**

| Method | Purpose |
|--------|---------|
| `activeModel` | Property — read from registry or default |
| `isDownloaded(name)` | Check if model entry exists in registry |
| `modelPath(name)` | Return `{modelsDir}/{modelName}` |
| `markDownloaded(name, size)` | Add entry with path, timestamp, size |
| `setActive(name)` | Update `active_model` field |

**Data format:**
```json
{
  "active_model": "all-MiniLM-L6-v2",
  "last_updated": "2026-05-21T10:00:00Z"
}
```

---

### 3.7 ModelCatalog

**Location:** `mcp-code-intelligence-kotlin/src/main/kotlin/com/codeintel/orchestration/models/ModelCatalog.kt`

**Static data:**
```kotlin
data class ModelInfo(
    val displayName: String,
    val sizeMb: Int,
    val languages: List<String>,
    val vocabSize: Int,
    val dimensions: Int,
    val baseUrl: String,
    val files: Map<String, String>  // logical name → relative path
)

val MODELS: Map<String, ModelInfo> = mapOf(...)
const val DEFAULT_MODEL = "all-MiniLM-L6-v2"
```

**Download URLs (constructed):**
- `{baseUrl}/{files["model"]}` → e.g., `https://huggingface.co/.../onnx/model.onnx`
- `{baseUrl}/{files["vocab"]}` → e.g., `https://huggingface.co/.../vocab.txt`

---

## 4. Data Design

### 4.1 File System Layout

```
~/.code-intel/models/
├── registry.json                          ← Model state tracking
├── all-MiniLM-L6-v2/
│   ├── model.onnx                         ← 90MB ONNX model
│   └── vocab.txt                          ← 30K token vocabulary
└── paraphrase-multilingual-MiniLM-L12-v2/
    ├── model.onnx                         ← 470MB ONNX model
    └── sentencepiece.bpe.model            ← 250K token vocabulary
```

### 4.2 Registry Schema

```typescript
interface Registry {
  active_model: string;       // Model name key
  last_updated: string;       // ISO 8601 timestamp
  models?: {                  // Optional — tracked downloads
    [modelName: string]: {
      path: string;
      downloaded_at: string;
      size_bytes: number;
    }
  }
}
```

### 4.3 API Request/Response Types

```typescript
// GET /api/models/list response
interface ModelListResponse {
  models: Array<{
    name: string;
    display_name: string;
    size_mb: number;
    languages: string[];
    downloaded: boolean;
    active: boolean;
  }>;
}

// GET /api/models/status response
interface ModelStatusResponse {
  active_model: string;
  model_path: string;
  dimensions: number;
}

// POST /api/models/download request
interface DownloadRequest { model_name: string; }

// POST /api/models/download response
interface DownloadResponse { success: boolean; model: string; status: string; }

// POST /api/models/switch request
interface SwitchRequest { model_name: string; }

// POST /api/models/switch response
interface SwitchResponse { success: boolean; active_model: string; }

// Error response
interface ErrorResponse { error: string; message: string; }
```

---

## 5. Integration Design

### 5.1 Extension ↔ Server Integration

```
Extension                          Server (any module)
   │                                    │
   │── GET /api/models/list ──────────→ │
   │←── 200 {models: [...]} ──────────│
   │                                    │
   │── POST /api/models/download ────→ │
   │←── 200 {success, status} ────────│
   │                                    │ ──→ Background: download from HuggingFace
   │                                    │
   │── POST /api/models/switch ──────→ │
   │←── 200 {success, active_model} ──│
```

### 5.2 Server ↔ ModelManager Integration

Each HTTP route module delegates to `ModelManager.execute(JsonObject)`:
- Routes handle HTTP concerns (parse body, set status code, CORS)
- ModelManager handles business logic (validate, download, persist)
- ModelRegistry handles persistence (read/write registry.json)
- ModelCatalog provides static metadata (no I/O)

### 5.3 ViewerServer Registration

Each MCP module registers model routes in its ViewerServer/HTTP server setup:

| Module | Registration |
|--------|-------------|
| Kotlin | `routing { modelApiRoutes { modelManager } }` in `ViewerServer.kt` |
| Python | `handle_model_route(path, ...)` called from `ViewerRequestHandler.do_GET/do_POST` |
| Node.js | `handleModelRoute(req, url, res, modelManager)` called from request listener |

---

## 6. Error Handling

### 6.1 Error Categories

| Category | Source | Handling |
|----------|--------|----------|
| Server not running | Extension HTTP call fails | Show VS Code error message |
| ModelManager null | Server starting up | Return 503 |
| Invalid model name | User/client error | Return 400 + error code |
| Model not downloaded | Switch before download | Return 400 + error code |
| Network failure | HuggingFace unreachable | Log error, download fails silently |
| Disk full | Model file write fails | Download thread catches exception |
| Registry corruption | Invalid JSON | Reset to defaults (active=default, models={}) |

### 6.2 Error Response Format

All error responses follow consistent structure:
```json
{ "error": "ERROR_CODE", "message": "Human-readable description" }
```

Error codes: `MODEL_NOT_FOUND`, `MODEL_NOT_DOWNLOADED`, `INVALID_ACTION`

---

## 7. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| API exposed on network | Binds to `localhost` only — not accessible externally |
| Model file integrity | Currently: none. Future: SHA256 checksum verification |
| CORS | `Access-Control-Allow-Origin: *` — acceptable for localhost |
| Path traversal | Model names validated against static catalog (no user-supplied paths) |
| Denial of service | `downloading` set prevents duplicate downloads; daemon threads don't block server |

---

## 8. Testing Strategy

### 8.1 Unit Tests

| Component | Test Focus |
|-----------|-----------|
| ModelCatalog | `getModelInfo()` returns correct metadata |
| ModelRegistry | `markDownloaded()` / `setActive()` / `isDownloaded()` |
| ModelManager | `execute()` dispatch, error cases, concurrent download guard |

### 8.2 Integration Tests

| Test | Approach |
|------|----------|
| API routes (Kotlin) | Ktor `testApplication` with mock ModelManager |
| API routes (Python) | `unittest` with mock handler |
| API routes (Node.js) | `http.createServer` test with mock ModelManager |

### 8.3 E2E Tests

| Test | Approach |
|------|----------|
| Full download flow | Start server → call list → download → switch → verify registry |
| Extension command | Manual test via VS Code Command Palette |

---

## 9. Implementation Checklist

### 9.1 Files Created

| # | File | Module | Lines |
|---|------|--------|-------|
| 1 | `src/model-downloader.ts` | Extension | ~150 |
| 2 | `src/main/kotlin/.../http/ModelApiRoutes.kt` | Kotlin | ~60 |
| 3 | `src/main/kotlin/.../models/ModelManager.kt` | Kotlin | ~100 |
| 4 | `src/main/kotlin/.../models/ModelRegistry.kt` | Kotlin | ~90 |
| 5 | `src/main/kotlin/.../models/ModelCatalog.kt` | Kotlin | ~45 |
| 6 | `src/mcp_code_intel/http/model_routes.py` | Python | ~75 |
| 7 | `src/http/model-routes.ts` | Node.js | ~65 |

### 9.2 Files Modified

| # | File | Module | Change |
|---|------|--------|--------|
| 1 | `src/extension.ts` | Extension | Register `downloadModel` command |
| 2 | `package.json` | Extension | Add command contribution |
| 3 | `src/main/kotlin/.../http/ViewerServer.kt` | Kotlin | Mount model routes |
| 4 | `http/viewer_server.py` | Python | Route to `handle_model_route()` |
| 5 | `src/http/viewer-server.ts` | Node.js | Route to `handleModelRoute()` |
| 6 | `server.py` | Python | Pass ModelManager to viewer |
| 7 | `index.ts` | Node.js | Pass ModelManager to viewer |
| 8 | `McpServer.kt` | Kotlin | Initialize ModelManager, pass to viewer |

---

## 10. Deployment Notes

- No database migrations required
- No configuration changes required (uses existing viewer port)
- Model files downloaded on-demand (not bundled with release)
- Default model (`all-MiniLM-L6-v2`) auto-downloads on first server start via `autoDownloadIfNeeded()`
- Registry file created automatically on first write

---

## Appendix A: Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
