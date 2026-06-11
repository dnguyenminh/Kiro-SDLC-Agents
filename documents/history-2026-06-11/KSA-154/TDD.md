# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-154: [Graph] Call Graph Tools

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-154 |
| Title | [Graph] Call Graph - callers/callees with transitive depth |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-28 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-154.docx |

---

## 1. Architecture Overview

### 1.1 Tool Registration Flow

```
MCP Server
    │
    ├── registerTool("code_callers", handler)
    └── registerTool("code_callees", handler)
            │
            ▼
    CallGraphService
        ├── resolveSymbol(name) → symbol IDs
        ├── findCallers(id, depth) → BFS traversal
        └── findCallees(id, depth) → BFS traversal
            │
            ▼
    GraphRepository (KSA-153)
        └── SQL queries on relationships table
```

---

## 2. Detailed Design

### 2.1 Module: CallGraphService

**File:** `src/graph/call-graph-service.ts`

```typescript
import { GraphRepository } from '../database/graph-repository';
import { SymbolResolver } from './symbol-resolver';

interface CallerResult {
  symbol: string;
  qualifiedName: string;
  kind: string;
  filePath: string;
  definitionLine: number;
  callSiteLine: number;
  depthLevel: number;
  parameters?: string;
  isAsync?: boolean;
}

interface CallGraphResponse {
  symbol: string;
  resolvedTo: Array<{ id: number; file: string; line: number; kind: string }>;
  results: CallerResult[];
  metadata: {
    totalCount: number;
    depthSearched: number;
    truncated: boolean;
    queryTimeMs: number;
  };
}

export class CallGraphService {
  private graphRepo: GraphRepository;
  private symbolResolver: SymbolResolver;

  constructor(graphRepo: GraphRepository, symbolResolver: SymbolResolver) {
    this.graphRepo = graphRepo;
    this.symbolResolver = symbolResolver;
  }

  async findCallers(
    symbolName: string,
    depth: number = 1,
    limit: number = 20,
    fileFilter?: string,
    kindFilter: string = 'calls'
  ): Promise<CallGraphResponse> {
    const startTime = Date.now();
    const clampedDepth = Math.min(Math.max(depth, 1), 5);
    
    // 1. Resolve symbol
    const resolved = this.symbolResolver.resolve(symbolName);
    if (resolved.length === 0) {
      return this.symbolNotFoundResponse(symbolName);
    }
    
    // 2. BFS traversal
    const results: CallerResult[] = [];
    const visited = new Set<number>();
    const queue: Array<{ symbolName: string; symbolId?: number; depth: number }> = [];
    
    // Seed queue with resolved symbols
    for (const sym of resolved) {
      queue.push({ symbolName: sym.name, symbolId: sym.id, depth: 0 });
    }
    
    while (queue.length > 0 && results.length < limit) {
      const { symbolName: current, depth: currentDepth } = queue.shift()!;
      
      if (currentDepth >= clampedDepth) continue;
      
      const callers = this.graphRepo.findCallers(current, kindFilter, limit - results.length);
      
      for (const caller of callers) {
        if (visited.has(caller.id)) continue; // Cycle detection
        visited.add(caller.id);
        
        const result: CallerResult = {
          symbol: caller.name,
          qualifiedName: caller.parentName ? `${caller.parentName}.${caller.name}` : caller.name,
          kind: caller.kind,
          filePath: caller.filePath,
          definitionLine: caller.defLine,
          callSiteLine: caller.callLine,
          depthLevel: currentDepth + 1,
          parameters: caller.parameters,
          isAsync: caller.isAsync === 1
        };
        
        // Apply file filter
        if (fileFilter && !this.matchGlob(result.filePath, fileFilter)) continue;
        
        results.push(result);
        
        // Enqueue for next depth level
        if (currentDepth + 1 < clampedDepth) {
          queue.push({ symbolName: caller.name, symbolId: caller.id, depth: currentDepth + 1 });
        }
      }
    }
    
    return {
      symbol: symbolName,
      resolvedTo: resolved.map(s => ({ id: s.id, file: s.filePath, line: s.line, kind: s.kind })),
      results,
      metadata: {
        totalCount: results.length,
        depthSearched: clampedDepth,
        truncated: results.length >= limit,
        queryTimeMs: Date.now() - startTime
      }
    };
  }

  async findCallees(
    symbolName: string,
    depth: number = 1,
    limit: number = 20,
    fileFilter?: string,
    includeExternal: boolean = true
  ): Promise<CallGraphResponse> {
    const startTime = Date.now();
    const clampedDepth = Math.min(Math.max(depth, 1), 5);
    
    const resolved = this.symbolResolver.resolve(symbolName);
    if (resolved.length === 0) {
      return this.symbolNotFoundResponse(symbolName);
    }
    
    const results: CallerResult[] = [];
    const visited = new Set<string>();
    const queue: Array<{ symbolId: number; depth: number }> = [];
    
    for (const sym of resolved) {
      queue.push({ symbolId: sym.id, depth: 0 });
    }
    
    while (queue.length > 0 && results.length < limit) {
      const { symbolId, depth: currentDepth } = queue.shift()!;
      
      if (currentDepth >= clampedDepth) continue;
      
      const callees = this.graphRepo.findCallees(symbolId, 'calls', limit - results.length);
      
      for (const callee of callees) {
        const key = `${callee.name}:${callee.callLine}`;
        if (visited.has(key)) continue;
        visited.add(key);
        
        // Skip external if not requested
        if (!includeExternal && !callee.filePath) continue;
        
        results.push({
          symbol: callee.name,
          qualifiedName: callee.name,
          kind: callee.kind || 'unknown',
          filePath: callee.filePath || '(external)',
          definitionLine: callee.defLine || 0,
          callSiteLine: callee.callLine,
          depthLevel: currentDepth + 1,
        });
        
        // Enqueue for transitive (only if resolved)
        if (callee.targetSymbolId && currentDepth + 1 < clampedDepth) {
          queue.push({ symbolId: callee.targetSymbolId, depth: currentDepth + 1 });
        }
      }
    }
    
    return {
      symbol: symbolName,
      resolvedTo: resolved.map(s => ({ id: s.id, file: s.filePath, line: s.line, kind: s.kind })),
      results,
      metadata: {
        totalCount: results.length,
        depthSearched: clampedDepth,
        truncated: results.length >= limit,
        queryTimeMs: Date.now() - startTime
      }
    };
  }
}
```

