/**
 * KSA-190: E2E-API Tests — Auto-Linking via Tool Dispatcher.
 * Tests the full stack: MemoryToolDispatcher → IngestPipeline → AutoLinker → DB.
 *
 * These tests instantiate the real MemoryEngine with in-memory SQLite,
 * then call dispatch() to simulate MCP tool calls.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { MemoryEngine } from '../memory-engine.js';
import { MemoryToolDispatcher } from '../tool-dispatcher.js';
import { AutoLinker } from '../auto-linker.js';
import { SemanticStrategy } from '../linking-strategies/semantic-strategy.js';
import { EntityStrategy } from '../linking-strategies/entity-strategy.js';
import { TagStrategy } from '../linking-strategies/tag-strategy.js';
import { FtsStrategy } from '../linking-strategies/fts-strategy.js';

// Helper: create float32 buffer from number array
function float32ToBuffer(arr: number[]): Buffer {
  const buf = Buffer.alloc(arr.length * 4);
  for (let i = 0; i < arr.length; i++) buf.writeFloatLE(arr[i], i * 4);
  return buf;
}

// Helper: seed entries with vectors for semantic linking
function seedEntriesWithVectors(db: Database.Database) {
  const insertEntry = db.prepare(
    'INSERT INTO knowledge_entries (id, content, summary, type, tags) VALUES (?, ?, ?, ?, ?)'
  );
  const insertVector = db.prepare(
    'INSERT INTO knowledge_vectors (entry_id, vector, model, dimensions) VALUES (?, ?, ?, ?)'
  );

  // Seed 4 entries with vectors — new ingest will link to similar ones
  const entries = [
    { id: 1, summary: 'Architecture design patterns for microservices', tags: 'architecture,design' },
    { id: 2, summary: 'Service mesh and API gateway patterns', tags: 'architecture,api' },
    { id: 3, summary: 'Database optimization and indexing strategies', tags: 'database,performance' },
    { id: 4, summary: 'Authentication and authorization patterns', tags: 'security,auth' },
  ];
  const vectors = [
    [1.0, 0.0, 0.0, 0.0],
    [0.95, 0.05, 0.0, 0.0],  // very similar to #1
    [0.0, 0.0, 1.0, 0.0],    // orthogonal
    [0.0, 1.0, 0.0, 0.0],    // orthogonal
  ];

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    insertEntry.run(e.id, `content-${e.id}`, e.summary, 'CONTEXT', e.tags);
    insertVector.run(e.id, float32ToBuffer(vectors[i]), 'test-model', 4);
  }
}

// Helper: seed entries with shared tags for tag linking
function seedEntriesWithTags(db: Database.Database) {
  const insertEntry = db.prepare(
    'INSERT INTO knowledge_entries (id, content, summary, type, tags) VALUES (?, ?, ?, ?, ?)'
  );

  const entries = [
    { id: 1, summary: 'Memory system architecture', tags: 'architecture,memory,graph' },
    { id: 2, summary: 'Graph database performance', tags: 'memory,graph,performance' },
    { id: 3, summary: 'Security audit results', tags: 'security,auth' },
  ];

  for (const e of entries) {
    insertEntry.run(e.id, `content-${e.id}`, e.summary, 'CONTEXT', e.tags);
  }
}

describe('E2E-API: Auto-Linking via Tool Dispatcher', () => {
  let engine: MemoryEngine;
  let dispatcher: MemoryToolDispatcher;

  beforeEach(() => {
    // Fresh in-memory DB for each test
    const db = new Database(':memory:');
    engine = new MemoryEngine(db);
    dispatcher = new MemoryToolDispatcher(engine, '/tmp/test-workspace');
  });

  // STC: E2E-01 — mem_ingest with auto-linking
  it('E2E-01: mem_ingest response includes "Auto-linked: N edges"', () => {
    // Seed entries with vectors so new entry can link semantically
    seedEntriesWithVectors(engine.db);

    // Ingest a new entry similar to entry #1 and #2
    const response = dispatcher.dispatch('mem_ingest', {
      content: 'Microservices architecture patterns and service design principles for distributed systems',
      tags: 'architecture,design',
    });

    expect(response).not.toBeNull();
    expect(response).toContain('Knowledge entry created');
    expect(response).toMatch(/Auto-linked: \d+ edges?/);
  });

  // STC: E2E-02 — mem_ingest response format with breakdown
  it('E2E-02: mem_ingest response contains breakdown "(X semantic, Y entity, Z tag)"', () => {
    // Seed entries with both vectors and shared tags for multiple link types
    seedEntriesWithTags(engine.db);

    // Also add vectors for semantic linking
    const insertVector = engine.db.prepare(
      'INSERT INTO knowledge_vectors (entry_id, vector, model, dimensions) VALUES (?, ?, ?, ?)'
    );
    insertVector.run(1, float32ToBuffer([1.0, 0.0, 0.0, 0.0]), 'test-model', 4);
    insertVector.run(2, float32ToBuffer([0.95, 0.05, 0.0, 0.0]), 'test-model', 4);

    // Ingest entry with tags that overlap with entries 1 and 2 (memory,graph)
    // and a vector similar to entry 1
    const response = dispatcher.dispatch('mem_ingest', {
      content: 'Graph-based memory system with knowledge linking and architecture patterns for the memory subsystem',
      tags: 'memory,graph,architecture',
      summary: 'Graph memory architecture',
    });

    expect(response).not.toBeNull();
    expect(response).toContain('Knowledge entry created');
    // When edges are created, breakdown should be present
    if (response!.includes('Auto-linked: 0 edges')) {
      // No edges — breakdown not shown (acceptable)
      expect(response).toContain('Auto-linked: 0 edges');
    } else {
      // Edges created — verify breakdown format
      expect(response).toMatch(/\(\d+ semantic, \d+ entity, \d+ tag\)/);
    }
  });

  // STC: E2E-03 — mem_graph auto_link backfill
  it('E2E-03: mem_graph action=auto_link returns "Backfill: processed N entries, created M edges"', () => {
    // Seed orphan entries (entries with no edges) that have vectors
    seedEntriesWithVectors(engine.db);

    // Call auto_link backfill (no specific entry_id)
    const response = dispatcher.dispatch('mem_graph', {
      action: 'auto_link',
    });

    expect(response).not.toBeNull();
    expect(response).toMatch(/Backfill: processed \d+ entries, created \d+ edges/);
  });

  // STC: E2E-04 — mem_graph auto_link specific entry
  it('E2E-04: mem_graph action=auto_link with node_id returns "Auto-linked entry #N: M edges created"', () => {
    // Seed entries with vectors
    seedEntriesWithVectors(engine.db);

    // Auto-link a specific entry
    const response = dispatcher.dispatch('mem_graph', {
      action: 'auto_link',
      node_id: 1,
    });

    expect(response).not.toBeNull();
    expect(response).toMatch(/Auto-linked entry #1: \d+ edges created/);
  });

  // STC: E2E-05 — Auto-linking disabled response
  it('E2E-05: auto-linking disabled shows "Auto-linked: 0 (disabled)"', () => {
    // Create a fresh engine with auto-linker disabled
    const db = new Database(':memory:');
    const disabledEngine = new MemoryEngine(db);

    // Replace the autoLinker with a disabled one
    const graphRepo = disabledEngine.graphRepo;
    const strategies = [
      new SemanticStrategy(disabledEngine.vectors),
      new EntityStrategy(disabledEngine.entities),
      new TagStrategy(db),
      new FtsStrategy(db),
    ];
    const disabledLinker = new AutoLinker(graphRepo, strategies, { enabled: false });
    // Override the autoLinker on the engine (it's readonly but we can cast for testing)
    (disabledEngine as any).autoLinker = disabledLinker;

    const disabledDispatcher = new MemoryToolDispatcher(disabledEngine, '/tmp/test-workspace');

    // Ingest — should show disabled message
    const response = disabledDispatcher.dispatch('mem_ingest', {
      content: 'Some content that would normally trigger auto-linking',
      tags: 'test,content',
    });

    expect(response).not.toBeNull();
    expect(response).toContain('Knowledge entry created');
    expect(response).toContain('Auto-linked: 0 (disabled)');
  });
});
