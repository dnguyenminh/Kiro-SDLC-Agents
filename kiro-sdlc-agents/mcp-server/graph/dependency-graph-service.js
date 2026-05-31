"use strict";
/**
 * KSA-155: Dependency Graph Service - BFS traversal on import relationships.
 * Supports outgoing (what does this file import?) and incoming (who imports this file?) queries.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DependencyGraphService = void 0;
const path = __importStar(require("path"));
class DependencyGraphService {
    db;
    fileResolver;
    constructor(db, fileResolver) {
        this.db = db;
        this.fileResolver = fileResolver;
    }
    /** Query dependency graph with direction and depth control. */
    query(file, direction = 'outgoing', depth = 1, includeExternal = false, limit = 50) {
        const startTime = Date.now();
        const clampedDepth = Math.min(Math.max(depth, 1), 5);
        const resolved = this.fileResolver.resolveFile(file);
        if (!resolved) {
            return this.fileNotFoundResponse(file);
        }
        let results;
        let cycles;
        if (direction === 'both') {
            const outgoing = this.bfsTraversal(resolved, 'outgoing', clampedDepth, includeExternal, limit);
            const incoming = this.bfsTraversal(resolved, 'incoming', clampedDepth, includeExternal, limit);
            results = this.mergeResults(outgoing.results, incoming.results);
            cycles = [...outgoing.cycles, ...incoming.cycles];
        }
        else {
            const traversal = this.bfsTraversal(resolved, direction, clampedDepth, includeExternal, limit);
            results = traversal.results;
            cycles = traversal.cycles;
        }
        return {
            root: resolved,
            direction,
            results,
            cycles,
            metadata: {
                totalNodes: results.length,
                maxDepthReached: Math.min(clampedDepth, Math.max(...results.map(r => r.depth), 0)),
                truncated: results.length >= limit,
                queryTimeMs: Date.now() - startTime,
                externalCount: results.filter(r => r.isExternal).length,
            },
        };
    }
    bfsTraversal(root, direction, maxDepth, includeExternal, limit) {
        const visited = new Set([root]);
        const results = [];
        const cycles = [];
        const queue = [
            { file: root, depth: 0, path: [root] },
        ];
        while (queue.length > 0 && results.length < limit) {
            const { file: current, depth: currentDepth, path: currentPath } = queue.shift();
            if (currentDepth >= maxDepth)
                continue;
            const deps = direction === 'outgoing'
                ? this.getOutgoingDeps(current)
                : this.getIncomingDeps(current);
            for (const dep of deps) {
                const isExternal = this.fileResolver.isExternal(dep.target);
                if (isExternal && !includeExternal)
                    continue;
                const resolvedTarget = isExternal
                    ? dep.target
                    : this.fileResolver.resolveImportTarget(current, dep.target);
                if (!resolvedTarget)
                    continue;
                // Cycle detection
                if (currentPath.includes(resolvedTarget)) {
                    cycles.push([...currentPath, resolvedTarget]);
                    continue;
                }
                if (!visited.has(resolvedTarget)) {
                    visited.add(resolvedTarget);
                    results.push({
                        file: resolvedTarget,
                        depth: currentDepth + 1,
                        importedSymbols: dep.symbols,
                        isExternal,
                    });
                    if (!isExternal && currentDepth + 1 < maxDepth) {
                        queue.push({
                            file: resolvedTarget,
                            depth: currentDepth + 1,
                            path: [...currentPath, resolvedTarget],
                        });
                    }
                }
            }
        }
        return { results, cycles };
    }
    getOutgoingDeps(filePath) {
        const rows = this.db.prepare(`
      SELECT target_symbol, metadata
      FROM relationships
      WHERE file_path = ? AND kind = 'imports'
      ORDER BY line
    `).all(filePath);
        // Group by module
        const grouped = new Map();
        for (const row of rows) {
            const module = this.extractModule(row.target_symbol);
            if (!grouped.has(module))
                grouped.set(module, []);
            const symbol = this.extractSymbolName(row.target_symbol);
            if (symbol)
                grouped.get(module).push(symbol);
        }
        return Array.from(grouped.entries()).map(([target, symbols]) => ({ target, symbols }));
    }
    getIncomingDeps(filePath) {
        const basename = path.basename(filePath, path.extname(filePath));
        const rows = this.db.prepare(`
      SELECT DISTINCT file_path, target_symbol
      FROM relationships
      WHERE kind = 'imports'
        AND (target_symbol LIKE ? OR target_symbol LIKE ? OR target_symbol LIKE ?)
    `).all(`%/${basename}`, `%${basename}%`, filePath);
        const grouped = new Map();
        for (const row of rows) {
            if (row.file_path === filePath)
                continue; // Skip self
            if (!grouped.has(row.file_path))
                grouped.set(row.file_path, []);
            grouped.get(row.file_path).push(this.extractSymbolName(row.target_symbol) || '*');
        }
        return Array.from(grouped.entries()).map(([target, symbols]) => ({ target, symbols }));
    }
    extractModule(targetSymbol) {
        // target_symbol format: "module/path.symbol" or "module/path"
        const lastDot = targetSymbol.lastIndexOf('.');
        if (lastDot > 0 && !targetSymbol.includes('/'))
            return targetSymbol;
        if (lastDot > 0)
            return targetSymbol.substring(0, lastDot);
        return targetSymbol;
    }
    extractSymbolName(targetSymbol) {
        const lastDot = targetSymbol.lastIndexOf('.');
        if (lastDot > 0 && lastDot < targetSymbol.length - 1) {
            return targetSymbol.substring(lastDot + 1);
        }
        return path.basename(targetSymbol);
    }
    mergeResults(outgoing, incoming) {
        const seen = new Set();
        const merged = [];
        for (const node of [...outgoing, ...incoming]) {
            if (!seen.has(node.file)) {
                seen.add(node.file);
                merged.push(node);
            }
        }
        return merged;
    }
    fileNotFoundResponse(file) {
        return {
            root: file,
            direction: 'outgoing',
            results: [],
            cycles: [],
            metadata: { totalNodes: 0, maxDepthReached: 0, truncated: false, queryTimeMs: 0, externalCount: 0 },
        };
    }
}
exports.DependencyGraphService = DependencyGraphService;
//# sourceMappingURL=dependency-graph-service.js.map