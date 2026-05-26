# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-159: [AI Context] get_edit_context

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-159 |
| Title | [AI Context] get_edit_context - source + callers + tests + git |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-29 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-159.docx |
| Related TDD | TDD-v1-KSA-154 (Call Graph), TDD-v1-KSA-155 (Dep Graph), TDD-v1-KSA-156 (Impact) |

---

## 1. Architecture Overview

```
MCP Server
    |
    +-- registerTool("get_edit_context", handler)
            |
            v
    EditContextService
        +-- getContext(symbol, options)
            |
            +-- SymbolResolver         --> resolve symbol
            +-- FileSystem             --> read source code
            +-- CallGraphService       --> find callers
            +-- TestDetector           --> find tests
            +-- DependencyGraphService --> find deps
            +-- MemoryService          --> search KB
            +-- GitService             --> git log
            +-- TokenBudgetManager     --> assemble within budget
```

---

## 2. Detailed Design

### 2.1 Module: EditContextService

**File:** `src/context/edit-context-service.ts`

```typescript
import { CallGraphService } from '../graph/call-graph-service';
import { DependencyGraphService } from '../graph/dependency-graph-service';
import { TestDetector } from '../graph/test-detector';
import { SymbolResolver } from '../graph/symbol-resolver';
import { TokenBudgetManager } from './token-budget-manager';
import { GitService } from './git-service';
import { MemoryService } from './memory-service';

interface EditContextOptions {
  includeCallers: boolean;
  includeTests: boolean;
  includeMemories: boolean;
  includeGit: boolean;
  tokenBudget: number;
  callerDepth: number;
}

interface EditContextResult {
  symbol: string;
  file: string;
  line: number;
  kind: string;
  source: string;
  signature: string;
  callers?: CallerContext[];
  tests?: TestContext[];
  dependencies?: DependencyContext[];
  memories?: MemoryContext[];
  git_history?: GitCommit[];
  siblings?: SiblingContext[];
  metadata: {
    tokenCount: number;
    tokenBudget: number;
    sectionsIncluded: string[];
    sectionsExcluded: string[];
    queryTimeMs: number;
  };
}

export class EditContextService {
  private resolver: SymbolResolver;
  private callGraph: CallGraphService;
  private depGraph: DependencyGraphService;
  private testDetector: TestDetector;
  private memoryService: MemoryService;
  private gitService: GitService;
  private budgetManager: TokenBudgetManager;

  async getContext(symbolInput: string, options: EditContextOptions): Promise<EditContextResult> {
    const startTime = Date.now();

    // 1. Resolve symbol
    const symbol = this.resolveSymbolInput(symbolInput);
    if (!symbol) {
      return this.symbolNotFoundResponse(symbolInput);
    }

    // 2. Read source code (always included)
    const source = this.readSymbolSource(symbol);
    const signature = symbol.signature;

    // 3. Gather sections in parallel
    const [callers, tests, deps, memories, gitHistory, siblings] = await Promise.all([
      options.includeCallers ? this.getCallerContext(symbol, options.callerDepth) : null,
      options.includeTests ? this.getTestContext(symbol) : null,
      this.getDependencyContext(symbol),
      options.includeMemories ? this.getMemoryContext(symbol) : null,
      options.includeGit ? this.getGitContext(symbol) : null,
      this.getSiblingContext(symbol)
    ]);

    // 4. Assemble within token budget
    const sections = {
      source: { content: source, priority: 1 },
      signature: { content: signature, priority: 1 },
      callers: { content: callers, priority: 2 },
      tests: { content: tests, priority: 3 },
      dependencies: { content: deps, priority: 4 },
      memories: { content: memories, priority: 5 },
      git_history: { content: gitHistory, priority: 6 },
      siblings: { content: siblings, priority: 7 }
    };

    const assembled = this.budgetManager.assemble(sections, options.tokenBudget);

    return {
      symbol: symbol.name,
      file: symbol.filePath,
      line: symbol.startLine,
      kind: symbol.kind,
      ...assembled.result,
      metadata: {
        tokenCount: assembled.tokenCount,
        tokenBudget: options.tokenBudget,
        sectionsIncluded: assembled.included,
        sectionsExcluded: assembled.excluded,
        queryTimeMs: Date.now() - startTime
      }
    };
  }

  private resolveSymbolInput(input: string): ResolvedSymbol | null {
    // Try file:line format
    if (input.includes(':') && /:\d+$/.test(input)) {
      const [file, lineStr] = input.split(':');
      const line = parseInt(lineStr);
      return this.findSymbolAtLine(file, line);
    }

    // Try standard resolution
    const resolved = this.resolver.resolve(input);
    return resolved.length > 0 ? resolved[0] : null;
  }

  private findSymbolAtLine(file: string, line: number): ResolvedSymbol | null {
    return this.db.prepare(`
      SELECT id, name, kind, file_path, start_line, end_line, signature, parent_symbol_id
      FROM symbols
      WHERE file_path LIKE ? AND start_line <= ? AND end_line >= ?
      ORDER BY (end_line - start_line) ASC
      LIMIT 1
    `).get(`%${file}`, line, line);
  }

  private readSymbolSource(symbol: ResolvedSymbol): string {
    const content = readFileSync(symbol.filePath, 'utf-8');
    const lines = content.split('\n');
    return lines.slice(symbol.startLine - 1, symbol.endLine).join('\n');
  }

  private async getCallerContext(symbol: ResolvedSymbol, depth: number): Promise<CallerContext[]> {
    const result = await this.callGraph.findCallers(symbol.name, depth, 10);
    
    return result.results.map(caller => {
      const context = this.getLineContext(caller.filePath, caller.callSiteLine, 2);
      return {
        symbol: caller.qualifiedName || caller.symbol,
        file: caller.filePath,
        line: caller.callSiteLine,
        context
      };
    });
  }

  private getLineContext(file: string, line: number, surroundingLines: number): string {
    try {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      const start = Math.max(0, line - 1 - surroundingLines);
      const end = Math.min(lines.length, line + surroundingLines);
      return lines.slice(start, end).join('\n');
    } catch {
      return '';
    }
  }

  private async getTestContext(symbol: ResolvedSymbol): Promise<TestContext[]> {
    const testFiles = this.testDetector.findRelatedTests([symbol], []);
    const results: TestContext[] = [];

    for (const tf of testFiles.slice(0, 3)) { // Max 3 test files
      try {
        const content = readFileSync(tf.file, 'utf-8');
        // Find test functions mentioning the symbol
        const testBlocks = this.extractTestBlocks(content, symbol.name);
        for (const block of testBlocks.slice(0, 2)) { // Max 2 tests per file
          results.push({
            file: tf.file,
            testName: block.name,
            source: block.source
          });
        }
      } catch { /* skip unreadable files */ }
    }

    return results;
  }

  private async getMemoryContext(symbol: ResolvedSymbol): Promise<MemoryContext[]> {
    const queries = [symbol.name, path.basename(symbol.filePath)].filter(Boolean);
    const searchQuery = queries.join(' ');
    
    try {
      const results = await this.memoryService.search(searchQuery, {
        limit: 5,
        types: ['DECISION', 'ARCHITECTURE', 'LESSON_LEARNED', 'PROCEDURE']
      });
      return results
        .filter(r => r.score > 0.3)
        .map(r => ({ id: r.id, type: r.type, summary: r.summary }));
    } catch {
      return [];
    }
  }

  private async getGitContext(symbol: ResolvedSymbol): Promise<GitCommit[]> {
    return this.gitService.getFileHistory(symbol.filePath, 5);
  }

  private getSiblingContext(symbol: ResolvedSymbol): SiblingContext[] {
    const query = symbol.parentSymbolId
      ? `SELECT name, kind, signature, start_line as line FROM symbols WHERE parent_symbol_id = ? AND id != ? ORDER BY start_line`
      : `SELECT name, kind, signature, start_line as line FROM symbols WHERE file_path = ? AND parent_symbol_id IS NULL AND id != ? ORDER BY start_line`;
    
    const params = symbol.parentSymbolId
      ? [symbol.parentSymbolId, symbol.id]
      : [symbol.filePath, symbol.id];
    
    return this.db.prepare(query).all(...params).map(r => ({
      name: r.name,
      kind: r.kind,
      signature: r.signature,
      line: r.line
    }));
  }
}
```

