# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-176: [Kotlin] Security Analysis

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-176 |
| Title | [Kotlin] Security Analysis |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-26 |
| Status | Draft |
| Parent Epic | KSA-171 |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-26 | BA Agent | Initiate document from Jira ticket KSA-176 |

---

## 1. Introduction

### 1.1 Scope

Port the Security Analysis module from mcp-code-intelligence-nodejs to Kotlin/JVM. This is Batch K5 in the Feature Parity Sync epic (KSA-171).

The Security Analysis module provides:
- Control Flow Graph (CFG) construction from AST
- Data Flow Graph (DFG) construction from AST
- Taint analysis (source-to-sink data flow tracking)
- Vulnerability detection: SQL injection, XSS, command injection, SSRF, IDOR
- Security misconfiguration detection
- Vulnerability severity scoring

### 1.2 Out of Scope

- Python implementation (covered by KSA-182)
- Tree-sitter parsing (covered by KSA-172)
- Graph engine (covered by KSA-173)
- UI for security findings (covered by KSA-170 child tickets)
- Runtime security monitoring (not in scope for static analysis)

### 1.3 Preliminary Requirements

| Prerequisite | Description | Status |
|-------------|-------------|--------|
| KSA-172 (K1) | Tree-sitter parsers must be complete | Required |
| KSA-173 (K2) | Graph engine must be complete | Required |
| KSA-144 Batch 5 | nodejs v2 security module as reference | Required |

---

## 2. Business Requirements

### 2.1 High Level Process Map

The Security Analysis module operates in a pipeline:

1. **Input**: Source code files (already parsed into AST by K1)
2. **CFG Construction**: Build control flow graph from AST
3. **DFG Construction**: Build data flow graph from AST
4. **Taint Source Identification**: Find user input entry points
5. **Taint Sink Identification**: Find dangerous operations
6. **Taint Propagation**: Track data flow from sources to sinks
7. **Vulnerability Classification**: Categorize findings by type
8. **Severity Scoring**: Assign severity based on impact and exploitability
9. **Output**: Vulnerability report with taint paths

![Business Flow](diagrams/business-flow.png)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source |
|---|-----------------|----------|--------|
| 1 | As a developer, I want CFG construction so that control flow paths are analyzed | MUST HAVE | KSA-176 |
| 2 | As a developer, I want DFG construction so that data dependencies are tracked | MUST HAVE | KSA-176 |
| 3 | As a developer, I want taint analysis so that I can find data flow vulnerabilities | MUST HAVE | KSA-176 |
| 4 | As a developer, I want SQL injection detection so that database queries are safe | MUST HAVE | KSA-176 |
| 5 | As a developer, I want XSS detection so that user output is sanitized | MUST HAVE | KSA-176 |
| 6 | As a developer, I want command injection detection so that system calls are safe | MUST HAVE | KSA-176 |
| 7 | As a developer, I want SSRF detection so that server-side requests are validated | SHOULD HAVE | KSA-176 |
| 8 | As a developer, I want IDOR detection so that authorization is enforced | SHOULD HAVE | KSA-176 |
| 9 | As a developer, I want misconfiguration detection so that security settings are correct | COULD HAVE | KSA-176 |
| 10 | As a developer, I want severity scoring so that I can prioritize fixes | MUST HAVE | KSA-176 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Developer invokes `analyze_security` MCP tool with a file or directory path

**Step 2:** System loads AST for target files (from parser cache or fresh parse)

**Step 3:** System constructs CFG for each function/method

**Step 4:** System constructs DFG tracking variable assignments and data flow

**Step 5:** System identifies taint sources (user inputs, environment variables, file reads)

**Step 6:** System identifies taint sinks (SQL queries, exec, eval, fetch, file writes)

**Step 7:** System propagates taint through DFG, respecting sanitization

**Step 8:** System classifies each source→sink path as a vulnerability type

**Step 9:** System scores severity and generates recommendations

**Step 10:** System returns structured vulnerability report

---

#### STORY 1: CFG Construction

> As a developer, I want CFG construction so that control flow paths are analyzed

**Requirement Details:**

1. Build CFG from AST for each function/method
2. Handle: sequential statements, if/else, switch/case, for/while loops, try/catch, return/throw
3. Support all 12 languages (language-specific control flow patterns)
4. Identify unreachable code paths
5. Handle async/await control flow

**Acceptance Criteria:**

