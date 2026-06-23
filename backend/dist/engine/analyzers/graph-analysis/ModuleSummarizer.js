/**
 * KSA-163: Module Summarizer — Aggregates quality metrics per module.
 */
import { GraphLoader } from './utils/GraphLoader.js';
import { CircularDepDetector } from './CircularDepDetector.js';
import { HotPathAnalyzer } from './HotPathAnalyzer.js';
import { DeadImportDetector } from './DeadImportDetector.js';
export class ModuleSummarizer {
    db;
    graphLoader;
    constructor(db) {
        this.db = db;
        this.graphLoader = new GraphLoader(db);
    }
    /** Generate summary for a specific module or all modules. */
    summarize(moduleName) {
        const modules = this.getModules(moduleName);
        const results = [];
        for (const mod of modules) {
            const circularDetector = new CircularDepDetector(this.graphLoader);
            const hotPathAnalyzer = new HotPathAnalyzer(this.graphLoader);
            const deadImportDetector = new DeadImportDetector(this.db);
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
//# sourceMappingURL=ModuleSummarizer.js.map