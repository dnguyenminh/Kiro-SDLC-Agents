# Technical Design Document (TDD)

## Code Intelligence MCP Server — KSA-190: Auto-Linking Logic on KB Ingest

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-190 |
| Title | Auto-Linking Logic on KB Ingest |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-31 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-190.docx |
| Related BRD | BRD-v1-KSA-190.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-31 | SA Agent | Initial TDD — technical design from FSD |

---

## 1. Architecture Overview

### 1.1 Architecture Diagram

![Architecture](diagrams/auto-link-architecture.png)

### 1.2 Design Philosophy

The Auto-Linker follows the **Strategy Pattern** — each linking method (semantic, entity, tag, FTS) is an independent strategy that can be enabled/disabled and configured separately. The orchestrator (`AutoLinker`) runs strategies in sequence, collects candidates, deduplicates, and commits edges.

**Key design decisions:**
- **Fire-and-forget semantics** — auto-linking errors never propagate to the caller
- **Synchronous execution** — runs within the same transaction as ingest (< 500ms target)
- **Brute-force vector search** — acceptable for < 50K entries; no external vector DB needed
- **Strategy independence** — each strategy can fail without affecting others

### 1.3 Component Diagram

![Component](diagrams/component-autolinker.png)

---

## 2. Module Design

### 2.1 New Files

| File | Class/Module | Responsibility |
|------|-------------|----------------|
| `src/memory/auto-linker.ts` | `AutoLinker` | Orchestrates all linking strategies, dedup, commit |
| `src/memory/auto-link-config.ts` | `AutoLinkConfig`, `defaultAutoLinkConfig()` | Configuration interface and defaults |
| `src/memory/linking-strategies/semantic-strategy.ts` | `SemanticStrategy` | Vector cosine similarity linking |
| `src/memory/linking-strategies/entity-strategy.ts` | `EntityStrategy` | Shared entity Jaccard linking |
| `src/memory/linking-strategies/tag-strategy.ts` | `TagStrategy` | Shared tag overlap linking |
| `src/memory/linking-strategies/fts-strategy.ts` | `FtsStrategy` | Full-text search fallback linking |
| `src/memory/linking-strategies/types.ts` | `LinkingStrategy`, `CandidateEdge` | Shared interfaces |

### 2.2 Modified Files

| File | Change |
|------|--------|
| `src/memory/ingest-pipeline.ts` | Add `setAutoLinker()`, call `tryAutoLink()` after `tryExtractMap()` |
| `src/memory/graph-repo.ts` | Add `edgeExists()` method for dedup check |
| `src/memory/vector-repo.ts` | Add `getVector(entryId)` method |
| `src/tools/mem-graph-tool.ts` | Add `auto_link` action handler |
| `src/memory/memory-engine.ts` | Wire AutoLinker with dependencies, inject into pipeline |

---

## 3. Class Design

### 3.1 AutoLinker (Orchestrator)

