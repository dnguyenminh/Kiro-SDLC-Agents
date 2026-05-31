"use strict";
/**
 * KSA-154: Symbol Resolver — resolves symbol names to database records.
 * Supports exact match, qualified names (Class.method), and file:symbol format.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SymbolResolver = void 0;
class SymbolResolver {
    db;
    stmts;
    constructor(db) {
        this.db = db;
        this.stmts = {
            exactMatch: db.prepare(`
        SELECT s.id, s.name, s.kind, f.relative_path as filePath, s.start_line as line, s.parent_symbol_id as parentSymbolId
        FROM symbols s
        JOIN files f ON s.file_id = f.id
        WHERE s.name = ?
        ORDER BY s.start_line ASC
      `),
            qualifiedMatch: db.prepare(`
        SELECT s.id, s.name, s.kind, f.relative_path as filePath, s.start_line as line, s.parent_symbol_id as parentSymbolId
        FROM symbols s
        JOIN files f ON s.file_id = f.id
        JOIN symbols p ON p.id = s.parent_symbol_id
        WHERE s.name = ? AND p.name = ?
      `),
            fileMatch: db.prepare(`
        SELECT s.id, s.name, s.kind, f.relative_path as filePath, s.start_line as line, s.parent_symbol_id as parentSymbolId
        FROM symbols s
        JOIN files f ON s.file_id = f.id
        WHERE s.name = ? AND f.relative_path LIKE ?
      `),
            fuzzyMatch: db.prepare(`
        SELECT DISTINCT s.name
        FROM symbols s
        WHERE s.name LIKE ?
        LIMIT ?
      `),
        };
    }
    /** Resolve a symbol name to one or more database records. */
    resolve(input) {
        // Strategy 1: Exact match
        let results = this.stmts.exactMatch.all(input);
        if (results.length > 0)
            return results;
        // Strategy 2: Qualified name (Class.method)
        if (input.includes('.')) {
            const dotIndex = input.lastIndexOf('.');
            const parent = input.substring(0, dotIndex);
            const method = input.substring(dotIndex + 1);
            results = this.stmts.qualifiedMatch.all(method, parent);
            if (results.length > 0)
                return results;
        }
        // Strategy 3: file:symbol format
        if (input.includes(':')) {
            const colonIndex = input.lastIndexOf(':');
            const file = input.substring(0, colonIndex);
            const name = input.substring(colonIndex + 1);
            results = this.stmts.fileMatch.all(name, `%${file}%`);
            if (results.length > 0)
                return results;
        }
        return [];
    }
    /** Suggest similar symbol names for "did you mean?" responses. */
    suggest(input, limit = 5) {
        const rows = this.stmts.fuzzyMatch.all(`%${input}%`, limit);
        return rows.map(r => r.name);
    }
}
exports.SymbolResolver = SymbolResolver;
//# sourceMappingURL=symbol-resolver.js.map