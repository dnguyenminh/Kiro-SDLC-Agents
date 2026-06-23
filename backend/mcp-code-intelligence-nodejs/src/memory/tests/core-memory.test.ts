/**
 * Unit tests for CoreMemoryManager (F1: Core/Archival Memory).
 * Uses Node.js built-in test runner.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { CoreMemoryManager } from '../core-memory.js';
import { MEMORY_SCHEMA } from '../schema.js';
import { runV3Migrations } from '../migrations-v3.js';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(MEMORY_SCHEMA);
  runV3Migrations(db);
  return db;
}

function insertEntry(db: Database.Database, content: string, summary?: string): number {
  const stmt = db.prepare(
    `INSERT INTO knowledge_entries (content, summary, type, tier, tags, confidence)
     VALUES (?, ?, 'CONTEXT', 'WORKING', '', 1.0)`
  );
  const result = stmt.run(content, summary ?? content.slice(0, 60));
  return result.lastInsertRowid as number;
}

describe('CoreMemoryManager', () => {
  let db: Database.Database;
  let cm: CoreMemoryManager;

  beforeEach(() => {
    db = createTestDb();
    cm = new CoreMemoryManager(db);
  });

  describe('pin', () => {
    it('should pin an existing entry', () => {
      const id = insertEntry(db, 'Important context about the project');
      const result = cm.pin(id);
      assert.match(result, /Pinned entry/);
    });

    it('should reject pinning non-existent entry', () => {
      const result = cm.pin(999);
      assert.match(result, /not found/);
    });

    it('should reject double-pinning', () => {
      const id = insertEntry(db, 'Test content');
      cm.pin(id);
      const result = cm.pin(id);
      assert.match(result, /already pinned/);
    });

    it('should enforce max pinned entries limit', () => {
      const smallCm = new CoreMemoryManager(db, { maxPinnedEntries: 2, maxTokens: 5000, warningThreshold: 4500 });
      const id1 = insertEntry(db, 'Entry 1');
      const id2 = insertEntry(db, 'Entry 2');
      const id3 = insertEntry(db, 'Entry 3');
      smallCm.pin(id1);
      smallCm.pin(id2);
      const result = smallCm.pin(id3);
      assert.match(result, /max pinned entries/);
    });

    it('should enforce token budget', () => {
      const tightCm = new CoreMemoryManager(db, { maxTokens: 10, warningThreshold: 8, maxPinnedEntries: 10 });
      const longContent = 'x'.repeat(200); // ~50 tokens
      const id = insertEntry(db, longContent, longContent);
      const result = tightCm.pin(id);
      assert.match(result, /remaining in budget/);
    });
  });

  describe('unpin', () => {
    it('should unpin a pinned entry', () => {
      const id = insertEntry(db, 'Test');
      cm.pin(id);
      const result = cm.unpin(id);
      assert.match(result, /Unpinned/);
    });

    it('should reject unpinning non-pinned entry', () => {
      const id = insertEntry(db, 'Test');
      const result = cm.unpin(id);
      assert.match(result, /not pinned/);
    });
  });

  describe('listPinned', () => {
    it('should return empty array when nothing pinned', () => {
      const list = cm.listPinned();
      assert.equal(list.length, 0);
    });

    it('should return pinned entries in order', () => {
      const id1 = insertEntry(db, 'First entry', 'First');
      const id2 = insertEntry(db, 'Second entry', 'Second');
      cm.pin(id1);
      cm.pin(id2);
      const list = cm.listPinned();
      assert.equal(list.length, 2);
      assert.equal(list[0].id, id1);
      assert.equal(list[1].id, id2);
      assert(list[0].pin_order < list[1].pin_order);
    });
  });

  describe('reorder', () => {
    it('should change pin order', () => {
      const id1 = insertEntry(db, 'First');
      const id2 = insertEntry(db, 'Second');
      cm.pin(id1);
      cm.pin(id2);
      cm.reorder(id2, 0); // move second to front
      const list = cm.listPinned();
      assert.equal(list[0].id, id2);
    });
  });

  describe('getContext', () => {
    it('should return empty string when nothing pinned', () => {
      assert.equal(cm.getContext(), '');
    });

    it('should return formatted context with pinned entries', () => {
      const id = insertEntry(db, 'Project uses TypeScript', 'Project uses TypeScript');
      cm.pin(id);
      const ctx = cm.getContext();
      assert.match(ctx, /PINNED CONTEXT/);
      assert.match(ctx, /Project uses TypeScript/);
      assert.match(ctx, /END PINNED/);
    });
  });

  describe('getBudgetStatus', () => {
    it('should report zero usage when nothing pinned', () => {
      const status = cm.getBudgetStatus();
      assert.equal(status.used, 0);
      assert.equal(status.max, 2000);
      assert.equal(status.remaining, 2000);
      assert.equal(status.warning, false);
    });

    it('should track token usage', () => {
      const content = 'a'.repeat(400); // ~100 tokens
      const id = insertEntry(db, content, content);
      cm.pin(id);
      const status = cm.getBudgetStatus();
      assert(status.used > 0);
      assert(status.remaining < 2000);
    });
  });
});
