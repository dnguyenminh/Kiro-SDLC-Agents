/**
 * Unit tests for WorkingTierExpiry — lazy auto-expiry of stale entries.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { WorkingTierExpiry } from '../v2/working-tier-expiry.js';

describe('WorkingTierExpiry', () => {
  let db: Database.Database;
  let expiry: WorkingTierExpiry;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE knowledge_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        tier TEXT NOT NULL DEFAULT 'WORKING',
        pinned INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0,
        quality_score INTEGER DEFAULT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    // Use 1 hour expiry for testing
    expiry = new WorkingTierExpiry(db, { expiryHours: 1, promoteThreshold: 60 });
  });

  function insertEntry(opts: {
    tier?: string; pinned?: number; archived?: number;
    quality_score?: number | null; hoursAgo?: number;
  }): number {
    const createdAt = new Date(Date.now() - (opts.hoursAgo ?? 0) * 3600_000).toISOString();
    const result = db.prepare(`
      INSERT INTO knowledge_entries (content, tier, pinned, archived, quality_score, created_at)
      VALUES ('test content', ?, ?, ?, ?, ?)
    `).run(
      opts.tier ?? 'WORKING',
      opts.pinned ?? 0,
      opts.archived ?? 0,
      opts.quality_score ?? null,
      createdAt
    );
    return Number(result.lastInsertRowid);
  }

  describe('processStale', () => {
    it('returns empty when no stale entries', () => {
      insertEntry({ hoursAgo: 0 }); // fresh entry
      const actions = expiry.processStale();
      assert.equal(actions.length, 0);
    });

    it('promotes high-quality stale entries to EPISODIC', () => {
      const id = insertEntry({ hoursAgo: 2, quality_score: 75 });
      const actions = expiry.processStale();
      assert.equal(actions.length, 1);
      assert.deepEqual(actions[0], {
        entry_id: id, action: 'promoted', quality_score: 75, to_tier: 'EPISODIC',
      });
      // Verify DB updated
      const row = db.prepare('SELECT tier FROM knowledge_entries WHERE id = ?').get(id) as any;
      assert.equal(row.tier, 'EPISODIC');
    });

    it('archives low-quality stale entries', () => {
      const id = insertEntry({ hoursAgo: 2, quality_score: 30 });
      const actions = expiry.processStale();
      assert.equal(actions.length, 1);
      assert.deepEqual(actions[0], {
        entry_id: id, action: 'archived', quality_score: 30,
      });
      const row = db.prepare('SELECT archived FROM knowledge_entries WHERE id = ?').get(id) as any;
      assert.equal(row.archived, 1);
    });

    it('archives entries with null quality_score (treated as 0)', () => {
      insertEntry({ hoursAgo: 2, quality_score: null });
      const actions = expiry.processStale();
      assert.equal(actions[0].action, 'archived');
    });

    it('skips pinned entries (BR-F1-05)', () => {
      insertEntry({ hoursAgo: 2, quality_score: 30, pinned: 1 });
      const actions = expiry.processStale();
      assert.equal(actions.length, 0);
    });

    it('skips already archived entries', () => {
      insertEntry({ hoursAgo: 2, quality_score: 30, archived: 1 });
      const actions = expiry.processStale();
      assert.equal(actions.length, 0);
    });

    it('skips non-WORKING tier entries', () => {
      insertEntry({ hoursAgo: 2, quality_score: 30, tier: 'EPISODIC' });
      const actions = expiry.processStale();
      assert.equal(actions.length, 0);
    });

    it('processes multiple entries in one call', () => {
      insertEntry({ hoursAgo: 2, quality_score: 80 }); // promote
      insertEntry({ hoursAgo: 3, quality_score: 20 }); // archive
      insertEntry({ hoursAgo: 4, quality_score: 60 }); // promote (exactly at threshold)
      const actions = expiry.processStale();
      assert.equal(actions.length, 3);
      assert.equal(actions.filter(a => a.action === 'promoted').length, 2);
      assert.equal(actions.filter(a => a.action === 'archived').length, 1);
    });
  });
});
