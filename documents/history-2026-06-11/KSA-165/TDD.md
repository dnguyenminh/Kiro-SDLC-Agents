# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-165: [Security] Injection Detection (20 patterns)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-165 |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-06-05 |
| Related FSD | FSD-v1-KSA-165.docx |

---

## 1. Architecture Overview

The injection detector is a pattern-matching layer on top of the taint analysis engine (KSA-164). It takes taint paths and classifies them against 20 known injection patterns, producing findings with CWE codes and remediation guidance.

```
┌─────────────────────────────────────────────────┐
│ MCP Tool (detect_injections)                     │
├─────────────────────────────────────────────────┤
│ Injection Detection Module (NEW)                  │
│  ├── InjectionScanner (orchestrator)             │
│  ├── PatternMatcher                              │
│  │   ├── SQLInjectionMatcher                     │
│  │   ├── XSSMatcher                              │
│  │   ├── CommandInjectionMatcher                 │
│  │   ├── PathTraversalMatcher                    │
│  │   ├── DeserializationMatcher                  │
│  │   └── LDAPXMLMatcher                          │
│  ├── SuppressionChecker                          │
│  ├── SARIFExporter                               │
│  ├── RemediationProvider                         │
│  └── InjectionPatternRegistry                    │
├─────────────────────────────────────────────────┤
│ Taint Analysis (KSA-164)                         │
│  ├── TaintAnalyzer.taint_trace()                 │
│  └── TaintRegistry (sources/sinks)               │
├─────────────────────────────────────────────────┤
│ Entry Point Detection (KSA-162)                   │
│  └── find_entry_points (scan targets)            │
└─────────────────────────────────────────────────┘
```

---

## 2. Module Design

### 2.1 File Structure

```
src/
├── analyzers/
│   └── security/
│       ├── injection/
│       │   ├── index.ts
│       │   ├── InjectionScanner.ts       # Main orchestrator
│       │   ├── PatternMatcher.ts         # Base pattern matcher
│       │   ├── SuppressionChecker.ts     # nosec/NOLINT detection
│       │   ├── SARIFExporter.ts          # SARIF v2.1.0 output
│       │   ├── RemediationProvider.ts    # Fix suggestions
│       │   ├── InjectionTool.ts          # MCP tool registration
│       │   ├── patterns/
│       │   │   ├── SQLInjectionMatcher.ts
│       │   │   ├── XSSMatcher.ts
│       │   │   ├── CommandInjectionMatcher.ts
│       │   │   ├── PathTraversalMatcher.ts
│       │   │   ├── DeserializationMatcher.ts
│       │   │   └── LDAPXMLMatcher.ts
│       │   └── config/
│       │       ├── injection-patterns.json
│       │       └── suppression-markers.json
```

### 2.2 Key Classes

#### InjectionScanner

```typescript
class InjectionScanner {
  constructor(
    private taintAnalyzer: TaintAnalyzer,
    private entryPointStore: EntryPointStore,
    private matchers: PatternMatcher[],
    private suppressionChecker: SuppressionChecker,
    private sarifExporter: SARIFExporter
  )

  // Scan file for injections
  scanFile(filePath: string, options: ScanOptions): ScanResult

  // Scan workspace (all entry points)
  scanWorkspace(options: ScanOptions): ScanResult

  // Scan single function
  scanFunction(symbolName: string, filePath: string): Finding[]
}
```

#### PatternMatcher (Abstract)

```typescript
abstract class PatternMatcher {
  abstract readonly category: string
  abstract readonly patterns: InjectionPattern[]

  // Check if a taint path matches any pattern in this category
  match(taintPath: TaintPath, context: MatchContext): Finding | null

  // Check if sink matches pattern's sink signature
  protected matchesSink(sink: TaintSink, pattern: InjectionPattern): boolean

  // Check if path has dangerous operation (concat, template, etc.)
  protected hasDangerousOp(path: TaintPath, dangerousOps: string[]): boolean
}
```

