# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-155: [Graph] Dependency Graph

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-155 |
| Title | [Graph] Dependency Graph - imports with direction & depth |
| Author | BA + TA Agent |
| Version | 1.0 |
| Date | 2026-05-29 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-155.docx |

---

## 1. Overview

The `code_dependencies` tool provides file-level dependency graph traversal using import relationships stored in the relationships table (KSA-153). It reuses the BFS traversal pattern from CallGraphService (KSA-154) but operates at file granularity instead of symbol granularity.

---

## 2. Use Cases

### UC-1: Query Outgoing Dependencies

| Field | Value |
|-------|-------|
| Actor | AI Agent (via MCP) |
| Trigger | Agent calls `code_dependencies` tool |
| Precondition | File has been indexed with import relationships |

**Main Flow:**
1. Agent provides file path and direction="outgoing"
2. Service resolves file path to canonical form
3. BFS traversal: find all `imports` relationships WHERE source file = input
4. For each imported target, resolve to file path
5. If depth > 1, recurse on each resolved file
6. Return results in requested format

**Alternative Flow — File Not Found:**
1. File path doesn't match any indexed file
2. Try fuzzy match (basename, partial path)
3. If found, use matched file
4. If not found, return error with suggestions

### UC-2: Query Incoming Dependencies (Reverse)

**Main Flow:**
1. Agent provides file path and direction="incoming"
2. Service finds all `imports` relationships WHERE target resolves to input file
3. For each importing file, that becomes a result node
4. If depth > 1, find files that import THOSE files (reverse BFS)
5. Return results

### UC-3: Detect Circular Dependencies

**Main Flow:**
1. During BFS traversal, maintain visited set
2. If a file is encountered that's already in the current path -> cycle detected
3. Mark edge as `{ cycle: true }` in output
4. Don't traverse further on that branch
5. Include cycle info in metadata: `{ cycles: [["a.ts", "b.ts", "a.ts"]] }`

---

## 3. Detailed Specifications

### 3.1 MCP Tool Schema

```json
{
  "name": "code_dependencies",
  "description": "Analyze file/module import dependencies with direction and depth control",
  "inputSchema": {
    "type": "object",
    "required": ["file"],
    "properties": {
      "file": {
        "type": "string",
        "description": "File path, module name, or glob pattern"
      },
      "direction": {
        "type": "string",
        "enum": ["incoming", "outgoing", "both"],
        "default": "outgoing"
      },
      "depth": {
        "type": "integer",
        "minimum": 1,
        "maximum": 5,
        "default": 1
      },
      "include_external": {
        "type": "boolean",
        "default": false
      },
      "format": {
        "type": "string",
        "enum": ["tree", "flat", "graph"],
        "default": "tree"
      },
      "limit": {
        "type": "integer",
        "minimum": 1,
        "maximum": 200,
        "default": 50
      }
    }
  }
}
```

### 3.2 File Resolution Logic

Import targets in the relationships table are stored as module paths (e.g., `../database/graph-repository`). Resolution:

1. If target starts with `.` or `..` -> resolve relative to source file
2. If target matches a file in the index (with extension) -> use directly
3. If target is a bare module name -> check if it's a workspace file or external
4. Try extensions: `.ts`, `.js`, `.kt`, `.py`, `/index.ts`, `/index.js`

```typescript
resolveImportTarget(sourceFile: string, importTarget: string): string | null {
  // Relative import
  if (importTarget.startsWith('.')) {
    const dir = path.dirname(sourceFile);
    const resolved = path.resolve(dir, importTarget);
    return this.findFileWithExtensions(resolved);
  }
  
  // Absolute workspace import (e.g., "src/utils/logger")
  const asWorkspace = this.findFileWithExtensions(importTarget);
  if (asWorkspace) return asWorkspace;
  
  // External (node_modules, stdlib)
  return null; // marked as external
}
```

