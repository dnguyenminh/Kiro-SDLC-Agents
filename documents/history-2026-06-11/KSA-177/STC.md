# Software Test Cases (STC)

## MCP Code Intelligence — KSA-177: [Kotlin] Similarity + Infrastructure

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-177 |
| Title | [Kotlin] Similarity + Infrastructure — Test Cases |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-25 |
| Status | Draft |
| Related STP | STP-v1-KSA-177.docx |

---

## 1. Property-Based Tests (PBT)

### PBT-01: Cosine Similarity Range

| Field | Value |
|-------|-------|
| Component | VectorMath |
| Property | -1.0 <= cosineSimilarity(a, b) <= 1.0 |
| Generator | Two random FloatArrays of size 384, values in [-1, 1] |
| Iterations | 1000 |

```kotlin
@Test
fun `cosine similarity always in range`() = forAll(
    Arb.floatArray(Arb.float(-1f..1f), 384..384),
    Arb.floatArray(Arb.float(-1f..1f), 384..384)
) { a, b ->
    val sim = VectorMath.cosineSimilarity(a, b)
    sim in -1.0f..1.0f
}
```

### PBT-02: Cosine Self-Similarity

| Field | Value |
|-------|-------|
| Component | VectorMath |
| Property | cosineSimilarity(a, a) ≈ 1.0 for non-zero vectors |
| Generator | Random non-zero FloatArray of size 384 |
| Tolerance | 0.0001 |

### PBT-03: Union-Find Idempotent

| Field | Value |
|-------|-------|
| Component | ClusterBuilder |
| Property | find(x) == find(x) for any sequence of unions |
| Generator | Random union operations (10-100) |

### PBT-04: Union-Find Transitive

| Field | Value |
|-------|-------|
| Component | ClusterBuilder |
| Property | union(a,b) + union(b,c) implies find(a) == find(c) |
| Generator | Random triples of strings |

### PBT-05: Cluster Size Conservation

| Field | Value |
|-------|-------|
| Component | ClusterBuilder |
| Property | sum of all cluster sizes == number of unique elements |
| Generator | Random union operations |

---

## 2. Unit Tests (UT)

### UT-01: Cosine Similarity Identical Vectors

| Field | Value |
|-------|-------|
| Input | a = [1,0,0,...], b = [1,0,0,...] |
| Expected | 1.0f |
| Steps | Call VectorMath.cosineSimilarity(a, b), assert ≈ 1.0 |

### UT-02: Cosine Similarity Orthogonal

| Field | Value |
|-------|-------|
| Input | a = [1,0,0,...], b = [0,1,0,...] |
| Expected | 0.0f |

### UT-03: Cosine Similarity Zero Vector

| Field | Value |
|-------|-------|
| Input | a = [0,0,0,...], b = [1,2,3,...] |
| Expected | 0.0f (no division by zero) |

### UT-04: Bytes/Floats Roundtrip

| Field | Value |
|-------|-------|
| Input | FloatArray(384) { it.toFloat() } |
| Expected | floatsToBytes then bytesToFloats == original |

### UT-05: ClusterBuilder Three Unions

| Field | Value |
|-------|-------|
| Input | union(A,B), union(B,C), union(D,E) |
| Expected | 2 clusters: {A,B,C} and {D,E} |

### UT-06: Suggestion Generator Extract Method

| Field | Value |
|-------|-------|
| Input | Cluster of 2 functions, same file, similar line count |
| Expected | Suggestion type = "extract_method" |

### UT-07: Dead Code No Callers High Confidence

| Field | Value |
|-------|-------|
| Input | Private function, no callers, not entry point |
| Expected | confidence >= 90, reasons includes "no callers" |

### UT-08: Dead Code Test-Only Callers

| Field | Value |
|-------|-------|
| Input | Function called only from test files |
| Expected | confidence 70-89, reasons includes "only called from tests" |

### UT-09: Dead Code Public Function

| Field | Value |
|-------|-------|
| Input | Public function, no callers |
| Expected | confidence reduced (< 80), reasons includes "public" |

### UT-10: Dead Code Interface Implementation

| Field | Value |
|-------|-------|
| Input | Function implements interface method, no direct callers |
| Expected | confidence < 70, reasons includes "dynamic dispatch" |

### UT-11: Dead Code Entry Point Excluded

| Field | Value |
|-------|-------|
| Input | HTTP handler function with no callers |
| Expected | NOT in dead code candidates |

### UT-12: Dead Code Test Function Excluded

| Field | Value |
|-------|-------|
| Input | Function in test file |
| Expected | NOT in dead code candidates |

### UT-13: Git Log Parser Valid

| Field | Value |
|-------|-------|
| Input | "abc123|abc123|John|2026-05-20T10:00:00+00:00|Fix bug" |
| Expected | GitCommit(hash="abc123", author="John", message="Fix bug") |

### UT-14: Git Log Parser Empty

| Field | Value |
|-------|-------|
| Input | "" |
| Expected | emptyList() |

