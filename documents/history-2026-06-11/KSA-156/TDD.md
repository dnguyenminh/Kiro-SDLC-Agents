# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-156: [Graph] Impact Analysis

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-156 |
| Title | [Graph] Impact Analysis - blast radius prediction |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-29 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-156.docx |
| Related TDD | TDD-v1-KSA-154.docx (Call Graph), TDD-v1-KSA-155.docx (Dep Graph) |

---

## 1. Architecture Overview

```
MCP Server
    |
    +-- registerTool("code_impact", handler)
            |
            v
    ImpactAnalysisService
        +-- analyzeImpact(symbol, action, depth)
            |
            +-- CallGraphService (KSA-154)
            |       +-- findCallers(symbol, depth)
            |
            +-- DependencyGraphService (KSA-155)
            |       +-- query(file, "incoming", depth)
            |
            +-- SymbolResolver (KSA-154)
            |       +-- resolve(symbolName)
            |
            +-- TestDetector (new)
            |       +-- findRelatedTests(symbol, callers)
            |
            +-- RecommendationEngine (new)
                    +-- generate(impacts, action)
```

---

## 2. Detailed Design

### 2.1 Module: ImpactAnalysisService

**File:** `src/graph/impact-analysis-service.ts`

```typescript
import { CallGraphService } from './call-graph-service';
import { DependencyGraphService } from './dependency-graph-service';
import { SymbolResolver } from './symbol-resolver';
import { TestDetector } from './test-detector';

interface ImpactItem {
  symbol: string;
  qualifiedName?: string;
  file: string;
  line: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
  chain?: string[];
  callSite?: string;
}

interface ImpactResult {
  symbol: string;
  action: string;
  blastRadius: {
    summary: { critical: number; high: number; medium: number; low: number };
    totalAffected: number;
    affectedFiles: number;
    affectedTests: number;
  };
  impacts: ImpactItem[];
  affectedTests: Array<{ file: string; reason: string }>;
  recommendations: string[];
  metadata: { queryTimeMs: number; depthSearched: number; truncated: boolean };
}

export class ImpactAnalysisService {
  private callGraph: CallGraphService;
  private depGraph: DependencyGraphService;
  private resolver: SymbolResolver;
  private testDetector: TestDetector;
  private db: Database;

  async analyzeImpact(
    symbolName: string,
    action: 'modify' | 'delete' | 'rename' = 'modify',
    depth: number = 3,
    includeTests: boolean = true,
    severityThreshold: string = 'low'
  ): Promise<ImpactResult> {
    const startTime = Date.now();
    const clampedDepth = Math.min(Math.max(depth, 1), 5);

    // 1. Resolve symbol
    const resolved = this.resolver.resolve(symbolName);
    if (resolved.length === 0) {
      return this.symbolNotFoundResponse(symbolName);
    }

    const impacts: ImpactItem[] = [];
    const sourceFile = resolved[0].filePath;

    // 2. Find callers via call graph
    const callerResult = await this.callGraph.findCallers(symbolName, clampedDepth, 100);
    for (const caller of callerResult.results) {
      const severity = this.classifySeverity(caller.depthLevel, action, 'caller');
      impacts.push({
        symbol: caller.symbol,
        qualifiedName: caller.qualifiedName,
        file: caller.filePath,
        line: caller.callSiteLine,
        severity,
        reason: caller.depthLevel === 1 ? 'Direct caller' : `Transitive caller (depth ${caller.depthLevel})`,
        chain: this.buildChain(symbolName, caller),
        callSite: caller.callSiteLine ? `line ${caller.callSiteLine}` : undefined
      });
    }

    // 3. Find interface implementors
    const implImpacts = await this.findImplementorImpacts(resolved, symbolName);
    impacts.push(...implImpacts);

    // 4. Find file-level dependents
    const depResult = await this.depGraph.query(sourceFile, 'incoming', Math.min(clampedDepth, 2), false, 50);
    for (const dep of depResult.results) {
      // Don't duplicate if already in callers
      if (!impacts.some(i => i.file === dep.file)) {
        impacts.push({
          symbol: dep.file,
          file: dep.file,
          line: 0,
          severity: action === 'delete' ? 'high' : 'medium',
          reason: 'Imports modified file'
        });
      }
    }

    // 5. Find related tests
    const affectedTests: Array<{ file: string; reason: string }> = [];
    if (includeTests) {
      const tests = this.testDetector.findRelatedTests(resolved, impacts);
      for (const test of tests) {
        affectedTests.push(test);
        if (!impacts.some(i => i.file === test.file)) {
          impacts.push({
            symbol: test.file,
            file: test.file,
            line: 0,
            severity: 'high',
            reason: test.reason
          });
        }
      }
    }

    // 6. Filter by severity threshold
    const filtered = this.filterBySeverity(impacts, severityThreshold);

    // 7. Deduplicate and sort
    const deduped = this.deduplicate(filtered);
    deduped.sort((a, b) => this.severityOrder(a.severity) - this.severityOrder(b.severity));

    // 8. Generate recommendations
    const recommendations = this.generateRecommendations(deduped, action, symbolName);

    // 9. Build summary
    const summary = this.buildSummary(deduped);
    const affectedFiles = new Set(deduped.map(i => i.file)).size;

    return {
      symbol: symbolName,
      action,
      blastRadius: {
        summary,
        totalAffected: deduped.length,
        affectedFiles,
        affectedTests: affectedTests.length
      },
      impacts: deduped,
      affectedTests,
      recommendations,
      metadata: {
        queryTimeMs: Date.now() - startTime,
        depthSearched: clampedDepth,
        truncated: callerResult.metadata.truncated
      }
    };
  }

  private classifySeverity(
    depth: number, action: string, type: string
  ): 'critical' | 'high' | 'medium' | 'low' {
    // Delete escalates everything
    if (action === 'delete') {
      if (depth <= 1) return 'critical';
      if (depth <= 2) return 'high';
      return 'medium';
    }

    // Rename escalates direct references
    if (action === 'rename' && depth <= 1) return 'high';

    // Standard modify classification
    if (depth === 1) return 'critical';
    if (depth === 2) return 'high';
    if (depth === 3) return 'medium';
    return 'low';
  }

  private async findImplementorImpacts(resolved: ResolvedSymbol[], symbolName: string): Promise<ImpactItem[]> {
    const impacts: ImpactItem[] = [];
    
    for (const sym of resolved) {
      if (sym.kind !== 'method') continue;
      
      // Check if parent is interface
      const parent = this.db.prepare(
        'SELECT kind, name FROM symbols WHERE id = ?'
      ).get(sym.parentSymbolId);
      
      if (parent?.kind !== 'interface') continue;
      
      // Find all classes implementing this interface
      const implementors = this.db.prepare(`
        SELECT DISTINCT s.name, s.file_path, s.line
        FROM relationships r
        JOIN symbols s ON s.id = r.source_symbol_id
        WHERE r.target_symbol = ? AND r.kind = 'implements'
      `).all(parent.name);
      
      for (const impl of implementors) {
        // Find the method in the implementing class
        const method = this.db.prepare(`
          SELECT name, file_path, line FROM symbols
          WHERE parent_symbol_id IN (SELECT id FROM symbols WHERE name = ? AND file_path = ?)
            AND name = ?
        `).get(impl.name, impl.file_path, sym.name);
        
        if (method) {
          impacts.push({
            symbol: `${impl.name}.${method.name}`,
            file: method.file_path,
            line: method.line,
            severity: 'critical',
            reason: `Implements ${parent.name}.${sym.name}`
          });
        }
      }
    }
    
    return impacts;
  }

  private generateRecommendations(impacts: ImpactItem[], action: string, symbol: string): string[] {
    const recs: string[] = [];
    const critical = impacts.filter(i => i.severity === 'critical');
    const tests = impacts.filter(i => this.testDetector.isTestFile(i.file));

    if (action === 'delete' && impacts.length === 0) {
      recs.push(`Safe to delete "${symbol}" — no references found`);
    } else if (action === 'delete' && impacts.length > 0) {
      recs.push(`Remove all ${impacts.length} references before deleting "${symbol}"`);
    }

    if (action === 'modify' && critical.length > 0) {
      recs.push(`Update ${critical.length} direct callers if signature changes`);
    }

    if (action === 'rename') {
      const files = new Set(impacts.map(i => i.file)).size;
      recs.push(`Update references in ${files} files with new name`);
    }

    if (tests.length > 0) {
      recs.push(`Run affected tests: ${tests.map(t => t.file).slice(0, 5).join(', ')}`);
    }

    return recs;
  }
}
```

