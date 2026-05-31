"use strict";
/**
 * KSA-161: Complexity Analyzer — Main orchestrator.
 * Coordinates calculation, grading, and storage.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplexityAnalyzer = void 0;
const ComplexityCalculator_js_1 = require("./ComplexityCalculator.js");
const GradeAssigner_js_1 = require("./GradeAssigner.js");
const ComplexityStore_js_1 = require("./ComplexityStore.js");
class ComplexityAnalyzer {
    calculator;
    grader;
    store;
    db;
    constructor(db) {
        this.db = db;
        this.calculator = new ComplexityCalculator_js_1.ComplexityCalculator();
        this.grader = new GradeAssigner_js_1.GradeAssigner();
        this.store = new ComplexityStore_js_1.ComplexityStore(db);
    }
    /** Analyze a single function given its body AST node. */
    analyzeFunction(symbolId, symbolName, filePath, startLine, endLine, bodyNode, language) {
        const breakdown = this.calculator.calculate(bodyNode, language);
        if (!breakdown)
            return null;
        const grade = this.grader.assignGrade(breakdown.cyclomatic_complexity);
        const result = {
            symbol_id: symbolId,
            symbol_name: symbolName,
            file_path: filePath,
            start_line: startLine,
            end_line: endLine,
            grade,
            ...breakdown,
        };
        this.store.upsert(result);
        return result;
    }
    /** Analyze all functions in a file (from DB symbols). Returns file-level summary. */
    analyzeFileFromDB(filePath, parseAndGetBody) {
        const symbols = this.db.prepare(`
      SELECT s.id, s.name, s.start_line, s.end_line, f.language, f.relative_path
      FROM symbols s
      JOIN files f ON f.id = s.file_id
      WHERE f.relative_path LIKE ? AND s.kind IN ('function', 'method')
    `).all(`%${filePath}%`);
        const results = [];
        for (const sym of symbols) {
            const bodyNode = parseAndGetBody(sym.id, sym.start_line, sym.end_line);
            if (!bodyNode)
                continue;
            const result = this.analyzeFunction(sym.id, sym.name, sym.relative_path, sym.start_line, sym.end_line, bodyNode, sym.language);
            if (result)
                results.push(result);
        }
        const totalCC = results.reduce((sum, r) => sum + r.cyclomatic_complexity, 0);
        return {
            file_path: filePath,
            functions: results,
            average_complexity: results.length > 0 ? totalCC / results.length : 0,
            max_complexity: results.length > 0 ? Math.max(...results.map(r => r.cyclomatic_complexity)) : 0,
            total_functions: results.length,
        };
    }
    /** Query stored complexity results with filters. */
    query(filters) {
        return this.store.query(filters);
    }
    /** Get complexity for a specific symbol by name. */
    getBySymbolName(symbolName, filePath) {
        let sql = `
      SELECT s.id FROM symbols s
      JOIN files f ON f.id = s.file_id
      WHERE s.name = ?
    `;
        const params = [symbolName];
        if (filePath) {
            sql += ' AND f.relative_path LIKE ?';
            params.push(`%${filePath}%`);
        }
        sql += ' LIMIT 1';
        const row = this.db.prepare(sql).get(...params);
        if (!row)
            return null;
        return this.store.getBySymbol(row.id);
    }
    /** Check if calculator supports a language. */
    supportsLanguage(language) {
        return this.calculator.supportsLanguage(language);
    }
}
exports.ComplexityAnalyzer = ComplexityAnalyzer;
//# sourceMappingURL=ComplexityAnalyzer.js.map