# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-157: [Graph] Graph Traversal API

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-157 |
| Title | [Graph] Graph Traversal API - custom edge/node filters |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-06-01 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-157.docx |

---

## 1. Architecture Overview

### 1.1 Component Placement

```
src/
  tools/
    code-traverse.ts     ← MCP tool handler
  graph/
    traverser.ts         ← BFS/DFS engine
    node-resolver.ts     ← Symbol name → node ID resolution
    edge-filter.ts       ← Edge type filtering
    node-filter.ts       ← Node type filtering
    result-formatter.ts  ← Output formatting + source snippets
    __tests__/
      traverser.test.ts
      code-traverse.test.ts
```

### 1.2 Class Design

```typescript
// MCP Tool Handler
class CodeTraverseTool implements IMCPTool {
  name = "code_traverse";
  
  private resolver: NodeResolver;
  private traverser: GraphTraverser;
  private formatter: ResultFormatter;
  
  async execute(params: TraverseParams): Promise<TraverseResponse> {
    // 1. Resolve start node
    const startNode = await this.resolver.resolve(params.start);
    if (!startNode) throw new ToolError(`Symbol not found: ${params.start}`);
    
    // 2. Build filter config
    const config: TraverseConfig = {
      edgeTypes: params.edge_types || [],
      nodeTypes: params.node_types || [],
      direction: params.direction || 'outgoing',
      maxDepth: params.max_depth || 3,
      maxResults: params.max_results || 50
    };
    
    // 3. Traverse
    const results = await this.traverser.traverse(startNode, config);
    
    // 4. Format response
    return this.formatter.format(startNode, results, {
      includeSource: params.include_source || false,
      sourceLines: params.source_lines || 5
    });
  }
}
```

---

## 2. Detailed Design

### 2.1 Node Resolution

```typescript
class NodeResolver {
  constructor(private db: Database) {}
  
  async resolve(identifier: string): Promise<GraphNode | null> {
    // Strategy 1: Exact name match
    let results = await this.db.query(
      `SELECT id, name, kind, file_path, start_line FROM symbols WHERE name = ?`,
      [identifier]
    );
    
    if (results.length === 1) return results[0];
    
    // Strategy 2: Qualified name (Class.method)
    if (identifier.includes('.')) {
      const [parent, member] = identifier.split('.');
      results = await this.db.query(
        `SELECT s.* FROM symbols s 
         JOIN symbols p ON s.parent_symbol_id = p.id 
         WHERE s.name = ? AND p.name = ?`,
        [member, parent]
      );
      if (results.length === 1) return results[0];
    }
    
    // Strategy 3: FTS5 fuzzy search (for suggestions)
    if (results.length === 0) {
      results = await this.db.query(
        `SELECT id, name, kind, file_path FROM symbols_fts WHERE symbols_fts MATCH ? LIMIT 5`,
        [identifier]
      );
      if (results.length > 0) {
        throw new AmbiguousError(
          `Symbol "${identifier}" not found. Did you mean: ${results.map(r => r.name).join(', ')}?`
        );
      }
    }
    
    // Strategy 4: Multiple matches → ambiguous
    if (results.length > 1) {
      throw new AmbiguousError(
        `Ambiguous: ${results.map(r => `${r.file_path}:${r.name}`).join(', ')}. Please qualify.`
      );
    }
    
    return null;
  }
}
```

### 2.2 BFS Traversal Engine

```typescript
class GraphTraverser {
  constructor(private db: Database) {}
  
  async traverse(startNode: GraphNode, config: TraverseConfig): Promise<TraverseResult[]> {
    const visited = new Set<number>();
    const queue: Array<{ node: GraphNode; depth: number; path: string[] }> = [
      { node: startNode, depth: 0, path: [startNode.name] }
    ];
    const results: TraverseResult[] = [];
    
    while (queue.length > 0 && results.length < config.maxResults) {
      const { node, depth, path } = queue.shift()!;
      
      if (visited.has(node.id)) continue;
      visited.add(node.id);
      
      // Add to results (skip start node)
      if (depth > 0) {
        if (config.nodeTypes.length === 0 || config.nodeTypes.includes(node.kind)) {
          results.push({
            node,
            depth,
            path,
            edge_type: node._incomingEdgeType // set during neighbor fetch
          });
        }
      }
      
      // Expand neighbors if within depth limit
      if (depth < config.maxDepth) {
        const neighbors = await this.getNeighbors(node.id, config);
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor.id)) {
            queue.push({
              node: neighbor,
              depth: depth + 1,
              path: [...path, neighbor.name]
            });
          }
        }
      }
    }
    
    // Sort: depth ASC, then by connectivity (more edges = more important)
    return results.sort((a, b) => a.depth - b.depth);
  }
  
  private async getNeighbors(nodeId: number, config: TraverseConfig): Promise<GraphNode[]> {
    const edgeFilter = config.edgeTypes.length > 0
      ? `AND r.edge_type IN (${config.edgeTypes.map(e => `'${e}'`).join(',')})`
      : '';
    
    let query = '';
    switch (config.direction) {
      case 'outgoing':
        query = `
          SELECT s.*, r.edge_type as _incomingEdgeType
          FROM relationships r JOIN symbols s ON r.target_symbol_id = s.id
          WHERE r.source_symbol_id = ? ${edgeFilter}
          LIMIT 100`;
        break;
      case 'incoming':
        query = `
          SELECT s.*, r.edge_type as _incomingEdgeType
          FROM relationships r JOIN symbols s ON r.source_symbol_id = s.id
          WHERE r.target_symbol_id = ? ${edgeFilter}
          LIMIT 100`;
        break;
      case 'both':
        query = `
          SELECT s.*, r.edge_type as _incomingEdgeType FROM relationships r 
          JOIN symbols s ON r.target_symbol_id = s.id
          WHERE r.source_symbol_id = ? ${edgeFilter}
          UNION
          SELECT s.*, r.edge_type as _incomingEdgeType FROM relationships r 
          JOIN symbols s ON r.source_symbol_id = s.id
          WHERE r.target_symbol_id = ? ${edgeFilter}
          LIMIT 100`;
        break;
    }
    
    return await this.db.query(query, config.direction === 'both' ? [nodeId, nodeId] : [nodeId]);
  }
}
```

