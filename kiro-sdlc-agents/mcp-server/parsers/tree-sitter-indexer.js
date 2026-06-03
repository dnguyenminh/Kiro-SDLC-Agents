"use strict";
/**
 * KSA-145: Tree-sitter Indexer — Orchestrates file parsing and database storage.
 * Uses tree-sitter for supported languages, falls back to regex extraction.
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
exports.TreeSitterIndexer = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const signature_extractor_js_1 = require("../scanner/signature-extractor.js");
class TreeSitterIndexer {
    registry;
    db;
    maxFileSize;
    constructor(registry, db, maxFileSize = 1_048_576) {
        this.registry = registry;
        this.db = db;
        this.maxFileSize = maxFileSize;
    }
    /** Index a single file using tree-sitter or regex fallback. */
    async indexFile(filePath, relativePath) {
        const startTime = Date.now();
        let source;
        try {
            const stat = fs.statSync(filePath);
            if (stat.size > this.maxFileSize) {
                return this.regexFallback(filePath, relativePath, startTime);
            }
            source = fs.readFileSync(filePath, 'utf-8');
        }
        catch {
            return {
                filePath: relativePath,
                symbolCount: 0,
                relationshipCount: 0,
                parseErrors: 1,
                duration: Date.now() - startTime,
                method: 'regex-fallback',
            };
        }
        // Try tree-sitter first
        const parser = await this.registry.getParser(filePath);
        let result;
        let method;
        if (parser) {
            result = parser.parse(source, relativePath);
            method = 'tree-sitter';
        }
        else {
            return this.regexFallback(filePath, relativePath, startTime);
        }
        // Atomic database update
        const symbolIds = this.storeResults(relativePath, result);
        // Extract and store function bodies for embedding-based similarity (KSA-169)
        this.extractAndStoreBodies(relativePath, source, result, symbolIds);
        return {
            filePath: relativePath,
            symbolCount: result.symbols.length,
            relationshipCount: result.relationships.length,
            parseErrors: result.errors.length,
            duration: Date.now() - startTime,
            method,
        };
    }
    /** Batch index multiple files. */
    async indexFiles(files) {
        const results = [];
        for (const file of files) {
            const result = await this.indexFile(file.absolutePath, file.relativePath);
            results.push(result);
        }
        return results;
    }
    /** Store parse results in the database atomically. */
    storeResults(filePath, result) {
        const symbolIds = new Map();
        const transaction = this.db.transaction(() => {
            // Get file_id
            const fileRow = this.db.prepare('SELECT id FROM files WHERE relative_path = ?').get(filePath);
            if (!fileRow)
                return;
            const fileId = fileRow.id;
            // Delete old symbols
            this.db.prepare('DELETE FROM symbols WHERE file_id = ?').run(fileId);
            // Delete old relationships for this file
            try {
                this.db.prepare('DELETE FROM relationships WHERE file_path = ?').run(filePath);
            }
            catch {
                // relationships table may not exist yet (pre-migration)
            }
            // Insert new symbols
            const insertSym = this.db.prepare(`
        INSERT INTO symbols (file_id, name, kind, signature, start_line, end_line,
          parent_symbol, visibility, doc_comment)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            for (const sym of result.symbols) {
                const info = insertSym.run(fileId, sym.name, sym.kind, sym.signature, sym.startLine, sym.endLine, sym.parentName ?? null, sym.isExported ? 'export' : null, sym.docComment ?? null);
                symbolIds.set(sym.name, info.lastInsertRowid);
            }
            // Insert relationships (if table exists)
            try {
                const insertRel = this.db.prepare(`
          INSERT INTO relationships (source_symbol_id, target_symbol, target_symbol_id, kind, file_path, line, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
                for (const rel of result.relationships) {
                    const sourceId = symbolIds.get(rel.sourceSymbol);
                    if (!sourceId)
                        continue;
                    const targetId = symbolIds.get(rel.targetSymbol) ?? null;
                    insertRel.run(sourceId, rel.targetSymbol, targetId, rel.kind, filePath, rel.line, rel.metadata ? JSON.stringify(rel.metadata) : null);
                }
            }
            catch {
                // relationships table may not exist yet
            }
        });
        transaction();
        return symbolIds;
    }
    regexFallback(filePath, relativePath, startTime) {
        try {
            const source = fs.readFileSync(filePath, 'utf-8');
            const ext = path.extname(filePath).toLowerCase();
            const language = this.extToLanguage(ext);
            const symbols = (0, signature_extractor_js_1.extractSymbols)(source, language);
            // Store regex-extracted symbols in the database
            if (symbols.length > 0) {
                this.storeRegexResults(relativePath, symbols);
            }
            return {
                filePath: relativePath,
                symbolCount: symbols.length,
                relationshipCount: 0,
                parseErrors: 0,
                duration: Date.now() - startTime,
                method: 'regex-fallback',
            };
        }
        catch {
            return {
                filePath: relativePath,
                symbolCount: 0,
                relationshipCount: 0,
                parseErrors: 1,
                duration: Date.now() - startTime,
                method: 'regex-fallback',
            };
        }
    }
    /** Store regex-extracted symbols in the database. */
    storeRegexResults(filePath, symbols) {
        const transaction = this.db.transaction(() => {
            const fileRow = this.db.prepare('SELECT id FROM files WHERE relative_path = ?').get(filePath);
            if (!fileRow)
                return;
            const fileId = fileRow.id;
            // Delete old symbols
            this.db.prepare('DELETE FROM symbols WHERE file_id = ?').run(fileId);
            // Insert new symbols
            const insertSym = this.db.prepare(`
        INSERT INTO symbols (file_id, name, kind, signature, start_line, end_line,
          parent_symbol, visibility, doc_comment)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            for (const sym of symbols) {
                insertSym.run(fileId, sym.name, sym.kind, sym.signature, sym.startLine, sym.endLine, sym.parentSymbol, sym.visibility, sym.docComment);
            }
        });
        transaction();
    }
    extToLanguage(ext) {
        const map = {
            '.ts': 'typescript', '.tsx': 'typescript',
            '.js': 'javascript', '.jsx': 'javascript',
            '.py': 'python', '.kt': 'kotlin', '.kts': 'kotlin',
            '.java': 'java', '.go': 'go', '.rs': 'rust',
            '.cls': 'apex', '.trigger': 'apex',
        };
        return map[ext] ?? 'generic';
    }
    /** Extract and store function body text for embedding-based similarity (KSA-169). */
    extractAndStoreBodies(filePath, source, result, symbolIds) {
        try {
            const lines = source.split('\n');
            const functionKinds = new Set(['function', 'method', 'arrow_function', 'generator', 'function_declaration']);
            const minBodyLines = 3;
            const insertBody = this.db.prepare(`
        INSERT OR REPLACE INTO body_embeddings (symbol_id, chunk_index, embedding, token_count)
        VALUES (?, ?, ?, ?)
      `);
            for (const sym of result.symbols) {
                if (!functionKinds.has(sym.kind))
                    continue;
                const symbolId = symbolIds.get(sym.name);
                if (!symbolId)
                    continue;
                const bodyLines = lines.slice(sym.startLine - 1, sym.endLine);
                if (bodyLines.length < minBodyLines)
                    continue;
                const bodyText = bodyLines.join('\n');
                const tokenCount = bodyText.split(/\s+/).filter(Boolean).length;
                // Store body text as raw bytes (embedding generated later by embedding service)
                const textBuffer = Buffer.from(bodyText, 'utf-8');
                insertBody.run(symbolId, 0, textBuffer, tokenCount);
            }
        }
        catch {
            // Body extraction is optional — don't fail indexing
        }
    }
}
exports.TreeSitterIndexer = TreeSitterIndexer;
//# sourceMappingURL=tree-sitter-indexer.js.map