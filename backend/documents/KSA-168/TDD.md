# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-168: [Similarity] Duplicates + Dead Code + Git Mining

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-168 |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-06-07 |
| Related FSD | FSD-v1-KSA-168.docx |

---

## 1. Architecture Overview

Three code quality analysis tools leveraging embeddings, call graph, and git history.

```
┌─────────────────────────────────────────────────────┐
│ MCP Tools (find_duplicates, find_dead_code, etc.)    │
├─────────────────────────────────────────────────────┤
│ Similarity & Quality Modules (NEW)                   │
│  ├── DuplicateDetector                              │
│  │   ├── PairwiseSimilarity (cosine)               │
│  │   ├── ClusterBuilder (Union-Find)               │
│  │   └── SuggestionGenerator                        │
│  ├── DeadCodeDetector                               │
│  │   ├── ReachabilityAnalyzer (BFS from entries)   │
│  │   ├── ConfidenceScorer                           │
│  │   └── DynamicDispatchRecognizer                  │
│  └── GitMiner                                       │
│      ├── GitLogParser                               │
│      ├── CommitEmbedder                             │
│      ├── GitVectorIndex                             │
│      └── SemanticSearcher                           │
├─────────────────────────────────────────────────────┤
│ Dependencies                                         │
│  ├── Full-body Embeddings (KSA-169)                 │
│  ├── Call Graph (KSA-154)                           │
│  ├── Entry Points (KSA-162)                         │
│  └── sqlite-vec (vector search)                     │
└─────────────────────────────────────────────────────┘
```

---

## 2. Module Design

### 2.1 File Structure

```
src/mcp_code_intel/
├── analyzers/
│   └── similarity/
│       ├── __init__.py
│       ├── duplicate_detector.py    # Main duplicate detection
│       ├── cluster_builder.py       # Union-Find clustering
│       ├── suggestion_generator.py  # Refactoring suggestions
│       ├── dead_code_detector.py    # Main dead code detection
│       ├── reachability.py          # BFS from entry points
│       ├── confidence_scorer.py     # Dead code confidence
│       └── dynamic_dispatch.py      # Reflection/DI recognition
├── git/
│   ├── __init__.py
│   ├── git_miner.py               # Orchestrator
│   ├── git_log_parser.py          # Parse git log output
│   ├── commit_embedder.py         # Embed commit summaries
│   ├── git_vector_index.py        # Store/search commit vectors
│   └── semantic_searcher.py       # NL query → relevant commits
```

### 2.2 Key Classes

#### DuplicateDetector

```python
class DuplicateDetector:
    """Find near-duplicate code using embedding similarity."""
    
    def __init__(self, min_similarity: float = 0.85, min_lines: int = 5):
        self.min_similarity = min_similarity
        self.min_lines = min_lines
    
    def detect(self, file_path: Optional[str] = None) -> DuplicateReport:
        """Find duplicate functions."""
        # 1. Load body embeddings
        # 2. Filter by min_lines
        # 3. Compute pairwise similarity (or ANN for large sets)
        # 4. Build clusters
        # 5. Generate suggestions
        
    def _compute_similarities(self, embeddings: list) -> list[SimilarityPair]:
        """Compute cosine similarity between all pairs."""
        if len(embeddings) > 10000:
            return self._ann_search(embeddings)  # Approximate
        return self._brute_force(embeddings)     # Exact

class ClusterBuilder:
    """Build duplicate clusters using Union-Find."""
    
    def __init__(self):
        self.parent = {}
        self.rank = {}
    
    def union(self, a: str, b: str) -> None:
        """Merge two nodes into same cluster."""
        
    def find(self, x: str) -> str:
        """Find cluster representative (with path compression)."""
        
    def get_clusters(self) -> dict[str, list[str]]:
        """Return all clusters."""
```

#### DeadCodeDetector

```python
class DeadCodeDetector:
    """Detect unreachable code using call graph reachability."""
    
    def __init__(self, call_graph, entry_points, min_confidence: int = 60):
        self.graph = call_graph
        self.entries = entry_points
        self.min_confidence = min_confidence
    
    def detect(self, file_path: Optional[str] = None) -> DeadCodeReport:
        """Find dead code with confidence scoring."""
        reachable = self._compute_reachability()
        all_functions = self._get_all_functions(file_path)
        dead_candidates = [f for f in all_functions if f.id not in reachable]
        scored = [self._score(f) for f in dead_candidates]
        return [s for s in scored if s.confidence >= self.min_confidence]
    
    def _compute_reachability(self) -> set[str]:
        """BFS from all entry points through call graph."""
        visited = set()
        queue = deque(self.entries)
        while queue:
            node = queue.popleft()
            if node in visited:
                continue
            visited.add(node)
            for callee in self.graph.get_callees(node):
                queue.append(callee)
        return visited

class ConfidenceScorer:
    """Score dead code confidence based on multiple factors."""
    
    FACTORS = {
        "no_callers": 40,
        "not_exported": 20,
        "no_tests": 15,
        "has_deprecated": 15,
        "dynamic_dispatch": -30,
        "config_reference": -20,
        "recently_modified": -10,
    }
    
    def score(self, function, context) -> int:
        """Compute confidence score (0-100)."""
        score = 0
        reasons = []
        for factor, impact in self.FACTORS.items():
            if self._check_factor(factor, function, context):
                score += impact
                reasons.append(factor)
        return max(0, min(100, score)), reasons
```

