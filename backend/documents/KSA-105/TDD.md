# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-105: Bug Fix — Self-Contained Download + Cache Invalidation

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-105 |
| Title | Technical Design: Extension Self-Contained Download + ModelRegistry Cache Invalidation |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-21 |
| Status | Final (Retroactive) |
| Related BRD | BRD-v1-KSA-105.docx |
| Related FSD | FSD-v1-KSA-105.docx |
| Related Tickets | KSA-104 (parent), KSA-102 (infrastructure) |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-21 | SA Agent | Created retroactively from implemented fix |

---

## 1. Introduction

### 1.1 Purpose

This TDD specifies the technical implementation of the KSA-105 bug fix across 4 files:
1. Extension `model-downloader.ts` — complete rewrite for self-contained download
2. Kotlin `ModelRegistry.kt` — cache invalidation
3. Python `model_registry.py` — cache invalidation
4. Node.js `model-registry.ts` — cache invalidation

### 1.2 Technology Stack

| Layer | Technology |
|-------|-----------|
| Extension | TypeScript, Node.js `https` module, VS Code API |
| Kotlin | Kotlin stdlib, `java.io.File`, `kotlinx.serialization` |
| Python | Python stdlib (`json`, `os`, `pathlib`) |
| Node.js | Node.js stdlib (`fs`, `path`) |

### 1.3 Design Principles

- **Zero server dependency**: Extension must work completely standalone
- **Minimal change**: Cache invalidation is a surgical fix — only change read pattern
- **No schema changes**: `registry.json` format unchanged
- **Consistent behavior**: All 3 MCP modules behave identically after fix

---

## 2. Architecture

### 2.1 Architecture Overview

![Architecture](diagrams/architecture.png)
*[Edit in draw.io](diagrams/architecture.drawio)*

```
┌─────────────────────────────────────────────────────────────┐
│ VS Code Extension (REWRITTEN)                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ model-downloader.ts (self-contained)                    │ │
│ │  ├── handleDownloadModel()   ← Entry point              │ │
│ │  ├── showModelPicker()       ← QuickPick from local     │ │
│ │  ├── downloadModelFiles()    ← Direct HTTPS download    │ │
│ │  ├── updateRegistry()        ← Direct file write        │ │
│ │  ├── readRegistry()          ← Direct file read         │ │
│ │  └── MODELS (constant)       ← Hardcoded catalog        │ │
│ └─────────────────────────────────────────────────────────┘ │
└───────────────────────────────┬─────────────────────────────┘
                                │ HTTPS (direct to HuggingFace)
                                ▼
                    ┌──────────────────────┐
                    │ HuggingFace Hub      │
                    └──────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ MCP Server (Kotlin / Python / Node.js)                      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ModelRegistry (MODIFIED — no cache)                     │ │
│ │  ├── get activeModel → READ registry.json EVERY TIME    │ │
│ │  ├── isDownloaded()  → READ registry.json EVERY TIME    │ │
│ │  └── NO in-memory cache of registry data                │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
         ↕ (shared file)
    ~/.code-intel/models/registry.json
```

### 2.2 Component Diagram

![Component](diagrams/component.png)
*[Edit in draw.io](diagrams/component.drawio)*

---

## 3. Module Design

### 3.1 Extension: `model-downloader.ts` (Rewrite)

**Location:** `kiro-sdlc-agents/src/model-downloader.ts`

**Key change:** Previously called MCP server HTTP API. Now performs all operations locally.

**Functions:**

