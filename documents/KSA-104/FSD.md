# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-104: Download Embedding Model

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-104 |
| Title | Download Embedding Model — VS Code Command + HTTP API |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-05-21 |
| Status | Final (Retroactive) |
| Related BRD | BRD-v1-KSA-104.docx |
| Related Ticket | KSA-102 (Adaptive Token Cache + Model Manager) |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-21 | BA Agent | Created retroactively from implemented code |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the "Download Embedding Model" feature. It provides a VS Code extension command with QuickPick UI that allows users to browse, download, and switch between embedding models used by the MCP Code Intelligence system for semantic search.

### 1.2 Scope

- VS Code extension command: `Kiro SDLC: Download Embedding Model`
- QuickPick UI for model selection with status indicators
- HTTP API routes (`/api/models/*`) implemented across 3 MCP modules (Python, Node.js, Kotlin)
- Background model download from HuggingFace with progress notification
- Model switching (activate a different downloaded model)

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| Embedding Model | ONNX neural network that converts text to 384-dimensional vectors |
| QuickPick | VS Code native dropdown UI for item selection |
| ModelManager | Backend component handling model lifecycle (list/download/status/switch) |
| ModelRegistry | JSON file tracking downloaded models and active selection |
| HuggingFace | Model hosting platform (source for ONNX model downloads) |
| ONNX | Open Neural Network Exchange — portable model format |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | documents/KSA-104/BRD.md |
| KSA-102 FSD | documents/KSA-102/FSD.md |
| ModelManager (Kotlin) | mcp-code-intelligence-kotlin/src/main/kotlin/com/codeintel/orchestration/models/ |
| Model Downloader (Extension) | kiro-sdlc-agents/src/model-downloader.ts |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

**Actors:**
- **Developer**: Triggers command from VS Code Command Palette
- **MCP Server (Viewer HTTP)**: Serves model API on localhost
- **HuggingFace Hub**: External model file hosting

**Data Flow:**
1. Developer invokes command → Extension reads MCP server port from `.kiro/settings/mcp.json`
2. Extension calls `GET /api/models/list` → Server returns model catalog with download status
3. Developer selects model → Extension calls `POST /api/models/download` or `POST /api/models/switch`
4. Server downloads model files from HuggingFace (background thread)
5. Server updates `registry.json` with download state

### 2.2 Feature Boundaries

| In Scope | Out of Scope |
|----------|-------------|
| List available models with metadata | Custom model upload |
| Download models from HuggingFace | Model training/fine-tuning |
| Switch active model | Automatic model selection |
| Progress notification in VS Code | Download cancellation |
| Model status query | Model deletion |

---

## 3. Use Cases

### 3.1 UC-01: List Available Models

| Field | Value |
|-------|-------|
| ID | UC-01 |
| Actor | Developer |
| Precondition | MCP server is running, viewer HTTP port is accessible |
| Trigger | Developer opens Command Palette → selects "Kiro SDLC: Download Embedding Model" |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | Invokes command | — |
| 2 | — | Reads viewer port from `.kiro/settings/mcp.json` (default: 3200) |
| 3 | — | Calls `GET /api/models/list` |
| 4 | — | Server queries ModelManager → returns model catalog |
| 5 | — | Displays QuickPick with models showing: status icon, display name, size, languages |

**Alternative Flow:**

| ID | Condition | Action |
|----|-----------|--------|
| AF-01a | MCP server not running | Show error: "Cannot reach MCP server. Ensure it is running." |
| AF-01b | No workspace folder open | Show error: "No workspace folder open." |

**Postcondition:** QuickPick displayed with model list

---

### 3.2 UC-02: Download Model

| Field | Value |
|-------|-------|
| ID | UC-02 |
| Actor | Developer |
| Precondition | QuickPick displayed, model not yet downloaded |
| Trigger | Developer selects a model marked "Not downloaded" |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | Selects model | — |
| 2 | — | Shows progress notification: "Downloading model: {name}..." |
| 3 | — | Calls `POST /api/models/download` with `{ model_name: "..." }` |
| 4 | — | Server spawns background thread, downloads files from HuggingFace |
| 5 | — | Server returns `{ success: true, status: "downloading" }` |
| 6 | — | Shows success message: "Model downloaded. Activate now?" |
| 7 | Developer clicks "Activate" | Calls `POST /api/models/switch` |
| 8 | — | Shows confirmation: "Active model switched to: {name}" |

