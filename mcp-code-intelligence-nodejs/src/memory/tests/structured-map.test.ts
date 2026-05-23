/**
 * Unit tests for Structured Map (F3: Entity Extraction + Metadata Enrichment).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { extractStructuredMap } from '../structured-map-extractor.js';
import { classifyEntity } from '../entity-classifier.js';
import { EntityRepository } from '../entity-repo.js';
import { KnowledgeRepository } from '../knowledge-repo.js';
import { MEMORY_SCHEMA } from '../schema.js';
import { runV3Migrations } from '../migrations-v3.js';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(MEMORY_SCHEMA);
  runV3Migrations(db);
  return db;
}

describe('extractStructuredMap', () => {
  it('should extract topic from heading', () => {
    const map = extractStructuredMap('# Authentication Flow\nDetails here');
    assert.equal(map.topic, 'Authentication Flow');
  });

  it('should extract topic from first line if no heading', () => {
    const map = extractStructuredMap('This is about user login');
    assert.equal(map.topic, 'This is about user login');
  });

  it('should extract ticket IDs as entities', () => {
    const map = extractStructuredMap('Related to KSA-111 and MTO-5');
    assert(map.entities_mentioned.includes('KSA-111'));
    assert(map.entities_mentioned.includes('MTO-5'));
  });

  it('should extract @mentions as entities', () => {
    const map = extractStructuredMap('Assigned to @john-doe for review');
    assert(map.entities_mentioned.includes('@john-doe'));
  });

  it('should extract PascalCase class names', () => {
    const map = extractStructuredMap('The CoreMemoryManager handles pinning');
    assert(map.entities_mentioned.includes('CoreMemoryManager'));
  });

  it('should extract decisions', () => {
    const map = extractStructuredMap('Decision: Use SQLite for storage\nOther text');
    assert.equal(map.decisions_made.length, 1);
    assert.match(map.decisions_made[0], /SQLite/);
  });

  it('should extract action items', () => {
    const map = extractStructuredMap('TODO: Add validation\n[ ] Write tests');
    assert.equal(map.action_items.length, 2);
  });

  it('should extract URLs as context refs', () => {
    const map = extractStructuredMap('See https://example.com/docs for details');
    assert(map.context_refs.some(r => r.includes('example.com')));
  });

  it('should extract file paths as context refs', () => {
    const map = extractStructuredMap('Modified src/memory/core-memory.ts');
    assert(map.context_refs.some(r => r.includes('src/memory/core-memory.ts')));
  });

  it('should detect positive sentiment', () => {
    const map = extractStructuredMap('The fix works great, resolved successfully and improved performance');
    assert.equal(map.sentiment, 'positive');
  });

  it('should detect negative sentiment', () => {
    const map = extractStructuredMap('Critical error: system crashed, bug in production');
    assert.equal(map.sentiment, 'negative');
  });

  it('should detect mixed sentiment', () => {
    const map = extractStructuredMap('Fixed the bug but found another issue');
    assert.equal(map.sentiment, 'mixed');
  });

  it('should handle empty content', () => {
    const map = extractStructuredMap('');
    assert.equal(map.topic, '');
    assert.equal(map.sentiment, 'neutral');
  });
});

describe('classifyEntity', () => {
  it('should classify ticket IDs', () => {
    assert.equal(classifyEntity('KSA-111'), 'ticket');
    assert.equal(classifyEntity('MTO-5'), 'ticket');
  });

  it('should classify @mentions as person', () => {
    assert.equal(classifyEntity('@john'), 'person');
  });

  it('should classify PascalCase as system', () => {
    assert.equal(classifyEntity('CoreMemoryManager'), 'system');
  });

  it('should classify file paths', () => {
    assert.equal(classifyEntity('src/memory/core.ts'), 'file');
  });

  it('should default to concept', () => {
    assert.equal(classifyEntity('authentication'), 'concept');
  });
});

describe('EntityRepository', () => {
  let db: Database.Database;
  let repo: EntityRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new EntityRepository(db);
    // Insert a test entry
    db.prepare(
      `INSERT INTO knowledge_entries (content, summary, type, tier, tags, confidence)
       VALUES ('test', 'test', 'CONTEXT', 'WORKING', '', 1.0)`
    ).run();
  });

  it('should index and retrieve entities', () => {
    repo.indexEntities(1, [
      { name: 'KSA-111', type: 'ticket' },
      { name: 'CoreMemory', type: 'system' },
    ]);
    const entities = repo.getEntities(1);
    assert.equal(entities.length, 2);
  });

  it('should find entries by entity name', () => {
    repo.indexEntities(1, [{ name: 'KSA-111', type: 'ticket' }]);
    const ids = repo.findByEntity('KSA-111');
    assert.deepEqual(ids, [1]);
  });

  it('should find entries by entity type', () => {
    repo.indexEntities(1, [{ name: 'KSA-111', type: 'ticket' }]);
    const ids = repo.findByType('ticket');
    assert.deepEqual(ids, [1]);
  });

  it('should replace entities on re-index', () => {
    repo.indexEntities(1, [{ name: 'old', type: 'concept' }]);
    repo.indexEntities(1, [{ name: 'new', type: 'concept' }]);
    const entities = repo.getEntities(1);
    assert.equal(entities.length, 1);
    assert.equal(entities[0].entity_name, 'new');
  });
});

describe('KnowledgeRepository.structuredMap', () => {
  let db: Database.Database;
  let repo: KnowledgeRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new KnowledgeRepository(db);
  });

  it('should store and retrieve structured map', () => {
    const id = repo.insert({ content: 'test', summary: 'test', type: 'CONTEXT' });
    const map = JSON.stringify({ topic: 'test', entities_mentioned: [] });
    repo.updateStructuredMap(id, map);
    const result = repo.getStructuredMap(id);
    assert.equal(result, map);
  });

  it('should return empty JSON for new entries', () => {
    const id = repo.insert({ content: 'test', summary: 'test', type: 'CONTEXT' });
    const result = repo.getStructuredMap(id);
    assert.equal(result, '{}');
  });
});
