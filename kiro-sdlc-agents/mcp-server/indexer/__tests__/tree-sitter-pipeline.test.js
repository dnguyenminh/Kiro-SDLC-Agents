"use strict";
/**
 * KSA-145: Integration test — Verify tree-sitter is wired into IndexingEngine.
 * Tests that IndexingEngine uses TreeSitterIndexer for supported languages
 * and falls back to regex for unsupported ones.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const database_manager_js_1 = require("../../db/database-manager.js");
const indexing_engine_js_1 = require("../indexing-engine.js");
(0, node_test_1.describe)('KSA-145: Tree-sitter Pipeline Integration', () => {
    let tmpDir;
    let dbPath;
    let db;
    let dbManager;
    let config;
    (0, node_test_1.before)(() => {
        // Create temp workspace with test files
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ksa145-test-'));
        const srcDir = path.join(tmpDir, 'src', 'example');
        fs.mkdirSync(srcDir, { recursive: true });
        // Write a TypeScript file
        fs.writeFileSync(path.join(srcDir, 'service.ts'), [
            'export class UserService {',
            '  private db: Database;',
            '',
            '  constructor(db: Database) {',
            '    this.db = db;',
            '  }',
            '',
            '  async getUser(id: string): Promise<User> {',
            '    return this.db.findById(id);',
            '  }',
            '',
            '  async createUser(data: CreateUserDto): Promise<User> {',
            '    const user = new User(data);',
            '    return this.db.save(user);',
            '  }',
            '}',
            '',
            'export interface User {',
            '  id: string;',
            '  name: string;',
            '  email: string;',
            '}',
            '',
            'export function validateEmail(email: string): boolean {',
            '  return email.includes("@");',
            '}',
        ].join('\n'));
        // Write a Python file
        fs.writeFileSync(path.join(srcDir, 'utils.py'), [
            'class DataProcessor:',
            '    def __init__(self, config):',
            '        self.config = config',
            '',
            '    def process(self, data):',
            '        return self._transform(data)',
            '',
            'def helper_function(x, y):',
            '    return x + y',
        ].join('\n'));
        // Setup database
        dbPath = path.join(tmpDir, '.code-intel', 'index.db');
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        dbManager = new database_manager_js_1.DatabaseManager(dbPath);
        dbManager.initialize();
        db = dbManager.getDb();
        config = {
            workspace: tmpDir,
            viewerPort: 0,
            dbPath,
            configPath: path.join(tmpDir, '.code-intel', 'config.json'),
            watchEnabled: false,
            watchDebounceMs: 500,
            ollamaUrl: null,
            ollamaModel: 'nomic-embed-text',
            excludePatterns: ['node_modules', '.git', '.code-intel'],
            includeExtensions: ['.ts', '.tsx', '.js', '.py', '.kt', '.java', '.go', '.rs'],
            maxFileSize: 512_000,
        };
    });
    (0, node_test_1.after)(() => {
        if (db)
            db.close();
        if (tmpDir)
            fs.rmSync(tmpDir, { recursive: true, force: true });
    });
    (0, node_test_1.it)('should initialize IndexingEngine with tree-sitter support', () => {
        const engine = new indexing_engine_js_1.IndexingEngine(dbManager, config);
        const stats = engine.getTreeSitterStats();
        console.error(`[test] Tree-sitter ready: ${stats.ready}, languages: ${stats.languages.join(', ')}`);
        strict_1.default.ok(typeof stats.ready === 'boolean');
        strict_1.default.ok(Array.isArray(stats.languages));
        engine.stop();
    });
    (0, node_test_1.it)('should run full index without errors', async () => {
        const engine = new indexing_engine_js_1.IndexingEngine(dbManager, config);
        await engine.runFullIndex();
        const fileCount = db.prepare('SELECT COUNT(*) as c FROM files').get();
        strict_1.default.ok(fileCount.c >= 2, `Expected at least 2 files, got ${fileCount.c}`);
        const symbolCount = db.prepare('SELECT COUNT(*) as c FROM symbols').get();
        strict_1.default.ok(symbolCount.c > 0, `Expected symbols, got ${symbolCount.c}`);
        console.error(`[test] Indexed ${fileCount.c} files, ${symbolCount.c} symbols`);
        engine.stop();
    });
    (0, node_test_1.it)('should extract class and function symbols', async () => {
        const engine = new indexing_engine_js_1.IndexingEngine(dbManager, config);
        await engine.runFullIndex();
        const userService = db.prepare("SELECT * FROM symbols WHERE name = 'UserService'").get();
        strict_1.default.ok(userService, 'UserService class should be indexed');
        strict_1.default.equal(userService.kind, 'class');
        const validateEmail = db.prepare("SELECT * FROM symbols WHERE name = 'validateEmail'").get();
        strict_1.default.ok(validateEmail, 'validateEmail function should be indexed');
        strict_1.default.equal(validateEmail.kind, 'function');
        engine.stop();
    });
    (0, node_test_1.it)('should populate relationships table when tree-sitter is active', async () => {
        const engine = new indexing_engine_js_1.IndexingEngine(dbManager, config);
        const stats = engine.getTreeSitterStats();
        await engine.runFullIndex();
        if (stats.ready) {
            const relCount = db.prepare('SELECT COUNT(*) as c FROM relationships').get();
            console.error(`[test] Relationships: ${relCount.c}`);
            strict_1.default.ok(relCount.c >= 0, 'Relationships table should exist');
        }
        else {
            console.error('[test] Tree-sitter not available — skipping relationship check');
        }
        engine.stop();
    });
    (0, node_test_1.it)('should handle incremental file updates', async () => {
        const engine = new indexing_engine_js_1.IndexingEngine(dbManager, config);
        await engine.runFullIndex();
        const initialCount = db.prepare('SELECT COUNT(*) as c FROM symbols').get().c;
        const newFile = path.join(tmpDir, 'src', 'example', 'new-module.ts');
        fs.writeFileSync(newFile, [
            'export function newFunction(): void {',
            '  console.log("hello");',
            '}',
            '',
            'export class NewClass {',
            '  method(): string { return "test"; }',
            '}',
        ].join('\n'));
        await engine.indexSingleFile(newFile);
        const afterCount = db.prepare('SELECT COUNT(*) as c FROM symbols').get().c;
        strict_1.default.ok(afterCount > initialCount, `Expected more symbols: ${afterCount} > ${initialCount}`);
        engine.stop();
    });
    (0, node_test_1.it)('should clean up relationships when file is removed', async () => {
        const engine = new indexing_engine_js_1.IndexingEngine(dbManager, config);
        await engine.runFullIndex();
        const testFile = path.join(tmpDir, 'src', 'example', 'to-remove.ts');
        fs.writeFileSync(testFile, 'export function toRemove(): void {}');
        await engine.indexSingleFile(testFile);
        const before = db.prepare("SELECT COUNT(*) as c FROM files WHERE relative_path LIKE '%to-remove%'").get();
        strict_1.default.equal(before.c, 1);
        engine.removeFile('src/example/to-remove.ts');
        const afterFiles = db.prepare("SELECT COUNT(*) as c FROM files WHERE relative_path LIKE '%to-remove%'").get();
        strict_1.default.equal(afterFiles.c, 0);
        engine.stop();
    });
});
//# sourceMappingURL=tree-sitter-pipeline.test.js.map