**Alternative Flow:**

| ID | Condition | Action |
|----|-----------|--------|
| AF-02a | Download fails (network error) | Show error: "Download failed: {message}" |
| AF-02b | Model name unknown | Server returns 400: `{ error: "MODEL_NOT_FOUND" }` |
| AF-02c | User clicks "Later" at step 6 | No switch, model remains downloaded but inactive |

**Postcondition:** Model files saved to `~/.code-intel/models/{model-name}/`, registry updated

---

### 3.3 UC-03: Switch Active Model

| Field | Value |
|-------|-------|
| ID | UC-03 |
| Actor | Developer |
| Precondition | QuickPick displayed, model already downloaded but not active |
| Trigger | Developer selects a downloaded model |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | Selects downloaded model | — |
| 2 | — | Shows confirmation: "Model is already downloaded. Activate it?" |
| 3 | Developer clicks "Activate" | — |
| 4 | — | Calls `POST /api/models/switch` with `{ model_name: "..." }` |
| 5 | — | Server updates `registry.json` active_model field |
| 6 | — | Shows success: "Active model switched to: {name}" |

**Alternative Flow:**

| ID | Condition | Action |
|----|-----------|--------|
| AF-03a | Model not downloaded | Server returns 400: `{ error: "MODEL_NOT_DOWNLOADED", message: "Download first" }` |
| AF-03b | User clicks "Cancel" | No action taken |
| AF-03c | Model already active | Show info: "Model is already active." — no API call |

**Postcondition:** `registry.json` updated with new active model

---

### 3.4 UC-04: Query Model Status

| Field | Value |
|-------|-------|
| ID | UC-04 |
| Actor | System (internal) |
| Precondition | MCP server running |
| Trigger | Any component needs current model info |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | Calls `GET /api/models/status` | — |
| 2 | — | Returns `{ active_model, model_path, dimensions }` |

**Postcondition:** Caller has current model state

---

## 4. Business Rules

| ID | Rule | Enforcement |
|----|------|-------------|
| BR-01 | Only models in the catalog can be downloaded | ModelManager validates against MODELS map |
| BR-02 | A model must be downloaded before it can be activated | Switch checks `registry.isDownloaded()` |
| BR-03 | Only one model can be active at a time | `registry.json` has single `active_model` field |
| BR-04 | Default model is `all-MiniLM-L6-v2` if none configured | Hardcoded in `DEFAULT_MODEL` constant |
| BR-05 | Downloads are non-blocking (background thread) | `thread(isDaemon=true)` in Kotlin, async in Node.js |
| BR-06 | Duplicate download requests are ignored | `downloading` set prevents concurrent downloads of same model |
| BR-07 | Server port is resolved from `.kiro/settings/mcp.json` env `CODE_INTEL_VIEWER_PORT` | Extension reads config, falls back to 3200 |

---

## 5. Data Specifications

### 5.1 Model Catalog (Static)

| Model Name | Display Name | Size | Languages | Dimensions | Vocab |
|-----------|-------------|------|-----------|------------|-------|
| `all-MiniLM-L6-v2` | English (Small, Fast) | 90 MB | en | 384 | 30,522 |
| `paraphrase-multilingual-MiniLM-L12-v2` | Multilingual (50+ languages) | 470 MB | en, vi, zh, ja, ko, fr, de, es, ar, ru | 384 | 250,002 |

### 5.2 Registry State (`~/.code-intel/models/registry.json`)

```json
{
  "active_model": "all-MiniLM-L6-v2",
  "last_updated": "2026-05-21T10:00:00Z",
  "models": {
    "all-MiniLM-L6-v2": {
      "path": "~/.code-intel/models/all-MiniLM-L6-v2",
      "downloaded_at": "2026-05-21T09:30:00Z",
      "size_bytes": 94371840
    }
  }
}
```

### 5.3 Model Files (Per Model Directory)

