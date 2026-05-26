# Software Test Cases (STC)

## MCP Code Intelligence — KSA-176: [Kotlin] Security Analysis

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-176 |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-26 |
| Related STP | STP-v1-KSA-176.docx |

---

## 1. Property-Based Tests (PBT)

| ID | Property | Generator | Invariant |
|----|----------|-----------|-----------|
| PBT-001 | CFG has single entry/exit | Random function ASTs | entry count == 1, exit count == 1 |
| PBT-002 | DFG edges reference valid nodes | Random DFGs | All edge source/target exist in node set |
| PBT-003 | Taint only grows (monotone) | Random taint paths | tainted_set(n+1) ⊇ tainted_set(n) unless sanitizer |
| PBT-004 | Sanitizer breaks taint | Random paths with sanitizer | No vulnerability after sanitizer |
| PBT-005 | No vulnerability without source | Random code without sources | vulnerabilities == [] |
| PBT-006 | Severity ordering | Random vulnerabilities | CRITICAL > HIGH > MEDIUM > LOW |
| PBT-007 | Deterministic results | Same input twice | results1 == results2 |
| PBT-008 | Timeout respected | Large inputs + short timeout | analysis completes within timeout + 10% |

---

## 2. Unit Tests (UT)

### 2.1 CFG Builder

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| UT-001 | Linear statements | `a; b; c;` | Linear chain: entry→a→b→c→exit | P0 |
| UT-002 | If/else branch | `if(x) {a} else {b}` | Diamond: entry→branch→a/b→merge→exit | P0 |
| UT-003 | If without else | `if(x) {a}` | Branch with direct merge edge | P0 |
| UT-004 | While loop | `while(x) {a}` | Header with back-edge from body | P0 |
| UT-005 | For loop | `for(i in list) {a}` | Same as while structure | P0 |
| UT-006 | Nested if | `if(x) { if(y) {a} }` | Nested diamond | P0 |
| UT-007 | Return early | `if(x) return; a;` | Return→exit, a marked unreachable | P0 |
| UT-008 | Try/catch | `try {a} catch {b}` | Normal + exception paths | P0 |
| UT-009 | Switch/case | `switch(x) { case 1: a; case 2: b; }` | Multiple branch edges | P1 |
| UT-010 | Throw statement | `throw new Error()` | Edge to catch or exit | P1 |
| UT-011 | Async/await | `await fetch()` | Treated as sequential | P1 |
| UT-012 | Empty function | `function f() {}` | entry→exit only | P1 |
| UT-013 | Multiple returns | `if(x) return 1; return 2;` | Both return→exit | P0 |
| UT-014 | Break in loop | `while(x) { if(y) break; }` | Break edge to after-loop | P1 |
| UT-015 | Continue in loop | `while(x) { if(y) continue; a; }` | Continue edge to header | P1 |

### 2.2 DFG Builder

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| UT-016 | Simple assignment | `x = 1` | DEF edge for x | P0 |
| UT-017 | Variable use | `y = x + 1` | USE edge for x, DEF edge for y | P0 |
| UT-018 | Function parameter | `function f(x) { return x }` | x is DEF at param, USE at return | P0 |
| UT-019 | Object property | `obj.name = input` | DEF for obj.name | P0 |
| UT-020 | Destructuring | `const {a, b} = obj` | DEF for a, DEF for b | P0 |
| UT-021 | Spread | `const x = {...obj}` | All obj properties flow to x | P1 |
| UT-022 | Array index | `arr[i] = val` | DEF for arr[*] | P1 |
| UT-023 | Function call arg | `f(x)` | CALL_ARG edge x→f.param | P0 |
| UT-024 | Function return | `y = f(x)` | CALL_RETURN edge f.return→y | P0 |
| UT-025 | Chained calls | `a.b().c()` | Correct flow through chain | P1 |
| UT-026 | Ternary | `x = cond ? a : b` | Both a and b flow to x | P1 |
| UT-027 | Closure capture | `const f = () => x` | x captured from outer scope | P1 |

### 2.3 Taint Analyzer

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| UT-028 | Direct source→sink | `query(req.body.id)` | 1 vulnerability | P0 |
| UT-029 | Indirect via variable | `x = req.body.id; query(x)` | 1 vulnerability | P0 |
| UT-030 | Sanitized path | `x = escape(req.body.id); query(x)` | 0 vulnerabilities | P0 |
| UT-031 | Multiple paths | Source→sink1, source→sink2 | 2 vulnerabilities | P0 |
| UT-032 | No source | `query("SELECT 1")` | 0 vulnerabilities | P0 |
| UT-033 | No sink | `const x = req.body.id; log(x)` | 0 vulnerabilities | P0 |
| UT-034 | Object property taint | `obj.x = req.body; query(obj.x)` | 1 vulnerability | P0 |
| UT-035 | Cross-function | `function get() { return req.body.id } query(get())` | 1 vulnerability | P0 |
| UT-036 | Depth limit | 15-hop taint path, maxDepth=10 | 0 vulnerabilities (not reached) | P1 |
| UT-037 | Circular path | A→B→A (cycle) | No infinite loop, 0 vulns | P0 |
| UT-038 | Partial sanitization | `parseInt(req.body.id)` for SQL | 0 SQL vulns (parseInt sanitizes) | P0 |
| UT-039 | Type coercion | `Number(req.body.id)` | 0 injection vulns | P1 |
| UT-040 | Conditional taint | `if(valid) { query(input) }` | 1 vulnerability (conservative) | P1 |
| UT-041 | Array spread taint | `[...req.body]` passed to sink | 1 vulnerability | P1 |
| UT-042 | Timeout handling | Very large file + 1s timeout | Returns partial, timedOut=true | P1 |