### 2.2 Module: TokenBudgetManager

**File:** `src/context/token-budget-manager.ts`

```typescript
export class TokenBudgetManager {
  estimateTokens(text: string | object): number {
    const str = typeof text === 'string' ? text : JSON.stringify(text);
    return Math.ceil(str.split(/\s+/).length * 1.3);
  }

  assemble(
    sections: Record<string, { content: any; priority: number }>,
    budget: number
  ): { result: Record<string, any>; tokenCount: number; included: string[]; excluded: string[] } {
    const sorted = Object.entries(sections)
      .filter(([_, v]) => v.content != null)
      .sort(([_, a], [__, b]) => a.priority - b.priority);

    const result: Record<string, any> = {};
    let usedTokens = 0;
    const included: string[] = [];
    const excluded: string[] = [];

    for (const [key, { content }] of sorted) {
      const tokens = this.estimateTokens(content);
      
      if (usedTokens + tokens <= budget) {
        result[key] = content;
        usedTokens += tokens;
        included.push(key);
      } else {
        // Try truncation for arrays
        if (Array.isArray(content) && content.length > 0) {
          const remaining = budget - usedTokens;
          const truncated = this.truncateArray(content, remaining);
          if (truncated.length > 0) {
            result[key] = truncated;
            usedTokens += this.estimateTokens(truncated);
            included.push(`${key} (truncated: ${truncated.length}/${content.length})`);
            continue;
          }
        }
        excluded.push(key);
      }
    }

    return { result, tokenCount: usedTokens, included, excluded };
  }

  private truncateArray(arr: any[], tokenBudget: number): any[] {
    const result: any[] = [];
    let used = 0;
    for (const item of arr) {
      const tokens = this.estimateTokens(item);
      if (used + tokens > tokenBudget) break;
      result.push(item);
      used += tokens;
    }
    return result;
  }
}
```