#### GitMiner

```python
class GitMiner:
    """Semantic search over git commit history."""
    
    def __init__(self, repo_path: str, max_commits: int = 10000):
        self.repo_path = repo_path
        self.max_commits = max_commits
        self.index = GitVectorIndex()
    
    def index_history(self, force: bool = False) -> IndexingSummary:
        """Index git commits (incremental by default)."""
        last_hash = self.index.get_last_indexed_hash()
        commits = self._parse_git_log(since_hash=last_hash)
        for commit in commits:
            summary = f"{commit.message}\nFiles: {', '.join(commit.files)}"
            embedding = embed(summary)
            self.index.store(commit, embedding)
        return IndexingSummary(indexed=len(commits))
    
    def search(self, query: str, **filters) -> list[CommitResult]:
        """Semantic search over indexed commits."""
        query_embedding = embed(query)
        results = self.index.search(query_embedding, limit=filters.get("limit", 10))
        # Apply filters (file, author, date)
        return self._apply_filters(results, filters)
    
    def _parse_git_log(self, since_hash: Optional[str] = None) -> list[Commit]:
        """Parse git log output."""
        cmd = ["git", "log", "--format=%H|%an|%aI|%s", "--numstat"]
        if since_hash:
            cmd.append(f"{since_hash}..HEAD")
        else:
            cmd.extend(["-n", str(self.max_commits)])
        # Parse output...
```

---

## 3. Database Schema

### 3.1 Git History Index

```sql
CREATE TABLE IF NOT EXISTS git_commits (
    hash TEXT PRIMARY KEY,
    author TEXT NOT NULL,
    date TEXT NOT NULL,
    message TEXT NOT NULL,
    files_changed TEXT NOT NULL,  -- JSON array
    insertions INTEGER DEFAULT 0,
    deletions INTEGER DEFAULT 0,
    embedding BLOB NOT NULL  -- Float32[384]
);

CREATE INDEX idx_git_date ON git_commits(date);
CREATE INDEX idx_git_author ON git_commits(author);

-- Metadata
CREATE TABLE IF NOT EXISTS git_index_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
-- Keys: last_indexed_hash, total_commits, last_indexed_at
```

---

## 4. Algorithm Details

### 4.1 Union-Find for Clustering

```python
def build_clusters(pairs: list[SimilarityPair], threshold: float) -> list[Cluster]:
    uf = ClusterBuilder()
    for pair in pairs:
        if pair.similarity >= threshold:
            uf.union(pair.a, pair.b)
    
    # Group by cluster representative
    clusters = defaultdict(list)
    for node in all_nodes:
        root = uf.find(node)
        clusters[root].append(node)
    
    # Filter: only clusters with 2+ members
    return [Cluster(members=members) for members in clusters.values() if len(members) >= 2]
```

### 4.2 Approximate Nearest Neighbor (for large codebases)

```python
def ann_search(embeddings: list[np.ndarray], threshold: float) -> list[SimilarityPair]:
    """Use sqlite-vec for approximate search when > 10K functions."""
    pairs = []
    for i, emb in enumerate(embeddings):
        # Query top-K nearest neighbors
        neighbors = sqlite_vec_search(emb, limit=20)
        for neighbor in neighbors:
            if neighbor.similarity >= threshold and neighbor.id != i:
                pairs.append(SimilarityPair(a=i, b=neighbor.id, similarity=neighbor.similarity))
    return pairs
```

---

## 5. Performance Design

| Operation | Target | Approach |
|-----------|--------|----------|
| Duplicate scan (1K functions) | < 30s | Brute-force cosine |
| Duplicate scan (10K+ functions) | < 60s | ANN (sqlite-vec) |
| Dead code scan | < 20s | BFS reachability |
| Git indexing (10K commits) | < 60s | Batch embed |
| Git search | < 500ms | Vector similarity |

---

## 6. Implementation Checklist

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | DuplicateDetector | similarity/duplicate_detector.py | 2d |
| 2 | ClusterBuilder (Union-Find) | similarity/cluster_builder.py | 0.5d |
| 3 | SuggestionGenerator | similarity/suggestion_generator.py | 0.5d |
| 4 | DeadCodeDetector | similarity/dead_code_detector.py | 2d |
| 5 | ReachabilityAnalyzer | similarity/reachability.py | 1d |
| 6 | ConfidenceScorer | similarity/confidence_scorer.py | 1d |
| 7 | GitLogParser | git/git_log_parser.py | 1d |
| 8 | CommitEmbedder + Index | git/commit_embedder.py + git_vector_index.py | 1.5d |
| 9 | SemanticSearcher | git/semantic_searcher.py | 1d |
| 10 | MCP tool integration | tools/ | 1d |
| 11 | Tests | tests/ | 2d |

**Total estimate:** ~14 days (3 weeks with buffer matches Jira estimate)

---

## 7. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
