# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-165: [Security] Injection Detection (20 patterns)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-165 |
| Title | [Security] Injection Detection (20 patterns) |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-06-05 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-165.docx |

---

## 1. Use Cases

### UC-165-01: Scan File for Injection Vulnerabilities

**Actor:** AI Agent / Security Engineer

**Main Flow:**
1. User calls `detect_injections` with file_path
2. System identifies all functions in file
3. For each function: run taint_trace (KSA-164)
4. For each taint path found: match against 20 injection patterns
5. Classify finding: CWE, severity, category
6. Check for suppression markers on source/sink lines
7. Return findings with remediation suggestions

**Alternative Flows:**
- 3a. Function has no taint sources → skip (no injection possible)
- 4a. Taint path has sanitizer → mark as sanitized, exclude by default
- 6a. Suppression marker found → mark finding as suppressed

### UC-165-02: Scan with Category Filter

**Actor:** Security Engineer

**Main Flow:**
1. User calls `detect_injections` with category="sql"
2. System only checks SQL-related patterns (patterns 1-4)
3. Returns only SQL injection findings

### UC-165-03: Generate SARIF Report

**Actor:** CI/CD Pipeline

**Main Flow:**
1. User calls `detect_injections` with output_format="sarif"
2. System performs full scan
3. System formats results as SARIF v2.1.0
4. Return SARIF JSON (compatible with GitHub Code Scanning)

### UC-165-04: Workspace-wide Security Scan

**Actor:** Tech Lead / AI Agent

**Main Flow:**
1. User calls `detect_injections` without file_path (workspace scan)
2. System identifies all entry points (from KSA-162)
3. For each entry point handler: run injection detection
4. Aggregate results across all files
5. Return findings + workspace security summary

---

## 2. Business Rules

| ID | Rule | Rationale |
|----|------|-----------|
| BR-165-01 | String concatenation in SQL context = Critical severity | Direct injection vector |
| BR-165-02 | Parameterized queries are NOT flagged (safe pattern) | Industry standard safe practice |
| BR-165-03 | Template literals with user data in SQL = same as concat | Same vulnerability |
| BR-165-04 | eval() with any user-reachable data = Critical | Code execution |
| BR-165-05 | Suppressed findings still counted in summary | Audit trail |
| BR-165-06 | Confidence: High if direct source→sink, Medium if through intermediary | Accuracy indicator |
| BR-165-07 | Each finding gets exactly one CWE classification | Standard compliance |
| BR-165-08 | Remediation suggestion always provided | Actionable output |
| BR-165-09 | SARIF output includes rule definitions + results | GitHub/GitLab compatible |
| BR-165-10 | Scan excludes test files by default | Tests often have intentional "vulnerable" code |

---

## 3. Functional Specifications

### 3.1 MCP Tool: `detect_injections`

#### Input Schema
```json
{
  "name": "detect_injections",
  "description": "Detect injection vulnerabilities using taint analysis and pattern matching",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file_path": {"type": "string", "description": "Scan specific file (omit for workspace scan)"},
      "symbol_name": {"type": "string", "description": "Scan specific function"},
      "category": {
        "type": "string",
        "enum": ["sql", "xss", "command", "path_traversal", "deserialization", "ldap_xml", "all"],
        "default": "all"
      },
      "min_severity": {
        "type": "string",
        "enum": ["Critical", "High", "Medium", "Low"],
        "default": "Medium"
      },
      "include_suppressed": {"type": "boolean", "default": false},
      "include_sanitized": {"type": "boolean", "default": false},
      "output_format": {"type": "string", "enum": ["json", "sarif"], "default": "json"},
      "exclude_tests": {"type": "boolean", "default": true},
      "limit": {"type": "integer", "default": 50}
    }
  }
}
```