### 3.3 BFS Traversal Algorithm

```typescript
async queryDependencies(file: string, direction: string, depth: number, limit: number): DependencyResult {
  const resolved = this.resolveFile(file);
  const visited = new Set<string>();
  const results: DependencyNode[] = [];
  const cycles: string[][] = [];
  const queue: Array<{ file: string; depth: number; path: string[] }> = [
    { file: resolved, depth: 0, path: [resolved] }
  ];

  visited.add(resolved);

  while (queue.length > 0 && results.length < limit) {
    const { file: current, depth: currentDepth, path: currentPath } = queue.shift()!;
    if (currentDepth >= depth) continue;

    const deps = direction === 'incoming'
      ? this.findImporters(current)
      : this.findImports(current);

    for (const dep of deps) {
      if (currentPath.includes(dep.file)) {
        // Cycle detected
        cycles.push([...currentPath, dep.file]);
        continue;
      }

      if (!visited.has(dep.file)) {
        visited.add(dep.file);
        results.push({ file: dep.file, depth: currentDepth + 1, symbols: dep.symbols });
        queue.push({ file: dep.file, depth: currentDepth + 1, path: [...currentPath, dep.file] });
      }
    }
  }

  return { root: resolved, results, cycles, metadata: { totalNodes: results.length, maxDepthReached: depth } };
}
```

### 3.4 SQL Queries

**Find outgoing (what does file X import):**
```sql
SELECT DISTINCT r.target_symbol, r.metadata
FROM relationships r
WHERE r.file_path = ? AND r.kind = 'imports'
ORDER BY r.line
```

**Find incoming (who imports file X):**
```sql
SELECT DISTINCT r.file_path, r.target_symbol, r.metadata
FROM relationships r
WHERE r.kind = 'imports'
  AND (r.target_symbol LIKE ? OR r.target_symbol LIKE ?)
ORDER BY r.file_path
```

### 3.5 External Detection

A dependency is "external" if:
- Import target doesn't resolve to any indexed file
- Import target starts with a known stdlib module (node: `fs`, `path`, `http`; python: `os`, `sys`, `json`)
- Import target resolves to `node_modules/` path

### 3.6 Output Format Transformations

All formats are derived from the same BFS result. The service computes once, then formats:

- **tree**: Recursive object nesting by depth
- **flat**: Array sorted by depth, then alphabetically
- **graph**: Deduplicated nodes + edges arrays

---

## 4. Error Handling

| Scenario | Response |
|----------|----------|
| File not indexed | `{ error: "File not found in index", suggestions: [...] }` |
| No import relationships | `{ results: [], metadata: { note: "No imports found" } }` |
| All deps are external | `{ results: [], metadata: { note: "All dependencies are external", externalCount: N } }` |
| Timeout (>2s) | Return partial results with `truncated: true` |

---

## 5. Integration Points

| Component | Interface | Direction |
|-----------|-----------|-----------|
| GraphRepository (KSA-153) | SQL queries on relationships table | Read |
| SymbolResolver (KSA-154) | File path resolution | Reuse |
| ImpactAnalysis (KSA-156) | Uses dependency graph for blast radius | Downstream |
| AI Context (KSA-159) | Uses deps to gather related files | Downstream |

---

## 6. Test Scenarios

| # | Scenario | Expected |
|---|----------|----------|
| T-1 | Outgoing depth 1 | Direct imports listed |
| T-2 | Outgoing depth 2 | Transitive imports included |
| T-3 | Incoming depth 1 | Direct importers listed |
| T-4 | Circular dependency | Cycle detected, no infinite loop |
| T-5 | External excluded | node_modules imports filtered |
| T-6 | External included | All imports shown |
| T-7 | File not found | Error with suggestions |
| T-8 | Tree format | Nested object structure |
| T-9 | Graph format | Nodes + edges arrays |
| T-10 | Both direction | Union of incoming + outgoing |
