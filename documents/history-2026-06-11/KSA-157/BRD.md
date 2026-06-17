# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-157: [Graph] Graph Traversal API - custom edge/node filters

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-157 |
| Title | [Graph] Graph Traversal API - custom edge/node filters |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-06-01 |
| Status | Draft |
| Parent Epic | KSA-144: Code Intelligence v2 — Graph Engine + Static Analysis |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-01 | BA Agent | Initial document — auto-generated from Jira ticket KSA-157 |

---

## 1. Introduction

### 1.1 Scope

Implement `code_traverse` MCP tool that provides custom graph traversal with:
- **Edge type filters**: Calls, Contains, Imports, Inherits, Implements
- **Node type filters**: Function, Class, Interface, Module, File
- **Direction control**: Outgoing (callees), Incoming (callers), Both
- **Depth control**: Max traversal depth (1-N hops)
- **Result formatting**: Structured output suitable for AI agent consumption

This tool enables AI agents to explore code relationships flexibly, answering questions like "what does this function call transitively?" or "what imports this module?".

### 1.2 Out of Scope

- Graph data model and storage (KSA-153 — prerequisite, done)
- Call graph extraction (KSA-154 — prerequisite, done)
- Dependency graph extraction (KSA-155 — prerequisite, done)
- Impact analysis (KSA-156 — separate tool)
- AI context assembly (KSA-158, KSA-160 — higher-level tools)
- Graph visualization/rendering

### 1.3 Preliminary Requirements

- Graph data model with nodes and edges stored (KSA-153)
- Call graph edges populated (KSA-154)
- Dependency graph edges populated (KSA-155)
- MCP tool registration infrastructure

---

## 2. Business Requirements

### 2.1 High Level Process Map

Current code intelligence has no graph traversal capability. AI agents cannot:
- Follow call chains beyond 1 hop
- Filter relationships by type
- Explore code structure directionally
- Limit traversal depth for token budget management

The `code_traverse` tool provides a general-purpose graph query interface that all other tools can build upon.

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|-----------------|----------|---------------|
| 1 | As an AI agent, I want to traverse the call graph from a function with depth control | MUST HAVE | KSA-157 |
| 2 | As an AI agent, I want to filter traversal by edge type (only calls, only imports) | MUST HAVE | KSA-157 |
| 3 | As an AI agent, I want to filter traversal by node type (only classes, only functions) | MUST HAVE | KSA-157 |
| 4 | As an AI agent, I want to control traversal direction (callers vs callees) | MUST HAVE | KSA-157 |
| 5 | As an AI agent, I want traversal results formatted with source snippets | SHOULD HAVE | KSA-157 |
| 6 | As an AI agent, I want to limit result count for token budget management | SHOULD HAVE | KSA-157 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** AI agent calls `code_traverse` with start node, edge filters, direction, and depth

**Step 2:** Tool resolves start node from symbol name/ID

**Step 3:** Tool performs BFS/DFS traversal on the graph with applied filters

**Step 4:** Tool collects matching nodes up to depth limit

**Step 5:** Tool formats results with node metadata and optional source snippets

**Step 6:** Tool returns structured JSON response to AI agent

---

#### STORY 1: Call Graph Traversal with Depth Control

> As an AI agent, I want to traverse the call graph from a function with depth control.

**API Design:**

```
code_traverse({
  start: "MyService.processOrder",   // symbol name or ID
  edge_types: ["Calls"],             // filter edges
  direction: "outgoing",             // callees
  max_depth: 3,                      // up to 3 hops
  max_results: 50                    // limit output
})
```

**Acceptance Criteria:**

1. Traversal starts from specified symbol
2. Follows only edges matching `edge_types` filter
3. Respects `max_depth` — does not traverse beyond N hops
4. Returns all reachable nodes within depth limit
5. Each result includes: node name, kind, file, line, depth from start
6. Cycle detection prevents infinite loops

---

#### STORY 2: Edge Type Filtering

> As an AI agent, I want to filter traversal by edge type.

**Supported Edge Types:**

| Edge Type | Description | Example |
|-----------|-------------|---------|
| `Calls` | Function/method invocation | `foo()` calls `bar()` |
| `Contains` | Parent-child containment | Class contains Method |
| `Imports` | Module/file import | File imports Module |
| `Inherits` | Class/interface inheritance | Dog extends Animal |
| `Implements` | Interface implementation | Service implements IService |
| `Uses` | Type usage (field type, param type) | Method uses Type |
| `Annotated` | Annotation/decorator usage | Class annotated by Entity |

**Acceptance Criteria:**

1. Multiple edge types can be specified (OR logic — traverse if any match)
2. Empty edge_types means "all types" (no filter)
3. Invalid edge type returns clear error message
4. Edge type filtering applied at each hop (not just first)

---

#### STORY 3: Node Type Filtering

> As an AI agent, I want to filter traversal by node type.

**Supported Node Types:**

