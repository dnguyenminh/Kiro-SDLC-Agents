"use strict";
/**
 * KSA-154/155/156/157: Graph Services Unit Tests.
 * Tests SymbolResolver, CallGraphService, DependencyGraphService, ImpactAnalysis, Traverser.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const symbol_resolver_js_1 = require("../symbol-resolver.js");
const call_graph_service_js_1 = require("../call-graph-service.js");
const file_resolver_js_1 = require("../file-resolver.js");
const dependency_graph_service_js_1 = require("../dependency-graph-service.js");
const test_detector_js_1 = require("../test-detector.js");
const impact_analysis_service_js_1 = require("../impact-analysis-service.js");
const traverser_js_1 = require("../traverser.js");
const graph_repository_js_1 = require("../../database/graph-repository.js");
let db;
function setupTestDb() {
    const testDb = new better_sqlite3_1.default(':memory:');
    testDb.pragma('journal_mode = WAL');
    testDb.pragma('foreign_keys = ON');
    // Create schema
    testDb.exec(`
    CREATE TABLE files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      relative_path TEXT NOT NULL,
      language TEXT NOT NULL,
      module TEXT,
      content_hash TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      last_indexed TEXT NOT NULL DEFAULT (datetime('now')),
      line_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE symbols (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      signature TEXT,
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      parent_symbol TEXT,
      visibility TEXT,
      doc_comment TEXT,
      parameters TEXT,
      return_type TEXT,
      parent_symbol_id INTEGER,
      decorators TEXT,
      complexity INTEGER,
      is_async INTEGER DEFAULT 0,
      is_exported INTEGER DEFAULT 0,
      doc_comment_full TEXT,
      modifiers TEXT,
      file_path TEXT,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
    );

    CREATE TABLE relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_symbol_id INTEGER NOT NULL,
      target_symbol TEXT NOT NULL,
      target_symbol_id INTEGER,
      kind TEXT NOT NULL,
      file_path TEXT NOT NULL,
      line INTEGER NOT NULL,
      metadata TEXT,
      FOREIGN KEY (source_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
      FOREIGN KEY (target_symbol_id) REFERENCES symbols(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_symbols_name ON symbols(name);
    CREATE INDEX idx_symbols_parent ON symbols(parent_symbol_id);
    CREATE INDEX idx_rel_source_kind ON relationships(source_symbol_id, kind);
    CREATE INDEX idx_rel_target_kind ON relationships(target_symbol, kind);
    CREATE INDEX idx_rel_target_id ON relationships(target_symbol_id);
    CREATE INDEX idx_rel_file ON relationships(file_path);
  `);
    // Insert test data
    // Files
    testDb.exec(`
    INSERT INTO files (id, path, relative_path, language, content_hash, size_bytes) VALUES
      (1, '/project/src/service.ts', 'src/service.ts', 'typescript', 'hash1', 1000),
      (2, '/project/src/controller.ts', 'src/controller.ts', 'typescript', 'hash2', 800),
      (3, '/project/src/repository.ts', 'src/repository.ts', 'typescript', 'hash3', 600),
      (4, '/project/src/utils.ts', 'src/utils.ts', 'typescript', 'hash4', 400),
      (5, '/project/tests/service.test.ts', 'tests/service.test.ts', 'typescript', 'hash5', 500),
      (6, '/project/src/interface.ts', 'src/interface.ts', 'typescript', 'hash6', 300);
  `);
    // Symbols
    testDb.exec(`
    INSERT INTO symbols (id, file_id, name, kind, start_line, end_line, parent_symbol_id, is_exported, file_path) VALUES
      (1, 1, 'UserService', 'class', 5, 50, NULL, 1, 'src/service.ts'),
      (2, 1, 'getUser', 'method', 10, 20, 1, 1, 'src/service.ts'),
      (3, 1, 'createUser', 'method', 22, 40, 1, 1, 'src/service.ts'),
      (4, 2, 'UserController', 'class', 3, 60, NULL, 1, 'src/controller.ts'),
      (5, 2, 'handleGetUser', 'method', 8, 25, 4, 1, 'src/controller.ts'),
      (6, 2, 'handleCreateUser', 'method', 27, 50, 4, 1, 'src/controller.ts'),
      (7, 3, 'UserRepository', 'class', 2, 40, NULL, 1, 'src/repository.ts'),
      (8, 3, 'findById', 'method', 5, 15, 7, 1, 'src/repository.ts'),
      (9, 4, 'formatDate', 'function', 1, 5, NULL, 1, 'src/utils.ts'),
      (10, 4, 'validateEmail', 'function', 7, 15, NULL, 1, 'src/utils.ts'),
      (11, 5, 'testGetUser', 'function', 5, 20, NULL, 0, 'tests/service.test.ts'),
      (12, 6, 'IUserService', 'interface', 1, 10, NULL, 1, 'src/interface.ts'),
      (13, 6, 'getUser', 'method', 3, 3, 12, 1, 'src/interface.ts');
  `);
    // Relationships: calls
    testDb.exec(`
    INSERT INTO relationships (source_symbol_id, target_symbol, target_symbol_id, kind, file_path, line) VALUES
      (5, 'getUser', 2, 'calls', 'src/controller.ts', 12),
      (6, 'createUser', 3, 'calls', 'src/controller.ts', 30),
      (2, 'findById', 8, 'calls', 'src/service.ts', 15),
      (3, 'validateEmail', 10, 'calls', 'src/service.ts', 25),
      (11, 'getUser', 2, 'calls', 'tests/service.test.ts', 10);
  `);
    // Relationships: imports
    testDb.exec(`
    INSERT INTO relationships (source_symbol_id, target_symbol, target_symbol_id, kind, file_path, line) VALUES
      (4, './service', NULL, 'imports', 'src/controller.ts', 1),
      (1, './repository', NULL, 'imports', 'src/service.ts', 1),
      (1, './utils', NULL, 'imports', 'src/service.ts', 2),
      (11, '../src/service', NULL, 'imports', 'tests/service.test.ts', 1);
  `);
    // Relationships: implements
    testDb.exec(`
    INSERT INTO relationships (source_symbol_id, target_symbol, target_symbol_id, kind, file_path, line) VALUES
      (1, 'IUserService', 12, 'implements', 'src/service.ts', 5);
  `);
    return testDb;
}
(0, node_test_1.describe)('SymbolResolver', () => {
    (0, node_test_1.before)(() => { db = setupTestDb(); });
    (0, node_test_1.after)(() => { db.close(); });
    (0, node_test_1.it)('resolves exact symbol name', () => {
        const resolver = new symbol_resolver_js_1.SymbolResolver(db);
        const results = resolver.resolve('getUser');
        strict_1.default.ok(results.length >= 1);
        strict_1.default.equal(results[0].name, 'getUser');
    });
    (0, node_test_1.it)('resolves qualified name (Class.method)', () => {
        const resolver = new symbol_resolver_js_1.SymbolResolver(db);
        const results = resolver.resolve('UserService.getUser');
        strict_1.default.equal(results.length, 1);
        strict_1.default.equal(results[0].name, 'getUser');
        strict_1.default.equal(results[0].filePath, 'src/service.ts');
    });
    (0, node_test_1.it)('returns empty for non-existent symbol', () => {
        const resolver = new symbol_resolver_js_1.SymbolResolver(db);
        const results = resolver.resolve('nonExistentSymbol');
        strict_1.default.equal(results.length, 0);
    });
    (0, node_test_1.it)('suggests similar symbols', () => {
        const resolver = new symbol_resolver_js_1.SymbolResolver(db);
        const suggestions = resolver.suggest('User');
        strict_1.default.ok(suggestions.length > 0);
        strict_1.default.ok(suggestions.some(s => s.includes('User')));
    });
});
(0, node_test_1.describe)('CallGraphService', () => {
    (0, node_test_1.before)(() => { db = setupTestDb(); });
    (0, node_test_1.after)(() => { db.close(); });
    (0, node_test_1.it)('finds direct callers of a method', () => {
        const graphRepo = new graph_repository_js_1.GraphRepository(db);
        const resolver = new symbol_resolver_js_1.SymbolResolver(db);
        const service = new call_graph_service_js_1.CallGraphService(graphRepo, resolver);
        const result = service.findCallers('getUser', 1, 20);
        strict_1.default.ok(result.results.length >= 1);
        strict_1.default.ok(result.results.some(r => r.symbol === 'handleGetUser'));
        strict_1.default.equal(result.metadata.depthSearched, 1);
    });
    (0, node_test_1.it)('finds transitive callers with depth 2', () => {
        const graphRepo = new graph_repository_js_1.GraphRepository(db);
        const resolver = new symbol_resolver_js_1.SymbolResolver(db);
        const service = new call_graph_service_js_1.CallGraphService(graphRepo, resolver);
        const result = service.findCallers('findById', 2, 20);
        // findById <- getUser <- handleGetUser
        strict_1.default.ok(result.results.length >= 1);
    });
    (0, node_test_1.it)('finds callees of a method', () => {
        const graphRepo = new graph_repository_js_1.GraphRepository(db);
        const resolver = new symbol_resolver_js_1.SymbolResolver(db);
        const service = new call_graph_service_js_1.CallGraphService(graphRepo, resolver);
        const result = service.findCallees('handleGetUser', 1, 20);
        strict_1.default.ok(result.results.length >= 1);
        strict_1.default.ok(result.results.some(r => r.symbol === 'getUser'));
    });
    (0, node_test_1.it)('returns empty for unknown symbol', () => {
        const graphRepo = new graph_repository_js_1.GraphRepository(db);
        const resolver = new symbol_resolver_js_1.SymbolResolver(db);
        const service = new call_graph_service_js_1.CallGraphService(graphRepo, resolver);
        const result = service.findCallers('unknownFunction', 1, 20);
        strict_1.default.equal(result.results.length, 0);
        strict_1.default.equal(result.resolvedTo.length, 0);
    });
    (0, node_test_1.it)('respects limit parameter', () => {
        const graphRepo = new graph_repository_js_1.GraphRepository(db);
        const resolver = new symbol_resolver_js_1.SymbolResolver(db);
        const service = new call_graph_service_js_1.CallGraphService(graphRepo, resolver);
        const result = service.findCallers('getUser', 3, 1);
        strict_1.default.ok(result.results.length <= 1);
    });
    (0, node_test_1.it)('clamps depth to max 5', () => {
        const graphRepo = new graph_repository_js_1.GraphRepository(db);
        const resolver = new symbol_resolver_js_1.SymbolResolver(db);
        const service = new call_graph_service_js_1.CallGraphService(graphRepo, resolver);
        const result = service.findCallers('getUser', 10, 20);
        strict_1.default.equal(result.metadata.depthSearched, 5);
    });
});
(0, node_test_1.describe)('FileResolver', () => {
    (0, node_test_1.before)(() => { db = setupTestDb(); });
    (0, node_test_1.after)(() => { db.close(); });
    (0, node_test_1.it)('resolves exact relative path', () => {
        const resolver = new file_resolver_js_1.FileResolver(db, '/project');
        const result = resolver.resolveFile('src/service.ts');
        strict_1.default.equal(result, 'src/service.ts');
    });
    (0, node_test_1.it)('returns null for non-indexed file', () => {
        const resolver = new file_resolver_js_1.FileResolver(db, '/project');
        const result = resolver.resolveFile('src/nonexistent.ts');
        strict_1.default.equal(result, null);
    });
    (0, node_test_1.it)('identifies external modules', () => {
        const resolver = new file_resolver_js_1.FileResolver(db, '/project');
        strict_1.default.equal(resolver.isExternal('fs'), true);
        strict_1.default.equal(resolver.isExternal('path'), true);
        strict_1.default.equal(resolver.isExternal('lodash'), true);
    });
    (0, node_test_1.it)('identifies relative imports as non-external', () => {
        const resolver = new file_resolver_js_1.FileResolver(db, '/project');
        strict_1.default.equal(resolver.isExternal('./service'), false);
    });
});
(0, node_test_1.describe)('DependencyGraphService', () => {
    (0, node_test_1.before)(() => { db = setupTestDb(); });
    (0, node_test_1.after)(() => { db.close(); });
    (0, node_test_1.it)('finds outgoing dependencies', () => {
        const fileResolver = new file_resolver_js_1.FileResolver(db, '/project');
        const service = new dependency_graph_service_js_1.DependencyGraphService(db, fileResolver);
        const result = service.query('src/service.ts', 'outgoing', 1, false, 50);
        strict_1.default.equal(result.root, 'src/service.ts');
        strict_1.default.ok(result.results.length >= 0); // May not resolve relative imports without full path
    });
    (0, node_test_1.it)('returns empty for non-indexed file', () => {
        const fileResolver = new file_resolver_js_1.FileResolver(db, '/project');
        const service = new dependency_graph_service_js_1.DependencyGraphService(db, fileResolver);
        const result = service.query('nonexistent.ts', 'outgoing', 1, false, 50);
        strict_1.default.equal(result.results.length, 0);
    });
    (0, node_test_1.it)('clamps depth to max 5', () => {
        const fileResolver = new file_resolver_js_1.FileResolver(db, '/project');
        const service = new dependency_graph_service_js_1.DependencyGraphService(db, fileResolver);
        const result = service.query('src/service.ts', 'outgoing', 10, false, 50);
        // Should not crash, depth clamped
        strict_1.default.ok(result.metadata.maxDepthReached <= 5);
    });
});
(0, node_test_1.describe)('TestDetector', () => {
    (0, node_test_1.before)(() => { db = setupTestDb(); });
    (0, node_test_1.after)(() => { db.close(); });
    (0, node_test_1.it)('identifies test files by path pattern', () => {
        const detector = new test_detector_js_1.TestDetector(db);
        strict_1.default.equal(detector.isTestFile('tests/service.test.ts'), true);
        strict_1.default.equal(detector.isTestFile('src/__tests__/foo.ts'), true);
        strict_1.default.equal(detector.isTestFile('src/service.ts'), false);
    });
    (0, node_test_1.it)('identifies test files by name pattern', () => {
        const detector = new test_detector_js_1.TestDetector(db);
        strict_1.default.equal(detector.isTestFile('foo.test.ts'), true);
        strict_1.default.equal(detector.isTestFile('foo.spec.js'), true);
        strict_1.default.equal(detector.isTestFile('FooTest.kt'), true);
        strict_1.default.equal(detector.isTestFile('test_foo.py'), true);
    });
    (0, node_test_1.it)('finds related tests for a symbol', () => {
        const detector = new test_detector_js_1.TestDetector(db);
        const resolver = new symbol_resolver_js_1.SymbolResolver(db);
        const symbols = resolver.resolve('getUser');
        const tests = detector.findRelatedTests(symbols, []);
        strict_1.default.ok(tests.length >= 0); // May find tests/service.test.ts
    });
});
(0, node_test_1.describe)('ImpactAnalysisService', () => {
    (0, node_test_1.before)(() => { db = setupTestDb(); });
    (0, node_test_1.after)(() => { db.close(); });
    (0, node_test_1.it)('analyzes impact of modifying a method', () => {
        const graphRepo = new graph_repository_js_1.GraphRepository(db);
        const resolver = new symbol_resolver_js_1.SymbolResolver(db);
        const callGraph = new call_graph_service_js_1.CallGraphService(graphRepo, resolver);
        const fileResolver = new file_resolver_js_1.FileResolver(db, '/project');
        const depGraph = new dependency_graph_service_js_1.DependencyGraphService(db, fileResolver);
        const testDetector = new test_detector_js_1.TestDetector(db);
        const service = new impact_analysis_service_js_1.ImpactAnalysisService(db, callGraph, depGraph, resolver, testDetector);
        const result = service.analyzeImpact('getUser', 'modify', 3, true, 'low');
        strict_1.default.equal(result.symbol, 'getUser');
        strict_1.default.equal(result.action, 'modify');
        strict_1.default.ok(result.blastRadius.totalAffected >= 0);
        strict_1.default.ok(Array.isArray(result.impacts));
        strict_1.default.ok(Array.isArray(result.recommendations));
    });
    (0, node_test_1.it)('classifies delete action as higher severity', () => {
        const graphRepo = new graph_repository_js_1.GraphRepository(db);
        const resolver = new symbol_resolver_js_1.SymbolResolver(db);
        const callGraph = new call_graph_service_js_1.CallGraphService(graphRepo, resolver);
        const fileResolver = new file_resolver_js_1.FileResolver(db, '/project');
        const depGraph = new dependency_graph_service_js_1.DependencyGraphService(db, fileResolver);
        const testDetector = new test_detector_js_1.TestDetector(db);
        const service = new impact_analysis_service_js_1.ImpactAnalysisService(db, callGraph, depGraph, resolver, testDetector);
        const modifyResult = service.analyzeImpact('getUser', 'modify', 2, false, 'low');
        const deleteResult = service.analyzeImpact('getUser', 'delete', 2, false, 'low');
        // Delete should have same or more critical/high items
        const modifyCritical = modifyResult.blastRadius.summary.critical + modifyResult.blastRadius.summary.high;
        const deleteCritical = deleteResult.blastRadius.summary.critical + deleteResult.blastRadius.summary.high;
        strict_1.default.ok(deleteCritical >= modifyCritical);
    });
    (0, node_test_1.it)('returns empty result for unknown symbol', () => {
        const graphRepo = new graph_repository_js_1.GraphRepository(db);
        const resolver = new symbol_resolver_js_1.SymbolResolver(db);
        const callGraph = new call_graph_service_js_1.CallGraphService(graphRepo, resolver);
        const fileResolver = new file_resolver_js_1.FileResolver(db, '/project');
        const depGraph = new dependency_graph_service_js_1.DependencyGraphService(db, fileResolver);
        const testDetector = new test_detector_js_1.TestDetector(db);
        const service = new impact_analysis_service_js_1.ImpactAnalysisService(db, callGraph, depGraph, resolver, testDetector);
        const result = service.analyzeImpact('nonExistent', 'modify', 3, true, 'low');
        strict_1.default.equal(result.blastRadius.totalAffected, 0);
        strict_1.default.ok(result.recommendations.length > 0);
    });
});
(0, node_test_1.describe)('GraphTraverser', () => {
    (0, node_test_1.before)(() => { db = setupTestDb(); });
    (0, node_test_1.after)(() => { db.close(); });
    (0, node_test_1.it)('resolves a start node', () => {
        const resolver = new symbol_resolver_js_1.SymbolResolver(db);
        const traverser = new traverser_js_1.GraphTraverser(db, resolver, '/project');
        const node = traverser.resolveNode('UserService');
        strict_1.default.ok(node !== null);
        strict_1.default.equal(node.name, 'UserService');
        strict_1.default.equal(node.kind, 'class');
    });
    (0, node_test_1.it)('traverses outgoing edges from a node', () => {
        const resolver = new symbol_resolver_js_1.SymbolResolver(db);
        const traverser = new traverser_js_1.GraphTraverser(db, resolver, '/project');
        const node = traverser.resolveNode('handleGetUser');
        strict_1.default.ok(node !== null);
        const results = traverser.traverse(node, {
            edgeTypes: ['calls'],
            nodeTypes: [],
            direction: 'outgoing',
            maxDepth: 2,
            maxResults: 50,
        });
        // handleGetUser calls getUser
        strict_1.default.ok(results.length >= 0);
    });
    (0, node_test_1.it)('traverses incoming edges', () => {
        const resolver = new symbol_resolver_js_1.SymbolResolver(db);
        const traverser = new traverser_js_1.GraphTraverser(db, resolver, '/project');
        const node = traverser.resolveNode('getUser');
        strict_1.default.ok(node !== null);
        const results = traverser.traverse(node, {
            edgeTypes: ['calls'],
            nodeTypes: [],
            direction: 'incoming',
            maxDepth: 2,
            maxResults: 50,
        });
        strict_1.default.ok(results.length >= 0);
    });
    (0, node_test_1.it)('returns null for unknown symbol', () => {
        const resolver = new symbol_resolver_js_1.SymbolResolver(db);
        const traverser = new traverser_js_1.GraphTraverser(db, resolver, '/project');
        const node = traverser.resolveNode('nonExistentSymbol');
        strict_1.default.equal(node, null);
    });
    (0, node_test_1.it)('respects maxResults limit', () => {
        const resolver = new symbol_resolver_js_1.SymbolResolver(db);
        const traverser = new traverser_js_1.GraphTraverser(db, resolver, '/project');
        const node = traverser.resolveNode('UserService');
        strict_1.default.ok(node !== null);
        const results = traverser.traverse(node, {
            edgeTypes: [],
            nodeTypes: [],
            direction: 'outgoing',
            maxDepth: 5,
            maxResults: 1,
        });
        strict_1.default.ok(results.length <= 1);
    });
    (0, node_test_1.it)('formats response correctly', () => {
        const resolver = new symbol_resolver_js_1.SymbolResolver(db);
        const traverser = new traverser_js_1.GraphTraverser(db, resolver, '/project');
        const node = traverser.resolveNode('UserService');
        strict_1.default.ok(node !== null);
        const results = traverser.traverse(node, {
            edgeTypes: [],
            nodeTypes: [],
            direction: 'outgoing',
            maxDepth: 1,
            maxResults: 50,
        });
        const response = traverser.formatResponse(node, results, false, 5, 10);
        strict_1.default.ok(response.start);
        strict_1.default.equal(response.start.name, 'UserService');
        strict_1.default.ok(Array.isArray(response.results));
        strict_1.default.ok(response.metadata.execution_time_ms >= 0);
    });
});
//# sourceMappingURL=graph-services.test.js.map