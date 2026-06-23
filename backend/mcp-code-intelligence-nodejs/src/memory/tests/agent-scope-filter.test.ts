/**
 * Unit tests for AgentScopeFilter — tag-based KB isolation.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { AgentScopeFilter } from '../v2/agent-scope-filter.js';
import { SearchResult, KnowledgeEntry } from '../models.js';

function makeEntry(id: number, tags: string): KnowledgeEntry {
  return {
    id, content: 'test', summary: 'test', type: 'CONTEXT', tier: 'WORKING',
    source: null, source_ref: null, tags, confidence: 1, access_count: 0,
    created_at: '', updated_at: '', last_accessed_at: null, expires_at: null,
  };
}

function makeResult(id: number, tags: string): SearchResult {
  return { entry: makeEntry(id, tags), score: 1.0, matchType: 'hybrid' };
}

describe('AgentScopeFilter', () => {
  let db: Database.Database;
  let filter: AgentScopeFilter;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE agent_scope_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_role TEXT NOT NULL UNIQUE,
        tag_set TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO agent_scope_config (agent_role, tag_set) VALUES
        ('QA', '["testing","qa","test-plan","test-case","bug"]'),
        ('DEV', '["code","api","architecture","implementation","design"]'),
        ('BA', '["requirement","business","stakeholder","process"]');
    `);
    filter = new AgentScopeFilter(db);
  });

  describe('getScope', () => {
    it('returns scope for known role', () => {
      const scope = filter.getScope('QA');
      assert(scope !== null);
      assert.equal(scope!.role, 'QA');
      assert(scope!.tags.includes('testing'));
    });

    it('returns null for unknown role', () => {
      assert.equal(filter.getScope('UNKNOWN'), null);
    });

    it('is case-insensitive', () => {
      const scope = filter.getScope('qa');
      assert(scope !== null);
      assert.equal(scope!.role, 'QA');
    });
  });

  describe('filter', () => {
    it('filters results to matching tags only', () => {
      const results = [
        makeResult(1, 'testing, qa'),
        makeResult(2, 'code, api'),
        makeResult(3, 'testing'),
      ];
      const filtered = filter.filter(results, 'QA');
      assert.equal(filtered.length, 2);
      assert.deepEqual(filtered.map(r => r.entry.id), [1, 3]);
    });

    it('keeps untagged entries visible to all (BR-F4-02)', () => {
      const results = [
        makeResult(1, 'testing'),
        makeResult(2, ''),  // untagged
        makeResult(3, 'code'),
      ];
      const filtered = filter.filter(results, 'QA');
      assert.equal(filtered.length, 2);
      assert.deepEqual(filtered.map(r => r.entry.id), [1, 2]);
    });

    it('returns all results for unknown role (no filtering)', () => {
      const results = [makeResult(1, 'testing'), makeResult(2, 'code')];
      const filtered = filter.filter(results, 'UNKNOWN');
      assert.equal(filtered.length, 2);
    });

    it('handles entries with multiple matching tags', () => {
      const results = [makeResult(1, 'testing, code, qa')];
      const filtered = filter.filter(results, 'QA');
      assert.equal(filtered.length, 1);
    });
  });

  describe('updateScope', () => {
    it('updates existing scope', () => {
      filter.updateScope('QA', ['testing', 'qa', 'e2e']);
      const scope = filter.getScope('QA');
      assert(scope!.tags.includes('e2e'));
      assert(!scope!.tags.includes('bug'));
    });

    it('creates new scope for unknown role', () => {
      filter.updateScope('PM', ['planning', 'roadmap']);
      const scope = filter.getScope('PM');
      assert(scope !== null);
      assert.deepEqual(scope!.tags, ['planning', 'roadmap']);
    });
  });
});
