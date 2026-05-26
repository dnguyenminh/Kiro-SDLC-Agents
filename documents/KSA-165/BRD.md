# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-165: [Security] Injection Detection (20 patterns)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-165 |
| Title | [Security] Injection Detection (20 patterns) |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-06-05 |
| Status | Draft |
| Parent Epic | KSA-144: Code Intelligence v2 — Graph Engine + Static Analysis |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-05 | BA Agent | Initial document — auto-generated from Jira ticket KSA-165 |

---

## 1. Introduction

### 1.1 Scope

This ticket implements detection of 20 injection vulnerability patterns using the CFG/DFG/Taint infrastructure from KSA-164. The system examines function bodies for string concatenation in dangerous contexts, identifies taint paths from sources to sinks, and reports findings with CWE classifications.

**Key deliverables:**
- 20 injection detection patterns covering 6 vulnerability categories
- Pattern matching engine using CFG + taint trace results
- CWE classification for each finding
- Severity scoring (Critical/High/Medium/Low)
- Suppression support (nosec, NOLINT comments)
- MCP tool `detect_injections` exposing results to AI agents
- SARIF-compatible output format for CI/CD integration
- Support for 6 languages

### 1.2 Out of Scope

- CFG/DFG construction (KSA-164 — prerequisite)
- SBOM generation / dependency audit (future tickets)
- Runtime detection / DAST (only static analysis)
- Inter-procedural taint analysis (future enhancement)
- Auto-fix / remediation suggestions (future enhancement)
- SSRF / IDOR detection (future tickets)

### 1.3 Preliminary Requirements

- KSA-164: Control Flow + Data Flow Analysis (CFG/DFG/Taint infrastructure)
- KSA-145: Tree-sitter core (AST parsing)
- KSA-162: Entry Point Detection (to identify HTTP handlers as taint entry points)
- Taint source/sink registry configured for target frameworks

---

## 2. Business Requirements

### 2.1 High Level Process Map

Injection vulnerabilities are the #1 web application security risk (OWASP Top 10). They occur when untrusted data is sent to an interpreter as part of a command or query. This feature detects 20 specific injection patterns by:

1. Using taint trace (KSA-164) to find data flowing from sources to sinks
2. Checking if the data passes through string concatenation (dangerous) vs parameterization (safe)
3. Classifying findings by CWE and severity
4. Reporting with actionable remediation guidance

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|-----------------|----------|---------------|
| 1 | As a security engineer, I want SQL injection detected so that I can prevent database attacks | MUST HAVE | KSA-165 |
| 2 | As a security engineer, I want XSS detected so that I can prevent script injection | MUST HAVE | KSA-165 |
| 3 | As a security engineer, I want command injection detected so that I can prevent OS command attacks | MUST HAVE | KSA-165 |
| 4 | As a developer, I want all 20 injection patterns scanned in one pass so that I get comprehensive results | MUST HAVE | KSA-165 |
| 5 | As a developer, I want suppression comments honored so that I can mark false positives | SHOULD HAVE | KSA-165 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Developer requests injection scan (via MCP tool or during CI)

**Step 2:** System identifies entry points / HTTP handlers (from KSA-162)

**Step 3:** For each handler function, system runs taint trace (from KSA-164)

**Step 4:** Pattern matcher checks each taint path against 20 injection patterns

**Step 5:** For each match: classify CWE, compute severity, check for suppressions

**Step 6:** Results aggregated and returned via MCP tool / SARIF output

---

#### STORY 1: SQL Injection Detection

> As a security engineer, I want SQL injection detected so that I can prevent database attacks.

**Requirement Details:**

**Patterns (4 sub-patterns):**

| # | Pattern | CWE | Example (Vulnerable) | Example (Safe) |
|---|---------|-----|---------------------|----------------|
| 1 | String concatenation in SQL | CWE-89 | `"SELECT * FROM users WHERE id=" + userId` | `cursor.execute("SELECT * FROM users WHERE id=?", [userId])` |
| 2 | f-string/template literal in SQL | CWE-89 | `f"SELECT * FROM users WHERE id={userId}"` | Parameterized query |
| 3 | ORM raw query with interpolation | CWE-89 | `Model.objects.raw(f"SELECT... {input}")` | `Model.objects.filter(id=input)` |
| 4 | Stored procedure with concat | CWE-89 | `EXEC('SELECT ' + @col + ' FROM t')` | Parameterized stored proc |

**Detection Logic:**
1. Find taint paths where sink is SQL execution function
2. Check if tainted data reaches sink via string concatenation (not parameterization)
3. String concat indicators: `+`, template literals, f-strings, `.format()`, `%` formatting
4. Safe indicators: `?` placeholder, `$1` placeholder, named params `:name`

**Acceptance Criteria:**

1. Detects string concatenation in SQL queries across all 6 languages
2. Does NOT flag parameterized queries (zero false positives for proper parameterization)
3. Detects f-string, template literal, and .format() interpolation in SQL
4. Reports CWE-89 with exact source and sink locations
5. Accuracy: >= 90% true positive rate on OWASP benchmark

---

