"use strict";
/**
 * KSA-162: Entry Point Store — SQLite CRUD for detected entry points.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntryPointStore = void 0;
const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS entry_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol_id INTEGER NOT NULL,
  entry_type TEXT NOT NULL,
  framework TEXT,
  http_method TEXT,
  route_path TEXT,
  full_route TEXT,
  middleware TEXT,
  has_auth INTEGER DEFAULT 0,
  controller TEXT,
  event_name TEXT,
  confidence TEXT DEFAULT 'High',
  detected_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ep_type ON entry_points(entry_type);
CREATE INDEX IF NOT EXISTS idx_ep_framework ON entry_points(framework);
CREATE INDEX IF NOT EXISTS idx_ep_route ON entry_points(route_path);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ep_symbol ON entry_points(symbol_id);
`;
class EntryPointStore {
    db;
    stmts;
    constructor(db) {
        this.db = db;
        this.ensureTable();
        this.prepareStatements();
    }
    /** Store or update an entry point. */
    upsert(ep) {
        this.stmts.upsert.run(ep.symbol_id, ep.entry_type, ep.framework, ep.http_method, ep.route_path, ep.full_route, JSON.stringify(ep.middleware), ep.has_auth ? 1 : 0, ep.controller, ep.event_name, ep.confidence);
    }
    /** Batch upsert entry points. */
    upsertBatch(entries) {
        const transaction = this.db.transaction((items) => {
            for (const ep of items)
                this.upsert(ep);
        });
        transaction(entries);
    }
    /** Query entry points with filters. */
    query(filters) {
        let sql = `
      SELECT ep.*, s.name as symbol_name, f.relative_path as file_path, s.start_line
      FROM entry_points ep
      JOIN symbols s ON s.id = ep.symbol_id
      JOIN files f ON f.id = s.file_id
      WHERE 1=1
    `;
        const params = [];
        if (filters.entryType) {
            sql += ' AND ep.entry_type = ?';
            params.push(filters.entryType);
        }
        if (filters.framework) {
            sql += ' AND ep.framework = ?';
            params.push(filters.framework);
        }
        if (filters.httpMethod) {
            sql += ' AND ep.http_method = ?';
            params.push(filters.httpMethod.toUpperCase());
        }
        if (filters.routePattern) {
            sql += ' AND ep.full_route LIKE ?';
            params.push(`%${filters.routePattern}%`);
        }
        if (filters.hasAuth !== undefined) {
            sql += ' AND ep.has_auth = ?';
            params.push(filters.hasAuth ? 1 : 0);
        }
        if (filters.filePath) {
            sql += ' AND f.relative_path LIKE ?';
            params.push(`%${filters.filePath}%`);
        }
        // Count
        const countSql = sql.replace(/SELECT ep\.\*.*?FROM/, 'SELECT COUNT(*) as total FROM');
        const totalRow = this.db.prepare(countSql).get(...params);
        const total = totalRow?.total ?? 0;
        sql += ' ORDER BY ep.entry_type, ep.full_route LIMIT ?';
        params.push(filters.limit);
        const rows = this.db.prepare(sql).all(...params);
        const results = rows.map(r => ({
            ...r,
            middleware: r.middleware ? JSON.parse(r.middleware) : [],
            has_auth: Boolean(r.has_auth),
        }));
        // Summary
        const typeSql = 'SELECT entry_type, COUNT(*) as count FROM entry_points GROUP BY entry_type';
        const typeRows = this.db.prepare(typeSql).all();
        const byType = {};
        for (const r of typeRows)
            byType[r.entry_type] = r.count;
        const fwSql = 'SELECT framework, COUNT(*) as count FROM entry_points WHERE framework IS NOT NULL GROUP BY framework';
        const fwRows = this.db.prepare(fwSql).all();
        const byFramework = {};
        for (const r of fwRows)
            byFramework[r.framework] = r.count;
        const authSql = 'SELECT has_auth, COUNT(*) as count FROM entry_points GROUP BY has_auth';
        const authRows = this.db.prepare(authSql).all();
        const authCoverage = { withAuth: 0, withoutAuth: 0 };
        for (const r of authRows) {
            if (r.has_auth)
                authCoverage.withAuth = r.count;
            else
                authCoverage.withoutAuth = r.count;
        }
        return { results, total, summary: { byType, byFramework, authCoverage } };
    }
    /** Delete entry point for a symbol. */
    deleteBySymbol(symbolId) {
        this.stmts.deleteBySymbol.run(symbolId);
    }
    ensureTable() {
        this.db.exec(CREATE_TABLE);
    }
    prepareStatements() {
        this.stmts = {
            upsert: this.db.prepare(`
        INSERT OR REPLACE INTO entry_points
          (symbol_id, entry_type, framework, http_method, route_path, full_route,
           middleware, has_auth, controller, event_name, confidence, detected_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `),
            deleteBySymbol: this.db.prepare('DELETE FROM entry_points WHERE symbol_id = ?'),
        };
    }
}
exports.EntryPointStore = EntryPointStore;
//# sourceMappingURL=EntryPointStore.js.map