# Feature Parity Sync — Parallel Execution Plan

## Epic: KSA-171 — Code Intelligence v2 — Feature Parity Sync (Kotlin + Python)

**Created:** 2026-05-25
**Source Epic:** KSA-144 (mcp-code-intelligence-nodejs v2)
**Previous Parity Epic:** KSA-142 (old features)

---

## Ticket Map

### Kotlin Track

| Batch | Ticket | Summary | Labels | Depends On |
|-------|--------|---------|--------|------------|
| K1 | KSA-172 | [Kotlin] Tree-sitter Core + Parsers | kotlin, K1 | KSA-144 Batch 1 |
| K2 | KSA-173 | [Kotlin] Graph Engine | kotlin, K2 | K1 (KSA-172), KSA-144 Batch 2 |
| K3 | KSA-174 | [Kotlin] AI Context Tools | kotlin, K3 | K2 (KSA-173), KSA-144 Batch 3 |
| K4 | KSA-175 | [Kotlin] Code Quality | kotlin, K4 | K2 (KSA-173), KSA-144 Batch 4 |
| K5 | KSA-176 | [Kotlin] Security Analysis | kotlin, K5 | K2 (KSA-173), KSA-144 Batch 5 |
| K6 | KSA-177 | [Kotlin] Similarity + Infrastructure | kotlin, K6 | K3+K4+K5, KSA-144 Batch 6 |

### Python Track

| Batch | Ticket | Summary | Labels | Depends On |
|-------|--------|---------|--------|------------|
| P1 | KSA-178 | [Python] Tree-sitter Core + Parsers | python, P1 | KSA-144 Batch 1 |
| P2 | KSA-179 | [Python] Graph Engine | python, P2 | P1 (KSA-178), KSA-144 Batch 2 |
| P3 | KSA-180 | [Python] AI Context Tools | python, P3 | P2 (KSA-179), KSA-144 Batch 3 |
| P4 | KSA-181 | [Python] Code Quality | python, P4 | P2 (KSA-179), KSA-144 Batch 4 |
| P5 | KSA-182 | [Python] Security Analysis | python, P5 | P2 (KSA-179), KSA-144 Batch 5 |
| P6 | KSA-183 | [Python] Similarity + Infrastructure | python, P6 | P3+P4+P5, KSA-144 Batch 6 |

---

## Execution Strategy

```
                    KSA-144 (nodejs source)
                         |
            +------------+------------+
            |                         |
     Kotlin Track              Python Track
     (Session 1)              (Session 2)
            |                         |
    K1 (Parsers)              P1 (Parsers)
            |                         |
    K2 (Graph)                P2 (Graph)
            |                         |
    K3 (Context)              P3 (Context)
       |    |                    |    |
    K4 || K5 (parallel)      P4 || P5 (parallel)
       |    |                    |    |
    K6 (Final)                P6 (Final)
```

### Rules

1. **Kotlin and Python tracks run completely in parallel** — 2 independent sessions
2. **Within each track**: Sequential K1->K2->K3, then K4||K5 parallel, then K6
3. **Cross-dependency**: Each batch MUST wait for corresponding KSA-144 batch to complete
4. **No cross-track dependency**: Kotlin does NOT depend on Python and vice versa

---

## Prompts for Each Batch

### K1/P1: Tree-sitter Core + Parsers

```
Port tree-sitter parsers from mcp-code-intelligence-nodejs/src/parsers/ to {Kotlin|Python}.
Reference: KSA-144 Batch 1 implementation.
Target: mcp-code-intelligence-{kotlin|python}/src/parsers/
Must support: TypeScript, JavaScript, Python, Java, Kotlin, Go, Rust, C#, Ruby, PHP, Swift, Scala
Output must match nodejs AST structure exactly.
```

### K2/P2: Graph Engine

```
Port graph engine from mcp-code-intelligence-nodejs/src/graph/ to {Kotlin|Python}.
Features: call graph, dependency graph, impact analysis, traversal (BFS/DFS), cycle detection.
For Python: use NetworkX as graph library.
For Kotlin: use custom graph data structures (adjacency list).
```

### K3/P3: AI Context Tools

```
Port AI context tools from mcp-code-intelligence-nodejs/src/context/ to {Kotlin|Python}.
Tools: get_ai_context, get_edit_context, get_curated_context.
Must implement: context ranking, token budget management, file relevance scoring.
For Python: use tiktoken for token counting.
For Kotlin: use jtokkit for token counting.
```

### K4/P4: Code Quality

```
Port code quality tools from mcp-code-intelligence-nodejs/src/quality/ to {Kotlin|Python}.
Features: cyclomatic complexity, cognitive complexity, entry points, circular deps, code smells.
```

### K5/P5: Security Analysis

```
Port security analysis from mcp-code-intelligence-nodejs/src/security/ to {Kotlin|Python}.
Features: CFG/DFG construction, taint analysis, injection/SSRF/IDOR detection, misconfig detection.
```

### K6/P6: Similarity + Infrastructure

```
Port similarity tools from mcp-code-intelligence-nodejs/src/similarity/ to {Kotlin|Python}.
Features: duplicate detection, dead code detection, code embeddings, similarity scoring.
For Python: use sentence-transformers for embeddings.
For Kotlin: use ONNX Runtime for embedding inference.
```

---

## KSA-144 Batch Mapping (Source)

| KSA-144 Batch | Features | Status |
|---------------|----------|--------|
| Batch 1 | Foundation + Parsers | In Progress |
| Batch 2 | Graph Engine | Not Started |
| Batch 3 | AI Context | Not Started |
| Batch 4 | Code Quality | Not Started |
| Batch 5 | Security | Not Started |
| Batch 6 | Similarity | Not Started |

---

## How to Start

1. Wait for KSA-144 Batch 1 to complete
2. Start K1 (KSA-172) and P1 (KSA-178) in parallel
3. After K1 done -> start K2; After P1 done -> start P2
4. Continue cascading through the dependency chain