### UT-15: Git Search No Results

| Field | Value |
|-------|-------|
| Input | Query with no matching commits in DB |
| Expected | Empty list |

### UT-16: Git Search Author Filter

| Field | Value |
|-------|-------|
| Input | 5 commits (3 by John, 2 by Jane), filter author="John" |
| Expected | Only 3 results (John's commits) |

---

## 3. Integration Tests (IT)

### IT-01: Duplicate Detection Known Duplicates

| Field | Value |
|-------|-------|
| Setup | DB with 2 symbols having identical embedding vectors |
| Input | find_duplicates(min_similarity=0.8) |
| Expected | 1 pair found, similarity ≈ 1.0, 1 cluster with 2 members |

### IT-02: Duplicate Detection No Duplicates

| Field | Value |
|-------|-------|
| Setup | DB with 5 symbols having random orthogonal embeddings |
| Input | find_duplicates(min_similarity=0.85) |
| Expected | 0 pairs, 0 clusters |

### IT-03: Duplicate Detection File Filter

| Field | Value |
|-------|-------|
| Setup | DB with embeddings from 3 files |
| Input | find_duplicates(file="src/context/AIContextService.kt") |
| Expected | Only functions from that file compared |

### IT-04: Dead Code Isolated Function

| Field | Value |
|-------|-------|
| Setup | Call graph: A→B→C, D isolated (no edges) |
| Input | find_dead_code() with entry_points=[A] |
| Expected | D in candidates (unreachable) |

### IT-05: Dead Code All Reachable

| Field | Value |
|-------|-------|
| Setup | Call graph: A→B→C→D (linear chain), entry=[A] |
| Input | find_dead_code() |
| Expected | 0 candidates |

### IT-06: Dead Code Entry Points Excluded

| Field | Value |
|-------|-------|
| Setup | Entry point E with no callers |
| Input | find_dead_code() |
| Expected | E NOT in candidates |

### IT-07: Git Indexing

| Field | Value |
|-------|-------|
| Setup | Test git repo with 5 commits |
| Input | git_search(query="test", index=true) |
| Expected | 5 commits indexed in DB |

### IT-08: Git Semantic Search

| Field | Value |
|-------|-------|
| Setup | DB with commits: "fix auth bug", "add logging", "refactor database" |
| Input | git_search(query="authentication issue") |
| Expected | "fix auth bug" ranked first (highest similarity) |

### IT-09: Git Date Filter

| Field | Value |
|-------|-------|
| Setup | Commits from Jan, Mar, May 2026 |
| Input | git_search(query="test", since="2026-02-01") |
| Expected | Only Mar and May commits returned |

---

## 4. E2E API Tests

### E2E-01: find_duplicates Default

| Field | Value |
|-------|-------|
| Input | {} |
| Expected | Text report with "Duplicate Detection Report" header |

### E2E-02: find_duplicates File Filter

| Field | Value |
|-------|-------|
| Input | {"file": "src/specific.kt"} |
| Expected | Report scans only that file |

### E2E-03: find_duplicates High Threshold

| Field | Value |
|-------|-------|
| Input | {"min_similarity": 0.99} |
| Expected | Fewer or no duplicates found |

### E2E-04: find_dead_code Default

| Field | Value |
|-------|-------|
| Input | {} |
| Expected | Text report with "Dead Code Detection Report" header |

### E2E-05: find_dead_code High Confidence

| Field | Value |
|-------|-------|
| Input | {"min_confidence": 90} |
| Expected | Only high-confidence candidates |

### E2E-06: find_dead_code File Filter

| Field | Value |
|-------|-------|
| Input | {"file": "src/specific.kt"} |
| Expected | Only candidates from that file |

### E2E-07: git_search Basic

| Field | Value |
|-------|-------|
| Input | {"query": "fix memory leak"} |
| Expected | Ranked commit results |

### E2E-08: git_search With Index

| Field | Value |
|-------|-------|
| Input | {"query": "test", "index": true} |
| Expected | "Indexed N commits" message + results |

### E2E-09: git_search Author Filter

| Field | Value |
|-------|-------|
| Input | {"query": "refactor", "author": "john"} |
| Expected | Only John's commits |

### E2E-10: git_search Date Filter

| Field | Value |
|-------|-------|
| Input | {"query": "test", "since": "2026-03-01", "until": "2026-04-01"} |
| Expected | Only March 2026 commits |

---

## 5. SIT Parity Tests

### SIT-01: Duplicate Pairs Match

| Method | Same pre-computed embeddings in both Kotlin and Python DB |
| Pass | Same pairs found (same a, b, similarity within 0.001) |

### SIT-02: Dead Code Candidates Match

| Method | Same call graph in both implementations |
| Pass | Same candidate names and files |

### SIT-03: Git Search Ranking

| Method | Same indexed commits, same query |
| Pass | Top 3 results in same order |

### SIT-04: Confidence Scores

| Method | Same function properties |
| Pass | Confidence within 5 points |
