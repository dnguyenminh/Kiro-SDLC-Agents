/**
 * Unit tests for TokenBudget — search result token limiting.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TokenBudget } from '../v2/token-budget.js';
import { SearchResult, KnowledgeEntry } from '../models.js';

function makeResult(id: number, contentLength: number): SearchResult {
  const entry: KnowledgeEntry = {
    id, content: 'A'.repeat(contentLength), summary: 'test', type: 'CONTEXT',
    tier: 'WORKING', source: null, source_ref: null, tags: '', confidence: 1,
    access_count: 0, created_at: '', updated_at: '', last_accessed_at: null, expires_at: null,
  };
  return { entry, score: 1.0 - id * 0.1, matchType: 'hybrid' };
}

describe('TokenBudget', () => {
  const budget = new TokenBudget();

  describe('apply', () => {
    it('returns all results when within budget', () => {
      const results = [makeResult(1, 100), makeResult(2, 100)]; // 50 tokens total
      const { results: limited, tokensUsed, truncated } = budget.apply(results, 2000);
      assert.equal(limited.length, 2);
      assert.equal(tokensUsed, 50); // 200 chars / 4
      assert.equal(truncated, false);
    });

    it('limits results when exceeding budget', () => {
      const results = [
        makeResult(1, 4000), // 1000 tokens
        makeResult(2, 4000), // 1000 tokens
        makeResult(3, 4000), // 1000 tokens
      ];
      const { results: limited, truncated, totalMatches } = budget.apply(results, 2000);
      assert(limited.length < 3);
      assert.equal(truncated, true);
      assert.equal(totalMatches, 3);
    });

    it('truncates last entry to fit remaining budget', () => {
      const results = [
        makeResult(1, 4000), // 1000 tokens
        makeResult(2, 8000), // 2000 tokens — won't fully fit
      ];
      const { results: limited, tokensUsed } = budget.apply(results, 1500);
      assert.equal(limited.length, 2);
      assert(tokensUsed <= 1510); // small overhead from "..." suffix
      assert(limited[1].entry.content.length < 8000);
    });

    it('skips entry if remaining budget < 50 tokens', () => {
      const results = [
        makeResult(1, 7900), // 1975 tokens
        makeResult(2, 4000), // 1000 tokens — remaining < 50
      ];
      const { results: limited, truncated } = budget.apply(results, 2000);
      assert.equal(limited.length, 1);
      assert.equal(truncated, true);
    });

    it('handles empty results', () => {
      const { results: limited, tokensUsed, truncated } = budget.apply([], 2000);
      assert.equal(limited.length, 0);
      assert.equal(tokensUsed, 0);
      assert.equal(truncated, false);
    });

    it('handles single result exceeding budget', () => {
      const results = [makeResult(1, 20000)]; // 5000 tokens
      const { results: limited, truncated } = budget.apply(results, 500);
      assert.equal(limited.length, 1);
      assert(limited[0].entry.content.length < 20000);
      assert.equal(truncated, true);
    });

    it('preserves result order (highest score first)', () => {
      const results = [makeResult(1, 400), makeResult(2, 400), makeResult(3, 400)];
      const { results: limited } = budget.apply(results, 2000);
      assert.deepEqual(limited.map(r => r.entry.id), [1, 2, 3]);
    });
  });
});
