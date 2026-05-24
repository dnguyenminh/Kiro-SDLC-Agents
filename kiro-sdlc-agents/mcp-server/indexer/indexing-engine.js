"use strict";
/**
 * Indexing Engine — Full scan and incremental indexing.
 * Coordinates file scanning, symbol extraction, and database updates.
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
const file_scanner_js_1 = require("../scanner/file-scanner.js");
const signature_extractor_js_1 = require("../scanner/signature-extractor.js");
const pattern_detector_js_1 = require("../scanner/pattern-detector.js");
const file_watcher_js_1 = require("./file-watcher.js");
class IndexingEngine {
    db;
    config;
    watcher = null;
    running = false;
    indexing = false;
    constructor(dbManager, config) {
        this.db = dbManager.getDb();
        this.config = config;
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
            this.indexFiles(files);
            this.updateModules();
            this.detectAndStorePatterns(new Map());
            console.error('[indexer] Full index complete');
        }
        finally {
            this.indexing = false;
        }
    }
    /** Index a single file (for incremental updates). */
    indexSingleFile(filePath) {
        const file = (0, file_scanner_js_1.scanSingleFile)(filePath, this.config.workspace);
        if (!file)
            return;
        if (this.isFileUnchanged(file))
            return;
        this.upsertFile(file);
    }
    /** Remove a file from the index. */
    removeFile(filePath) {
        const relativePath = filePath.replace(/\\/g, '/');
        this.db.prepare('DELETE FROM files WHERE relative_path = ?').run(relativePath);
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
    indexFiles(files) {
        const insertFile = this.db.prepare(`
      INSERT OR REPLACE INTO files (path, relative_path, language, module, content_hash, size_bytes, line_count, last_indexed)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
        const deleteSymbols = this.db.prepare('DELETE FROM symbols WHERE file_id = ?');
        const insertSymbol = this.db.prepare(`
      INSERT INTO symbols (file_id, name, kind, signature, start_line, end_line, parent_symbol, visibility, doc_comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const transaction = this.db.transaction((files) => {
            for (const file of files) {
                if (this.isFileUnchanged(file))
                    continue;
                const module = detectModule(file.relativePath);
                const info = insertFile.run(file.absolutePath, file.relativePath, file.language, module, file.contentHash, file.sizeBytes, file.lineCount);
                const fileId = info.lastInsertRowid;
                deleteSymbols.run(fileId);
                this.indexFileSymbols(file, fileId, insertSymbol);
            }
        });
        transaction(files);
    }
    indexFileSymbols(file, fileId, insertStmt) {
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
    upsertFile(file) {
        const module = detectModule(file.relativePath);
        const info = this.db.prepare(`
      INSERT OR REPLACE INTO files (path, relative_path, language, module, content_hash, size_bytes, line_count, last_indexed)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(file.absolutePath, file.relativePath, file.language, module, file.contentHash, file.sizeBytes, file.lineCount);
        const fileId = info.lastInsertRowid;
        this.db.prepare('DELETE FROM symbols WHERE file_id = ?').run(fileId);
        const insertSymbol = this.db.prepare(`
      INSERT INTO symbols (file_id, name, kind, signature, start_line, end_line, parent_symbol, visibility, doc_comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        this.indexFileSymbols(file, fileId, insertSymbol);
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
                this.indexSingleFile(filePath);
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