### 2.3 Module: GitService

**File:** `src/context/git-service.ts`

```typescript
import { execSync } from 'child_process';

export class GitService {
  private workspaceRoot: string;

  getFileHistory(filePath: string, limit: number = 5): GitCommit[] {
    try {
      const output = execSync(
        `git log --oneline --follow -n ${limit} -- "${filePath}"`,
        { cwd: this.workspaceRoot, encoding: 'utf-8', timeout: 5000 }
      );
      
      return output.trim().split('\n').filter(Boolean).map(line => {
        const spaceIdx = line.indexOf(' ');
        return {
          hash: line.substring(0, spaceIdx),
          message: line.substring(spaceIdx + 1)
        };
      });
    } catch {
      return []; // Git not available or file not tracked
    }
  }
}
```

### 2.4 MCP Tool Registration

**File:** `src/tools/context-tools.ts`

```typescript
export function registerContextTools(server: McpServer, service: EditContextService): void {
  server.tool('get_edit_context', {
    description: 'Get everything needed before editing: source + callers + tests + memories + git history',
    inputSchema: { /* as defined in FSD */ }
  }, async (params) => {
    const result = await service.getContext(params.symbol, {
      includeCallers: params.include_callers ?? true,
      includeTests: params.include_tests ?? true,
      includeMemories: params.include_memories ?? true,
      includeGit: params.include_git ?? true,
      tokenBudget: params.token_budget ?? 4000,
      callerDepth: params.caller_depth ?? 1
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });
}
```

---

## 3. File Structure

```
src/context/
├── edit-context-service.ts       # Main orchestrator
├── token-budget-manager.ts       # Token counting + assembly
├── git-service.ts                # Git log wrapper
├── memory-service.ts             # KB memory wrapper

src/tools/
└── context-tools.ts              # MCP tool registration

tests/context/
├── edit-context-service.test.ts  # Integration tests
├── token-budget-manager.test.ts  # Budget logic tests
├── git-service.test.ts           # Git tests
└── fixtures/
    └── sample-project/           # Test project
```

---

## 4. Implementation Checklist

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | TokenBudgetManager | src/context/token-budget-manager.ts | 1.5h |
| 2 | GitService | src/context/git-service.ts | 1h |
| 3 | MemoryService wrapper | src/context/memory-service.ts | 1h |
| 4 | EditContextService core | src/context/edit-context-service.ts | 4h |
| 5 | Symbol resolution (file:line) | edit-context-service.ts | 1h |
| 6 | Caller context extraction | edit-context-service.ts | 1.5h |
| 7 | Test context extraction | edit-context-service.ts | 1.5h |
| 8 | MCP tool registration | src/tools/context-tools.ts | 1h |
| 9 | Unit tests (budget manager) | tests/context/token-budget-manager.test.ts | 1.5h |
| 10 | Unit tests (git service) | tests/context/git-service.test.ts | 1h |
| 11 | Integration tests | tests/context/edit-context-service.test.ts | 2.5h |
| 12 | Performance tests | tests/benchmarks/context-perf.ts | 0.5h |

**Total estimated effort:** ~18 hours (2.5 days)

---

## 5. Performance Design

| Section | Strategy | Expected Time |
|---------|----------|---------------|
| Symbol resolution | Cached prepared statement | < 5ms |
| Source read | Direct file read | < 10ms |
| Callers | Reuse CallGraphService | < 50ms |
| Tests | Pattern match + file read | < 50ms |
| Dependencies | Reuse DependencyGraphService | < 30ms |
| Memories | KB search | < 50ms |
| Git history | execSync with timeout | < 100ms |
| **Total (parallel)** | Promise.all for sections 3-7 | **< 200ms** |

Key optimization: Sections 3-7 are gathered in parallel via `Promise.all`.

---

## 6. Error Handling

| Error | Strategy |
|-------|----------|
| Symbol not found | Return error with suggestions |
| File unreadable | Skip source, return partial |
| Git timeout | Skip git_history |
| KB unavailable | Skip memories |
| All sections fail | Return error |
| Token budget too small | Return source only with warning |

---

## 7. Dependencies

| Ticket | What's Used |
|--------|------------|
| KSA-154 | CallGraphService, SymbolResolver |
| KSA-155 | DependencyGraphService |
| KSA-156 | TestDetector |
| Existing | KB memory search, file system |
