# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-157: [Graph] Graph Traversal API

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-157 |
| Title | [Graph] Graph Traversal API - custom edge/node filters |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-06-01 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-157.docx |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the `code_traverse` MCP tool that provides flexible graph traversal with edge/node type filtering, direction control, and depth limiting. It is the general-purpose graph query interface used by higher-level AI context tools.

### 1.2 Scope

- MCP tool `code_traverse` implementation
- BFS/DFS traversal with configurable parameters
- Edge type filtering (Calls, Imports, Inherits, Implements, Contains, Uses, Annotated)
- Node type filtering (Function, Class, Interface, Module, File, Enum, Type, Variable)
- Direction control (outgoing, incoming, both)
- Depth and result count limiting
- Optional source snippet inclusion

---

## 2. System Overview

### 2.1 Architecture

```
code_traverse (MCP Tool)
    │
    ├── InputValidator (validate params, resolve start node)
    ├── GraphTraverser (BFS engine with filters)
    │     ├── EdgeFilter (type-based edge selection)
    │     ├── NodeFilter (type-based result filtering)
    │     ├── CycleDetector (visited set)
    │     └── DepthLimiter (max hops)
    ├── ResultFormatter (structure output, add snippets)
    └── TokenEstimator (budget management)
```

### 2.2 Data Flow

```
Request → Validate → Resolve Start Node → BFS Traverse → Filter Results → Format → Response
```

---

## 3. Functional Requirements

### 3.1 Feature: MCP Tool Interface

#### 3.1.1 Tool Registration

```json
{
  "name": "code_traverse",
  "description": "Traverse code graph with custom edge/node filters. Explore call chains, import trees, inheritance hierarchies.",
  "inputSchema": {
    "type": "object",
    "required": ["start"],
    "properties": {
      "start": {
        "type": "string",
        "description": "Symbol name or ID to start traversal from"
      },
      "edge_types": {
        "type": "array",
        "items": { "type": "string", "enum": ["Calls", "Imports", "Inherits", "Implements", "Contains", "Uses", "Annotated"] },
        "description": "Edge types to follow (empty = all)"
      },
      "node_types": {
        "type": "array",
        "items": { "type": "string", "enum": ["Function", "Class", "Interface", "Module", "File", "Enum", "Type", "Variable"] },
        "description": "Node types to include in results (empty = all)"
      },
      "direction": {
        "type": "string",
        "enum": ["outgoing", "incoming", "both"],
        "default": "outgoing"
      },
      "max_depth": {
        "type": "integer",
        "minimum": 1,
        "maximum": 10,
        "default": 3
      },
      "max_results": {
        "type": "integer",
        "minimum": 1,
        "maximum": 200,
        "default": 50
      },
      "include_source": {
        "type": "boolean",
        "default": false
      },
      "source_lines": {
        "type": "integer",
        "default": 5,
        "description": "Lines of source to include per result"
      }
    }
  }
}
```

### 3.2 Feature: Start Node Resolution

#### 3.2.1 Use Case: UC-01 — Resolve by Name

**Main Flow:**
1. Search symbols table for exact name match
2. If multiple matches: prefer by specificity (Class.method > method)
3. If no exact match: try FTS5 search
4. If still no match: return error with suggestions

**Ambiguity Resolution:**
- `"processOrder"` → if unique, use it
- `"processOrder"` → if multiple (in different classes), return error: "Ambiguous: OrderService.processOrder, PaymentService.processOrder. Please specify."
- `"OrderService.processOrder"` → qualified name, resolve directly

### 3.3 Feature: BFS Traversal Engine

#### 3.3.1 Algorithm

```pseudocode
function traverse(startNode, edgeTypes, nodeTypes, direction, maxDepth, maxResults):
  visited = Set()
  queue = [(startNode, 0)]  // (node, depth)
  results = []
  
  while queue is not empty AND results.length < maxResults:
    (current, depth) = queue.dequeue()
    
    if current in visited: continue
    visited.add(current)
    
    if depth > 0:  // don't include start node in results
      if nodeTypes is empty OR current.kind in nodeTypes:
        results.push({node: current, depth: depth, path: getPath(current)})
    
    if depth < maxDepth:
      edges = getEdges(current, direction, edgeTypes)
      for each edge in edges:
        neighbor = getNeighbor(edge, direction)
        if neighbor not in visited:
          queue.enqueue((neighbor, depth + 1))
  
  return results sorted by (depth ASC, edge_count DESC)
```

#### 3.3.2 Edge Query

```sql
-- Outgoing edges
SELECT target_symbol_id, edge_type 
FROM relationships 
WHERE source_symbol_id = ? AND edge_type IN (?)

-- Incoming edges  
SELECT source_symbol_id, edge_type
FROM relationships
WHERE target_symbol_id = ? AND edge_type IN (?)

-- Both directions
UNION of above two queries
```

### 3.4 Feature: Result Formatting

#### 3.4.1 Response Schema

```json
{
  "start": {
    "name": "OrderService.processOrder",
    "kind": "method",
    "file": "src/services/order.ts",
    "line": 45
  },
  "results": [
    {
      "name": "PaymentService.charge",
      "kind": "method",
      "file": "src/services/payment.ts",
      "line": 23,
      "depth": 1,
      "edge_type": "Calls",
      "source": "async charge(amount: number): Promise<Receipt> {\n  // ...\n}"
    }
  ],
  "metadata": {
    "total_traversed": 45,
    "total_results": 12,
    "max_depth_reached": 3,
    "truncated": false,
    "execution_time_ms": 35
  }
}
```

### 3.5 Feature: Token Budget (with include_source)

**Estimation:**
- Node without source: ~20 tokens (name + file + line)
- Node with source (5 lines): ~80 tokens
- Overhead (metadata, formatting): ~100 tokens

**Logic:**
1. If `include_source: true`, estimate total tokens
2. If exceeds reasonable limit (8000 tokens), reduce `source_lines` or truncate results
3. Include `tokens_estimated` in response metadata

---

## 4. Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Start node not found | Return error with suggestions from FTS5 |
| Graph has cycles | Visited set prevents revisiting |
| Isolated node (no edges) | Return empty results with metadata |
| Very large fan-out (>1000 edges) | Limit edges per node to 100, prioritize by frequency |
| Database locked | Retry with backoff, timeout after 5s |

---

## 5. Performance Requirements

| Scenario | Target |
|----------|--------|
| Depth 1, <100 edges | <20ms |
| Depth 3, <10K edges | <100ms |
| Depth 5, <100K edges | <500ms |
| Depth 10 (max) | <2000ms (with early termination) |

**Optimization strategies:**
- Index on `source_symbol_id` and `target_symbol_id` in relationships table
- Batch edge queries (fetch all edges for current depth level at once)
- Early termination when `max_results` reached

---

## 6. Test Strategy

| Test Type | Coverage |
|-----------|----------|
| Unit tests | Node resolution, edge filtering, BFS algorithm |
| Integration tests | Full traversal on test graph |
| Cycle tests | Graphs with cycles don't hang |
| Performance tests | Large graphs (10K+ nodes) within time limits |
| Edge cases | Isolated nodes, ambiguous names, max depth |
