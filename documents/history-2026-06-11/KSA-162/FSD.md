# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-162: [Quality] Entry Point & HTTP Handler Detection

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-162 |
| Title | [Quality] Entry Point & HTTP Handler Detection |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-06-05 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-162.docx |

---

## 1. Use Cases

### UC-162-01: Detect HTTP Handlers During Indexing

**Actor:** System (automatic during file indexing)

**Preconditions:** File parsed by tree-sitter, AST available

**Main Flow:**
1. Indexer completes symbol extraction for a file
2. Entry point detector receives AST + file metadata
3. Detector checks file imports to identify framework (FastAPI, Express, Spring, etc.)
4. Detector scans for framework-specific patterns (decorators, annotations, router calls)
5. For each detected handler: extract HTTP method, route path, middleware
6. Resolve route prefix from controller/blueprint/router group
7. Store entry point in `entry_points` table
8. Link to symbol via symbol_id FK

**Alternative Flows:**
- 3a. No framework imports detected → skip HTTP detection, check for main/CLI only
- 5a. Route path contains dynamic segments → normalize to pattern (`:id` → `{id}`)
- 6a. No controller prefix → use route path as-is

**Exception Flows:**
- E1. Decorator parsing fails → log warning, skip this handler
- E2. Route path unresolvable (dynamic variable) → store as "[dynamic]"

---

### UC-162-02: Detect Main/CLI Entry Points

**Actor:** System (automatic)

**Main Flow:**
1. Detector scans for language-specific main patterns
2. For Python: check for `if __name__ == "__main__":` block
3. For Java/Kotlin: check for `main()` function signature
4. For Go: check for `func main()` in `package main`
5. For CLI: check for CLI framework decorators/registrations
6. Classify as MAIN or CLI
7. Store in entry_points table

---

### UC-162-03: Query Entry Points via MCP Tool

**Actor:** AI Agent / Developer

**Main Flow:**
1. User calls `find_entry_points` with optional filters
2. System queries entry_points table with filters
3. System returns matching entry points with metadata
4. System includes summary statistics

**Alternative Flows:**
- 1a. No filters → return all entry points (up to limit)
- 2a. path_pattern filter → apply regex match on route_path

---

### UC-162-04: Detect Event Handlers

**Actor:** System (automatic)

**Main Flow:**
1. Detector scans for event-related patterns
2. Check for: @EventListener, emitter.on(), @Subscribe, @RabbitListener, @KafkaListener
3. Extract event name/topic
4. Classify as EVENT or SCHEDULED
5. Store in entry_points table

---

## 2. Business Rules

| ID | Rule | Rationale |
|----|------|-----------|
| BR-162-01 | Framework detection based on import statements | Reliable indicator of which framework is used |
| BR-162-02 | Route prefix resolution: controller prefix + method path | Full route needed for API mapping |
| BR-162-03 | Dynamic route params normalized to `{param}` format | Consistent representation |
| BR-162-04 | One function can be multiple entry points (e.g., handles GET and POST) | Real-world pattern |
| BR-162-05 | Entry points from node_modules/vendor excluded by default | Only user code |
| BR-162-06 | Confidence scoring: High (decorator match), Medium (pattern match), Low (heuristic) | Reduce false positives |
| BR-162-07 | Middleware detection limited to same-file or same-class scope | AST limitation |

---

## 3. Functional Specifications

### 3.1 MCP Tool: `find_entry_points`

#### 3.1.1 Input Schema

```json
{
  "name": "find_entry_points",
  "description": "Find application entry points: HTTP handlers, main functions, CLI commands, event handlers",
  "inputSchema": {
    "type": "object",
    "properties": {
      "entry_type": {
        "type": "string",
        "enum": ["HTTP", "MAIN", "CLI", "EVENT", "SCHEDULED", "WEBSOCKET", "GRAPHQL"],
        "description": "Filter by entry point type"
      },
      "framework": {
        "type": "string",
        "description": "Filter by framework (fastapi, express, nestjs, spring, gin, etc.)"
      },
      "http_method": {
        "type": "string",
        "enum": ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
        "description": "Filter by HTTP method"
      },
      "path_pattern": {
        "type": "string",
        "description": "Regex pattern to match route paths"
      },
      "file_path": {
        "type": "string",
        "description": "Filter by source file"
      },
      "has_auth": {
        "type": "boolean",
        "description": "Filter: true = only authenticated routes, false = only unauthenticated"
      },
      "limit": {
        "type": "integer",
        "default": 50,
        "description": "Max results"
      }
    }
  }
}
```

#### 3.1.2 Output Schema

