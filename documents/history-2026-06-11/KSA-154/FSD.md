# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-154: [Graph] Call Graph - callers/callees

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-154 |
| Title | [Graph] Call Graph - callers/callees with transitive depth |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-05-28 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-154.docx |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the `code_callers` and `code_callees` MCP tools — the primary graph navigation tools for AI agents. These tools query the relationships table to provide call chain information with configurable transitive depth.

### 1.2 Scope

- `code_callers` MCP tool implementation
- `code_callees` MCP tool implementation
- BFS graph traversal with depth control
- Cycle detection
- Result formatting and limiting

---

## 2. Functional Requirements

### 2.1 Feature: code_callers Tool

#### 2.1.1 MCP Tool Registration

```json
{
  "name": "code_callers",
  "description": "Find all callers of a function/method. Supports transitive depth to show caller chains.",
  "inputSchema": {
    "type": "object",
    "required": ["symbol"],
    "properties": {
      "symbol": {
        "type": "string",
        "description": "Symbol name or qualified name (e.g., 'parseConfig' or 'ConfigService.parseConfig')"
      },
      "depth": {
        "type": "integer",
        "default": 1,
        "minimum": 1,
        "maximum": 5,
        "description": "Transitive depth. 1=direct callers only, 2=callers of callers, etc."
      },
      "limit": {
        "type": "integer",
        "default": 20,
        "maximum": 100,
        "description": "Maximum number of results"
      },
      "file_filter": {
        "type": "string",
        "description": "Glob pattern to filter results (e.g., 'src/**/*.ts')"
      },
      "kind_filter": {
        "type": "string",
        "enum": ["calls", "imports", "inherits", "implements", "all"],
        "default": "calls",
        "description": "Relationship kind to traverse"
      }
    }
  }
}
```

#### 2.1.2 Use Case: Find Direct Callers

**Use Case ID:** UC-01 — Find Direct Callers (depth=1)

| Step | Action | Details |
|------|--------|---------|
| 1 | Resolve symbol name to symbol ID(s) | Query symbols table by name |
| 2 | If multiple matches, use all | Return callers for all matching symbols |
| 3 | Query relationships table | `WHERE target_symbol = ? AND kind = 'calls'` |
| 4 | Join with symbols table | Get caller metadata (name, kind, file, line) |
| 5 | Apply file_filter if provided | Filter by glob pattern |
| 6 | Apply limit | Truncate results |
| 7 | Return formatted response | JSON with callers array |

**SQL Query:**

```sql
SELECT 
    s.name as caller_name,
    s.kind as caller_kind,
    s.file_path as caller_file,
    s.line as caller_def_line,
    r.line as call_site_line,
    s.parameters as caller_params,
    s.is_async as caller_is_async,
    1 as depth_level
FROM relationships r
JOIN symbols s ON s.id = r.source_symbol_id
WHERE (r.target_symbol = ? OR r.target_symbol_id = ?)
  AND r.kind = ?
ORDER BY s.file_path, r.line
LIMIT ?;
```

#### 2.1.3 Use Case: Find Transitive Callers

**Use Case ID:** UC-02 — Find Transitive Callers (depth>1)

**Algorithm: BFS (Breadth-First Search)**

```
function findCallers(symbolName, maxDepth, limit):
    visited = Set()
    queue = [(symbolName, 0)]  // (symbol, current_depth)
    results = []
    
    while queue is not empty AND results.length < limit:
        (current, depth) = queue.dequeue()
        
        if depth >= maxDepth:
            continue
        
        directCallers = queryDirectCallers(current)
        
        for caller in directCallers:
            if caller.id not in visited:
                visited.add(caller.id)
                results.append({...caller, depth_level: depth + 1})
                queue.enqueue((caller.name, depth + 1))
    
    return results
```

**Business Rules:**

| ID | Rule | Description |
|----|------|-------------|
| BR-01 | BFS order | Closest callers returned first |
| BR-02 | Cycle detection | visited set prevents infinite loops |
| BR-03 | Max depth | Capped at 5 regardless of input |
| BR-04 | Limit applies globally | Not per-depth-level |
| BR-05 | Multiple matches | If symbol name matches multiple definitions, include callers of all |

---

### 2.2 Feature: code_callees Tool

#### 2.2.1 MCP Tool Registration

```json
{
  "name": "code_callees",
  "description": "Find all functions/methods called by a given symbol. Shows what a function depends on.",
  "inputSchema": {
    "type": "object",
    "required": ["symbol"],
    "properties": {
      "symbol": {
        "type": "string",
        "description": "Symbol name or qualified name"
      },
      "depth": {
        "type": "integer",
        "default": 1,
        "minimum": 1,
        "maximum": 5
      },
      "limit": {
        "type": "integer",
        "default": 20,
        "maximum": 100
      },
      "file_filter": {
        "type": "string"
      },
      "include_external": {
        "type": "boolean",
        "default": true,
        "description": "Include calls to external/unresolved symbols"
      }
    }
  }
}
```

