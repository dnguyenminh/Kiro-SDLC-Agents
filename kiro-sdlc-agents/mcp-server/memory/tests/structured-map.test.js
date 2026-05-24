"use strict";
/**
 * Unit tests for Structured Map (F3: Entity Extraction + Metadata Enrichment).
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const structured_map_extractor_js_1 = require("../structured-map-extractor.js");
const entity_classifier_js_1 = require("../entity-classifier.js");
const entity_repo_js_1 = require("../entity-repo.js");
const knowledge_repo_js_1 = require("../knowledge-repo.js");
const schema_js_1 = require("../schema.js");
const migrations_v3_js_1 = require("../migrations-v3.js");
function createTestDb() {
    const db = new better_sqlite3_1.default(':memory:');
    db.exec(schema_js_1.MEMORY_SCHEMA);
    (0, migrations_v3_js_1.runV3Migrations)(db);
    return db;
}
(0, node_test_1.describe)('extractStructuredMap', () => {
    (0, node_test_1.it)('should extract topic from heading', () => {
        const map = (0, structured_map_extractor_js_1.extractStructuredMap)('# Authentication Flow\nDetails here');
        strict_1.default.equal(map.topic, 'Authentication Flow');
    });
    (0, node_test_1.it)('should extract topic from first line if no heading', () => {
        const map = (0, structured_map_extractor_js_1.extractStructuredMap)('This is about user login');
        strict_1.default.equal(map.topic, 'This is about user login');
    });
    (0, node_test_1.it)('should extract ticket IDs as entities', () => {
        const map = (0, structured_map_extractor_js_1.extractStructuredMap)('Related to KSA-111 and MTO-5');
        (0, strict_1.default)(map.entities_mentioned.includes('KSA-111'));
        (0, strict_1.default)(map.entities_mentioned.includes('MTO-5'));
    });
    (0, node_test_1.it)('should extract @mentions as entities', () => {
        const map = (0, structured_map_extractor_js_1.extractStructuredMap)('Assigned to @john-doe for review');
        (0, strict_1.default)(map.entities_mentioned.includes('@john-doe'));
    });
    (0, node_test_1.it)('should extract PascalCase class names', () => {
        const map = (0, structured_map_extractor_js_1.extractStructuredMap)('The CoreMemoryManager handles pinning');
        (0, strict_1.default)(map.entities_mentioned.includes('CoreMemoryManager'));
    });
    (0, node_test_1.it)('should extract decisions', () => {
        const map = (0, structured_map_extractor_js_1.extractStructuredMap)('Decision: Use SQLite for storage\nOther text');
        strict_1.default.equal(map.decisions_made.length, 1);
        strict_1.default.match(map.decisions_made[0], /SQLite/);
    });
    (0, node_test_1.it)('should extract action items', () => {
        const map = (0, structured_map_extractor_js_1.extractStructuredMap)('TODO: Add validation\n[ ] Write tests');
        strict_1.default.equal(map.action_items.length, 2);
    });
    (0, node_test_1.it)('should extract URLs as context refs', () => {
        const map = (0, structured_map_extractor_js_1.extractStructuredMap)('See https://example.com/docs for details');
        (0, strict_1.default)(map.context_refs.some(r => r.includes('example.com')));
    });
    (0, node_test_1.it)('should extract file paths as context refs', () => {
        const map = (0, structured_map_extractor_js_1.extractStructuredMap)('Modified src/memory/core-memory.ts');
        (0, strict_1.default)(map.context_refs.some(r => r.includes('src/memory/core-memory.ts')));
    });
    (0, node_test_1.it)('should detect positive sentiment', () => {
        const map = (0, structured_map_extractor_js_1.extractStructuredMap)('The fix works great, resolved successfully and improved performance');
        strict_1.default.equal(map.sentiment, 'positive');
    });
    (0, node_test_1.it)('should detect negative sentiment', () => {
        const map = (0, structured_map_extractor_js_1.extractStructuredMap)('Critical error: system crashed, bug in production');
        strict_1.default.equal(map.sentiment, 'negative');
    });
    (0, node_test_1.it)('should detect mixed sentiment', () => {
        const map = (0, structured_map_extractor_js_1.extractStructuredMap)('Fixed the bug but found another issue');
        strict_1.default.equal(map.sentiment, 'mixed');
    });
    (0, node_test_1.it)('should handle empty content', () => {
        const map = (0, structured_map_extractor_js_1.extractStructuredMap)('');
        strict_1.default.equal(map.topic, '');
        strict_1.default.equal(map.sentiment, 'neutral');
    });
});
(0, node_test_1.describe)('classifyEntity', () => {
    (0, node_test_1.it)('should classify ticket IDs', () => {
        strict_1.default.equal((0, entity_classifier_js_1.classifyEntity)('KSA-111'), 'ticket');
        strict_1.default.equal((0, entity_classifier_js_1.classifyEntity)('MTO-5'), 'ticket');
    });
    (0, node_test_1.it)('should classify @mentions as person', () => {
        strict_1.default.equal((0, entity_classifier_js_1.classifyEntity)('@john'), 'person');
    });
    (0, node_test_1.it)('should classify PascalCase as system', () => {
        strict_1.default.equal((0, entity_classifier_js_1.classifyEntity)('CoreMemoryManager'), 'system');
    });
    (0, node_test_1.it)('should classify file paths', () => {
        strict_1.default.equal((0, entity_classifier_js_1.classifyEntity)('src/memory/core.ts'), 'file');
    });
    (0, node_test_1.it)('should default to concept', () => {
        strict_1.default.equal((0, entity_classifier_js_1.classifyEntity)('authentication'), 'concept');
    });
});
(0, node_test_1.describe)('EntityRepository', () => {
    let db;
    let repo;
    (0, node_test_1.beforeEach)(() => {
        db = createTestDb();
        repo = new entity_repo_js_1.EntityRepository(db);
        // Insert a test entry
        db.prepare(`INSERT INTO knowledge_entries (content, summary, type, tier, tags, confidence)
       VALUES ('test', 'test', 'CONTEXT', 'WORKING', '', 1.0)`).run();
    });
    (0, node_test_1.it)('should index and retrieve entities', () => {
        repo.indexEntities(1, [
            { name: 'KSA-111', type: 'ticket' },
            { name: 'CoreMemory', type: 'system' },
        ]);
        const entities = repo.getEntities(1);
        strict_1.default.equal(entities.length, 2);
    });
    (0, node_test_1.it)('should find entries by entity name', () => {
        repo.indexEntities(1, [{ name: 'KSA-111', type: 'ticket' }]);
        const ids = repo.findByEntity('KSA-111');
        strict_1.default.deepEqual(ids, [1]);
    });
    (0, node_test_1.it)('should find entries by entity type', () => {
        repo.indexEntities(1, [{ name: 'KSA-111', type: 'ticket' }]);
        const ids = repo.findByType('ticket');
        strict_1.default.deepEqual(ids, [1]);
    });
    (0, node_test_1.it)('should replace entities on re-index', () => {
        repo.indexEntities(1, [{ name: 'old', type: 'concept' }]);
        repo.indexEntities(1, [{ name: 'new', type: 'concept' }]);
        const entities = repo.getEntities(1);
        strict_1.default.equal(entities.length, 1);
        strict_1.default.equal(entities[0].entity_name, 'new');
    });
});
(0, node_test_1.describe)('KnowledgeRepository.structuredMap', () => {
    let db;
    let repo;
    (0, node_test_1.beforeEach)(() => {
        db = createTestDb();
        repo = new knowledge_repo_js_1.KnowledgeRepository(db);
    });
    (0, node_test_1.it)('should store and retrieve structured map', () => {
        const id = repo.insert({ content: 'test', summary: 'test', type: 'CONTEXT' });
        const map = JSON.stringify({ topic: 'test', entities_mentioned: [] });
        repo.updateStructuredMap(id, map);
        const result = repo.getStructuredMap(id);
        strict_1.default.equal(result, map);
    });
    (0, node_test_1.it)('should return empty JSON for new entries', () => {
        const id = repo.insert({ content: 'test', summary: 'test', type: 'CONTEXT' });
        const result = repo.getStructuredMap(id);
        strict_1.default.equal(result, '{}');
    });
});
//# sourceMappingURL=structured-map.test.js.map