1. CFG correctly represents all control flow paths for test fixtures
2. Branch nodes have correct true/false edges
3. Loop back-edges correctly identified
4. Exception handling paths included
5. Matches nodejs reference output for same input

---

#### STORY 2: DFG Construction

> As a developer, I want DFG construction so that data dependencies are tracked

**Requirement Details:**

1. Track variable definitions (assignments, parameters, declarations)
2. Track variable uses (reads, function arguments, return values)
3. Handle: destructuring, spread operators, object property access
4. Cross-function data flow via call graph (from K2)
5. Handle closures and captured variables

**Acceptance Criteria:**

1. All variable definitions correctly identified
2. All variable uses correctly linked to definitions
3. Cross-function flow tracked via call graph edges
4. Closure captures correctly modeled
5. Matches nodejs reference output

---

#### STORY 3: Taint Analysis

> As a developer, I want taint analysis so that I can find data flow vulnerabilities

**Requirement Details:**

1. Define taint sources: `req.params`, `req.body`, `req.query`, `req.headers`, `process.env`, `fs.readFile`, user input functions
2. Define taint sinks: SQL query functions, `exec()`, `eval()`, `innerHTML`, `fetch()`, `fs.writeFile()`
3. Forward taint propagation through assignments and function calls
4. Sanitization functions break taint chain (e.g., `escape()`, `sanitize()`, `parseInt()`)
5. Cross-file taint tracking using call graph
6. Handle taint through object properties (`obj.tainted = input; use(obj.tainted)`)

**Acceptance Criteria:**

1. All known vulnerabilities in test fixtures detected
2. Sanitization correctly breaks taint chain
3. Cross-file taint paths correctly identified
4. Object property taint tracked
5. False positive rate < 20% on benchmark suite
6. Matches nodejs detection results

---

#### STORY 4: SQL Injection Detection

> As a developer, I want SQL injection detection so that database queries are safe

**Requirement Details:**

1. Detect string concatenation in SQL queries
2. Detect template literal interpolation in SQL
3. Recognize safe patterns: parameterized queries, prepared statements, ORM methods
4. Support: raw SQL, query builders, ORM query methods

**Acceptance Criteria:**

1. `query("SELECT * FROM users WHERE id = " + userId)` → detected
2. `query("SELECT * FROM users WHERE id = ?", [userId])` → safe
3. `db.users.findById(userId)` → safe (ORM)
4. All test fixture SQL injections detected

---

#### STORY 5: XSS Detection

> As a developer, I want XSS detection so that user output is sanitized

**Requirement Details:**

1. Detect unsanitized user input in HTML output
2. Detect `innerHTML` assignments with tainted data
3. Detect `document.write()` with tainted data
4. Recognize safe patterns: template engines with auto-escaping, `textContent`

**Acceptance Criteria:**

1. `res.send("<div>" + req.query.name + "</div>")` → detected
2. `element.innerHTML = userInput` → detected
3. `element.textContent = userInput` → safe
4. Template with auto-escape → safe

---

#### STORY 6: Command Injection Detection

> As a developer, I want command injection detection so that system calls are safe

**Requirement Details:**

1. Detect tainted data in `exec()`, `spawn()`, `system()` calls
2. Detect shell command construction with string concatenation
3. Recognize safe patterns: allowlisted commands, argument arrays (not shell)

**Acceptance Criteria:**

1. `exec("rm -rf " + userInput)` → detected
2. `spawn("ls", ["-la", userDir])` → safe (array args, no shell)
3. `exec(allowedCommands[userChoice])` → safe (allowlist)

---

#### STORY 7: SSRF Detection

> As a developer, I want SSRF detection so that server-side requests are validated

**Requirement Details:**

1. Detect tainted URLs in `fetch()`, `axios()`, `http.get()` calls
2. Detect URL construction from user input
3. Recognize safe patterns: URL allowlisting, domain validation

**Acceptance Criteria:**

1. `fetch(req.body.url)` → detected
2. `fetch("https://api.example.com/" + req.params.path)` → detected
3. `fetch(ALLOWED_URLS[req.body.service])` → safe

---

#### STORY 8: IDOR Detection

> As a developer, I want IDOR detection so that authorization is enforced

**Requirement Details:**

1. Detect direct use of user-supplied IDs in database queries without authorization check
2. Identify patterns: `db.find(req.params.id)` without prior auth middleware
3. Recognize safe patterns: authorization middleware, ownership checks

