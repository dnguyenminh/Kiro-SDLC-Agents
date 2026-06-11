# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-177: [Kotlin] Similarity + Infrastructure

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-177 |
| Title | [Kotlin] Similarity + Infrastructure — Technical Design |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-25 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-177.docx |
| Related BRD | BRD-v1-KSA-177.docx |

---

## 1. Architecture Overview

### 1.1 Design Philosophy

- **ONNX-first**: Use ONNX Runtime for JVM for embedding inference (no Python dependency)
- **Lazy loading**: ONNX model loaded on first use, not at startup
- **Batch processing**: Generate embeddings in batches during indexing
- **Union-Find with path compression**: Efficient clustering O(α(n)) per operation
- **Incremental**: Git indexing and embedding generation are incremental

### 1.2 Package Structure

```
com.codeintel.similarity/
├── DuplicateDetector.kt         // Main duplicate detection
├── DeadCodeDetector.kt          // Dead code analysis
├── ClusterBuilder.kt            // Union-Find implementation
├── SuggestionGenerator.kt       // Refactoring suggestions
├── EmbeddingService.kt          // ONNX embedding inference
├── VectorMath.kt                // Cosine similarity, vector ops
└── model/
    ├── Types.kt                 // Data classes
    └── Reports.kt               // Report types

com.codeintel.git/
├── GitMiner.kt                  // Git history indexing + search
├── GitLogParser.kt              // Parse git log output
└── model/
    └── GitTypes.kt              // Commit, SearchResult types

com.codeintel.tools/
└── SimilarityTools.kt           // MCP tool definitions + handlers
```

---

## 2. Detailed Design

### 2.1 EmbeddingService

```kotlin
class EmbeddingService(private val modelPath: String) {
    private var session: OrtSession? = null
    private var environment: OrtEnvironment? = null
    private val tokenizer: SimpleTokenizer = SimpleTokenizer()

    val isAvailable: Boolean get() = File(modelPath).exists()

    fun initialize() {
        if (session != null) return
        environment = OrtEnvironment.getEnvironment()
        session = environment!!.createSession(modelPath)
    }

    fun embed(text: String): FloatArray {
        initialize()
        val tokens = tokenizer.tokenize(text, maxLength = 512)
        val inputIds = OnnxTensor.createTensor(environment, arrayOf(tokens.inputIds))
        val attentionMask = OnnxTensor.createTensor(environment, arrayOf(tokens.attentionMask))
        
        val results = session!!.run(mapOf(
            "input_ids" to inputIds,
            "attention_mask" to attentionMask
        ))
        
        val output = results[0].value as Array<FloatArray>
        return meanPooling(output[0], tokens.attentionMask)
    }

    fun embedBatch(texts: List<String>): List<FloatArray> {
        return texts.map { embed(it) }  // Sequential for simplicity; can batch later
    }

    private fun meanPooling(embeddings: FloatArray, mask: LongArray): FloatArray {
        // Mean pooling over non-padding tokens
        val dim = 384
        val result = FloatArray(dim)
        var count = 0
        for (i in mask.indices) {
            if (mask[i] == 1L) {
                for (d in 0 until dim) {
                    result[d] += embeddings[i * dim + d]
                }
                count++
            }
        }
        if (count > 0) for (d in 0 until dim) result[d] /= count
        return result
    }

    fun close() {
        session?.close()
        environment?.close()
    }
}
```

### 2.2 VectorMath

```kotlin
object VectorMath {
    fun cosineSimilarity(a: FloatArray, b: FloatArray): Float {
        require(a.size == b.size) { "Vectors must have same dimension" }
        var dot = 0f; var normA = 0f; var normB = 0f
        for (i in a.indices) {
            dot += a[i] * b[i]
            normA += a[i] * a[i]
            normB += b[i] * b[i]
        }
        val denom = sqrt(normA) * sqrt(normB)
        return if (denom > 0f) dot / denom else 0f
    }

    fun bytesToFloats(data: ByteArray): FloatArray {
        val buffer = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN)
        return FloatArray(data.size / 4) { buffer.getFloat() }
    }

    fun floatsToBytes(data: FloatArray): ByteArray {
        val buffer = ByteBuffer.allocate(data.size * 4).order(ByteOrder.LITTLE_ENDIAN)
        data.forEach { buffer.putFloat(it) }
        return buffer.array()
    }
}
```

