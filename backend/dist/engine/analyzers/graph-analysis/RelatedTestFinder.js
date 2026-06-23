/**
 * KSA-163: Related Test Finder — Reverse BFS on call graph to find tests.
 */
import { TestFileDetector } from './utils/TestFileDetector.js';
export class RelatedTestFinder {
    graphLoader;
    testDetector;
    constructor(graphLoader) {
        this.graphLoader = graphLoader;
        this.testDetector = new TestFileDetector();
    }
    /** Find tests related to a symbol (by name or ID). */
    find(symbolName, options = {}) {
        const symbolId = this.graphLoader.resolveSymbolId(symbolName, options.filePath);
        if (symbolId === null)
            return null;
        const symbolInfo = this.graphLoader.getSymbolInfo(symbolId);
        if (!symbolInfo)
            return null;
        const maxDepth = options.maxDepth ?? 3;
        const reverseGraph = this.graphLoader.loadReverseCallGraph();
        const callerPaths = this.reverseBFS(symbolId, reverseGraph, maxDepth);
        const directTests = [];
        const indirectTests = [];
        for (const caller of callerPaths) {
            const callerInfo = this.graphLoader.getSymbolInfo(caller.symbolId);
            if (!callerInfo)
                continue;
            const isTest = this.testDetector.isTestFile(callerInfo.filePath) ||
                this.testDetector.isTestFunction(callerInfo.name);
            if (isTest) {
                const ref = {
                    symbolId: caller.symbolId,
                    testName: callerInfo.name,
                    filePath: callerInfo.filePath,
                    depth: caller.depth,
                    path: [callerInfo.name, ...caller.path.map(id => {
                            const info = this.graphLoader.getSymbolInfo(id);
                            return info?.name ?? `${id}`;
                        })],
                };
                if (caller.depth === 1) {
                    directTests.push(ref);
                }
                else {
                    indirectTests.push(ref);
                }
            }
        }
        return {
            symbol: { id: symbolId, name: symbolInfo.name, filePath: symbolInfo.filePath },
            directTests,
            indirectTests,
            totalTests: directTests.length + indirectTests.length,
        };
    }
    reverseBFS(startId, reverseGraph, maxDepth) {
        const visited = new Set();
        const queue = [
            { id: startId, depth: 0, path: [] },
        ];
        const results = [];
        while (queue.length > 0) {
            const { id, depth, path } = queue.shift();
            if (depth > maxDepth || visited.has(id))
                continue;
            visited.add(id);
            const callers = reverseGraph.get(id) || [];
            for (const caller of callers) {
                if (visited.has(caller))
                    continue;
                const newPath = [...path, id];
                const callerInfo = this.graphLoader.getSymbolInfo(caller);
                results.push({
                    symbolId: caller,
                    symbolName: callerInfo?.name ?? `${caller}`,
                    filePath: callerInfo?.filePath ?? 'unknown',
                    depth: depth + 1,
                    path: newPath,
                });
                queue.push({ id: caller, depth: depth + 1, path: newPath });
            }
        }
        return results;
    }
}
//# sourceMappingURL=RelatedTestFinder.js.map