| Function | Purpose | Lines |
|----------|---------|-------|
| `handleDownloadModel()` | Entry point: read registry → show picker → download/switch | ~15 |
| `showModelPicker(models, registry)` | Build QuickPick items with status from local registry | ~20 |
| `downloadModelFiles(modelName, modelInfo)` | Download model.onnx + vocab from HuggingFace | ~20 |
| `downloadFile(url, destPath)` | HTTPS GET with stream-to-file, returns Promise | ~18 |
| `readRegistry()` | Read and parse `~/.code-intel/models/registry.json` | ~10 |
| `updateRegistry(modelName, modelPath, sizeBytes)` | Write updated registry.json (add model, set active) | ~15 |
| `getModelsDir()` | Return `~/.code-intel/models/` path | ~3 |
| `MODELS` | Hardcoded model catalog constant | ~20 |

**Pseudocode — `handleDownloadModel()`:**
```typescript
async function handleDownloadModel() {
  const modelsDir = getModelsDir();
  ensureDirExists(modelsDir);
  
  const registry = readRegistry();
  const items = buildQuickPickItems(MODELS, registry);
  
  const selected = await vscode.window.showQuickPick(items);
  if (!selected) return;
  
  const modelName = selected.modelKey;
  const modelInfo = MODELS[modelName];
  
  if (registry.active_model === modelName) {
    vscode.window.showInformationMessage("Model is already active.");
    return;
  }
  
  if (isDownloaded(registry, modelName)) {
    // Already downloaded — just switch
    updateRegistry(modelName, ...);
    vscode.window.showInformationMessage(`Active model switched to: ${modelInfo.displayName}`);
    return;
  }
  
  // Download with progress
  await vscode.window.withProgress({...}, async () => {
    await downloadModelFiles(modelName, modelInfo);
    updateRegistry(modelName, modelPath, sizeBytes);
  });
  
  vscode.window.showInformationMessage(`Model downloaded and activated: ${modelInfo.displayName}`);
}
```

**Pseudocode — `downloadFile()`:**
```typescript
function downloadFile(url: string, destPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect (HuggingFace uses redirects)
        return downloadFile(response.headers.location!, destPath).then(resolve, reject);
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      let bytes = 0;
      response.on('data', (chunk) => { bytes += chunk.length; });
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(bytes); });
    }).on('error', reject);
  });
}
```

---

### 3.2 Kotlin: `ModelRegistry.kt` (Cache Invalidation)

**Location:** `mcp-code-intelligence-kotlin/src/main/kotlin/com/codeintel/orchestration/models/ModelRegistry.kt`

**Before (cached):**
```kotlin
class ModelRegistry(private val modelsDir: String) {
    private val registryFile = File(modelsDir, "registry.json")
    private var data: JsonObject = loadRegistry()  // Cached at construction
    
    val activeModel: String
        get() = data["active_model"]?.jsonPrimitive?.content ?: DEFAULT_MODEL
    
    fun isDownloaded(name: String): Boolean =
        data["models"]?.jsonObject?.containsKey(name) ?: false
    
    private fun loadRegistry(): JsonObject { /* read file once */ }
}
```

**After (no cache):**
```kotlin
class ModelRegistry(private val modelsDir: String) {
    private val registryFile = File(modelsDir, "registry.json")
    
    val activeModel: String
        get() {
            val data = loadRegistry()  // Fresh read every time
            return data["active_model"]?.jsonPrimitive?.content ?: DEFAULT_MODEL
        }
    
    fun isDownloaded(name: String): Boolean {
        val data = loadRegistry()  // Fresh read every time
        return data["models"]?.jsonObject?.containsKey(name) ?: false
    }
    
    private fun loadRegistry(): JsonObject {
        if (!registryFile.exists()) return buildJsonObject {}
        return try {
            Json.parseToJsonElement(registryFile.readText()).jsonObject
        } catch (e: Exception) {
            buildJsonObject {}  // Corrupted → return empty
        }
    }
}
```

**Key change:** Remove `private var data` field. Every property access calls `loadRegistry()` which reads from disk.

---

### 3.3 Python: `model_registry.py` (Cache Invalidation)

**Location:** `mcp-code-intelligence-python/src/mcp_code_intel/orchestration/models/model_registry.py`

