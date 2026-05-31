"use strict";
/**
 * KSA-163: Module Summarizer — Aggregates quality metrics per module.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleSummarizer = void 0;
const GraphLoader_js_1 = require("./utils/GraphLoader.js");
const CircularDepDetector_js_1 = require("./CircularDepDetector.js");
const HotPathAnalyzer_js_1 = require("./HotPathAnalyzer.js");
const DeadImportDetector_js_1 = require("./DeadImportDetector.js");
class ModuleSummarizer {
    db;
    graphLoader;
    constructor(db) {
        this.db = db;
        this.graphLoader = new GraphLoader_js_1.GraphLoader(db);
    }
    /** Generate summary for a specific module or all modules. */
    summarize(moduleName) {
        const modules = this.getModules(moduleName);
        const results = [];
        for (const mod of modules) {
            const circularDetector = new CircularDepDetector_js_1.CircularDepDetector(this.graphLoader);
            const hotPathAnalyzer = new HotPathAnalyzer_js_1.HotPathAnalyzer(this.graphLoader);
            const deadImportDetector = new DeadImportDetector_js_1.DeadImportDetector(this.db);
            const circularDeps = circularDetector.detect({ module: mod.name });
            const hotPaths = hotPathAnalyzer.analyze({ module: mod.name, limit: 5 });
            const deadImports = deadImportDetector.detect({ module: mod.name });
            const avgComplexity = this.getAvgComplexity(mod.name);
            results.push({
                module: mod.name,
                fileCount: mod.fileCount,
                symbolCount: mod.symbolCount,
                circularDeps: circularDeps.length,
                hotPaths,
                deadImports: deadImports.length,
                avgComplexity,
            });
        }
        return results;
    }
    getModules(name) {
        let sql = 'SELECT name, file_count as fileCount, symbol_count as symbolCount FROM modules';
        const params = [];
        if (name) {
            sql += ' WHERE name = ?';
            params.push(name);
        }
        return this.db.prepare(sql).all(...params);
    }
    getAvgComplexity(module) {
        const row = this.db.prepare(`
      SELECT AVG(c.cyclomatic_complexity) as avg
      FROM complexity c
      JOIN symbols s ON s.id = c.symbol_id
      JOIN files f ON f.id = s.file_id
      WHERE f.module = ?
    `).get(module);
        return row?.avg ?? null;
    }
}
exports.ModuleSummarizer = ModuleSummarizer;
//# sourceMappingURL=ModuleSummarizer.js.map