#### 2.2.2 Use Case: Find Callees

**Use Case ID:** UC-03 — Find What a Function Calls

**SQL Query:**

```sql
SELECT 
    r.target_symbol as callee_name,
    ts.kind as callee_kind,
    ts.file_path as callee_file,
    ts.line as callee_def_line,
    r.line as call_site_line,
    r.metadata,
    1 as depth_level
FROM relationships r
LEFT JOIN symbols ts ON ts.id = r.target_symbol_id
WHERE r.source_symbol_id = ?
  AND r.kind = ?
ORDER BY r.line
LIMIT ?;
```

**Note:** LEFT JOIN because target_symbol_id may be NULL (unresolved external calls).

---

### 2.3 Feature: Response Format

#### 2.3.1 Success Response

```json
{
  "symbol": "parseConfig",
  "resolved_to": [
    { "id": 42, "file": "src/config.ts", "line": 10, "kind": "function" }
  ],
  "callers": [
    {
      "symbol": "initApp",
      "qualified_name": "initApp",
      "kind": "function",
      "file_path": "src/app.ts",
      "definition_line": 5,
      "call_site_line": 42,
      "depth_level": 1,
      "is_async": false,
      "parameters": "(configPath: string)"
    },
    {
      "symbol": "main",
      "qualified_name": "main",
      "kind": "function",
      "file_path": "src/index.ts",
      "definition_line": 1,
      "call_site_line": 8,
      "depth_level": 2,
      "is_async": true,
      "parameters": "()"
    }
  ],
  "metadata": {
    "total_count": 2,
    "depth_searched": 2,
    "truncated": false,
    "query_time_ms": 12
  }
}
```

#### 2.3.2 Error Response

```json
{
  "error": "Symbol not found",
  "symbol": "nonExistentFunction",
  "suggestions": ["parseConfig", "parseJSON", "parseYAML"]
}
```

#### 2.3.3 Empty Response

```json
{
  "symbol": "main",
  "resolved_to": [{ "id": 1, "file": "src/index.ts", "line": 1, "kind": "function" }],
  "callers": [],
  "metadata": {
    "total_count": 0,
    "depth_searched": 1,
    "truncated": false,
    "query_time_ms": 3,
    "note": "No callers found. This may be an entry point."
  }
}
```

---

### 2.4 Feature: Symbol Resolution

#### 2.4.1 Resolution Strategy

When user provides a symbol name, resolve it to symbol ID(s):

| Input | Resolution | Example |
|-------|-----------|---------|
| Simple name | Match by name | `parseConfig` → all symbols named parseConfig |
| Qualified name | Match by class.method | `UserService.getUser` → specific method |
| File-qualified | Match by file + name | `src/config.ts:parseConfig` → exact match |

**Resolution SQL:**

```sql
-- Simple name
SELECT id, name, kind, file_path, line FROM symbols WHERE name = ?;

-- Qualified (Class.method)
SELECT s.id, s.name, s.kind, s.file_path, s.line 
FROM symbols s
JOIN symbols parent ON parent.id = s.parent_symbol_id
WHERE s.name = ? AND parent.name = ?;

-- File-qualified
SELECT id, name, kind, file_path, line FROM symbols 
WHERE name = ? AND file_path = ?;
```

#### 2.4.2 Ambiguity Handling

| Scenario | Behavior |
|----------|----------|
| 0 matches | Return error with suggestions (fuzzy search) |
| 1 match | Use it |
| 2-5 matches | Return callers for ALL matches, tag each with source |
| >5 matches | Ask user to be more specific (qualified name) |

---

## 3. Non-Functional Requirements

| Metric | Target |
|--------|--------|
| depth=1 query | <100ms |
| depth=2 query | <200ms |
| depth=3 query | <500ms |
| depth=5 query | <1000ms |
| Symbol resolution | <20ms |
| Memory (BFS queue) | <10MB even for large graphs |

---

## 4. Error Handling

| Error | Response | HTTP-equivalent |
|-------|----------|-----------------|
| Symbol not found | Error + suggestions | 404 |
| Empty graph (no relationships) | Empty result + note | 200 |
| Timeout (>2s) | Partial results + truncated flag | 200 (partial) |
| Database error | Error message | 500 |
| Invalid depth (>5) | Clamp to 5, proceed | 200 (adjusted) |

---

## 5. Integration Points

| System | Interface | Direction |
|--------|-----------|-----------|
| Relationships table (KSA-153) | SQL queries | Read |
| Symbols table | SQL queries | Read |
| MCP server | Tool registration | Expose |
| get_ai_context (KSA-158) | Internal function call | Called by |