**Before:**
```python
class ModelRegistry:
    def __init__(self, models_dir):
        self._registry_file = Path(models_dir) / "registry.json"
        self._data = self._load()  # Cached
    
    @property
    def active_model(self):
        return self._data.get("active_model", DEFAULT_MODEL)
```

**After:**
```python
class ModelRegistry:
    def __init__(self, models_dir):
        self._registry_file = Path(models_dir) / "registry.json"
    
    @property
    def active_model(self):
        data = self._load()  # Fresh read
        return data.get("active_model", DEFAULT_MODEL)
    
    def is_downloaded(self, name):
        data = self._load()  # Fresh read
        return name in data.get("models", {})
    
    def _load(self):
        if not self._registry_file.exists():
            return {}
        try:
            return json.loads(self._registry_file.read_text())
        except (json.JSONDecodeError, OSError):
            return {}
```

---

### 3.4 Node.js: `model-registry.ts` (Cache Invalidation)

**Location:** `mcp-code-intelligence-nodejs/src/orchestration/models/model-registry.ts`

**Before:**
```typescript
export class ModelRegistry {
    private data: RegistryData;
    constructor(modelsDir: string) {
        this.registryFile = path.join(modelsDir, "registry.json");
        this.data = this.load();  // Cached
    }
    get activeModel(): string { return this.data.active_model ?? DEFAULT_MODEL; }
}
```

**After:**
```typescript
export class ModelRegistry {
    constructor(private modelsDir: string) {
        this.registryFile = path.join(modelsDir, "registry.json");
    }
    
    get activeModel(): string {
        const data = this.load();  // Fresh read
        return data.active_model ?? DEFAULT_MODEL;
    }
    
    isDownloaded(name: string): boolean {
        const data = this.load();  // Fresh read
        return name in (data.models ?? {});
    }
    
    private load(): RegistryData {
        if (!fs.existsSync(this.registryFile)) return {};
        try {
            return JSON.parse(fs.readFileSync(this.registryFile, "utf-8"));
        } catch {
            return {};
        }
    }
}
```

---

## 4. Data Design

### 4.1 Registry.json (No Schema Change)

Format remains identical to KSA-104:
```json
{
  "active_model": "all-MiniLM-L6-v2",
  "last_updated": "2026-05-21T12:00:00Z",
  "models": {
    "all-MiniLM-L6-v2": {
      "path": "/home/user/.code-intel/models/all-MiniLM-L6-v2",
      "downloaded_at": "2026-05-21T12:00:00Z",
      "size_bytes": 94371840
    }
  }
}
```

### 4.2 File System Operations

| Operation | Actor | Path |
|-----------|-------|------|
| Create directory | Extension | `~/.code-intel/models/{model-name}/` |
| Write model file | Extension | `~/.code-intel/models/{model-name}/model.onnx` |
| Write vocab file | Extension | `~/.code-intel/models/{model-name}/vocab.txt` |
| Write registry | Extension | `~/.code-intel/models/registry.json` |
| Read registry | Extension + MCP Server | `~/.code-intel/models/registry.json` |

---

## 5. Integration Design

### 5.1 Extension ↔ HuggingFace (New)

```
Extension → HTTPS GET → HuggingFace CDN
         ← 302 Redirect → Follow to actual file URL
         ← 200 + Stream → Write to disk
```

**Redirect handling:** HuggingFace returns 302 redirects to CDN. Extension must follow redirects (max 5 hops).

### 5.2 Extension ↔ File System (New)

```
Extension → fs.mkdirSync(modelsDir, {recursive: true})
Extension → fs.createWriteStream(modelPath) ← pipe from HTTPS response
Extension → fs.writeFileSync(registryPath, JSON.stringify(data))
```

### 5.3 MCP Server ↔ File System (Modified)

```
Before: ModelRegistry constructor → readFileSync → cache in this.data
After:  ModelRegistry.activeModel → readFileSync → return (no cache)
```