### 2.3 DuplicateDetector

```kotlin
class DuplicateDetector(
    private val db: Database,
    private val minSimilarity: Float = 0.85f,
    private val minLines: Int = 5
) {
    fun detect(filePath: String? = null): DuplicateReport {
        // 1. Load embeddings
        val embeddings = loadEmbeddings(filePath)
        if (embeddings.size < 2) return emptyReport(embeddings.size)

        // 2. Compute similarities
        val pairs = if (embeddings.size > 10000) {
            annSearch(embeddings)
        } else {
            bruteForce(embeddings)
        }

        // 3. Cluster
        val clusterBuilder = ClusterBuilder()
        pairs.forEach { clusterBuilder.union(it.a, it.b) }
        val clusters = clusterBuilder.getClusters()

        // 4. Generate suggestions
        val symbolInfo = getSymbolInfo(embeddings.keys)
        val suggestions = SuggestionGenerator().generate(clusters, symbolInfo)

        return DuplicateReport(embeddings.size, pairs, clusters, suggestions)
    }

    private fun bruteForce(embeddings: Map<String, FloatArray>): List<SimilarityPair> {
        val keys = embeddings.keys.toList()
        val pairs = mutableListOf<SimilarityPair>()
        for (i in keys.indices) {
            for (j in i + 1 until keys.size) {
                val sim = VectorMath.cosineSimilarity(embeddings[keys[i]]!!, embeddings[keys[j]]!!)
                if (sim >= minSimilarity) {
                    pairs.add(SimilarityPair(keys[i], keys[j], sim))
                }
            }
        }
        return pairs
    }
}
```

### 2.4 ClusterBuilder (Union-Find)

```kotlin
class ClusterBuilder {
    private val parent = mutableMapOf<String, String>()
    private val rank = mutableMapOf<String, Int>()

    fun find(x: String): String {
        parent.putIfAbsent(x, x)
        if (parent[x] != x) {
            parent[x] = find(parent[x]!!)  // Path compression
        }
        return parent[x]!!
    }

    fun union(a: String, b: String) {
        val rootA = find(a)
        val rootB = find(b)
        if (rootA == rootB) return

        // Union by rank
        val rankA = rank.getOrDefault(rootA, 0)
        val rankB = rank.getOrDefault(rootB, 0)
        when {
            rankA < rankB -> parent[rootA] = rootB
            rankA > rankB -> parent[rootB] = rootA
            else -> { parent[rootB] = rootA; rank[rootA] = rankA + 1 }
        }
    }

    fun getClusters(): List<Cluster> {
        return parent.keys
            .groupBy { find(it) }
            .values
            .filter { it.size > 1 }
            .map { Cluster(it) }
    }
}
```

### 2.5 DeadCodeDetector