### 2.4 SQL Injection Detector

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| UT-043 | String concat | `"SELECT * FROM users WHERE id=" + id` | Detected, HIGH | P0 |
| UT-044 | Template literal | `` `SELECT * FROM users WHERE id=${id}` `` | Detected, HIGH | P0 |
| UT-045 | Parameterized (safe) | `query("SELECT * FROM users WHERE id=?", [id])` | Not detected | P0 |
| UT-046 | ORM method (safe) | `User.findById(id)` | Not detected | P0 |
| UT-047 | Prisma raw (unsafe) | `prisma.$queryRaw(sql)` | Detected | P1 |
| UT-048 | Knex raw (unsafe) | `knex.raw(sql)` | Detected | P1 |

### 2.5 XSS Detector

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| UT-049 | innerHTML | `el.innerHTML = userInput` | Detected, MEDIUM | P0 |
| UT-050 | document.write | `document.write(userInput)` | Detected, MEDIUM | P0 |
| UT-051 | res.send | `res.send(userInput)` | Detected, MEDIUM | P0 |
| UT-052 | textContent (safe) | `el.textContent = userInput` | Not detected | P0 |
| UT-053 | Escaped output | `res.send(escape(userInput))` | Not detected | P0 |
| UT-054 | DOMPurify (safe) | `el.innerHTML = DOMPurify.sanitize(input)` | Not detected | P1 |

### 2.6 Command Injection Detector

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| UT-055 | exec with concat | `exec("rm " + userInput)` | Detected, CRITICAL | P0 |
| UT-056 | exec with template | `` exec(`rm ${userInput}`) `` | Detected, CRITICAL | P0 |
| UT-057 | spawn array (safe) | `spawn("ls", ["-la", dir])` | Not detected | P0 |
| UT-058 | eval | `eval(userInput)` | Detected, CRITICAL | P0 |
| UT-059 | execFile (safer) | `execFile("/bin/ls", [dir])` | Not detected (no shell) | P1 |
| UT-060 | shell: true | `spawn(cmd, {shell: true})` with tainted cmd | Detected | P1 |

### 2.7 SSRF Detector

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| UT-061 | fetch with user URL | `fetch(req.body.url)` | Detected, HIGH | P0 |
| UT-062 | axios with user URL | `axios.get(req.body.url)` | Detected, HIGH | P0 |
| UT-063 | URL construction | `fetch("http://" + req.body.host)` | Detected | P0 |
| UT-064 | Allowlisted (safe) | `fetch(ALLOWED[req.body.service])` | Not detected | P1 |
| UT-065 | Internal URL only | `fetch("http://localhost:" + port)` with tainted port | Detected | P1 |

### 2.8 IDOR Detector

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| UT-066 | Direct ID use | `db.find(req.params.id)` no auth | Detected, MEDIUM | P0 |
| UT-067 | With auth middleware | `requireAuth(); db.find(req.params.id)` | Not detected | P0 |
| UT-068 | Ownership check | `db.find({id: req.params.id, owner: req.user.id})` | Not detected | P0 |
| UT-069 | Admin bypass | `if(req.user.isAdmin) db.find(id)` | Not detected | P1 |
| UT-070 | Nested resource | `db.find(parentId).children.find(childId)` | Detected if no parent auth | P1 |

### 2.9 Misconfiguration Detector

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| UT-071 | CORS wildcard | `cors({ origin: '*' })` | Detected, LOW | P0 |
| UT-072 | Hardcoded secret | `const KEY = "sk-abc123"` | Detected, MEDIUM | P0 |
| UT-073 | Debug mode | `app.set('debug', true)` | Detected, LOW | P1 |
| UT-074 | No HTTPS | `http.createServer()` without redirect | Detected, LOW | P1 |
| UT-075 | Env var secret (safe) | `const KEY = process.env.API_KEY` | Not detected | P1 |

### 2.10 Severity Scoring

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| UT-076 | Command injection severity | exec with user input | CRITICAL | P0 |
| UT-077 | Misconfiguration severity | CORS wildcard | LOW | P0 |

---

## 3. Integration Tests (IT)