---

## 6. Error Handling

### 6.1 Extension Errors

| Error | Detection | Recovery |
|-------|-----------|----------|
| Network timeout | `https.get` timeout event | Show error, clean up partial files |
| HTTP non-200 | Response status code check | Show error with status code |
| Redirect loop | Count redirects > 5 | Show error "Too many redirects" |
| Disk write failure | `fs.createWriteStream` error event | Show error, clean up partial files |
| Registry parse error | `JSON.parse` throws | Reset to empty registry `{}` |
| Directory creation fails | `mkdirSync` throws | Show error about permissions |

### 6.2 MCP Server Errors (Registry Read)

| Error | Detection | Recovery |
|-------|-----------|----------|
| File not found | `!file.exists()` | Return empty object (defaults) |
| JSON parse error | `catch` block | Return empty object (defaults) |
| Permission denied | `catch` block | Return empty object (defaults) |

---

## 7. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| HTTPS certificate validation | Node.js `https` validates by default |
| Model file integrity | No checksum yet (same as KSA-104 — tracked as OI-03) |
| Registry file permissions | Created with user's default umask |
| Path traversal in model names | Model names validated against hardcoded MODELS constant |
| Concurrent registry writes | Atomic write (write temp → rename) prevents corruption |

---

## 8. Testing Strategy

### 8.1 Unit Tests

| Component | Test |
|-----------|------|
| `readRegistry()` | File not found → empty; valid JSON → parsed; invalid JSON → empty |
| `updateRegistry()` | Adds model entry, sets active_model, preserves existing entries |
| `downloadFile()` | Mock HTTPS — success, redirect, error cases |
| `ModelRegistry.activeModel` (Kotlin) | Reads fresh from disk each time |
| `ModelRegistry.isDownloaded` (Python) | Reads fresh from disk each time |
| `ModelRegistry.activeModel` (Node.js) | Reads fresh from disk each time |

### 8.2 Integration Tests

| Test | Approach |
|------|----------|
| Extension download flow | Mock HuggingFace server, verify files written |
| Cache invalidation (Kotlin) | Write registry.json externally → verify ModelRegistry sees change |
| Cache invalidation (Python) | Same as Kotlin |
| Cache invalidation (Node.js) | Same as Kotlin |

---

## 9. Implementation Checklist

### 9.1 Files Modified

| # | File | Module | Change Type | Description |
|---|------|--------|-------------|-------------|
| 1 | `kiro-sdlc-agents/src/model-downloader.ts` | Extension | **Rewrite** | Remove HTTP API calls, add direct HuggingFace download + local registry management |
| 2 | `mcp-code-intelligence-kotlin/.../ModelRegistry.kt` | Kotlin | **Modify** | Remove `private var data` cache, read from disk on every access |
| 3 | `mcp-code-intelligence-python/.../model_registry.py` | Python | **Modify** | Remove `self._data` cache, read from disk on every access |
| 4 | `mcp-code-intelligence-nodejs/.../model-registry.ts` | Node.js | **Modify** | Remove `this.data` cache, read from disk on every access |

### 9.2 Files NOT Modified

| File | Reason |
|------|--------|
| `ModelApiRoutes.kt` | HTTP API still works (for other clients), just not required by extension |
| `model_routes.py` | Same — API routes unchanged |
| `model-routes.ts` | Same — API routes unchanged |
| `ModelManager` (all modules) | Business logic unchanged |
| `ModelCatalog` (all modules) | Static data unchanged |

---

## 10. Deployment Notes

- **No migration needed** — registry.json format unchanged
- **Backward compatible** — MCP server HTTP API still works for other clients
- **Extension update only** — users get fix via VS Code extension update
- **Server update recommended** — cache invalidation fix improves reliability but server still functions without it (just won't see external registry changes until restart)
- **Released as v1.6.1** — patch release

---

## Appendix: Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
