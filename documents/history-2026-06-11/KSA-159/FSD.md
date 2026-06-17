# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-159: [AI Context] get_edit_context

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-159 |
| Title | [AI Context] get_edit_context - source + callers + tests + git |
| Author | BA + TA Agent |
| Version | 1.0 |
| Date | 2026-05-29 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-159.docx |

---

## 1. Overview

`get_edit_context` is a composite tool that aggregates data from multiple subsystems (code index, call graph, dependency graph, KB memory, git) into a single optimized response. It implements token-budget-aware context assembly.

---

## 2. Use Cases

### UC-1: Get Full Edit Context

| Field | Value |
|-------|-------|
| Actor | AI Agent |
| Trigger | Agent needs to modify a symbol |

**Main Flow:**
1. Agent calls `get_edit_context(symbol: "findCallers")`
2. Service resolves symbol to file + line range
3. Reads source code of the symbol
4. Queries call graph for direct callers (with 2-line context around call site)
5. Finds related test files and extracts relevant test functions
6. Queries KB for memories related to the symbol/file/module
7. Queries git log for recent commits touching the file
8. Assembles response within token budget
9. Returns structured context

**Alternative Flow — Symbol Not Found:**
1. Symbol doesn't resolve
2. Try file:line format
3. If still not found, return error with suggestions

**Alternative Flow — Token Budget Exceeded:**
1. Source + callers exceed budget
2. Truncate callers to top 3
3. Exclude tests, memories, git
4. Report excluded sections in metadata

### UC-2: Get Minimal Context (Source Only)

**Main Flow:**
1. Agent calls with all include_* = false
2. Only source code returned
3. Fast path (< 50ms)

### UC-3: Get Context by File:Line

**Main Flow:**
1. Agent provides `symbol: "src/graph/call-graph-service.ts:35"`
2. Service parses file:line format
3. Finds symbol at that line
4. Proceeds with normal flow

---

## 3. Detailed Specifications

### 3.1 MCP Tool Schema

```json
{
  "name": "get_edit_context",
  "description": "Get everything needed before editing: source + callers + tests + memories + git history",
  "inputSchema": {
    "type": "object",
    "required": ["symbol"],
    "properties": {
      "symbol": {
        "type": "string",
        "description": "Symbol name, Class.method, or file:line"
      },
      "include_callers": { "type": "boolean", "default": true },
      "include_tests": { "type": "boolean", "default": true },
      "include_memories": { "type": "boolean", "default": true },
      "include_git": { "type": "boolean", "default": true },
      "token_budget": { "type": "integer", "default": 4000, "minimum": 500, "maximum": 16000 },
      "caller_depth": { "type": "integer", "default": 1, "minimum": 1, "maximum": 3 }
    }
  }
}
```

### 3.2 Token Budget Algorithm

```
PRIORITY_ORDER = [source, signature, callers, tests, dependencies, memories, git_history, siblings]

function assembleSections(sections, budget):
  result = {}
  usedTokens = 0
  included = []
  excluded = []
  
  for section in PRIORITY_ORDER:
    if section not requested: continue
    
    sectionTokens = estimateTokens(sections[section])
    
    if usedTokens + sectionTokens <= budget:
      result[section] = sections[section]
      usedTokens += sectionTokens
      included.push(section)
    else:
      // Try truncated version
      truncated = truncateToFit(sections[section], budget - usedTokens)
      if truncated:
        result[section] = truncated
        usedTokens += estimateTokens(truncated)
        included.push(section + " (truncated)")
      else:
        excluded.push(section)
  
  return { result, metadata: { tokenCount: usedTokens, included, excluded } }
```

Token estimation: `tokens = text.split(/\s+/).length * 1.3`

### 3.3 Caller Context Extraction

For each caller, include 2 lines before and after the call site:

```typescript
function getCallerContext(callerFile: string, callLine: number): string {
  const lines = readFileSync(callerFile, 'utf-8').split('\n');
  const start = Math.max(0, callLine - 3);  // 2 lines before
  const end = Math.min(lines.length, callLine + 2);  // 2 lines after
  return lines.slice(start, end).join('\n');
}
```

### 3.4 Test Extraction

For related tests, extract the full test function body:

```typescript
function extractTestBody(testFile: string, symbolName: string): TestContext[] {
  // Find test functions that reference the symbol
  const ast = parseFile(testFile);
  const tests = findTestFunctions(ast);  // it(), test(), describe()
  
  return tests
    .filter(t => t.body.includes(symbolName))
    .map(t => ({
      testName: t.name,
      source: t.fullText,
      file: testFile
    }));
}
```

### 3.5 Memory Query

```typescript
function getRelevantMemories(symbol: ResolvedSymbol): Memory[] {
  const queries = [
    symbol.name,                    // exact symbol name
    path.basename(symbol.filePath), // file name
    symbol.parentName,              // class name
  ].filter(Boolean);
  
  const results = memSearch(queries.join(' OR '), { limit: 5, type: 'DECISION,ARCHITECTURE,LESSON_LEARNED' });
  return results.filter(r => r.score > 0.3);  // relevance threshold
}
```

### 3.6 Git History Query

```typescript
function getGitHistory(filePath: string, limit: number = 5): GitCommit[] {
  const output = execSync(
    `git log --oneline --follow -n ${limit} -- "${filePath}"`,
    { encoding: 'utf-8' }
  );
  
  return output.trim().split('\n').map(line => {
    const [hash, ...messageParts] = line.split(' ');
    return { hash, message: messageParts.join(' ') };
  });
}
```

### 3.7 Sibling Extraction

Siblings = other symbols in the same file or same class:

```typescript
function getSiblings(symbol: ResolvedSymbol): Sibling[] {
  if (symbol.parentName) {
    // Same class methods
    return db.prepare(`
      SELECT name, kind, signature, line FROM symbols
      WHERE parent_symbol_id = (SELECT parent_symbol_id FROM symbols WHERE id = ?)
        AND id != ?
      ORDER BY line
    `).all(symbol.id, symbol.id);
  } else {
    // Same file top-level symbols
    return db.prepare(`
      SELECT name, kind, signature, line FROM symbols
      WHERE file_path = ? AND parent_symbol_id IS NULL AND id != ?
      ORDER BY line
    `).all(symbol.filePath, symbol.id);
  }
}
```

---

## 4. Error Handling

| Scenario | Response |
|----------|----------|
| Symbol not found | Error with suggestions |
| File not readable | Skip source, return what's available |
| Git not available | Skip git_history section |
| KB empty | Skip memories section |
| All sections fail | Return error |

---

## 5. Integration Points

| Component | Usage |
|-----------|-------|
| SymbolResolver (KSA-154) | Resolve symbol name |
| CallGraphService (KSA-154) | Find callers |
| DependencyGraphService (KSA-155) | Find dependencies |
| TestDetector (KSA-156) | Find related tests |
| KB Memory (existing) | Search memories |
| Git CLI | Log history |
| File system | Read source code |

---

## 6. Test Scenarios

| # | Scenario | Expected |
|---|----------|----------|
| T-1 | Full context, all sections | All 7 sections populated |
| T-2 | Token budget 500 | Only source + signature |
| T-3 | Token budget 2000 | Source + callers + tests |
| T-4 | Symbol not found | Error with suggestions |
| T-5 | No callers | callers section empty |
| T-6 | No tests | tests section empty |
| T-7 | No git history | git_history section empty |
| T-8 | File:line format | Resolves correctly |
| T-9 | Class.method format | Resolves correctly |
| T-10 | Large symbol (500 lines) | Source truncated to fit budget |