#### Output Schema (JSON format)
```json
{
  "findings": [
    {
      "id": "INJ-001",
      "pattern_id": 1,
      "pattern_name": "String concatenation in SQL",
      "category": "sql_injection",
      "cwe": "CWE-89",
      "severity": "Critical",
      "confidence": "High",
      "source": {
        "file": "src/api/users.py",
        "line": 12,
        "column": 15,
        "expression": "request.args.get('id')",
        "type": "http"
      },
      "sink": {
        "file": "src/api/users.py",
        "line": 18,
        "column": 5,
        "expression": "cursor.execute(query)",
        "type": "sql"
      },
      "taint_path": [
        {"line": 12, "action": "source", "var": "user_id"},
        {"line": 15, "action": "concat", "var": "query", "expr": "'SELECT * FROM users WHERE id=' + user_id"},
        {"line": 18, "action": "sink", "var": "query"}
      ],
      "remediation": "Use parameterized query: cursor.execute('SELECT * FROM users WHERE id = %s', [user_id])",
      "suppressed": false,
      "suppression_marker": null
    }
  ],
  "summary": {
    "files_scanned": 45,
    "functions_analyzed": 120,
    "total_findings": 8,
    "by_severity": {"Critical": 2, "High": 4, "Medium": 2, "Low": 0},
    "by_category": {"sql_injection": 3, "xss": 2, "command_injection": 1, "path_traversal": 2},
    "suppressed_count": 1,
    "scan_duration_ms": 5200
  }
}
```

### 3.2 Pattern Registry (20 Patterns)

#### Category: SQL Injection (CWE-89)

| ID | Pattern | Detection Logic | Severity |
|----|---------|----------------|----------|
| 1 | String concat in SQL | taint_path has concat node before sql_sink | Critical |
| 2 | f-string/template in SQL | taint_path has template_literal before sql_sink | Critical |
| 3 | ORM raw query interpolation | sink matches `*.raw(*)` or `*.objects.raw(*)` with tainted arg | High |
| 4 | Stored proc with concat | sink matches `EXEC(*)` or `sp_executesql` with concat | High |

#### Category: XSS (CWE-79)

| ID | Pattern | Detection Logic | Severity |
|----|---------|----------------|----------|
| 5 | innerHTML assignment | sink matches `*.innerHTML = tainted` | High |
| 6 | Template render unescaped | sink matches `render_template_string(tainted)` or `|safe` filter | High |
| 7 | Response body concat | sink matches `res.send(concat_with_tainted)` or `Response(tainted)` | High |
| 8 | dangerouslySetInnerHTML | sink matches `dangerouslySetInnerHTML={{__html: tainted}}` | Medium |

#### Category: Command Injection (CWE-78, CWE-94, CWE-1336)

| ID | Pattern | Detection Logic | Severity |
|----|---------|----------------|----------|
| 9 | Shell exec with concat | sink matches `exec/system/popen(concat_with_tainted)` | Critical |
| 10 | subprocess shell=True | sink matches `subprocess.*(shell=True)` with tainted cmd | Critical |
| 11 | eval/Function with user data | sink matches `eval(tainted)` or `Function(tainted)` | Critical |
| 12 | Template injection (SSTI) | sink matches `render_template_string(tainted)` without sandbox | High |

#### Category: Path Traversal (CWE-22, CWE-73)

| ID | Pattern | Detection Logic | Severity |
|----|---------|----------------|----------|
| 13 | File path from user input | sink matches `open(tainted)` or `readFile(tainted)` without path validation | High |
| 14 | File write with user path | sink matches `writeFile(tainted_path, *)` | High |
| 15 | Archive extraction (zip slip) | sink matches `extractall(tainted)` or `tar.extract(tainted)` | High |

#### Category: Deserialization (CWE-502)

| ID | Pattern | Detection Logic | Severity |
|----|---------|----------------|----------|
| 16 | Unsafe deserialize | sink matches `deserialize(tainted)` or `unserialize(tainted)` | Critical |
| 17 | pickle.loads | sink matches `pickle.loads(tainted)` or `pickle.load(tainted_file)` | Critical |
| 18 | YAML unsafe load | sink matches `yaml.load(tainted)` without `Loader=SafeLoader` | High |

#### Category: LDAP/XML (CWE-90, CWE-611)

| ID | Pattern | Detection Logic | Severity |
|----|---------|----------------|----------|
| 19 | LDAP query injection | sink matches `ldap.search(filter=tainted)` without escaping | High |
| 20 | XXE (XML External Entity) | sink matches `parse(tainted_xml)` without disabling external entities | High |

### 3.3 Suppression Markers

| # | Marker | Language | Scope |
|---|--------|----------|-------|
| 1 | `# nosec` | Python | Line |
| 2 | `# nosec B{NNN}` | Python/Bandit | Line, specific rule |
| 3 | `// NOLINT` | Go/C++ | Line |
| 4 | `// noinspection` | Java/Kotlin | Line/Block |
| 5 | `@SuppressWarnings("security")` | Java | Method/Class |
| 6 | `/* eslint-disable security/* */` | JS/TS | Block |
| 7 | `// eslint-disable-next-line` | JS/TS | Next line |
| 8 | `# type: ignore[security]` | Python | Line |
| 9 | `// NOSONAR` | Any | Line |
| 10 | `// skipcq` | Any (DeepSource) | Line |

