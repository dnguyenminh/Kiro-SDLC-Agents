"use strict";
/**
 * Unit tests for QualityGate — ingest validation.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const quality_gate_js_1 = require("../v2/quality-gate.js");
(0, node_test_1.describe)('QualityGate', () => {
    let db;
    let gate;
    (0, node_test_1.beforeEach)(() => {
        db = new better_sqlite3_1.default(':memory:');
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
        gate = new quality_gate_js_1.QualityGate(db);
    });
    (0, node_test_1.describe)('validate — content length', () => {
        (0, node_test_1.it)('rejects empty content', () => {
            const result = gate.validate('', {});
            strict_1.default.equal(result.decision, 'reject');
            strict_1.default.equal(result.score, 0);
            (0, strict_1.default)(result.message.includes('too short'));
        });
        (0, node_test_1.it)('rejects content shorter than 50 chars', () => {
            const result = gate.validate('Short text here.', {});
            strict_1.default.equal(result.decision, 'reject');
            (0, strict_1.default)(result.message.includes('min 50 chars'));
        });
        (0, node_test_1.it)('accepts content with 50+ chars', () => {
            const content = 'A'.repeat(60);
            const result = gate.validate(content, { tags: 'test', type: 'CONTEXT', source: 'test.md' });
            strict_1.default.notEqual(result.decision, 'reject');
        });
    });
    (0, node_test_1.describe)('validate — quality scoring', () => {
        (0, node_test_1.it)('gives higher score for longer content', () => {
            const short = gate.validate('A'.repeat(100), { tags: 'x', type: 'T', source: 's' });
            const long = gate.validate('A'.repeat(500), { tags: 'x', type: 'T', source: 's' });
            (0, strict_1.default)(long.score > short.score);
        });
        (0, node_test_1.it)('gives +20 for having tags', () => {
            const noTags = gate.validate('A'.repeat(200), { type: 'T', source: 's' });
            const withTags = gate.validate('A'.repeat(200), { tags: 'test,code', type: 'T', source: 's' });
            strict_1.default.equal(withTags.score - noTags.score, 20);
        });
        (0, node_test_1.it)('gives +10 for having type', () => {
            const noType = gate.validate('A'.repeat(200), { tags: 'x', source: 's' });
            const withType = gate.validate('A'.repeat(200), { tags: 'x', type: 'DECISION', source: 's' });
            strict_1.default.equal(withType.score - noType.score, 10);
        });
        (0, node_test_1.it)('gives +10 for having source', () => {
            const noSrc = gate.validate('A'.repeat(200), { tags: 'x', type: 'T' });
            const withSrc = gate.validate('A'.repeat(200), { tags: 'x', type: 'T', source: 'file.md' });
            strict_1.default.equal(withSrc.score - noSrc.score, 10);
        });
        (0, node_test_1.it)('gives +10 for structured content (headings/lists)', () => {
            const plain = 'A'.repeat(200);
            const structured = '# Heading\n- Item 1\n- Item 2\n' + 'A'.repeat(150);
            const r1 = gate.validate(plain, { tags: 'x', type: 'T', source: 's' });
            const r2 = gate.validate(structured, { tags: 'x', type: 'T', source: 's' });
            (0, strict_1.default)(r2.score > r1.score);
        });
    });
    (0, node_test_1.describe)('validate — duplicate detection', () => {
        (0, node_test_1.it)('detects near-duplicate content', () => {
            const content = 'This is a detailed knowledge entry about authentication patterns and security best practices for the application.';
            db.prepare("INSERT INTO knowledge_entries (content, summary, type, archived) VALUES (?, 'test', 'CONTEXT', 0)").run(content);
            const result = gate.validate(content, { tags: 'x', type: 'T', source: 's' });
            strict_1.default.equal(result.duplicate_detected, true);
            strict_1.default.equal(result.decision, 'reject');
        });
        (0, node_test_1.it)('does not flag different content as duplicate', () => {
            db.prepare("INSERT INTO knowledge_entries (content, summary, type, archived) VALUES (?, 'test', 'CONTEXT', 0)").run('Authentication patterns for web applications using OAuth2 and JWT tokens.');
            const result = gate.validate('Database migration strategies for PostgreSQL including zero-downtime deployments and rollback procedures.', { tags: 'x', type: 'T', source: 's' });
            strict_1.default.equal(result.duplicate_detected, false);
        });
    });
    (0, node_test_1.describe)('validate — decision thresholds', () => {
        (0, node_test_1.it)('rejects score < 30', () => {
            const result = gate.validate('A'.repeat(55), {});
            strict_1.default.equal(result.decision, 'reject');
            (0, strict_1.default)(result.score < 30);
        });
        (0, node_test_1.it)('warns for score 30-50', () => {
            const result = gate.validate('A'.repeat(150), { tags: 'test' });
            strict_1.default.equal(result.decision, 'warn');
        });
        (0, node_test_1.it)('accepts score >= 50', () => {
            const result = gate.validate('A'.repeat(500), { tags: 'test', type: 'DECISION', source: 'file.md' });
            strict_1.default.equal(result.decision, 'accept');
            (0, strict_1.default)(result.score >= 50);
        });
    });
    (0, node_test_1.describe)('custom thresholds', () => {
        (0, node_test_1.it)('respects custom minLength', () => {
            const customGate = new quality_gate_js_1.QualityGate(db, { minLength: 10 });
            const result = customGate.validate('Short text!', { tags: 'x', type: 'T', source: 's' });
            strict_1.default.notEqual(result.decision, 'reject');
        });
        (0, node_test_1.it)('respects custom reject threshold', () => {
            const customGate = new quality_gate_js_1.QualityGate(db, { rejectThreshold: 10 });
            const result = customGate.validate('A'.repeat(55), {});
            strict_1.default.equal(result.decision, 'reject');
        });
    });
});
//# sourceMappingURL=quality-gate.test.js.map