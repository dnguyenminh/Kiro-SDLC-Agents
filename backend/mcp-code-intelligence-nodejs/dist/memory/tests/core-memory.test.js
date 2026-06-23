"use strict";
/**
 * Unit tests for CoreMemoryManager (F1: Core/Archival Memory).
 * Uses Node.js built-in test runner.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const core_memory_js_1 = require("../core-memory.js");
const schema_js_1 = require("../schema.js");
const migrations_v3_js_1 = require("../migrations-v3.js");
function createTestDb() {
    const db = new better_sqlite3_1.default(':memory:');
    db.exec(schema_js_1.MEMORY_SCHEMA);
    (0, migrations_v3_js_1.runV3Migrations)(db);
    return db;
}
function insertEntry(db, content, summary) {
    const stmt = db.prepare(`INSERT INTO knowledge_entries (content, summary, type, tier, tags, confidence)
     VALUES (?, ?, 'CONTEXT', 'WORKING', '', 1.0)`);
    const result = stmt.run(content, summary ?? content.slice(0, 60));
    return result.lastInsertRowid;
}
(0, node_test_1.describe)('CoreMemoryManager', () => {
    let db;
    let cm;
    (0, node_test_1.beforeEach)(() => {
        db = createTestDb();
        cm = new core_memory_js_1.CoreMemoryManager(db);
    });
    (0, node_test_1.describe)('pin', () => {
        (0, node_test_1.it)('should pin an existing entry', () => {
            const id = insertEntry(db, 'Important context about the project');
            const result = cm.pin(id);
            strict_1.default.match(result, /Pinned entry/);
        });
        (0, node_test_1.it)('should reject pinning non-existent entry', () => {
            const result = cm.pin(999);
            strict_1.default.match(result, /not found/);
        });
        (0, node_test_1.it)('should reject double-pinning', () => {
            const id = insertEntry(db, 'Test content');
            cm.pin(id);
            const result = cm.pin(id);
            strict_1.default.match(result, /already pinned/);
        });
        (0, node_test_1.it)('should enforce max pinned entries limit', () => {
            const smallCm = new core_memory_js_1.CoreMemoryManager(db, { maxPinnedEntries: 2, maxTokens: 5000, warningThreshold: 4500 });
            const id1 = insertEntry(db, 'Entry 1');
            const id2 = insertEntry(db, 'Entry 2');
            const id3 = insertEntry(db, 'Entry 3');
            smallCm.pin(id1);
            smallCm.pin(id2);
            const result = smallCm.pin(id3);
            strict_1.default.match(result, /max pinned entries/);
        });
        (0, node_test_1.it)('should enforce token budget', () => {
            const tightCm = new core_memory_js_1.CoreMemoryManager(db, { maxTokens: 10, warningThreshold: 8, maxPinnedEntries: 10 });
            const longContent = 'x'.repeat(200); // ~50 tokens
            const id = insertEntry(db, longContent, longContent);
            const result = tightCm.pin(id);
            strict_1.default.match(result, /remaining in budget/);
        });
    });
    (0, node_test_1.describe)('unpin', () => {
        (0, node_test_1.it)('should unpin a pinned entry', () => {
            const id = insertEntry(db, 'Test');
            cm.pin(id);
            const result = cm.unpin(id);
            strict_1.default.match(result, /Unpinned/);
        });
        (0, node_test_1.it)('should reject unpinning non-pinned entry', () => {
            const id = insertEntry(db, 'Test');
            const result = cm.unpin(id);
            strict_1.default.match(result, /not pinned/);
        });
    });
    (0, node_test_1.describe)('listPinned', () => {
        (0, node_test_1.it)('should return empty array when nothing pinned', () => {
            const list = cm.listPinned();
            strict_1.default.equal(list.length, 0);
        });
        (0, node_test_1.it)('should return pinned entries in order', () => {
            const id1 = insertEntry(db, 'First entry', 'First');
            const id2 = insertEntry(db, 'Second entry', 'Second');
            cm.pin(id1);
            cm.pin(id2);
            const list = cm.listPinned();
            strict_1.default.equal(list.length, 2);
            strict_1.default.equal(list[0].id, id1);
            strict_1.default.equal(list[1].id, id2);
            (0, strict_1.default)(list[0].pin_order < list[1].pin_order);
        });
    });
    (0, node_test_1.describe)('reorder', () => {
        (0, node_test_1.it)('should change pin order', () => {
            const id1 = insertEntry(db, 'First');
            const id2 = insertEntry(db, 'Second');
            cm.pin(id1);
            cm.pin(id2);
            cm.reorder(id2, 0); // move second to front
            const list = cm.listPinned();
            strict_1.default.equal(list[0].id, id2);
        });
    });
    (0, node_test_1.describe)('getContext', () => {
        (0, node_test_1.it)('should return empty string when nothing pinned', () => {
            strict_1.default.equal(cm.getContext(), '');
        });
        (0, node_test_1.it)('should return formatted context with pinned entries', () => {
            const id = insertEntry(db, 'Project uses TypeScript', 'Project uses TypeScript');
            cm.pin(id);
            const ctx = cm.getContext();
            strict_1.default.match(ctx, /PINNED CONTEXT/);
            strict_1.default.match(ctx, /Project uses TypeScript/);
            strict_1.default.match(ctx, /END PINNED/);
        });
    });
    (0, node_test_1.describe)('getBudgetStatus', () => {
        (0, node_test_1.it)('should report zero usage when nothing pinned', () => {
            const status = cm.getBudgetStatus();
            strict_1.default.equal(status.used, 0);
            strict_1.default.equal(status.max, 2000);
            strict_1.default.equal(status.remaining, 2000);
            strict_1.default.equal(status.warning, false);
        });
        (0, node_test_1.it)('should track token usage', () => {
            const content = 'a'.repeat(400); // ~100 tokens
            const id = insertEntry(db, content, content);
            cm.pin(id);
            const status = cm.getBudgetStatus();
            (0, strict_1.default)(status.used > 0);
            (0, strict_1.default)(status.remaining < 2000);
        });
    });
});
//# sourceMappingURL=core-memory.test.js.map