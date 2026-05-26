# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-155: [Graph] Dependency Graph

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-155 |
| Title | [Graph] Dependency Graph - imports with direction & depth |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-29 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-155.docx |
| Related TDD | TDD-v1-KSA-154.docx (Call Graph - BFS pattern) |

---

## 1. Architecture Overview

```
MCP Server
    |
    +-- registerTool("code_dependencies", handler)
            |
            v
    DependencyGraphService
        +-- resolveFile(input) --> canonical path
        +-- queryOutgoing(file, depth) --> BFS on imports
        +-- queryIncoming(file, depth) --> reverse BFS
        +-- formatResult(raw, format) --> tree/flat/graph
            |
            v
    GraphRepository (KSA-153)
        +-- findImportsByFile(filePath)
        +-- findImportersOf(targetPattern)
    
    FileResolver (new)
        +-- resolveImportTarget(source, target) --> filePath | null
        +-- isExternal(target) --> boolean
```

---

## 2. Detailed Design

### 2.1 Module: DependencyGraphService

**File:** `src/graph/dependency-graph-service.ts`

```typescript
import { GraphRepository } from '../database/graph-repository';
import { FileResolver } from './file-resolver';

interface DependencyNode {
  file: string;
  depth: number;
  importedSymbols: string[];
  isExternal: boolean;
}

interface DependencyResult {
  root: string;
  direction: string;
  results: DependencyNode[];
  cycles: string[][];
  metadata: {
    totalNodes: number;
    maxDepthReached: number;
    truncated: boolean;
    queryTimeMs: number;
    externalCount: number;
  };
}

export class DependencyGraphService {
  private graphRepo: GraphRepository;
  private fileResolver: FileResolver;

  constructor(graphRepo: GraphRepository, fileResolver: FileResolver) {
    this.graphRepo = graphRepo;
    this.fileResolver = fileResolver;
  }

  async query(
    file: string,
    direction: 'incoming' | 'outgoing' | 'both' = 'outgoing',
    depth: number = 1,
    includeExternal: boolean = false,
    limit: number = 50
  ): Promise<DependencyResult> {
    const startTime = Date.now();
    const clampedDepth = Math.min(Math.max(depth, 1), 5);
    
    const resolved = this.fileResolver.resolveFile(file);
    if (!resolved) {
      return this.fileNotFoundResponse(file);
    }

    let results: DependencyNode[];
    let cycles: string[][];

    if (direction === 'both') {
      const outgoing = this.bfsTraversal(resolved, 'outgoing', clampedDepth, includeExternal, limit);
      const incoming = this.bfsTraversal(resolved, 'incoming', clampedDepth, includeExternal, limit);
      results = this.mergeResults(outgoing.results, incoming.results);
      cycles = [...outgoing.cycles, ...incoming.cycles];
    } else {
      const traversal = this.bfsTraversal(resolved, direction, clampedDepth, includeExternal, limit);
      results = traversal.results;
      cycles = traversal.cycles;
    }

    return {
      root: resolved,
      direction,
      results,
      cycles,
      metadata: {
        totalNodes: results.length,
        maxDepthReached: clampedDepth,
        truncated: results.length >= limit,
        queryTimeMs: Date.now() - startTime,
        externalCount: results.filter(r => r.isExternal).length
      }
    };
  }

  private bfsTraversal(
    root: string,
    direction: 'incoming' | 'outgoing',
    maxDepth: number,
    includeExternal: boolean,
    limit: number
  ): { results: DependencyNode[]; cycles: string[][] } {
    const visited = new Set<string>([root]);
    const results: DependencyNode[] = [];
    const cycles: string[][] = [];
    const queue: Array<{ file: string; depth: number; path: string[] }> = [
      { file: root, depth: 0, path: [root] }
    ];

    while (queue.length > 0 && results.length < limit) {
      const { file: current, depth: currentDepth, path } = queue.shift()!;
      if (currentDepth >= maxDepth) continue;

      const deps = direction === 'outgoing'
        ? this.getOutgoingDeps(current)
        : this.getIncomingDeps(current);

      for (const dep of deps) {
        const isExternal = this.fileResolver.isExternal(dep.target);
        
        // Skip external if not requested
        if (isExternal && !includeExternal) continue;

        const resolvedTarget = isExternal
          ? dep.target
          : this.fileResolver.resolveImportTarget(current, dep.target);

        if (!resolvedTarget) continue;

        // Cycle detection
        if (path.includes(resolvedTarget)) {
          cycles.push([...path, resolvedTarget]);
          continue;
        }

        if (!visited.has(resolvedTarget)) {
          visited.add(resolvedTarget);
          results.push({
            file: resolvedTarget,
            depth: currentDepth + 1,
            importedSymbols: dep.symbols,
            isExternal
          });

          if (!isExternal && currentDepth + 1 < maxDepth) {
            queue.push({
              file: resolvedTarget,
              depth: currentDepth + 1,
              path: [...path, resolvedTarget]
            });
          }
        }
      }
    }

    return { results, cycles };
  }

  private getOutgoingDeps(filePath: string): Array<{ target: string; symbols: string[] }> {
    const rows = this.graphRepo.db.prepare(`
      SELECT target_symbol, metadata
      FROM relationships
      WHERE file_path = ? AND kind = 'imports'
      ORDER BY line
    `).all(filePath);

    // Group by module
    const grouped = new Map<string, string[]>();
    for (const row of rows) {
      const module = this.extractModule(row.target_symbol);
      if (!grouped.has(module)) grouped.set(module, []);
      const symbol = this.extractSymbolName(row.target_symbol);
      if (symbol) grouped.get(module)!.push(symbol);
    }

    return Array.from(grouped.entries()).map(([target, symbols]) => ({ target, symbols }));
  }

  private getIncomingDeps(filePath: string): Array<{ target: string; symbols: string[] }> {
    const basename = path.basename(filePath, path.extname(filePath));
    const rows = this.graphRepo.db.prepare(`
      SELECT DISTINCT file_path, target_symbol
      FROM relationships
      WHERE kind = 'imports'
        AND (target_symbol LIKE ? OR target_symbol LIKE ? OR target_symbol LIKE ?)
    `).all(`%/${basename}`, `%${basename}%`, filePath);

    const grouped = new Map<string, string[]>();
    for (const row of rows) {
      if (!grouped.has(row.file_path)) grouped.set(row.file_path, []);
      grouped.get(row.file_path)!.push(this.extractSymbolName(row.target_symbol) || '*');
    }

    return Array.from(grouped.entries()).map(([target, symbols]) => ({ target, symbols }));
  }
}
```