**Acceptance Criteria:**

1. `db.users.findById(req.params.id)` without auth → detected
2. Same with `requireAuth()` middleware → safe
3. `db.users.findById(req.params.id).where({owner: req.user.id})` → safe

---

#### STORY 9: Misconfiguration Detection

> As a developer, I want misconfiguration detection so that security settings are correct

**Requirement Details:**

1. Detect disabled security headers (CORS *, no CSRF, no rate limiting)
2. Detect hardcoded secrets/credentials
3. Detect insecure defaults (debug mode in production, verbose errors)
4. Detect missing HTTPS enforcement

**Acceptance Criteria:**

1. `cors({ origin: '*' })` → detected
2. `const API_KEY = "sk-abc123"` → detected
3. `app.set('debug', true)` in production config → detected

---

#### STORY 10: Severity Scoring

> As a developer, I want severity scoring so that I can prioritize fixes

**Requirement Details:**

1. Score based on: vulnerability type, data sensitivity, exploitability
2. Levels: Critical, High, Medium, Low
3. Scoring criteria:
   - Critical: RCE (command injection), auth bypass
   - High: SQL injection, SSRF to internal services
   - Medium: XSS (stored), IDOR
   - Low: XSS (reflected), info disclosure, misconfiguration

**Acceptance Criteria:**

1. Command injection → Critical
2. SQL injection → High
3. Stored XSS → Medium
4. Reflected XSS → Low
5. Scoring matches nodejs reference

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| KSA-172 | System | K1 | Tree-sitter parsers (AST input) |
| KSA-173 | System | K2 | Graph engine (call graph for cross-file taint) |
| KSA-144 Batch 5 | System | Reference | nodejs security module as source of truth |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | Duc Nguyen Minh | Accept deliverables |
| Tech Lead | Duc Nguyen Minh | Architecture review |
| Developer | Dev Team | Implementation |
| QA | QA Team | Testing |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| High false positive rate | Medium | Medium | Tune with benchmark suite, configurable sensitivity |
| Performance on large codebases | Medium | Medium | Limit analysis depth, use caching |
| Language-specific patterns missed | High | Low | Comprehensive test fixtures per language |
| Cross-file analysis complexity | High | Medium | Limit call depth, timeout per analysis |

### 5.2 Assumptions

- AST from K1 is correct and complete
- Call graph from K2 is available for cross-file analysis
- nodejs reference implementation is the source of truth for detection rules
- Test fixtures cover all vulnerability patterns

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Security scan < 30s for 500 files | Wall clock time |
| Performance | Single file scan < 2s | Per-file analysis |
| Accuracy | Detection rate > 90% | On known vulnerability fixtures |
| Accuracy | False positive rate < 20% | On clean code fixtures |
| Parity | > 95% match with nodejs | Same findings for same input |

---

## 7. Related Tickets

| Ticket Key | Summary | Type | Relationship |
|------------|---------|------|--------------|
| KSA-176 | [Kotlin] Security Analysis | Story | Main ticket |
| KSA-171 | Feature Parity Sync Epic | Epic | Parent |
| KSA-172 | [Kotlin] Tree-sitter Parsers | Story | Dependency (K1) |
| KSA-173 | [Kotlin] Graph Engine | Story | Dependency (K2) |
| KSA-144 | nodejs v2 Epic | Epic | Reference implementation |
| KSA-182 | [Python] Security Analysis | Story | Python equivalent |

---

## 8. Appendix

### Taint Source/Sink Reference

**Sources (user-controlled input):**
- `req.params.*`, `req.body.*`, `req.query.*`, `req.headers.*`
- `process.env.*` (partially trusted)
- `fs.readFile()`, `readline()`
- Function parameters from external callers

**Sinks (dangerous operations):**
- SQL: `query()`, `execute()`, `raw()`, `$queryRaw()`
- Command: `exec()`, `spawn()`, `system()`, `eval()`
- XSS: `innerHTML`, `document.write()`, `res.send()` (without encoding)
- SSRF: `fetch()`, `axios()`, `http.get()`, `request()`
- File: `fs.writeFile()`, `fs.unlink()`

**Sanitizers (break taint chain):**
- `escape()`, `encodeURIComponent()`, `sanitize()`
- `parseInt()`, `Number()` (type coercion)
- `validator.isEmail()`, `validator.isURL()`
- Parameterized query placeholders (`?`, `$1`)

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
