"use strict";
/**
 * KSA-163: Graph Loader — Loads subgraphs from the relationships table.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphLoader = void 0;
class GraphLoader {
    db;
    constructor(db) {
        this.db = db;
    }
    /** Load the import/dependency graph as adjacency list. */
    loadDependencyGraph(module) {
        let sql = `
      SELECT source_symbol_id, target_symbol_id
      FROM relationships
      WHERE kind = 'imports'
        AND target_symbol_id IS NOT NULL
        AND file_path NOT LIKE '%node_modules%'
        AND file_path NOT LIKE '%vendor%'
    `;
        const params = [];
        if (module) {
            sql += ` AND file_path LIKE ?`;
            params.push(`%${module}%`);
        }
        const rows = this.db.prepare(sql).all(...params);
        const graph = new Map();
        for (const row of rows) {
            if (!graph.has(row.source_symbol_id))
                graph.set(row.source_symbol_id, []);
            graph.get(row.source_symbol_id).push(row.target_symbol_id);
            // Ensure target node exists in graph
            if (!graph.has(row.target_symbol_id))
                graph.set(row.target_symbol_id, []);
        }
        return graph;
    }
    /** Load the call graph as adjacency list (caller → callee). */
    loadCallGraph(module) {
        let sql = `
      SELECT source_symbol_id, target_symbol_id
      FROM relationships
      WHERE kind = 'calls'
        AND target_symbol_id IS NOT NULL
    `;
        const params = [];
        if (module) {
            sql += ` AND file_path LIKE ?`;
            params.push(`%${module}%`);
        }
        const rows = this.db.prepare(sql).all(...params);
        const graph = new Map();
        for (const row of rows) {
            if (!graph.has(row.source_symbol_id))
                graph.set(row.source_symbol_id, []);
            graph.get(row.source_symbol_id).push(row.target_symbol_id);
            if (!graph.has(row.target_symbol_id))
                graph.set(row.target_symbol_id, []);
        }
        return graph;
    }
    /** Load reverse call graph (callee → callers). */
    loadReverseCallGraph(module) {
        let sql = `
      SELECT source_symbol_id, target_symbol_id
      FROM relationships
      WHERE kind = 'calls'
        AND target_symbol_id IS NOT NULL
    `;
        const params = [];
        if (module) {
            sql += ` AND file_path LIKE ?`;
            params.push(`%${module}%`);
        }
        const rows = this.db.prepare(sql).all(...params);
        // Reverse: target → [callers]
        const graph = new Map();
        for (const row of rows) {
            if (!graph.has(row.target_symbol_id))
                graph.set(row.target_symbol_id, []);
            graph.get(row.target_symbol_id).push(row.source_symbol_id);
            if (!graph.has(row.source_symbol_id))
                graph.set(row.source_symbol_id, []);
        }
        return graph;
    }
    /** Get symbol info by ID. */
    getSymbolInfo(symbolId) {
        const row = this.db.prepare(`
      SELECT s.id, s.name, s.kind, f.relative_path as filePath
      FROM symbols s
      JOIN files f ON f.id = s.file_id
      WHERE s.id = ?
    `).get(symbolId);
        return row ?? null;
    }
    /** Get symbol info for multiple IDs. */
    getSymbolInfoBatch(symbolIds) {
        if (symbolIds.length === 0)
            return new Map();
        const placeholders = symbolIds.map(() => '?').join(',');
        const rows = this.db.prepare(`
      SELECT s.id, s.name, s.kind, f.relative_path as filePath
      FROM symbols s
      JOIN files f ON f.id = s.file_id
      WHERE s.id IN (${placeholders})
    `).all(...symbolIds);
        const map = new Map();
        for (const row of rows)
            map.set(row.id, row);
        return map;
    }
    /** Resolve a symbol name to its ID. */
    resolveSymbolId(name, filePath) {
        let sql = 'SELECT s.id FROM symbols s JOIN files f ON f.id = s.file_id WHERE s.name = ?';
        const params = [name];
        if (filePath) {
            sql += ' AND f.relative_path LIKE ?';
            params.push(`%${filePath}%`);
        }
        sql += ' LIMIT 1';
        const row = this.db.prepare(sql).get(...params);
        return row?.id ?? null;
    }
}
exports.GraphLoader = GraphLoader;
//# sourceMappingURL=GraphLoader.js.map