### 2.2 Module: FileResolver

**File:** `src/graph/file-resolver.ts`

```typescript
export class FileResolver {
  private indexedFiles: Set<string>;  // All files in the index
  private workspaceRoot: string;
  
  private readonly EXTENSIONS = ['.ts', '.js', '.kt', '.py', '/index.ts', '/index.js'];
  private readonly STDLIB_MODULES = new Set([
    // Node.js
    'fs', 'path', 'http', 'https', 'url', 'crypto', 'os', 'util', 'stream', 'events',
    'child_process', 'cluster', 'net', 'dns', 'tls', 'readline', 'zlib',
    // Python
    'os', 'sys', 'json', 're', 'math', 'datetime', 'collections', 'itertools',
    'functools', 'typing', 'pathlib', 'abc', 'dataclasses', 'enum', 'logging'
  ]);

  resolveFile(input: string): string | null {
    // Exact match
    if (this.indexedFiles.has(input)) return input;
    
    // Try with workspace root prefix
    const withRoot = path.join(this.workspaceRoot, input);
    if (this.indexedFiles.has(withRoot)) return withRoot;
    
    // Fuzzy: find by basename
    const basename = path.basename(input);
    const matches = [...this.indexedFiles].filter(f => f.endsWith(basename));
    if (matches.length === 1) return matches[0];
    
    return null;
  }

  resolveImportTarget(sourceFile: string, target: string): string | null {
    if (target.startsWith('.')) {
      const dir = path.dirname(sourceFile);
      const base = path.resolve(dir, target);
      return this.findWithExtensions(base);
    }
    
    // Try as workspace-relative
    return this.findWithExtensions(path.join(this.workspaceRoot, target));
  }

  isExternal(target: string): boolean {
    if (this.STDLIB_MODULES.has(target.split('/')[0].split('.')[0])) return true;
    if (!target.startsWith('.') && !target.startsWith('/')) {
      // Bare specifier — likely node_modules
      const resolved = this.resolveImportTarget('', target);
      return resolved === null;
    }
    return false;
  }

  private findWithExtensions(basePath: string): string | null {
    for (const ext of this.EXTENSIONS) {
      const candidate = basePath + ext;
      if (this.indexedFiles.has(candidate)) return candidate;
    }
    return null;
  }
}
```

