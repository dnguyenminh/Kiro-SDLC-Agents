"use strict";
/**
 * KSA-163: Hot Path Analyzer — Finds most-called functions via transitive callers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HotPathAnalyzer = void 0;
class HotPathAnalyzer {
    graphLoader;
    constructor(graphLoader) {
        this.graphLoader = graphLoader;
    }
    /** Find hot paths (functions with most callers). */
    analyze(options = {}) {
        const limit = options.limit ?? 20;
        const minCallers = options.minCallers ?? 2;
        const reverseGraph = this.graphLoader.loadReverseCallGraph(options.module);
        const results = [];
        for (const [symbolId] of reverseGraph) {
            const directCallers = reverseGraph.get(symbolId)?.length ?? 0;
            if (directCallers < minCallers)
                continue;
            const transitiveCallers = this.computeTransitiveCallers(symbolId, reverseGraph);
            const info = this.graphLoader.getSymbolInfo(symbolId);
            if (!info)
                continue;
            results.push({
                symbolId,
                symbolName: info.name,
                filePath: info.filePath,
                directCallers,
                transitiveCallers,
                kind: info.kind,
            });
        }
        // Sort by transitive callers descending
        results.sort((a, b) => b.transitiveCallers - a.transitiveCallers);
        return results.slice(0, limit);
    }
    /** Compute transitive caller count using BFS on reverse graph. */
    computeTransitiveCallers(symbolId, reverseGraph) {
        const visited = new Set();
        const queue = [symbolId];
        visited.add(symbolId);
        while (queue.length > 0) {
            const current = queue.shift();
            const callers = reverseGraph.get(current) || [];
            for (const caller of callers) {
                if (!visited.has(caller)) {
                    visited.add(caller);
                    queue.push(caller);
                }
            }
        }
        // Subtract 1 for the symbol itself
        return visited.size - 1;
    }
}
exports.HotPathAnalyzer = HotPathAnalyzer;
//# sourceMappingURL=HotPathAnalyzer.js.map