### 2.3 Result Formatting

```typescript
class ResultFormatter {
  async format(startNode: GraphNode, results: TraverseResult[], options: FormatOptions): Promise<TraverseResponse> {
    const formattedResults = [];
    
    for (const result of results) {
      const formatted: any = {
        name: result.node.name,
        kind: result.node.kind,
        file: result.node.file_path,
        line: result.node.start_line,
        depth: result.depth,
        edge_type: result.edge_type
      };
      
      if (options.includeSource) {
        formatted.source = await this.getSourceSnippet(
          result.node.file_path, 
          result.node.start_line, 
          options.sourceLines
        );
      }
      
      formattedResults.push(formatted);
    }
    
    return {
      start: { name: startNode.name, kind: startNode.kind, file: startNode.file_path, line: startNode.start_line },
      results: formattedResults,
      metadata: {
        total_traversed: results.length,
        total_results: formattedResults.length,
        max_depth_reached: Math.max(...results.map(r => r.depth), 0),
        truncated: results.length >= options.maxResults,
        execution_time_ms: 0 // filled by caller
      }
    };
  }
}
```

---

## 3. Database Indexes

Required indexes for performance:

```sql
-- Already exist from KSA-153:
CREATE INDEX idx_rel_source ON relationships(source_symbol_id, edge_type);
CREATE INDEX idx_rel_target ON relationships(target_symbol_id, edge_type);

-- Additional for traversal:
CREATE INDEX idx_rel_source_target ON relationships(source_symbol_id, target_symbol_id);
CREATE INDEX idx_symbols_name ON symbols(name);
CREATE INDEX idx_symbols_parent ON symbols(parent_symbol_id);
```

---

## 4. Performance Optimization

| Technique | Description |
|-----------|-------------|
| Batch edge fetch | Fetch all edges for current BFS level in one query |
| Result limit per node | Max 100 edges per node (prevent fan-out explosion) |
| Early termination | Stop when `max_results` reached |
| Connection pooling | Reuse SQLite connection |
| Prepared statements | Pre-compile edge queries |

---

## 5. Error Handling

```typescript
class ToolError extends Error {
  constructor(message: string, public code: string = 'TRAVERSE_ERROR') {
    super(message);
  }
}

class AmbiguousError extends ToolError {
  constructor(message: string, public suggestions: string[] = []) {
    super(message, 'AMBIGUOUS_SYMBOL');
  }
}

// Timeout handling
const TRAVERSE_TIMEOUT = 5000; // 5 seconds max
```

---

## 6. Implementation Checklist

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | Create NodeResolver | `src/graph/node-resolver.ts` | 2h |
| 2 | Create GraphTraverser (BFS) | `src/graph/traverser.ts` | 4h |
| 3 | Create EdgeFilter | `src/graph/edge-filter.ts` | 1h |
| 4 | Create NodeFilter | `src/graph/node-filter.ts` | 1h |
| 5 | Create ResultFormatter | `src/graph/result-formatter.ts` | 2h |
| 6 | Create code_traverse MCP tool | `src/tools/code-traverse.ts` | 2h |
| 7 | Add database indexes | migration | 0.5h |
| 8 | Write unit tests (traverser) | `src/graph/__tests__/` | 3h |
| 9 | Write integration tests (tool) | `src/tools/__tests__/` | 3h |
| 10 | Performance benchmarks | `src/graph/__tests__/` | 2h |

**Total estimated effort:** ~2.5 days