| Node Type | Description |
|-----------|-------------|
| `Function` | Functions and methods |
| `Class` | Classes, structs |
| `Interface` | Interfaces, traits, protocols |
| `Module` | Modules, packages, namespaces |
| `File` | Source files |
| `Enum` | Enumerations |
| `Type` | Type aliases, typedefs |
| `Variable` | Constants, variables, fields |

**Acceptance Criteria:**

1. Node type filter applied to results (only return matching nodes)
2. Traversal still follows edges through non-matching nodes (they're just not in results)
3. Multiple node types can be specified (OR logic)
4. Empty node_types means "all types" (no filter)

---

#### STORY 4: Direction Control

> As an AI agent, I want to control traversal direction.

**Directions:**

| Direction | Meaning | Use Case |
|-----------|---------|----------|
| `outgoing` | Follow edges forward (A→B) | "What does this function call?" |
| `incoming` | Follow edges backward (B←A) | "Who calls this function?" |
| `both` | Follow edges in both directions | "All related symbols" |

**Acceptance Criteria:**

1. `outgoing` follows edges from source to target
2. `incoming` follows edges from target to source (reverse)
3. `both` follows edges in either direction
4. Direction applies consistently at each depth level

---

#### STORY 5: Source Snippet Inclusion

> As an AI agent, I want traversal results formatted with source snippets.

**Acceptance Criteria:**

1. Optional `include_source: true` parameter
2. When enabled, each result node includes source code snippet (signature + first N lines)
3. Source snippet limited to configurable line count (default: 5 lines)
4. If source file not accessible, return node metadata without snippet
5. Token budget consideration: estimate total tokens before including snippets

---

#### STORY 6: Result Count Limiting

> As an AI agent, I want to limit result count for token budget management.

**Acceptance Criteria:**

1. `max_results` parameter limits total nodes returned
2. Results prioritized by: depth (closer first), then by edge count (more connected first)
3. If results truncated, response includes `truncated: true` and `total_available: N`
4. Default max_results: 50
5. Maximum allowed: 200

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Graph data model (KSA-153) | System | KSA-153 | Node/edge storage |
| Call graph (KSA-154) | System | KSA-154 | Call edges populated |
| Dependency graph (KSA-155) | System | KSA-155 | Import/inheritance edges |
| MCP tool infrastructure | System | N/A | Tool registration and invocation |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | Development Team Lead | Approve API design |
| Developer | Code Intelligence Team | Implement traversal tool |
| QA | QA Team | Verify traversal correctness |
| Users | AI Agents (get_ai_context, get_edit_context) | Primary consumers |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Large graphs cause slow traversal | Medium | Medium | Depth limit + result limit + timeout |
| Cycles in graph cause infinite loops | High | Medium | Visited set, cycle detection |
| Token budget exceeded with source snippets | Medium | Medium | Estimate tokens before including |
| Inconsistent graph data (missing edges) | Low | Low | Graceful handling of missing nodes |

### 5.2 Assumptions

- Graph is stored in SQLite with indexed edges (fast lookup)
- BFS is preferred over DFS for most use cases (breadth-first gives closer results first)
- AI agents will typically use depth 1-3 (deeper traversals are rare)
- Source snippets are optional and off by default

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Traversal <100ms for depth ≤3 | On graphs with <100K edges |
| Performance | Traversal <500ms for depth ≤5 | On graphs with <100K edges |
| Scalability | Handle graphs up to 1M edges | With appropriate depth/result limits |
| Reliability | Never hang (cycle detection) | Visited set prevents infinite loops |
| Usability | Clear error messages | For invalid inputs, missing nodes |

---

## 7. Related Tickets

| Ticket Key | Summary | Relationship |
|------------|---------|--------------|
| KSA-157 | [Graph] Graph Traversal API | Main ticket |
| KSA-144 | Code Intelligence v2 — Graph Engine + Static Analysis | Parent epic |
| KSA-153 | [Graph] Data Model & Storage | Prerequisite (storage) |
| KSA-154 | [Graph] Call Graph | Prerequisite (call edges) |
| KSA-155 | [Graph] Dependency Graph | Prerequisite (import edges) |
| KSA-156 | [Graph] Impact Analysis | Consumer (uses traversal) |
| KSA-158 | [AI Context] get_ai_context | Consumer (uses traversal) |
| KSA-160 | [AI Context] get_curated_context | Consumer (uses traversal) |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| BFS | Breadth-First Search — explores neighbors before going deeper |
| DFS | Depth-First Search — explores one path fully before backtracking |
| Edge | Relationship between two nodes (e.g., A calls B) |
| Node | Code symbol in the graph (function, class, etc.) |
| Hop | One step in traversal (depth 1 = direct neighbors) |

### Reference Documents

| Document | Location |
|----------|----------|
| CodeGraph vs FEC Comparison | documents/CodeGraph-vs-FEC-Comparison.md |
| KSA-153 BRD (Data Model) | documents/KSA-153/BRD.md |
| KSA-154 BRD (Call Graph) | documents/KSA-154/BRD.md |
| KSA-155 BRD (Dep Graph) | documents/KSA-155/BRD.md |
