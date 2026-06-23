# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-171: Code Intelligence v2 — Feature Parity Sync (Kotlin + Python)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-171 |
| Title | Code Intelligence v2 — Feature Parity Sync (Kotlin + Python) |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-05-26 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-171.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-26 | BA Agent | Initiate document from BRD |
| 1.0 | 2026-05-26 | TA Agent | Technical enrichment — API contracts, pseudocode |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the Code Intelligence Feature Parity system for Kotlin and Python platforms. It defines use cases, business rules, data specifications, and API contracts that developers must implement to achieve feature parity with the nodejs v2 reference.

### 1.2 Scope

- Kotlin/JVM implementation of all 6 feature batches
- Python implementation of all 6 feature batches
- Cross-platform test fixture compatibility
- MCP tool interface for both platforms

### 1.3 References

| Document | Version | Location |
|----------|---------|----------|
| BRD | v1.0 | BRD-v1-KSA-171.docx |
| nodejs v2 Source | HEAD | mcp-code-intelligence-nodejs/ |
| KSA-144 Specs | v1.0 | documents/KSA-144/ |

---

## 2. System Context

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

### 2.2 External Systems

| System | Interface | Description |
|--------|-----------|-------------|
| Source Code Repository | File System | Read source files for parsing |
| Tree-sitter Native | JNI / ctypes | Parse source into AST |
| ONNX Runtime | JNI / Python API | Run embedding models |
| MCP Client (IDE) | JSON-RPC over stdio | Consume analysis results |
| File Watcher | OS Events | Detect file changes for incremental updates |

---

## 3. Functional Requirements

### 3.1 Use Case: UC-01 — Parse Source Code

**Actor:** Developer (via MCP client)
**Precondition:** Source files exist in workspace
**Trigger:** MCP tool call `parse_file` or automatic on file open

#### Main Flow

| Step | Actor | System |
|------|-------|--------|
| 1 | Requests parse of file/directory | |
| 2 | | Detects language from file extension |
| 3 | | Loads appropriate tree-sitter parser |
| 4 | | Parses file into AST |
| 5 | | Extracts symbols (functions, classes, methods) |
| 6 | | Returns structured AST + symbol table |

#### Alternative Flows

| ID | Condition | Flow |
|----|-----------|------|
| AF-01 | Unknown file extension | Return error: "Unsupported language" |
| AF-02 | Parse error (syntax error in source) | Return partial AST with error nodes marked |
| AF-03 | File too large (> 1MB) | Parse with streaming mode, return chunked results |

#### Exception Flows

| ID | Condition | Flow |
|----|-----------|------|
| EF-01 | Tree-sitter native library not found | Return error with installation instructions |
| EF-02 | Out of memory during parse | Abort, return error, suggest smaller scope |

#### Business Rules

| ID | Rule | Rationale |
|----|------|-----------|
| BR-01 | Language detection by extension mapping | Consistent with nodejs behavior |
| BR-02 | AST node types must match nodejs exactly | Cross-platform test compatibility |
| BR-03 | Symbol extraction includes visibility modifiers | Required for dead code detection |

---

### 3.2 Use Case: UC-02 — Build Graph

**Actor:** System (triggered after parse)
**Precondition:** AST available for parsed files
**Trigger:** After initial parse or file change

#### Main Flow

| Step | Actor | System |
|------|-------|--------|
| 1 | | Reads AST for all parsed files |
| 2 | | Identifies function/method calls → call graph edges |
| 3 | | Identifies imports/requires → dependency graph edges |
| 4 | | Constructs adjacency list representation |
| 5 | | Indexes graph for fast traversal |
| 6 | | Stores graph in memory cache |

#### Alternative Flows

| ID | Condition | Flow |
|----|-----------|------|
| AF-01 | Dynamic imports (computed paths) | Mark as "unresolved" edge, log warning |
| AF-02 | Circular dependency detected | Add to cycle list, continue building |
| AF-03 | External dependency (node_modules) | Include as leaf node, don't recurse |

#### Business Rules

| ID | Rule | Rationale |
|----|------|-----------|
| BR-04 | Graph is rebuilt incrementally on file change | Performance: avoid full rebuild |
| BR-05 | Maximum graph size: 100K nodes | Memory safety |
| BR-06 | Unresolved references stored separately | Don't pollute main graph |

---

### 3.3 Use Case: UC-03 — Get AI Context

**Actor:** Developer (via MCP client)
**Precondition:** Graph built, files parsed
**Trigger:** MCP tool call `get_ai_context`

#### Main Flow

| Step | Actor | System |
|------|-------|--------|
| 1 | Sends query + token budget | |
| 2 | | Scores all files by relevance (TF-IDF + graph proximity) |
| 3 | | Ranks files by combined score |
| 4 | | Selects top files within token budget |
| 5 | | Formats context with file paths and line numbers |
| 6 | | Returns ranked context array |

#### API Contract

