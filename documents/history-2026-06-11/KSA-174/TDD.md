# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-174: [Kotlin] AI Context Tools

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-174 |
| Title | [Kotlin] AI Context Tools — Technical Design |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-25 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-174.docx |
| Related BRD | BRD-v1-KSA-174.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-25 | SA Agent | Initial document |

---

## 1. Architecture Overview

### 1.1 Design Philosophy

- **Kotlin-idiomatic**: Use sealed classes for intent types, data classes for DTOs, extension functions for utilities
- **Coroutine-based**: Use `suspend` functions for potentially blocking operations (git, large DB queries)
- **Strategy Pattern**: Intent strategies are pluggable and extensible
- **Dependency Injection**: Services receive dependencies via constructor (no global state)
- **Functional Parity**: Same MCP tool names, same parameter schemas, equivalent output

### 1.2 Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Tool Layer                             │
│  AIContextToolDefinitions.kt                                 │
│  ├── get_ai_context handler                                  │
│  ├── get_edit_context handler                                │
│  └── get_curated_context handler                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                              │
│  ├── AIContextService                                        │
│  │     ├── IntentStrategyProvider                            │
│  │     └── SectionFetcher                                    │
│  ├── EditContextService                                      │
│  │     └── GitService                                        │
│  └── CuratedContextService                                   │
│        ├── QueryAnalyzer                                     │
│        ├── RRFMerger                                         │
│        └── BudgetAllocator                                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Shared Infrastructure                      │
│  ├── TokenBudgetManager                                      │
│  ├── SymbolResolver (from KSA-173)                           │
│  ├── CallGraphService (from KSA-173)                         │
│  ├── TestDetector (from KSA-173)                             │
│  ├── GraphTraverser (from KSA-173)                           │
│  └── DatabaseManager (from KSA-172)                          │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Package Structure

```
com.codeintel.context/
├── AIContextService.kt          // Main AI context service
├── EditContextService.kt        // Edit context service
├── CuratedContextService.kt     // Curated context service
├── TokenBudgetManager.kt        // Token estimation and budget assembly
├── IntentStrategies.kt          // Intent → section priority mapping
├── RRFMerger.kt                 // Reciprocal Rank Fusion
├── BudgetAllocator.kt           // Budget allocation for curated results
├── QueryAnalyzer.kt             // NL query → FTS query conversion
├── GitService.kt                // Git history retrieval
└── model/
    ├── Types.kt                 // Data classes, sealed classes, enums
    ├── AIContextParams.kt       // Input parameters
    └── AIContextResponse.kt     // Response types

com.codeintel.tools/
└── AIContextTools.kt            // MCP tool definitions + handlers
```

---

## 2. Detailed Design

### 2.1 Type System (model/Types.kt)

