"use strict";
/**
 * KSA-153: Graph Repository — CRUD operations for the code relationship graph.
 * Provides prepared-statement-based access to the relationships table.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphRepository = void 0;
class GraphRepository {
    db;
    stmts;
    constructor(db) {
        this.db = db;
        this.prepareStatements();
    }
    /** Insert a batch of relationships within a transaction. */
    insertRelationships(relationships) {
        const transaction = this.db.transaction((rels) => {
            for (const rel of rels) {
                this.stmts.insertRelationship.run(rel.sourceSymbolId, rel.targetSymbol, rel.targetSymbolId ?? null, rel.kind, rel.filePath, rel.line, rel.metadata ? JSON.stringify(rel.metadata) : null);
            }
        });
        transaction(relationships);
    }
    /** Delete all relationships originating from a file. */
    deleteFileRelationships(filePath) {
        this.stmts.deleteFileRelationships.run(filePath);
    }
    /** Find direct callers of a symbol by name. */
    findCallers(symbolName, kind = 'calls', limit = 20) {
        return this.stmts.findCallers.all(symbolName, kind, limit);
    }
    /** Find direct callees of a symbol by ID. */
    findCallees(symbolId, kind = 'calls', limit = 20) {
        return this.stmts.findCallees.all(symbolId, kind, limit);
    }
    /** Resolve target_symbol_id for unresolved relationships (batch). */
    resolveTargets(batchSize = 1000) {
        const unresolved = this.db.prepare(`
      SELECT r.id, r.target_symbol
      FROM relationships r
      WHERE r.target_symbol_id IS NULL
      LIMIT ?
    `).all(batchSize);
        let resolved = 0;
        const findTarget = this.db.prepare('SELECT id FROM symbols WHERE name = ? LIMIT 1');
        const transaction = this.db.transaction(() => {
            for (const row of unresolved) {
                const target = findTarget.get(row.target_symbol);
                if (target) {
                    this.stmts.resolveTarget.run(target.id, row.id);
                    resolved++;
                }
            }
        });
        transaction();
        return resolved;
    }
    /** Get total relationship count. */
    getRelationshipCount() {
        const row = this.stmts.countRelationships.get();
        return row.count;
    }
    /** Get relationship statistics by kind. */
    getStats() {
        return this.db.prepare(`
      SELECT kind, COUNT(*) as count
      FROM relationships
      GROUP BY kind
      ORDER BY count DESC
    `).all();
    }
    prepareStatements() {
        this.stmts = {
            insertRelationship: this.db.prepare(`
        INSERT INTO relationships (source_symbol_id, target_symbol, target_symbol_id, kind, file_path, line, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `),
            deleteFileRelationships: this.db.prepare('DELETE FROM relationships WHERE file_path = ?'),
            findCallers: this.db.prepare(`
        SELECT s.name, s.kind, f.relative_path as file_path, s.start_line as def_line, r.line as call_line,
               s.parent_symbol as parameters, s.visibility as is_async, s.id
        FROM relationships r
        JOIN symbols s ON s.id = r.source_symbol_id
        JOIN files f ON f.id = s.file_id
        WHERE r.target_symbol = ? AND r.kind = ?
        ORDER BY f.relative_path, r.line
        LIMIT ?
      `),
            findCallees: this.db.prepare(`
        SELECT r.target_symbol as name, r.line as call_line, r.metadata,
               ts.kind, tf.relative_path as file_path, ts.start_line as def_line
        FROM relationships r
        LEFT JOIN symbols ts ON ts.id = r.target_symbol_id
        LEFT JOIN files tf ON tf.id = ts.file_id
        WHERE r.source_symbol_id = ? AND r.kind = ?
        ORDER BY r.line
        LIMIT ?
      `),
            resolveTarget: this.db.prepare('UPDATE relationships SET target_symbol_id = ? WHERE id = ?'),
            countRelationships: this.db.prepare('SELECT COUNT(*) as count FROM relationships'),
        };
    }
}
exports.GraphRepository = GraphRepository;
//# sourceMappingURL=graph-repository.js.map