| Model | Files |
|-------|-------|
| `all-MiniLM-L6-v2` | `model.onnx`, `vocab.txt` |
| `paraphrase-multilingual-MiniLM-L12-v2` | `model.onnx`, `sentencepiece.bpe.model` |

---

## 6. API Specifications

### 6.1 GET /api/models/list

**Request:** No parameters

**Response (200):**
```json
{
  "models": [
    {
      "name": "all-MiniLM-L6-v2",
      "display_name": "English (Small, Fast)",
      "size_mb": 90,
      "languages": ["en"],
      "downloaded": true,
      "active": true
    },
    {
      "name": "paraphrase-multilingual-MiniLM-L12-v2",
      "display_name": "Multilingual (50+ languages)",
      "size_mb": 470,
      "languages": ["en", "vi", "zh", "ja", "ko", "fr", "de", "es", "ar", "ru"],
      "downloaded": false,
      "active": false
    }
  ]
}
```

**Error (503):** `{ "error": "Model manager not initialized" }`

---

### 6.2 GET /api/models/status

**Request:** No parameters

**Response (200):**
```json
{
  "active_model": "all-MiniLM-L6-v2",
  "model_path": "/home/user/.code-intel/models/all-MiniLM-L6-v2",
  "dimensions": 384
}
```

---

### 6.3 POST /api/models/download

**Request:**
```json
{ "model_name": "paraphrase-multilingual-MiniLM-L12-v2" }
```

**Response (200):**
```json
{ "success": true, "model": "paraphrase-multilingual-MiniLM-L12-v2", "status": "downloading" }
```

**Error (400):**
```json
{ "error": "MODEL_NOT_FOUND", "message": "Unknown: invalid-model" }
```

---

### 6.4 POST /api/models/switch

**Request:**
```json
{ "model_name": "paraphrase-multilingual-MiniLM-L12-v2" }
```

**Response (200):**
```json
{ "success": true, "active_model": "paraphrase-multilingual-MiniLM-L12-v2" }
```

**Error (400):**
```json
{ "error": "MODEL_NOT_DOWNLOADED", "message": "Download first" }
```

---

## 7. UI Specifications

### 7.1 Command Registration

| Field | Value |
|-------|-------|
| Command ID | `kiro-sdlc.downloadModel` |
| Title | `Kiro SDLC: Download Embedding Model` |
| Category | Kiro SDLC |
| When | Workspace is open |

### 7.2 QuickPick Items

Each model displays:
- **Status icon**: `$(check)` Active | `$(cloud-download)` Downloaded | `$(cloud)` Not downloaded
- **Label**: `{status icon}  {display_name}`
- **Description**: `{size_mb}MB — {languages}`

### 7.3 Progress Notification

- Location: VS Code Notification area (ProgressLocation.Notification)
- Title: "Downloading model: {model_name}..."
- Cancellable: No

### 7.4 Post-Download Dialog

- Message: `✅ Model "{name}" downloaded. Activate now?`
- Buttons: "Activate" | "Later"

### 7.5 Success/Error Messages

| Scenario | Message |
|----------|---------|
| Switch success | `✅ Active model switched to: {name}` |
| Already active | `Model "{name}" is already active.` |
| Server unreachable | `❌ Cannot reach MCP server. Ensure it is running.` |
| Download failed | `❌ Download failed: {error message}` |
| Switch failed | `❌ Switch failed: {error message}` |

---

## 8. Error Handling

| Error Code | HTTP Status | Trigger | User Impact |
|-----------|-------------|---------|-------------|
| `MODEL_NOT_FOUND` | 400 | Invalid model_name in request | Extension shows error message |
| `MODEL_NOT_DOWNLOADED` | 400 | Switch attempted on non-downloaded model | Extension shows error message |
| `INVALID_ACTION` | 400 | Unknown action in execute() | Internal error, should not reach UI |
| Service Unavailable | 503 | ModelManager not initialized | Extension shows "Cannot reach MCP server" |
| Network Error | — | HuggingFace unreachable during download | Extension shows "Download failed" |

---