```kotlin
// Intent enum
enum class ContextIntent { EXPLAIN, MODIFY, DEBUG, TEST }

// Section definition
data class SectionDef(
    val name: String,
    val priority: Int,
    val format: SectionFormat
)

enum class SectionFormat { FULL, SUMMARY, SIGNATURES }

// Intent strategy
data class IntentStrategy(
    val intent: ContextIntent,
    val sections: List<SectionDef>
)

// Resolved symbol
data class ResolvedSymbol(
    val id: Long,
    val name: String,
    val kind: SymbolKind,
    val filePath: String,
    val startLine: Int,
    val endLine: Int?,
    val signature: String?,
    val parentName: String?
)

// AI Context response
data class AIContextResponse(
    val symbol: ResolvedSymbol?,
    val intent: String,
    val sections: Map<String, Any>,
    val metadata: ResponseMetadata
)

data class ResponseMetadata(
    val tokensUsed: Int,
    val tokensBudget: Int,
    val sectionsIncluded: List<String>,
    val sectionsExcluded: List<String>,
    val executionTimeMs: Long,
    val error: String? = null
)

// Edit Context response
data class EditContextResponse(
    val symbol: ResolvedSymbol?,
    val source: String?,
    val callers: List<CallerInfo>?,
    val tests: List<TestInfo>?,
    val git: List<GitCommit>?,
    val siblings: List<SiblingInfo>?,
    val metadata: ResponseMetadata
)

data class CallerInfo(val name: String, val file: String, val line: Int, val signature: String?)
data class TestInfo(val name: String, val file: String, val source: String?)
data class GitCommit(val hash: String, val author: String, val date: String, val message: String)
data class SiblingInfo(val name: String, val kind: String, val line: Int, val signature: String?)

// Curated Context response
data class CuratedContextResponse(
    val query: String,
    val sections: List<ContextSection>,
    val metadata: CuratedMetadata
)

data class ContextSection(
    val title: String,
    val source: String,
    val items: List<ContextItem>
)

data class ContextItem(
    val name: String,
    val kind: String,
    val file: String?,
    val line: Int?,
    val relevance: Double,
    val content: String?,
    val relationship: String?
)

data class CuratedMetadata(
    val tokensUsed: Int,
    val tokensBudget: Int,
    val sourcesQueried: List<String>,
    val totalCandidates: Int,
    val resultsReturned: Int,
    val executionTimeMs: Long
)
```

### 2.2 TokenBudgetManager

```kotlin
class TokenBudgetManager(budget: Int) {
    private val budget: Int = maxOf(budget, 500)
    private var consumed: Int = 0

    fun estimateTokens(content: Any?): Int {
        val text = when (content) {
            is String -> content
            null -> ""
            else -> Json.encodeToString(content)
        }
        return (text.length + 3) / 4  // ceil(length / 4)
    }

    fun canFit(tokens: Int): Boolean = consumed + tokens <= budget
    fun consume(tokens: Int) { consumed += tokens }
    fun remaining(): Int = maxOf(0, budget - consumed)
    fun isExhausted(): Boolean = remaining() < 50

    fun assemble(
        sections: Map<String, SectionContent>,
        budget: Int
    ): AssemblyResult {
        // Sort by priority, fit within budget, truncate arrays if needed
        // See FSD §5.2 for algorithm
    }
}
```

### 2.3 IntentStrategies

```kotlin
object IntentStrategies {
    private val strategies = mapOf(
        ContextIntent.EXPLAIN to IntentStrategy(
            intent = ContextIntent.EXPLAIN,
            sections = listOf(
                SectionDef("source", 1, SectionFormat.FULL),
                SectionDef("doc_comment", 2, SectionFormat.FULL),
                SectionDef("siblings", 3, SectionFormat.SIGNATURES),
                SectionDef("imports", 4, SectionFormat.FULL),
                SectionDef("callers", 5, SectionFormat.SUMMARY),
                SectionDef("callees", 6, SectionFormat.SUMMARY),
                SectionDef("type_definitions", 7, SectionFormat.FULL)
            )
        ),
        // ... modify, debug, test strategies
    )

    fun getStrategy(intent: ContextIntent): IntentStrategy =
        strategies[intent] ?: strategies[ContextIntent.EXPLAIN]!!
}
```

### 2.4 AIContextService

