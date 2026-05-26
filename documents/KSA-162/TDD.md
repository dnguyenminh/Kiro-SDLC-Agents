# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-162: [Quality] Entry Point & HTTP Handler Detection

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-162 |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-06-05 |
| Related FSD | FSD-v1-KSA-162.docx |

---

## 1. Architecture Overview

The entry point detector is a pattern-matching engine that runs during indexing. It uses a registry of framework-specific patterns to identify HTTP handlers, main functions, CLI commands, and event handlers from tree-sitter AST.

```
┌─────────────────────────────────────────────────┐
│ MCP Tool Layer (find_entry_points)               │
├─────────────────────────────────────────────────┤
│ Entry Point Detector Module (NEW)                │
│  ├── EntryPointDetector (orchestrator)           │
│  ├── FrameworkDetector (import-based)            │
│  ├── PatternRegistry (JSON config)               │
│  ├── handlers/                                   │
│  │   ├── HTTPHandlerDetector                     │
│  │   ├── MainDetector                            │
│  │   ├── CLIDetector                             │
│  │   └── EventDetector                           │
│  └── EntryPointStore (SQLite)                    │
├─────────────────────────────────────────────────┤
│ Tree-sitter Parser Layer (KSA-145)               │
└─────────────────────────────────────────────────┘
```

---

## 2. Module Design

### 2.1 File Structure

```
src/
├── analyzers/
│   └── entry-points/
│       ├── index.ts
│       ├── EntryPointDetector.ts       # Main orchestrator
│       ├── FrameworkDetector.ts        # Detect framework from imports
│       ├── PatternRegistry.ts          # Load/manage patterns
│       ├── EntryPointStore.ts          # SQLite CRUD
│       ├── EntryPointTool.ts           # MCP tool
│       ├── RouteResolver.ts            # Prefix + path resolution
│       └── detectors/
│           ├── HTTPHandlerDetector.ts  # HTTP route detection
│           ├── MainDetector.ts         # main() detection
│           ├── CLIDetector.ts          # CLI command detection
│           └── EventDetector.ts        # Event/MQ/Scheduled
├── config/
│   └── entry-point-patterns.json      # Framework patterns
```

### 2.2 Key Classes

#### EntryPointDetector

```typescript
class EntryPointDetector {
  constructor(
    private frameworkDetector: FrameworkDetector,
    private httpDetector: HTTPHandlerDetector,
    private mainDetector: MainDetector,
    private cliDetector: CLIDetector,
    private eventDetector: EventDetector,
    private store: EntryPointStore
  )

  // Detect all entry points in a file
  detectFile(filePath: string, ast: Tree, language: string): EntryPoint[]

  // Query stored entry points
  query(filters: EntryPointFilters): EntryPointQueryResult
}
```

#### HTTPHandlerDetector

```typescript
class HTTPHandlerDetector {
  constructor(private patterns: PatternRegistry, private routeResolver: RouteResolver)

  // Detect HTTP handlers in AST
  detect(ast: Tree, framework: string, language: string): HTTPEntryPoint[]

  // Extract route from decorator/annotation
  extractRoute(node: SyntaxNode, pattern: HandlerPattern): RouteInfo

  // Detect middleware on handler
  detectMiddleware(node: SyntaxNode, framework: string): string[]
}
```

#### RouteResolver

```typescript
class RouteResolver {
  // Resolve full route: controller prefix + method path
  resolve(controllerPrefix: string | null, methodPath: string): string

  // Normalize route params: :id, {id}, <int:id> → {id}
  normalizeParams(path: string): string

  // Extract controller prefix from class-level decorator
  extractControllerPrefix(classNode: SyntaxNode, framework: string): string | null
}
```

---

## 3. Detection Algorithm

### 3.1 Framework Detection Flow

```
1. Parse file imports/requires
2. Match imports against framework registry:
   - "fastapi" → FastAPI
   - "express" → Express
   - "@nestjs/common" → NestJS
   - "org.springframework" → Spring
   - "github.com/gin-gonic/gin" → Gin
3. If multiple frameworks detected → use most specific
4. If no framework → check for main/CLI patterns only
```

### 3.2 HTTP Handler Detection Flow