#### STORY 2: XSS Detection

> As a security engineer, I want XSS detected so that I can prevent script injection.

**Requirement Details:**

**Patterns (4 sub-patterns):**

| # | Pattern | CWE | Example (Vulnerable) |
|---|---------|-----|---------------------|
| 1 | innerHTML assignment with user data | CWE-79 | `element.innerHTML = userInput` |
| 2 | Template rendering without escaping | CWE-79 | `render_template_string(user_html)` |
| 3 | Response body with unescaped data | CWE-79 | `res.send("<div>" + userInput + "</div>")` |
| 4 | dangerouslySetInnerHTML in React | CWE-79 | `<div dangerouslySetInnerHTML={{__html: data}}>` |

**Detection Logic:**
1. Find taint paths where sink is HTML output function
2. Check if tainted data is escaped before reaching sink
3. Escape functions: `escapeHtml()`, `DOMPurify.sanitize()`, template auto-escaping

**Acceptance Criteria:**

1. Detects reflected XSS (user input → response) in all 6 languages
2. Detects stored XSS (DB data → response without escaping)
3. Does NOT flag auto-escaped template engines (Jinja2 default, React JSX)
4. Reports CWE-79 with source-to-sink path

---

#### STORY 3: Command Injection Detection

> As a security engineer, I want command injection detected so that I can prevent OS command attacks.

**Requirement Details:**

**Patterns (4 sub-patterns):**

| # | Pattern | CWE | Example (Vulnerable) |
|---|---------|-----|---------------------|
| 1 | Shell exec with string concat | CWE-78 | `exec("rm -rf " + userPath)` |
| 2 | subprocess with shell=True | CWE-78 | `subprocess.run(f"ls {dir}", shell=True)` |
| 3 | eval/Function with user data | CWE-94 | `eval(userExpression)` |
| 4 | Template injection | CWE-1336 | `render_template_string(user_template)` |

**Detection Logic:**
1. Find taint paths where sink is shell/eval execution
2. Check if tainted data is sanitized (allowlist validation, escaping)
3. Shell exec functions: `exec`, `system`, `popen`, `subprocess.run`, `child_process.exec`

**Acceptance Criteria:**

1. Detects command injection via shell execution functions
2. Detects eval-based code injection
3. Detects template injection (SSTI)
4. Does NOT flag subprocess with array args (safe: `subprocess.run(["ls", dir])`)

---

#### STORY 4: Comprehensive 20-Pattern Scan

> As a developer, I want all 20 injection patterns scanned in one pass so that I get comprehensive results.

**Requirement Details:**

**Complete Pattern Registry (20 patterns across 6 categories):**

| Category | # | Pattern | CWE | Severity |
|----------|---|---------|-----|----------|
| SQL Injection | 1 | String concat in SQL | CWE-89 | Critical |
| SQL Injection | 2 | f-string/template in SQL | CWE-89 | Critical |
| SQL Injection | 3 | ORM raw query interpolation | CWE-89 | High |
| SQL Injection | 4 | Stored proc concat | CWE-89 | High |
| XSS | 5 | innerHTML with user data | CWE-79 | High |
| XSS | 6 | Template render unescaped | CWE-79 | High |
| XSS | 7 | Response body concat | CWE-79 | High |
| XSS | 8 | dangerouslySetInnerHTML | CWE-79 | Medium |
| Command Injection | 9 | Shell exec concat | CWE-78 | Critical |
| Command Injection | 10 | subprocess shell=True | CWE-78 | Critical |
| Command Injection | 11 | eval/Function user data | CWE-94 | Critical |
| Command Injection | 12 | Template injection (SSTI) | CWE-1336 | High |
| Path Traversal | 13 | File path from user input | CWE-22 | High |
| Path Traversal | 14 | File read/write with user path | CWE-73 | High |
| Path Traversal | 15 | Archive extraction (zip slip) | CWE-22 | High |
| Deserialization | 16 | Unsafe deserialize user data | CWE-502 | Critical |
| Deserialization | 17 | pickle.loads(user_data) | CWE-502 | Critical |
| Deserialization | 18 | YAML.load(user_data) unsafe | CWE-502 | High |
| LDAP/XML | 19 | LDAP query with user input | CWE-90 | High |
| LDAP/XML | 20 | XML parse with external entities | CWE-611 | High |

**MCP Tool: `detect_injections`**

Input:
- `file_path` (optional): Scan specific file
- `category` (optional): Filter by category (sql, xss, command, path, deser, ldap_xml)
- `min_severity` (optional): Minimum severity (Critical, High, Medium, Low)
- `include_suppressed` (optional): Include suppressed findings (default: false)
- `output_format` (optional): "json" or "sarif" (default: "json")

