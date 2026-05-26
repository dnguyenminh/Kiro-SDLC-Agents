# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-176: [Kotlin] Security Analysis

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-176 |
| Title | [Kotlin] Security Analysis |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-05-26 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-176.docx |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the Kotlin Security Analysis module, detailing CFG/DFG construction, taint analysis algorithms, vulnerability detection patterns, and MCP tool API contracts.

### 1.2 References

| Document | Version |
|----------|---------|
| BRD | v1.0 — BRD-v1-KSA-176.docx |
| Parent TDD | TDD-v1-KSA-171.docx |
| nodejs Reference | mcp-code-intelligence-nodejs/src/security/ |

---

## 2. Use Cases

### UC-01: Build Control Flow Graph

**Actor:** System (internal)
**Trigger:** Security analysis requested for a function

#### Main Flow

| Step | System Action |
|------|--------------|
| 1 | Receive AST node for function body |
| 2 | Create entry node |
| 3 | Process each statement sequentially (add edges) |
| 4 | For if/else: create branch node, true edge, false edge, merge node |
| 5 | For loops: create loop header, body edge, back-edge, exit edge |
| 6 | For try/catch: create normal path + exception path |
| 7 | For return/throw: create edge to exit node |
| 8 | Create exit node |
| 9 | Return CFG |

#### Business Rules

| ID | Rule |
|----|------|
| BR-01 | Every function has exactly one entry and one exit node |
| BR-02 | Unreachable code after return/throw still included (marked unreachable) |
| BR-03 | Switch/case treated as cascading if/else |

---

### UC-02: Build Data Flow Graph

**Actor:** System (internal)
**Trigger:** CFG available for function

#### Main Flow

| Step | System Action |
|------|--------------|
| 1 | Walk CFG nodes in topological order |
| 2 | For each assignment: create def edge (variable → node) |
| 3 | For each variable use: create use edge (node → variable) |
| 4 | For function calls: create call edge with argument mapping |
| 5 | For returns: create return edge |
| 6 | Handle destructuring: expand to individual assignments |
| 7 | Handle property access: track object.property as separate variable |
| 8 | Return DFG |

#### Business Rules

| ID | Rule |
|----|------|
| BR-04 | Object properties tracked as `obj.prop` (dot notation) |
| BR-05 | Array index access tracked as `arr[*]` (wildcard) |
| BR-06 | Spread operator propagates all properties |

---

### UC-03: Perform Taint Analysis

**Actor:** System (internal)
**Trigger:** CFG + DFG available

#### Main Flow

| Step | System Action |
|------|--------------|
| 1 | Identify all taint sources in DFG |
| 2 | Initialize worklist with source nodes |
| 3 | For each node in worklist: propagate taint to successors |
| 4 | If successor is sanitizer: remove taint, skip |
| 5 | If successor is sink: record vulnerability |
| 6 | If successor is function call: follow into callee (cross-file) |
| 7 | Continue until worklist empty or depth limit reached |
| 8 | Return list of vulnerabilities with taint paths |

#### API Contract

**Internal API (called by MCP handler):**

```kotlin
data class TaintAnalysisRequest(
    val files: List<Path>,
    val checks: Set<VulnerabilityType> = VulnerabilityType.values().toSet(),
    val maxDepth: Int = 10,
    val maxCallDepth: Int = 5,
    val timeout: Duration = 30.seconds
)

data class TaintAnalysisResult(
    val vulnerabilities: List<Vulnerability>,
    val summary: VulnerabilitySummary,
    val analysisTime: Duration,
    val filesAnalyzed: Int,
    val timedOut: Boolean = false
)

data class Vulnerability(
    val id: String,
    val type: VulnerabilityType,
    val severity: Severity,
    val source: TaintLocation,
    val sink: TaintLocation,
    val taintPath: List<TaintLocation>,
    val description: String,
    val recommendation: String
)

enum class VulnerabilityType {
    SQL_INJECTION, XSS, COMMAND_INJECTION, SSRF, IDOR, MISCONFIGURATION
}

enum class Severity { CRITICAL, HIGH, MEDIUM, LOW }

data class TaintLocation(
    val file: String,
    val line: Int,
    val column: Int,
    val expression: String,
    val context: String  // surrounding code snippet
)
```

**MCP Tool API:**

```json
{
  "tool": "analyze_security",
  "arguments": {
    "path": "string — file or directory",
    "checks": ["sql_injection", "xss", "command_injection", "ssrf", "idor", "misconfiguration"],
    "severity_threshold": "low|medium|high|critical",
    "max_depth": 10,
    "timeout_seconds": 30
  }
}
```

