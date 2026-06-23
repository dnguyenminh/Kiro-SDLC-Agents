/**
 * Unit tests for QualityGate — ingest validation.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { QualityGate } from '../v2/quality-gate.js';

describe('QualityGate', () => {
  let db: Database.Database;
  let gate: QualityGate;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE knowledge_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        summary TEXT,
        type TEXT,
        tier TEXT DEFAULT 'WORKING',
        source TEXT,
        tags TEXT DEFAULT '',
        archived INTEGER NOT NULL DEFAULT 0,
        quality_score INTEGER DEFAULT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    gate = new QualityGate(db);
  });

  describe('validate — content length', () => {
    it('rejects empty content', () => {
      const result = gate.validate('', {});
      assert.equal(result.decision, 'reject');
      assert.equal(result.score, 0);
      assert(result.message!.includes('too short'));
    });

    it('rejects content shorter than 50 chars', () => {
      const result = gate.validate('Short text here.', {});
      assert.equal(result.decision, 'reject');
      assert(result.message!.includes('min 50 chars'));
    });

    it('accepts content with 50+ chars', () => {
      const content = 'A'.repeat(60);
      const result = gate.validate(content, { tags: 'test', type: 'CONTEXT', source: 'test.md' });
      assert.notEqual(result.decision, 'reject');
    });
  });

  describe('validate — quality scoring', () => {
    it('gives higher score for longer content', () => {
      const short = gate.validate('A'.repeat(100), { tags: 'x', type: 'T', source: 's' });
      const long = gate.validate('A'.repeat(500), { tags: 'x', type: 'T', source: 's' });
      assert(long.score > short.score);
    });

    it('gives +20 for having tags', () => {
      const noTags = gate.validate('A'.repeat(200), { type: 'T', source: 's' });
      const withTags = gate.validate('A'.repeat(200), { tags: 'test,code', type: 'T', source: 's' });
      assert.equal(withTags.score - noTags.score, 20);
    });

    it('gives +10 for having type', () => {
      const noType = gate.validate('A'.repeat(200), { tags: 'x', source: 's' });
      const withType = gate.validate('A'.repeat(200), { tags: 'x', type: 'DECISION', source: 's' });
      assert.equal(withType.score - noType.score, 10);
    });

    it('gives +10 for having source', () => {
      const noSrc = gate.validate('A'.repeat(200), { tags: 'x', type: 'T' });
      const withSrc = gate.validate('A'.repeat(200), { tags: 'x', type: 'T', source: 'file.md' });
      assert.equal(withSrc.score - noSrc.score, 10);
    });

    it('gives +10 for structured content (headings/lists)', () => {
      const plain = 'A'.repeat(200);
      const structured = '# Heading\n- Item 1\n- Item 2\n' + 'A'.repeat(150);
      const r1 = gate.validate(plain, { tags: 'x', type: 'T', source: 's' });
      const r2 = gate.validate(structured, { tags: 'x', type: 'T', source: 's' });
      assert(r2.score > r1.score);
    });
  });

  describe('validate — duplicate detection', () => {
    it('detects near-duplicate content', () => {
      const content = 'This is a detailed knowledge entry about authentication patterns and security best practices for the application.';
      db.prepare(
        "INSERT INTO knowledge_entries (content, summary, type, archived) VALUES (?, 'test', 'CONTEXT', 0)"
      ).run(content);

      const result = gate.validate(content, { tags: 'x', type: 'T', source: 's' });
      assert.equal(result.duplicate_detected, true);
      assert.equal(result.decision, 'reject');
    });

    it('does not flag different content as duplicate', () => {
      db.prepare(
        "INSERT INTO knowledge_entries (content, summary, type, archived) VALUES (?, 'test', 'CONTEXT', 0)"
      ).run('Authentication patterns for web applications using OAuth2 and JWT tokens.');

      const result = gate.validate(
        'Database migration strategies for PostgreSQL including zero-downtime deployments and rollback procedures.',
        { tags: 'x', type: 'T', source: 's' }
      );
      assert.equal(result.duplicate_detected, false);
    });
  });

  describe('validate — decision thresholds', () => {
    it('rejects score < 30', () => {
      const result = gate.validate('A'.repeat(55), {});
      assert.equal(result.decision, 'reject');
      assert(result.score < 30);
    });

    it('warns for score 30-50', () => {
      const result = gate.validate('A'.repeat(150), { tags: 'test' });
      assert.equal(result.decision, 'warn');
    });

    it('accepts score >= 50', () => {
      const result = gate.validate('A'.repeat(500), { tags: 'test', type: 'DECISION', source: 'file.md' });
      assert.equal(result.decision, 'accept');
      assert(result.score >= 50);
    });
  });

  describe('custom thresholds', () => {
    it('respects custom minLength', () => {
      const customGate = new QualityGate(db, { minLength: 10 });
      const result = customGate.validate('Short text!', { tags: 'x', type: 'T', source: 's' });
      assert.notEqual(result.decision, 'reject');
    });

    it('respects custom reject threshold', () => {
      const customGate = new QualityGate(db, { rejectThreshold: 10 });
      const result = customGate.validate('A'.repeat(55), {});
      assert.equal(result.decision, 'reject');
    });
  });
});
