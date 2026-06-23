/**
 * KSA-161: SQLite CRUD for complexity results.
 */
const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS complexity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol_id INTEGER NOT NULL,
  cyclomatic_complexity INTEGER NOT NULL DEFAULT 1,
  branches INTEGER NOT NULL DEFAULT 0,
  loops INTEGER NOT NULL DEFAULT 0,
  logical_ops INTEGER NOT NULL DEFAULT 0,
  nesting_depth INTEGER NOT NULL DEFAULT 0,
  early_returns INTEGER NOT NULL DEFAULT 0,
  exception_handlers INTEGER NOT NULL DEFAULT 0,
  grade TEXT NOT NULL DEFAULT 'A',
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
  UNIQUE(symbol_id)
);
CREATE INDEX IF NOT EXISTS idx_complexity_grade ON complexity(grade);
CREATE INDEX IF NOT EXISTS idx_complexity_cc ON complexity(cyclomatic_complexity DESC);
CREATE INDEX IF NOT EXISTS idx_complexity_symbol ON complexity(symbol_id);
`;
export class ComplexityStore {
    db;
    stmts;
    constructor(db) {
        this.db = db;
        this.ensureTable();
        this.prepareStatements();
    }
    /** Store or update complexity result for a symbol. */
    upsert(result) {
        this.stmts.upsert.run(result.symbol_id, result.cyclomatic_complexity, result.branches, result.loops, result.logical_ops, result.nesting_depth, result.early_returns, result.exception_handlers, result.grade);
    }
    /** Batch upsert complexity results. */
    upsertBatch(results) {
        const transaction = this.db.transaction((items) => {
            for (const r of items)
                this.upsert(r);
        });
        transaction(results);
    }
    /** Get complexity for a specific symbol. */
    getBySymbol(symbolId) {
        return this.stmts.getBySymbol.get(symbolId) ?? null;
    }
    /** Query complexity results with filters. */
    query(filters) {
        let sql = `
      SELECT c.*, s.name as symbol_name, f.relative_path as file_path,
             s.start_line, s.end_line
      FROM complexity c
      JOIN symbols s ON s.id = c.symbol_id
      JOIN files f ON f.id = s.file_id
      WHERE 1=1
    `;
        const params = [];
        if (filters.filePath) {
            sql += ' AND f.relative_path LIKE ?';
            params.push(`%${filters.filePath}%`);
        }
        if (filters.symbolName) {
            sql += ' AND s.name LIKE ?';
            params.push(`%${filters.symbolName}%`);
        }
        if (filters.minComplexity !== undefined) {
            sql += ' AND c.cyclomatic_complexity >= ?';
            params.push(filters.minComplexity);
        }
        if (filters.gradeFilter && filters.gradeFilter.length > 0) {
            const placeholders = filters.gradeFilter.map(() => '?').join(',');
            sql += ` AND c.grade IN (${placeholders})`;
            params.push(...filters.gradeFilter);
        }
        if (filters.module) {
            sql += ' AND f.module = ?';
            params.push(filters.module);
        }
        // Count total before limit
        const countSql = sql.replace(/SELECT c\.\*.*?FROM/, 'SELECT COUNT(*) as total FROM');
        const totalRow = this.db.prepare(countSql).get(...params);
        const total = totalRow?.total ?? 0;
        // Sort and limit
        switch (filters.sortBy) {
            case 'name':
                sql += ' ORDER BY s.name ASC';
                break;
            case 'file':
                sql += ' ORDER BY f.relative_path ASC, s.start_line ASC';
                break;
            default:
                sql += ' ORDER BY c.cyclomatic_complexity DESC';
                break;
        }
        sql += ' LIMIT ?';
        params.push(filters.limit);
        const results = this.db.prepare(sql).all(...params);
        // Grade distribution
        const distSql = `
      SELECT c.grade, COUNT(*) as count
      FROM complexity c
      JOIN symbols s ON s.id = c.symbol_id
      JOIN files f ON f.id = s.file_id
      WHERE 1=1 ${filters.module ? 'AND f.module = ?' : ''}
      GROUP BY c.grade
    `;
        const distParams = filters.module ? [filters.module] : [];
        const distRows = this.db.prepare(distSql).all(...distParams);
        const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
        for (const row of distRows)
            gradeDistribution[row.grade] = row.count;
        // Average
        const avgSql = `SELECT AVG(cyclomatic_complexity) as avg FROM complexity`;
        const avgRow = this.db.prepare(avgSql).get();
        return {
            results,
            total,
            summary: {
                average: avgRow?.avg ?? 0,
                gradeDistribution,
            },
        };
    }
    /** Delete complexity data for a symbol. */
    deleteBySymbol(symbolId) {
        this.stmts.deleteBySymbol.run(symbolId);
    }
    ensureTable() {
        this.db.exec(CREATE_TABLE);
    }
    prepareStatements() {
        this.stmts = {
            upsert: this.db.prepare(`
        INSERT OR REPLACE INTO complexity
          (symbol_id, cyclomatic_complexity, branches, loops, logical_ops,
           nesting_depth, early_returns, exception_handlers, grade, computed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `),
            getBySymbol: this.db.prepare(`
        SELECT c.*, s.name as symbol_name, f.relative_path as file_path,
               s.start_line, s.end_line
        FROM complexity c
        JOIN symbols s ON s.id = c.symbol_id
        JOIN files f ON f.id = s.file_id
        WHERE c.symbol_id = ?
      `),
            deleteBySymbol: this.db.prepare('DELETE FROM complexity WHERE symbol_id = ?'),
        };
    }
}
//# sourceMappingURL=ComplexityStore.js.map