**Response:**
```json
{
  "vulnerabilities": [
    {
      "id": "VULN-001",
      "type": "sql_injection",
      "severity": "high",
      "file": "src/routes/users.ts",
      "line": 42,
      "source": { "file": "src/routes/users.ts", "line": 38, "expression": "req.params.id" },
      "sink": { "file": "src/db/queries.ts", "line": 15, "expression": "db.query(sql)" },
      "taint_path": [
        { "file": "src/routes/users.ts", "line": 38, "expression": "req.params.id" },
        { "file": "src/routes/users.ts", "line": 40, "expression": "userId = req.params.id" },
        { "file": "src/routes/users.ts", "line": 42, "expression": "getUser(userId)" },
        { "file": "src/db/queries.ts", "line": 15, "expression": "db.query(sql)" }
      ],
      "description": "User-controlled input flows into SQL query without parameterization",
      "recommendation": "Use parameterized queries: db.query('SELECT * FROM users WHERE id = ?', [userId])"
    }
  ],
  "summary": {
    "total": 3,
    "by_severity": { "critical": 0, "high": 1, "medium": 1, "low": 1 },
    "by_type": { "sql_injection": 1, "xss": 1, "misconfiguration": 1 }
  }
}
```

---

### UC-04: Detect Specific Vulnerability Types

#### SQL Injection Detection Rules

| Pattern | Vulnerable | Safe |
|---------|-----------|------|
| String concat in query | `"SELECT * FROM " + table` | `query("SELECT * FROM ?", [table])` |
| Template literal | `` `SELECT * FROM ${table}` `` | Parameterized query |
| ORM raw query | `Model.raw(userInput)` | `Model.findById(id)` |

#### XSS Detection Rules

| Pattern | Vulnerable | Safe |
|---------|-----------|------|
| Direct output | `res.send(userInput)` | `res.send(escape(userInput))` |
| innerHTML | `el.innerHTML = data` | `el.textContent = data` |
| Template | `<div>${userInput}</div>` (no escape) | Auto-escaping template engine |

#### Command Injection Detection Rules

| Pattern | Vulnerable | Safe |
|---------|-----------|------|
| exec with concat | `exec("cmd " + input)` | `execFile("cmd", [input])` |
| shell: true | `spawn(cmd, {shell: true})` | `spawn(cmd, args)` (no shell) |
| eval | `eval(userInput)` | Never safe |

---

## 3. Data Specifications

### 3.1 CFG Node Types

| Type | Description | Edges |
|------|-------------|-------|
| ENTRY | Function entry point | 1 outgoing |
| EXIT | Function exit point | 0 outgoing |
| STATEMENT | Sequential statement | 1 outgoing |
| BRANCH | if/switch condition | 2+ outgoing (true/false) |
| LOOP_HEADER | Loop condition | 2 outgoing (body/exit) |
| MERGE | Join point after branch | 1 outgoing |
| CALL | Function call | 1 outgoing + call edge |
| RETURN | Return statement | 1 outgoing (to EXIT) |
| THROW | Throw statement | 1 outgoing (to catch/EXIT) |

### 3.2 DFG Edge Types

| Type | Description |
|------|-------------|
| DEF | Variable definition (assignment) |
| USE | Variable use (read) |
| CALL_ARG | Argument passed to function |
| CALL_RETURN | Return value from function |
| PROPERTY_ACCESS | Object property read |
| PROPERTY_ASSIGN | Object property write |

---

## 4. Non-Functional Requirements

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| Single file analysis | < 2s | p95 latency |
| 500-file project scan | < 30s | wall clock |
| Memory per file | < 50MB | peak during analysis |
| False positive rate | < 20% | on benchmark suite |
| Detection rate | > 90% | on known vulnerabilities |
| Parity with nodejs | > 95% | same findings |

---

## 5. Error Handling

| Error | Behavior |
|-------|----------|
| Parse failure for file | Skip file, include in warnings |
| Taint analysis timeout | Return partial results, mark as incomplete |
| Circular taint path | Detect cycle, break, report as potential issue |
| Unknown sink pattern | Log warning, don't report as vulnerability |
| Cross-file resolution failure | Analyze within single file only |

---

## 6. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence — Taint Flow | [sequence-taint.png](diagrams/sequence-taint.png) | [sequence-taint.drawio](diagrams/sequence-taint.drawio) |
| 3 | State — Analysis States | [state-analysis.png](diagrams/state-analysis.png) | [state-analysis.drawio](diagrams/state-analysis.drawio) |
