"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * KSA-190: Auto-Linking Logic on KB Ingest — Full Test Suite.
 * Covers PBT, UT, and IT test cases from STC.md.
 */
const vitest_1 = require("vitest");
const fc = __importStar(require("fast-check"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const auto_linker_js_1 = require("../auto-linker.js");
const auto_link_config_js_1 = require("../auto-link-config.js");
const semantic_strategy_js_1 = require("../linking-strategies/semantic-strategy.js");
const entity_strategy_js_1 = require("../linking-strategies/entity-strategy.js");
const tag_strategy_js_1 = require("../linking-strategies/tag-strategy.js");
const fts_strategy_js_1 = require("../linking-strategies/fts-strategy.js");
const graph_repo_js_1 = require("../graph-repo.js");
const vector_repo_js_1 = require("../vector-repo.js");
const entity_repo_js_1 = require("../entity-repo.js");
// Helper: cosine similarity (mirrors SemanticStrategy private method)
function cosineSimilarity(a, b) {
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
function jaccard(a, b) {
    if (a.size === 0 && b.size === 0)
        return 0;
    const intersection = new Set([...a].filter(x => b.has(x)));
    const union = new Set([...a, ...b]);
    return intersection.size / union.size;
}
// ============================================================
// SECTION 1: Property-Based Tests (PBT)
// ============================================================
(0, vitest_1.describe)('PBT-01: Cosine Similarity Properties', () => {
    const nonZeroVector = (dim) => fc.array(fc.float({ min: -100, max: 100, noNaN: true }), {
        minLength: dim, maxLength: dim,
    }).filter(v => v.some(x => x !== 0));
    const positiveVector = (dim) => fc.array(fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }), {
        minLength: dim, maxLength: dim,
    });
    // STC: PBT-01a — cosineSimilarity(v, v) === 1.0
    (0, vitest_1.it)('PBT-01a: self-similarity equals 1.0', () => {
        fc.assert(fc.property(nonZeroVector(8), (v) => {
            const sim = cosineSimilarity(v, v);
            (0, vitest_1.expect)(sim).toBeCloseTo(1.0, 5);
        }), { numRuns: 200 });
    });
    // STC: PBT-01b — cosineSimilarity(v, -v) === -1.0
    (0, vitest_1.it)('PBT-01b: opposite vector similarity equals -1.0', () => {
        fc.assert(fc.property(nonZeroVector(8), (v) => {
            const neg = v.map(x => -x);
            const sim = cosineSimilarity(v, neg);
            (0, vitest_1.expect)(sim).toBeCloseTo(-1.0, 5);
        }), { numRuns: 200 });
    });
    // STC: PBT-01c — 0 <= cosineSimilarity(v, w) <= 1.0 for non-negative vectors
    (0, vitest_1.it)('PBT-01c: bounded [0,1] for non-negative vectors', () => {
        fc.assert(fc.property(positiveVector(8), positiveVector(8), (v, w) => {
            const sim = cosineSimilarity(v, w);
            (0, vitest_1.expect)(sim).toBeGreaterThanOrEqual(-1e-7);
            (0, vitest_1.expect)(sim).toBeLessThanOrEqual(1.0 + 1e-7);
        }), { numRuns: 200 });
    });
    // STC: PBT-01d — cosineSimilarity is symmetric
    (0, vitest_1.it)('PBT-01d: symmetric sim(a,b) === sim(b,a)', () => {
        fc.assert(fc.property(nonZeroVector(8), nonZeroVector(8), (a, b) => {
            const ab = cosineSimilarity(a, b);
            const ba = cosineSimilarity(b, a);
            (0, vitest_1.expect)(ab).toBeCloseTo(ba, 10);
        }), { numRuns: 200 });
    });
});
(0, vitest_1.describe)('PBT-02: Jaccard Coefficient Properties', () => {
    const nonEmptyStringSet = fc.uniqueArray(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 10 }).map(arr => new Set(arr));
    const stringSet = fc.uniqueArray(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 0, maxLength: 10 }).map(arr => new Set(arr));
    // STC: PBT-02a — jaccard(A, A) === 1.0
    (0, vitest_1.it)('PBT-02a: self-jaccard equals 1.0', () => {
        fc.assert(fc.property(nonEmptyStringSet, (a) => {
            (0, vitest_1.expect)(jaccard(a, a)).toBeCloseTo(1.0, 10);
        }), { numRuns: 200 });
    });
    // STC: PBT-02b — jaccard(A, empty) === 0.0
    (0, vitest_1.it)('PBT-02b: jaccard with empty set equals 0.0', () => {
        fc.assert(fc.property(nonEmptyStringSet, (a) => {
            (0, vitest_1.expect)(jaccard(a, new Set())).toBe(0);
        }), { numRuns: 200 });
    });
    // STC: PBT-02c — 0 <= jaccard(A, B) <= 1.0
    (0, vitest_1.it)('PBT-02c: bounded [0,1]', () => {
        fc.assert(fc.property(stringSet, stringSet, (a, b) => {
            const j = jaccard(a, b);
            (0, vitest_1.expect)(j).toBeGreaterThanOrEqual(0);
            (0, vitest_1.expect)(j).toBeLessThanOrEqual(1.0);
        }), { numRuns: 200 });
    });
    // STC: PBT-02d — jaccard is symmetric
    (0, vitest_1.it)('PBT-02d: symmetric jaccard(A,B) === jaccard(B,A)', () => {
        fc.assert(fc.property(stringSet, stringSet, (a, b) => {
            (0, vitest_1.expect)(jaccard(a, b)).toBeCloseTo(jaccard(b, a), 10);
        }), { numRuns: 200 });
    });
});
// ============================================================
// SECTION 2: Unit Tests (UT) — Strategy Tests
// ============================================================
(0, vitest_1.describe)('UT: SemanticStrategy', () => {
    function createMockVectorRepo(vectors) {
        return {
            getVector(entryId) { return vectors.get(entryId) ?? null; },
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
        };
    }
    function float32ToBuffer(arr) {
        const buf = Buffer.alloc(arr.length * 4);
        for (let i = 0; i < arr.length; i++)
            buf.writeFloatLE(arr[i], i * 4);
        return buf;
    }
    // STC: UT-01 — Returns candidates above threshold
    (0, vitest_1.it)('UT-01: returns candidates above threshold, excludes below', () => {
        const vectors = new Map();
        vectors.set(1, [1, 0, 0, 0]);
        vectors.set(2, [0.95, 0.05, 0, 0]); // very similar
        vectors.set(3, [0.8, 0.1, 0.1, 0]); // similar
        vectors.set(4, [0.5, 0.5, 0.5, 0.5]); // low similarity
        const strategy = new semantic_strategy_js_1.SemanticStrategy(createMockVectorRepo(vectors));
        const config = (0, auto_link_config_js_1.defaultAutoLinkConfig)();
        config.semantic.minScore = 0.75;
        const candidates = strategy.findCandidates(1, config);
        (0, vitest_1.expect)(candidates.length).toBe(2);
        (0, vitest_1.expect)(candidates.every(c => c.score >= 0.75)).toBe(true);
        (0, vitest_1.expect)(candidates.every(c => c.relation === 'SIMILAR_TO')).toBe(true);
    });
    // STC: UT-02 — Returns empty when no vector exists
    (0, vitest_1.it)('UT-02: returns empty when entry has no vector', () => {
        const vectors = new Map();
        vectors.set(2, [1, 0, 0, 0]);
        // Entry 1 has no vector
        const strategy = new semantic_strategy_js_1.SemanticStrategy(createMockVectorRepo(vectors));
        const config = (0, auto_link_config_js_1.defaultAutoLinkConfig)();
        const candidates = strategy.findCandidates(1, config);
        (0, vitest_1.expect)(candidates).toEqual([]);
    });
    // STC: UT-03 — Respects maxEdges limit
    (0, vitest_1.it)('UT-03: respects maxEdges limit', () => {
        const vectors = new Map();
        vectors.set(1, [1, 0, 0, 0]);
        // Create 10 very similar vectors
        for (let i = 2; i <= 11; i++) {
            vectors.set(i, [1 - (i * 0.001), i * 0.001, 0, 0]);
        }
        const strategy = new semantic_strategy_js_1.SemanticStrategy(createMockVectorRepo(vectors));
        const config = (0, auto_link_config_js_1.defaultAutoLinkConfig)();
        config.semantic.minScore = 0.5;
        config.semantic.maxEdges = 5;
        const candidates = strategy.findCandidates(1, config);
        (0, vitest_1.expect)(candidates.length).toBeLessThanOrEqual(5);
    });
});
(0, vitest_1.describe)('UT: EntityStrategy', () => {
    function createMockEntityRepo(data) {
        return {
            getEntities(entryId) {
                const names = data.get(entryId) ?? [];
                return names.map((name, i) => ({
                    id: i, entry_id: entryId, entity_name: name, entity_type: 'CLASS',
                }));
            },
            findByEntity(entityName) {
                const ids = [];
                for (const [id, names] of data) {
                    if (names.some(n => n.includes(entityName)))
                        ids.push(id);
                }
                return ids;
            },
        };
    }
    // STC: UT-04 — Detects shared entities with Jaccard >= 0.3
    (0, vitest_1.it)('UT-04: detects shared entities with Jaccard >= 0.3', () => {
        const data = new Map();
        data.set(1, ['A', 'B', 'C']);
        data.set(2, ['B', 'C', 'D']); // Jaccard = 2/4 = 0.5
        const strategy = new entity_strategy_js_1.EntityStrategy(createMockEntityRepo(data));
        const config = (0, auto_link_config_js_1.defaultAutoLinkConfig)();
        config.entity.minJaccard = 0.3;
        const candidates = strategy.findCandidates(1, config);
        (0, vitest_1.expect)(candidates.length).toBe(1);
        (0, vitest_1.expect)(candidates[0].targetId).toBe(2);
        (0, vitest_1.expect)(candidates[0].score).toBeCloseTo(0.5, 2);
        (0, vitest_1.expect)(candidates[0].relation).toBe('SHARES_ENTITY');
    });
    // STC: UT-05 — Excludes low Jaccard
    (0, vitest_1.it)('UT-05: excludes entries with Jaccard below threshold', () => {
        const data = new Map();
        data.set(1, ['A', 'B', 'C', 'D', 'E']);
        data.set(2, ['E']); // Jaccard = 1/5 = 0.2
        const strategy = new entity_strategy_js_1.EntityStrategy(createMockEntityRepo(data));
        const config = (0, auto_link_config_js_1.defaultAutoLinkConfig)();
        config.entity.minJaccard = 0.3;
        const candidates = strategy.findCandidates(1, config);
        (0, vitest_1.expect)(candidates).toEqual([]);
    });
    // STC: UT-06 — Returns empty when entry has no entities
    (0, vitest_1.it)('UT-06: returns empty when entry has no entities', () => {
        const data = new Map();
        data.set(1, []);
        data.set(2, ['A', 'B']);
        const strategy = new entity_strategy_js_1.EntityStrategy(createMockEntityRepo(data));
        const config = (0, auto_link_config_js_1.defaultAutoLinkConfig)();
        const candidates = strategy.findCandidates(1, config);
        (0, vitest_1.expect)(candidates).toEqual([]);
    });
});
(0, vitest_1.describe)('UT: TagStrategy', () => {
    function createTagDb(entries) {
        const db = new better_sqlite3_1.default(':memory:');
        db.exec(`CREATE TABLE knowledge_entries (
      id INTEGER PRIMARY KEY, tags TEXT, archived INTEGER NOT NULL DEFAULT 0
    )`);
        const stmt = db.prepare('INSERT INTO knowledge_entries (id, tags) VALUES (?, ?)');
        for (const e of entries)
            stmt.run(e.id, e.tags);
        return db;
    }
    // STC: UT-07 — Detects >= 2 shared tags
    (0, vitest_1.it)('UT-07: detects entries with >= 2 shared tags', () => {
        const db = createTagDb([
            { id: 1, tags: 'a,b,c' },
            { id: 2, tags: 'b,c,d' },
        ]);
        const strategy = new tag_strategy_js_1.TagStrategy(db);
        const config = (0, auto_link_config_js_1.defaultAutoLinkConfig)();
        config.tag.minOverlap = 2;
        const candidates = strategy.findCandidates(1, config);
        (0, vitest_1.expect)(candidates.length).toBe(1);
        (0, vitest_1.expect)(candidates[0].targetId).toBe(2);
        (0, vitest_1.expect)(candidates[0].relation).toBe('SHARES_TAG');
        (0, vitest_1.expect)(candidates[0].metadata.overlap_count).toBe(2);
        db.close();
    });
    // STC: UT-08 — Excludes single tag overlap
    (0, vitest_1.it)('UT-08: excludes entries with only 1 shared tag', () => {
        const db = createTagDb([
            { id: 1, tags: 'a,b' },
            { id: 2, tags: 'b,x' },
        ]);
        const strategy = new tag_strategy_js_1.TagStrategy(db);
        const config = (0, auto_link_config_js_1.defaultAutoLinkConfig)();
        config.tag.minOverlap = 2;
        const candidates = strategy.findCandidates(1, config);
        (0, vitest_1.expect)(candidates).toEqual([]);
        db.close();
    });
    // STC: UT-09 — Handles empty tags gracefully
    (0, vitest_1.it)('UT-09: handles empty tags gracefully', () => {
        const db = createTagDb([
            { id: 1, tags: '' },
            { id: 2, tags: 'a,b,c' },
        ]);
        const strategy = new tag_strategy_js_1.TagStrategy(db);
        const config = (0, auto_link_config_js_1.defaultAutoLinkConfig)();
        const candidates = strategy.findCandidates(1, config);
        (0, vitest_1.expect)(candidates).toEqual([]);
        db.close();
    });
});
(0, vitest_1.describe)('UT: FtsStrategy', () => {
    function createFtsDb(entries) {
        const db = new better_sqlite3_1.default(':memory:');
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
    (0, vitest_1.it)('UT-10: extracts significant words and finds FTS matches', () => {
        const db = createFtsDb([
            { id: 1, summary: 'AutoLinker orchestrates linking strategies for knowledge entries' },
            { id: 2, summary: 'The linking strategies include semantic and entity approaches' },
            { id: 3, summary: 'Completely unrelated content about cooking recipes' },
        ]);
        const strategy = new fts_strategy_js_1.FtsStrategy(db);
        const config = (0, auto_link_config_js_1.defaultAutoLinkConfig)();
        const candidates = strategy.findCandidates(1, config);
        (0, vitest_1.expect)(candidates.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(candidates.every(c => c.relation === 'TOPIC_OVERLAP')).toBe(true);
        (0, vitest_1.expect)(candidates.every(c => c.score >= 0 && c.score <= 1)).toBe(true);
        db.close();
    });
    // STC: UT-11 — Returns empty on short summary
    (0, vitest_1.it)('UT-11: returns empty on short summary', () => {
        const db = createFtsDb([
            { id: 1, summary: 'hi' },
            { id: 2, summary: 'Some longer content about architecture design patterns' },
        ]);
        const strategy = new fts_strategy_js_1.FtsStrategy(db);
        const config = (0, auto_link_config_js_1.defaultAutoLinkConfig)();
        const candidates = strategy.findCandidates(1, config);
        (0, vitest_1.expect)(candidates).toEqual([]);
        db.close();
    });
});
// ============================================================
// SECTION 3: Unit Tests (UT) — AutoLinker Orchestrator
// ============================================================
(0, vitest_1.describe)('UT: AutoLinker Orchestrator', () => {
    function createMockStrategy(name, candidates, enabled = true) {
        return {
            name,
            isEnabled: () => enabled,
            findCandidates: () => candidates,
        };
    }
    function createMockGraphRepo(existingEdges = []) {
        const edges = [];
        return {
            edgeExists(sourceId, targetId, relation) {
                return existingEdges.some(([s, t, r]) => ((s === sourceId && t === targetId) || (s === targetId && t === sourceId)) &&
                    r === relation);
            },
            addEdge(edge) {
                edges.push(edge);
                return edges.length;
            },
            findOrphans(limit) { return [100, 101, 102, 103, 104]; },
            getEdges() { return edges; },
        };
    }
    // STC: UT-12 — Disabled config returns 0 edges
    (0, vitest_1.it)('UT-12: disabled config returns 0 edges', () => {
        const graphRepo = createMockGraphRepo();
        const strategy = createMockStrategy('semantic', [
            { targetId: 2, relation: 'SIMILAR_TO', score: 0.9, metadata: {} },
        ]);
        const linker = new auto_linker_js_1.AutoLinker(graphRepo, [strategy], { enabled: false });
        const result = linker.link(1);
        (0, vitest_1.expect)(result.edgesCreated).toBe(0);
        (0, vitest_1.expect)(result.timeMs).toBe(0);
    });
    // STC: UT-13 — Individual strategy disabled
    (0, vitest_1.it)('UT-13: individual strategy disabled skips that strategy', () => {
        const graphRepo = createMockGraphRepo();
        const semantic = createMockStrategy('semantic', [
            { targetId: 2, relation: 'SIMILAR_TO', score: 0.9, metadata: {} },
        ], false);
        const entity = createMockStrategy('entity', [
            { targetId: 3, relation: 'SHARES_ENTITY', score: 0.5, metadata: {} },
        ], true);
        const linker = new auto_linker_js_1.AutoLinker(graphRepo, [semantic, entity]);
        const result = linker.link(1);
        (0, vitest_1.expect)(result.edgesCreated).toBe(1);
        (0, vitest_1.expect)(result.breakdown.semantic).toBe(0);
        (0, vitest_1.expect)(result.breakdown.entity).toBe(1);
    });
    // STC: UT-14 — totalMaxEdges caps output
    (0, vitest_1.it)('UT-14: totalMaxEdges caps output', () => {
        const graphRepo = createMockGraphRepo();
        const candidates = [];
        for (let i = 2; i <= 16; i++) {
            candidates.push({ targetId: i, relation: 'SIMILAR_TO', score: 1 - i * 0.01, metadata: {} });
        }
        const strategy = createMockStrategy('semantic', candidates);
        const linker = new auto_linker_js_1.AutoLinker(graphRepo, [strategy], { totalMaxEdges: 10 });
        const result = linker.link(1);
        (0, vitest_1.expect)(result.edgesCreated).toBeLessThanOrEqual(10);
    });
    // STC: UT-15 — Dedup removes same (target, relation)
    (0, vitest_1.it)('UT-15: dedup removes duplicate target+relation', () => {
        const graphRepo = createMockGraphRepo();
        const s1 = createMockStrategy('semantic', [
            { targetId: 5, relation: 'SIMILAR_TO', score: 0.9, metadata: {} },
        ]);
        const s2 = createMockStrategy('entity', [
            { targetId: 5, relation: 'SIMILAR_TO', score: 0.7, metadata: {} },
        ]);
        const linker = new auto_linker_js_1.AutoLinker(graphRepo, [s1, s2]);
        const result = linker.link(1);
        // Only 1 edge to target 5 with SIMILAR_TO (highest score wins)
        (0, vitest_1.expect)(result.edgesCreated).toBe(1);
    });
    // STC: UT-16 — Direction-agnostic dedup
    (0, vitest_1.it)('UT-16: direction-agnostic dedup skips existing reverse edge', () => {
        // Edge B->A already exists
        const graphRepo = createMockGraphRepo([[2, 1, 'SIMILAR_TO']]);
        const strategy = createMockStrategy('semantic', [
            { targetId: 2, relation: 'SIMILAR_TO', score: 0.9, metadata: {} },
        ]);
        const linker = new auto_linker_js_1.AutoLinker(graphRepo, [strategy]);
        const result = linker.link(1);
        (0, vitest_1.expect)(result.edgesCreated).toBe(0);
        (0, vitest_1.expect)(result.skipped).toBe(1);
    });
    // STC: UT-17 — Multiple relations allowed
    (0, vitest_1.it)('UT-17: different relations to same target both created', () => {
        const graphRepo = createMockGraphRepo();
        const s1 = createMockStrategy('semantic', [
            { targetId: 5, relation: 'SIMILAR_TO', score: 0.9, metadata: {} },
        ]);
        const s2 = createMockStrategy('entity', [
            { targetId: 5, relation: 'SHARES_ENTITY', score: 0.6, metadata: {} },
        ]);
        const linker = new auto_linker_js_1.AutoLinker(graphRepo, [s1, s2]);
        const result = linker.link(1);
        (0, vitest_1.expect)(result.edgesCreated).toBe(2);
        (0, vitest_1.expect)(result.breakdown.semantic).toBe(1);
        (0, vitest_1.expect)(result.breakdown.entity).toBe(1);
    });
    // STC: UT-18 — Backfill processes orphans
    (0, vitest_1.it)('UT-18: backfill processes orphan entries', () => {
        const graphRepo = createMockGraphRepo();
        const strategy = createMockStrategy('semantic', [
            { targetId: 999, relation: 'SIMILAR_TO', score: 0.8, metadata: {} },
        ]);
        const linker = new auto_linker_js_1.AutoLinker(graphRepo, [strategy]);
        const result = linker.backfill();
        (0, vitest_1.expect)(result).toContain('Backfill');
        (0, vitest_1.expect)(result).toContain('5'); // 5 orphans processed
    });
});
// ============================================================
// SECTION 4: Integration Tests (IT) — Real SQLite DB
// ============================================================
(0, vitest_1.describe)('IT: Auto-Linker Full Pipeline', () => {
    function setupDb() {
        const db = new better_sqlite3_1.default(':memory:');
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
    function float32ToBuffer(arr) {
        const buf = Buffer.alloc(arr.length * 4);
        for (let i = 0; i < arr.length; i++)
            buf.writeFloatLE(arr[i], i * 4);
        return buf;
    }
    function insertEntry(db, id, summary, tags = '') {
        db.prepare('INSERT INTO knowledge_entries (id, content, summary, tags) VALUES (?, ?, ?, ?)').run(id, `content-${id}`, summary, tags);
        db.prepare('INSERT INTO knowledge_fts (rowid, summary) VALUES (?, ?)').run(id, summary);
    }
    function insertVector(db, entryId, vec) {
        db.prepare('INSERT INTO knowledge_vectors (entry_id, vector, model, dimensions) VALUES (?, ?, ?, ?)').run(entryId, float32ToBuffer(vec), 'test-model', vec.length);
    }
    function insertEntity(db, entryId, name) {
        db.prepare('INSERT INTO entity_index (entry_id, entity_name, entity_type) VALUES (?, ?, ?)').run(entryId, name, 'CLASS');
    }
    function buildLinker(db, configOverride) {
        const graphRepo = new graph_repo_js_1.GraphRepository(db);
        const vectorRepo = new vector_repo_js_1.VectorRepository(db);
        const entityRepo = new entity_repo_js_1.EntityRepository(db);
        const strategies = [
            new semantic_strategy_js_1.SemanticStrategy(vectorRepo),
            new entity_strategy_js_1.EntityStrategy(entityRepo),
            new tag_strategy_js_1.TagStrategy(db),
            new fts_strategy_js_1.FtsStrategy(db),
        ];
        return new auto_linker_js_1.AutoLinker(graphRepo, strategies, configOverride);
    }
    // STC: IT-01 — Full semantic linking
    (0, vitest_1.it)('IT-01: full semantic linking creates SIMILAR_TO edges', () => {
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
        (0, vitest_1.expect)(result.edgesCreated).toBeGreaterThanOrEqual(2);
        (0, vitest_1.expect)(result.breakdown.semantic).toBeGreaterThanOrEqual(2);
        const edges = db.prepare('SELECT * FROM knowledge_graph_edges WHERE source_id = 5').all();
        (0, vitest_1.expect)(edges.length).toBeGreaterThanOrEqual(2);
        db.close();
    });
    // STC: IT-02 — Semantic unavailable graceful
    (0, vitest_1.it)('IT-02: no vectors in DB returns 0 semantic edges gracefully', () => {
        const db = setupDb();
        insertEntry(db, 1, 'Entry without vector');
        insertEntry(db, 2, 'Another entry without vector');
        const linker = buildLinker(db);
        const result = linker.link(1);
        (0, vitest_1.expect)(result.breakdown.semantic).toBe(0);
        db.close();
    });
    // STC: IT-03 — Entity linking end-to-end
    (0, vitest_1.it)('IT-03: entity linking creates SHARES_ENTITY edges', () => {
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
        (0, vitest_1.expect)(result.breakdown.entity).toBeGreaterThanOrEqual(1);
        const edges = db.prepare("SELECT * FROM knowledge_graph_edges WHERE source_id = 10 AND relation = 'SHARES_ENTITY'").all();
        (0, vitest_1.expect)(edges.length).toBeGreaterThanOrEqual(1);
        db.close();
    });
    // STC: IT-04 — Tag linking end-to-end
    (0, vitest_1.it)('IT-04: tag linking creates SHARES_TAG edges', () => {
        const db = setupDb();
        insertEntry(db, 20, 'Architecture overview', 'architecture,memory,graph');
        insertEntry(db, 21, 'Performance tuning', 'memory,graph,performance');
        insertEntry(db, 22, 'Security design', 'security,auth');
        insertEntry(db, 23, 'Embedding system', 'memory,embedding');
        const linker = buildLinker(db);
        const result = linker.link(20);
        (0, vitest_1.expect)(result.breakdown.tag).toBeGreaterThanOrEqual(1);
        const edges = db.prepare("SELECT * FROM knowledge_graph_edges WHERE source_id = 20 AND relation = 'SHARES_TAG'").all();
        (0, vitest_1.expect)(edges.length).toBeGreaterThanOrEqual(1);
        db.close();
    });
    // STC: IT-05 — FTS fallback triggers
    (0, vitest_1.it)('IT-05: FTS fallback triggers when other strategies produce < threshold edges', () => {
        const db = setupDb();
        // No vectors, no entities — only FTS can produce edges
        insertEntry(db, 1, 'AutoLinker orchestrates linking strategies for knowledge base');
        insertEntry(db, 2, 'The linking strategies include semantic entity approaches');
        insertEntry(db, 3, 'Knowledge base architecture with graph database');
        const linker = buildLinker(db, { fts: { enabled: true, maxEdges: 3, fallbackThreshold: 2 } });
        const result = linker.link(1);
        (0, vitest_1.expect)(result.breakdown.fts).toBeGreaterThanOrEqual(1);
        db.close();
    });
    // STC: IT-06 — Config change at runtime
    (0, vitest_1.it)('IT-06: config change affects linking behavior', () => {
        const db = setupDb();
        insertEntry(db, 1, 'Entry A');
        insertEntry(db, 2, 'Entry B');
        insertVector(db, 1, [1.0, 0.0, 0.0, 0.0]);
        insertVector(db, 2, [0.8, 0.2, 0.0, 0.0]); // cosine ~0.97
        // With high threshold, should not link
        const linker = buildLinker(db, { semantic: { enabled: true, minScore: 0.99, maxEdges: 5 } });
        const result = linker.link(1);
        (0, vitest_1.expect)(result.breakdown.semantic).toBe(0);
        db.close();
    });
    // STC: IT-07 — No duplicate edges on re-ingest
    (0, vitest_1.it)('IT-07: no duplicate edges on re-ingest', () => {
        const db = setupDb();
        insertEntry(db, 1, 'Entry A');
        insertEntry(db, 2, 'Entry B');
        insertVector(db, 1, [1.0, 0.0, 0.0, 0.0]);
        insertVector(db, 2, [0.95, 0.05, 0.0, 0.0]);
        const linker = buildLinker(db);
        const result1 = linker.link(1);
        (0, vitest_1.expect)(result1.edgesCreated).toBeGreaterThanOrEqual(1);
        // Link again — should skip existing edges
        const result2 = linker.link(1);
        (0, vitest_1.expect)(result2.edgesCreated).toBe(0);
        (0, vitest_1.expect)(result2.skipped).toBeGreaterThanOrEqual(1);
        // Verify only 1 edge exists
        const edges = db.prepare("SELECT * FROM knowledge_graph_edges WHERE source_id = 1 AND target_id = 2 AND relation = 'SIMILAR_TO'").all();
        (0, vitest_1.expect)(edges.length).toBe(1);
        db.close();
    });
    // STC: IT-08 — Backfill batch mode
    (0, vitest_1.it)('IT-08: backfill processes orphan entries', () => {
        const db = setupDb();
        // Create 5 entries with vectors but no edges (orphans)
        for (let i = 1; i <= 5; i++) {
            insertEntry(db, i, `Entry ${i} about architecture design`);
            insertVector(db, i, [1.0 - i * 0.01, i * 0.01, 0, 0]);
        }
        const linker = buildLinker(db);
        const result = linker.backfill();
        (0, vitest_1.expect)(result).toContain('Backfill');
        (0, vitest_1.expect)(result).toContain('5');
        // Verify edges were created
        const edgeCount = db.prepare('SELECT COUNT(*) as cnt FROM knowledge_graph_edges').get();
        (0, vitest_1.expect)(edgeCount.cnt).toBeGreaterThan(0);
        db.close();
    });
});
//# sourceMappingURL=auto-linker.vitest.js.map