```kotlin
class AIContextService(
    private val db: Database,
    private val resolver: SymbolResolver,
    private val callGraph: CallGraphService,
    private val workspace: String
) {
    suspend fun getContext(params: AIContextParams): AIContextResponse {
        val startTime = System.currentTimeMillis()
        val budget = TokenBudgetManager(params.tokenBudget)

        // 1. Resolve symbol
        val symbol = resolver.resolve(params.symbol).firstOrNull()
            ?: return notFoundResponse(params)

        // 2. Get strategy
        val strategy = IntentStrategies.getStrategy(params.intent)

        // 3. Fetch sections
        val sections = mutableMapOf<String, SectionContent>()
        for (sectionDef in strategy.sections) {
            val content = fetchSection(sectionDef, symbol, params.callerDepth)
            if (content != null) {
                sections[sectionDef.name] = SectionContent(content, sectionDef.priority)
            }
        }

        // 4. Assemble within budget
        val assembly = budget.assemble(sections, params.tokenBudget)

        // 5. Return response
        return AIContextResponse(
            symbol = symbol,
            intent = params.intent.name.lowercase(),
            sections = assembly.result,
            metadata = ResponseMetadata(
                tokensUsed = assembly.tokenCount,
                tokensBudget = params.tokenBudget,
                sectionsIncluded = assembly.included,
                sectionsExcluded = assembly.excluded,
                executionTimeMs = System.currentTimeMillis() - startTime
            )
        )
    }

    private fun fetchSection(def: SectionDef, symbol: ResolvedSymbol, callerDepth: Int): Any? {
        return when (def.name) {
            "source" -> fetchSource(symbol)
            "callers" -> fetchCallers(symbol, callerDepth, def.format)
            "callees" -> fetchCallees(symbol, callerDepth)
            "tests" -> fetchRelatedTests(symbol)
            "siblings" -> fetchSiblings(symbol)
            "imports" -> fetchImports(symbol)
            "doc_comment" -> fetchDocComment(symbol)
            "type_definitions" -> fetchTypeDefinitions(symbol)
            "error_patterns" -> fetchErrorPatterns(symbol)
            "recent_changes" -> fetchRecentChanges(symbol)
            "test_patterns" -> fetchTestPatterns(symbol)
            "mocks_needed" -> fetchMocksNeeded(symbol)
            else -> null
        }
    }
}
```

### 2.5 RRFMerger

```kotlin
class RRFMerger(private val k: Int = 60) {

    data class SourceWeights(
        val code: Double = 1.0,
        val memory: Double = 0.8,
        val graph: Double = 0.6
    )

    fun merge(
        sources: Map<String, SearchResults>,
        weights: SourceWeights = SourceWeights()
    ): List<MergedResult> {
        val scores = mutableMapOf<String, MergedScore>()

        for ((sourceName, results) in sources) {
            val weight = when (sourceName) {
                "code" -> weights.code
                "memory" -> weights.memory
                "graph" -> weights.graph
                else -> 1.0
            }

            for ((rank, item) in results.items.withIndex()) {
                val key = "${item.name}:${item.file ?: ""}"
                val existing = scores.getOrPut(key) { MergedScore(item) }
                existing.score += weight * (1.0 / (k + rank))
                existing.sources.add(sourceName)
            }
        }

        return scores.values
            .sortedByDescending { it.score }
            .map { it.toMergedResult() }
    }
}
```

### 2.6 GitService

```kotlin
class GitService(private val workspace: String) {

    suspend fun getRecentCommits(filePath: String, limit: Int = 10): List<GitCommit> {
        return withContext(Dispatchers.IO) {
            try {
                val process = ProcessBuilder(
                    "git", "log", "--oneline", "--format=%h|%an|%ai|%s", "-$limit", "--", filePath
                ).directory(File(workspace))
                    .redirectErrorStream(true)
                    .start()

                val output = process.inputStream.bufferedReader().readText()
                val exitCode = process.waitFor()

                if (exitCode != 0) return@withContext emptyList()

                output.lines()
                    .filter { it.isNotBlank() }
                    .mapNotNull { line ->
                        val parts = line.split("|", limit = 4)
                        if (parts.size == 4) {
                            GitCommit(hash = parts[0], author = parts[1], date = parts[2], message = parts[3])
                        } else null
                    }
            } catch (e: Exception) {
                emptyList()  // Graceful degradation
            }
        }
    }
}
```

---

## 3. API Design

### 3.1 MCP Tool Registration