#### SQLInjectionMatcher

```typescript
class SQLInjectionMatcher extends PatternMatcher {
  readonly category = 'sql_injection'
  readonly patterns = [
    {id: 1, name: 'String concat in SQL', cwe: 'CWE-89', severity: 'Critical',
     sinkPatterns: ['cursor.execute', 'connection.execute', 'query', 'raw'],
     dangerousOps: ['concat', 'template_literal', 'format_string'],
     safePatterns: ['parameterized', 'placeholder_?', 'placeholder_$']},
    // ... patterns 2-4
  ]

  match(taintPath: TaintPath, context: MatchContext): Finding | null {
    for (const pattern of this.patterns) {
      if (this.matchesSink(taintPath.sink, pattern) &&
          this.hasDangerousOp(taintPath, pattern.dangerousOps) &&
          !this.hasSafePattern(taintPath, pattern.safePatterns)) {
        return this.createFinding(taintPath, pattern, context)
      }
    }
    return null
  }
}
```

#### SuppressionChecker

```typescript
class SuppressionChecker {
  private markers: SuppressionMarker[]

  constructor(markersConfig: SuppressionMarker[]) {
    this.markers = markersConfig
  }

  // Check if a line has suppression marker
  isSuppressed(filePath: string, line: number, source: string): SuppressionInfo | null {
    const lineText = getLineText(filePath, line)
    const prevLineText = getLineText(filePath, line - 1)

    for (const marker of this.markers) {
      if (lineText.includes(marker.pattern) || prevLineText.includes(marker.pattern)) {
        return { marker: marker.pattern, scope: marker.scope, line }
      }
    }
    return null
  }
}
```

#### SARIFExporter

```typescript
class SARIFExporter {
  // Convert findings to SARIF v2.1.0 format
  export(findings: Finding[], toolVersion: string): SARIFLog

  // Create SARIF rule definition from pattern
  private createRule(pattern: InjectionPattern): SARIFRule

  // Create SARIF result from finding
  private createResult(finding: Finding): SARIFResult

  // Create code flow (taint path visualization)
  private createCodeFlow(finding: Finding): SARIFCodeFlow
}
```

---

## 3. Pattern Matching Logic

### 3.1 Detection Flow per Function

```
1. Get taint paths from TaintAnalyzer (KSA-164)
2. For each taint path:
   a. Determine sink category (SQL, shell, fs, html, eval, etc.)
   b. Select appropriate PatternMatcher(s)
   c. Check if path has dangerous operation (concat, template, format)
   d. Check if path has safe pattern (parameterized, escaped)
   e. If dangerous AND not safe → create Finding
   f. Check suppression markers on source/sink lines
   g. Assign CWE, severity, confidence
   h. Generate remediation suggestion
3. Aggregate findings, compute summary
```

### 3.2 Dangerous Operation Detection

```typescript
function hasDangerousOp(taintPath: TaintPath): DangerousOp | null {
  for (const step of taintPath.chain) {
    if (step.action === 'concat') return {type: 'concat', line: step.line}
    if (step.action === 'template_literal') return {type: 'template', line: step.line}
    if (step.action === 'format_string') return {type: 'format', line: step.line}
    if (step.action === 'string_interpolation') return {type: 'interpolation', line: step.line}
  }
  return null // No dangerous op → might be safe (parameterized)
}
```

### 3.3 Safe Pattern Detection

```typescript
function hasSafePattern(taintPath: TaintPath, sinkExpr: string): boolean {
  // Parameterized query indicators
  if (sinkExpr.includes('?') || sinkExpr.includes('$1') || sinkExpr.includes('%s')) return true
  if (sinkExpr.includes('prepare') || sinkExpr.includes('parameterize')) return true

  // Array form for subprocess
  if (sinkExpr.includes('[') && !sinkExpr.includes('shell=True')) return true

  // Escape function in path
  for (const step of taintPath.chain) {
    if (step.action === 'sanitize') return true
  }
  return false
}
```