### 2.2 Module: SymbolResolver

**File:** `src/graph/symbol-resolver.ts`

```typescript
export class SymbolResolver {
  private db: Database;

  resolve(input: string): ResolvedSymbol[] {
    // Try exact match first
    let results = this.db.prepare(
      'SELECT id, name, kind, file_path, line FROM symbols WHERE name = ?'
    ).all(input);
    
    if (results.length > 0) return results;
    
    // Try qualified name (Class.method)
    if (input.includes('.')) {
      const [parent, method] = input.split('.');
      results = this.db.prepare(`
        SELECT s.id, s.name, s.kind, s.file_path, s.line
        FROM symbols s
        JOIN symbols p ON p.id = s.parent_symbol_id
        WHERE s.name = ? AND p.name = ?
      `).all(method, parent);
      
      if (results.length > 0) return results;
    }
    
    // Try file:symbol format
    if (input.includes(':')) {
      const [file, name] = input.split(':');
      results = this.db.prepare(
        'SELECT id, name, kind, file_path, line FROM symbols WHERE name = ? AND file_path LIKE ?'
      ).all(name, `%${file}`);
      
      if (results.length > 0) return results;
    }
    
    return [];
  }

  suggest(input: string, limit: number = 5): string[] {
    return this.db.prepare(
      'SELECT DISTINCT name FROM symbols WHERE name LIKE ? LIMIT ?'
    ).all(`%${input}%`, limit).map(r => r.name);
  }
}
```

### 2.3 Module: MCP Tool Handlers

**File:** `src/tools/call-graph-tools.ts`

```typescript
export function registerCallGraphTools(server: McpServer, service: CallGraphService): void {
  server.tool('code_callers', {
    description: 'Find all callers of a function/method with transitive depth control',
    inputSchema: { /* as defined in FSD */ }
  }, async (params) => {
    const result = await service.findCallers(
      params.symbol,
      params.depth,
      params.limit,
      params.file_filter,
      params.kind_filter
    );
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  server.tool('code_callees', {
    description: 'Find all functions called by a given symbol',
    inputSchema: { /* as defined in FSD */ }
  }, async (params) => {
    const result = await service.findCallees(
      params.symbol,
      params.depth,
      params.limit,
      params.file_filter,
      params.include_external
    );
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });
}
```

---

## 3. Implementation Checklist

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | SymbolResolver | src/graph/symbol-resolver.ts | 2h |
| 2 | CallGraphService | src/graph/call-graph-service.ts | 4h |
| 3 | MCP tool registration | src/tools/call-graph-tools.ts | 1.5h |
| 4 | Glob matching utility | src/utils/glob.ts | 0.5h |
| 5 | Unit tests (resolver) | tests/graph/symbol-resolver.test.ts | 1.5h |
| 6 | Unit tests (BFS traversal) | tests/graph/call-graph.test.ts | 3h |
| 7 | Integration tests (MCP tools) | tests/tools/call-graph-tools.test.ts | 2h |
| 8 | Performance tests | tests/benchmarks/call-graph-perf.ts | 1h |

**Total estimated effort:** ~16 hours (2 days)

---

## 4. Performance Design

### 4.1 BFS Optimization

- Use prepared statements (cached, not re-compiled per query)
- Limit BFS queue size to prevent memory issues
- Early termination when limit reached
- Visited set uses integer IDs (fast hash)

### 4.2 Expected Performance

| Scenario | Depth | Expected Time |
|----------|-------|---------------|
| Simple function, few callers | 1 | <20ms |
| Popular utility function (50+ callers) | 1 | <50ms |
| Transitive (moderate graph) | 2 | <100ms |
| Deep transitive (large codebase) | 3 | <300ms |
| Maximum depth | 5 | <1000ms |

---

## 5. Error Handling

| Error | Response |
|-------|----------|
| Symbol not found | `{ error: "Symbol not found", suggestions: [...] }` |
| Empty graph | `{ results: [], metadata: { note: "No relationships indexed" } }` |
| Timeout (>2s) | Return partial results with `truncated: true` |
| DB error | `{ error: "Database error", details: "..." }` |