```
For each function/method in file:
  1. Check decorators/annotations against framework patterns
  2. If match found:
     a. Extract HTTP method from decorator name/arg
     b. Extract route path from decorator arg
     c. Find controller prefix (class-level decorator)
     d. Resolve full route = prefix + path
     e. Normalize route parameters
     f. Detect middleware (auth guards, rate limiters)
     g. Create EntryPoint record
```

### 3.3 Pattern Matching Examples

**FastAPI:**
```python
@app.get("/users/{user_id}")  # → GET /users/{user_id}
async def get_user(user_id: int):
```
Detection: decorator node → name matches `app.get` → extract arg(0) as path

**NestJS:**
```typescript
@Controller('/users')
class UserController {
  @Get(':id')
  findOne(@Param('id') id: string) {}
}
```
Detection: class decorator `@Controller('/users')` → prefix="/users", method decorator `@Get(':id')` → full route = "/users/{id}"

**Spring:**
```java
@RestController
@RequestMapping("/api/users")
public class UserController {
  @GetMapping("/{id}")
  public User getUser(@PathVariable Long id) {}
}
```
Detection: class annotation `@RequestMapping("/api/users")` → prefix, method annotation `@GetMapping("/{id}")` → full route = "/api/users/{id}"

---

## 4. Database Design

```sql
CREATE TABLE IF NOT EXISTS entry_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol_id INTEGER NOT NULL,
  entry_type TEXT NOT NULL,
  framework TEXT,
  http_method TEXT,
  route_path TEXT,
  full_route TEXT,
  middleware TEXT,  -- JSON array
  has_auth INTEGER DEFAULT 0,
  controller TEXT,
  event_name TEXT,
  confidence TEXT DEFAULT 'High',
  detected_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
);

CREATE INDEX idx_ep_type ON entry_points(entry_type);
CREATE INDEX idx_ep_framework ON entry_points(framework);
CREATE INDEX idx_ep_route ON entry_points(route_path);
```

---

## 5. Configuration

### entry-point-patterns.json

```json
{
  "frameworks": {
    "fastapi": {
      "language": "python",
      "imports": ["fastapi", "from fastapi"],
      "decorators": {
        "handler": ["app.get", "app.post", "app.put", "app.delete", "app.patch",
                    "router.get", "router.post", "router.put", "router.delete"],
        "prefix": ["APIRouter(prefix="]
      },
      "auth_indicators": ["Depends(get_current_user)", "Security("]
    },
    "express": {
      "language": "typescript",
      "imports": ["express", "from 'express'"],
      "call_patterns": {
        "handler": ["app.get", "app.post", "router.get", "router.post"],
        "mount": ["app.use"]
      },
      "auth_indicators": ["authenticate", "passport", "authMiddleware"]
    }
  },
  "main_patterns": {
    "python": {"pattern": "if __name__ == \"__main__\":", "type": "MAIN"},
    "typescript": {"pattern": "process.argv", "type": "MAIN"},
    "java": {"pattern": "public static void main(String", "type": "MAIN"},
    "kotlin": {"pattern": "fun main(", "type": "MAIN"},
    "go": {"pattern": "func main()", "type": "MAIN"}
  }
}
```

---

## 6. Implementation Checklist

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | Create module structure | src/analyzers/entry-points/ | 0.5h |
| 2 | Implement PatternRegistry | PatternRegistry.ts | 1h |
| 3 | Implement FrameworkDetector | FrameworkDetector.ts | 1.5h |
| 4 | Implement HTTPHandlerDetector | detectors/HTTPHandlerDetector.ts | 4h |
| 5 | Implement RouteResolver | RouteResolver.ts | 1.5h |
| 6 | Implement MainDetector | detectors/MainDetector.ts | 1h |
| 7 | Implement CLIDetector | detectors/CLIDetector.ts | 1.5h |
| 8 | Implement EventDetector | detectors/EventDetector.ts | 2h |
| 9 | Implement EntryPointStore | EntryPointStore.ts | 1h |
| 10 | Implement EntryPointTool | EntryPointTool.ts | 1h |
| 11 | Create pattern config JSON | config/entry-point-patterns.json | 2h |
| 12 | Integration with indexer | src/indexer/ | 1h |
| 13 | Unit tests (per framework) | tests/entry-points/ | 3h |
| 14 | Integration tests | tests/integration/ | 2h |

**Total: ~22h (0.5 week)**

---

## Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