**Request:**
```json
{
  "tool": "get_ai_context",
  "arguments": {
    "query": "string — natural language query",
    "max_tokens": "number — token budget (default: 8000)",
    "file_filter": "string[] — optional glob patterns",
    "include_graph": "boolean — include graph neighbors (default: true)"
  }
}
```

**Response:**
```json
{
  "context": [
    {
      "file": "string — relative file path",
      "start_line": "number",
      "end_line": "number",
      "content": "string — code snippet",
      "relevance_score": "number — 0.0 to 1.0",
      "tokens": "number — token count of this snippet"
    }
  ],
  "total_tokens": "number",
  "files_considered": "number",
  "ranking_method": "string — algorithm used"
}
```

#### Business Rules

| ID | Rule | Rationale |
|----|------|-----------|
| BR-07 | Never exceed token budget | LLM context window safety |
| BR-08 | Include at least 1 result even if low relevance | Always provide something useful |
| BR-09 | Graph neighbors boost relevance by 20% | Related code is likely relevant |

---

### 3.4 Use Case: UC-04 — Analyze Code Quality

**Actor:** Developer (via MCP client)
**Precondition:** Files parsed, AST available
**Trigger:** MCP tool call `analyze_quality`

#### Main Flow

| Step | Actor | System |
|------|-------|--------|
| 1 | Requests quality analysis for file/project | |
| 2 | | Calculates cyclomatic complexity per function |
| 3 | | Calculates cognitive complexity per function |
| 4 | | Identifies entry points |
| 5 | | Detects code smells |
| 6 | | Returns quality report |

#### API Contract

**Request:**
```json
{
  "tool": "analyze_quality",
  "arguments": {
    "path": "string — file or directory path",
    "metrics": "string[] — which metrics to compute",
    "thresholds": {
      "cyclomatic_max": "number (default: 10)",
      "cognitive_max": "number (default: 15)",
      "method_lines_max": "number (default: 50)"
    }
  }
}
```

**Response:**
```json
{
  "files": [
    {
      "path": "string",
      "functions": [
        {
          "name": "string",
          "line": "number",
          "cyclomatic_complexity": "number",
          "cognitive_complexity": "number",
          "lines": "number",
          "is_entry_point": "boolean",
          "smells": ["string"]
        }
      ],
      "summary": {
        "total_functions": "number",
        "avg_complexity": "number",
        "high_complexity_count": "number",
        "smell_count": "number"
      }
    }
  ]
}
```

---

### 3.5 Use Case: UC-05 — Security Analysis

**Actor:** Developer (via MCP client)
**Precondition:** Files parsed, graph built
**Trigger:** MCP tool call `analyze_security`

#### Main Flow

| Step | Actor | System |
|------|-------|--------|
| 1 | Requests security scan | |
| 2 | | Constructs CFG from AST |
| 3 | | Constructs DFG from AST |
| 4 | | Identifies taint sources (user inputs) |
| 5 | | Identifies taint sinks (dangerous operations) |
| 6 | | Traces data flow from sources to sinks |
| 7 | | Classifies vulnerabilities (injection, SSRF, IDOR) |
| 8 | | Scores severity |
| 9 | | Returns vulnerability report |

#### API Contract

**Request:**
```json
{
  "tool": "analyze_security",
  "arguments": {
    "path": "string — file or directory",
    "checks": "string[] — vulnerability types to check",
    "severity_threshold": "string — minimum severity (low/medium/high/critical)"
  }
}
```

**Response:**
```json
{
  "vulnerabilities": [
    {
      "id": "string — unique ID",
      "type": "string — injection|ssrf|idor|misconfig|xss",
      "severity": "string — low|medium|high|critical",
      "file": "string — file path",
      "line": "number",
      "source": { "file": "string", "line": "number", "expression": "string" },
      "sink": { "file": "string", "line": "number", "expression": "string" },
      "taint_path": [{ "file": "string", "line": "number", "expression": "string" }],
      "description": "string",
      "recommendation": "string"
    }
  ],
  "summary": {
    "total": "number",
    "by_severity": { "critical": 0, "high": 0, "medium": 0, "low": 0 },
    "by_type": { "injection": 0, "ssrf": 0, "idor": 0, "misconfig": 0, "xss": 0 }
  }
}
```

#### Business Rules

| ID | Rule | Rationale |
|----|------|-----------|
| BR-10 | Taint sources: req.params, req.body, req.query, process.env, user input | Standard web app input vectors |
| BR-11 | Taint sinks: SQL queries, exec(), eval(), fetch(), fs.write() | Dangerous operations |
| BR-12 | Sanitization functions break taint chain | Reduce false positives |
| BR-13 | Cross-file taint tracking via call graph | Real-world vulnerabilities span files |

---

### 3.6 Use Case: UC-06 — Similarity Detection

**Actor:** Developer (via MCP client)
**Precondition:** Files parsed, embeddings computed
**Trigger:** MCP tool call `find_similar` or `find_duplicates`