```kotlin
object AIContextToolDefinitions {
    val tools = listOf(
        ToolDefinition(
            name = "get_ai_context",
            description = "Get intent-aware code context with token budgeting...",
            inputSchema = JsonSchema(
                properties = mapOf(
                    "symbol" to StringSchema(description = "Symbol name..."),
                    "intent" to EnumSchema(values = listOf("explain", "modify", "debug", "test")),
                    "token_budget" to NumberSchema(description = "Max tokens (default: 4000)"),
                    "caller_depth" to NumberSchema(description = "Traversal depth (default: 1, max: 5)")
                ),
                required = listOf("symbol")
            )
        ),
        // get_edit_context, get_curated_context definitions...
    )
}
```

### 3.2 Tool Handler Routing

```kotlin
suspend fun handleToolCall(name: String, args: Map<String, Any?>, db: Database, workspace: String): String {
    return when (name) {
        "get_ai_context" -> handleGetAIContext(args, db, workspace)
        "get_edit_context" -> handleGetEditContext(args, db, workspace)
        "get_curated_context" -> handleGetCuratedContext(args, db, workspace)
        else -> """{"error": "Unknown tool: $name"}"""
    }
}
```

---

## 4. Database Design

### 4.1 Tables Used (Read-Only)

This module reads from tables created by KSA-172 and KSA-173:

```sql
-- Symbols table (KSA-172)
CREATE TABLE symbols (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    file_path TEXT NOT NULL,
    start_line INTEGER NOT NULL,
    end_line INTEGER,
    signature TEXT,
    parent_name TEXT,
    module TEXT
);

-- FTS5 index (KSA-172)
CREATE VIRTUAL TABLE symbols_fts USING fts5(name, signature, file_path, content=symbols, content_rowid=id);

-- Call graph (KSA-173)
CREATE TABLE call_graph_edges (
    id INTEGER PRIMARY KEY,
    caller_id INTEGER REFERENCES symbols(id),
    callee_id INTEGER REFERENCES symbols(id),
    edge_type TEXT DEFAULT 'calls'
);

-- Knowledge base (existing)
CREATE TABLE knowledge_entries (
    id INTEGER PRIMARY KEY,
    content TEXT,
    summary TEXT,
    type TEXT,
    tags TEXT,
    created_at TEXT
);

CREATE VIRTUAL TABLE knowledge_fts USING fts5(content, summary, tags, content=knowledge_entries, content_rowid=id);
```

### 4.2 Key Queries

```sql
-- Symbol resolution by name
SELECT * FROM symbols WHERE name = ? LIMIT 5;

-- Symbol resolution by class.method
SELECT * FROM symbols WHERE name = ? AND parent_name = ? LIMIT 1;

-- Callers of a symbol
SELECT s.* FROM symbols s
JOIN call_graph_edges e ON e.caller_id = s.id
WHERE e.callee_id = ? AND e.edge_type = 'calls';

-- Callees of a symbol
SELECT s.* FROM symbols s
JOIN call_graph_edges e ON e.callee_id = s.id
WHERE e.caller_id = ? AND e.edge_type = 'calls';

-- FTS5 code search
SELECT * FROM symbols WHERE id IN (
    SELECT rowid FROM symbols_fts WHERE symbols_fts MATCH ?
) LIMIT 30;

-- Knowledge base search
SELECT * FROM knowledge_entries WHERE id IN (
    SELECT rowid FROM knowledge_fts WHERE knowledge_fts MATCH ?
) ORDER BY created_at DESC LIMIT 10;
```

---

## 5. Error Handling

### 5.1 Error Strategy

| Layer | Strategy | Implementation |
|-------|----------|----------------|
| Tool Handler | Catch all exceptions, return JSON error | try/catch wrapping |
| Service | Propagate domain exceptions | Sealed class Result<T> |
| Infrastructure | Log and return null/empty | Graceful degradation |
| Git | Timeout + fallback | 2s timeout, return empty |

### 5.2 Result Type