---

## 4. SARIF Output Structure

```typescript
interface SARIFLog {
  $schema: string  // SARIF v2.1.0 schema URL
  version: '2.1.0'
  runs: [{
    tool: {
      driver: {
        name: 'mcp-code-intelligence'
        version: string
        rules: SARIFRule[]  // One per injection pattern
      }
    }
    results: SARIFResult[]  // One per finding
  }]
}

interface SARIFRule {
  id: string           // e.g., "INJ-SQL-001"
  name: string         // e.g., "SQLInjectionConcat"
  shortDescription: { text: string }
  defaultConfiguration: { level: 'error' | 'warning' | 'note' }
  properties: { tags: string[] }  // ["security", "CWE-89"]
}
```

---

## 5. Remediation Templates

```typescript
const REMEDIATIONS: Record<string, (context: FindingContext) => string> = {
  'sql_concat': (ctx) =>
    `Use parameterized query: \`${ctx.sinkFunction}('${ctx.query.replace(ctx.taintedExpr, '?')}', [${ctx.taintedVar}])\``,

  'xss_innerhtml': (ctx) =>
    `Use textContent instead: \`${ctx.element}.textContent = ${ctx.taintedVar}\` or sanitize with DOMPurify`,

  'command_shell': (ctx) =>
    `Use array form: \`subprocess.run([${ctx.command.split(' ').map(s => `'${s}'`).join(', ')}])\``,

  'path_traversal': (ctx) =>
    `Validate path: \`const safe = path.resolve(baseDir, userPath); if (!safe.startsWith(baseDir)) throw Error()\``,

  'deserialization': (ctx) =>
    `Use safe alternative: \`JSON.parse(${ctx.taintedVar})\` instead of \`${ctx.sinkFunction}(${ctx.taintedVar})\``,
}
```

---

## 6. Performance Considerations

- **Scan targets**: Only scan entry point handlers (not all functions)
- **Pattern short-circuit**: If no taint sources in function, skip immediately
- **Parallel scanning**: Multiple files can be scanned concurrently
- **Caching**: Cache taint results for unchanged functions
- **Incremental**: Only re-scan files that changed since last scan

---

## 7. Implementation Checklist

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | Create module structure | src/analyzers/security/injection/ | 0.5h |
| 2 | Implement PatternMatcher base | PatternMatcher.ts | 1h |
| 3 | Implement SQLInjectionMatcher (4 patterns) | patterns/SQLInjectionMatcher.ts | 3h |
| 4 | Implement XSSMatcher (4 patterns) | patterns/XSSMatcher.ts | 3h |
| 5 | Implement CommandInjectionMatcher (4 patterns) | patterns/CommandInjectionMatcher.ts | 3h |
| 6 | Implement PathTraversalMatcher (3 patterns) | patterns/PathTraversalMatcher.ts | 2h |
| 7 | Implement DeserializationMatcher (3 patterns) | patterns/DeserializationMatcher.ts | 2h |
| 8 | Implement LDAPXMLMatcher (2 patterns) | patterns/LDAPXMLMatcher.ts | 1.5h |
| 9 | Implement SuppressionChecker | SuppressionChecker.ts | 2h |
| 10 | Implement SARIFExporter | SARIFExporter.ts | 3h |
| 11 | Implement RemediationProvider | RemediationProvider.ts | 1.5h |
| 12 | Implement InjectionScanner | InjectionScanner.ts | 2h |
| 13 | Register MCP tool | InjectionTool.ts | 1h |
| 14 | Create pattern config | config/injection-patterns.json | 2h |
| 15 | Unit tests (per pattern) | tests/security/injection/ | 5h |
| 16 | Integration tests (OWASP samples) | tests/integration/ | 3h |
| 17 | SARIF validation tests | tests/sarif/ | 1.5h |

**Total: ~36h (1 week)**

---

## Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
