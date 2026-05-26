# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-160: [AI Context] get_curated_context

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-160 |
| Title | [AI Context] get_curated_context - NL query cross-codebase |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-06-01 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-160.docx |

---

## 1. Architecture Overview

### 1.1 Component Placement

```
src/
  tools/
    get-curated-context.ts   ← MCP tool handler
  context/
    query-analyzer.ts        ← NL query → search terms
    parallel-searcher.ts     ← Orchestrates 3 search sources
    rrf-merger.ts            ← Reciprocal Rank Fusion
    budget-allocator.ts      ← Token budget management
    response-formatter.ts    ← Structured output
    __tests__/
      curated-context.test.ts
      rrf-merger.test.ts
      budget-allocator.test.ts
```

### 1.2 Class Design

```typescript
class GetCuratedContextTool implements IMCPTool {
  name = "get_curated_context";
  
  private analyzer: QueryAnalyzer;
  private searcher: ParallelSearcher;
  private merger: RRFMerger;
  private allocator: BudgetAllocator;
  private formatter: ResponseFormatter;
  
  async execute(params: CuratedContextParams): Promise<CuratedContextResponse> {
    const startTime = Date.now();
    
    // 1. Analyze query
    const analysis = this.analyzer.analyze(params.query);
    
    // 2. Parallel search
    const searchResults = await this.searcher.search(analysis, {
      scope: params.scope,
      modules: params.modules,
      languages: params.languages,
      includeSource: params.include_source ?? true,
      includeMemory: params.include_memory ?? true,
      includeGraph: params.include_graph ?? true
    });
    
    // 3. Merge with RRF
    const merged = this.merger.merge(searchResults, params.source_weights);
    
    // 4. Allocate token budget
    const allocated = this.allocator.allocate(merged, params.max_tokens || 4000);
    
    // 5. Format response
    return this.formatter.format(params.query, allocated, {
      executionTimeMs: Date.now() - startTime
    });
  }
}
```

---

## 2. Detailed Design

### 2.1 Query Analyzer

```typescript
class QueryAnalyzer {
  private stopWords = new Set(['how', 'does', 'the', 'is', 'what', 'where', 'when', 'a', 'an', 'in', 'for', 'to', 'of']);
  
  analyze(query: string): QueryAnalysis {
    // Tokenize
    const tokens = query.toLowerCase()
      .replace(/[^\w\s.-]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2 && !this.stopWords.has(t));
    
    // Identify symbol candidates (camelCase, PascalCase, snake_case, dot.notation)
    const symbolCandidates = query.match(/[A-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)?|[a-z]+_[a-z_]+/g) || [];
    
    // Extract bigrams for phrase search
    const phrases: string[] = [];
    for (let i = 0; i < tokens.length - 1; i++) {
      phrases.push(`${tokens[i]} ${tokens[i + 1]}`);
    }
    
    return {
      originalQuery: query,
      keywords: tokens,
      symbolCandidates,
      phrases,
      ftsQuery: tokens.join(' OR '),
      embeddingText: query  // Full query for embedding
    };
  }
}
```

### 2.2 Parallel Searcher

```typescript
class ParallelSearcher {
  constructor(
    private symbolSearch: SymbolSearchService,
    private memorySearch: MemorySearchService,
    private graphTraversal: GraphTraversalService
  ) {}
  
  async search(analysis: QueryAnalysis, options: SearchOptions): Promise<SearchResults> {
    const promises: Promise<any>[] = [];
    
    // Source 1: Code symbols (FTS5 + embedding)
    if (options.includeSource) {
      promises.push(
        this.withTimeout(
          this.searchSymbols(analysis, options),
          1500,
          { source: 'code', results: [] }
        )
      );
    }
    
    // Source 2: Memory/KB
    if (options.includeMemory) {
      promises.push(
        this.withTimeout(
          this.searchMemory(analysis),
          1000,
          { source: 'memory', results: [] }
        )
      );
    }
    
    // Source 3: Graph expansion (depends on symbol results)
    // Run after symbols to expand top matches
    const [symbolResults, memoryResults] = await Promise.all(promises);
    
    let graphResults = { source: 'graph', results: [] };
    if (options.includeGraph && symbolResults.results.length > 0) {
      graphResults = await this.withTimeout(
        this.expandGraph(symbolResults.results.slice(0, 5)),
        1500,
        { source: 'graph', results: [] }
      );
    }
    
    return { code: symbolResults, memory: memoryResults, graph: graphResults };
  }
  
  private async searchSymbols(analysis: QueryAnalysis, options: SearchOptions): Promise<SourceResults> {
    // FTS5 search
    const ftsResults = await this.symbolSearch.ftsSearch(analysis.ftsQuery, {
      scope: options.scope,
      languages: options.languages,
      limit: 30
    });
    
    // Embedding similarity search
    const embResults = await this.symbolSearch.embeddingSearch(analysis.embeddingText, {
      scope: options.scope,
      limit: 20
    });
    
    // Combine with mini-RRF
    const combined = this.miniRRF(ftsResults, embResults);
    return { source: 'code', results: combined.slice(0, 20) };
  }
  
  private async expandGraph(topSymbols: SearchResult[]): Promise<SourceResults> {
    const expanded: SearchResult[] = [];
    
    for (const symbol of topSymbols) {
      try {
        const neighbors = await this.graphTraversal.traverse({
          start: symbol.name,
          edge_types: ['Calls', 'Imports', 'Inherits'],
          direction: 'both',
          max_depth: 1,
          max_results: 5
        });
        
        for (const neighbor of neighbors.results) {
          expanded.push({
            id: neighbor.node.id,
            name: neighbor.node.name,
            kind: neighbor.node.kind,
            file: neighbor.node.file_path,
            line: neighbor.node.start_line,
            score: 0, // will be scored by RRF
            source: 'graph',
            relationship: `${neighbor.edge_type} ${symbol.name}`
          });
        }
      } catch (e) {
        // Skip if symbol not in graph
      }
    }
    
    return { source: 'graph', results: this.deduplicate(expanded) };
  }
  
  private async withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))
    ]);
  }
}
```

