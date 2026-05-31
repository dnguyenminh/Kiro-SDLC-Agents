/**
 * KSA-190: Auto-Linking Logic on KB Ingest — Full Test Suite.
 * Covers PBT, UT, and IT test cases from STC.md.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { AutoLinker } from '../auto-linker.js';
import { AutoLinkConfig, defaultAutoLinkConfig } from '../auto-link-config.js';
import { SemanticStrategy } from '../linking-strategies/semantic-strategy.js';
import { EntityStrategy } from '../linking-strategies/entity-strategy.js';
import { TagStrategy } from '../linking-strategies/tag-strategy.js';
import { FtsStrategy } from '../linking-strategies/fts-strategy.js';
import { GraphRepository } from '../graph-repo.js';
import { VectorRepository } from '../vector-repo.js';
import { EntityRepository } from '../entity-repo.js';
import type { LinkingStrategy, CandidateEdge } from '../linking-strategies/types.js';

// Helper: cosine similarity (mirrors SemanticStrategy private method)
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// Helper: Jaccard coefficient (mirrors EntityStrategy logic)
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  const intersection = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}


// ============================================================
// SECTION 1: Property-Based Tests (PBT)
// ============================================================

describe('PBT-01: Cosine Similarity Properties', () => {
  const nonZeroVector = (dim: number) =>
    fc.array(fc.float({ min: -100, max: 100, noNaN: true }), {
      minLength: dim, maxLength: dim,
    }).filter(v => v.some(x => x !== 0));

  const positiveVector = (dim: number) =>
    fc.array(fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }), {
      minLength: dim, maxLength: dim,
    });

  // STC: PBT-01a — cosineSimilarity(v, v) === 1.0
  it('PBT-01a: self-similarity equals 1.0', () => {
    fc.assert(
      fc.property(nonZeroVector(8), (v) => {
        const sim = cosineSimilarity(v, v);
        expect(sim).toBeCloseTo(1.0, 5);
      }),
      { numRuns: 200 }
    );
  });

  // STC: PBT-01b — cosineSimilarity(v, -v) === -1.0
  it('PBT-01b: opposite vector similarity equals -1.0', () => {
    fc.assert(
      fc.property(nonZeroVector(8), (v) => {
        const neg = v.map(x => -x);
        const sim = cosineSimilarity(v, neg);
        expect(sim).toBeCloseTo(-1.0, 5);
      }),
      { numRuns: 200 }
    );
  });

  // STC: PBT-01c — 0 <= cosineSimilarity(v, w) <= 1.0 for non-negative vectors
  it('PBT-01c: bounded [0,1] for non-negative vectors', () => {
    fc.assert(
      fc.property(positiveVector(8), positiveVector(8), (v, w) => {
        const sim = cosineSimilarity(v, w);
        expect(sim).toBeGreaterThanOrEqual(-1e-7);
        expect(sim).toBeLessThanOrEqual(1.0 + 1e-7);
      }),
      { numRuns: 200 }
    );
  });

  // STC: PBT-01d — cosineSimilarity is symmetric
  it('PBT-01d: symmetric sim(a,b) === sim(b,a)', () => {
    fc.assert(
      fc.property(nonZeroVector(8), nonZeroVector(8), (a, b) => {
        const ab = cosineSimilarity(a, b);
        const ba = cosineSimilarity(b, a);
        expect(ab).toBeCloseTo(ba, 10);
      }),
      { numRuns: 200 }
    );
  });
});


describe('PBT-02: Jaccard Coefficient Properties', () => {
  const nonEmptyStringSet = fc.uniqueArray(
    fc.string({ minLength: 1, maxLength: 10 }),
    { minLength: 1, maxLength: 10 }
  ).map(arr => new Set(arr));

  const stringSet = fc.uniqueArray(
    fc.string({ minLength: 1, maxLength: 10 }),
    { minLength: 0, maxLength: 10 }
  ).map(arr => new Set(arr));

  // STC: PBT-02a — jaccard(A, A) === 1.0
  it('PBT-02a: self-jaccard equals 1.0', () => {
    fc.assert(
      fc.property(nonEmptyStringSet, (a) => {
        expect(jaccard(a, a)).toBeCloseTo(1.0, 10);
      }),
      { numRuns: 200 }
    );
  });

  // STC: PBT-02b — jaccard(A, empty) === 0.0
  it('PBT-02b: jaccard with empty set equals 0.0', () => {
    fc.assert(
      fc.property(nonEmptyStringSet, (a) => {
        expect(jaccard(a, new Set())).toBe(0);
      }),
      { numRuns: 200 }
    );
  });

  // STC: PBT-02c — 0 <= jaccard(A, B) <= 1.0
  it('PBT-02c: bounded [0,1]', () => {
    fc.assert(
      fc.property(stringSet, stringSet, (a, b) => {
        const j = jaccard(a, b);
        expect(j).toBeGreaterThanOrEqual(0);
        expect(j).toBeLessThanOrEqual(1.0);
      }),
      { numRuns: 200 }
    );
  });

  // STC: PBT-02d — jaccard is symmetric
  it('PBT-02d: symmetric jaccard(A,B) === jaccard(B,A)', () => {
    fc.assert(
      fc.property(stringSet, stringSet, (a, b) => {
        expect(jaccard(a, b)).toBeCloseTo(jaccard(b, a), 10);
      }),
      { numRuns: 200 }
    );
  });
});


// ============================================================
// SECTION 2: Unit Tests (UT) — Strategy Tests
// ============================================================

describe('UT: SemanticStrategy', () => {
  function createMockVectorRepo(vectors: Map<number, number[]>) {
    return {
      getVector(entryId: number) { return vectors.get(entryId) ?? null; },
      findAll() {
        return [...vectors.entries()].map(([entry_id, vec]) => ({
          id: entry_id,
          entry_id,
          vector: float32ToBuffer(vec),
          model: 'test-model',
          dimensions: vec.length,
          created_at: '2024-01-01',
        }));
      },
    } as unknown as VectorRepository;
  }

  function float32ToBuffer(arr: number[]): Buffer {
    const buf = Buffer.alloc(arr.length * 4);
    for (let i = 0; i < arr.length; i++) buf.writeFloatLE(arr[i], i * 4);
    return buf;
  }

  // STC: UT-01 — Returns candidates above threshold
  it('UT-01: returns candidates above threshold, excludes below', () => {
    const vectors = new Map<number, number[]>();
    vectors.set(1, [1, 0, 0, 0]);
    vectors.set(2, [0.95, 0.05, 0, 0]); // very similar
    vectors.set(3, [0.8, 0.1, 0.1, 0]);  // similar
    vectors.set(4, [0.5, 0.5, 0.5, 0.5]); // low similarity

    const strategy = new SemanticStrategy(createMockVectorRepo(vectors));
    const config = defaultAutoLinkConfig();
    config.semantic.minScore = 0.75;

    const candidates = strategy.findCandidates(1, config);
    expect(candidates.length).toBe(2);
    expect(candidates.every(c => c.score >= 0.75)).toBe(true);
    expect(candidates.every(c => c.relation === 'SIMILAR_TO')).toBe(true);
  });

  // STC: UT-02 — Returns empty when no vector exists
  it('UT-02: returns empty when entry has no vector', () => {
    const vectors = new Map<number, number[]>();
    vectors.set(2, [1, 0, 0, 0]);
    // Entry 1 has no vector
    const strategy = new SemanticStrategy(createMockVectorRepo(vectors));
    const config = defaultAutoLinkConfig();
    const candidates = strategy.findCandidates(1, config);
    expect(candidates).toEqual([]);
  });

  // STC: UT-03 — Respects maxEdges limit
  it('UT-03: respects maxEdges limit', () => {
    const vectors = new Map<number, number[]>();
    vectors.set(1, [1, 0, 0, 0]);
    // Create 10 very similar vectors
    for (let i = 2; i <= 11; i++) {
      vectors.set(i, [1 - (i * 0.001), i * 0.001, 0, 0]);
    }
    const strategy = new SemanticStrategy(createMockVectorRepo(vectors));
    const config = defaultAutoLinkConfig();
    config.semantic.minScore = 0.5;
    config.semantic.maxEdges = 5;

    const candidates = strategy.findCandidates(1, config);
    expect(candidates.length).toBeLessThanOrEqual(5);
  });
});


describe('UT: EntityStrategy', () => {
  function createMockEntityRepo(data: Map<number, string[]>) {
    return {
      getEntities(entryId: number) {
        const names = data.get(entryId) ?? [];
        return names.map((name, i) => ({
          id: i, entry_id: entryId, entity_name: name, entity_type: 'CLASS',
        }));
      },
      findByEntity(entityName: string) {
        const ids: number[] = [];
        for (const [id, names] of data) {
          if (names.some(n => n.includes(entityName))) ids.push(id);
        }
        return ids;
      },
    } as unknown as EntityRepository;
  }

  // STC: UT-04 — Detects shared entities with Jaccard >= 0.3
  it('UT-04: detects shared entities with Jaccard >= 0.3', () => {
    const data = new Map<number, string[]>();
    data.set(1, ['A', 'B', 'C']);
    data.set(2, ['B', 'C', 'D']); // Jaccard = 2/4 = 0.5

    const strategy = new EntityStrategy(createMockEntityRepo(data));
    const config = defaultAutoLinkConfig();
    config.entity.minJaccard = 0.3;

    const candidates = strategy.findCandidates(1, config);
    expect(candidates.length).toBe(1);
    expect(candidates[0].targetId).toBe(2);
    expect(candidates[0].score).toBeCloseTo(0.5, 2);
    expect(candidates[0].relation).toBe('SHARES_ENTITY');
  });

  // STC: UT-05 — Excludes low Jaccard
  it('UT-05: excludes entries with Jaccard below threshold', () => {
    const data = new Map<number, string[]>();
    data.set(1, ['A', 'B', 'C', 'D', 'E']);
    data.set(2, ['E']); // Jaccard = 1/5 = 0.2

    const strategy = new EntityStrategy(createMockEntityRepo(data));
    const config = defaultAutoLinkConfig();
    config.entity.minJaccard = 0.3;

    const candidates = strategy.findCandidates(1, config);
    expect(candidates).toEqual([]);
  });

  // STC: UT-06 — Returns empty when entry has no entities
  it('UT-06: returns empty when entry has no entities', () => {
    const data = new Map<number, string[]>();
    data.set(1, []);
    data.set(2, ['A', 'B']);

    const strategy = new EntityStrategy(createMockEntityRepo(data));
    const config = defaultAutoLinkConfig();
    const candidates = strategy.findCandidates(1, config);
    expect(candidates).toEqual([]);
  });
});


describe('UT: TagStrategy', () => {
  function createTagDb(entries: Array<{ id: number; tags: string }>) {
    const db = new Database(':memory:');
    db.exec(`CREATE TABLE knowledge_entries (
      id INTEGER PRIMARY KEY, tags TEXT, archived INTEGER NOT NULL DEFAULT 0
    )`);
    const stmt = db.prepare('INSERT INTO knowledge_entries (id, tags) VALUES (?, ?)');
    for (const e of entries) stmt.run(e.id, e.tags);
    return db;
  }

  // STC: UT-07 — Detects >= 2 shared tags
  it('UT-07: detects entries with >= 2 shared tags', () => {
    const db = createTagDb([
      { id: 1, tags: 'a,b,c' },
      { id: 2, tags: 'b,c,d' },
    ]);
    const strategy = new TagStrategy(db);
    const config = defaultAutoLinkConfig();
    config.tag.minOverlap = 2;

    const candidates = strategy.findCandidates(1, config);
    expect(candidates.length).toBe(1);
    expect(candidates[0].targetId).toBe(2);
    expect(candidates[0].relation).toBe('SHARES_TAG');
    expect((candidates[0].metadata as any).overlap_count).toBe(2);
    db.close();
  });

  // STC: UT-08 — Excludes single tag overlap
  it('UT-08: excludes entries with only 1 shared tag', () => {
    const db = createTagDb([
      { id: 1, tags: 'a,b' },
      { id: 2, tags: 'b,x' },
    ]);
    const strategy = new TagStrategy(db);
    const config = defaultAutoLinkConfig();
    config.tag.minOverlap = 2;

    const candidates = strategy.findCandidates(1, config);
    expect(candidates).toEqual([]);
    db.close();
  });

  // STC: UT-09 — Handles empty tags gracefully
  it('UT-09: handles empty tags gracefully', () => {
    const db = createTagDb([
      { id: 1, tags: '' },
      { id: 2, tags: 'a,b,c' },
    ]);
    const strategy = new TagStrategy(db);
    const config = defaultAutoLinkConfig();

    const candidates = strategy.findCandidates(1, config);
    expect(candidates).toEqual([]);
    db.close();
  });
});


describe('UT: FtsStrategy', () => {
  function createFtsDb(entries: Array<{ id: number; summary: string }>) {
    const db = new Database(':memory:');
    db.exec(`CREATE TABLE knowledge_entries (
      id INTEGER PRIMARY KEY, summary TEXT, archived INTEGER NOT NULL DEFAULT 0
    )`);
    db.exec(`CREATE VIRTUAL TABLE knowledge_fts USING fts5(summary, content=knowledge_entries, content_rowid=id)`);
    const stmt = db.prepare('INSERT INTO knowledge_entries (id, summary) VALUES (?, ?)');
    const ftsStmt = db.prepare('INSERT INTO knowledge_fts (rowid, summary) VALUES (?, ?)');
    for (const e of entries) {
      stmt.run(e.id, e.summary);
      ftsStmt.run(e.id, e.summary);
    }
    return db;
  }

  // STC: UT-10 — Extracts significant words and finds matches
  it('UT-10: extracts significant words and finds FTS matches', () => {
    const db = createFtsDb([
      { id: 1, summary: 'AutoLinker orchestrates linking strategies for knowledge entries' },
      { id: 2, summary: 'The linking strategies include semantic and entity approaches' },
      { id: 3, summary: 'Completely unrelated content about cooking recipes' },
    ]);
    const strategy = new FtsStrategy(db);
    const config = defaultAutoLinkConfig();

    const candidates = strategy.findCandidates(1, config);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every(c => c.relation === 'TOPIC_OVERLAP')).toBe(true);
    expect(candidates.every(c => c.score >= 0 && c.score <= 1)).toBe(true);
    db.close();
  });

  // STC: UT-11 — Returns empty on short summary
  it('UT-11: returns empty on short summary', () => {
    const db = createFtsDb([
      { id: 1, summary: 'hi' },
      { id: 2, summary: 'Some longer content about architecture design patterns' },
    ]);
    const strategy = new FtsStrategy(db);
    const config = defaultAutoLinkConfig();

    const candidates = strategy.findCandidates(1, config);
    expect(candidates).toEqual([]);
    db.close();
  });
});


// ============================================================
// SECTION 3: Unit Tests (UT) — AutoLinker Orchestrator
// ============================================================

describe('UT: AutoLinker Orchestrator', () => {
  function createMockStrategy(
    name: string,
    candidates: CandidateEdge[],
    enabled = true
  ): LinkingStrategy {
    return {
      name,
      isEnabled: () => enabled,
      findCandidates: () => candidates,
    };
  }

  function createMockGraphRepo(existingEdges: Array<[number, number, string]> = []) {
    const edges: Array<{ source_id: number; target_id: number; relation: string }> = [];
    return {
      edgeExists(sourceId: number, targetId: number, relation: string) {
        return existingEdges.some(
          ([s, t, r]) =>
            ((s === sourceId && t === targetId) || (s === targetId && t === sourceId)) &&
            r === relation
        );
      },
      addEdge(edge: any) {
        edges.push(edge);
        return edges.length;
      },
      findOrphans(limit: number) { return [100, 101, 102, 103, 104]; },
      getEdges() { return edges; },
    } as unknown as GraphRepository & { getEdges(): any[] };
  }

  // STC: UT-12 — Disabled config returns 0 edges
  it('UT-12: disabled config returns 0 edges', () => {
    const graphRepo = createMockGraphRepo();
    const strategy = createMockStrategy('semantic', [
      { targetId: 2, relation: 'SIMILAR_TO', score: 0.9, metadata: {} },
    ]);
    const linker = new AutoLinker(graphRepo, [strategy], { enabled: false });
    const result = linker.link(1);
    expect(result.edgesCreated).toBe(0);
    expect(result.timeMs).toBe(0);
  });

  // STC: UT-13 — Individual strategy disabled
  it('UT-13: individual strategy disabled skips that strategy', () => {
    const graphRepo = createMockGraphRepo();
    const semantic = createMockStrategy('semantic', [
      { targetId: 2, relation: 'SIMILAR_TO', score: 0.9, metadata: {} },
    ], false);
    const entity = createMockStrategy('entity', [
      { targetId: 3, relation: 'SHARES_ENTITY', score: 0.5, metadata: {} },
    ], true);
    const linker = new AutoLinker(graphRepo, [semantic, entity]);
    const result = linker.link(1);
    expect(result.edgesCreated).toBe(1);
    expect(result.breakdown.semantic).toBe(0);
    expect(result.breakdown.entity).toBe(1);
  });

  // STC: UT-14 — totalMaxEdges caps output
  it('UT-14: totalMaxEdges caps output', () => {
    const graphRepo = createMockGraphRepo();
    const candidates: CandidateEdge[] = [];
    for (let i = 2; i <= 16; i++) {
      candidates.push({ targetId: i, relation: 'SIMILAR_TO', score: 1 - i * 0.01, metadata: {} });
    }
    const strategy = createMockStrategy('semantic', candidates);
    const linker = new AutoLinker(graphRepo, [strategy], { totalMaxEdges: 10 });
    const result = linker.link(1);
    expect(result.edgesCreated).toBeLessThanOrEqual(10);
  });

  // STC: UT-15 — Dedup removes same (target, relation)
  it('UT-15: dedup removes duplicate target+relation', () => {
    const graphRepo = createMockGraphRepo();
    const s1 = createMockStrategy('semantic', [
      { targetId: 5, relation: 'SIMILAR_TO', score: 0.9, metadata: {} },
    ]);
    const s2 = createMockStrategy('entity', [
      { targetId: 5, relation: 'SIMILAR_TO', score: 0.7, metadata: {} },
    ]);
    const linker = new AutoLinker(graphRepo, [s1, s2]);
    const result = linker.link(1);
    // Only 1 edge to target 5 with SIMILAR_TO (highest score wins)
    expect(result.edgesCreated).toBe(1);
  });

  // STC: UT-16 — Direction-agnostic dedup
  it('UT-16: direction-agnostic dedup skips existing reverse edge', () => {
    // Edge B->A already exists
    const graphRepo = createMockGraphRepo([[2, 1, 'SIMILAR_TO']]);
    const strategy = createMockStrategy('semantic', [
      { targetId: 2, relation: 'SIMILAR_TO', score: 0.9, metadata: {} },
    ]);
    const linker = new AutoLinker(graphRepo, [strategy]);
    const result = linker.link(1);
    expect(result.edgesCreated).toBe(0);
    expect(result.skipped).toBe(1);
  });

  // STC: UT-17 — Multiple relations allowed
  it('UT-17: different relations to same target both created', () => {
    const graphRepo = createMockGraphRepo();
    const s1 = createMockStrategy('semantic', [
      { targetId: 5, relation: 'SIMILAR_TO', score: 0.9, metadata: {} },
    ]);
    const s2 = createMockStrategy('entity', [
      { targetId: 5, relation: 'SHARES_ENTITY', score: 0.6, metadata: {} },
    ]);
    const linker = new AutoLinker(graphRepo, [s1, s2]);
    const result = linker.link(1);
    expect(result.edgesCreated).toBe(2);
    expect(result.breakdown.semantic).toBe(1);
    expect(result.breakdown.entity).toBe(1);
  });

  // STC: UT-18 — Backfill processes orphans
  it('UT-18: backfill processes orphan entries', () => {
    const graphRepo = createMockGraphRepo();
    const strategy = createMockStrategy('semantic', [
      { targetId: 999, relation: 'SIMILAR_TO', score: 0.8, metadata: {} },
    ]);
    const linker = new AutoLinker(graphRepo, [strategy]);
    const result = linker.backfill();
    expect(result).toContain('Backfill');
    expect(result).toContain('5'); // 5 orphans processed
  });
});


// ============================================================
// SECTION 4: Integration Tests (IT) — Real SQLite DB
// ============================================================

describe('IT: Auto-Linker Full Pipeline', () => {
  function setupDb() {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE knowledge_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        summary TEXT,
        type TEXT DEFAULT 'CONTEXT',
        tier TEXT DEFAULT 'SEMANTIC',
        source TEXT,
        source_ref TEXT,
        tags TEXT DEFAULT '',
        confidence REAL DEFAULT 0.5,
        access_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        last_accessed_at TEXT,
        expires_at TEXT,
        archived INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE knowledge_vectors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id INTEGER UNIQUE NOT NULL,
        vector BLOB NOT NULL,
        model TEXT NOT NULL,
        dimensions INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id)
      );
      CREATE TABLE entity_index (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id INTEGER NOT NULL,
        entity_name TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id)
      );
      CREATE TABLE knowledge_graph_edges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER NOT NULL,
        target_id INTEGER NOT NULL,
        relation TEXT NOT NULL DEFAULT 'RELATES_TO',
        weight REAL DEFAULT 1.0,
        metadata TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (source_id) REFERENCES knowledge_entries(id),
        FOREIGN KEY (target_id) REFERENCES knowledge_entries(id)
      );
      CREATE VIRTUAL TABLE knowledge_fts USING fts5(
        summary, content=knowledge_entries, content_rowid=id
      );
    `);
    return db;
  }

  function float32ToBuffer(arr: number[]): Buffer {
    const buf = Buffer.alloc(arr.length * 4);
    for (let i = 0; i < arr.length; i++) buf.writeFloatLE(arr[i], i * 4);
    return buf;
  }

  function insertEntry(db: Database.Database, id: number, summary: string, tags = '') {
    db.prepare(
      'INSERT INTO knowledge_entries (id, content, summary, tags) VALUES (?, ?, ?, ?)'
    ).run(id, `content-${id}`, summary, tags);
    db.prepare('INSERT INTO knowledge_fts (rowid, summary) VALUES (?, ?)').run(id, summary);
  }

  function insertVector(db: Database.Database, entryId: number, vec: number[]) {
    db.prepare(
      'INSERT INTO knowledge_vectors (entry_id, vector, model, dimensions) VALUES (?, ?, ?, ?)'
    ).run(entryId, float32ToBuffer(vec), 'test-model', vec.length);
  }

  function insertEntity(db: Database.Database, entryId: number, name: string) {
    db.prepare(
      'INSERT INTO entity_index (entry_id, entity_name, entity_type) VALUES (?, ?, ?)'
    ).run(entryId, name, 'CLASS');
  }

  function buildLinker(db: Database.Database, configOverride?: Partial<AutoLinkConfig>) {
    const graphRepo = new GraphRepository(db);
    const vectorRepo = new VectorRepository(db);
    const entityRepo = new EntityRepository(db);
    const strategies: LinkingStrategy[] = [
      new SemanticStrategy(vectorRepo),
      new EntityStrategy(entityRepo),
      new TagStrategy(db),
      new FtsStrategy(db),
    ];
    return new AutoLinker(graphRepo, strategies, configOverride);
  }

  // STC: IT-01 — Full semantic linking
  it('IT-01: full semantic linking creates SIMILAR_TO edges', () => {
    const db = setupDb();
    insertEntry(db, 1, 'Base entry about architecture');
    insertEntry(db, 2, 'Similar entry about architecture');
    insertEntry(db, 3, 'Another similar entry');
    insertEntry(db, 4, 'Orthogonal entry');
    insertEntry(db, 5, 'New entry to link');

    insertVector(db, 1, [1.0, 0.0, 0.0, 0.0]);
    insertVector(db, 2, [0.95, 0.05, 0.0, 0.0]);
    insertVector(db, 3, [0.9, 0.1, 0.0, 0.0]);
    insertVector(db, 4, [0.0, 0.0, 1.0, 0.0]);
    insertVector(db, 5, [0.98, 0.02, 0.0, 0.0]);

    const linker = buildLinker(db);
    const result = linker.link(5);

    expect(result.edgesCreated).toBeGreaterThanOrEqual(2);
    expect(result.breakdown.semantic).toBeGreaterThanOrEqual(2);

    const edges = db.prepare('SELECT * FROM knowledge_graph_edges WHERE source_id = 5').all();
    expect(edges.length).toBeGreaterThanOrEqual(2);
    db.close();
  });

  // STC: IT-02 — Semantic unavailable graceful
  it('IT-02: no vectors in DB returns 0 semantic edges gracefully', () => {
    const db = setupDb();
    insertEntry(db, 1, 'Entry without vector');
    insertEntry(db, 2, 'Another entry without vector');

    const linker = buildLinker(db);
    const result = linker.link(1);

    expect(result.breakdown.semantic).toBe(0);
    db.close();
  });

  // STC: IT-03 — Entity linking end-to-end
  it('IT-03: entity linking creates SHARES_ENTITY edges', () => {
    const db = setupDb();
    insertEntry(db, 10, 'IngestPipeline and AutoLinker design');
    insertEntry(db, 11, 'AutoLinker and SemanticStrategy');
    insertEntry(db, 12, 'GraphRepository and EntityRepository');
    insertEntry(db, 13, 'UserService and AuthModule');

    // Entry 10: [IngestPipeline, AutoLinker, GraphRepository]
    // Entry 11: [AutoLinker, GraphRepository, SemanticStrategy]
    // Shared = {AutoLinker, GraphRepository} = 2, Union = 4, Jaccard = 0.5 >= 0.3
    insertEntity(db, 10, 'IngestPipeline');
    insertEntity(db, 10, 'AutoLinker');
    insertEntity(db, 10, 'GraphRepository');
    insertEntity(db, 11, 'AutoLinker');
    insertEntity(db, 11, 'GraphRepository');
    insertEntity(db, 11, 'SemanticStrategy');
    insertEntity(db, 12, 'EntityRepository');
    insertEntity(db, 12, 'VectorRepository');
    insertEntity(db, 13, 'UserService');
    insertEntity(db, 13, 'AuthModule');

    const linker = buildLinker(db);
    const result = linker.link(10);

    expect(result.breakdown.entity).toBeGreaterThanOrEqual(1);
    const edges = db.prepare(
      "SELECT * FROM knowledge_graph_edges WHERE source_id = 10 AND relation = 'SHARES_ENTITY'"
    ).all();
    expect(edges.length).toBeGreaterThanOrEqual(1);
    db.close();
  });

  // STC: IT-04 — Tag linking end-to-end
  it('IT-04: tag linking creates SHARES_TAG edges', () => {
    const db = setupDb();
    insertEntry(db, 20, 'Architecture overview', 'architecture,memory,graph');
    insertEntry(db, 21, 'Performance tuning', 'memory,graph,performance');
    insertEntry(db, 22, 'Security design', 'security,auth');
    insertEntry(db, 23, 'Embedding system', 'memory,embedding');

    const linker = buildLinker(db);
    const result = linker.link(20);

    expect(result.breakdown.tag).toBeGreaterThanOrEqual(1);
    const edges = db.prepare(
      "SELECT * FROM knowledge_graph_edges WHERE source_id = 20 AND relation = 'SHARES_TAG'"
    ).all();
    expect(edges.length).toBeGreaterThanOrEqual(1);
    db.close();
  });


  // STC: IT-05 — FTS fallback triggers
  it('IT-05: FTS fallback triggers when other strategies produce < threshold edges', () => {
    const db = setupDb();
    // No vectors, no entities — only FTS can produce edges
    insertEntry(db, 1, 'AutoLinker orchestrates linking strategies for knowledge base');
    insertEntry(db, 2, 'The linking strategies include semantic entity approaches');
    insertEntry(db, 3, 'Knowledge base architecture with graph database');

    const linker = buildLinker(db, { fts: { enabled: true, maxEdges: 3, fallbackThreshold: 2 } });
    const result = linker.link(1);

    expect(result.breakdown.fts).toBeGreaterThanOrEqual(1);
    db.close();
  });

  // STC: IT-06 — Config change at runtime
  it('IT-06: config change affects linking behavior', () => {
    const db = setupDb();
    insertEntry(db, 1, 'Entry A');
    insertEntry(db, 2, 'Entry B');
    insertVector(db, 1, [1.0, 0.0, 0.0, 0.0]);
    insertVector(db, 2, [0.8, 0.2, 0.0, 0.0]); // cosine ~0.97

    // With high threshold, should not link
    const linker = buildLinker(db, { semantic: { enabled: true, minScore: 0.99, maxEdges: 5 } });
    const result = linker.link(1);
    expect(result.breakdown.semantic).toBe(0);
    db.close();
  });

  // STC: IT-07 — No duplicate edges on re-ingest
  it('IT-07: no duplicate edges on re-ingest', () => {
    const db = setupDb();
    insertEntry(db, 1, 'Entry A');
    insertEntry(db, 2, 'Entry B');
    insertVector(db, 1, [1.0, 0.0, 0.0, 0.0]);
    insertVector(db, 2, [0.95, 0.05, 0.0, 0.0]);

    const linker = buildLinker(db);
    const result1 = linker.link(1);
    expect(result1.edgesCreated).toBeGreaterThanOrEqual(1);

    // Link again — should skip existing edges
    const result2 = linker.link(1);
    expect(result2.edgesCreated).toBe(0);
    expect(result2.skipped).toBeGreaterThanOrEqual(1);

    // Verify only 1 edge exists
    const edges = db.prepare(
      "SELECT * FROM knowledge_graph_edges WHERE source_id = 1 AND target_id = 2 AND relation = 'SIMILAR_TO'"
    ).all();
    expect(edges.length).toBe(1);
    db.close();
  });

  // STC: IT-08 — Backfill batch mode
  it('IT-08: backfill processes orphan entries', () => {
    const db = setupDb();
    // Create 5 entries with vectors but no edges (orphans)
    for (let i = 1; i <= 5; i++) {
      insertEntry(db, i, `Entry ${i} about architecture design`);
      insertVector(db, i, [1.0 - i * 0.01, i * 0.01, 0, 0]);
    }

    const linker = buildLinker(db);
    const result = linker.backfill();

    expect(result).toContain('Backfill');
    expect(result).toContain('5');

    // Verify edges were created
    const edgeCount = db.prepare('SELECT COUNT(*) as cnt FROM knowledge_graph_edges').get() as { cnt: number };
    expect(edgeCount.cnt).toBeGreaterThan(0);
    db.close();
  });
});
