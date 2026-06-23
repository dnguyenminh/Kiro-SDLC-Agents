"use strict";
/**
 * KSA-155: Dependency Formatters - tree/flat/graph output formats.
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
exports.toTreeFormat = toTreeFormat;
exports.toFlatFormat = toFlatFormat;
exports.toGraphFormat = toGraphFormat;
exports.formatDependencyResult = formatDependencyResult;
const path = __importStar(require("path"));
function toTreeFormat(result) {
    const { root, results } = result;
    const byDepth = new Map();
    for (const node of results) {
        if (!byDepth.has(node.depth))
            byDepth.set(node.depth, []);
        byDepth.get(node.depth).push(node);
    }
    const tree = {
        file: root,
        label: path.basename(root),
        depth: 0,
        importedSymbols: [],
        isExternal: false,
        children: buildChildren(byDepth, 1),
    };
    return { root, tree, cycles: result.cycles, metadata: result.metadata };
}
function buildChildren(byDepth, depth) {
    const nodes = byDepth.get(depth) || [];
    return nodes.map(n => ({
        file: n.file,
        label: path.basename(n.file),
        depth: n.depth,
        importedSymbols: n.importedSymbols,
        isExternal: n.isExternal,
        children: buildChildren(byDepth, depth + 1),
    }));
}
function toFlatFormat(result) {
    return {
        root: result.root,
        direction: result.direction,
        dependencies: result.results.map(r => ({
            file: r.file,
            depth: r.depth,
            importedSymbols: r.importedSymbols,
            isExternal: r.isExternal,
        })),
        cycles: result.cycles,
        metadata: result.metadata,
    };
}
function toGraphFormat(result) {
    const { root, results } = result;
    const nodes = [
        { id: root, label: path.basename(root), depth: 0, isExternal: false },
        ...results.map(r => ({
            id: r.file,
            label: path.basename(r.file),
            depth: r.depth,
            isExternal: r.isExternal,
        })),
    ];
    const edges = [];
    // Build edges from results (each result is connected to root or parent at depth-1)
    for (const r of results) {
        if (r.depth === 1) {
            edges.push({ from: root, to: r.file, symbols: r.importedSymbols });
        }
    }
    return { nodes, edges, cycles: result.cycles, metadata: result.metadata };
}
function formatDependencyResult(result, format) {
    switch (format) {
        case 'tree': return toTreeFormat(result);
        case 'flat': return toFlatFormat(result);
        case 'graph': return toGraphFormat(result);
        default: return toTreeFormat(result);
    }
}
//# sourceMappingURL=dependency-formatters.js.map