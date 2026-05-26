# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-158: [AI Context] get_ai_context

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-158 |
| Title | [AI Context] get_ai_context - intent-aware + token budgeting |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-28 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-158.docx |

---

## 1. Architecture Overview

### 1.1 Component Diagram

```
MCP Client (AI Agent)
    │
    │ get_ai_context(symbol, intent, token_budget)
    ▼
┌─────────────────────────────────────────┐
│         AIContextService                 │
├─────────────────────────────────────────┤
│                                          │
│  ┌──────────────┐  ┌────────────────┐  │
│  │ Symbol       │  │ Intent         │  │
│  │ Resolver     │  │ Strategy       │  │
│  └──────┬───────┘  └───────┬────────┘  │
│         │                   │           │
│  ┌──────▼───────────────────▼────────┐  │
│  │      Context Assembler            │  │
│  │  ┌─────────┐ ┌─────────────────┐ │  │
│  │  │ Section │ │ Token Budget    │ │  │
│  │  │ Fetchers│ │ Manager         │ │  │
│  │  └────┬────┘ └────────┬────────┘ │  │
│  └───────┼────────────────┼──────────┘  │
│          │                │             │
└──────────┼────────────────┼─────────────┘
           │                │
    ┌──────▼──────┐  ┌─────▼──────┐
    │ Data Sources│  │ Formatters │
    ├─────────────┤  └────────────┘
    │ code_context│
    │ code_callers│
    │ code_callees│
    │ code_search │
    │ mem_search  │
    │ git log     │
    └─────────────┘
```

---

## 2. Detailed Design

### 2.1 Module: AIContextService

**File:** `src/context/ai-context-service.ts`

```typescript
import { CallGraphService } from '../graph/call-graph-service';
import { SymbolResolver } from '../graph/symbol-resolver';
import { TokenBudgetManager } from './token-budget-manager';
import { IntentStrategy, getStrategy } from './intent-strategies';

export class AIContextService {
  private callGraph: CallGraphService;
  private resolver: SymbolResolver;
  private db: Database;

  async getContext(params: AIContextParams): Promise<AIContextResponse> {
    const startTime = Date.now();
    const { symbol, intent = 'explain', token_budget = 4000, caller_depth = 1 } = params;
    
    // 1. Resolve symbol
    const resolved = this.resolver.resolve(symbol);
    if (resolved.length === 0) {
      return this.notFoundResponse(symbol);
    }
    
    const targetSymbol = resolved[0]; // Use first match
    
    // 2. Get intent strategy (section priorities)
    const strategy = getStrategy(intent);
    
    // 3. Assemble context with budget
    const budgetManager = new TokenBudgetManager(token_budget);
    const context: Record<string, any> = {};
    const sectionsIncluded: string[] = [];
    const sectionsOmitted: string[] = [];
    
    for (const section of strategy.sections) {
      if (budgetManager.isExhausted()) {
        sectionsOmitted.push(section.name);
        continue;
      }
      
      const content = await this.fetchSection(section, targetSymbol, caller_depth);
      if (!content) {
        continue; // Section not available (e.g., no git, no tests)
      }
      
      const tokens = budgetManager.estimateTokens(content);
      
      if (budgetManager.canFit(tokens)) {
        context[section.name] = content;
        budgetManager.consume(tokens);
        sectionsIncluded.push(section.name);
      } else if (budgetManager.remaining() > 100) {
        // Partial fit
        const truncated = budgetManager.truncateToFit(content);
        context[section.name] = truncated;
        context[`${section.name}_truncated`] = true;
        budgetManager.consumeAll();
        sectionsIncluded.push(section.name);
      } else {
        sectionsOmitted.push(section.name);
      }
    }
    
    return {
      symbol: targetSymbol.name,
      file_path: targetSymbol.filePath,
      kind: targetSymbol.kind,
      intent,
      context,
      metadata: {
        budget_used: budgetManager.used(),
        budget_total: token_budget,
        sections_included: sectionsIncluded,
        sections_omitted: sectionsOmitted,
        query_time_ms: Date.now() - startTime
      }
    };
  }

  private async fetchSection(section: SectionDef, symbol: ResolvedSymbol, callerDepth: number): Promise<any> {
    switch (section.name) {
      case 'source':
        return this.fetchSource(symbol);
      case 'callers':
        return this.fetchCallers(symbol, callerDepth, section.format);
      case 'callees':
        return this.fetchCallees(symbol, callerDepth);
      case 'siblings':
        return this.fetchSiblings(symbol);
      case 'imports':
        return this.fetchImports(symbol);
      case 'tests':
        return this.fetchRelatedTests(symbol);
      case 'type_definitions':
        return this.fetchTypeDefinitions(symbol);
      case 'doc_comment':
        return symbol.docComment || null;
      case 'error_patterns':
        return this.fetchErrorPatterns(symbol);
      case 'recent_changes':
        return this.fetchRecentChanges(symbol);
      case 'test_patterns':
        return this.fetchTestPatterns();
      case 'mocks_needed':
        return this.fetchMocksNeeded(symbol);
      default:
        return null;
    }
  }
}
```

