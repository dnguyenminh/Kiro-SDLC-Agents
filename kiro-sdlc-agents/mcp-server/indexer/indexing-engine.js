"use strict";
/**
 * Indexing Engine — Full scan and incremental indexing.
 * Coordinates file scanning, symbol extraction, and database updates.
 * KSA-145: Uses TreeSitterIndexer for AST-based parsing with regex fallback.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexingEngine = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const file_scanner_js_1 = require("../scanner/file-scanner.js");
const signature_extractor_js_1 = require("../scanner/signature-extractor.js");
const pattern_detector_js_1 = require("../scanner/pattern-detector.js");
const file_watcher_js_1 = require("./file-watcher.js");
const tree_sitter_indexer_js_1 = require("../parsers/tree-sitter-indexer.js");
const grammar_registry_js_1 = require("../parsers/grammar-registry.js");
const graph_repository_js_1 = require("../database/graph-repository.js");
const migrator_js_1 = require("../database/migrator.js");
class IndexingEngine {
    db;
    config;
    watcher = null;
    running = false;
    indexing = false;
    treeSitterIndexer = null;
    grammarRegistry = null;
    graphRepo = null;
    treeSitterReady = false;
    constructor(dbManager, config) {
        this.db = dbManager.getDb();
        this.config = config;
        this.initTreeSitter();
    }
    /** Initialize tree-sitter infrastructure (grammar registry + indexer). */
    initTreeSitter() {
        try {
            // Ensure graph schema is ready (relationships table)
            if (!(0, migrator_js_1.isGraphSchemaReady)(this.db)) {
                (0, migrator_js_1.runGraphMigrations)(this.db);
            }
            this.graphRepo = new graph_repository_js_1.GraphRepository(this.db);
            // Load grammar config — check dist/ first, then src/ (dev mode)
            const distConfigPath = path.resolve(__dirname, '../parsers/grammar-config.json');
            const srcConfigPath = path.resolve(__dirname, '../../src/parsers/grammar-config.json');
            const configPath = fs.existsSync(distConfigPath) ? distConfigPath : srcConfigPath;
            if (fs.existsSync(configPath)) {
                const grammarConfig = (0, grammar_registry_js_1.loadGrammarConfig)(configPath);
                this.grammarRegistry = new grammar_registry_js_1.GrammarRegistry(grammarConfig);
                this.treeSitterIndexer = new tree_sitter_indexer_js_1.TreeSitterIndexer(this.grammarRegistry, this.db, this.config.maxFileSize);
                this.treeSitterReady = true;
                console.error('[indexer] Tree-sitter indexer initialized (6 languages configured)');
            }
            else {
                console.error(`[indexer] Grammar config not found at ${configPath}, using regex fallback`);
            }
        }
        catch (err) {
            console.error('[indexer] Tree-sitter init failed, using regex fallback:', err);
            this.treeSitterReady = false;
        }
    }
    /** Start background indexing: full scan then watch. */
    async startBackgroundIndexing() {
        this.running = true;
        await this.runFullIndex();
        this.startWatcher();
    }
    /** Run a full workspace index. */
    async runFullIndex() {
        if (this.indexing)
            return;
        this.indexing = true;
        console.error('[indexer] Starting full index...');
        try {
            const files = (0, file_scanner_js_1.scanWorkspace)(this.config);
            console.error(`[indexer] Found ${files.length} files to index`);
            await this.indexFiles(files);
            this.updateModules();
            this.detectAndStorePatterns(new Map());
            // Resolve cross-file relationships after full index
            if (this.graphRepo) {
                const resolved = this.graphRepo.resolveTargets(5000);
                if (resolved > 0) {
                    console.error(`[indexer] Resolved ${resolved} cross-file symbol references`);
                }
            }
            console.error('[indexer] Full index complete');
        }
        finally {
            this.indexing = false;
        }
    }
    /** Index a single file (for incremental updates). */
    async indexSingleFile(filePath) {
        const file = (0, file_scanner_js_1.scanSingleFile)(filePath, this.config.workspace);
        if (!file)
            return;
        if (this.isFileUnchanged(file))
            return;
        await this.upsertFile(file);
    }
    /** Remove a file from the index. */
    removeFile(filePath) {
        const relativePath = filePath.replace(/\\/g, '/');
        this.db.prepare('DELETE FROM files WHERE relative_path = ?').run(relativePath);
        // Also remove relationships for this file
        if (this.graphRepo) {
            this.graphRepo.deleteFileRelationships(relativePath);
        }
    }
    /** Check if indexer is currently running. */
    isRunning() {
        return this.indexing;
    }
    /** Stop the indexer and file watcher. */
    stop() {
        this.running = false;
        if (this.watcher) {
            this.watcher.stop();
            this.watcher = null;
        }
    }
    /** Get tree-sitter indexer stats. */
    getTreeSitterStats() {
        if (!this.treeSitterReady || !this.grammarRegistry) {
            return { ready: false, languages: [] };
        }
        const langs = this.grammarRegistry.listLanguages()
            .filter(l => l.available)
            .map(l => l.id);
        return { ready: true, languages: langs };
    }
    async indexFiles(files) {
        const insertFile = this.db.prepare(`
      INSERT OR REPLACE INTO files (path, relative_path, language, module, content_hash, size_bytes, line_count, last_indexed)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
        const deleteSymbols = this.db.prepare('DELETE FROM symbols WHERE file_id = ?');
        const insertSymbol = this.db.prepare(`
      INSERT INTO symbols (file_id, name, kind, signature, start_line, end_line, parent_symbol, visibility, doc_comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        // Phase 1: Insert/update file records
        let treeSitterCount = 0;
        let regexCount = 0;
        let skippedCount = 0;
        const filesToIndex = [];
        const transaction = this.db.transaction((files) => {
            for (const file of files) {
                if (this.isFileUnchanged(file)) {
                    skippedCount++;
                    continue;
                }
                filesToIndex.push(file);
                const module = detectModule(file.relativePath);
                insertFile.run(file.absolutePath, file.relativePath, file.language, module, file.contentHash, file.sizeBytes, file.lineCount);
            }
        });
        transaction(files);
        // Phase 2: Use tree-sitter for symbol + relationship extraction
        if (this.treeSitterReady && this.treeSitterIndexer) {
            const batchSize = 50;
            for (let i = 0; i < filesToIndex.length; i += batchSize) {
                const batch = filesToIndex.slice(i, i + batchSize).map(f => ({
                    absolutePath: f.absolutePath,
                    relativePath: f.relativePath,
                }));
                const results = await this.treeSitterIndexer.indexFiles(batch);
                for (const result of results) {
                    if (result.method === 'tree-sitter') {
                        treeSitterCount++;
                    }
                    else {
                        regexCount++;
                    }
                }
            }
            console.error(`[indexer] Indexed ${treeSitterCount} files via tree-sitter, ` +
                `${regexCount} via regex fallback, ${skippedCount} unchanged`);
        }
        else {
            // Fallback: use regex extraction directly (legacy path)
            console.error('[indexer] Tree-sitter not available, using regex extraction');
            const regexTransaction = this.db.transaction(() => {
                for (const file of filesToIndex) {
                    const fileRow = this.db.prepare('SELECT id FROM files WHERE relative_path = ?').get(file.relativePath);
                    if (!fileRow)
                        continue;
                    deleteSymbols.run(fileRow.id);
                    this.indexFileSymbolsRegex(file, fileRow.id, insertSymbol);
                    regexCount++;
                }
            });
            regexTransaction();
            console.error(`[indexer] Indexed ${regexCount} files via regex, ${skippedCount} unchanged`);
        }
    }
    /** Legacy regex-based symbol extraction (used when tree-sitter unavailable). */
    indexFileSymbolsRegex(file, fileId, insertStmt) {
        try {
            const content = fs.readFileSync(file.absolutePath, 'utf-8');
            const symbols = (0, signature_extractor_js_1.extractSymbols)(content, file.language);
            for (const sym of symbols) {
                insertStmt.run(fileId, sym.name, sym.kind, sym.signature, sym.startLine, sym.endLine, sym.parentSymbol, sym.visibility, sym.docComment);
            }
        }
        catch (err) {
            console.error(`[indexer] Error indexing ${file.relativePath}:`, err);
        }
    }
    isFileUnchanged(file) {
        const row = this.db.prepare('SELECT content_hash FROM files WHERE relative_path = ?').get(file.relativePath);
        return row?.content_hash === file.contentHash;
    }
    async upsertFile(file) {
        const module = detectModule(file.relativePath);
        this.db.prepare(`
      INSERT OR REPLACE INTO files (path, relative_path, language, module, content_hash, size_bytes, line_count, last_indexed)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(file.absolutePath, file.relativePath, file.language, module, file.contentHash, file.sizeBytes, file.lineCount);
        // Use tree-sitter if available, otherwise regex fallback
        if (this.treeSitterReady && this.treeSitterIndexer) {
            await this.treeSitterIndexer.indexFile(file.absolutePath, file.relativePath);
        }
        else {
            const fileRow = this.db.prepare('SELECT id FROM files WHERE relative_path = ?').get(file.relativePath);
            if (fileRow) {
                this.db.prepare('DELETE FROM symbols WHERE file_id = ?').run(fileRow.id);
                const insertSymbol = this.db.prepare(`
          INSERT INTO symbols (file_id, name, kind, signature, start_line, end_line, parent_symbol, visibility, doc_comment)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
                this.indexFileSymbolsRegex(file, fileRow.id, insertSymbol);
            }
        }
    }
    updateModules() {
        this.db.exec('DELETE FROM modules');
        const rows = this.db.prepare(`
      SELECT module, language, COUNT(*) as file_count,
             (SELECT COUNT(*) FROM symbols WHERE file_id IN (SELECT id FROM files WHERE module = f.module)) as symbol_count
      FROM files f
      WHERE module IS NOT NULL
      GROUP BY module
    `).all();
        const insert = this.db.prepare(`
      INSERT INTO modules (name, root_path, language, file_count, symbol_count)
      VALUES (?, ?, ?, ?, ?)
    `);
        for (const row of rows) {
            insert.run(row.module, row.module, row.language, row.file_count, row.symbol_count);
        }
    }
    detectAndStorePatterns(moduleImports) {
        const startMs = Date.now();
        const modules = this.db.prepare('SELECT name FROM modules').all();
        const updateStmt = this.db.prepare(`
      UPDATE modules SET di_style = ?, error_handling = ?, naming_convention = ?,
      logging_framework = ?, testing_framework = ?, purpose = ? WHERE name = ?
    `);
        const transaction = this.db.transaction(() => {
            for (const { name } of modules) {
                try {
                    const symbols = this.db.prepare('SELECT name, kind, signature, visibility FROM symbols WHERE file_id IN (SELECT id FROM files WHERE module = ?)').all(name);
                    const classes = symbols.filter(s => s.kind === 'class' || s.kind === 'interface');
                    const functions = symbols.filter(s => s.kind === 'function' || s.kind === 'method');
                    const imports = moduleImports.get(name) ?? [];
                    const patterns = (0, pattern_detector_js_1.detectPatterns)(classes, functions, imports);
                    const purpose = (0, pattern_detector_js_1.inferModulePurpose)(name, classes, []);
                    updateStmt.run(patterns.diStyle, patterns.errorHandling, patterns.naming, patterns.logging, patterns.testing, purpose, name);
                }
                catch (err) {
                    console.error(`[indexer] Pattern detection failed for ${name}:`, err);
                }
            }
        });
        transaction();
        console.error(`[indexer] Pattern detection: ${Date.now() - startMs}ms`);
    }
    startWatcher() {
        if (!this.config.watchEnabled || !this.running)
            return;
        this.watcher = new file_watcher_js_1.FileWatcher(this.config, (filePath, event) => {
            if (event === 'unlink') {
                this.removeFile(filePath);
            }
            else {
                this.indexSingleFile(filePath).catch(err => console.error(`[indexer] Watch index error for ${filePath}:`, err));
            }
        });
        this.watcher.start();
    }
}
exports.IndexingEngine = IndexingEngine;
function detectModule(relativePath) {
    const parts = relativePath.split('/');
    if (parts.length >= 2 && parts[0] === 'src')
        return parts[1];
    if (parts.length >= 1)
        return parts[0];
    return 'root';
}
//# sourceMappingURL=indexing-engine.js.map