### 3.4 SARIF Output Format

```json
{
  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
  "version": "2.1.0",
  "runs": [{
    "tool": {
      "driver": {
        "name": "mcp-code-intelligence",
        "version": "2.0.0",
        "rules": [
          {
            "id": "INJ-SQL-001",
            "name": "SQLInjectionConcat",
            "shortDescription": {"text": "SQL Injection via string concatenation"},
            "defaultConfiguration": {"level": "error"},
            "properties": {"tags": ["security", "sql-injection", "CWE-89"]}
          }
        ]
      }
    },
    "results": [
      {
        "ruleId": "INJ-SQL-001",
        "level": "error",
        "message": {"text": "Tainted data from request.args flows to cursor.execute() via string concatenation"},
        "locations": [{"physicalLocation": {"artifactLocation": {"uri": "src/api/users.py"}, "region": {"startLine": 18}}}],
        "codeFlows": [{"threadFlows": [{"locations": [
          {"location": {"physicalLocation": {"artifactLocation": {"uri": "src/api/users.py"}, "region": {"startLine": 12}}, "message": {"text": "Taint source: request.args.get('id')"}}},
          {"location": {"physicalLocation": {"artifactLocation": {"uri": "src/api/users.py"}, "region": {"startLine": 18}}, "message": {"text": "Taint sink: cursor.execute(query)"}}}
        ]}]}]
      }
    ]
  }]
}
```

### 3.5 Remediation Templates

| Pattern | Remediation Template |
|---------|---------------------|
| SQL concat | "Use parameterized query: `{safe_example}`" |
| XSS innerHTML | "Use textContent instead, or sanitize with DOMPurify: `element.textContent = data`" |
| Command exec | "Use array form: `subprocess.run(['cmd', arg])` instead of shell string" |
| Path traversal | "Validate path with `os.path.realpath()` and check it's within allowed directory" |
| Deserialization | "Use safe alternatives: `json.loads()` instead of `pickle.loads()`" |
| YAML unsafe | "Use `yaml.safe_load()` instead of `yaml.load()`" |
| XXE | "Disable external entities: set `resolve_entities=False`" |

---

## 4. Integration Requirements

### 4.1 Integration with KSA-164 (CFG/DFG/Taint)
- Uses `taint_trace` results as input for pattern matching
- Each taint path is checked against all applicable patterns
- Reuses taint source/sink registry

### 4.2 Integration with KSA-162 (Entry Points)
- HTTP handlers are primary scan targets
- Entry point metadata (framework, route) enriches findings

### 4.3 CI/CD Integration
- SARIF output uploadable to GitHub Code Scanning
- Exit code: 0 (no Critical/High), 1 (Critical/High found)
- Incremental scan: only check changed files

---

## 5. Non-Functional Requirements

| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR-01 | Performance | Single file scan (all 20 patterns) | < 2s |
| NFR-02 | Performance | Workspace scan (100 files) | < 30s |
| NFR-03 | Accuracy | True positive rate | >= 80% |
| NFR-04 | Accuracy | False positive rate | < 30% |
| NFR-05 | Coverage | All 20 patterns implemented | 100% |
| NFR-06 | Integration | SARIF v2.1.0 compliance | Valid schema |
| NFR-07 | Extensibility | New patterns via config | No code change |

---

## 6. Open Issues

| # | Issue | Decision Needed |
|---|-------|-----------------|
| 1 | Should we scan test files for injection? | Default: No (tests have intentional vulnerable code) |
| 2 | How to handle framework-specific safe patterns? | Configurable sanitizer registry per framework |
| 3 | Should findings be persisted in DB? | Recommend: No (compute on demand, SARIF for persistence) |
| 4 | Inter-procedural taint for cross-function injection? | Defer to v2 |

---

## Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence — Injection Scan | [sequence-injection.png](diagrams/sequence-injection.png) | [sequence-injection.drawio](diagrams/sequence-injection.drawio) |
| 3 | State — Finding Lifecycle | [state-finding.png](diagrams/state-finding.png) | [state-finding.drawio](diagrams/state-finding.drawio) |