```kotlin
class DeadCodeDetector(
    private val db: Database,
    private val callGraph: CallGraphService,
    private val entryPointDetector: EntryPointDetector,
    private val workspace: String,
    private val minConfidence: Int = 60
) {
    fun detect(filePath: String? = null): DeadCodeReport {
        // 1. Get entry points
        val entryPoints = entryPointDetector.detect()
        val entryPointIds = entryPoints.map { it.symbolId }.toSet()

        // 2. BFS from entry points
        val reachable = bfsReachability(entryPointIds)

        // 3. Find unreachable
        val allFunctions = getAllFunctions(filePath)
        val candidates = allFunctions
            .filter { it.id !in reachable && it.id !in entryPointIds && !isTestFunction(it) }
            .map { scoreConfidence(it, entryPointIds) }
            .filter { it.confidence >= minConfidence }
            .sortedByDescending { it.confidence }

        return DeadCodeReport(
            totalFunctions = allFunctions.size,
            entryPoints = entryPoints.size,
            reachable = reachable.size,
            candidates = candidates
        )
    }

    private fun bfsReachability(entryPointIds: Set<Long>): Set<Long> {
        val visited = mutableSetOf<Long>()
        val queue = ArrayDeque(entryPointIds)
        while (queue.isNotEmpty()) {
            val current = queue.removeFirst()
            if (current in visited) continue
            visited.add(current)
            queue.addAll(callGraph.getCalleeIds(current))
        }
        return visited
    }

    private fun scoreConfidence(symbol: SymbolInfo, entryPoints: Set<Long>): DeadCodeCandidate {
        val reasons = mutableListOf<String>()
        var confidence = 90

        val callers = callGraph.getCallerIds(symbol.id)
        if (callers.isEmpty()) {
            reasons.add("no callers")
            confidence = 95
        } else if (callers.all { isTestFunction(it) }) {
            reasons.add("only called from tests")
            confidence = 80
        }

        if (symbol.visibility == "private") {
            reasons.add("private visibility")
        } else if (symbol.visibility == "public") {
            reasons.add("public (might be used externally)")
            confidence -= 20
        }

        if (symbol.hasDeprecatedAnnotation) {
            reasons.add("deprecated annotation")
            confidence += 5
        }

        if (symbol.implementsInterface) {
            reasons.add("implements interface (dynamic dispatch possible)")
            confidence -= 25
        }

        return DeadCodeCandidate(
            name = symbol.name,
            filePath = symbol.filePath,
            startLine = symbol.startLine,
            endLine = symbol.endLine,
            confidence = confidence.coerceIn(0, 100),
            reasons = reasons
        )
    }
}
```

### 2.6 GitMiner

```kotlin
class GitMiner(
    private val db: Database,
    private val repoPath: String,
    private val embeddingService: EmbeddingService
) {
    fun indexHistory(force: Boolean = false): IndexSummary {
        val existingHashes = if (force) emptySet() else getIndexedHashes()
        val commits = parseGitLog()
        val newCommits = commits.filter { it.hash !in existingHashes }

        if (newCommits.isEmpty()) return IndexSummary(0, existingHashes.size)

        // Generate embeddings for new commits
        val texts = newCommits.map { "${it.message}" }
        val embeddings = embeddingService.embedBatch(texts)

        // Store in DB
        db.transaction {
            newCommits.zip(embeddings).forEach { (commit, embedding) ->
                insertCommit(commit, embedding)
            }
        }

        return IndexSummary(newCommits.size, existingHashes.size + newCommits.size)
    }

    fun search(
        query: String,
        limit: Int = 10,
        author: String? = null,
        fileFilter: String? = null,
        since: String? = null,
        until: String? = null
    ): List<GitSearchResult> {
        val queryEmbedding = embeddingService.embed(query)
        val allCommits = loadCommitsWithEmbeddings()

        return allCommits
            .map { commit ->
                val similarity = VectorMath.cosineSimilarity(queryEmbedding, commit.embedding)
                GitSearchResult(commit, similarity)
            }
            .filter { it.relevance > 0.3f }  // Minimum relevance
            .filter { applyFilters(it.commit, author, fileFilter, since, until) }
            .sortedByDescending { it.relevance }
            .take(limit)
    }

    private fun parseGitLog(): List<GitCommit> {
        val process = ProcessBuilder(
            "git", "log", "--format=%H|%h|%an|%aI|%s", "--numstat"
        ).directory(File(repoPath)).start()
        // Parse output...
        return GitLogParser.parse(process.inputStream.bufferedReader().readText())
    }
}
```

---

## 3. Database Design

### 3.1 New Tables