### 2.2 Module: TestDetector

**File:** `src/graph/test-detector.ts`

```typescript
export class TestDetector {
  private readonly TEST_PATH_PATTERNS = [
    /\/tests?\//i,
    /\/__tests__\//,
    /\/spec\//i
  ];
  
  private readonly TEST_FILE_PATTERNS = [
    /\.test\.[tj]sx?$/,
    /\.spec\.[tj]sx?$/,
    /Test\.kt$/,
    /_test\.py$/,
    /^test_.*\.py$/
  ];

  isTestFile(filePath: string): boolean {
    return this.TEST_PATH_PATTERNS.some(p => p.test(filePath)) ||
           this.TEST_FILE_PATTERNS.some(p => p.test(path.basename(filePath)));
  }

  findRelatedTests(
    symbols: ResolvedSymbol[],
    impacts: ImpactItem[]
  ): Array<{ file: string; reason: string }> {
    const results: Array<{ file: string; reason: string }> = [];
    const seen = new Set<string>();

    for (const sym of symbols) {
      // Find test files that import the source file
      const sourceBasename = path.basename(sym.filePath, path.extname(sym.filePath));
      const testFiles = this.db.prepare(`
        SELECT DISTINCT file_path FROM relationships
        WHERE kind = 'imports' AND target_symbol LIKE ?
      `).all(`%${sourceBasename}%`);

      for (const tf of testFiles) {
        if (this.isTestFile(tf.file_path) && !seen.has(tf.file_path)) {
          seen.add(tf.file_path);
          results.push({ file: tf.file_path, reason: `Tests ${sym.name}` });
        }
      }
    }

    // Also check if any impact targets are in test files
    for (const impact of impacts) {
      if (this.isTestFile(impact.file) && !seen.has(impact.file)) {
        seen.add(impact.file);
        results.push({ file: impact.file, reason: `Calls modified symbol` });
      }
    }

    return results;
  }
}
```