## 9. Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-01 | Model list response time | < 50ms (in-memory catalog) |
| NFR-02 | Download does not block server | Background thread/async |
| NFR-03 | Concurrent download prevention | Same model cannot be downloaded twice simultaneously |
| NFR-04 | Cross-platform support | Windows, macOS, Linux |
| NFR-05 | No external dependencies for API routes | stdlib HTTP only (Python), Ktor (Kotlin), http (Node.js) |
| NFR-06 | Model storage location | `~/.code-intel/models/{model-name}/` (global, shared across workspaces) |

---

## 10. Implementation Parity Matrix

| Feature | Python | Node.js | Kotlin |
|---------|--------|---------|--------|
| `/api/models/list` | ✅ `model_routes.py` | ✅ `model-routes.ts` | ✅ `ModelApiRoutes.kt` |
| `/api/models/status` | ✅ | ✅ | ✅ |
| `/api/models/download` | ✅ | ✅ | ✅ |
| `/api/models/switch` | ✅ | ✅ | ✅ |
| Background download | ✅ (thread) | ✅ (async) | ✅ (daemon thread) |
| ModelManager | ✅ | ✅ | ✅ |
| ModelRegistry | ✅ | ✅ | ✅ |
| ModelCatalog | ✅ | ✅ | ✅ |
| CORS headers | ✅ | ✅ | ✅ (Ktor built-in) |

---

## 11. Sequence Diagrams

### 11.1 Download Model Sequence

![Sequence — Download Model](diagrams/sequence-download.png)

```
Developer → Extension: Invoke "Download Embedding Model" command
Extension → Extension: resolveViewerPort() from mcp.json
Extension → Server: GET /api/models/list
Server → ModelManager: execute({action: "list"})
ModelManager → ModelRegistry: isDownloaded() for each model
ModelManager → Server: JSON response with model catalog
Server → Extension: 200 OK [{models}]
Extension → Developer: Show QuickPick
Developer → Extension: Select model (not downloaded)
Extension → Server: POST /api/models/download {model_name}
Server → ModelManager: execute({action: "download", model_name})
ModelManager → Background Thread: downloadFiles(model)
ModelManager → Server: {success: true, status: "downloading"}
Server → Extension: 200 OK
Background Thread → HuggingFace: GET model.onnx
Background Thread → HuggingFace: GET vocab.txt
Background Thread → ModelRegistry: markDownloaded(model, size)
Extension → Developer: "Downloaded. Activate now?"
Developer → Extension: Click "Activate"
Extension → Server: POST /api/models/switch {model_name}
Server → ModelManager: execute({action: "switch", model_name})
ModelManager → ModelRegistry: setActive(model)
Server → Extension: {success: true, active_model: "..."}
Extension → Developer: "Active model switched to: ..."
```

---

## 12. State Diagram

### 12.1 Model Lifecycle States

![State — Model Lifecycle](diagrams/state-model-lifecycle.png)

```
States:
- NOT_IN_CATALOG: Model unknown to system
- AVAILABLE: In catalog, not downloaded
- DOWNLOADING: Download in progress (background)
- DOWNLOADED: Files present on disk, not active
- ACTIVE: Currently used for embedding generation

Transitions:
- AVAILABLE → DOWNLOADING: POST /api/models/download
- DOWNLOADING → DOWNLOADED: Background download completes
- DOWNLOADING → AVAILABLE: Download fails (files cleaned up)
- DOWNLOADED → ACTIVE: POST /api/models/switch
- ACTIVE → DOWNLOADED: Another model switched to active
```

---

## 13. Open Issues

| ID | Issue | Impact | Resolution |
|----|-------|--------|------------|
| OI-01 | No download progress percentage reported to extension | UX — user sees indeterminate progress | Future: SSE or polling `/api/models/status` |
| OI-02 | No model deletion capability | Disk space management | Future: Add DELETE endpoint |
| OI-03 | Download is fire-and-forget (no retry on partial failure) | Corrupted model files possible | Future: Checksum verification |

---

## Appendix A: Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence — Download Model | [sequence-download.png](diagrams/sequence-download.png) | [sequence-download.drawio](diagrams/sequence-download.drawio) |
| 3 | State — Model Lifecycle | [state-model-lifecycle.png](diagrams/state-model-lifecycle.png) | [state-model-lifecycle.drawio](diagrams/state-model-lifecycle.drawio) |
