"use strict";
/**
 * Unit tests for AgentScopeFilter — tag-based KB isolation.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const agent_scope_filter_js_1 = require("../v2/agent-scope-filter.js");
function makeEntry(id, tags) {
    return {
        id, content: 'test', summary: 'test', type: 'CONTEXT', tier: 'WORKING',
        source: null, source_ref: null, tags, confidence: 1, access_count: 0,
        created_at: '', updated_at: '', last_accessed_at: null, expires_at: null,
    };
}
function makeResult(id, tags) {
    return { entry: makeEntry(id, tags), score: 1.0, matchType: 'hybrid' };
}
(0, node_test_1.describe)('AgentScopeFilter', () => {
    let db;
    let filter;
    (0, node_test_1.beforeEach)(() => {
        db = new better_sqlite3_1.default(':memory:');
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
        filter = new agent_scope_filter_js_1.AgentScopeFilter(db);
    });
    (0, node_test_1.describe)('getScope', () => {
        (0, node_test_1.it)('returns scope for known role', () => {
            const scope = filter.getScope('QA');
            (0, strict_1.default)(scope !== null);
            strict_1.default.equal(scope.role, 'QA');
            (0, strict_1.default)(scope.tags.includes('testing'));
        });
        (0, node_test_1.it)('returns null for unknown role', () => {
            strict_1.default.equal(filter.getScope('UNKNOWN'), null);
        });
        (0, node_test_1.it)('is case-insensitive', () => {
            const scope = filter.getScope('qa');
            (0, strict_1.default)(scope !== null);
            strict_1.default.equal(scope.role, 'QA');
        });
    });
    (0, node_test_1.describe)('filter', () => {
        (0, node_test_1.it)('filters results to matching tags only', () => {
            const results = [
                makeResult(1, 'testing, qa'),
                makeResult(2, 'code, api'),
                makeResult(3, 'testing'),
            ];
            const filtered = filter.filter(results, 'QA');
            strict_1.default.equal(filtered.length, 2);
            strict_1.default.deepEqual(filtered.map(r => r.entry.id), [1, 3]);
        });
        (0, node_test_1.it)('keeps untagged entries visible to all (BR-F4-02)', () => {
            const results = [
                makeResult(1, 'testing'),
                makeResult(2, ''), // untagged
                makeResult(3, 'code'),
            ];
            const filtered = filter.filter(results, 'QA');
            strict_1.default.equal(filtered.length, 2);
            strict_1.default.deepEqual(filtered.map(r => r.entry.id), [1, 2]);
        });
        (0, node_test_1.it)('returns all results for unknown role (no filtering)', () => {
            const results = [makeResult(1, 'testing'), makeResult(2, 'code')];
            const filtered = filter.filter(results, 'UNKNOWN');
            strict_1.default.equal(filtered.length, 2);
        });
        (0, node_test_1.it)('handles entries with multiple matching tags', () => {
            const results = [makeResult(1, 'testing, code, qa')];
            const filtered = filter.filter(results, 'QA');
            strict_1.default.equal(filtered.length, 1);
        });
    });
    (0, node_test_1.describe)('updateScope', () => {
        (0, node_test_1.it)('updates existing scope', () => {
            filter.updateScope('QA', ['testing', 'qa', 'e2e']);
            const scope = filter.getScope('QA');
            (0, strict_1.default)(scope.tags.includes('e2e'));
            (0, strict_1.default)(!scope.tags.includes('bug'));
        });
        (0, node_test_1.it)('creates new scope for unknown role', () => {
            filter.updateScope('PM', ['planning', 'roadmap']);
            const scope = filter.getScope('PM');
            (0, strict_1.default)(scope !== null);
            strict_1.default.deepEqual(scope.tags, ['planning', 'roadmap']);
        });
    });
});
//# sourceMappingURL=agent-scope-filter.test.js.map