```sql
-- Embeddings for function bodies
CREATE TABLE IF NOT EXISTS embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol_id INTEGER NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
    vector BLOB NOT NULL,
    model_version TEXT DEFAULT 'all-MiniLM-L6-v2',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(symbol_id)
);

CREATE INDEX idx_embeddings_symbol ON embeddings(symbol_id);

-- Git commit history with embeddings
CREATE TABLE IF NOT EXISTS git_commits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT UNIQUE NOT NULL,
    short_hash TEXT NOT NULL,
    author TEXT NOT NULL,
    date TEXT NOT NULL,
    message TEXT NOT NULL,
    files_changed TEXT,  -- JSON array
    insertions INTEGER DEFAULT 0,
    deletions INTEGER DEFAULT 0,
    embedding BLOB NOT NULL,
    indexed_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_git_commits_date ON git_commits(date);
CREATE INDEX idx_git_commits_author ON git_commits(author);
```

---

## 4. Error Handling

| Scenario | Strategy |
|----------|----------|
| ONNX model not found | Return error message, disable similarity tools |
| ONNX inference fails | Log error, skip that function's embedding |
| Git not available | Return error for git_search, dead code still works |
| Empty embeddings table | Return "No embeddings. Run indexing first." |
| DB locked during batch insert | Retry with exponential backoff (3 attempts) |

---

## 5. Performance Considerations

| Concern | Solution |
|---------|----------|
| O(n^2) pairwise comparison | Brute force for n<10000; ANN for larger |
| ONNX model loading time | Lazy load on first use (~500ms cold start) |
| Large git history | Incremental indexing; batch embedding generation |
| Memory for embeddings | Stream from DB, don't load all at once for ANN |
| BFS on large call graph | Visited set prevents revisiting; bounded by graph size |

---

## 6. Testing Strategy

### 6.1 Unit Tests

| Component | Focus |
|-----------|-------|
| VectorMath | Cosine similarity correctness, edge cases (zero vector, identical) |
| ClusterBuilder | Union-Find correctness, path compression, cluster extraction |
| SuggestionGenerator | Correct suggestion types based on cluster properties |
| GitLogParser | Parse various git log formats |
| DeadCodeDetector.scoreConfidence | Confidence scoring logic |

### 6.2 Integration Tests

| Test | Setup |
|------|-------|
| DuplicateDetector end-to-end | In-memory DB with pre-computed embeddings |
| DeadCodeDetector end-to-end | DB with call graph + entry points |
| GitMiner search | DB with indexed commits + embeddings |
| EmbeddingService | Real ONNX model, verify output dimensions |

---

## 7. Implementation Checklist

| # | Task | File | Priority |
|---|------|------|----------|
| 1 | VectorMath utilities | VectorMath.kt | P0 |
| 2 | EmbeddingService (ONNX) | EmbeddingService.kt | P0 |
| 3 | ClusterBuilder (Union-Find) | ClusterBuilder.kt | P0 |
| 4 | DuplicateDetector | DuplicateDetector.kt | P0 |
| 5 | SuggestionGenerator | SuggestionGenerator.kt | P1 |
| 6 | DeadCodeDetector | DeadCodeDetector.kt | P0 |
| 7 | GitLogParser | GitLogParser.kt | P1 |
| 8 | GitMiner | GitMiner.kt | P1 |
| 9 | DB schema migration | V5__similarity.sql | P0 |
| 10 | MCP tool definitions | SimilarityTools.kt | P0 |
| 11 | Tool handlers | SimilarityTools.kt | P0 |
| 12 | Unit tests | *Test.kt | P0 |
| 13 | Integration tests | *IntegrationTest.kt | P1 |
| 14 | ONNX model bundling | build.gradle.kts | P1 |

---

## 8. Security Design

| Concern | Mitigation |
|---------|-----------|
| ONNX model tampering | Verify model hash on load |
| Git command injection | Use ProcessBuilder with argument list |
| Large embedding payloads | Limit batch size to 100 |
| SQL injection | Parameterized queries only |
| Path traversal in file filter | Validate paths within workspace |