```typescript
import { GraphRepository } from './graph-repo.js';
import { AutoLinkConfig, defaultAutoLinkConfig } from './auto-link-config.js';
import { LinkingStrategy, CandidateEdge, AutoLinkResult } from './linking-strategies/types.js';

export class AutoLinker {
  private readonly strategies: LinkingStrategy[];
  private readonly graphRepo: GraphRepository;
  private readonly config: AutoLinkConfig;

  constructor(
    graphRepo: GraphRepository,
    strategies: LinkingStrategy[],
    config?: Partial<AutoLinkConfig>
  ) {
    this.graphRepo = graphRepo;
    this.strategies = strategies;
    this.config = { ...defaultAutoLinkConfig(), ...config };
  }

  /** Link a single entry to related entries. Fire-and-forget safe. */
  link(entryId: number): AutoLinkResult {
    if (!this.config.enabled) {
      return { entryId, edgesCreated: 0, breakdown: { semantic: 0, entity: 0, tag: 0, fts: 0 }, skipped: 0, timeMs: 0 };
    }

    const start = Date.now();
    const allCandidates: CandidateEdge[] = [];

    for (const strategy of this.strategies) {
      if (!strategy.isEnabled(this.config)) continue;
      try {
        const candidates = strategy.findCandidates(entryId, this.config);
        allCandidates.push(...candidates);
      } catch (err) {
        process.stderr.write(`[auto-link] Strategy ${strategy.name} failed for #${entryId}: ${err}\n`);
      }

      // FTS fallback check: only run if < threshold edges from prior strategies
      if (strategy.name === 'fts' && allCandidates.length >= this.config.fts.fallbackThreshold) {
        break;
      }
    }

    // Dedup and cap
    const deduped = this.dedup(entryId, allCandidates);
    const capped = deduped.slice(0, this.config.totalMaxEdges);

    // Commit edges
    let created = 0, skipped = 0;
    for (const edge of capped) {
      if (this.graphRepo.edgeExists(edge.targetId, entryId, edge.relation)) {
        skipped++;
      } else {
        this.graphRepo.addEdge({
          source_id: entryId,
          target_id: edge.targetId,
          relation: edge.relation,
          weight: edge.score,
          metadata: JSON.stringify(edge.metadata)
        });
        created++;
      }
    }

    const timeMs = Date.now() - start;
    process.stderr.write(`[auto-link] Entry #${entryId}: ${created} edges created (${timeMs}ms)\n`);

    return {
      entryId,
      edgesCreated: created,
      breakdown: this.countByType(capped),
      skipped,
      timeMs
    };
  }

  /** Batch backfill: link orphan entries (no edges). */
  backfill(entryId?: number, limit = 50): string {
    if (entryId) {
      const result = this.link(entryId);
      return `Auto-linked entry #${entryId}: ${result.edgesCreated} edges created. Time: ${result.timeMs}ms`;
    }
    // Find orphans
    const orphans = this.graphRepo.findOrphans(limit);
    let totalEdges = 0;
    for (const id of orphans) {
      const result = this.link(id);
      totalEdges += result.edgesCreated;
    }
    return `Backfill: processed ${orphans.length} entries, created ${totalEdges} edges`;
  }

  private dedup(sourceId: number, candidates: CandidateEdge[]): CandidateEdge[] {
    // Remove self-links
    const filtered = candidates.filter(c => c.targetId !== sourceId);
    // Sort by score descending
    filtered.sort((a, b) => b.score - a.score);
    // Remove duplicates (same target + relation)
    const seen = new Set<string>();
    return filtered.filter(c => {
      const key = `${c.targetId}:${c.relation}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private countByType(edges: CandidateEdge[]): Record<string, number> {
    const counts = { semantic: 0, entity: 0, tag: 0, fts: 0 };
    for (const e of edges) {
      if (e.relation === 'SIMILAR_TO') counts.semantic++;
      else if (e.relation === 'SHARES_ENTITY') counts.entity++;
      else if (e.relation === 'SHARES_TAG') counts.tag++;
      else if (e.relation === 'TOPIC_OVERLAP') counts.fts++;
    }
    return counts;
  }
}
```

### 3.2 LinkingStrategy Interface

```typescript
// src/memory/linking-strategies/types.ts

export interface CandidateEdge {
  targetId: number;
  relation: string;       // SIMILAR_TO | SHARES_ENTITY | SHARES_TAG | TOPIC_OVERLAP
  score: number;          // 0.0 - 1.0
  metadata: Record<string, unknown>;
}

export interface AutoLinkResult {
  entryId: number;
  edgesCreated: number;
  breakdown: { semantic: number; entity: number; tag: number; fts: number };
  skipped: number;
  timeMs: number;
}

export interface LinkingStrategy {
  readonly name: string;  // 'semantic' | 'entity' | 'tag' | 'fts'
  isEnabled(config: AutoLinkConfig): boolean;
  findCandidates(entryId: number, config: AutoLinkConfig): CandidateEdge[];
}
```

### 3.3 SemanticStrategy

```typescript
// src/memory/linking-strategies/semantic-strategy.ts

import { VectorRepository } from '../vector-repo.js';
import { LinkingStrategy, CandidateEdge } from './types.js';
import { AutoLinkConfig } from '../auto-link-config.js';

export class SemanticStrategy implements LinkingStrategy {
  readonly name = 'semantic';
  private readonly vectorRepo: VectorRepository;

  constructor(vectorRepo: VectorRepository) {
    this.vectorRepo = vectorRepo;
  }

  isEnabled(config: AutoLinkConfig): boolean {
    return config.semantic.enabled;
  }

  findCandidates(entryId: number, config: AutoLinkConfig): CandidateEdge[] {
    const myVector = this.vectorRepo.getVector(entryId);
    if (!myVector) return [];

    const allVectors = this.vectorRepo.findAll();
    const candidates: CandidateEdge[] = [];

    for (const record of allVectors) {
      if (record.entry_id === entryId) continue;
      const score = this.cosineSimilarity(myVector, this.bufferToFloat32(record.vector));
      if (score >= config.semantic.minScore) {
        candidates.push({
          targetId: record.entry_id,
          relation: 'SIMILAR_TO',
          score,
          metadata: { method: 'cosine', model: record.model }
        });
      }
    }

    // Sort desc, take top N
    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, config.semantic.maxEdges);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  private bufferToFloat32(buf: Buffer): number[] {
    const floats: number[] = [];
    for (let i = 0; i < buf.length; i += 4) {
      floats.push(buf.readFloatLE(i));
    }
    return floats;
  }
}
```

### 3.4 EntityStrategy

```typescript
// src/memory/linking-strategies/entity-strategy.ts

import { EntityRepository } from '../entity-repo.js';
import { LinkingStrategy, CandidateEdge } from './types.js';
import { AutoLinkConfig } from '../auto-link-config.js';

export class EntityStrategy implements LinkingStrategy {
  readonly name = 'entity';
  private readonly entityRepo: EntityRepository;

  constructor(entityRepo: EntityRepository) {
    this.entityRepo = entityRepo;
  }

  isEnabled(config: AutoLinkConfig): boolean {
    return config.entity.enabled;
  }

  findCandidates(entryId: number, config: AutoLinkConfig): CandidateEdge[] {
    const myEntities = this.entityRepo.getEntities(entryId);
    if (myEntities.length === 0) return [];

    const myEntityNames = new Set(myEntities.map(e => e.entity_name));
    const candidateMap = new Map<number, Set<string>>();

    // Find all entries sharing at least one entity
    for (const entity of myEntities) {
      const otherIds = this.entityRepo.findByEntity(entity.entity_name);
      for (const otherId of otherIds) {
        if (otherId === entryId) continue;
        if (!candidateMap.has(otherId)) candidateMap.set(otherId, new Set());
        candidateMap.get(otherId)!.add(entity.entity_name);
      }
    }

    // Compute Jaccard and filter
    const candidates: CandidateEdge[] = [];
    for (const [otherId, sharedNames] of candidateMap) {
      const otherEntities = this.entityRepo.getEntities(otherId);
      const otherNames = new Set(otherEntities.map(e => e.entity_name));
      const union = new Set([...myEntityNames, ...otherNames]);
      const jaccard = sharedNames.size / union.size;

      if (jaccard >= config.entity.minJaccard) {
        candidates.push({
          targetId: otherId,
          relation: 'SHARES_ENTITY',
          score: jaccard,
          metadata: { shared: [...sharedNames], jaccard }
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, config.entity.maxEdges);
  }
}
```

### 3.5 TagStrategy

```typescript
// src/memory/linking-strategies/tag-strategy.ts

import Database from 'better-sqlite3';
import { LinkingStrategy, CandidateEdge } from './types.js';
import { AutoLinkConfig } from '../auto-link-config.js';

export class TagStrategy implements LinkingStrategy {
  readonly name = 'tag';
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  isEnabled(config: AutoLinkConfig): boolean {
    return config.tag.enabled;
  }

  findCandidates(entryId: number, config: AutoLinkConfig): CandidateEdge[] {
    // Get tags for this entry
    const entry = this.db.prepare(
      'SELECT tags FROM knowledge_entries WHERE id = ?'
    ).get(entryId) as { tags: string } | undefined;
    if (!entry || !entry.tags) return [];

    const myTags = entry.tags.split(',').map(t => t.trim()).filter(Boolean);
    if (myTags.length < config.tag.minOverlap) return [];

    // Find entries with overlapping tags
    const conditions = myTags.map(() => 'tags LIKE ?').join(' OR ');
    const params = myTags.map(t => `%${t}%`);
    const rows = this.db.prepare(
      `SELECT id, tags FROM knowledge_entries WHERE id != ? AND archived_at IS NULL AND (${conditions})`
    ).all(entryId, ...params) as Array<{ id: number; tags: string }>;

    const candidates: CandidateEdge[] = [];
    for (const row of rows) {
      const otherTags = row.tags.split(',').map(t => t.trim()).filter(Boolean);
      const shared = myTags.filter(t => otherTags.includes(t));
      if (shared.length >= config.tag.minOverlap) {
        const union = new Set([...myTags, ...otherTags]);
        const jaccard = shared.length / union.size;
        candidates.push({
          targetId: row.id,
          relation: 'SHARES_TAG',
          score: jaccard,
          metadata: { shared_tags: shared, overlap_count: shared.length }
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, config.tag.maxEdges);
  }
}
```

### 3.6 FtsStrategy

```typescript
// src/memory/linking-strategies/fts-strategy.ts

import Database from 'better-sqlite3';
import { LinkingStrategy, CandidateEdge } from './types.js';
import { AutoLinkConfig } from '../auto-link-config.js';

export class FtsStrategy implements LinkingStrategy {
  readonly name = 'fts';
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  isEnabled(config: AutoLinkConfig): boolean {
    return config.fts.enabled;
  }

  findCandidates(entryId: number, config: AutoLinkConfig): CandidateEdge[] {
    // Get entry summary for keyword extraction
    const entry = this.db.prepare(
      'SELECT summary FROM knowledge_entries WHERE id = ?'
    ).get(entryId) as { summary: string } | undefined;
    if (!entry || !entry.summary) return [];

    // Extract significant words (> 3 chars, not common stopwords)
    const stopwords = new Set(['this', 'that', 'with', 'from', 'have', 'been', 'will', 'would', 'could', 'should', 'their', 'there', 'where', 'when', 'what', 'which', 'about', 'into', 'more', 'some', 'than', 'them', 'then', 'these', 'they', 'were', 'your']);
    const words = entry.summary
      .split(/\s+/)
      .map(w => w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())
      .filter(w => w.length > 3 && !stopwords.has(w))
      .slice(0, 5);

    if (words.length === 0) return [];

    const query = words.join(' OR ');
    try {
      const rows = this.db.prepare(
        `SELECT ke.id, rank FROM knowledge_fts JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id WHERE knowledge_fts MATCH ? AND ke.id != ? AND ke.archived_at IS NULL ORDER BY rank LIMIT 10`
      ).all(query, entryId) as Array<{ id: number; rank: number }>;

      const candidates: CandidateEdge[] = [];
      const maxRank = Math.abs(rows[0]?.rank ?? 1);

      for (const row of rows) {
        const normalizedScore = Math.min(1.0, Math.abs(row.rank) / maxRank);
        candidates.push({
          targetId: row.id,
          relation: 'TOPIC_OVERLAP',
          score: normalizedScore,
          metadata: { query_words: words, fts_rank: row.rank }
        });
      }

      return candidates.slice(0, config.fts.maxEdges);
    } catch {
      return []; // FTS may fail on malformed queries
    }
  }
}
```

### 3.7 AutoLinkConfig

```typescript
// src/memory/auto-link-config.ts

export interface AutoLinkConfig {
  enabled: boolean;
  semantic: { enabled: boolean; minScore: number; maxEdges: number };
  entity: { enabled: boolean; minJaccard: number; maxEdges: number };
  tag: { enabled: boolean; minOverlap: number; maxEdges: number };
  fts: { enabled: boolean; maxEdges: number; fallbackThreshold: number };
  totalMaxEdges: number;
}

export function defaultAutoLinkConfig(): AutoLinkConfig {
  return {
    enabled: true,
    semantic: { enabled: true, minScore: 0.75, maxEdges: 5 },
    entity: { enabled: true, minJaccard: 0.3, maxEdges: 5 },
    tag: { enabled: true, minOverlap: 2, maxEdges: 3 },
    fts: { enabled: true, maxEdges: 3, fallbackThreshold: 2 },
    totalMaxEdges: 10
  };
}
```

---

## 4. API Design

### 4.1 IngestPipeline Changes

```typescript
// Addition to ingest-pipeline.ts

private autoLinker: AutoLinker | null = null;

setAutoLinker(linker: AutoLinker): void {
  this.autoLinker = linker;
}

private tryAutoLink(entryId: number): AutoLinkResult | null {
  if (!this.autoLinker) return null;
  try {
    return this.autoLinker.link(entryId);
  } catch (err) {
    process.stderr.write(`[ingest] Auto-link failed for entry ${entryId}: ${err}\n`);
    return null;
  }
}
```

### 4.2 GraphRepository Changes

```typescript
// Addition to graph-repo.ts

/** Check if edge exists (direction-agnostic). */
edgeExists(sourceId: number, targetId: number, relation: string): boolean {
  const row = this.db.prepare(`
    SELECT 1 FROM knowledge_graph_edges
    WHERE ((source_id = ? AND target_id = ?) OR (source_id = ? AND target_id = ?))
    AND relation = ?
    LIMIT 1
  `).get(sourceId, targetId, targetId, sourceId, relation);
  return row !== undefined;
}

/** Find entries with 0 edges (orphans). */
findOrphans(limit = 50): number[] {
  const rows = this.db.prepare(`
    SELECT ke.id FROM knowledge_entries ke
    WHERE ke.archived_at IS NULL
    AND ke.id NOT IN (
      SELECT source_id FROM knowledge_graph_edges
      UNION
      SELECT target_id FROM knowledge_graph_edges
    )
    LIMIT ?
  `).all(limit) as Array<{ id: number }>;
  return rows.map(r => r.id);
}
```

### 4.3 VectorRepository Changes

```typescript
// Addition to vector-repo.ts

/** Get vector for a specific entry (as float32 array). */
getVector(entryId: number): number[] | null {
  const row = this.db.prepare(
    'SELECT vector, dimensions FROM knowledge_vectors WHERE entry_id = ?'
  ).get(entryId) as { vector: Buffer; dimensions: number } | undefined;
  if (!row) return null;
  const floats: number[] = [];
  for (let i = 0; i < row.vector.length; i += 4) {
    floats.push(row.vector.readFloatLE(i));
  }
  return floats;
}
```

---

## 5. Error Handling

| Scenario | Handling | Recovery |
|----------|----------|----------|
| EmbeddingService unavailable | SemanticStrategy returns [] | Other strategies still run |
| EntityRepository query fails | EntityStrategy catches, returns [] | Other strategies still run |
| FTS5 MATCH syntax error | FtsStrategy catches, returns [] | Other strategies still run |
| GraphRepo.addEdge fails | Logged to stderr, edge skipped | Other edges still committed |
| All strategies fail | AutoLinker returns result with 0 edges | Ingest succeeds normally |
| DB locked (concurrent access) | SQLite retry (busy_timeout) | Standard SQLite handling |

---

## 6. Security Design

| Concern | Mitigation |
|---------|-----------|
| SQL injection in FTS query | Words are sanitized (alphanumeric only) before MATCH |
| Excessive edge creation (DoS) | totalMaxEdges cap (default: 10) per ingest |
| Memory exhaustion (large vector scan) | findAll() limited by DB size; acceptable for < 50K |
| Unauthorized edge creation | Auto-linker uses same DB connection as ingest (same auth context) |

---

## 7. Performance Design

### 7.1 Bottleneck Analysis

| Operation | Complexity | Mitigation |
|-----------|-----------|------------|
| Vector cosine scan (all entries) | O(N * D) where N=entries, D=dimensions | Acceptable for N < 50K, D=384 |
| Entity lookup per entity | O(log N) via index | Already indexed |
| Tag LIKE query | O(N) scan | Acceptable; could add tag_entries junction table later |
| FTS MATCH | O(log N) via FTS5 index | Already optimized |
| Edge dedup check | O(1) per check (indexed) | Composite index on (source_id, target_id, relation) |

### 7.2 Optimization Opportunities (Future)

- **Vector index** (HNSW or IVF) for O(log N) approximate nearest neighbor
- **Tag junction table** for O(1) tag overlap queries
- **Async auto-linking** for entries where embedding is generated asynchronously
- **Incremental vector scan** — only compare against entries ingested since last link

---

## 8. Implementation Checklist

| # | Task | File | Priority | Estimated Effort |
|---|------|------|----------|-----------------|
| 1 | Create `auto-link-config.ts` | src/memory/auto-link-config.ts | P0 | 0.5h |
| 2 | Create `linking-strategies/types.ts` | src/memory/linking-strategies/types.ts | P0 | 0.5h |
| 3 | Implement `SemanticStrategy` | src/memory/linking-strategies/semantic-strategy.ts | P0 | 2h |
| 4 | Implement `EntityStrategy` | src/memory/linking-strategies/entity-strategy.ts | P0 | 1.5h |
| 5 | Implement `TagStrategy` | src/memory/linking-strategies/tag-strategy.ts | P1 | 1h |
| 6 | Implement `FtsStrategy` | src/memory/linking-strategies/fts-strategy.ts | P1 | 1h |
| 7 | Implement `AutoLinker` orchestrator | src/memory/auto-linker.ts | P0 | 2h |
| 8 | Add `edgeExists()` to GraphRepository | src/memory/graph-repo.ts | P0 | 0.5h |
| 9 | Add `getVector()` to VectorRepository | src/memory/vector-repo.ts | P0 | 0.5h |
| 10 | Add `findOrphans()` to GraphRepository | src/memory/graph-repo.ts | P1 | 0.5h |
| 11 | Integrate into IngestPipeline | src/memory/ingest-pipeline.ts | P0 | 1h |
| 12 | Wire in MemoryEngine | src/memory/memory-engine.ts | P0 | 1h |
| 13 | Add `auto_link` action to mem_graph tool | src/tools/mem-graph-tool.ts | P1 | 1h |
| 14 | Unit tests for each strategy | tests/memory/linking-strategies/ | P0 | 3h |
| 15 | Integration test for full pipeline | tests/memory/auto-linker.test.ts | P0 | 2h |
| 16 | Update mem_ingest response format | src/tools/mem-ingest-tool.ts | P2 | 0.5h |

**Total estimated effort:** ~18h

---

## 9. Testing Strategy

### 9.1 Unit Tests

| Test | What it verifies |
|------|-----------------|
| SemanticStrategy with mock vectors | Correct cosine calculation, threshold filtering |
| EntityStrategy with mock entities | Correct Jaccard calculation, shared entity detection |
| TagStrategy with mock DB | Correct tag overlap counting, minimum overlap enforcement |
| FtsStrategy with mock DB | Correct word extraction, FTS query construction |
| AutoLinker with mock strategies | Correct orchestration, dedup, cap enforcement |
| AutoLinker with disabled config | Returns 0 edges when disabled |
| AutoLinker error isolation | Strategy failure doesn't propagate |

### 9.2 Integration Tests

| Test | What it verifies |
|------|-----------------|
| Full ingest with auto-linking | End-to-end: ingest entry, verify edges created |
| Backfill orphan entries | Batch mode processes correct entries |
| Dedup on repeated ingest | No duplicate edges on second ingest |
| Config changes at runtime | New thresholds apply to next ingest |

---

## 10. Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Auto-Link Architecture | [auto-link-architecture.png](diagrams/auto-link-architecture.png) | [auto-link-architecture.drawio](diagrams/auto-link-architecture.drawio) |
| 2 | Component Diagram | [component-autolinker.png](diagrams/component-autolinker.png) | [component-autolinker.drawio](diagrams/component-autolinker.drawio) |