### 2.3 RRF Merger

```typescript
class RRFMerger {
  private k = 60; // RRF constant
  
  merge(results: SearchResults, weights?: SourceWeights): MergedResult[] {
    const w = weights || { code: 0.5, memory: 0.3, graph: 0.2 };
    const scores = new Map<string, { score: number; item: any; sources: string[] }>();
    
    // Score code results
    this.addScores(scores, results.code.results, w.code, 'code');
    
    // Score memory results
    this.addScores(scores, results.memory.results, w.memory, 'memory');
    
    // Score graph results
    this.addScores(scores, results.graph.results, w.graph, 'graph');
    
    // Sort by combined score
    return Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .map(entry => ({
        ...entry.item,
        relevance_score: entry.score,
        sources: entry.sources
      }));
  }
  
  private addScores(scores: Map<string, any>, results: any[], weight: number, source: string) {
    for (let rank = 0; rank < results.length; rank++) {
      const item = results[rank];
      const key = item.id || item.name || JSON.stringify(item);
      const rrfScore = weight * (1 / (this.k + rank));
      
      if (scores.has(key)) {
        const existing = scores.get(key)!;
        existing.score += rrfScore;
        existing.sources.push(source);
      } else {
        scores.set(key, { score: rrfScore, item, sources: [source] });
      }
    }
  }
}
```

### 2.4 Budget Allocator

```typescript
class BudgetAllocator {
  private CHARS_PER_TOKEN = 4; // Approximate
  
  allocate(results: MergedResult[], maxTokens: number): AllocatedResult[] {
    const allocated: AllocatedResult[] = [];
    let tokensUsed = 100; // Response overhead
    
    const highThreshold = Math.ceil(results.length * 0.2);
    const medThreshold = Math.ceil(results.length * 0.6);
    
    for (let i = 0; i < results.length; i++) {
      if (tokensUsed >= maxTokens) break;
      
      const result = results[i];
      let detail: 'full' | 'signature' | 'reference';
      let content: string;
      let tokens: number;
      
      if (i < highThreshold) {
        detail = 'full';
        content = result.source_code || result.content || result.signature || result.name;
        tokens = this.estimateTokens(content);
      } else if (i < medThreshold) {
        detail = 'signature';
        content = result.signature || result.name;
        tokens = this.estimateTokens(content);
      } else {
        detail = 'reference';
        content = `${result.name} (${result.file}:${result.line})`;
        tokens = 15;
      }
      
      // Check if adding this would exceed budget
      if (tokensUsed + tokens > maxTokens && detail === 'full') {
        // Downgrade to signature
        detail = 'signature';
        content = result.signature || result.name;
        tokens = this.estimateTokens(content);
      }
      
      if (tokensUsed + tokens <= maxTokens) {
        allocated.push({ ...result, detail, content, tokens });
        tokensUsed += tokens;
      }
    }
    
    return allocated;
  }
  
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / this.CHARS_PER_TOKEN);
  }
}
```

---

## 3. Response Structure

```typescript
interface CuratedContextResponse {
  query: string;
  sections: ContextSection[];
  metadata: {
    tokens_used: number;
    tokens_budget: number;
    sources_queried: string[];
    total_candidates: number;
    results_returned: number;
    execution_time_ms: number;
  };
}

interface ContextSection {
  title: string;
  source: 'code' | 'memory' | 'graph';
  items: ContextItem[];
}

interface ContextItem {
  name: string;
  kind?: string;
  file?: string;
  line?: number;
  relevance: number;
  detail: 'full' | 'signature' | 'reference';
  content: string;
  relationship?: string;  // For graph items
}
```

---

## 4. Performance Considerations

| Concern | Solution |
|---------|----------|
| Parallel search latency | Timeout per source (1-1.5s), return partial |
| Large result sets | Limit each source to 20-30 results before merge |
| Token estimation accuracy | Conservative (4 chars/token), allow 10% overflow |
| Graph expansion cost | Only expand top 5 symbol matches, depth 1 |
| Embedding computation | Cache embeddings, reuse for similar queries |

---

## 5. Implementation Checklist

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | Create QueryAnalyzer | `src/context/query-analyzer.ts` | 2h |
| 2 | Create ParallelSearcher | `src/context/parallel-searcher.ts` | 4h |
| 3 | Create RRFMerger | `src/context/rrf-merger.ts` | 2h |
| 4 | Create BudgetAllocator | `src/context/budget-allocator.ts` | 2h |
| 5 | Create ResponseFormatter | `src/context/response-formatter.ts` | 2h |
| 6 | Create get_curated_context MCP tool | `src/tools/get-curated-context.ts` | 2h |
| 7 | Integration with existing code_search | `src/context/parallel-searcher.ts` | 1h |
| 8 | Integration with existing mem_search | `src/context/parallel-searcher.ts` | 1h |
| 9 | Integration with code_traverse (KSA-157) | `src/context/parallel-searcher.ts` | 1h |
| 10 | Write unit tests | `src/context/__tests__/` | 4h |
| 11 | Write integration tests | `src/tools/__tests__/` | 3h |
| 12 | Quality benchmark (test query set) | `src/context/__tests__/` | 2h |

**Total estimated effort:** ~3 days