### 2.3 Module: Format Transformers

**File:** `src/graph/dependency-formatters.ts`

```typescript
export function toTreeFormat(root: string, results: DependencyNode[]): object {
  const tree: Record<string, any> = {};
  const byDepth = new Map<number, DependencyNode[]>();
  
  for (const node of results) {
    if (!byDepth.has(node.depth)) byDepth.set(node.depth, []);
    byDepth.get(node.depth)!.push(node);
  }
  
  // Build tree recursively (simplified — actual impl uses parent tracking)
  // ...
  return { root, tree };
}

export function toFlatFormat(root: string, results: DependencyNode[]): object {
  return {
    root,
    dependencies: results.map(r => ({
      file: r.file,
      depth: r.depth,
      importedSymbols: r.importedSymbols,
      isExternal: r.isExternal
    }))
  };
}

export function toGraphFormat(root: string, results: DependencyNode[], edges: Edge[]): object {
  const nodes = [
    { id: root, label: path.basename(root), depth: 0 },
    ...results.map(r => ({ id: r.file, label: path.basename(r.file), depth: r.depth }))
  ];
  return { nodes, edges };
}
```

### 2.4 MCP Tool Registration

**File:** `src/tools/dependency-tools.ts`

```typescript
export function registerDependencyTools(server: McpServer, service: DependencyGraphService): void {
  server.tool('code_dependencies', {
    description: 'Analyze file/module import dependencies with direction and depth control',
    inputSchema: { /* as defined in FSD */ }
  }, async (params) => {
    const result = await service.query(
      params.file,
      params.direction,
      params.depth,
      params.include_external,
      params.limit
    );
    
    // Format output
    const formatted = formatResult(result, params.format || 'tree');
    return { content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }] };
  });
}
```

---

## 3. File Structure

```
src/graph/
├── dependency-graph-service.ts   # Core BFS logic
├── file-resolver.ts              # Import path resolution
├── dependency-formatters.ts      # tree/flat/graph formatters

src/tools/
└── dependency-tools.ts           # MCP tool registration

tests/graph/
├── dependency-graph.test.ts      # Unit tests
├── file-resolver.test.ts         # Resolution tests
└── fixtures/
    ├── project-a/                # Test project with known deps
    └── circular-deps/            # Cycle detection tests
```

---

## 4. Implementation Checklist

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | FileResolver | src/graph/file-resolver.ts | 2h |
| 2 | DependencyGraphService (BFS) | src/graph/dependency-graph-service.ts | 3h |
| 3 | Format transformers | src/graph/dependency-formatters.ts | 1.5h |
| 4 | MCP tool registration | src/tools/dependency-tools.ts | 1h |
| 5 | Cycle detection logic | dependency-graph-service.ts | 1h |
| 6 | Unit tests (FileResolver) | tests/graph/file-resolver.test.ts | 1.5h |
| 7 | Unit tests (BFS traversal) | tests/graph/dependency-graph.test.ts | 2h |
| 8 | Integration tests | tests/tools/dependency-tools.test.ts | 1.5h |
| 9 | Test fixtures (project structure) | tests/graph/fixtures/ | 1h |

**Total estimated effort:** ~15 hours (2 days)

---

## 5. Performance Design

| Query | Index Used | Expected Time |
|-------|-----------|---------------|
| Outgoing depth 1 | idx_rel_file + kind | < 20ms |
| Outgoing depth 3 | Same, 3 iterations | < 100ms |
| Incoming depth 1 | idx_rel_target_kind | < 50ms (LIKE query) |
| Incoming depth 3 | Same, 3 iterations | < 200ms |

**Optimization:** Cache file resolution results within a single query (same import target resolved once).

---

## 6. Error Handling

| Error | Response |
|-------|----------|
| File not in index | Error with fuzzy suggestions |
| No imports found | Empty results with note |
| Timeout (>2s) | Partial results, truncated=true |
| Resolution ambiguity | Return all matches, let caller disambiguate |

---

## 7. Dependencies

| Ticket | What's Used |
|--------|------------|
| KSA-153 | relationships table, GraphRepository |
| KSA-154 | BFS pattern reference, SymbolResolver |
| KSA-145/146/147/148 | Import relationships populated by parsers |
