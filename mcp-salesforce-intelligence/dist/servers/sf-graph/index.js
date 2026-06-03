#!/usr/bin/env node
"use strict";
/**
 * sf-graph MCP Server — Dependency graph queries and impact analysis.
 * Exposes 4 tools via stdio JSON-RPC 2.0.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const server_base_js_1 = require("../../shared/server-base.js");
const errors_js_1 = require("../../shared/errors.js");
const dependency_graph_js_1 = require("./graph/dependency-graph.js");
const graph_cache_js_1 = require("./graph/graph-cache.js");
const dependencies_js_1 = require("./tools/dependencies.js");
const dependents_js_1 = require("./tools/dependents.js");
const impact_analysis_js_1 = require("./tools/impact-analysis.js");
const graph_export_js_1 = require("./tools/graph-export.js");
const TOOLS = [
    {
        name: 'sf_dependencies',
        description: 'Get forward dependencies of a Salesforce component (what it depends on).',
        inputSchema: {
            type: 'object',
            properties: {
                node_name: { type: 'string', description: 'Fully qualified component name' },
                depth: { type: 'number', description: 'Max traversal depth (default 3, max 10)', default: 3 },
                include_types: { type: 'array', items: { type: 'string' }, description: 'Filter by metadata types' },
            },
            required: ['node_name'],
        },
    },
    {
        name: 'sf_dependents',
        description: 'Get reverse dependencies (what depends on this component).',
        inputSchema: {
            type: 'object',
            properties: {
                node_name: { type: 'string', description: 'Fully qualified component name' },
                depth: { type: 'number', description: 'Max traversal depth (default 3, max 10)', default: 3 },
                include_types: { type: 'array', items: { type: 'string' }, description: 'Filter by metadata types' },
            },
            required: ['node_name'],
        },
    },
    {
        name: 'sf_impact_analysis',
        description: 'Analyze the impact of changing a component — shows all directly and indirectly affected components.',
        inputSchema: {
            type: 'object',
            properties: {
                node_name: { type: 'string', description: 'Component to analyze' },
                depth: { type: 'number', description: 'Max depth (default 3, capped at 10)', default: 3 },
            },
            required: ['node_name'],
        },
    },
    {
        name: 'sf_graph_export',
        description: 'Export the full dependency graph in JSON or DOT (Graphviz) format.',
        inputSchema: {
            type: 'object',
            properties: {
                format: { type: 'string', enum: ['json', 'dot'], description: 'Output format', default: 'json' },
                include_types: { type: 'array', items: { type: 'string' }, description: 'Filter nodes by type' },
            },
        },
    },
];
class SfGraphServer extends server_base_js_1.ServerBase {
    graph = new dependency_graph_js_1.DependencyGraph();
    graphCache = null;
    constructor() {
        super('sf-graph', TOOLS);
    }
    async onInitialize() {
        if (this.workspace) {
            this.graphCache = new graph_cache_js_1.GraphCache(this.workspace);
            const cached = this.graphCache.load();
            if (cached) {
                this.graph = cached;
                console.error(`[sf-graph] Loaded graph from cache: ${this.graph.nodeCount} nodes, ${this.graph.edgeCount} edges`);
            }
            else {
                console.error('[sf-graph] No graph cache found. Run sf_index_project first.');
            }
        }
    }
    async dispatchTool(name, args) {
        console.error(`[sf-graph] INFO: Tool call ${name}(${JSON.stringify(args).substring(0, 150)})`);
        try {
            if (this.graph.isEmpty && name !== 'sf_graph_export') {
                if (this.graphCache) {
                    const cached = this.graphCache.load();
                    if (cached)
                        this.graph = cached;
                }
                if (this.graph.isEmpty)
                    throw errors_js_1.Errors.noGraph();
            }
            switch (name) {
                case 'sf_dependencies': return await (0, dependencies_js_1.handleDependencies)(args, this.graph);
                case 'sf_dependents': return await (0, dependents_js_1.handleDependents)(args, this.graph);
                case 'sf_impact_analysis': return await (0, impact_analysis_js_1.handleImpactAnalysis)(args, this.graph);
                case 'sf_graph_export': return await (0, graph_export_js_1.handleGraphExport)(args, this.graph);
                default: return JSON.stringify({ error: 'UNKNOWN', message: `Unknown tool: ${name}` });
            }
        }
        catch (err) {
            if (err instanceof errors_js_1.SfToolError)
                return err.toJSON();
            console.error(`[sf-graph] ERROR: Unexpected error in ${name}:`, err);
            return JSON.stringify({ error: 'INTERNAL', message: `Internal error: ${err.message}` });
        }
    }
}
const server = new SfGraphServer();
server.start().catch((err) => {
    console.error('[sf-graph] Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map