Output:
```json
{
  "findings": [
    {
      "id": "INJ-001",
      "pattern": "String concat in SQL",
      "cwe": "CWE-89",
      "severity": "Critical",
      "category": "sql_injection",
      "source": {"file": "src/api/users.py", "line": 12, "expression": "request.args.get('id')"},
      "sink": {"file": "src/api/users.py", "line": 18, "expression": "cursor.execute(query)"},
      "path": [12, 14, 16, 18],
      "remediation": "Use parameterized query: cursor.execute('SELECT * FROM users WHERE id = ?', [user_id])",
      "suppressed": false
    }
  ],
  "summary": {
    "total": 5,
    "by_severity": {"Critical": 2, "High": 2, "Medium": 1},
    "by_category": {"sql_injection": 2, "xss": 2, "command_injection": 1}
  }
}
```

**Acceptance Criteria:**

1. All 20 patterns implemented and detectable
2. Each finding includes CWE, severity, source, sink, and path
3. Remediation suggestion provided for each pattern
4. SARIF output compatible with GitHub Code Scanning
5. Full scan of 100-file project completes in < 30s

---

#### STORY 5: Suppression Support

> As a developer, I want suppression comments honored so that I can mark false positives.

**Requirement Details:**

1. Recognize suppression markers (25 patterns from CodeGraph):
   - `# nosec` (Python/Bandit)
   - `// NOLINT` (C++/Go)
   - `// noinspection` (Java/Kotlin)
   - `@SuppressWarnings("security")` (Java)
   - `/* eslint-disable security/... */` (JS/TS)
   - `# type: ignore[security]` (Python)
2. Suppression applies to the line or block where marker appears
3. Suppressed findings tracked separately (not hidden, just marked)
4. Report suppression count in summary

**Acceptance Criteria:**

1. All 25 suppression marker patterns recognized
2. Suppressed findings marked but not removed from results
3. `include_suppressed` parameter controls visibility
4. Suppression count reported in summary

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| CFG/DFG/Taint Analysis | System | KSA-164 | Core analysis infrastructure |
| Tree-sitter Core | System | KSA-145 | AST parsing |
| Entry Point Detection | System | KSA-162 | Identifies HTTP handlers as scan targets |
| Call Graph | Optional | KSA-154 | Inter-procedural context |
| Taint Config | Configuration | N/A | Source/sink/sanitizer registry |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | Development Team Lead | Approve requirements, prioritize |
| Developer | Code Intelligence Team | Implement pattern matching engine |
| Security Engineer | Security Team | Define patterns, validate findings |
| QA | QA Team | Verify detection accuracy |
| Users | AI Agent developers, Security teams | Consume injection findings |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| High false positive rate without inter-procedural analysis | High | High | Confidence scoring, focus on direct paths |
| Framework-specific sanitizers not recognized | Medium | Medium | Extensible sanitizer registry |
| Performance on large codebases (1000+ files) | Medium | Medium | Incremental scanning, file-level caching |
| New injection patterns emerge (AI-specific, etc.) | Low | Medium | Extensible pattern registry |

### 5.2 Assumptions

- KSA-164 taint trace provides reliable source-to-sink paths
- Intra-procedural analysis catches 70%+ of real injection vulnerabilities
- CWE classification is well-defined for all 20 patterns
- SARIF format is stable and widely supported by CI/CD tools
- Suppression markers are standardized enough for reliable detection

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Single file scan < 2s | All 20 patterns |
| Performance | 100-file project scan < 30s | Full scan |
| Accuracy | True positive rate >= 80% | On OWASP benchmark |
| Accuracy | False positive rate < 30% | With sanitizer recognition |
| Extensibility | New patterns via config | No code change |
| Integration | SARIF output | GitHub/GitLab compatible |
| Suppression | 25 marker patterns | Industry standard markers |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-165 | [Security] Injection Detection (20 patterns) | To Do | Task | Main ticket |
| KSA-144 | Code Intelligence v2 — Graph Engine + Static Analysis | To Do | Epic | Parent epic |
| KSA-164 | [Security] Control Flow + Data Flow Analysis | To Do | Task | Prerequisite (CFG/DFG/Taint) |
| KSA-145 | [Tree-sitter] Core Integration | To Do | Task | Prerequisite (AST) |
| KSA-162 | [Quality] Entry Point Detection | To Do | Task | Related (HTTP handler targets) |
| KSA-154 | [Graph] Call Graph | To Do | Task | Related (inter-procedural context) |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Injection | Vulnerability where untrusted data is interpreted as code/commands |
| CWE | Common Weakness Enumeration — standardized vulnerability classification |
| SARIF | Static Analysis Results Interchange Format — standard output format |
| Taint Source | Origin of untrusted data (user input, network) |
| Taint Sink | Dangerous operation (SQL exec, shell exec, file write) |
| Sanitizer | Function that neutralizes dangerous data (escaping, validation) |
| Suppression | Developer-placed marker indicating intentional acceptance of risk |

### Reference Documents

| Document | Location |
|----------|----------|
| CodeGraph vs FEC Comparison | documents/CodeGraph-vs-FEC-Comparison.md |
| OWASP Top 10 (2021) | https://owasp.org/Top10/ |
| CWE/SANS Top 25 | https://cwe.mitre.org/top25/ |
| SARIF Specification | https://docs.oasis-open.org/sarif/sarif/v2.1.0/ |
| KSA-164 BRD (CFG/DFG) | documents/KSA-164/BRD.md |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