#### Main Flow

| Step | Actor | System |
|------|-------|--------|
| 1 | Requests similarity analysis | |
| 2 | | Computes code embeddings for all functions |
| 3 | | Calculates pairwise similarity scores |
| 4 | | Identifies duplicates (score > 0.9) |
| 5 | | Identifies near-duplicates (score > 0.7) |
| 6 | | Returns similarity report |

#### API Contract

**Request:**
```json
{
  "tool": "find_duplicates",
  "arguments": {
    "path": "string — scope",
    "threshold": "number — similarity threshold (default: 0.8)",
    "min_lines": "number — minimum function size to consider (default: 5)"
  }
}
```

**Response:**
```json
{
  "duplicates": [
    {
      "group_id": "number",
      "similarity": "number — 0.0 to 1.0",
      "fragments": [
        { "file": "string", "function": "string", "start_line": "number", "end_line": "number" }
      ]
    }
  ],
  "dead_code": [
    { "file": "string", "function": "string", "line": "number", "reason": "string" }
  ]
}
```

---

## 4. Data Specifications

### 4.1 AST Node Schema

```typescript
interface ASTNode {
  type: string;          // node type (e.g., "function_declaration")
  text: string;          // source text
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  children: ASTNode[];
  namedChildren: ASTNode[];
  parent: ASTNode | null;
}
```

### 4.2 Symbol Table Schema

```typescript
interface Symbol {
  name: string;
  kind: "function" | "class" | "interface" | "method" | "variable" | "enum";
  file: string;
  line: number;
  endLine: number;
  visibility: "public" | "private" | "protected" | "internal";
  parameters?: Parameter[];
  returnType?: string;
  decorators?: string[];
}
```

### 4.3 Graph Schema

```typescript
interface GraphNode {
  id: string;           // unique identifier (file:line:name)
  type: "function" | "class" | "module" | "file";
  name: string;
  file: string;
  line: number;
}

interface GraphEdge {
  source: string;       // node ID
  target: string;       // node ID
  type: "calls" | "imports" | "extends" | "implements";
  weight: number;       // call frequency or importance
}
```

---

## 5. Platform-Specific Implementation Notes

### 5.1 Kotlin/JVM

| Aspect | Implementation |
|--------|---------------|
| Tree-sitter binding | JNI via tree-sitter-kotlin or custom JNI wrapper |
| Graph storage | Custom adjacency list (HashMap<String, List<Edge>>) |
| Token counting | jtokkit library |
| Embeddings | ONNX Runtime for JVM |
| Concurrency | Kotlin coroutines + structured concurrency |
| Build system | Gradle with Kotlin DSL |
| Test framework | JUnit 5 + kotest |

### 5.2 Python

| Aspect | Implementation |
|--------|---------------|
| Tree-sitter binding | py-tree-sitter (official Python binding) |
| Graph storage | NetworkX DiGraph |
| Token counting | tiktoken library |
| Embeddings | sentence-transformers |
| Concurrency | asyncio + multiprocessing for CPU-bound |
| Build system | Poetry or pip + pyproject.toml |
| Test framework | pytest |

---

## 6. Non-Functional Requirements (Quantified)

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| Parse latency (single file, 10K LOC) | < 500ms | p95 latency |
| Graph build (1000 files) | < 5s | wall clock |
| AI context retrieval | < 2s | p95 latency |
| Security scan (500 files) | < 30s | wall clock |
| Memory usage (1000-file project) | < 2GB | peak RSS |
| Startup time (cold) | < 3s | first tool ready |
| Detection parity vs nodejs | > 95% | F1 score on test fixtures |

---

## 7. Error Handling

| Error Code | Description | Recovery |
|------------|-------------|----------|
| E001 | Parser not found for language | Return supported languages list |
| E002 | File not found | Return error with path |
| E003 | Parse timeout (> 10s) | Abort, return partial results |
| E004 | Graph too large (> 100K nodes) | Suggest scope reduction |
| E005 | ONNX model load failure | Disable similarity features, warn |
| E006 | Token count overflow | Truncate context, warn |
| E007 | Taint analysis timeout | Return partial results with warning |

---

## 8. Open Issues

| # | Issue | Impact | Owner | Status |
|---|-------|--------|-------|--------|
| 1 | Tree-sitter JVM binding stability | May need fallback to subprocess | Tech Lead | Open |
| 2 | ONNX model size for Kotlin (embedding) | May need smaller model | Tech Lead | Open |
| 3 | Python GIL impact on parallel analysis | May need multiprocessing | Dev Team | Open |

---

## 9. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence — Parse Flow | [sequence-parse.png](diagrams/sequence-parse.png) | [sequence-parse.drawio](diagrams/sequence-parse.drawio) |
| 3 | State — Analysis Pipeline | [state-pipeline.png](diagrams/state-pipeline.png) | [state-pipeline.drawio](diagrams/state-pipeline.drawio) |