```kotlin
sealed class ContextResult<out T> {
    data class Success<T>(val data: T) : ContextResult<T>()
    data class NotFound(val symbol: String, val suggestions: List<String> = emptyList()) : ContextResult<Nothing>()
    data class Error(val message: String, val cause: Throwable? = null) : ContextResult<Nothing>()
}
```

---

## 6. Performance Considerations

| Concern | Solution |
|---------|----------|
| Large call graphs | Limit traversal depth (max 5), use BFS with visited set |
| FTS5 query performance | Indexed virtual table, limit results to 30 |
| Git operations | Async with 2s timeout, cache results per session |
| Token estimation | Simple char/4 heuristic (no external library needed) |
| Memory | Stream large source files, don't load entire file into memory |
| Concurrent requests | Each request creates own service instances (stateless) |

---

## 7. Testing Strategy

### 7.1 Unit Tests

| Component | Test Focus |
|-----------|-----------|
| TokenBudgetManager | Budget math, truncation, assembly ordering |
| IntentStrategies | Correct section ordering per intent |
| RRFMerger | Score calculation, deduplication, weight application |
| QueryAnalyzer | Keyword extraction, FTS query building |
| GitService | Parse git output, handle errors |

### 7.2 Integration Tests

| Test | Setup | Verification |
|------|-------|-------------|
| get_ai_context end-to-end | In-memory SQLite with test data | Correct sections returned |
| get_edit_context with git | Test repo with commits | Git history included |
| get_curated_context | FTS5 populated | RRF merge produces ranked results |
| Symbol resolution formats | Various symbol formats in DB | All formats resolve correctly |

### 7.3 Parity Tests

Compare Kotlin output with Node.js output for same inputs:
- Same symbol, same intent → same sections included
- Same budget → similar token counts (±10%)
- Same query → similar ranking order

---

## 8. Implementation Checklist

| # | Task | File | Priority |
|---|------|------|----------|
| 1 | Define data types (sealed classes, data classes) | model/Types.kt | P0 |
| 2 | Implement TokenBudgetManager | TokenBudgetManager.kt | P0 |
| 3 | Implement IntentStrategies | IntentStrategies.kt | P0 |
| 4 | Implement AIContextService | AIContextService.kt | P0 |
| 5 | Implement EditContextService | EditContextService.kt | P0 |
| 6 | Implement GitService | GitService.kt | P1 |
| 7 | Implement QueryAnalyzer | QueryAnalyzer.kt | P1 |
| 8 | Implement RRFMerger | RRFMerger.kt | P1 |
| 9 | Implement BudgetAllocator | BudgetAllocator.kt | P1 |
| 10 | Implement CuratedContextService | CuratedContextService.kt | P1 |
| 11 | Register MCP tool definitions | AIContextTools.kt | P0 |
| 12 | Wire tool handlers | AIContextTools.kt | P0 |
| 13 | Unit tests for budget manager | TokenBudgetManagerTest.kt | P0 |
| 14 | Unit tests for RRF merger | RRFMergerTest.kt | P1 |
| 15 | Integration tests | AIContextIntegrationTest.kt | P1 |
| 16 | Parity tests vs Node.js | ParityTest.kt | P2 |

---

## 9. Security Design

| Concern | Mitigation |
|---------|-----------|
| Path traversal in symbol param | Validate no `../` in file paths |
| SQL injection | Use parameterized queries (PreparedStatement) |
| Command injection in git | Use ProcessBuilder with argument list (no shell) |
| Resource exhaustion | Enforce budget limits, depth limits, result limits |
| Sensitive data in context | Context tools only read indexed data (no secrets) |

---

## 10. Deployment Notes

- Module is part of `mcp-code-intelligence-kotlin` fat JAR
- No additional dependencies beyond KSA-172/173 (SQLite, tree-sitter JNI)
- Git CLI must be on PATH for git history feature (optional)
- No configuration needed — uses same database as other modules