```json
{
  "entry_points": [
    {
      "symbol": "string — handler function name",
      "file": "string — relative file path",
      "line": "integer",
      "entry_type": "string — HTTP/MAIN/CLI/EVENT/SCHEDULED",
      "framework": "string — detected framework",
      "http_method": "string — GET/POST/etc (HTTP only)",
      "route_path": "string — /api/users/{id} (HTTP only)",
      "full_route": "string — resolved with prefix",
      "middleware": ["string — middleware names"],
      "has_auth": "boolean — auth middleware detected",
      "controller": "string — parent controller/class",
      "confidence": "string — High/Medium/Low"
    }
  ],
  "summary": {
    "total": "integer",
    "by_type": {"HTTP": 45, "MAIN": 1, "CLI": 3, "EVENT": 5},
    "by_framework": {"fastapi": 20, "express": 15, "spring": 10},
    "by_method": {"GET": 20, "POST": 15, "PUT": 5, "DELETE": 5},
    "unauthenticated_count": "integer — routes without auth"
  }
}
```

### 3.2 Database Schema

#### entry_points table

```sql
CREATE TABLE IF NOT EXISTS entry_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol_id INTEGER NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL, -- HTTP, MAIN, CLI, EVENT, SCHEDULED, WEBSOCKET, GRAPHQL
  framework TEXT, -- fastapi, express, nestjs, spring, gin, etc.
  http_method TEXT, -- GET, POST, PUT, DELETE, PATCH (HTTP only)
  route_path TEXT, -- /api/users/{id} (HTTP only)
  full_route TEXT, -- resolved with controller prefix
  middleware TEXT, -- JSON array of middleware names
  has_auth INTEGER DEFAULT 0, -- 1 if auth middleware detected
  controller TEXT, -- parent controller/class name
  event_name TEXT, -- event name (EVENT type only)
  confidence TEXT DEFAULT 'High', -- High, Medium, Low
  detected_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_entry_type ON entry_points(entry_type);
CREATE INDEX idx_entry_framework ON entry_points(framework);
CREATE INDEX idx_entry_route ON entry_points(route_path);
CREATE INDEX idx_entry_method ON entry_points(http_method);
```

### 3.3 Framework Detection Patterns

#### Pattern Registry Format

```json
{
  "frameworks": {
    "fastapi": {
      "language": "python",
      "imports": ["fastapi", "from fastapi"],
      "handler_patterns": [
        {"decorator": "app.get|app.post|app.put|app.delete|app.patch", "extract": {"method": "group(1)", "path": "arg(0)"}},
        {"decorator": "router.get|router.post|router.put|router.delete", "extract": {"method": "group(1)", "path": "arg(0)"}}
      ],
      "prefix_pattern": {"decorator": "APIRouter(prefix=", "extract": "kwarg(prefix)"},
      "auth_indicators": ["Depends(get_current_user)", "Security(", "oauth2_scheme"]
    },
    "express": {
      "language": "typescript",
      "imports": ["express", "from 'express'"],
      "handler_patterns": [
        {"call": "app.get|app.post|app.put|app.delete|router.get|router.post", "extract": {"method": "callee_method", "path": "arg(0)"}}
      ],
      "prefix_pattern": {"call": "Router()", "mount": "app.use(path, router)"},
      "auth_indicators": ["authenticate", "passport.authenticate", "authMiddleware", "requireAuth"]
    }
  }
}
```

### 3.4 API Contracts

#### find_entry_points Request/Response

**Request:** MCP tool call with parameters as defined in 3.1.1

**Response:** JSON as defined in 3.1.2

**Performance:** < 200ms for up to 500 entry points

---

## 4. Integration Requirements

### 4.1 Integration with Indexer
- Entry point detection runs after symbol extraction (needs AST + symbols)
- Non-blocking: if detection fails, indexing continues
- Incremental: only re-detect for changed files

### 4.2 Integration with Graph Engine (KSA-153)
- Entry points stored as nodes with `is_entry_point=true` attribute
- Can be used as starting points for call graph traversal

### 4.3 Integration with Security Tools (KSA-164, KSA-165)
- HTTP handlers are primary targets for taint analysis
- Entry point detection provides the "surface area" for security scanning

---

## 5. Non-Functional Requirements

| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR-01 | Performance | Detection per file | < 10ms |
| NFR-02 | Performance | Query response | < 200ms |
| NFR-03 | Accuracy | Detection rate | >= 95% |
| NFR-04 | Accuracy | False positive rate | < 5% |
| NFR-05 | Extensibility | New framework via config | No code change |

---

## 6. Open Issues

| # | Issue | Impact | Decision Needed |
|---|-------|--------|-----------------|
| 1 | Should dynamic route registration be flagged? | Completeness vs noise | Recommend: Flag with Low confidence |
| 2 | How to handle meta-frameworks (Next.js file-based routing)? | Different detection approach | Defer to v2 |
| 3 | Should GraphQL resolvers be HTTP or separate type? | Classification | Recommend: GRAPHQL type |

---

## Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence — Handler Detection | [sequence-detection.png](diagrams/sequence-detection.png) | [sequence-detection.drawio](diagrams/sequence-detection.drawio) |
| 3 | State — Entry Point Lifecycle | [state-entry-point.png](diagrams/state-entry-point.png) | [state-entry-point.drawio](diagrams/state-entry-point.drawio) |