### 2.3 MCP Tool Registration

**File:** `src/tools/impact-tools.ts`

```typescript
export function registerImpactTools(server: McpServer, service: ImpactAnalysisService): void {
  server.tool('code_impact', {
    description: 'Predict blast radius of modifying, deleting, or renaming a symbol',
    inputSchema: { /* as defined in FSD */ }
  }, async (params) => {
    const result = await service.analyzeImpact(
      params.symbol,
      params.action,
      params.depth,
      params.include_tests,
      params.severity_threshold
    );
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });
}
```

---

## 3. File Structure

```
src/graph/
├── impact-analysis-service.ts    # Core analysis logic
├── test-detector.ts              # Test file detection

src/tools/
└── impact-tools.ts               # MCP tool registration

tests/graph/
├── impact-analysis.test.ts       # Unit tests
├── test-detector.test.ts         # Test detection tests
└── fixtures/
    └── impact-project/           # Test project with known relationships
```

---

## 4. Implementation Checklist

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | ImpactAnalysisService core | src/graph/impact-analysis-service.ts | 4h |
| 2 | Severity classification logic | impact-analysis-service.ts | 1h |
| 3 | Interface implementor detection | impact-analysis-service.ts | 2h |
| 4 | TestDetector | src/graph/test-detector.ts | 2h |
| 5 | Recommendation engine | impact-analysis-service.ts | 1.5h |
| 6 | MCP tool registration | src/tools/impact-tools.ts | 1h |
| 7 | Unit tests (severity classification) | tests/graph/impact-analysis.test.ts | 2h |
| 8 | Unit tests (full analysis) | tests/graph/impact-analysis.test.ts | 3h |
| 9 | Unit tests (test detector) | tests/graph/test-detector.test.ts | 1.5h |
| 10 | Integration tests | tests/tools/impact-tools.test.ts | 2h |
| 11 | Performance tests | tests/benchmarks/impact-perf.ts | 1h |

**Total estimated effort:** ~21 hours (3 days)

---

## 5. Performance Design

| Operation | Strategy | Target |
|-----------|----------|--------|
| Caller lookup | Reuse CallGraphService BFS (cached stmts) | < 50ms |
| Dep graph lookup | Reuse DependencyGraphService | < 50ms |
| Implementor lookup | Direct SQL with indexes | < 20ms |
| Test detection | Pattern matching + 1 SQL query | < 30ms |
| Total (depth 3) | Parallel where possible | < 500ms |

---

## 6. Error Handling

| Error | Response |
|-------|----------|
| Symbol not found | Error with suggestions |
| Empty graph | "No relationships indexed. Run indexer first." |
| Timeout | Partial results, truncated=true |
| DB error | Graceful error message |

---

## 7. Dependencies

| Ticket | What's Used |
|--------|------------|
| KSA-153 | relationships table, symbols table |
| KSA-154 | CallGraphService.findCallers(), SymbolResolver |
| KSA-155 | DependencyGraphService.query(incoming) |