| ID | Test Case | Components | Input | Expected | Priority |
|----|-----------|------------|-------|----------|----------|
| IT-001 | Parse → CFG | Parser + CFGBuilder | TypeScript file | Valid CFG | P0 |
| IT-002 | Parse → DFG | Parser + CFG + DFGBuilder | TypeScript file | Valid DFG | P0 |
| IT-003 | Full pipeline - SQL injection | All | Vulnerable TS file | SQL injection found | P0 |
| IT-004 | Full pipeline - XSS | All | Vulnerable TS file | XSS found | P0 |
| IT-005 | Full pipeline - clean code | All | Safe TS file | 0 vulnerabilities | P0 |
| IT-006 | Cross-file taint | All + CallGraph | 2-file project | Cross-file vuln found | P0 |
| IT-007 | Multiple vulnerabilities | All | File with 3 vulns | All 3 detected | P0 |
| IT-008 | Large file performance | All | 1000-line file | < 2s | P1 |
| IT-009 | 100-file project | All | Medium project | < 15s | P1 |
| IT-010 | Incremental re-scan | All + Cache | Changed 1 file | Only that file re-analyzed | P1 |
| IT-011 | Mixed languages | All | TS + JS + Python files | All analyzed | P1 |
| IT-012 | Severity distribution | All | Mixed vulns | Correct severity per type | P1 |
| IT-013 | Timeout enforcement | All | Huge file + 5s timeout | Partial results returned | P1 |
| IT-014 | Error recovery | All | File with parse errors | Skip bad file, continue | P1 |
| IT-015 | Empty project | All | No source files | Empty result, no error | P2 |

---

## 4. E2E API Tests (E2E-API)

| ID | Test Case | MCP Tool | Input | Expected | Priority |
|----|-----------|----------|-------|----------|----------|
| E2E-API-001 | SQL injection via MCP | analyze_security | Vulnerable project | Vuln report with SQL injection | P0 |
| E2E-API-002 | XSS via MCP | analyze_security | XSS-vulnerable file | Vuln report with XSS | P0 |
| E2E-API-003 | Command injection via MCP | analyze_security | CMD injection file | Vuln report with CMD injection | P0 |
| E2E-API-004 | SSRF via MCP | analyze_security | SSRF-vulnerable file | Vuln report with SSRF | P0 |
| E2E-API-005 | IDOR via MCP | analyze_security | IDOR-vulnerable file | Vuln report with IDOR | P1 |
| E2E-API-006 | Misconfiguration via MCP | analyze_security | Misconfigured file | Vuln report with misconfig | P1 |
| E2E-API-007 | Clean project | analyze_security | Safe project | Empty vulnerabilities | P0 |
| E2E-API-008 | Severity filter | analyze_security | threshold=high | Only high+ returned | P1 |
| E2E-API-009 | Check filter | analyze_security | checks=[sql_injection] | Only SQL checked | P1 |
| E2E-API-010 | Invalid path | analyze_security | Non-existent path | Error response | P1 |
| E2E-API-011 | Timeout parameter | analyze_security | timeout=1 + large project | Partial results | P2 |
| E2E-API-012 | Taint path in response | analyze_security | SQL injection | taint_path array populated | P0 |

---

## 5. System Integration Tests (SIT)

| ID | Test Case | Description | Automation | Priority |
|----|-----------|-------------|------------|----------|
| SIT-001 | Performance - single file | 1000-line file < 2s | Automated | P0 |
| SIT-002 | Performance - 500 files | Full scan < 30s | Automated | P0 |
| SIT-003 | False positive rate | Clean code benchmark < 20% FP | Automated | P0 |
| SIT-004 | Detection rate | Known vulns benchmark > 90% | Automated | P0 |
| SIT-005 | Memory usage | 500-file scan < 1GB RSS | Automated | P1 |
| SIT-006 | Concurrent scans | 3 parallel scans succeed | Automated | P1 |
| SIT-007 | Parity - SQL injection | Same results as nodejs | Automated | P0 |
| SIT-008 | Parity - XSS | Same results as nodejs | Automated | P0 |
| SIT-009 | Parity - all types | > 95% match with nodejs | Automated | P0 |
| SIT-010 | Visual review | Human reviews parity diff | Manual | P2 |

---

## 6. Test Data

### Test Fixtures

```
test-fixtures/security/
├── vulnerable/
│   ├── sql-injection-concat.ts
│   ├── sql-injection-template.ts
│   ├── xss-innerhtml.ts
│   ├── xss-res-send.ts
│   ├── command-injection-exec.ts
│   ├── command-injection-eval.ts
│   ├── ssrf-fetch.ts
│   ├── ssrf-axios.ts
│   ├── idor-no-auth.ts
│   └── misconfig-cors.ts
├── safe/
│   ├── parameterized-query.ts
│   ├── escaped-output.ts
│   ├── spawn-array.ts
│   ├── url-allowlist.ts
│   ├── auth-middleware.ts
│   └── env-var-secret.ts
├── cross-file/
│   ├── source-file.ts
│   └── sink-file.ts
├── benchmark/
│   ├── large-clean-project/    # 500 files, no vulns
│   └── large-mixed-project/    # 500 files, known vulns
└── expected/
    ├── sql-injection-concat.json
    ├── xss-innerhtml.json
    └── ... (expected output per fixture)
```
