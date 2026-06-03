"use strict";
/**
 * Graph cache — persists DependencyGraph to JSON file.
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
exports.GraphCache = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const dependency_graph_js_1 = require("./dependency-graph.js");
const CACHE_FILENAME = '.sf-graph-cache.json';
const CACHE_VERSION = 1;
class GraphCache {
    cachePath;
    constructor(projectRoot) {
        this.cachePath = path.join(projectRoot, CACHE_FILENAME);
    }
    load() {
        try {
            if (!fs.existsSync(this.cachePath))
                return null;
            const content = fs.readFileSync(this.cachePath, 'utf-8');
            const data = JSON.parse(content);
            if (data.version !== CACHE_VERSION)
                return null;
            const graph = new dependency_graph_js_1.DependencyGraph();
            for (const node of data.nodes)
                graph.addNode(node);
            for (const edge of data.edges)
                graph.addEdge(edge.source, edge.target, edge.relationship);
            return graph;
        }
        catch {
            return null;
        }
    }
    save(graph) {
        try {
            const data = {
                version: CACHE_VERSION,
                built_at: new Date().toISOString(),
                nodes: graph.getAllNodes(),
                edges: graph.getAllEdges(),
            };
            fs.writeFileSync(this.cachePath, JSON.stringify(data, null, 2), 'utf-8');
        }
        catch (err) {
            console.error('[graph-cache] Failed to save:', err.message);
        }
    }
    invalidate() {
        try {
            if (fs.existsSync(this.cachePath))
                fs.unlinkSync(this.cachePath);
        }
        catch { /* ignore */ }
    }
}
exports.GraphCache = GraphCache;
//# sourceMappingURL=graph-cache.js.map