### 2.2 Module: IntentStrategy

**File:** `src/context/intent-strategies.ts`

```typescript
interface SectionDef {
  name: string;
  priority: number;
  format: 'full' | 'summary' | 'signatures';
}

interface IntentStrategy {
  intent: string;
  sections: SectionDef[];
}

const STRATEGIES: Record<string, IntentStrategy> = {
  explain: {
    intent: 'explain',
    sections: [
      { name: 'source', priority: 1, format: 'full' },
      { name: 'doc_comment', priority: 2, format: 'full' },
      { name: 'siblings', priority: 3, format: 'signatures' },
      { name: 'imports', priority: 4, format: 'full' },
      { name: 'callers', priority: 5, format: 'summary' },
      { name: 'callees', priority: 6, format: 'summary' },
      { name: 'type_definitions', priority: 7, format: 'full' },
    ]
  },
  modify: {
    intent: 'modify',
    sections: [
      { name: 'source', priority: 1, format: 'full' },
      { name: 'callers', priority: 2, format: 'full' },
      { name: 'callees', priority: 3, format: 'full' },
      { name: 'tests', priority: 4, format: 'full' },
      { name: 'imports', priority: 5, format: 'full' },
      { name: 'type_definitions', priority: 6, format: 'full' },
      { name: 'siblings', priority: 7, format: 'signatures' },
    ]
  },
  debug: {
    intent: 'debug',
    sections: [
      { name: 'source', priority: 1, format: 'full' },
      { name: 'callers', priority: 2, format: 'full' },
      { name: 'error_patterns', priority: 3, format: 'full' },
      { name: 'recent_changes', priority: 4, format: 'full' },
      { name: 'imports', priority: 5, format: 'full' },
      { name: 'siblings', priority: 6, format: 'signatures' },
      { name: 'callees', priority: 7, format: 'summary' },
    ]
  },
  test: {
    intent: 'test',
    sections: [
      { name: 'source', priority: 1, format: 'full' },
      { name: 'tests', priority: 2, format: 'full' },
      { name: 'test_patterns', priority: 3, format: 'full' },
      { name: 'callees', priority: 4, format: 'full' },
      { name: 'type_definitions', priority: 5, format: 'full' },
      { name: 'mocks_needed', priority: 6, format: 'full' },
      { name: 'siblings', priority: 7, format: 'signatures' },
    ]
  }
};

export function getStrategy(intent: string): IntentStrategy {
  return STRATEGIES[intent] || STRATEGIES.explain;
}
```

### 2.3 Module: TokenBudgetManager

**File:** `src/context/token-budget-manager.ts`

```typescript
export class TokenBudgetManager {
  private budget: number;
  private consumed: number = 0;

  constructor(budget: number) {
    this.budget = Math.max(budget, 500); // Minimum 500
  }

  estimateTokens(content: any): number {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    return Math.ceil(text.length / 4); // ~4 chars per token
  }

  canFit(tokens: number): boolean {
    return this.consumed + tokens <= this.budget;
  }

  consume(tokens: number): void {
    this.consumed += tokens;
  }

  consumeAll(): void {
    this.consumed = this.budget;
  }

  remaining(): number {
    return Math.max(0, this.budget - this.consumed);
  }

  used(): number {
    return this.consumed;
  }

  isExhausted(): boolean {
    return this.remaining() < 50; // Less than 50 tokens = exhausted
  }

  truncateToFit(content: any): any {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    const maxChars = this.remaining() * 4;
    if (text.length <= maxChars) return content;
    
    if (typeof content === 'string') {
      return text.substring(0, maxChars) + '\n... (truncated)';
    }
    
    // For arrays, take first N items
    if (Array.isArray(content)) {
      let chars = 0;
      const result = [];
      for (const item of content) {
        const itemStr = JSON.stringify(item);
        if (chars + itemStr.length > maxChars) break;
        result.push(item);
        chars += itemStr.length;
      }
      return result;
    }
    
    return text.substring(0, maxChars);
  }
}
```

### 2.4 Module: Section Fetchers

**File:** `src/context/section-fetchers.ts`

```typescript
// Source fetcher — reads file content for the symbol's line range
async fetchSource(symbol: ResolvedSymbol): Promise<string> {
  const content = await readFile(symbol.filePath, 'utf-8');
  const lines = content.split('\n');
  const start = (symbol.startLine || symbol.line) - 1;
  const end = symbol.endLine || start + 50; // Default 50 lines if no end_line
  return lines.slice(start, end).join('\n');
}

// Callers fetcher — uses CallGraphService
async fetchCallers(symbol: ResolvedSymbol, depth: number, format: string): Promise<any> {
  const result = await this.callGraph.findCallers(symbol.name, depth, 10);
  if (format === 'summary') {
    return result.results.map(r => `${r.symbol} (${r.filePath}:${r.callSiteLine})`);
  }
  return result.results;
}

// Related tests fetcher — find test files that import/reference this symbol
async fetchRelatedTests(symbol: ResolvedSymbol): Promise<any> {
  // Strategy 1: Find files matching test naming convention
  const testFiles = this.db.prepare(`
    SELECT DISTINCT file_path FROM symbols 
    WHERE file_path LIKE '%test%' OR file_path LIKE '%spec%'
  `).all();
  
  // Strategy 2: Find files that import this symbol
  const importers = this.db.prepare(`
    SELECT DISTINCT file_path FROM relationships
    WHERE target_symbol LIKE ? AND kind = 'imports'
    AND (file_path LIKE '%test%' OR file_path LIKE '%spec%')
  `).all(`%${symbol.name}%`);
  
  return importers.length > 0 ? importers : null;
}

// Error patterns fetcher — find try/catch/throw in function body
async fetchErrorPatterns(symbol: ResolvedSymbol): Promise<any> {
  const source = await this.fetchSource(symbol);
  const patterns = [];
  
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('throw ')) patterns.push({ type: 'throw', line: i + 1, text: line });
    if (line.startsWith('catch')) patterns.push({ type: 'catch', line: i + 1, text: line });
    if (line.includes('.catch(')) patterns.push({ type: 'promise-catch', line: i + 1, text: line });
  }
  
  return patterns.length > 0 ? patterns : null;
}
```

---

## 3. MCP Tool Registration

**File:** `src/tools/ai-context-tools.ts`

```typescript
export function registerAIContextTools(server: McpServer, service: AIContextService): void {
  server.tool('get_ai_context', {
    description: 'Get intent-aware code context with token budgeting. Returns source, callers, callees, tests based on intent.',
    inputSchema: { /* as defined in FSD */ }
  }, async (params) => {
    const result = await service.getContext(params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });
}
```

---

## 4. File Structure

```
src/context/
├── ai-context-service.ts       # Main orchestrator
├── intent-strategies.ts        # Intent → section priority mapping
├── token-budget-manager.ts     # Token estimation and budgeting
├── section-fetchers.ts         # Individual section data fetchers
└── types.ts                    # Interfaces

src/tools/
└── ai-context-tools.ts         # MCP tool registration
```

---

## 5. Implementation Checklist

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | TokenBudgetManager | src/context/token-budget-manager.ts | 1.5h |
| 2 | IntentStrategy definitions | src/context/intent-strategies.ts | 1h |
| 3 | Section fetchers (source, callers, callees) | src/context/section-fetchers.ts | 3h |
| 4 | Section fetchers (tests, errors, git) | src/context/section-fetchers.ts | 3h |
| 5 | AIContextService orchestrator | src/context/ai-context-service.ts | 3h |
| 6 | MCP tool registration | src/tools/ai-context-tools.ts | 1h |
| 7 | Unit tests (budget manager) | tests/context/budget.test.ts | 1.5h |
| 8 | Unit tests (intent strategies) | tests/context/strategies.test.ts | 1h |
| 9 | Integration tests (full flow) | tests/context/ai-context.test.ts | 3h |
| 10 | Performance tests | tests/benchmarks/context-perf.ts | 1h |

**Total estimated effort:** ~20 hours (2.5 days)

---

## 6. Performance Considerations

| Concern | Mitigation |
|---------|-----------|
| Multiple DB queries per request | Parallel fetching where possible |
| Large source files | Limit to symbol's line range only |
| Git log calls (debug intent) | Cache recent results, timeout at 500ms |
| Token estimation accuracy | Conservative estimate (4 chars/token) |
| Memory for large context | Stream sections, don't buffer all |

---

## 7. Error Handling

| Error | Strategy | Fallback |
|-------|----------|----------|
| Symbol not found | Return error + suggestions | - |
| Call graph empty | Skip callers/callees sections | Return source only |
| Git not available | Skip recent_changes | Proceed without |
| KB/memory unavailable | Skip error_patterns from KB | Use code analysis only |
| Section fetch timeout | Skip section, log warning | Continue with remaining |
| Budget too small (<500) | Return source only + warning | - |

---

## 8. Testing Strategy

| Test Type | Coverage |
|-----------|----------|
| Unit | TokenBudgetManager (estimation, truncation) |
| Unit | IntentStrategy (correct sections per intent) |
| Unit | Each section fetcher independently |
| Integration | Full get_ai_context with real DB |
| Budget | Verify response stays within ±10% of budget |
| Performance | Response time under various budgets |
